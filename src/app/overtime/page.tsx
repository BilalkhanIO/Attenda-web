'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Badge, EmptyState, Modal, Input } from '@/components/ui';
import { overtimeApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Clock, CheckCircle, XCircle, AlertCircle, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface OvertimeRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_minutes: number;
  reason?: string;
  rejection_reason?: string;
  created_at: string;
  user?: { id: string; name: string; department?: string; avatar_url?: string };
  attendance?: { date: string; shift?: { name: string } };
}

interface SummaryRow {
  user_id: string;
  name: string;
  department?: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  regular_pay: number;
  overtime_pay: number;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  approved: { label: 'Approved', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

function fmtMins(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OvertimePage() {
  const { hasRole, hasPermission } = useAuth();
  const canManage = hasPermission('overtime.manage') || hasRole('hr_admin', 'super_admin', 'manager');

  const [myRequests, setMyRequests] = useState<OvertimeRequest[]>([]);
  const [teamRequests, setTeamRequests] = useState<OvertimeRequest[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'my' | 'team' | 'summary'>(canManage ? 'team' : 'my');

  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const calls: Promise<unknown>[] = [overtimeApi.getMyRequests()];
      if (canManage) {
        calls.push(overtimeApi.getRequests({ status: 'pending' }));
        calls.push(overtimeApi.getSummary());
      }
      const [myRes, teamRes, sumRes] = await Promise.all(calls) as any[];
      setMyRequests(myRes?.data?.data || myRes?.data || []);
      if (canManage) {
        setTeamRequests(teamRes?.data?.data || teamRes?.data || []);
        setSummary(sumRes?.data?.data || sumRes?.data || []);
      }
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await overtimeApi.approveRequest(id);
      toast.success('Overtime approved');
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Rejection reason required'); return; }
    setActionLoading(rejectModal.id);
    try {
      await overtimeApi.rejectRequest(rejectModal.id, rejectReason);
      toast.success('Overtime rejected');
      setRejectModal({ open: false, id: '' });
      setRejectReason('');
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = teamRequests.filter(r => r.status === 'pending').length;

  const tabs = [
    ...(canManage ? [{ key: 'team' as const, label: `Approvals${pendingCount ? ` (${pendingCount})` : ''}` }] : []),
    { key: 'my' as const, label: 'My Requests' },
    ...(canManage ? [{ key: 'summary' as const, label: 'Weekly Summary' }] : []),
  ];

  const RequestCard = ({ req, showUser }: { req: OvertimeRequest; showUser: boolean }) => {
    const badge = STATUS_BADGE[req.status] || STATUS_BADGE.pending;
    return (
      <div className="flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <Clock size={16} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {showUser && req.user && (
              <span className="text-sm font-semibold text-slate-100">{req.user.name}</span>
            )}
            {req.user?.department && (
              <span className="text-xs text-slate-500">{req.user.department}</span>
            )}
            <Badge label={badge.label} color={badge.color} bg={badge.bg} />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-400">
              {req.attendance?.date ? fmtDate(req.attendance.date) : '—'}
              {req.attendance?.shift?.name ? ` · ${req.attendance.shift.name}` : ''}
            </span>
            <span className="text-xs font-semibold text-amber-400">{fmtMins(req.requested_minutes)}</span>
          </div>
          {req.reason && <p className="text-xs text-slate-500 mt-1">{req.reason}</p>}
          {req.rejection_reason && (
            <p className="text-xs text-rose-400 mt-1">Rejected: {req.rejection_reason}</p>
          )}
        </div>
        {showUser && req.status === 'pending' && (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => handleApprove(req.id)}
              disabled={actionLoading === req.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
            >
              <CheckCircle size={13} />
              Approve
            </button>
            <button
              onClick={() => { setRejectModal({ open: true, id: req.id }); setRejectReason(''); }}
              disabled={actionLoading === req.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
            >
              <XCircle size={13} />
              Reject
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Overtime"
        subtitle="Track and manage overtime requests"
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-800/40 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : (
        <>
          {/* Team approvals tab */}
          {tab === 'team' && canManage && (
            <Card className="glass-card">
              <div className="p-5 border-b border-white/5">
                <h2 className="text-sm font-bold text-slate-200">Pending Approvals</h2>
              </div>
              <div className="p-4 space-y-2">
                {teamRequests.length === 0 ? (
                  <EmptyState
                    icon={<CheckCircle size={22} />}
                    title="No pending requests"
                    description="All overtime requests have been reviewed."
                  />
                ) : (
                  teamRequests.map(req => (
                    <RequestCard key={req.id} req={req} showUser />
                  ))
                )}
              </div>
            </Card>
          )}

          {/* My requests tab */}
          {tab === 'my' && (
            <Card className="glass-card">
              <div className="p-5 border-b border-white/5">
                <h2 className="text-sm font-bold text-slate-200">My Overtime Requests</h2>
              </div>
              <div className="p-4 space-y-2">
                {myRequests.length === 0 ? (
                  <EmptyState
                    icon={<Clock size={22} />}
                    title="No overtime requests"
                    description="Your overtime requests will appear here once submitted from your attendance records."
                  />
                ) : (
                  myRequests.map(req => (
                    <RequestCard key={req.id} req={req} showUser={false} />
                  ))
                )}
              </div>
            </Card>
          )}

          {/* Weekly summary tab */}
          {tab === 'summary' && canManage && (
            <Card className="glass-card overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h2 className="text-sm font-bold text-slate-200">Weekly Overtime Summary</h2>
              </div>
              {summary.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<TrendingUp size={22} />}
                    title="No overtime this week"
                    description="No employees have logged overtime hours this week."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Employee</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Hrs</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Regular</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Overtime</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">OT Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map(row => (
                        <tr key={row.user_id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="px-5 py-3">
                            <span className="font-semibold text-slate-200">{row.name}</span>
                            {row.department && <span className="ml-2 text-xs text-slate-500">{row.department}</span>}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-300">{row.total_hours}h</td>
                          <td className="px-5 py-3 text-right text-slate-300">{row.regular_hours}h</td>
                          <td className="px-5 py-3 text-right">
                            <span className={row.overtime_hours > 0 ? 'font-semibold text-amber-400' : 'text-slate-500'}>
                              {row.overtime_hours}h
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-emerald-400">
                            {row.overtime_pay > 0 ? `+${row.overtime_pay.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Reject modal */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, id: '' })}
        title="Reject Overtime Request"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectModal({ open: false, id: '' })}>Cancel</Button>
            <Button
              variant="danger"
              loading={actionLoading === rejectModal.id}
              onClick={handleReject}
              icon={<XCircle size={14} />}
            >
              Reject
            </Button>
          </>
        }
      >
        <Input
          label="Reason"
          required
          placeholder="Explain why this overtime is not approved…"
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
        />
      </Modal>
    </DashboardLayout>
  );
}

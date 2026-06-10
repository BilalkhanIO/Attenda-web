'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Badge, EmptyState, Modal, Input, SectionCard, RequestItem } from '@/components/ui';
import { overtimeApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
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
  const { hasPermission } = useAuth();
  const canManage = hasPermission('overtime.manage');

  const [myRequests, setMyRequests] = useState<OvertimeRequest[]>([]);
  const [teamRequests, setTeamRequests] = useState<OvertimeRequest[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const buildRequestItem = (req: OvertimeRequest, showUser: boolean) => {
    const badge = STATUS_BADGE[req.status] || STATUS_BADGE.pending;
    const dateStr = req.attendance?.date ? fmtDate(req.attendance.date) : '—';
    const shiftStr = req.attendance?.shift?.name ? ` · ${req.attendance.shift.name}` : '';
    const primary = `${dateStr}${shiftStr} · ${fmtMins(req.requested_minutes)}`;
    const secondary = req.rejection_reason
      ? `Rejected: ${req.rejection_reason}`
      : req.reason || undefined;
    const statusActions = (
      <Badge label={badge.label} color={badge.color} bg={badge.bg} size="sm" />
    );
    return (
      <RequestItem
        key={req.id}
        name={showUser && req.user ? `${req.user.name}${req.user.department ? ` · ${req.user.department}` : ''}` : 'My Request'}
        primary={primary}
        primaryColor="#f59e0b"
        secondary={secondary}
        loading={actionLoading === req.id}
        onApprove={showUser && req.status === 'pending' ? () => handleApprove(req.id) : undefined}
        onReject={showUser && req.status === 'pending' ? () => { setRejectModal({ open: true, id: req.id }); setRejectReason(''); } : undefined}
        actions={!(showUser && req.status === 'pending') ? statusActions : undefined}
      />
    );
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Overtime"
        subtitle="Track and manage overtime requests"
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-800/40 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Team approvals */}
          {canManage && (
            <SectionCard
              icon={<CheckCircle size={15} />}
              iconColor="#10b981"
              title="Pending Approvals"
              count={teamRequests.length || undefined}
              countColor="#f59e0b"
            >
              {teamRequests.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle size={22} />}
                  title="No pending requests"
                  description="All overtime requests have been reviewed."
                />
              ) : (
                <div className="space-y-2">
                  {teamRequests.map(req => buildRequestItem(req, true))}
                </div>
              )}
            </SectionCard>
          )}

          {/* My requests */}
          <SectionCard
            icon={<Clock size={15} />}
            iconColor="#f59e0b"
            title="My Overtime Requests"
            count={myRequests.length || undefined}
          >
            {myRequests.length === 0 ? (
              <EmptyState
                icon={<Clock size={22} />}
                title="No overtime requests"
                description="Your overtime requests will appear here once submitted from your attendance records."
              />
            ) : (
              <div className="space-y-2">
                {myRequests.map(req => buildRequestItem(req, false))}
              </div>
            )}
          </SectionCard>

          {/* Weekly summary */}
          {canManage && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-(--glass-border)">
                <h2 className="text-[10px] font-black text-white uppercase tracking-widest">Weekly Overtime Summary</h2>
              </div>
              {summary.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<TrendingUp size={22} />}
                    title="No overtime this week"
                    description="No employees have logged overtime hours this week."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-(--glass-border)">
                        <th className="text-left px-4 py-2.5 label-xs">Employee</th>
                        <th className="text-right px-4 py-2.5 label-xs">Total</th>
                        <th className="text-right px-4 py-2.5 label-xs">Regular</th>
                        <th className="text-right px-4 py-2.5 label-xs">Overtime</th>
                        <th className="text-right px-4 py-2.5 label-xs">OT Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map(row => (
                        <tr key={row.user_id} className="border-b border-(--glass-border) hover:bg-(--glass-05) transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-bold text-white">{row.name}</span>
                            {row.department && <span className="ml-2 text-[10px] text-(--on-glass-dim)">{row.department}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-(--on-glass-muted)">{row.total_hours}h</td>
                          <td className="px-4 py-2.5 text-right text-xs text-(--on-glass-muted)">{row.regular_hours}h</td>
                          <td className="px-4 py-2.5 text-right text-xs">
                            <span style={{ color: row.overtime_hours > 0 ? 'var(--warning-500)' : 'var(--on-glass-dim)' }} className="font-bold">
                              {row.overtime_hours}h
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-bold" style={{ color: 'var(--success-500)' }}>
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
        </div>
      )}

      {/* Reject modal */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, id: '' })}
        title="Reject Overtime Request"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRejectModal({ open: false, id: '' })}>Cancel</Button>
            <Button
              variant="danger" size="sm"
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

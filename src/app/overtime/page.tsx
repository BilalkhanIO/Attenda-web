'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Badge, EmptyState, Modal, Input, SectionCard, RequestItem } from '@/components/ui';
import { overtimeApi } from '@/lib/api';
import {
  keys, myOvertimeRequestsQuery, pendingOvertimeRequestsQuery, overtimeSummaryQuery,
} from '@/lib/queries';
import type { OvertimeRequest } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { formatDate, formatNumber, LOCAL_TZ } from '@/lib/i18n';
import { Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

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
  // Style-pinned day-first render ("2 Aug 2026") in the viewer's timezone.
  return formatDate(s, { day: 'numeric', month: 'short', year: 'numeric', locale: 'en-GB', timeZone: LOCAL_TZ });
}

export default function OvertimePage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('overtime.manage');

  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [rejectReason, setRejectReason] = useState('');

  const myQuery      = useQuery(myOvertimeRequestsQuery());
  const pendingQuery = useQuery({ ...pendingOvertimeRequestsQuery(), enabled: canManage });
  const summaryQuery = useQuery({ ...overtimeSummaryQuery(), enabled: canManage });

  const myRequests   = myQuery.data ?? [];
  const teamRequests = pendingQuery.data ?? [];
  const summary      = summaryQuery.data ?? [];
  const loading = myQuery.isPending || (canManage && (pendingQuery.isPending || summaryQuery.isPending));

  // Optimistic status flip shared by approve/reject: the row updates
  // instantly, rolls back on failure, and the list re-syncs afterwards.
  const reviewOvertime = (status: 'approved' | 'rejected') =>
    async (vars: { id: string; reason?: string }) => {
      await queryClient.cancelQueries({ queryKey: keys.overtime.pending() });
      const previous = queryClient.getQueryData<OvertimeRequest[]>(keys.overtime.pending());
      queryClient.setQueryData<OvertimeRequest[]>(keys.overtime.pending(), old =>
        (old ?? []).map(r => r.id === vars.id ? { ...r, status } : r));
      return { previous };
    };
  const rollback = (_e: unknown, _v: unknown, ctx?: { previous?: OvertimeRequest[] }) => {
    if (ctx?.previous) queryClient.setQueryData(keys.overtime.pending(), ctx.previous);
  };
  const resync = () => {
    queryClient.invalidateQueries({ queryKey: keys.overtime.all });
    // Keep the unified Approvals inbox in sync
    queryClient.invalidateQueries({ queryKey: ['approvals', 'overtime'] });
  };

  const approveMutation = useMutation({
    mutationFn: (vars: { id: string }) => overtimeApi.approveRequest(vars.id),
    onMutate: reviewOvertime('approved'),
    onError: rollback,
    onSettled: resync,
    onSuccess: () => toast.success('Overtime approved'),
  });

  const rejectMutation = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => overtimeApi.rejectRequest(vars.id, vars.reason),
    onMutate: reviewOvertime('rejected'),
    onError: rollback,
    onSettled: resync,
    onSuccess: () => {
      toast.success('Overtime rejected');
      setRejectModal({ open: false, id: '' });
      setRejectReason('');
    },
  });

  const actionLoading = (id: string) =>
    (approveMutation.isPending && approveMutation.variables?.id === id) ||
    (rejectMutation.isPending && rejectMutation.variables?.id === id);

  const handleReject = () => {
    if (!rejectReason.trim()) { toast.error('Rejection reason required'); return; }
    rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason });
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
        loading={actionLoading(req.id)}
        onApprove={showUser && req.status === 'pending' ? () => approveMutation.mutate({ id: req.id }) : undefined}
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
                            {row.overtime_pay > 0 ? `+${formatNumber(row.overtime_pay, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
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
              loading={rejectMutation.isPending}
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

'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Avatar, Button, Modal, Textarea, Skeleton } from '@/components/ui';
import { leaveApi, overtimeApi, remoteApi, shiftsApi, attendanceApi } from '@/lib/api';
import { keys } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Calendar, AlarmClock, Home, Repeat, Clock, Check, X, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type ApprovalType = 'leave' | 'overtime' | 'remote' | 'swap' | 'late_notice';

/** Normalized row rendered in the unified queue. */
interface ApprovalItem {
  type: ApprovalType;
  id: string;
  requester: string;
  avatarUrl?: string;
  department?: string;
  summary: string;
  detail?: string;
  createdAt?: string;
  /** Whether reject needs a written reason. */
  rejectNeedsReason: boolean;
  /** Late notices are acknowledged, not approved/rejected. */
  acknowledgeOnly?: boolean;
}

const TYPE_META: Record<ApprovalType, { label: string; icon: React.ReactNode; color: string }> = {
  leave:       { label: 'Leave',       icon: <Calendar size={13} />,   color: '#00C896' },
  overtime:    { label: 'Overtime',    icon: <AlarmClock size={13} />, color: '#f59e0b' },
  remote:      { label: 'Remote',      icon: <Home size={13} />,       color: '#8b5cf6' },
  swap:        { label: 'Shift Swap',  icon: <Repeat size={13} />,     color: '#00E5FF' },
  late_notice: { label: 'Late Notice', icon: <Clock size={13} />,      color: '#94a3b8' },
};

// Loose row shape — each source endpoint nests differently; we normalize.
type Row = Record<string, unknown> & {
  id: string;
  user?: { name?: string; avatar_url?: string; department?: string } | null;
};
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
const day = (v: unknown): string => {
  const s = str(v);
  if (!s) return '';
  try { return format(new Date(s), 'MMM d'); } catch { return s; }
};

export default function ApprovalsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ApprovalType | 'all'>('all');
  const [rejectTarget, setRejectTarget] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);

  const can = {
    leave: hasPermission('leave.approve'),
    overtime: hasPermission('overtime.manage'),
    remote: hasPermission('remote.approve'),
    swap: hasPermission('shifts.swaps.approve'),
    late_notice: hasPermission('attendance.late_notices.manage'),
  };

  const leaveScope = hasPermission('leave.view_all') ? 'all' : 'team';
  const leaveQ = useQuery({
    queryKey: ['approvals', 'leave', leaveScope],
    enabled: can.leave,
    queryFn: async (): Promise<Row[]> => {
      const fn = leaveScope === 'all' ? leaveApi.getAllRequests : leaveApi.getTeamRequests;
      const rows: Row[] = (await fn()).data.data ?? [];
      return rows.filter(r => r.status === 'pending');
    },
  });
  const overtimeQ = useQuery({
    queryKey: ['approvals', 'overtime'],
    enabled: can.overtime,
    queryFn: async (): Promise<Row[]> =>
      (await overtimeApi.getRequests({ status: 'pending' })).data.data ?? [],
  });
  const remoteQ = useQuery({
    queryKey: ['approvals', 'remote'],
    enabled: can.remote,
    queryFn: async (): Promise<Row[]> =>
      (await remoteApi.getSessions({ status: 'pending' })).data.data ?? [],
  });
  const swapQ = useQuery({
    queryKey: ['approvals', 'swap'],
    enabled: can.swap,
    queryFn: async (): Promise<Row[]> => {
      const rows: Row[] = (await shiftsApi.getSwapRequests({ status: 'pending' })).data.data ?? [];
      return rows.filter(r => r.status === 'pending');
    },
  });
  const noticeQ = useQuery({
    queryKey: ['approvals', 'late_notice'],
    enabled: can.late_notice,
    queryFn: async (): Promise<Row[]> =>
      (await attendanceApi.getLateNotices({ status: 'pending' })).data.data ?? [],
  });

  const items: ApprovalItem[] = [
    ...(leaveQ.data ?? []).map((r): ApprovalItem => ({
      type: 'leave', id: r.id,
      requester: r.user?.name ?? 'Unknown', avatarUrl: r.user?.avatar_url, department: r.user?.department,
      summary: `${str(r.leave_type) ?? 'leave'} · ${day(r.start_date)} – ${day(r.end_date)} (${num(r.working_days) ?? '?'}d)`,
      detail: str(r.reason), createdAt: str(r.created_at), rejectNeedsReason: true,
    })),
    ...(overtimeQ.data ?? []).map((r): ApprovalItem => ({
      type: 'overtime', id: r.id,
      requester: r.user?.name ?? 'Unknown', avatarUrl: r.user?.avatar_url, department: r.user?.department,
      summary: `${num(r.requested_minutes) ?? '?'} minutes of overtime`,
      detail: str(r.reason), createdAt: str(r.created_at), rejectNeedsReason: true,
    })),
    ...(remoteQ.data ?? []).map((r): ApprovalItem => ({
      type: 'remote', id: r.id,
      requester: r.user?.name ?? 'Unknown', avatarUrl: r.user?.avatar_url, department: r.user?.department,
      summary: `Remote work · ${str(r.duration_type)?.replace('_', ' ') ?? 'today'}`,
      createdAt: str(r.created_at), rejectNeedsReason: false,
    })),
    ...(swapQ.data ?? []).map((r): ApprovalItem => {
      const requester = (r.requester as { name?: string } | undefined)?.name;
      const target = (r.target as { name?: string } | undefined)?.name;
      return {
        type: 'swap', id: r.id,
        requester: requester ?? 'Unknown',
        summary: `Shift swap with ${target ?? 'a colleague'}`,
        detail: str(r.reason), createdAt: str(r.created_at), rejectNeedsReason: true,
      };
    }),
    ...(noticeQ.data ?? []).map((r): ApprovalItem => ({
      type: 'late_notice', id: r.id,
      requester: r.user?.name ?? 'Unknown', avatarUrl: r.user?.avatar_url, department: r.user?.department,
      summary: `Running late on ${day(r.date)} · expected ${str(r.expected_time) ?? '?'}`,
      detail: str(r.reason), createdAt: str(r.created_at),
      rejectNeedsReason: false, acknowledgeOnly: true,
    })),
  ].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const loading = [leaveQ, overtimeQ, remoteQ, swapQ, noticeQ]
    .some(q => q.isLoading);

  const resync = (type: ApprovalType) => {
    queryClient.invalidateQueries({ queryKey: ['approvals', type] });
    if (type === 'leave') queryClient.invalidateQueries({ queryKey: keys.leave.all });
  };

  const act = useMutation({
    mutationFn: async (vars: { item: ApprovalItem; action: 'approve' | 'reject'; reason?: string }) => {
      const { item, action, reason } = vars;
      switch (item.type) {
        case 'leave':
          return action === 'approve' ? leaveApi.approve(item.id) : leaveApi.reject(item.id, reason!);
        case 'overtime':
          return action === 'approve' ? overtimeApi.approveRequest(item.id) : overtimeApi.rejectRequest(item.id, reason!);
        case 'remote':
          return action === 'approve' ? remoteApi.approveSession(item.id) : remoteApi.rejectSession(item.id);
        case 'swap':
          return action === 'approve' ? shiftsApi.approveSwap(item.id) : shiftsApi.rejectSwap(item.id, reason!);
        case 'late_notice':
          return attendanceApi.acknowledgeLateNotice(item.id);
      }
    },
    onMutate: vars => setActingOn(vars.item.id),
    onSettled: (_d, _e, vars) => { setActingOn(null); resync(vars.item.type); },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.item.acknowledgeOnly ? 'Acknowledged'
          : vars.action === 'approve' ? 'Approved' : 'Rejected');
      setRejectTarget(null);
      setRejectReason('');
    },
  });

  const onReject = (item: ApprovalItem) => {
    if (item.rejectNeedsReason) { setRejectTarget(item); setRejectReason(''); }
    else act.mutate({ item, action: 'reject' });
  };

  const visible = filter === 'all' ? items : items.filter(i => i.type === filter);
  const countsByType = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <PageHeader
        title="Approvals"
        subtitle={items.length > 0 ? `${items.length} requests waiting for review` : 'All caught up'}
      />

      {/* Type filter */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
        {(['all', ...Object.keys(TYPE_META)] as const).map(t => {
          const active = filter === t;
          const count = t === 'all' ? items.length : countsByType[t] ?? 0;
          return (
            <button key={t} onClick={() => setFilter(t as ApprovalType | 'all')}
              className={cn(
                'px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border',
                active
                  ? 'bg-[var(--primary-600)]/15 text-[var(--primary-600)] border-[var(--primary-600)]/25'
                  : 'text-[var(--on-glass-dim)] border-transparent hover:text-white hover:bg-white/5',
              )}>
              {t === 'all' ? 'All' : TYPE_META[t as ApprovalType].label}
              {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <Card className="glass-card">
          <div className="flex flex-col items-center py-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--success-100)] flex items-center justify-center mb-3">
              <Inbox size={20} className="text-[var(--success-700)]" />
            </div>
            <p className="text-sm font-bold text-white">Nothing waiting for you</p>
            <p className="text-xs text-[var(--on-glass-dim)] mt-1">New requests from your team will appear here.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {visible.map(item => {
            const meta = TYPE_META[item.type];
            const busy = actingOn === item.id;
            return (
              <Card key={`${item.type}-${item.id}`} className="glass-card">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar name={item.requester} imageUrl={item.avatarUrl} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white truncate">{item.requester}</p>
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md"
                          style={{ color: meta.color, backgroundColor: `${meta.color}1f` }}>
                          {meta.icon}{meta.label}
                        </span>
                        {item.department && (
                          <span className="text-[10px] text-[var(--on-glass-dim)]">{item.department}</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--on-glass-muted)] mt-0.5 truncate capitalize">{item.summary}</p>
                      {item.detail && (
                        <p className="text-[11px] text-[var(--on-glass-dim)] mt-0.5 truncate italic">“{item.detail}”</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    {item.acknowledgeOnly ? (
                      <Button size="sm" variant="outline" loading={busy}
                        onClick={() => act.mutate({ item, action: 'approve' })}>
                        Acknowledge
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" icon={<Check size={13} />} loading={busy}
                          onClick={() => act.mutate({ item, action: 'approve' })}>
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" icon={<X size={13} />} disabled={busy}
                          className="text-rose-400 hover:bg-rose-500/10"
                          onClick={() => onReject(item)}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={`Reject ${rejectTarget ? TYPE_META[rejectTarget.type].label.toLowerCase() : ''} request`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button loading={act.isPending}
              onClick={() => {
                if (rejectReason.trim().length < 5) { toast.error('Please give a short reason'); return; }
                if (rejectTarget) act.mutate({ item: rejectTarget, action: 'reject', reason: rejectReason.trim() });
              }}>
              Reject Request
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          required
          rows={3}
          placeholder="Shared with the requester"
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
        />
      </Modal>
    </DashboardLayout>
  );
}

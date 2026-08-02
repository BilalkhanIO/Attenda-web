'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, DataTable, Avatar, Badge, Button, Modal, ConfirmDialog,
  Textarea, StatBox, Dropdown, DatePicker, TimePicker,
} from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';
import { leaveApi } from '@/lib/api';
import {
  keys, leaveRequestsQuery, leaveRequestsListQuery, pendingLeaveCountQuery,
  myLeaveBalanceQuery, type LeaveListResult,
} from '@/lib/queries';
import { useUrlListParams, parsePageParam } from '@/lib/url-list-params';
import { leaveStatusConfig } from '@/lib/utils';
import type { LeaveRequest } from '@/types';
import { Calendar, Plus, Check, X, Search } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { formatDate, LOCAL_TZ } from '@/lib/i18n';

const PAGE_SIZE = 20;
const DEFAULT_SORT = 'created_at'; // server default for GET /leave/requests (desc)

// Style-pinned day-first render ("02 Aug") in the viewer's timezone.
const fmtLeaveDay = (d: string) =>
  formatDate(d, { day: '2-digit', month: 'short', locale: 'en-GB', timeZone: LOCAL_TZ });

const LEAVE_TYPES = [
  { value: 'annual',    label: 'Annual Leave (Paid)' },
  { value: 'sick',      label: 'Sick Leave (Paid)' },
  { value: 'wfh',       label: 'Work From Home (Paid)' },
  { value: 'unpaid',    label: 'Unpaid Leave' },
  { value: 'emergency', label: 'Emergency Leave (Paid)' },
];

const leaveSchema = z.object({
  leave_type: z.string().min(1, 'Leave type required'),
  start_date: z.string().min(1, 'Start date required'),
  end_date:   z.string().min(1, 'End date required'),
  leave_start_time: z.string().optional(),
  leave_end_time: z.string().optional(),
  reason:     z.string().min(5, 'Please provide a reason'),
}).refine((data) => {
  const hasStart = !!data.leave_start_time;
  const hasEnd = !!data.leave_end_time;
  if (!hasStart && !hasEnd) return true;
  if (!hasStart || !hasEnd) return false;
  if (data.start_date !== data.end_date) return false;
  return data.leave_end_time! > data.leave_start_time!;
}, {
  message: 'Timed leave must be one day with an end time after start time',
  path: ['leave_end_time'],
});
type LeaveForm = z.infer<typeof leaveSchema>;

const rejectSchema = z.object({ reason: z.string().min(5, 'Rejection reason required') });
type RejectForm = z.infer<typeof rejectSchema>;

// Both cache shapes live under the ['leave','requests'] prefix: the team
// scope holds a plain array, the org-wide scope the paginated result.
type LeaveCacheEntry = LeaveRequest[] | LeaveListResult | undefined;

function flipStatus(old: LeaveCacheEntry, id: string, status: 'approved' | 'rejected'): LeaveCacheEntry {
  if (Array.isArray(old)) return old.map(r => r.id === id ? { ...r, status } : r);
  if (old?.requests) return { ...old, requests: old.requests.map(r => r.id === id ? { ...r, status } : r) };
  return old;
}

function LeavePageContent() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  // HR (leave.view_all) gets the org-wide server-paginated list; managers
  // keep the team endpoint, which has no pagination support.
  const scope = hasPermission('leave.view_all') ? 'all' as const : 'team' as const;

  // List state lives in the URL so it survives refresh/back-nav
  const { searchParams, setParams } = useUrlListParams();
  const statusFilter = searchParams.get('status') ?? '';
  const page  = parsePageParam(searchParams.get('page'));
  const q     = searchParams.get('q') ?? '';
  const sort  = searchParams.get('sort') ?? DEFAULT_SORT;
  const order = searchParams.get('order') === 'asc' ? 'asc' as const : 'desc' as const;

  // Debounced (300ms) employee-name search — commits `q` to the URL.
  // Only typing arms the timer, so mount/back-nav never rewrite the URL.
  const [search, setSearch] = useState(q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      setParams({ q: value || null, page: null });
    }, 300);
  };
  useEffect(() => {
    if (!searchTimer.current) setSearch(q);
  }, [q]);

  const onSort = (key: string) => {
    if (key === sort) setParams({ order: order === 'desc' ? 'asc' : null, page: null });
    else setParams({ sort: key === DEFAULT_SORT ? null : key, order: null, page: null });
  };

  // Modal states
  const [addOpen, setAddOpen]           = useState(false);
  const [approveReq, setApproveReq]     = useState<LeaveRequest | null>(null);
  const [rejectReq, setRejectReq]       = useState<LeaveRequest | null>(null);

  const leaveForm  = useForm<LeaveForm>({ resolver: zodResolver(leaveSchema) });
  const rejectForm = useForm<RejectForm>({ resolver: zodResolver(rejectSchema) });

  const listQuery = useQuery({
    ...leaveRequestsListQuery({ status: statusFilter, q, page, limit: PAGE_SIZE, sort, order }),
    enabled: scope === 'all',
    placeholderData: keepPreviousData,
  });
  const teamQuery = useQuery({ ...leaveRequestsQuery('team'), enabled: scope === 'team' });
  const pendingCountQuery = useQuery({ ...pendingLeaveCountQuery(), enabled: scope === 'all' });
  const balanceQuery = useQuery(myLeaveBalanceQuery());
  const balances = balanceQuery.data ?? [];

  const teamRequests = teamQuery.data ?? [];
  const rows = scope === 'all'
    ? listQuery.data?.requests ?? []
    : teamRequests.filter(r => !statusFilter || r.status === statusFilter);
  const total   = scope === 'all' ? listQuery.data?.pagination.total ?? 0 : rows.length;
  const loading = scope === 'all' ? listQuery.isPending : teamQuery.isPending;
  const pendingCount = scope === 'all'
    ? pendingCountQuery.data ?? 0
    : teamRequests.filter(r => r.status === 'pending').length;

  // Optimistic status flip shared by approve/reject: the row updates
  // instantly, rolls back on failure, and the list re-syncs afterwards.
  // setQueriesData over the requests prefix covers both cache shapes.
  const requestsPrefix = [...keys.leave.all, 'requests'] as const;
  const reviewLeave = (status: 'approved' | 'rejected') =>
    async (vars: { id: string; reason?: string }) => {
      await queryClient.cancelQueries({ queryKey: requestsPrefix });
      const previous = queryClient.getQueriesData({ queryKey: requestsPrefix });
      queryClient.setQueriesData({ queryKey: requestsPrefix }, (old: unknown) =>
        flipStatus(old as LeaveCacheEntry, vars.id, status));
      return { previous };
    };
  const rollback = (_e: unknown, _v: unknown, ctx?: { previous?: Array<[QueryKey, unknown]> }) => {
    ctx?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
  };
  const resync = () => {
    queryClient.invalidateQueries({ queryKey: keys.leave.all });
  };

  const approveMutation = useMutation({
    mutationFn: (vars: { id: string }) => leaveApi.approve(vars.id),
    onMutate: reviewLeave('approved'),
    onError: rollback,
    onSettled: resync,
    onSuccess: () => { toast.success('Leave request approved'); setApproveReq(null); },
  });

  const rejectMutation = useMutation({
    mutationFn: (vars: { id: string; reason: string }) => leaveApi.reject(vars.id, vars.reason),
    onMutate: reviewLeave('rejected'),
    onError: rollback,
    onSettled: resync,
    onSuccess: () => {
      toast.success('Leave request rejected');
      setRejectReq(null);
      rejectForm.reset();
    },
  });

  const submitMutation = useMutation({
    mutationFn: (data: LeaveForm) => leaveApi.submit(data),
    onSuccess: () => {
      toast.success('Leave request submitted');
      setAddOpen(false);
      leaveForm.reset();
      resync();
    },
  });

  const approving = approveMutation.isPending;
  const onSubmitLeave = (data: LeaveForm) => submitMutation.mutate(data);
  const onApprove = () => { if (approveReq) approveMutation.mutate({ id: approveReq.id }); };
  const onReject = (data: RejectForm) => {
    if (rejectReq) rejectMutation.mutate({ id: rejectReq.id, reason: data.reason });
  };

  const columns: DataTableColumn<LeaveRequest>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (req) => req.user ? (
        <div className="flex items-center gap-3">
          <Avatar name={req.user.name} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-black text-white group-hover:text-(--primary-600) transition-colors truncate">{req.user.name}</p>
            <p className="text-[10px] font-bold text-(--on-glass-muted) uppercase tracking-widest truncate">{req.user.department || 'Operations'}</p>
          </div>
        </div>
      ) : <span className="text-xs text-(--on-glass-dim)">—</span>,
    },
    {
      key: 'leave_type',
      header: 'Leave Type',
      sortable: true,
      render: (req) => (
        <div>
          <p className="text-xs font-bold text-white uppercase tracking-tight">{(req.leave_type as unknown as string) || '—'}</p>
          <p className="text-[10px] font-bold text-(--on-glass-dim) uppercase tracking-widest mt-0.5">{(req.leave_type as unknown as string) === 'unpaid' ? 'UNPAID' : 'PAID'}</p>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (req) => (
        <>
          <span className="text-xs font-black text-white">{req.working_days} DAY{req.working_days !== 1 ? 'S' : ''}</span>
          {req.leave_start_time && req.leave_end_time && (
            <p className="text-[10px] font-bold text-(--on-glass-dim) uppercase tracking-widest font-mono mt-0.5">
              {req.leave_start_time} - {req.leave_end_time}
            </p>
          )}
        </>
      ),
    },
    {
      key: 'start_date',
      header: 'Dates',
      sortable: true,
      render: (req) => (
        <>
          <p className="text-xs font-black text-white font-mono">{fmtLeaveDay(req.start_date)}</p>
          <p className="text-[10px] font-bold text-(--on-glass-dim) uppercase tracking-widest font-mono">TO {fmtLeaveDay(req.end_date)}</p>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (req) => {
        const cfg = leaveStatusConfig[req.status];
        return <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} size="sm" />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (req) => (
        <>
          {req.status === 'pending' && hasPermission('leave.approve') && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setApproveReq(req)} aria-label="Approve request" className="action-btn action-btn-approve">
                <Check size={12} />
              </button>
              <button onClick={() => { setRejectReq(req); rejectForm.reset(); }} aria-label="Reject request" className="action-btn action-btn-reject">
                <X size={12} />
              </button>
            </div>
          )}
          {req.rejection_reason && (
            <p className="text-[10px] font-medium text-(--danger-500) max-w-50 truncate uppercase tracking-widest" title={req.rejection_reason}>
              {req.rejection_reason}
            </p>
          )}
        </>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Leave Management"
        subtitle={pendingCount > 0 ? `${pendingCount} requests pending approval` : 'Track and manage leave requests'}
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
            Request Leave
          </Button>
        }
      />

      {/* Leave Balance Cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
          {balances.map(b => (
            <StatBox
              key={b.leave_type}
              label={b.leave_type.replace('_', ' ')}
              value={`${b.available_days} / ${b.total_days}`}
              note={`${b.used_days} days used`}
            />
          ))}
        </div>
      )}

      <Card>
        {/* Search (org-wide list only) — applied server-side */}
        {scope === 'all' && (
          <div className="p-4 border-b border-[var(--glass-border)] bg-(--glass-05)">
            <div className="relative max-w-md group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-(--on-glass-dim) group-focus-within:text-(--primary-600) transition-colors" />
              <input
                placeholder="Search by employee name..."
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                className="panel w-full pl-12 pr-4 py-3 text-sm text-white outline-none placeholder:text-(--on-glass-dim)"
              />
            </div>
          </div>
        )}

        {/* Status filter — server-side for the org-wide list */}
        <div className="flex items-center gap-1 px-5 pt-4 border-b border-[var(--glass-border)] overflow-x-auto bg-[var(--glass-05)]">
          {['', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => {
            const label = scope === 'all'
              ? (s === '' ? 'All' : s.toUpperCase())
              : (s === '' ? `All (${teamRequests.length})` : `${s.toUpperCase()} (${teamRequests.filter(r => r.status === s).length})`);
            return (
              <button key={s} onClick={() => setParams({ status: s || null, page: null })}
                className={cn(
                  "px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2",
                  statusFilter === s
                    ? "text-[var(--primary-600)] border-[var(--primary-600)]"
                    : "text-[var(--on-glass-dim)] border-transparent hover:text-white"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        <DataTable<LeaveRequest>
          columns={columns}
          data={rows}
          rowKey={r => r.id}
          loading={loading}
          {...(scope === 'all' ? {
            page,
            pageSize: PAGE_SIZE,
            total,
            onPageChange: (p: number) => setParams({ page: p <= 1 ? null : String(p) }),
            sortKey: sort,
            sortDir: order,
            onSort,
          } : {})}
          emptyState={
            <div className="py-24 text-center">
              <Calendar size={32} className="mx-auto text-[var(--on-glass-dim)] mb-4" />
              <p className="text-[11px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.3em]">No Leave Records Found</p>
            </div>
          }
        />
      </Card>

      {/* Request Leave Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Request Leave" size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={leaveForm.handleSubmit(onSubmitLeave)} loading={leaveForm.formState.isSubmitting}>
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Controller control={leaveForm.control} name="leave_type"
            render={({ field }) => (
              <Dropdown label="Leave Type" required
                value={field.value ?? ''}
                onChange={field.onChange}
                options={LEAVE_TYPES}
                placeholder="Select type..."
                error={leaveForm.formState.errors.leave_type?.message}
              />
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <Controller control={leaveForm.control} name="start_date"
              render={({ field }) => (
                <DatePicker label="Start Date" value={field.value ?? ''}
                  onChange={v => field.onChange(v ?? '')}
                  error={leaveForm.formState.errors.start_date?.message}
                />
              )}
            />
            <Controller control={leaveForm.control} name="end_date"
              render={({ field }) => (
                <DatePicker label="End Date" value={field.value ?? ''}
                  onChange={v => field.onChange(v ?? '')}
                  error={leaveForm.formState.errors.end_date?.message}
                />
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Controller control={leaveForm.control} name="leave_start_time"
              render={({ field }) => (
                <TimePicker label="Start Time (optional)" value={field.value ?? ''}
                  onChange={v => field.onChange(v ?? '')}
                />
              )}
            />
            <Controller control={leaveForm.control} name="leave_end_time"
              render={({ field }) => (
                <TimePicker label="End Time (optional)" value={field.value ?? ''}
                  onChange={v => field.onChange(v ?? '')}
                  error={leaveForm.formState.errors.leave_end_time?.message}
                />
              )}
            />
          </div>
          <Textarea label="Reason" required placeholder="State the reason for leave..."
            error={leaveForm.formState.errors.reason?.message}
            {...leaveForm.register('reason')}
          />
        </div>
      </Modal>

      {/* Approve Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!approveReq}
        onClose={() => setApproveReq(null)}
        onConfirm={onApprove}
        loading={approving}
        title="Approve Leave"
        message={`Approve ${approveReq?.working_days}-day leave for ${approveReq?.user?.name}?`}
        confirmLabel="Approve"
        variant="primary"
      />

      {/* Reject Modal */}
      <Modal isOpen={!!rejectReq} onClose={() => setRejectReq(null)} title="Reject Leave Request" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectReq(null)}>Cancel</Button>
            <Button variant="danger"
              onClick={rejectForm.handleSubmit(onReject)}
              loading={rejectForm.formState.isSubmitting}>
              Reject Request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed">
            Rejecting request for <strong>{rejectReq?.user?.name}</strong>. A reason is required.
          </p>
          <Textarea label="Rejection Reason" required
            placeholder="Explain why this request is being rejected..."
            error={rejectForm.formState.errors.reason?.message}
            {...rejectForm.register('reason')}
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}

// useSearchParams requires a Suspense boundary during prerendering
export default function LeavePage() {
  return (
    <Suspense fallback={null}>
      <LeavePageContent />
    </Suspense>
  );
}

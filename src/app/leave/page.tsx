'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, ConfirmDialog,
  Textarea, StatBox, Dropdown, DatePicker, TimePicker,
} from '@/components/ui';
import { leaveApi } from '@/lib/api';
import { leaveStatusConfig, getApiError } from '@/lib/utils';
import type { LeaveRequest } from '@/types';
import { Calendar, Plus, Check, X } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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

export default function LeavePage() {
  const { hasPermission } = useAuth();
  const [requests, setRequests]   = useState<LeaveRequest[]>([]);
  const [balances, setBalances]   = useState<{leave_type:string; total_days:number; used_days:number; available_days:number}[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatus] = useState('');

  // Modal states
  const [addOpen, setAddOpen]           = useState(false);
  const [approveReq, setApproveReq]     = useState<LeaveRequest | null>(null);
  const [rejectReq, setRejectReq]       = useState<LeaveRequest | null>(null);
  const [approving, setApproving]       = useState(false);

  const leaveForm  = useForm<LeaveForm>({ resolver: zodResolver(leaveSchema) });
  const rejectForm = useForm<RejectForm>({ resolver: zodResolver(rejectSchema) });

  const fetchRequests = useCallback(async () => {
    try {
      const fn = hasPermission('leave.view_all') ? leaveApi.getAllRequests : leaveApi.getTeamRequests;
      const [reqRes, balRes] = await Promise.allSettled([fn(), leaveApi.getMyBalance()]);
      if (reqRes.status === 'fulfilled') setRequests(reqRes.value.data.data || []);
      if (balRes.status === 'fulfilled') setBalances(balRes.value.data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const onSubmitLeave = async (data: LeaveForm) => {
    try {
      await leaveApi.submit(data);
      toast.success('Leave request submitted');
      setAddOpen(false);
      leaveForm.reset();
      fetchRequests();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const onApprove = async () => {
    if (!approveReq) return;
    setApproving(true);
    try {
      await leaveApi.approve(approveReq.id);
      toast.success('Leave request approved');
      setApproveReq(null);
      fetchRequests();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setApproving(false);
    }
  };

  const onReject = async (data: RejectForm) => {
    if (!rejectReq) return;
    try {
      await leaveApi.reject(rejectReq.id, data.reason);
      toast.success('Leave request rejected');
      setRejectReq(null);
      rejectForm.reset();
      fetchRequests();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const filtered = requests.filter(r => !statusFilter || r.status === statusFilter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

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
        {/* Status filter */}
        <div className="flex items-center gap-1 px-5 pt-4 border-b border-[var(--glass-border)] overflow-x-auto bg-[var(--glass-05)]">
          {['', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={cn(
                "px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2",
                statusFilter === s
                  ? "text-[var(--primary-600)] border-[var(--primary-600)]"
                  : "text-[var(--on-glass-dim)] border-transparent hover:text-white"
              )}
            >
              {s === '' ? `All (${requests.length})` : `${s.toUpperCase()} (${requests.filter(r => r.status === s).length})`}
            </button>
          ))}
        </div>

        <Table
          headers={['Employee', 'Leave Type', 'Duration', 'Dates', 'Status', 'Actions']}
          loading={loading}
          emptyState={
            <div className="py-24 text-center">
               <Calendar size={32} className="mx-auto text-[var(--on-glass-dim)] mb-4" />
               <p className="text-[11px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.3em]">No Leave Records Found</p>
            </div>
          }
        >
          {filtered.map((req) => {
            const cfg = leaveStatusConfig[req.status];
            return (
              <tr key={req.id} className="hover:bg-(--glass-05) transition-all group">
                <td className="py-3 px-4">
                  {req.user ? (
                    <div className="flex items-center gap-3">
                      <Avatar name={req.user.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white group-hover:text-(--primary-600) transition-colors truncate">{req.user.name}</p>
                        <p className="text-[10px] font-bold text-(--on-glass-muted) uppercase tracking-widest truncate">{req.user.department || 'Operations'}</p>
                      </div>
                    </div>
                  ) : <span className="text-xs text-(--on-glass-dim)">—</span>}
                </td>
                <td className="py-3 px-4">
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">{(req.leave_type as unknown as string) || '—'}</p>
                    <p className="text-[10px] font-bold text-(--on-glass-dim) uppercase tracking-widest mt-0.5">{(req.leave_type as unknown as string) === 'unpaid' ? 'UNPAID' : 'PAID'}</p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs font-black text-white">{req.working_days} DAY{req.working_days !== 1 ? 'S' : ''}</span>
                  {req.leave_start_time && req.leave_end_time && (
                    <p className="text-[10px] font-bold text-(--on-glass-dim) uppercase tracking-widest font-mono mt-0.5">
                      {req.leave_start_time} - {req.leave_end_time}
                    </p>
                  )}
                </td>
                <td className="py-3 px-4">
                  <p className="text-xs font-black text-white font-mono">{format(new Date(req.start_date), 'dd MMM')}</p>
                  <p className="text-[10px] font-bold text-(--on-glass-dim) uppercase tracking-widest font-mono">TO {format(new Date(req.end_date), 'dd MMM')}</p>
                </td>
                <td className="py-3 px-4">
                  <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} size="sm" />
                </td>
                <td className="py-3 px-4">
                  {req.status === 'pending' && hasPermission('leave.approve') && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setApproveReq(req)} className="action-btn action-btn-approve">
                        <Check size={12} />
                      </button>
                      <button onClick={() => { setRejectReq(req); rejectForm.reset(); }} className="action-btn action-btn-reject">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {req.rejection_reason && (
                    <p className="text-[10px] font-medium text-(--danger-500) max-w-50 truncate uppercase tracking-widest" title={req.rejection_reason}>
                      {req.rejection_reason}
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
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

'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, ConfirmDialog,
  Textarea, Input, Select, EmptyState
} from '@/components/ui';
import { leaveApi } from '@/lib/api';
import { leaveStatusConfig, formatDate, getApiError } from '@/lib/utils';
import type { LeaveRequest } from '@/types';
import { Calendar, Plus, Check, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
  reason:     z.string().min(5, 'Please provide a reason'),
});
type LeaveForm = z.infer<typeof leaveSchema>;

const rejectSchema = z.object({ reason: z.string().min(5, 'Rejection reason required') });
type RejectForm = z.infer<typeof rejectSchema>;

export default function LeavePage() {
  const { user, hasRole } = useAuth();
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
      const fn = hasRole('hr_admin', 'super_admin') ? leaveApi.getAllRequests : leaveApi.getTeamRequests;
      const [reqRes, balRes] = await Promise.allSettled([fn(), leaveApi.getMyBalance()]);
      if (reqRes.status === 'fulfilled') setRequests(reqRes.value.data.data || []);
      if (balRes.status === 'fulfilled') setBalances(balRes.value.data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [hasRole]);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {balances.map(b => (
            <Card key={b.leave_type} className="p-5 hover:bg-[var(--glass-15)] transition-all group">
              <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-3">{b.leave_type.replace('_', ' ')}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-white group-hover:text-[var(--primary-600)] transition-colors">{b.available_days}</span>
                <span className="text-[11px] font-bold text-[var(--on-glass-dim)] uppercase tracking-tighter">/ {b.total_days} total</span>
              </div>
              <div className="mt-4 h-1.5 bg-[var(--glass-10)] rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-[var(--primary-600)] rounded-full transition-all duration-700"
                  style={{ width: `${b.total_days > 0 ? (b.available_days / b.total_days) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest mt-2">{b.used_days} days used</p>
            </Card>
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
              <tr key={req.id} className="hover:bg-[var(--glass-05)] transition-all group">
                <td className="py-4 px-6">
                  {req.user ? (
                    <div className="flex items-center gap-4">
                      <Avatar name={req.user.name} size="md" />
                      <div className="min-w-0">
                        <p className="text-[15px] font-black text-white group-hover:text-[var(--primary-600)] transition-colors truncate">{req.user.name}</p>
                        <p className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest truncate">{req.user.department || 'Operations'}</p>
                      </div>
                    </div>
                  ) : <span className="text-xs text-[var(--on-glass-dim)]">—</span>}
                </td>
                <td className="py-4 px-6">
                  <div>
                    <p className="text-sm font-bold text-white uppercase tracking-tight">{(req.leave_type as unknown as string) || '—'}</p>
                    <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest mt-0.5">{(req.leave_type as unknown as string) === 'unpaid' ? 'UNPAID' : 'PAID'}</p>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="text-sm font-black text-white">{req.working_days} DAY{req.working_days !== 1 ? 'S' : ''}</span>
                </td>
                <td className="py-4 px-6">
                  <p className="text-sm font-black text-white font-mono">{format(new Date(req.start_date), 'dd MMM')}</p>
                  <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest font-mono">TO {format(new Date(req.end_date), 'dd MMM')}</p>
                </td>
                <td className="py-4 px-6">
                  <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} size="sm" />
                </td>
                <td className="py-4 px-6">
                  {req.status === 'pending' && hasRole('manager', 'hr_admin', 'super_admin') && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setApproveReq(req)}
                        className="w-8 h-8 rounded-lg bg-[var(--success-500)] text-white flex items-center justify-center hover:brightness-110 transition-all shadow-lg shadow-[var(--success-500)]/20"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => { setRejectReq(req); rejectForm.reset(); }}
                        className="w-8 h-8 rounded-lg bg-[var(--danger-500)] text-white flex items-center justify-center hover:brightness-110 transition-all shadow-lg shadow-[var(--danger-500)]/20"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {req.rejection_reason && (
                    <p className="text-[10px] font-medium text-[var(--danger-500)] max-w-[200px] truncate uppercase tracking-widest" title={req.rejection_reason}>
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
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={leaveForm.handleSubmit(onSubmitLeave)} loading={leaveForm.formState.isSubmitting}>
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <Select label="Leave Type" required
            placeholder="Select type..."
            options={LEAVE_TYPES}
            error={leaveForm.formState.errors.leave_type?.message}
            {...leaveForm.register('leave_type')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" required
              error={leaveForm.formState.errors.start_date?.message}
              {...leaveForm.register('start_date')}
            />
            <Input label="End Date" type="date" required
              error={leaveForm.formState.errors.end_date?.message}
              {...leaveForm.register('end_date')}
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

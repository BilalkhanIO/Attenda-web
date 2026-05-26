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
        subtitle={pendingCount > 0 ? `${pendingCount} requests pending approval` : 'All leave requests'}
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
            Request Leave
          </Button>
        }
      />

      {/* Leave Balance Cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {balances.map(b => (
            <Card key={b.leave_type} className="p-4">
              <p className="text-xs font-semibold text-[var(--gray-500)] capitalize mb-2">{b.leave_type.replace('_', ' ')}</p>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold text-[var(--dark-950)]">{b.available_days}</span>
                <span className="text-xs text-[var(--gray-500)] mb-0.5">/ {b.total_days} days</span>
              </div>
              <div className="mt-2 h-1.5 bg-[var(--gray-100)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--primary-600)] rounded-full transition-all"
                  style={{ width: `${b.total_days > 0 ? (b.available_days / b.total_days) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-[var(--gray-500)] mt-1">{b.used_days} used</p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        {/* Status filter */}
        <div className="flex items-center gap-2 px-5 pt-4 border-b border-[var(--gray-100)] overflow-x-auto">
          {['', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)]'
                  : 'text-[var(--gray-500)] hover:text-[var(--dark-950)]'
              }`}
            >
              {s === '' ? `All (${requests.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${requests.filter(r => r.status === s).length})`}
            </button>
          ))}
        </div>

        <Table
          headers={['Employee', 'Leave Type', 'Duration', 'Dates', 'Status', 'Actions']}
          loading={loading}
          emptyState={
            <EmptyState
              icon={<Calendar size={24} />}
              title="No leave requests"
              description="No leave requests found."
            />
          }
        >
          {filtered.map((req) => {
            const cfg = leaveStatusConfig[req.status];
            return (
              <tr key={req.id} className="border-b border-[var(--gray-100)] hover:bg-[var(--gray-50)] transition-colors">
                <td className="py-3 px-4">
                  {req.user ? (
                    <div className="flex items-center gap-3">
                      <Avatar name={req.user.name} size="sm" />
                      <div>
                        <p className="text-sm font-semibold">{req.user.name}</p>
                        <p className="text-xs text-[var(--gray-500)]">{req.user.department}</p>
                      </div>
                    </div>
                  ) : '—'}
                </td>
                <td className="py-3 px-4">
                  <div>
                    <p className="text-sm font-medium capitalize">{(req.leave_type as unknown as string) || '—'}</p>
                    <p className="text-xs text-[var(--gray-500)]">{(req.leave_type as unknown as string) === 'unpaid' ? 'Unpaid' : 'Paid'}</p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-semibold">{req.working_days} day{req.working_days !== 1 ? 's' : ''}</span>
                </td>
                <td className="py-3 px-4">
                  <p className="text-xs text-[var(--dark-950)]">{formatDate(req.start_date)}</p>
                  <p className="text-xs text-[var(--gray-500)]">to {formatDate(req.end_date)}</p>
                </td>
                <td className="py-3 px-4">
                  <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
                </td>
                <td className="py-3 px-4">
                  {req.status === 'pending' && hasRole('manager', 'hr_admin', 'super_admin') && (
                    <div className="flex items-center gap-2">
                      <Button variant="success" size="sm" icon={<Check size={12} />}
                        onClick={() => setApproveReq(req)}>
                        Approve
                      </Button>
                      <Button variant="danger" size="sm" icon={<X size={12} />}
                        onClick={() => { setRejectReq(req); rejectForm.reset(); }}>
                        Reject
                      </Button>
                    </div>
                  )}
                  {req.rejection_reason && (
                    <p className="text-xs text-[var(--danger-800)] max-w-[200px] truncate" title={req.rejection_reason}>
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
        <div className="space-y-4">
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
          <Textarea label="Reason" required placeholder="Brief reason for leave..."
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
        title="Approve Leave Request"
        message={`Approve ${approveReq?.working_days}-day leave for ${approveReq?.user?.name} (${approveReq?.start_date} – ${approveReq?.end_date})?`}
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
          <p className="text-sm text-[var(--gray-500)]">
            Rejecting leave for <strong>{rejectReq?.user?.name}</strong> ({rejectReq?.working_days} days).
            A reason is required.
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

'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Avatar, Badge, EmptyState, Table, Modal, Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { shiftsApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import type { SwapRequest } from '@/types';
import { Check, X, ArrowLeftRight } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  approved: { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

export default function ShiftSwapsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('shifts.swaps.approve');

  const [swaps, setSwaps]         = useState<SwapRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; swap: SwapRequest | null }>({ open: false, swap: null });
  const [rejectReason, setRejectReason] = useState('');
  const [actionId, setActionId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await shiftsApi.getSwapRequests();
      setSwaps(data.data || []);
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (swap: SwapRequest) => {
    setActionId(swap.id);
    try {
      await shiftsApi.approveSwap(swap.id);
      toast.success('Swap approved');
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setActionId(null); }
  };

  const handleReject = async () => {
    if (!rejectModal.swap || !rejectReason.trim()) { toast.error('Reason required'); return; }
    setActionId(rejectModal.swap.id);
    try {
      await shiftsApi.rejectSwap(rejectModal.swap.id, rejectReason);
      toast.success('Swap rejected');
      setRejectModal({ open: false, swap: null });
      setRejectReason('');
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setActionId(null); }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Shift Swaps"
        subtitle="Review and manage shift swap requests"
        breadcrumb={[{ label: 'Shifts', href: '/shifts' }, { label: 'Swaps' }]}
      />

      <Card className="glass-card overflow-hidden">
        <Table
          headers={['Requester', 'Their Shift', 'Recipient', 'Target Shift', 'Status', ...(canManage ? ['Actions'] : [])]}
          loading={loading}
          emptyState={<EmptyState icon={<ArrowLeftRight size={22} />} title="No swap requests" description="Shift swap requests will appear here." />}
        >
          {swaps.map(req => {
            const badge = STATUS_COLOR[req.status] || STATUS_COLOR.pending;
            return (
              <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={req.requester.name} size="sm" />
                    <span className="text-sm font-medium text-white">{req.requester.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-white">{req.requester_assignment?.shift?.name ?? '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{req.requester_assignment?.date ?? ''}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={req.target.name} size="sm" />
                    <span className="text-sm font-medium text-white">{req.target.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-white">{req.target_assignment?.shift?.name ?? '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{req.target_assignment?.date ?? ''}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge label={req.status} color={badge.color} bg={badge.bg} />
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    {req.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleApprove(req)} disabled={actionId === req.id}
                          className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center transition-colors disabled:opacity-50">
                          <Check size={13} />
                        </button>
                        <button onClick={() => { setRejectModal({ open: true, swap: req }); setRejectReason(''); }} disabled={actionId === req.id}
                          className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition-colors disabled:opacity-50">
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </Table>
      </Card>

      <Modal isOpen={rejectModal.open} onClose={() => setRejectModal({ open: false, swap: null })}
        title="Reject Swap Request" size="sm"
        footer={<><Button variant="ghost" onClick={() => setRejectModal({ open: false, swap: null })}>Cancel</Button><Button variant="danger" loading={!!actionId} onClick={handleReject} icon={<X size={13} />}>Reject</Button></>}>
        <Input label="Reason" required placeholder="Why is this swap not approved?" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
      </Modal>
    </DashboardLayout>
  );
}

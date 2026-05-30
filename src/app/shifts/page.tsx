'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Modal, ConfirmDialog, Input, Select,
  Badge, Avatar, EmptyState, Table
} from '@/components/ui';
import { shiftsApi } from '@/lib/api';
import { getApiError, formatTime } from '@/lib/utils';
import type { Shift, ShiftAssignment, SwapRequest } from '@/types';
import {
  Plus, Calendar, ChevronLeft, ChevronRight, Send,
  Check, X, Clock, Edit2, Trash2, Sparkles
} from 'lucide-react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';

// ─── Schemas ──────────────────────────────────────────
const shiftSchema = z.object({
  name:       z.string().min(1, 'Shift name required'),
  start_time: z.string().min(1, 'Start time required'),
  end_time:   z.string().min(1, 'End time required'),
  color:      z.string().min(1).default('#f15153'),
  days_of_week: z.array(z.number()).min(1, 'Select at least one day'),
});
type ShiftForm = { name: string; start_time: string; end_time: string; color: string; days_of_week: number[] };

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SHIFT_COLORS = ['#f15153','#065F46','#5B21B6','#92400E','#991B1B','#0F766E'];

function ShiftFormFields({ form }: { form: UseFormReturn<ShiftForm> }) {
  const selectedDays = form.watch('days_of_week') || [];
  const selectedColor = form.watch('color');
  return (
    <div className="space-y-4">
      <Input label="Shift Name" required placeholder="e.g. Morning Shift"
        error={form.formState.errors.name?.message} {...form.register('name')} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Start Time" type="time" required
          error={form.formState.errors.start_time?.message} {...form.register('start_time')} />
        <Input label="End Time" type="time" required
          error={form.formState.errors.end_time?.message} {...form.register('end_time')} />
      </div>
      <div>
        <label className="text-sm font-semibold text-[var(--dark-800)] block mb-2">Active Days</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((d, i) => (
            <button key={d} type="button"
              onClick={() => {
                const curr = form.getValues('days_of_week') || [];
                form.setValue('days_of_week', curr.includes(i) ? curr.filter(x => x !== i) : [...curr, i]);
              }}
              className={`w-10 h-10 rounded-lg text-xs font-semibold transition-colors ${
                selectedDays.includes(i)
                  ? 'bg-[var(--primary-600)] text-white'
                  : 'bg-[var(--gray-100)] text-[var(--gray-500)] hover:bg-[var(--gray-200)]'
              }`}
            >{d}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold text-[var(--dark-800)] block mb-2">Colour</label>
        <div className="flex gap-2">
          {SHIFT_COLORS.map(c => (
            <button key={c} type="button"
              onClick={() => form.setValue('color', c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor === c ? 'border-[var(--dark-950)] scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShiftsPage() {
  const { hasRole } = useAuth();
  const [shifts, setShifts]         = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading]         = useState(true);
  const [weekStart, setWeekStart]     = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [activeTab, setActiveTab]     = useState<'schedule' | 'templates' | 'swaps'>('schedule');

  // Modals
  const [addShiftOpen, setAddShiftOpen]     = useState(false);
  const [editShift, setEditShift]           = useState<Shift | null>(null);
  const [deleteShift, setDeleteShift]       = useState<Shift | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [publishing, setPublishing]         = useState(false);
  const [approveSwap, setApproveSwap]       = useState<SwapRequest | null>(null);
  const [rejectSwap, setRejectSwap]         = useState<SwapRequest | null>(null);
  const [rejectReason, setRejectReason]     = useState('');
  const [actionLoading, setActionLoading]   = useState(false);

  // AI Scheduling
  const [aiOpen, setAiOpen]               = useState(false);
  const [aiPrompt, setAiPrompt]           = useState('');
  const [aiLoading, setAiLoading]         = useState(false);
  const [aiPlan, setAiPlan]               = useState<{user_name:string;shift_name:string;dates:string[]}[]>([]);
  const [aiSummary, setAiSummary]         = useState('');
  const [aiWarnings, setAiWarnings]       = useState<string[]>([]);

  const form = useForm<ShiftForm>({
    defaultValues: { days_of_week: [], color: '#f15153', name: '', start_time: '', end_time: '' },
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, aRes, sRes] = await Promise.all([
        shiftsApi.getTemplates(),
        shiftsApi.getAssignments({ week_start: format(weekStart, 'yyyy-MM-dd') }),
        shiftsApi.getSwapRequests(),
      ]);
      setShifts(tRes.data.data || []);
      setAssignments(aRes.data.data || []);
      setSwapRequests(sRes.data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const onRunAiSchedule = async () => {
    if (!aiPrompt.trim()) { toast.error('Describe the schedule you need'); return; }
    setAiLoading(true);
    setAiPlan([]); setAiSummary(''); setAiWarnings([]);
    try {
      const { data } = await shiftsApi.aiSchedule(aiPrompt, format(weekStart, 'yyyy-MM-dd'));
      const result = data.data || {};
      setAiPlan(result.plan || []);
      setAiSummary(result.summary || '');
      setAiWarnings(result.warnings || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setAiLoading(false);
    }
  };

  const getAssignmentsForDay = (date: Date) =>
    assignments.filter(a => isSameDay(parseISO(a.date), date));

  const onSaveShift = async (data: ShiftForm) => {
    try {
      if (editShift) {
        await shiftsApi.updateTemplate(editShift.id, data);
        toast.success('Shift template updated');
        setEditShift(null);
      } else {
        await shiftsApi.createTemplate(data);
        toast.success('Shift template created');
        setAddShiftOpen(false);
      }
      fetchAll();
      form.reset();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const onPublish = async () => {
    setPublishing(true);
    try {
      await shiftsApi.publishSchedule(format(weekStart, 'yyyy-MM-dd'));
      toast.success('Schedule published — all employees notified');
      setPublishConfirm(false);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setPublishing(false);
    }
  };

  const onApproveSwap = async () => {
    if (!approveSwap) return;
    setActionLoading(true);
    try {
      await shiftsApi.approveSwap(approveSwap.id);
      toast.success('Shift swap approved');
      setApproveSwap(null);
      fetchAll();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const onRejectSwap = async () => {
    if (!rejectSwap || !rejectReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      await shiftsApi.rejectSwap(rejectSwap.id, rejectReason);
      toast.success('Shift swap rejected');
      setRejectSwap(null);
      setRejectReason('');
      fetchAll();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const pendingSwaps = swapRequests.filter(s => s.status === 'pending');

  return (
    <DashboardLayout>
      <PageHeader
        title="Shift Scheduling"
        subtitle="Manage weekly schedules and shift templates"
        actions={
          <div className="flex gap-3">
            {hasRole('manager', 'hr_admin', 'super_admin') && (
              <Button variant="ghost" size="sm" icon={<Sparkles size={14} />} onClick={() => setAiOpen(true)}>
                AI Schedule
              </Button>
            )}
            {hasRole('manager', 'hr_admin', 'super_admin') && (
              <Button variant="outline" size="sm" icon={<Plus size={14} />}
                onClick={() => { form.reset({ days_of_week: [], color: '#f15153' }); setAddShiftOpen(true); }}>
                New Template
              </Button>
            )}
            {hasRole('manager', 'hr_admin', 'super_admin') && (
              <Button size="sm" icon={<Send size={14} />} onClick={() => setPublishConfirm(true)}>
                Publish Schedule
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--gray-200)]">
        {(['schedule', 'templates', 'swaps'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)]'
                : 'text-[var(--gray-500)] hover:text-[var(--dark-950)]'
            }`}
          >
            {tab}{tab === 'swaps' && pendingSwaps.length > 0 && (
              <span className="ml-1.5 bg-[var(--danger-500)] text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingSwaps.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── SCHEDULE TAB ────────────────────────────── */}
      {activeTab === 'schedule' && (
        <Card>
          {/* Week navigator */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gray-100)]">
            <button onClick={() => setWeekStart(w => subWeeks(w, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)]">
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              <p className="text-sm font-bold text-[var(--dark-950)]">
                {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-[var(--gray-500)]">Week {format(weekStart, 'w')}</p>
            </div>
            <button onClick={() => setWeekStart(w => addWeeks(w, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)]">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-8 min-w-[700px]">
              {/* Header row */}
              <div className="py-3 px-4 text-xs font-semibold text-[var(--gray-500)] uppercase border-b border-r border-[var(--gray-100)]">
                Shift
              </div>
              {weekDays.map(day => (
                <div key={day.toISOString()}
                  className={`py-3 px-2 text-center border-b border-r border-[var(--gray-100)] ${
                    isSameDay(day, new Date()) ? 'bg-[var(--primary-100)]' : ''
                  }`}>
                  <p className="text-xs font-semibold text-[var(--gray-500)] uppercase">{format(day, 'EEE')}</p>
                  <p className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-[var(--primary-600)]' : 'text-[var(--dark-950)]'}`}>
                    {format(day, 'd')}
                  </p>
                </div>
              ))}

              {/* Shift rows */}
              {shifts.length === 0 ? (
                <div className="col-span-8 py-16 text-center text-sm text-[var(--gray-500)]">
                  No shift templates yet. Create one to start scheduling.
                </div>
              ) : shifts.map(shift => (
                <>
                  <div key={`label-${shift.id}`}
                    className="py-4 px-4 border-b border-r border-[var(--gray-100)] flex items-center gap-2">
                    <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: shift.color }} />
                    <div>
                      <p className="text-xs font-semibold text-[var(--dark-950)]">{shift.name}</p>
                      <p className="text-xs text-[var(--gray-500)] font-mono">
                        {shift.start_time}–{shift.end_time}
                      </p>
                    </div>
                  </div>
                  {weekDays.map(day => {
                    const dayAssignments = getAssignmentsForDay(day).filter(a => a.shift_id === shift.id);
                    const isActiveDay = shift.days_of_week?.includes(day.getDay());
                    return (
                      <div key={`${shift.id}-${day.toISOString()}`}
                        className={`py-2 px-2 border-b border-r border-[var(--gray-100)] min-h-[72px] ${
                          !isActiveDay ? 'bg-[var(--gray-50)]' : ''
                        }`}>
                        {dayAssignments.map(a => a.user && (
                          <div key={a.id}
                            className="mb-1 px-2 py-1 rounded-lg text-white text-xs font-medium truncate"
                            style={{ backgroundColor: shift.color }}>
                            {a.user.name.split(' ')[0]}
                          </div>
                        ))}
                        {isActiveDay && (
                          <button className="w-full mt-1 text-xs text-[var(--gray-500)] hover:text-[var(--primary-600)] hover:bg-[var(--primary-100)] rounded-lg py-1 transition-colors">
                            + Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── TEMPLATES TAB ───────────────────────────── */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 bg-white rounded-xl border border-[var(--gray-200)] animate-pulse" />
            ))
          ) : shifts.length === 0 ? (
            <div className="col-span-3">
              <EmptyState
                icon={<Clock size={24} />}
                title="No shift templates"
                description="Create your first shift template to start building schedules."
                action={<Button onClick={() => { form.reset({ days_of_week: [], color: '#f15153' }); setAddShiftOpen(true); }}>Create Template</Button>}
              />
            </div>
          ) : shifts.map(shift => (
            <Card key={shift.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-10 rounded-full" style={{ backgroundColor: shift.color }} />
                  <div>
                    <h3 className="text-sm font-bold text-[var(--dark-950)]">{shift.name}</h3>
                    <p className="text-xs text-[var(--gray-500)] font-mono">
                      {shift.start_time} – {shift.end_time}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {hasRole('manager', 'hr_admin', 'super_admin') && (
                    <button onClick={() => { form.reset({ name: shift.name, start_time: shift.start_time, end_time: shift.end_time, color: shift.color, days_of_week: shift.days_of_week }); setEditShift(shift); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-500)]">
                      <Edit2 size={13} />
                    </button>
                  )}
                  {hasRole('manager', 'hr_admin', 'super_admin') && (
                    <button onClick={() => setDeleteShift(shift)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--danger-100)] text-[var(--gray-500)] hover:text-[var(--danger-800)]">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                {DAYS.map((d, i) => (
                  <div key={d} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    shift.days_of_week?.includes(i)
                      ? 'text-white'
                      : 'bg-[var(--gray-100)] text-[var(--gray-500)]'
                  }`} style={shift.days_of_week?.includes(i) ? { backgroundColor: shift.color } : {}}>
                    {d[0]}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── SWAPS TAB ───────────────────────────────── */}
      {activeTab === 'swaps' && (
        <Card>
          <Table
            headers={['Requester', 'Their Shift', 'With', 'Colleague\'s Shift', 'Status', 'Actions']}
            loading={loading}
            emptyState={
              <EmptyState
                icon={<Calendar size={24} />}
                title="No swap requests"
                description="No pending shift swap requests."
              />
            }
          >
            {swapRequests.map(req => (
              <tr key={req.id} className="border-b border-[var(--gray-100)] hover:bg-[var(--gray-50)]">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Avatar name={req.requester.name} size="sm" />
                    <span className="text-sm font-medium">{req.requester.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <p className="text-xs text-[var(--dark-950)]">{req.requester_assignment?.shift?.name}</p>
                  <p className="text-xs text-[var(--gray-500)]">{req.requester_assignment?.date}</p>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Avatar name={req.target.name} size="sm" />
                    <span className="text-sm font-medium">{req.target.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <p className="text-xs text-[var(--dark-950)]">{req.target_assignment?.shift?.name}</p>
                  <p className="text-xs text-[var(--gray-500)]">{req.target_assignment?.date}</p>
                </td>
                <td className="py-3 px-4">
                  <Badge
                    label={req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                    color={req.status === 'pending' ? 'var(--warning-800)' : req.status === 'approved' ? 'var(--success-700)' : 'var(--danger-800)'}
                    bg={req.status === 'pending' ? 'var(--warning-100)' : req.status === 'approved' ? 'var(--success-100)' : 'var(--danger-100)'}
                  />
                </td>
                <td className="py-3 px-4">
                  {req.status === 'pending' && hasRole('manager', 'hr_admin', 'super_admin') && (
                    <div className="flex gap-2">
                      <Button variant="success" size="sm" icon={<Check size={12} />} onClick={() => setApproveSwap(req)}>Approve</Button>
                      <Button variant="danger" size="sm" icon={<X size={12} />} onClick={() => { setRejectSwap(req); setRejectReason(''); }}>Reject</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {/* ─── Modals ─────────────────────────────────── */}

      {/* Add / Edit template */}
      <Modal
        isOpen={addShiftOpen || !!editShift}
        onClose={() => { setAddShiftOpen(false); setEditShift(null); form.reset(); }}
        title={editShift ? 'Edit Shift Template' : 'New Shift Template'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setAddShiftOpen(false); setEditShift(null); }}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSaveShift)} loading={form.formState.isSubmitting}>
              {editShift ? 'Save Changes' : 'Create Template'}
            </Button>
          </>
        }
      >
        <ShiftFormFields form={form} />
      </Modal>

      {/* Delete template */}
      <ConfirmDialog
        isOpen={!!deleteShift}
        onClose={() => setDeleteShift(null)}
        onConfirm={async () => {
          if (!deleteShift) return;
          setDeleting(true);
          try {
            await shiftsApi.deleteTemplate(deleteShift.id);
            toast.success('Template deleted');
            setDeleteShift(null);
            fetchAll();
          } catch (err) {
            toast.error(getApiError(err));
          } finally {
            setDeleting(false);
          }
        }}
        loading={deleting}
        title="Delete Shift Template"
        message={`Delete "${deleteShift?.name}"? If this template is used in published schedules, those assignments will be unaffected.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Publish schedule */}
      <ConfirmDialog
        isOpen={publishConfirm}
        onClose={() => setPublishConfirm(false)}
        onConfirm={onPublish}
        loading={publishing}
        title="Publish Schedule"
        message={`Publish the schedule for the week of ${format(weekStart, 'MMM d')}? All assigned employees will be notified via the app and WhatsApp.`}
        confirmLabel="Publish & Notify"
        variant="primary"
      />

      {/* Approve swap */}
      <ConfirmDialog
        isOpen={!!approveSwap}
        onClose={() => setApproveSwap(null)}
        onConfirm={onApproveSwap}
        loading={actionLoading}
        title="Approve Shift Swap"
        message={`Approve swap between ${approveSwap?.requester.name} and ${approveSwap?.target.name}? Both employees' schedules will be updated.`}
        confirmLabel="Approve Swap"
        variant="primary"
      />

      {/* Reject swap modal */}
      <Modal
        isOpen={!!rejectSwap}
        onClose={() => setRejectSwap(null)}
        title="Reject Shift Swap"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectSwap(null)}>Cancel</Button>
            <Button variant="danger" onClick={onRejectSwap} loading={actionLoading}>Reject Swap</Button>
          </>
        }
      >
        <p className="text-sm text-[var(--gray-500)] mb-4">
          Rejecting swap between <strong>{rejectSwap?.requester.name}</strong> and <strong>{rejectSwap?.target.name}</strong>. Both employees will be notified.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold text-[var(--dark-800)]">Rejection Reason <span className="text-[var(--danger-500)]">*</span></label>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Explain why this swap cannot be approved..."
            className="w-full rounded-lg border border-[var(--gray-200)] bg-white px-3 py-2 text-sm resize-none focus:border-[var(--primary-600)] focus:ring-2 focus:ring-[var(--primary-100)] outline-none"
          />
        </div>
      </Modal>
      {/* AI Schedule Modal */}
      <Modal
        isOpen={aiOpen}
        onClose={() => { setAiOpen(false); setAiPrompt(''); setAiPlan([]); setAiSummary(''); setAiWarnings([]); }}
        title="AI Shift Scheduling"
        size="xl"
        footer={
          <Button variant="ghost" onClick={() => { setAiOpen(false); setAiPrompt(''); setAiPlan([]); setAiSummary(''); setAiWarnings([]); }}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-[var(--dark-800)] block mb-1">Describe the schedule you need</label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={`e.g. "Cover all 5 weekdays with at least 2 people on morning shift. Give Sarah and James consecutive days off."`}
                className="flex-1 rounded-lg border border-[var(--gray-200)] px-3 py-2 text-sm resize-none focus:border-[var(--primary-600)] focus:ring-2 focus:ring-[var(--primary-100)] outline-none"
              />
              <Button loading={aiLoading} onClick={onRunAiSchedule} icon={<Sparkles size={14} />}>
                Generate
              </Button>
            </div>
            <p className="text-xs text-[var(--gray-500)] mt-1">
              Week of {format(weekStart, 'MMM d')} · {shifts.length} templates available
            </p>
          </div>

          {aiSummary && (
            <div className="p-4 bg-[var(--primary-50)] border border-[var(--primary-100)] rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-[var(--primary-600)]" />
                <p className="text-sm font-semibold text-[var(--primary-600)]">AI Summary</p>
              </div>
              <p className="text-sm text-[var(--dark-950)]">{aiSummary}</p>
            </div>
          )}

          {aiWarnings.length > 0 && (
            <div className="p-3 bg-[var(--warning-100)] rounded-lg">
              <p className="text-xs font-semibold text-[var(--warning-800)] mb-1">Warnings</p>
              {aiWarnings.map((w, i) => <p key={i} className="text-xs text-[var(--warning-800)]">• {w}</p>)}
            </div>
          )}

          {aiPlan.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-[var(--dark-950)] mb-3">Suggested Assignments ({aiPlan.length})</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {aiPlan.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[var(--gray-50)] rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-[var(--dark-950)]">{entry.user_name}</p>
                      <p className="text-xs text-[var(--gray-500)]">{entry.shift_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--gray-500)]">{entry.dates?.length} day{entry.dates?.length !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-[var(--primary-600)]">{entry.dates?.slice(0,3).map((d: string) => format(new Date(d), 'EEE d')).join(', ')}{(entry.dates?.length || 0) > 3 ? '…' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--gray-500)] mt-2">Review this plan and create assignments manually from the schedule view, or copy the dates above.</p>
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}

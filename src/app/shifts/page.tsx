'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Modal, ConfirmDialog, Input, Select,
  Badge, Avatar, EmptyState, Table, Textarea
} from '@/components/ui';
import { shiftsApi, usersApi } from '@/lib/api';
import { getApiError, formatTime } from '@/lib/utils';
import type { Shift, ShiftAssignment, SwapRequest } from '@/types';

interface UserOption { id: string; name: string; }
import {
  Plus, Calendar, ChevronLeft, ChevronRight, Send,
  Check, X, Clock, Edit2, Trash2, Sparkles, ChevronDown, ChevronUp, Coffee, AlertTriangle
} from 'lucide-react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Schemas ──────────────────────────────────────────
const shiftSchema = z.object({
  name:                          z.string().min(1, 'Shift name required'),
  start_time:                    z.string().min(1, 'Start time required'),
  end_time:                      z.string().min(1, 'End time required'),
  color:                         z.string().min(1, 'Color required'),
  active_days:                   z.array(z.number()).min(1, 'Select at least one day'),
  overtime_multiplier:           z.number().min(1),
  min_rest_hours:                z.number().min(0),
  late_tolerance_mins:           z.number().min(0),
  early_checkout_tolerance_mins: z.number().min(0),
  auto_checkout:                 z.boolean(),
  auto_checkout_buffer_mins:     z.number().min(0),
});
type ShiftForm = z.infer<typeof shiftSchema>;

// ─── Break Types ──────────────────────────────────────
interface ShiftBreak {
  id: string;
  name: string;
  break_minutes: number;
  is_paid: boolean;
  after_minutes: number;
  break_start_time?: string;
  break_end_time?: string;
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SHIFT_COLORS = ['#00C896', '#00E5FF', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'];

function ShiftFormFields({ form }: { form: UseFormReturn<ShiftForm> }) {
  const selectedDays = form.watch('active_days') || [];
  const selectedColor = form.watch('color');
  const autoCheckout = form.watch('auto_checkout');
  return (
    <div className="space-y-6">
      <Input label="Shift Name" required placeholder="e.g. Morning Shift"
        error={form.formState.errors.name?.message} {...form.register('name')} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Start Time" type="time" required
          error={form.formState.errors.start_time?.message} {...form.register('start_time')} />
        <Input label="End Time" type="time" required
          error={form.formState.errors.end_time?.message} {...form.register('end_time')} />
      </div>
      <div>
        <label className="text-[11px] font-black text-[var(--on-glass-sub)] uppercase tracking-wider block mb-3">Active Days</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((d, i) => (
            <button key={d} type="button"
              onClick={() => {
                const curr = form.getValues('active_days') || [];
                form.setValue('active_days', curr.includes(i) ? curr.filter(x => x !== i) : [...curr, i]);
              }}
              className={cn(
                "w-10 h-10 rounded-xl text-[11px] font-black transition-all uppercase tracking-tighter",
                selectedDays.includes(i)
                  ? "bg-[var(--primary-600)] text-white shadow-lg shadow-[var(--primary-600)]/20"
                  : "bg-[var(--glass-10)] text-[var(--on-glass-muted)] hover:bg-[var(--glass-15)] border border-[var(--glass-border)]"
              )}
            >{d}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[11px] font-black text-[var(--on-glass-sub)] uppercase tracking-wider block mb-3">Colour Accent</label>
        <div className="flex gap-3">
          {SHIFT_COLORS.map(c => (
            <button key={c} type="button"
              onClick={() => form.setValue('color', c)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all shadow-xl",
                selectedColor === c ? "border-white scale-125 rotate-6" : "border-transparent opacity-60 hover:opacity-100"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* ── Advanced fields ───────────────────────────── */}
      <div className="border-t border-[var(--glass-border)] pt-6 space-y-6">
        <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.2em]">Overtime &amp; Compliance</p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Overtime Rate"
            type="number"
            step="0.1"
            hint="Multiplier (e.g. 1.5)"
            {...form.register('overtime_multiplier', { valueAsNumber: true })}
          />
          <Input
            label="Min Rest (Hrs)"
            type="number"
            {...form.register('min_rest_hours', { valueAsNumber: true })}
          />
          <Input
            label="Late Grace (Mins)"
            type="number"
            {...form.register('late_tolerance_mins', { valueAsNumber: true })}
          />
          <Input
            label="Early Grace (Mins)"
            type="number"
            {...form.register('early_checkout_tolerance_mins', { valueAsNumber: true })}
          />
        </div>

        <div className="p-4 rounded-2xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
           <div className="flex items-center justify-between">
              <div>
                 <p className="text-sm font-bold text-white">Auto Checkout</p>
                 <p className="text-[10px] text-[var(--on-glass-dim)] uppercase tracking-widest mt-1">Automatic shift completion</p>
              </div>
              <button
                type="button"
                onClick={() => form.setValue('auto_checkout', !autoCheckout)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  autoCheckout ? "bg-[var(--primary-600)]" : "bg-[var(--glass-20)]"
                )}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", autoCheckout ? "translate-x-6" : "translate-x-1")} />
              </button>
           </div>
           {autoCheckout && (
             <div className="mt-4 pt-4 border-t border-white/5">
                <Input
                  label="Checkout Buffer (Mins)"
                  type="number"
                  {...form.register('auto_checkout_buffer_mins', { valueAsNumber: true })}
                />
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

// ─── Breaks Panel ─────────────────────────────────────
function BreaksPanel({ shift }: { shift: Shift }) {
  const [open, setOpen] = useState(false);
  const [breaks, setBreaks] = useState<ShiftBreak[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newBreak, setNewBreak] = useState({ name: '', start_time: '12:00', end_time: '13:00', is_paid: false });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBreaks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await shiftsApi.getBreaks(shift.id);
      setBreaks(data.data || []);
    } catch {
      // silently fail — breaks endpoint may not exist yet
    } finally {
      setLoading(false);
    }
  }, [shift.id]);

  useEffect(() => {
    if (open) loadBreaks();
  }, [open, loadBreaks]);

  const handleAddBreak = async () => {
    if (!newBreak.name.trim()) { toast.error('Break name required'); return; }
    if (newBreak.start_time >= newBreak.end_time) { toast.error('End time must be after start time'); return; }
    setSaving(true);
    try {
      await shiftsApi.addBreak(shift.id, { name: newBreak.name, start_time: newBreak.start_time, end_time: newBreak.end_time, is_paid: newBreak.is_paid });
      toast.success('Break added');
      setAdding(false);
      setNewBreak({ name: '', start_time: '12:00', end_time: '13:00', is_paid: false });
      loadBreaks();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBreak = async (breakId: string) => {
    setDeletingId(breakId);
    try {
      await shiftsApi.deleteBreak(shift.id, breakId);
      toast.success('Break removed');
      setBreaks(prev => prev.filter(b => b.id !== breakId));
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="border border-[var(--glass-border)] rounded-2xl overflow-hidden mt-6 bg-[var(--glass-05)]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--glass-10)] transition-all"
      >
        <div className="flex items-center gap-3 text-sm font-black text-white uppercase tracking-widest">
          <Coffee size={16} className="text-[var(--primary-600)]" />
          Breaks {breaks.length > 0 && !open && <span className="text-[10px] text-[var(--on-glass-muted)] font-bold ml-1">({breaks.length})</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-[var(--on-glass-dim)]" /> : <ChevronDown size={16} className="text-[var(--on-glass-dim)]" />}
      </button>

      {open && (
        <div className="p-5 space-y-4 border-t border-[var(--glass-border)]">
          {loading ? (
            <div className="text-[10px] font-black text-[var(--on-glass-dim)] text-center py-6 uppercase tracking-widest">Retrieving Break Config...</div>
          ) : breaks.length === 0 ? (
            <p className="text-xs text-[var(--on-glass-muted)] text-center py-4 font-medium uppercase tracking-widest">No breaks defined.</p>
          ) : (
            <div className="space-y-3">
              {breaks.map(b => (
                <div key={b.id} className="flex items-center justify-between p-4 bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl group transition-all hover:border-[var(--primary-600)]/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--glass-05)] flex items-center justify-center">
                       <Coffee size={14} className="text-[var(--on-glass-muted)]" />
                    </div>
                    <div>
                       <p className="text-[13px] font-black text-white uppercase tracking-tight">{b.name}</p>
                       <p className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase mt-0.5">{b.break_start_time} &ndash; {b.break_end_time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      label={b.is_paid ? 'PAID' : 'UNPAID'}
                      color={b.is_paid ? 'var(--success-500)' : 'var(--on-glass-dim)'}
                      bg={b.is_paid ? '#10b981' : '#334155'}
                      size="sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteBreak(b.id)}
                      disabled={deletingId === b.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {adding ? (
            <div className="bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-[2rem] p-6 space-y-4 slide-in-bottom">
              <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-widest mb-2">New Break Configuration</p>
              <div className="space-y-4">
                  <Input
                    label="Description"
                    value={newBreak.name}
                    onChange={e => setNewBreak(b => ({ ...b, name: e.target.value }))}
                    placeholder="e.g. Lunch Protocol"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Start" type="time" value={newBreak.start_time} onChange={e => setNewBreak(b => ({ ...b, start_time: e.target.value }))} />
                    <Input label="End" type="time" value={newBreak.end_time} onChange={e => setNewBreak(b => ({ ...b, end_time: e.target.value }))} />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                     <span className="text-[11px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest">Paid Break</span>
                     <button
                        type="button"
                        onClick={() => setNewBreak(b => ({ ...b, is_paid: !b.is_paid }))}
                        className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", newBreak.is_paid ? "bg-[var(--primary-600)]" : "bg-[var(--glass-20)]")}
                      >
                        <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform", newBreak.is_paid ? "translate-x-5" : "translate-x-1")} />
                      </button>
                  </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
                <Button size="sm" loading={saving} onClick={handleAddBreak}>Add Break</Button>
              </div>
            </div>
          ) : (
            <button
               onClick={() => setAdding(true)}
               className="w-full py-4 rounded-2xl border border-dashed border-[var(--glass-border)] text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.2em] hover:text-white hover:border-[var(--primary-600)] transition-all"
            >
              + Add Break Segment
            </button>
          )}
        </div>
      )}
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

  // Assign shift from calendar
  const [users, setUsers]                 = useState<UserOption[]>([]);
  const [assignModal, setAssignModal]     = useState<{ shiftId: string; date: Date } | null>(null);
  const [assignUserId, setAssignUserId]   = useState('');
  const [assigning, setAssigning]         = useState(false);

  const form = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      active_days: [], color: '#00C896', name: '', start_time: '', end_time: '',
      overtime_multiplier: 1.5, min_rest_hours: 11, late_tolerance_mins: 15,
      early_checkout_tolerance_mins: 15, auto_checkout: true, auto_checkout_buffer_mins: 30,
    },
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, aRes, sRes, uRes] = await Promise.all([
        shiftsApi.getTemplates(),
        shiftsApi.getAssignments({ week_start: format(weekStart, 'yyyy-MM-dd') }),
        shiftsApi.getSwapRequests(),
        usersApi.getAll({ status: 'active', limit: 200 }),
      ]);
      setShifts(tRes.data.data || []);
      setAssignments(aRes.data.data || []);
      setSwapRequests(sRes.data.data || []);
      setUsers((uRes.data.data || []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const onAssignShift = async () => {
    if (!assignModal || !assignUserId) { toast.error('Select an employee'); return; }
    setAssigning(true);
    try {
      await shiftsApi.assignShift({
        user_id:  assignUserId,
        shift_id: assignModal.shiftId,
        date:     format(assignModal.date, 'yyyy-MM-dd'),
      });
      toast.success('Shift assigned');
      setAssignModal(null);
      setAssignUserId('');
      fetchAll();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setAssigning(false);
    }
  };

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
          <div className="flex gap-4">
            {hasRole('manager', 'hr_admin', 'super_admin') && (
              <Button variant="ghost" size="sm" icon={<Sparkles size={14} />} onClick={() => setAiOpen(true)}>
                AI Schedule
              </Button>
            )}
            {hasRole('manager', 'hr_admin', 'super_admin') && (
              <Button variant="outline" size="sm" icon={<Plus size={14} />}
                onClick={() => { form.reset({ active_days: [], color: '#00C896' }); setAddShiftOpen(true); }}>
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
      <div className="flex items-center gap-1 px-5 pt-4 pb-0 mb-6 border-b border-[var(--glass-border)] overflow-x-auto bg-[var(--glass-05)] rounded-t-3xl">
        {(['schedule', 'templates', 'swaps'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2",
              activeTab === tab
                ? "text-[var(--primary-600)] border-[var(--primary-600)]"
                : "text-[var(--on-glass-dim)] border-transparent hover:text-white"
            )}
          >
            {tab === 'swaps' ? 'Swaps' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'swaps' && pendingSwaps.length > 0 && (
              <span className="ml-2 bg-[var(--danger-500)] text-white text-[9px] font-black rounded-full px-2 py-0.5 shadow-lg shadow-[var(--danger-500)]/30 animate-pulse">
                {pendingSwaps.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── SCHEDULE TAB ────────────────────────────── */}
      {activeTab === 'schedule' && (
        <Card className="overflow-hidden">
          {/* Week navigator */}
          <div className="flex items-center justify-between px-6 py-5 bg-[var(--glass-05)] border-b border-[var(--glass-border)]">
            <button
              onClick={() => setWeekStart(w => subWeeks(w, 1))}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white transition-all active:scale-90"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <p className="text-[13px] font-black text-white uppercase tracking-widest">
                {format(weekStart, 'dd MMM')} &mdash; {format(addDays(weekStart, 6), 'dd MMM yyyy').toUpperCase()}
              </p>
              <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-[0.2em] mt-1">Calendar Week {format(weekStart, 'w')}</p>
            </div>
            <button
              onClick={() => setWeekStart(w => addWeeks(w, 1))}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white transition-all active:scale-90"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-8 min-w-[900px]">
              {/* Header row */}
              <div className="py-5 px-6 text-[11px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.2em] bg-[var(--glass-05)] border-r border-[var(--glass-border)]">
                Shift
              </div>
              {weekDays.map(day => (
                <div key={day.toISOString()}
                  className={cn(
                    "py-5 px-4 text-center border-r border-[var(--glass-border)] transition-colors",
                    isSameDay(day, new Date()) ? "bg-[var(--primary-600)]/10" : "bg-[var(--glass-05)]"
                  )}>
                  <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">{format(day, 'EEE')}</p>
                  <p className={cn("text-2xl font-black mt-1 tracking-tight", isSameDay(day, new Date()) ? "text-[var(--primary-600)]" : "text-white")}>
                    {format(day, 'd')}
                  </p>
                </div>
              ))}

              {/* Shift rows */}
              {shifts.length === 0 ? (
                <div className="col-span-8 py-24 text-center">
                  <Clock size={32} className="mx-auto text-[var(--on-glass-dim)] mb-4" />
                  <p className="text-[11px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.3em]">No shift templates found</p>
                </div>
              ) : shifts.map(shift => (
                <div key={shift.id} className="contents group">
                  <div className="py-5 px-6 border-t border-r border-[var(--glass-border)] flex items-center gap-4 bg-[var(--glass-05)] group-hover:bg-[var(--glass-10)] transition-colors">
                    <div className="w-1.5 h-10 rounded-full flex-shrink-0 shadow-lg shadow-black/20" style={{ backgroundColor: shift.color }} />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white uppercase truncate">{shift.name}</p>
                      <p className="text-[10px] font-bold text-[var(--on-glass-dim)] font-mono mt-0.5">
                        {shift.start_time}&ndash;{shift.end_time}
                      </p>
                    </div>
                  </div>
                  {weekDays.map(day => {
                    const dayAssignments = getAssignmentsForDay(day).filter(a => a.shift_id === shift.id);
                    const isActiveDay = shift.active_days?.includes(day.getDay());
                    return (
                      <div key={`${shift.id}-${day.toISOString()}`}
                        className={cn(
                          "py-3 px-3 border-t border-r border-[var(--glass-border)] min-h-[96px] transition-all",
                          !isActiveDay ? "bg-black/20" : "hover:bg-[var(--glass-05)]"
                        )}>
                        {dayAssignments.map(a => a.user && (
                          <div key={a.id}
                            className="mb-2 px-3 py-1.5 rounded-xl text-white text-[11px] font-black uppercase tracking-tight truncate shadow-xl border border-white/10"
                            style={{ backgroundColor: shift.color }}>
                            {a.user.name.split(' ')[0]}
                          </div>
                        ))}
                        {isActiveDay && hasRole('manager', 'hr_admin', 'super_admin') && (
                          <button
                            onClick={() => { setAssignUserId(''); setAssignModal({ shiftId: shift.id, date: day }); }}
                            className="w-full mt-1 border border-dashed border-[var(--glass-border)] text-[9px] font-black text-[var(--on-glass-dim)] hover:text-[var(--primary-600)] hover:border-[var(--primary-600)]/50 rounded-xl py-2 transition-all uppercase tracking-widest"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── TEMPLATES TAB ───────────────────────────── */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 bg-[var(--glass-10)] rounded-[2.5rem] border border-[var(--glass-border)] animate-pulse" />
            ))
          ) : shifts.length === 0 ? (
            <div className="col-span-3">
              <EmptyState
                icon={<Clock size={24} />}
                title="No shift templates"
                description="Create your first shift template to start building schedules."
                action={<Button onClick={() => { form.reset({ active_days: [], color: '#00C896' }); setAddShiftOpen(true); }}>Create Template</Button>}
              />
            </div>
          ) : shifts.map(shift => (
            <Card key={shift.id} className="p-6 relative overflow-hidden group hover:bg-[var(--glass-15)] transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 blur-[40px] opacity-10 rounded-full" style={{ backgroundColor: shift.color }} />

              <div className="flex items-start justify-between mb-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-1 h-12 rounded-full shadow-lg" style={{ backgroundColor: shift.color }} />
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">{shift.name}</h3>
                    <p className="text-xs font-bold text-[var(--on-glass-muted)] font-mono mt-1">
                      {shift.start_time} &mdash; {shift.end_time}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {hasRole('manager', 'hr_admin', 'super_admin') && (
                    <button onClick={() => { form.reset({ name: shift.name, start_time: shift.start_time, end_time: shift.end_time, color: shift.color, active_days: shift.active_days ?? [], overtime_multiplier: shift.overtime_multiplier ?? 1.5, min_rest_hours: shift.min_rest_hours ?? 11, late_tolerance_mins: shift.late_tolerance_mins ?? 15, early_checkout_tolerance_mins: shift.early_checkout_tolerance_mins ?? 15, auto_checkout: shift.auto_checkout ?? true, auto_checkout_buffer_mins: shift.auto_checkout_buffer_mins ?? 30 }); setEditShift(shift); }}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white hover:bg-[var(--glass-15)] transition-all">
                      <Edit2 size={16} />
                    </button>
                  )}
                  {hasRole('manager', 'hr_admin', 'super_admin') && (
                    <button onClick={() => setDeleteShift(shift)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 transition-all">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-1.5 relative z-10">
                {DAYS.map((d, i) => {
                  const isActive = shift.active_days?.includes(i);
                  return (
                    <div key={d} className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black uppercase transition-all border",
                      isActive
                        ? "text-white border-white/20"
                        : "bg-[var(--glass-05)] text-[var(--on-glass-dim)] border-transparent"
                    )} style={isActive ? { backgroundColor: shift.color } : {}}>
                      {d[0]}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── SWAPS TAB ───────────────────────────────── */}
      {activeTab === 'swaps' && (
        <Card className="overflow-hidden">
          <Table
            headers={['Requester', 'Current Assignment', 'Recipient', 'Target Assignment', 'Status', 'Actions']}
            loading={loading}
            emptyState={
              <div className="py-24 text-center">
                 <Calendar size={32} className="mx-auto text-[var(--on-glass-dim)] mb-4" />
                 <p className="text-[11px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.3em]">No swap requests found</p>
              </div>
            }
          >
            {swapRequests.map(req => (
              <tr key={req.id} className="hover:bg-[var(--glass-05)] transition-all">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-4">
                    <Avatar name={req.requester.name} size="md" />
                    <span className="text-sm font-black text-white truncate">{req.requester.name}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <p className="text-sm font-bold text-white uppercase tracking-tight">{req.requester_assignment?.shift?.name}</p>
                  <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest mt-0.5">{req.requester_assignment?.date}</p>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center gap-4">
                    <Avatar name={req.target.name} size="md" />
                    <span className="text-sm font-black text-white truncate">{req.target.name}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <p className="text-sm font-bold text-white uppercase tracking-tight">{req.target_assignment?.shift?.name}</p>
                  <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest mt-0.5">{req.target_assignment?.date}</p>
                </td>
                <td className="py-4 px-6">
                  <Badge
                    label={req.status.toUpperCase()}
                    color={req.status === 'pending' ? 'var(--warning-500)' : req.status === 'approved' ? 'var(--success-500)' : 'var(--danger-500)'}
                    bg={req.status === 'pending' ? '#f59e0b' : req.status === 'approved' ? '#10b981' : '#ef4444'}
                    size="sm"
                  />
                </td>
                <td className="py-4 px-6">
                  {req.status === 'pending' && hasRole('manager', 'hr_admin', 'super_admin') && (
                    <div className="flex gap-2">
                       <button onClick={() => setApproveSwap(req)} className="w-8 h-8 rounded-lg bg-[var(--success-500)] text-white flex items-center justify-center hover:brightness-110 shadow-lg shadow-[var(--success-500)]/20"><Check size={14} /></button>
                       <button onClick={() => { setRejectSwap(req); setRejectReason(''); }} className="w-8 h-8 rounded-lg bg-[var(--danger-500)] text-white flex items-center justify-center hover:brightness-110 shadow-lg shadow-[var(--danger-500)]/20"><X size={14} /></button>
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
        {editShift && <BreaksPanel shift={editShift} />}
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
        <p className="text-sm font-medium text-[var(--on-glass-muted)] mb-6 leading-relaxed">
          Rejecting swap between <strong>{rejectSwap?.requester.name}</strong> and <strong>{rejectSwap?.target.name}</strong>. A reason is required.
        </p>
        <Textarea
          label="Rejection Reason"
          required
          rows={3}
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          placeholder="Explain why this swap cannot be approved..."
        />
      </Modal>
      {/* Assign shift modal */}
      <Modal
        isOpen={!!assignModal}
        onClose={() => { setAssignModal(null); setAssignUserId(''); }}
        title="Assign Shift"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setAssignModal(null); setAssignUserId(''); }}>Cancel</Button>
            <Button loading={assigning} onClick={onAssignShift}>Assign</Button>
          </>
        }
      >
        {assignModal && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
               <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest mb-1">Date</p>
               <p className="text-sm font-black text-white uppercase">{format(assignModal.date, 'EEEE, MMM d')}</p>
               <p className="text-xs font-bold text-[var(--primary-600)] uppercase mt-2 tracking-widest">{shifts.find(s => s.id === assignModal.shiftId)?.name}</p>
            </div>
            <Select
              label="Employee"
              required
              options={users.map(u => ({ value: u.id, label: u.name }))}
              value={assignUserId}
              onChange={e => setAssignUserId(e.target.value)}
              placeholder="Select employee…"
            />
          </div>
        )}
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
        <div className="space-y-6">
          <div>
            <label className="text-[11px] font-black text-[var(--on-glass-sub)] uppercase tracking-widest block mb-3">Describe the schedule you need</label>
            <div className="flex gap-4">
              <textarea
                rows={2}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={`e.g. "Cover all 5 weekdays with at least 2 people on morning shift. Give Sarah and James consecutive days off."`}
                className="flex-1 rounded-[1.5rem] bg-[var(--glass-10)] border border-[var(--glass-border)] px-5 py-4 text-sm text-white placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium resize-none"
              />
              <Button loading={aiLoading} onClick={onRunAiSchedule} icon={<Sparkles size={16} />}>
                Generate
              </Button>
            </div>
            <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase mt-3 tracking-widest">
              Week of {format(weekStart, 'MMM d')} &middot; {shifts.length} templates available
            </p>
          </div>

          {aiSummary && (
            <div className="p-6 bg-[var(--primary-600)]/5 border border-[var(--primary-600)]/20 rounded-[2rem] slide-in-bottom">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles size={16} className="text-[var(--primary-600)]" />
                <p className="text-[11px] font-black text-[var(--primary-600)] uppercase tracking-[0.2em]">Strategy Overview</p>
              </div>
              <p className="text-sm font-medium text-white/80 leading-relaxed">{aiSummary}</p>
            </div>
          )}

          {aiWarnings.length > 0 && (
            <div className="p-5 bg-[var(--danger-500)]/5 border border-[var(--danger-500)]/20 rounded-[1.5rem]">
              <p className="text-[10px] font-black text-[var(--danger-500)] uppercase tracking-widest mb-2 flex items-center gap-2">
                 <AlertTriangle size={12} /> Optimization Conflicts Identified
              </p>
              {aiWarnings.map((w, i) => <p key={i} className="text-xs font-medium text-[var(--danger-500)]/70 mt-1">&bull; {w}</p>)}
            </div>
          )}

          {aiPlan.length > 0 && (
            <div className="slide-in-bottom">
              <p className="text-[11px] font-black text-white uppercase tracking-widest mb-4">Suggested Assignments ({aiPlan.length})</p>
              <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                {aiPlan.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-2xl">
                    <div>
                      <p className="text-[13px] font-black text-white uppercase tracking-tight">{entry.user_name}</p>
                      <p className="text-[10px] font-bold text-[var(--primary-600)] uppercase tracking-widest mt-0.5">{entry.shift_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">{entry.dates?.length} days</p>
                      <p className="text-[11px] font-black text-white font-mono mt-1 uppercase">
                         {entry.dates?.slice(0,3).map((d: string) => format(new Date(d), 'EEE d')).join(', ')}{(entry.dates?.length || 0) > 3 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase text-center mt-6 tracking-widest">Review this plan and create assignments manually from the schedule view.</p>
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}

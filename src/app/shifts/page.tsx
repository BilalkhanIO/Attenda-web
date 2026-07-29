'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Modal, ConfirmDialog, Input,
  Badge, TimePicker,
} from '@/components/ui';
import Link from 'next/link';
import { shiftsApi, usersApi } from '@/lib/api';
import { getApiError, runDeferred } from '@/lib/utils';
import type { Shift, ShiftAssignment } from '@/types';

interface UserOption { id: string; name: string; }
import {
  ChevronLeft, ChevronRight, Send,
  Check, X, Clock, Edit2, Trash2, Sparkles, ChevronDown, ChevronUp, Coffee, AlertTriangle, Globe
} from 'lucide-react';
import { useForm, UseFormReturn, Controller } from 'react-hook-form';
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
  overtime_enabled:              z.boolean(),
  overtime_requires_approval:    z.boolean(),
  extra_time_label:              z.string().min(1),
  is_org_wide:                   z.boolean(),
  is_default:                    z.boolean(),
});
type ShiftForm = z.infer<typeof shiftSchema>;

// ─── Break Types ──────────────────────────────────────
interface ShiftBreak {
  id: string;
  name: string;
  break_kind?: 'fixed' | 'flexible';
  break_minutes: number;
  is_paid: boolean;
  after_minutes: number;
  break_start_time?: string;
  break_end_time?: string;
  allowed_count_per_shift?: number;
  paid_within_limit?: boolean;
  deduct_extra_time?: boolean;
  applies_days?: number[];
  exception_dates?: string[];
  auto_start?: boolean;
  reminder_after_mins?: number;
  deduct_if_skipped?: boolean;
}

// ─── Shared primitives ────────────────────────────────
function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest">{label}</p>
        {description && <p className="text-[10px] text-[var(--on-glass-dim)] mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0',
          checked ? 'bg-[var(--primary-600)]' : 'bg-[var(--glass-20)]',
        )}
      >
        <span className={cn(
          'inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1',
        )} />
      </button>
    </div>
  );
}

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat', 'Sun'];
const SHIFT_COLORS = ['#00C896', '#00E5FF', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'];
const defaultShiftForm: ShiftForm = {
  active_days: [], color: '#00C896', name: '', start_time: '', end_time: '',
  overtime_multiplier: 1.5, min_rest_hours: 11, late_tolerance_mins: 15,
  early_checkout_tolerance_mins: 15, auto_checkout: true, auto_checkout_buffer_mins: 30,
  overtime_enabled: false, overtime_requires_approval: true, extra_time_label: 'Extra office time',
  is_org_wide: false, is_default: false,
};

function ShiftFormFields({ form }: { form: UseFormReturn<ShiftForm> }) {
  const selectedDays = form.watch('active_days') || [];
  const selectedColor = form.watch('color');
  const autoCheckout = form.watch('auto_checkout');
  const overtimeEnabled = form.watch('overtime_enabled');
  const isOrgWide = form.watch('is_org_wide');
  const isDefault = form.watch('is_default');
  return (
    <div className="space-y-4">
      <Input label="Shift Name" required placeholder="e.g. Morning Shift"
        error={form.formState.errors.name?.message} {...form.register('name')} />
      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={form.control}
          name="start_time"
          render={({ field }) => (
            <TimePicker label="Start Time" required value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={form.control}
          name="end_time"
          render={({ field }) => (
            <TimePicker label="End Time" required value={field.value} onChange={field.onChange} />
          )}
        />
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
                 <p className="text-sm font-bold text-white">Overtime</p>
                 <p className="text-[10px] text-[var(--on-glass-dim)] uppercase tracking-widest mt-1">Count time after shift end as overtime</p>
              </div>
              <button
                type="button"
                onClick={() => form.setValue('overtime_enabled', !overtimeEnabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  overtimeEnabled ? "bg-[var(--primary-600)]" : "bg-[var(--glass-20)]"
                )}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", overtimeEnabled ? "translate-x-6" : "translate-x-1")} />
              </button>
           </div>
           {overtimeEnabled ? (
             <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest">Requires Approval</span>
                <button
                  type="button"
                  onClick={() => form.setValue('overtime_requires_approval', !form.watch('overtime_requires_approval'))}
                  className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", form.watch('overtime_requires_approval') ? "bg-[var(--primary-600)]" : "bg-[var(--glass-20)]")}
                >
                  <span className={cn("inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform", form.watch('overtime_requires_approval') ? "translate-x-5" : "translate-x-1")} />
                </button>
             </div>
           ) : (
             <div className="mt-4 pt-4 border-t border-white/5">
                <Input label="Extra Time Label" {...form.register('extra_time_label')} />
             </div>
           )}
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

        <div className="space-y-3">
          <ToggleRow
            label="Apply to whole organisation"
            description="Everyone without a specific daily assignment follows this shift. Only one shift can be org-wide."
            checked={isOrgWide}
            onChange={() => form.setValue('is_org_wide', !isOrgWide)}
          />
          <ToggleRow
            label="Default shift"
            description="Fallback shift used when no org-wide shift or assignment applies. Only one default per organisation."
            checked={isDefault}
            onChange={() => form.setValue('is_default', !isDefault)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Break Card ───────────────────────────────────────
function BreakCard({ b, deleting, onDelete }: { b: ShiftBreak; deleting: boolean; onDelete: () => void }) {
  const isFixed = b.break_kind !== 'flexible';
  const timing = isFixed
    ? `${b.break_start_time} – ${b.break_end_time}`
    : `${b.break_minutes}m · up to ${b.allowed_count_per_shift ?? 1}×/shift`;

  return (
    <div className="flex items-center justify-between p-4 bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl hover:border-[var(--primary-600)]/30 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-[var(--glass-05)] flex items-center justify-center flex-shrink-0">
          <Coffee size={14} className="text-[var(--on-glass-muted)]" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-black text-white uppercase tracking-tight truncate">{b.name}</p>
          <p className="text-[10px] font-medium text-[var(--on-glass-muted)] mt-0.5">{timing}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        <Badge label={isFixed ? 'FIXED' : 'FLEX'} color={isFixed ? 'var(--primary-400)' : 'var(--on-glass-dim)'} bg={isFixed ? 'rgba(99,102,241,0.18)' : '#1e2533'} size="sm" />
        {b.is_paid && <Badge label="PAID" color="#10b981" bg="rgba(16,185,129,0.12)" size="sm" />}
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Break Form ───────────────────────────────────────
const EMPTY_BREAK = {
  name: '',
  break_kind: 'fixed' as 'fixed' | 'flexible',
  start_time: '12:00',
  end_time: '13:00',
  duration_minutes: 15,
  allowed_count_per_shift: 1,
  is_paid: false,
  paid_within_limit: true,
  deduct_extra_time: true,
  applies_days: [] as number[],
  auto_start: false,
  reminder_after_mins: 30,
  deduct_if_skipped: true,
};

type BreakFormState = typeof EMPTY_BREAK;

function BreakForm({
  form, setField, saving, onSave, onCancel,
}: {
  form: BreakFormState;
  setField: <K extends keyof BreakFormState>(k: K, v: BreakFormState[K]) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isFixed = form.break_kind === 'fixed';
  const toggleDay = (i: number) => setField(
    'applies_days',
    form.applies_days.includes(i)
      ? form.applies_days.filter(x => x !== i)
      : [...form.applies_days, i],
  );

  return (
    <div className="bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl p-4 space-y-4 slide-in-bottom">
      <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-widest">New Break</p>

      {/* Name */}
      <Input
        label="Break Name"
        value={form.name}
        onChange={e => setField('name', e.target.value)}
        placeholder="e.g. Lunch"
      />

      {/* Type */}
      <div className="grid grid-cols-2 gap-2">
        {(['fixed', 'flexible'] as const).map(kind => (
          <button
            key={kind}
            type="button"
            onClick={() => setField('break_kind', kind)}
            className={cn(
              'py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors',
              form.break_kind === kind
                ? 'bg-[var(--primary-600)] text-white border-transparent'
                : 'bg-white/5 text-[var(--on-glass-muted)] border-white/10 hover:border-white/20',
            )}
          >
            {kind === 'fixed' ? 'Fixed' : 'Flexible'}
          </button>
        ))}
      </div>

      {/* Time / duration inputs */}
      {isFixed ? (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start" type="time" value={form.start_time} onChange={e => setField('start_time', e.target.value)} />
          <Input label="End" type="time" value={form.end_time} onChange={e => setField('end_time', e.target.value)} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Duration (m)" type="number" min={1} value={form.duration_minutes} onChange={e => setField('duration_minutes', Number(e.target.value))} />
          <Input label="Max/Shift" type="number" min={1} value={form.allowed_count_per_shift} onChange={e => setField('allowed_count_per_shift', Number(e.target.value))} />
        </div>
      )}

      {/* Days */}
      <div>
        <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-2">Days</p>
        <div className="flex gap-1">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(i)}
              className={cn(
                'w-7 h-7 rounded-lg text-[9px] font-black uppercase transition-colors',
                form.applies_days.includes(i) ? 'bg-[var(--primary-600)] text-white' : 'bg-white/5 text-[var(--on-glass-muted)] hover:bg-white/10',
              )}
            >
              {d[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Behaviour */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 rounded-xl bg-white/5 border border-white/5">
        <ToggleRow label="Paid Break" checked={form.is_paid} onChange={() => setField('is_paid', !form.is_paid)} />
        <ToggleRow label="Paid within limit" checked={form.paid_within_limit} onChange={() => setField('paid_within_limit', !form.paid_within_limit)} />
        <ToggleRow label="Deduct Extra Time" checked={form.deduct_extra_time} onChange={() => setField('deduct_extra_time', !form.deduct_extra_time)} />
        <ToggleRow label="Auto-Start" checked={form.auto_start} onChange={() => setField('auto_start', !form.auto_start)} />
        <ToggleRow label="Deduct if skipped" checked={form.deduct_if_skipped} onChange={() => setField('deduct_if_skipped', !form.deduct_if_skipped)} />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">Reminder (mins)</label>
          <input type="number" className="bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-lg px-2 py-1 text-xs text-white" value={form.reminder_after_mins} onChange={e => setField('reminder_after_mins', Number(e.target.value))} />
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" loading={saving} onClick={onSave}>Add</Button>
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
  const [form, setFormState] = useState<BreakFormState>(EMPTY_BREAK);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBreaks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await shiftsApi.getBreaks(shift.id);
      setBreaks(data.data || []);
    } catch { /* endpoint may not exist yet */ }
    finally { setLoading(false); }
  }, [shift.id]);

  useEffect(() => {
    if (!open) return;
    return runDeferred(loadBreaks);
  }, [open, loadBreaks]);

  const setField = useCallback(
    <K extends keyof BreakFormState>(k: K, v: BreakFormState[K]) =>
      setFormState(f => ({ ...f, [k]: v })),
    [],
  );

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('Break name required'); return; }
    if (form.break_kind === 'fixed' && form.start_time >= form.end_time) { toast.error('End time must be after start time'); return; }
    setSaving(true);
    try {
      await shiftsApi.addBreak(shift.id, {
        ...form,
        break_minutes: form.duration_minutes,
        break_start_time: form.start_time,
        break_end_time: form.end_time,
      });
      toast.success('Break added');
      setAdding(false);
      setFormState(EMPTY_BREAK);
      loadBreaks();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await shiftsApi.deleteBreak(shift.id, id);
      toast.success('Break removed');
      setBreaks(prev => prev.filter(b => b.id !== id));
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
          Breaks
          {breaks.length > 0 && !open && (
            <span className="text-[10px] text-[var(--on-glass-muted)] font-bold ml-1">({breaks.length})</span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-[var(--on-glass-dim)]" /> : <ChevronDown size={16} className="text-[var(--on-glass-dim)]" />}
      </button>

      {open && (
        <div className="p-5 space-y-4 border-t border-[var(--glass-border)]">
          {loading ? (
            <div className="text-[10px] font-black text-[var(--on-glass-dim)] text-center py-6 uppercase tracking-widest">Loading…</div>
          ) : breaks.length === 0 ? (
            <p className="text-xs text-[var(--on-glass-muted)] text-center py-4 font-medium uppercase tracking-widest">No breaks defined</p>
          ) : (
            <div className="space-y-2">
              {breaks.map(b => (
                <BreakCard key={b.id} b={b} deleting={deletingId === b.id} onDelete={() => handleDelete(b.id)} />
              ))}
            </div>
          )}

          {adding ? (
            <BreakForm
              form={form}
              setField={setField}
              saving={saving}
              onSave={handleAdd}
              onCancel={() => { setAdding(false); setFormState(EMPTY_BREAK); }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full py-4 rounded-2xl border border-dashed border-[var(--glass-border)] text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.2em] hover:text-white hover:border-[var(--primary-600)] transition-all"
            >
              + Add Break
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ShiftsPage() {
  const { hasPermission } = useAuth();
  const [shifts, setShifts]         = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [, setLoading]                = useState(true);
  const [weekStart, setWeekStart]     = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Modals
  const [addShiftOpen, setAddShiftOpen]     = useState(false);
  const [editShift, setEditShift]           = useState<Shift | null>(null);
  const [deleteShift, setDeleteShift]       = useState<Shift | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [publishing, setPublishing]         = useState(false);

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
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assigning, setAssigning]         = useState(false);
  const [removingAssignId, setRemovingAssignId] = useState<string | null>(null);

  // AI apply
  const [aiApplying, setAiApplying]       = useState(false);

  const form = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: defaultShiftForm,
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, aRes, uRes] = await Promise.all([
        shiftsApi.getTemplates(),
        shiftsApi.getAssignments({ week_start: format(weekStart, 'yyyy-MM-dd') }),
        usersApi.getAll({ status: 'active', limit: 200 }),
      ]);
      setShifts(tRes.data.data || []);
      setAssignments(aRes.data.data || []);
      setUsers((uRes.data.data || []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  const onAssignShift = async () => {
    if (!assignModal || assignUserIds.length === 0) { toast.error('Select at least one employee'); return; }
    setAssigning(true);
    try {
      await Promise.all(assignUserIds.map(uid =>
        shiftsApi.assignShift({
          user_id:  uid,
          shift_id: assignModal.shiftId,
          date:     format(assignModal.date, 'yyyy-MM-dd'),
        })
      ));
      toast.success(assignUserIds.length === 1 ? 'Shift assigned' : `${assignUserIds.length} shifts assigned`);
      setAssignModal(null);
      setAssignUserIds([]);
      fetchAll();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setAssigning(false);
    }
  };

  const onApplyAiPlan = async () => {
    if (!aiPlan.length) return;
    setAiApplying(true);
    let applied = 0;
    let skipped = 0;
    try {
      for (const entry of aiPlan) {
        const user  = users.find(u => u.name.toLowerCase() === entry.user_name.toLowerCase());
        const shift = shifts.find(s => s.name.toLowerCase() === entry.shift_name.toLowerCase());
        if (!user || !shift || !entry.dates?.length) { skipped++; continue; }
        await Promise.all(entry.dates.map((date: string) =>
          shiftsApi.assignShift({ user_id: user.id, shift_id: shift.id, date }).catch(() => { skipped++; })
        ));
        applied += entry.dates.length;
      }
      toast.success(`Plan applied — ${applied} assignments created${skipped ? `, ${skipped} skipped` : ''}`);
      setAiOpen(false);
      setAiPlan([]); setAiSummary(''); setAiWarnings([]); setAiPrompt('');
      fetchAll();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setAiApplying(false);
    }
  };

  const onRemoveAssignment = async (id: string) => {
    setRemovingAssignId(id);
    try {
      await shiftsApi.deleteAssignment(id);
      toast.success('Assignment removed');
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setRemovingAssignId(null);
    }
  };

  useEffect(() => runDeferred(fetchAll), [fetchAll]);

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

  // Open the edit modal pre-populated from a template (the edit flow was unwired).
  const openEdit = (shift: Shift) => {
    form.reset({
      ...defaultShiftForm,
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      color: shift.color || defaultShiftForm.color,
      active_days: shift.active_days ?? [],
      overtime_multiplier: shift.overtime_multiplier ?? defaultShiftForm.overtime_multiplier,
      min_rest_hours: shift.min_rest_hours ?? defaultShiftForm.min_rest_hours,
      late_tolerance_mins: shift.late_tolerance_mins ?? defaultShiftForm.late_tolerance_mins,
      early_checkout_tolerance_mins: shift.early_checkout_tolerance_mins ?? defaultShiftForm.early_checkout_tolerance_mins,
      auto_checkout: shift.auto_checkout ?? defaultShiftForm.auto_checkout,
      auto_checkout_buffer_mins: shift.auto_checkout_buffer_mins ?? defaultShiftForm.auto_checkout_buffer_mins,
      overtime_enabled: shift.overtime_enabled ?? defaultShiftForm.overtime_enabled,
      overtime_requires_approval: shift.overtime_requires_approval ?? defaultShiftForm.overtime_requires_approval,
      extra_time_label: shift.extra_time_label || defaultShiftForm.extra_time_label,
      is_org_wide: shift.is_org_wide ?? false,
      is_default: shift.is_default ?? false,
    });
    setEditShift(shift);
  };

  // One-click "apply this shift to the whole organisation" (toggles is_org_wide).
  const onSetOrgWide = async (shift: Shift) => {
    try {
      await shiftsApi.setOrgWide(shift.id, !shift.is_org_wide);
      toast.success(shift.is_org_wide ? 'Org-wide shift cleared' : `“${shift.name}” now applies to the whole organisation`);
      fetchAll();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const onPublish = async () => {
    setPublishing(true);
    try {
      await shiftsApi.publishSchedule(format(weekStart, 'yyyy-MM-dd'), format(addDays(weekStart, 6), 'yyyy-MM-dd'));
      toast.success('Schedule published — all employees notified');
      setPublishConfirm(false);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setPublishing(false);
    }
  };


  return (
    <DashboardLayout>
      <PageHeader
        title="Shift Scheduling"
        subtitle="Manage weekly schedules and shift templates"
        actions={
          <div className="flex gap-2">
            {hasPermission('shifts.ai_schedule') && (
              <Button variant="ghost" size="sm" icon={<Sparkles size={14} />} onClick={() => setAiOpen(true)}>
                AI
              </Button>
            )}
            {hasPermission('shifts.manage') && (
              <Link href="/shifts/templates">
                <Button variant="outline" size="sm" icon={<Edit2 size={14} />}>
                  Templates
                </Button>
              </Link>
            )}
            {hasPermission('shifts.assign') && (
              <Button size="sm" icon={<Send size={14} />} onClick={() => setPublishConfirm(true)}>
                Publish
              </Button>
            )}
          </div>
        }
      />

      {/* ── SCHEDULE ──────────────────────────────── */}
      {(
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-white uppercase truncate">{shift.name}</p>
                        {shift.is_org_wide && <Badge label="ORG-WIDE" color="#00E5FF" bg="rgba(0,229,255,0.12)" size="sm" />}
                        {shift.is_default && <Badge label="DEFAULT" color="#f59e0b" bg="rgba(245,158,11,0.12)" size="sm" />}
                      </div>
                      <p className="text-[10px] font-bold text-[var(--on-glass-dim)] font-mono mt-0.5">
                        {shift.start_time}&ndash;{shift.end_time}
                      </p>
                    </div>
                    {hasPermission('shifts.manage') && (
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onSetOrgWide(shift)}
                          title={shift.is_org_wide ? 'Clear org-wide' : 'Apply to whole organisation'}
                          className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                            shift.is_org_wide ? 'bg-[var(--primary-600)] text-white' : 'bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white',
                          )}
                        >
                          <Globe size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(shift)}
                          title="Edit shift"
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white transition-all"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  {weekDays.map(day => {
                    const dayAssignments = getAssignmentsForDay(day).filter(a => a.shift_id === shift.id);
                    // day.getDay() is 0 for Sunday, 1 for Monday...
                    // Our DAYS array and active_days use 0 for Monday, 6 for Sunday.
                    const dayIdx = (day.getDay() + 6) % 7;
                    const isActiveDay = shift.active_days?.includes(dayIdx);
                    return (
                      <div key={`${shift.id}-${day.toISOString()}`}
                        className={cn(
                          "py-2 px-2 border-t border-r border-[var(--glass-border)] min-h-[80px] transition-all",
                          !isActiveDay ? "bg-black/20" : "hover:bg-[var(--glass-05)]"
                        )}>
                        <div className="space-y-1">
                          {dayAssignments.map(a => a.user && (
                            <div key={a.id}
                              className="pl-2 pr-1 py-1 rounded-lg text-white text-[10px] font-black uppercase tracking-tight shadow-md border border-white/5 flex items-center gap-1 group/chip"
                              style={{ backgroundColor: shift.color }}>
                              <span className="truncate flex-1">{a.user.name.split(' ')[0]}</span>
                              {hasPermission('shifts.assign') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onRemoveAssignment(a.id); }}
                                  disabled={removingAssignId === a.id}
                                  title="Remove assignment"
                                  className="w-4 h-4 rounded flex items-center justify-center hover:bg-white/20 transition-all opacity-0 group-hover/chip:opacity-100 flex-shrink-0 disabled:cursor-not-allowed"
                                >
                                  {removingAssignId === a.id ? (
                                    <span className="block w-2 h-2 border border-white/60 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <X size={8} />
                                  )}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {isActiveDay && hasPermission('shifts.assign') && (
                          <button
                            onClick={() => { setAssignUserIds([]); setAssignModal({ shiftId: shift.id, date: day }); }}
                            className="w-full mt-1 border border-dashed border-[var(--glass-border)] text-[8px] font-black text-[var(--on-glass-dim)] hover:text-[var(--primary-600)] hover:border-[var(--primary-600)]/50 rounded-lg py-1 transition-all uppercase tracking-widest"
                          >
                            +
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

      {/* Assign shift modal */}
      <Modal
        isOpen={!!assignModal}
        onClose={() => { setAssignModal(null); setAssignUserIds([]); }}
        title="Assign Shift"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setAssignModal(null); setAssignUserIds([]); }}>Cancel</Button>
            <Button loading={assigning} onClick={onAssignShift} size="sm">
              {assignUserIds.length > 1 ? `Assign ${assignUserIds.length}` : 'Assign'}
            </Button>
          </>
        }
      >
        {assignModal && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
               <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">Date</p>
                    <p className="text-xs font-black text-white uppercase">{format(assignModal.date, 'EEE, MMM d')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">Shift</p>
                    <p className="text-xs font-black text-[var(--primary-600)] uppercase tracking-tight">{shifts.find(s => s.id === assignModal.shiftId)?.name}</p>
                  </div>
               </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">
                  Employees
                </p>
                {assignUserIds.length > 0 && <span className="text-[10px] font-black text-[var(--primary-600)] uppercase">{assignUserIds.length} Selected</span>}
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {users.map(u => {
                  const checked = assignUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setAssignUserIds(prev =>
                        checked ? prev.filter(id => id !== u.id) : [...prev, u.id]
                      )}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left',
                        checked
                          ? 'bg-[var(--primary-600)]/10 border-[var(--primary-600)]/40 text-white'
                          : 'bg-[var(--glass-05)] border-[var(--glass-border)] text-[var(--on-glass-muted)] hover:bg-[var(--glass-10)] hover:text-white'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 rounded-md flex items-center justify-center border flex-shrink-0 transition-all',
                        checked ? 'bg-[var(--primary-600)] border-[var(--primary-600)]' : 'border-[var(--glass-border)]'
                      )}>
                        {checked && <Check size={10} className="text-white" />}
                      </div>
                      <span className="text-[13px] font-bold truncate">{u.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* AI Schedule Modal */}
      <Modal
        isOpen={aiOpen}
        onClose={() => { setAiOpen(false); setAiPrompt(''); setAiPlan([]); setAiSummary(''); setAiWarnings([]); }}
        title="AI Shift Scheduling"
        size="lg"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setAiOpen(false); setAiPrompt(''); setAiPlan([]); setAiSummary(''); setAiWarnings([]); }}>
              Close
            </Button>
            {aiPlan.length > 0 && (
              <Button size="sm" icon={<Check size={14} />} loading={aiApplying} onClick={onApplyAiPlan}>
                Apply Plan ({aiPlan.reduce((n, e) => n + (e.dates?.length ?? 0), 0)})
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-[var(--on-glass-sub)] uppercase tracking-widest block mb-2">Describe your requirements</label>
            <div className="flex gap-3">
              <textarea
                rows={2}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={`e.g. "Cover all 5 weekdays with 2 people per shift."`}
                className="flex-1 rounded-xl bg-[var(--glass-10)] border border-[var(--glass-border)] px-4 py-3 text-sm text-white placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] transition-all font-medium resize-none"
              />
              <Button size="sm" loading={aiLoading} onClick={onRunAiSchedule} icon={<Sparkles size={16} />}>
                Go
              </Button>
            </div>
          </div>

          {aiSummary && (
            <div className="p-4 bg-[var(--primary-600)]/5 border border-[var(--primary-600)]/20 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-[var(--primary-600)]" />
                <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-widest">AI Strategy</p>
              </div>
              <p className="text-xs font-medium text-white/80 leading-relaxed">{aiSummary}</p>
            </div>
          )}

          {aiWarnings.length > 0 && (
            <div className="p-4 bg-[var(--danger-500)]/5 border border-[var(--danger-500)]/20 rounded-2xl">
              <p className="text-[10px] font-black text-[var(--danger-500)] uppercase tracking-widest mb-1.5 flex items-center gap-2">
                 <AlertTriangle size={12} /> Optimization Conflicts
              </p>
              {aiWarnings.map((w, i) => <p key={i} className="text-[11px] font-medium text-[var(--danger-500)]/70 mt-0.5">&bull; {w}</p>)}
            </div>
          )}

          {aiPlan.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest mb-3">Proposed Plan</p>
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {aiPlan.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-xl">
                    <div>
                      <p className="text-xs font-black text-white uppercase truncate">{entry.user_name}</p>
                      <p className="text-[9px] font-bold text-[var(--primary-600)] uppercase tracking-widest">{entry.shift_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-white font-mono uppercase">
                         {entry.dates?.slice(0,2).map((d: string) => format(new Date(d), 'EEE d')).join(', ')}{(entry.dates?.length || 0) > 2 ? '...' : ''}
                      </p>
                      <p className="text-[9px] font-bold text-[var(--on-glass-muted)] uppercase">{entry.dates?.length} days</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}

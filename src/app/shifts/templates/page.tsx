'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Modal, ConfirmDialog, Input,
  Badge, EmptyState, TimePicker
} from '@/components/ui';
import { shiftsApi } from '@/lib/api';
import { getApiError, runDeferred } from '@/lib/utils';
import type { Shift, ShiftBreak } from '@/types';
import { Plus, Clock, Edit2, Trash2, Coffee, TrendingUp } from 'lucide-react';
import { useForm, UseFormReturn, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
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

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat', 'Sun'];
const SHIFT_COLORS = ['#00C896', '#00E5FF', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'];

const defaultShiftForm: ShiftForm = {
  active_days: [0,1,2,3,4], color: '#00C896', name: '', start_time: '09:00', end_time: '17:00',
  overtime_multiplier: 1.5, min_rest_hours: 11, late_tolerance_mins: 15,
  early_checkout_tolerance_mins: 15, auto_checkout: true, auto_checkout_buffer_mins: 30,
  overtime_enabled: false, overtime_requires_approval: true, extra_time_label: 'Extra office time',
  is_org_wide: false, is_default: false,
};

// ─── Shared Components ────────────────────────────────
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
        <span className="text-[11px] font-black text-[var(--on-glass-sub)] uppercase tracking-wider block mb-3">Active Days</span>
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
        <span className="text-[11px] font-black text-[var(--on-glass-sub)] uppercase tracking-wider block mb-3">Colour Accent</span>
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
            description="Everyone without a specific daily assignment follows this shift."
            checked={isOrgWide}
            onChange={() => form.setValue('is_org_wide', !isOrgWide)}
          />
          <ToggleRow
            label="Default shift"
            description="Fallback shift used when no other shift applies."
            checked={isDefault}
            onChange={() => form.setValue('is_default', !isDefault)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Break Management (Simplified for Template Page) ───
// In templates page we might want to manage breaks directly in the modal
function BreaksPanel({ shiftId }: { shiftId: string }) {
  const [breaks, setBreaks] = useState<ShiftBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    break_kind: 'fixed' as 'fixed' | 'flexible',
    start_time: '12:00',
    end_time: '13:00',
    duration_minutes: 30,
    is_paid: false,
    paid_within_limit: true,
    deduct_extra_time: true,
    auto_start: false,
    reminder_after_mins: 30,
    deduct_if_skipped: true,
  });

  const loadBreaks = useCallback(async () => {
    try {
      const { data } = await shiftsApi.getBreaks(shiftId);
      setBreaks(data.data || []);
    } catch { }
    finally { setLoading(false); }
  }, [shiftId]);

  useEffect(() => runDeferred(loadBreaks), [loadBreaks]);

  const handleAdd = async () => {
    if (!form.name) return toast.error('Name required');
    setSaving(true);
    try {
      await shiftsApi.addBreak(shiftId, {
        ...form,
        break_minutes: form.duration_minutes,
        break_start_time: form.start_time,
        break_end_time: form.end_time,
      });
      toast.success('Break added');
      setAdding(false);
      setForm({
        name: '',
        break_kind: 'fixed',
        start_time: '12:00',
        end_time: '13:00',
        duration_minutes: 30,
        is_paid: false,
        paid_within_limit: true,
        deduct_extra_time: true,
        auto_start: false,
        reminder_after_mins: 30,
        deduct_if_skipped: true,
      });
      loadBreaks();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await shiftsApi.deleteBreak(shiftId, id);
      setBreaks(prev => prev.filter(b => b.id !== id));
      toast.success('Break removed');
    } catch (err) { toast.error(getApiError(err)); }
    finally { setDeletingId(null); }
  };

  if (loading) return <div className="py-4 text-center text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">Loading breaks…</div>;

  return (
    <div className="mt-6 pt-6 border-t border-[var(--glass-border)]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.2em]">Shift Breaks</p>
        <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => setAdding(true)}>Add</Button>
      </div>

      <div className="space-y-2">
        {breaks.map(b => (
          <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--glass-10)] flex items-center justify-center">
                <Coffee size={14} className="text-[var(--on-glass-muted)]" />
              </div>
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-tight">{b.name}</p>
                <p className="text-[10px] text-[var(--on-glass-dim)] font-mono">
                  {b.break_kind === 'fixed' ? `${b.break_start_time} - ${b.break_end_time}` : `${b.break_minutes} mins`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {b.is_paid && <Badge label="PAID" color="#10b981" bg="#10b981" size="sm" />}
              <button onClick={() => handleDelete(b.id)} disabled={deletingId === b.id} aria-label="Delete break" title="Delete break" className="p-1.5 text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {breaks.length === 0 && !adding && <p className="text-[10px] text-center py-4 text-[var(--on-glass-dim)] uppercase tracking-widest font-bold">No breaks defined</p>}
      </div>

      {adding && (
        <div className="mt-4 p-4 rounded-2xl bg-[var(--glass-05)] border border-[var(--primary-600)]/20 space-y-4 slide-in-bottom">
          <Input label="Break Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Lunch, Tea, etc." />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
               <label htmlFor="templates-type" className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">Type</label>
               <select id="templates-type" className="bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm text-white" value={form.break_kind} onChange={e => setForm({...form, break_kind: e.target.value as 'fixed' | 'flexible'})}>
                  <option value="fixed">Fixed</option>
                  <option value="flexible">Flexible</option>
               </select>
            </div>
            {form.break_kind === 'fixed' ? (
              <div className="flex flex-col gap-2">
                 <label htmlFor="templates-start-time" className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">Start Time</label>
                 <input id="templates-start-time" type="time" className="bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm text-white" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} />
              </div>
            ) : (
              <Input label="Duration (min)" type="number" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: Number(e.target.value)})} />
            )}
          </div>
          {form.break_kind === 'fixed' && (
            <div className="flex flex-col gap-2">
               <label htmlFor="templates-end-time" className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">End Time</label>
               <input id="templates-end-time" type="time" className="bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm text-white" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 rounded-xl bg-white/5 border border-white/5">
            <ToggleRow label="Paid Break" checked={form.is_paid} onChange={() => setForm({...form, is_paid: !form.is_paid})} />
            <ToggleRow label="Paid within limit" checked={form.paid_within_limit} onChange={() => setForm({...form, paid_within_limit: !form.paid_within_limit})} />
            <ToggleRow label="Deduct Extra Time" checked={form.deduct_extra_time} onChange={() => setForm({...form, deduct_extra_time: !form.deduct_extra_time})} />
            <ToggleRow label="Auto-Start" checked={form.auto_start} onChange={() => setForm({...form, auto_start: !form.auto_start})} />
            <ToggleRow label="Deduct if skipped" checked={form.deduct_if_skipped} onChange={() => setForm({...form, deduct_if_skipped: !form.deduct_if_skipped})} />
            <div className="flex flex-col gap-1">
              <label htmlFor="templates-reminder-mins" className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">Reminder (mins)</label>
              <input id="templates-reminder-mins" type="number" className="bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-lg px-2 py-1 text-xs text-white" value={form.reminder_after_mins} onChange={e => setForm({...form, reminder_after_mins: Number(e.target.value)})} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={handleAdd}>Save Break</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────
export default function ShiftTemplatesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('shifts.manage');

  const [shifts, setShifts]   = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [deleteShift, setDeleteShift] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<ShiftForm>({ resolver: zodResolver(shiftSchema), defaultValues: defaultShiftForm });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await shiftsApi.getTemplates();
      setShifts(data.data || []);
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => runDeferred(load), [load]);

  const openAdd = () => { form.reset(defaultShiftForm); setEditShift(null); setModalOpen(true); };
  const openEdit = (s: Shift) => {
    form.reset({
      name: s.name, start_time: s.start_time, end_time: s.end_time, color: s.color || '#00C896',
      active_days: s.active_days ?? [],
      overtime_multiplier: s.overtime_multiplier ?? 1.5,
      min_rest_hours: s.min_rest_hours ?? 11,
      late_tolerance_mins: s.late_tolerance_mins ?? 15,
      early_checkout_tolerance_mins: s.early_checkout_tolerance_mins ?? 15,
      auto_checkout: s.auto_checkout ?? true,
      auto_checkout_buffer_mins: s.auto_checkout_buffer_mins ?? 30,
      overtime_enabled: s.overtime_enabled ?? false,
      overtime_requires_approval: s.overtime_requires_approval ?? true,
      extra_time_label: s.extra_time_label || 'Extra office time',
      is_org_wide: s.is_org_wide ?? false,
      is_default: s.is_default ?? false,
    });
    setEditShift(s); setModalOpen(true);
  };

  const onSave = form.handleSubmit(async (vals) => {
    try {
      if (editShift) { await shiftsApi.updateTemplate(editShift.id, vals); toast.success('Template updated'); }
      else           { await shiftsApi.createTemplate(vals); toast.success('Template created'); }
      setModalOpen(false); setEditShift(null); load();
    } catch (err) { toast.error(getApiError(err)); }
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Shift Templates"
        subtitle="Define reusable shift patterns for your team"
        breadcrumb={[{ label: 'Shifts', href: '/shifts' }, { label: 'Templates' }]}
        actions={canManage ? <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>New Template</Button> : undefined}
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-44 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />)}
        </div>
      ) : shifts.length === 0 ? (
        <Card className="p-12 text-center">
          <EmptyState icon={<Clock size={32} />} title="No shift templates"
            description="Templates let you quickly assign recurring shifts to your employees."
            action={canManage ? <Button icon={<Plus size={14} />} onClick={openAdd}>Create First Template</Button> : undefined} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {shifts.map(shift => (
            <Card key={shift.id} className="group relative hover:border-[var(--primary-600)]/50 transition-all duration-300">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                <button onClick={() => openEdit(shift)} aria-label="Edit template" title="Edit template" className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"><Edit2 size={14} /></button>
                <button onClick={() => setDeleteShift(shift)} aria-label="Delete template" title="Delete template" className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"><Trash2 size={14} /></button>
              </div>

              <div className="p-5 flex flex-col h-full">
                <div className="flex items-start gap-4 mb-5">
                   <div className="w-2 h-12 rounded-full shadow-lg" style={{ backgroundColor: shift.color }} />
                   <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[13px] font-black text-white uppercase tracking-tight truncate">{shift.name}</h3>
                        {shift.is_org_wide && <Badge label="ORG" color="#00E5FF" bg="#00E5FF" size="sm" />}
                        {shift.is_default && <Badge label="DEF" color="#f59e0b" bg="#f59e0b" size="sm" />}
                      </div>
                      <p className="text-xl font-black text-white mt-1 tracking-tighter">
                         {shift.start_time}<span className="text-[var(--on-glass-dim)] mx-1 font-medium">→</span>{shift.end_time}
                      </p>
                   </div>
                </div>

                <div className="mt-auto space-y-4">
                  <div className="flex gap-1.5">
                    {DAYS.map((d, i) => {
                      const active = shift.active_days?.includes(i);
                      return (
                        <div key={d} className={cn(
                          "flex-1 h-7 rounded-lg flex items-center justify-center text-[10px] font-black transition-all",
                          active ? "bg-white/10 text-white border border-white/10" : "text-[var(--on-glass-dim)] border border-transparent"
                        )} style={active ? { borderColor: shift.color + '40' } : {}}>
                          {d[0]}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-3">
                       <div className="flex items-center gap-1">
                          <Coffee size={12} className="text-[var(--on-glass-dim)]" />
                          <span className="text-[11px] font-bold text-white">{shift.breaks?.length || 0}</span>
                       </div>
                       {shift.overtime_enabled && (
                          <div className="flex items-center gap-1">
                             <TrendingUp size={12} className="text-[var(--primary-600)]" />
                             <span className="text-[10px] font-black text-[var(--primary-600)] uppercase">OT</span>
                          </div>
                       )}
                    </div>
                    <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">
                       {shift.late_tolerance_mins}m Grace
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditShift(null); }}
        title={editShift ? 'Edit Template' : 'New Template'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={form.formState.isSubmitting} onClick={onSave}>{editShift ? 'Save Changes' : 'Create Template'}</Button>
          </>
        }
      >
        <ShiftFormFields form={form} />
        {editShift && <BreaksPanel shiftId={editShift.id} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteShift}
        onClose={() => setDeleteShift(null)}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteShift?.name}"? This action cannot be undone.`}
        loading={deleting}
        onConfirm={async () => {
          if (!deleteShift) return;
          setDeleting(true);
          try {
            await shiftsApi.deleteTemplate(deleteShift.id);
            toast.success('Template deleted');
            setDeleteShift(null);
            load();
          } catch (err) { toast.error(getApiError(err)); }
          finally { setDeleting(false); }
        }}
      />
    </DashboardLayout>
  );
}

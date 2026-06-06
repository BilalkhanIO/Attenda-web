'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Modal, ConfirmDialog, Input, Badge, EmptyState } from '@/components/ui';
import { shiftsApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import type { Shift } from '@/types';
import { Plus, Clock, Edit2, Trash2, Coffee } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const shiftSchema = z.object({
  name:                          z.string().min(1, 'Shift name required'),
  start_time:                    z.string().min(1, 'Start time required'),
  end_time:                      z.string().min(1, 'End time required'),
  color:                         z.string().min(1, 'Color required'),
  active_days:                   z.array(z.number()).min(1, 'Select at least one day'),
  late_tolerance_mins:           z.number().min(0),
  auto_checkout:                 z.boolean(),
  auto_checkout_buffer_mins:     z.number().min(0),
});
type ShiftForm = z.infer<typeof shiftSchema>;

const COLORS = ['#00C896','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#EC4899','#14B8A6','#F97316'];

const defaultForm: ShiftForm = {
  name: '', start_time: '09:00', end_time: '17:00', color: '#00C896',
  active_days: [1,2,3,4,5], late_tolerance_mins: 15,
  auto_checkout: true, auto_checkout_buffer_mins: 30,
};

export default function ShiftTemplatesPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager', 'hr_admin', 'super_admin');

  const [shifts, setShifts]   = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [deleteShift, setDeleteShift] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<ShiftForm>({ resolver: zodResolver(shiftSchema), defaultValues: defaultForm });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await shiftsApi.getTemplates();
      setShifts(data.data || []);
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { form.reset(defaultForm); setEditShift(null); setModalOpen(true); };
  const openEdit = (s: Shift) => {
    form.reset({ name: s.name, start_time: s.start_time, end_time: s.end_time, color: s.color,
      active_days: s.active_days ?? [], late_tolerance_mins: s.late_tolerance_mins ?? 15,
      auto_checkout: s.auto_checkout ?? true, auto_checkout_buffer_mins: s.auto_checkout_buffer_mins ?? 30 });
    setEditShift(s); setModalOpen(true);
  };

  const onSave = form.handleSubmit(async (vals) => {
    try {
      if (editShift) { await shiftsApi.updateTemplate(editShift.id, vals as Record<string, unknown>); toast.success('Template updated'); }
      else           { await shiftsApi.createTemplate(vals as Record<string, unknown>); toast.success('Template created'); }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 rounded-xl bg-slate-800/40 border border-white/5 animate-pulse" />)}
        </div>
      ) : shifts.length === 0 ? (
        <Card className="glass-card p-8">
          <EmptyState icon={<Clock size={24} />} title="No templates yet"
            description="Create your first shift template to start building schedules."
            action={canManage ? <Button icon={<Plus size={14} />} onClick={openAdd}>Create Template</Button> : undefined} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map(shift => (
            <Card key={shift.id} className="p-4 relative overflow-hidden hover:bg-white/[0.04] transition-colors">
              <div className="absolute top-0 right-0 w-20 h-20 blur-3xl opacity-10 rounded-full pointer-events-none" style={{ backgroundColor: shift.color }} />
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: shift.color }} />
                  <div>
                    <h3 className="text-sm font-bold text-white">{shift.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{shift.start_time} – {shift.end_time}</p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(shift)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors"><Edit2 size={12} /></button>
                    <button onClick={() => setDeleteShift(shift)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {DAYS.map((d, i) => {
                    const active = shift.active_days?.includes(i + 1) || (i === 0 && shift.active_days?.includes(1));
                    return (
                      <div key={d} className={cn('w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold border',
                        active ? 'text-white border-white/20' : 'bg-slate-800/60 text-slate-600 border-transparent')}
                        style={active ? { backgroundColor: shift.color } : {}}>
                        {d[0]}
                      </div>
                    );
                  })}
                </div>
                {(shift.breaks?.length ?? 0) > 0 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/5">
                    <Coffee size={10} className="text-slate-400" />
                    <span className="text-[10px] text-slate-400">{shift.breaks!.length}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditShift(null); }}
        title={editShift ? 'Edit Template' : 'New Shift Template'} size="sm"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={form.formState.isSubmitting} onClick={onSave}>{editShift ? 'Save' : 'Create'}</Button></>}>
        <div className="space-y-4">
          <Input label="Name" required placeholder="e.g. Morning Shift" {...form.register('name')} error={form.formState.errors.name?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start time" type="time" required {...form.register('start_time')} />
            <Input label="End time" type="time" required {...form.register('end_time')} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => form.setValue('color', c)}
                  className={cn('w-7 h-7 rounded-lg border-2 transition-transform', form.watch('color') === c ? 'border-white scale-110' : 'border-transparent hover:scale-105')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">Active days</label>
            <div className="flex gap-1.5">
              {DAYS.map((d, i) => {
                const idx = i + 1;
                const vals = form.watch('active_days') ?? [];
                const on = vals.includes(idx);
                return (
                  <button key={d} type="button"
                    onClick={() => form.setValue('active_days', on ? vals.filter(v => v !== idx) : [...vals, idx])}
                    className={cn('flex-1 py-1.5 rounded text-xs font-bold border transition-colors',
                      on ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/10 text-slate-400 hover:text-white')}>
                    {d[0]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteShift} onClose={() => setDeleteShift(null)}
        title="Delete template" message={`Delete "${deleteShift?.name}"? This cannot be undone.`}
        loading={deleting}
        onConfirm={async () => {
          if (!deleteShift) return;
          setDeleting(true);
          try { await shiftsApi.deleteTemplate(deleteShift.id); toast.success('Deleted'); setDeleteShift(null); load(); }
          catch (err) { toast.error(getApiError(err)); }
          finally { setDeleting(false); }
        }} />
    </DashboardLayout>
  );
}

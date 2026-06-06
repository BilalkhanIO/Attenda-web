'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Table, Avatar, Button, Modal, EmptyState, Input, Textarea } from '@/components/ui';
import { performanceApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Target, CheckCircle, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Goal {
  id: string;
  user_id: string;
  review_id: string;
  title: string;
  description?: string;
  weight: number;
  target_date?: string;
  completion: number;
  user?: { id: string; name: string; department?: string };
}

const goalSchema = z.object({
  title:       z.string().min(2, 'Title required'),
  description: z.string().optional(),
  weight:      z.number().min(1).max(100),
  target_date: z.string().optional(),
});
type GoalForm = z.infer<typeof goalSchema>;

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? '#10b981' : value >= 50 ? '#00C896' : value >= 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{value}%</span>
    </div>
  );
}

export default function GoalsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager', 'hr_admin', 'super_admin');

  const [goals, setGoals]           = useState<Goal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editGoal, setEditGoal]     = useState<Goal | null>(null);
  const [completionEdit, setCompletionEdit] = useState<Goal | null>(null);
  const [newCompletion, setNewCompletion]   = useState(0);
  const [saving, setSaving]         = useState(false);

  const form = useForm<GoalForm>({ resolver: zodResolver(goalSchema), defaultValues: { title: '', weight: 25 } });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await performanceApi.getGoals();
      setGoals(data.data || []);
    } catch (err) { toast.error(getApiError(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSave = async (data: GoalForm) => {
    if (!editGoal) return;
    setSaving(true);
    try {
      await performanceApi.updateGoal(editGoal.id, data);
      toast.success('Goal updated');
      setEditGoal(null);
      form.reset();
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setSaving(false); }
  };

  const onUpdateCompletion = async () => {
    if (!completionEdit) return;
    setSaving(true);
    try {
      await performanceApi.updateGoal(completionEdit.id, { completion: newCompletion });
      toast.success('Progress updated');
      setCompletionEdit(null);
      load();
    } catch (err) { toast.error(getApiError(err)); }
    finally { setSaving(false); }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Goals"
        subtitle="Team goal progress and targets"
        breadcrumb={[{ label: 'Performance', href: '/performance' }, { label: 'Goals' }]}
      />

      <Card className="glass-card overflow-hidden">
        <Table
          headers={['Employee', 'Goal', 'Weight', 'Target Date', 'Progress', ...(canManage ? [''] : [])]}
          loading={loading}
          emptyState={<EmptyState icon={<Target size={22} />} title="No goals yet" description="Goals are created from performance reviews." />}
        >
          {goals.map(goal => (
            <tr key={goal.id} className="hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-3">
                {goal.user ? (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={goal.user.name} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-white">{goal.user.name}</p>
                      {goal.user.department && <p className="text-xs text-slate-500">{goal.user.department}</p>}
                    </div>
                  </div>
                ) : '—'}
              </td>
              <td className="px-4 py-3 max-w-xs">
                <p className="text-sm font-medium text-white truncate">{goal.title}</p>
                {goal.description && <p className="text-xs text-slate-500 truncate mt-0.5">{goal.description}</p>}
              </td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-300">{goal.weight}%</td>
              <td className="px-4 py-3 text-xs text-slate-400">
                {goal.target_date ? format(new Date(goal.target_date), 'dd MMM yyyy') : '—'}
              </td>
              <td className="px-4 py-3 min-w-[140px]"><ProgressBar value={goal.completion} /></td>
              {canManage && (
                <td className="px-4 py-3">
                  <button onClick={() => { setCompletionEdit(goal); setNewCompletion(goal.completion); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-500 hover:text-emerald-400 transition-colors">
                    <CheckCircle size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </Table>
      </Card>

      {/* Edit goal modal */}
      <Modal isOpen={!!editGoal} onClose={() => { setEditGoal(null); form.reset(); }}
        title="Edit Goal" size="sm"
        footer={<><Button variant="ghost" onClick={() => setEditGoal(null)}>Cancel</Button><Button loading={saving} onClick={form.handleSubmit(onSave)}>Save</Button></>}>
        <div className="space-y-4">
          <Input label="Title" required {...form.register('title')} error={form.formState.errors.title?.message} />
          <Textarea label="Description" {...form.register('description')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Weight (%)</label>
              <input type="number" min={1} max={100} {...form.register('weight', { valueAsNumber: true })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
            </div>
            <Input label="Target Date" type="date" {...form.register('target_date')} />
          </div>
        </div>
      </Modal>

      {/* Update completion modal */}
      <Modal isOpen={!!completionEdit} onClose={() => setCompletionEdit(null)}
        title="Update Progress" size="sm"
        footer={<><Button variant="ghost" onClick={() => setCompletionEdit(null)}>Cancel</Button><Button loading={saving} onClick={onUpdateCompletion}>Update</Button></>}>
        {completionEdit && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-300">{completionEdit.title}</p>
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Progress</span><span className="font-semibold text-white">{newCompletion}%</span>
              </div>
              <input type="range" min={0} max={100} value={newCompletion} onChange={e => setNewCompletion(+e.target.value)}
                className="w-full accent-emerald-500" />
              <ProgressBar value={newCompletion} />
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

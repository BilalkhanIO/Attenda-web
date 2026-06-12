'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Table, Avatar, Button, Modal, EmptyState, Input, Textarea } from '@/components/ui';
import { performanceApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { keys, performanceGoalsQuery, type PerformanceGoal } from '@/lib/queries';
import { Target, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { PerformanceProgress } from '@/components/performance/PerformanceProgress';

const goalSchema = z.object({
  title:       z.string().min(2, 'Title required'),
  description: z.string().optional(),
  weight:      z.number().min(1).max(100),
  target_date: z.string().optional(),
});
type GoalForm = z.infer<typeof goalSchema>;

export default function GoalsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('performance.manage');

  const [editGoal, setEditGoal]     = useState<PerformanceGoal | null>(null);
  const [completionEdit, setCompletionEdit] = useState<PerformanceGoal | null>(null);
  const [newCompletion, setNewCompletion]   = useState(0);

  const form = useForm<GoalForm>({ resolver: zodResolver(goalSchema), defaultValues: { title: '', weight: 25 } });

  // ── Queries ──────────────────────────────────────────
  const { data: goals = [], isLoading: loading } = useQuery(performanceGoalsQuery());

  // ── Mutations ────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string; data: Record<string, unknown> }) => {
      return performanceApi.updateGoal(vars.id, vars.data);
    },
    onSuccess: () => {
      toast.success('Goal updated');
      setEditGoal(null);
      setCompletionEdit(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: keys.performance.goals() });
    },
    onError: (err) => {
      toast.error(getApiError(err));
    }
  });

  const onSave = (data: GoalForm) => {
    if (!editGoal) return;
    updateMutation.mutate({ id: editGoal.id, data });
  };

  const onUpdateCompletion = () => {
    if (!completionEdit) return;
    updateMutation.mutate({ id: completionEdit.id, data: { completion: newCompletion } });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Goals"
        subtitle="Team goal progress and targets"
        breadcrumb={[{ label: 'Performance', href: '/performance' }, { label: 'Goals' }]}
      />

      <Card className="overflow-hidden">
        <Table
          headers={['Employee', 'Goal', 'Weight', 'Target Date', 'Progress', ...(canManage ? [''] : [])]}
          loading={loading}
          emptyState={<EmptyState icon={<Target size={22} />} title="No goals yet" description="Goals are created from performance reviews." />}
        >
          {goals.map(goal => (
            <tr key={goal.id} className="hover:bg-[var(--glass-05)] transition-all group">
              <td className="px-4 py-3">
                {goal.user ? (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={goal.user.name} size="sm" />
                    <div>
                      <p className="text-sm font-black text-white group-hover:text-[var(--primary-600)] transition-colors">{goal.user.name}</p>
                      {goal.user.department && <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">{goal.user.department}</p>}
                    </div>
                  </div>
                ) : '—'}
              </td>
              <td className="px-4 py-3 max-w-xs">
                <p className="text-sm font-bold text-white truncate">{goal.title}</p>
                {goal.description && <p className="text-xs text-[var(--on-glass-muted)] truncate mt-0.5">{goal.description}</p>}
              </td>
              <td className="px-4 py-3 text-sm font-black text-[var(--primary-600)] tracking-tighter">{goal.weight}%</td>
              <td className="px-4 py-3 text-[11px] font-bold text-[var(--on-glass-dim)] uppercase tracking-wider">
                {goal.target_date ? format(new Date(goal.target_date), 'dd MMM yyyy') : (goal.due_date ? format(new Date(goal.due_date), 'dd MMM yyyy') : '—')}
              </td>
              <td className="px-4 py-3 min-w-[140px]"><PerformanceProgress value={goal.completion ?? goal.progress ?? 0} /></td>
              {canManage && (
                <td className="px-4 py-3">
                  <button onClick={() => { setCompletionEdit(goal); setNewCompletion(goal.completion ?? goal.progress ?? 0); }}
                    title="Update Progress"
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-[var(--success-500)] hover:bg-[var(--glass-15)] transition-all">
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
        footer={<><Button variant="ghost" onClick={() => setEditGoal(null)}>Cancel</Button><Button loading={updateMutation.isPending} onClick={form.handleSubmit(onSave)}>Save</Button></>}>
        <div className="space-y-4">
          <Input label="Title" required {...form.register('title')} error={form.formState.errors.title?.message} />
          <Textarea label="Description" {...form.register('description')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-[0.1em] block mb-1.5">Weight (%)</label>
              <input type="number" min={1} max={100} {...form.register('weight', { valueAsNumber: true })}
                className="w-full rounded-xl border bg-[var(--glass-05)] px-4 py-3 text-sm text-white placeholder:text-[var(--on-glass-dim)] transition-all duration-200 border-[var(--glass-border)] focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 outline-none" />
            </div>
            <Input label="Target Date" type="date" {...form.register('target_date')} />
          </div>
        </div>
      </Modal>

      {/* Update completion modal */}
      <Modal isOpen={!!completionEdit} onClose={() => setCompletionEdit(null)}
        title="Update Progress" size="sm"
        footer={<><Button variant="ghost" onClick={() => setCompletionEdit(null)}>Cancel</Button><Button loading={updateMutation.isPending} onClick={onUpdateCompletion}>Update</Button></>}>
        {completionEdit && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-white">{completionEdit.title}</p>
            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">
                <span>Progress</span><span className="text-white">{newCompletion}%</span>
              </div>
              <input type="range" min={0} max={100} value={newCompletion} onChange={e => setNewCompletion(+e.target.value)}
                className="w-full accent-[var(--primary-600)] cursor-pointer" />
              <PerformanceProgress value={newCompletion} />
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui';
import { onboardingApi } from '@/lib/api';
import { keys, myOnboardingTasksQuery, type OnboardingTask } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { formatDateOnly } from '@/lib/utils';
import { toISODate } from '@/lib/i18n';
import { ListChecks, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

/** due_date is a @db.Date (UTC-midnight calendar day) — compare its UTC
 *  Y-M-D against today's org-local Y-M-D. */
function isOverdue(dueDate: string): boolean {
  return toISODate(dueDate, 'UTC') < toISODate(new Date());
}

/**
 * Compact dashboard widget: my pending onboarding tasks (own onboarding
 * plus manager-side items for my hires). Renders nothing when there is
 * nothing pending.
 */
export default function MyOnboardingCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tasksQ = useQuery(myOnboardingTasksQuery());
  const [busyId, setBusyId] = useState<string | null>(null);

  const closeMutation = useMutation({
    mutationFn: (vars: { id: string; action: 'complete' | 'skip' }) =>
      vars.action === 'complete'
        ? onboardingApi.completeTask(vars.id)
        : onboardingApi.skipTask(vars.id),
    onMutate: vars => setBusyId(vars.id),
    onSuccess: (_d, vars) => {
      toast.success(vars.action === 'complete' ? 'Task completed' : 'Task skipped');
      queryClient.invalidateQueries({ queryKey: keys.onboarding.all });
    },
    onSettled: () => setBusyId(null),
  });

  const pending: OnboardingTask[] = (tasksQ.data ?? []).filter(t => t.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <Card>
      <div className="p-5 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-[var(--primary-600)]" />
          <h3 className="text-xs font-black text-white uppercase tracking-widest">My Onboarding</h3>
          <span className="ml-auto bg-[var(--primary-600)]/15 text-[var(--primary-600)] text-[10px] font-black rounded-full px-2 py-0.5">
            {pending.length}
          </span>
        </div>
      </div>
      <div className="p-4 space-y-0.5">
        {pending.map(task => {
          const forOther = task.user.id !== user?.sub;
          const overdue = !!task.due_date && isOverdue(task.due_date);
          const busy = busyId === task.id && closeMutation.isPending;
          return (
            <div key={task.id} className="item-row">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{task.item_title}</p>
                <p className="text-[10px] truncate mt-0.5">
                  {task.due_date ? (
                    <span
                      className="font-bold"
                      style={{ color: overdue ? 'var(--danger-500)' : 'var(--on-glass-muted)' }}
                    >
                      Due {formatDateOnly(task.due_date)}{overdue && ' — overdue'}
                    </span>
                  ) : (
                    <span className="text-[var(--on-glass-dim)]">No due date</span>
                  )}
                  {forOther && (
                    <span className="text-[var(--on-glass-dim)]"> · for {task.user.name}</span>
                  )}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => closeMutation.mutate({ id: task.id, action: 'complete' })}
                  disabled={busy}
                  aria-label={`Complete ${task.item_title}`}
                  title="Complete"
                  className="action-btn action-btn-approve"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => closeMutation.mutate({ id: task.id, action: 'skip' })}
                  disabled={busy}
                  aria-label={`Skip ${task.item_title}`}
                  title="Skip"
                  className="action-btn action-btn-reject"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

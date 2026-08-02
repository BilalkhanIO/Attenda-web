'use client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui';
import { onboardingUserQuery, type OnboardingTask } from '@/lib/queries';
import { formatDateOnly } from '@/lib/utils';
import { toISODate } from '@/lib/i18n';
import { ListChecks, CheckCircle2, MinusCircle, Circle } from 'lucide-react';

/** due_date is a @db.Date (UTC-midnight calendar day). */
function isOverdue(dueDate: string): boolean {
  return toISODate(dueDate, 'UTC') < toISODate(new Date());
}

function TaskRow({ task }: { task: OnboardingTask }) {
  const overdue = task.status === 'pending' && !!task.due_date && isOverdue(task.due_date);
  const StatusIcon =
    task.status === 'done' ? CheckCircle2 :
    task.status === 'skipped' ? MinusCircle : Circle;
  const iconColor =
    task.status === 'done' ? 'var(--success-500)' :
    task.status === 'skipped' ? 'var(--on-glass-dim)' :
    overdue ? 'var(--danger-500)' : 'var(--on-glass-muted)';

  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-[var(--glass-border)] last:border-b-0">
      <StatusIcon size={14} className="shrink-0 mt-0.5" style={{ color: iconColor }} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold truncate ${
          task.status === 'pending' ? 'text-white' : 'text-[var(--on-glass-muted)] line-through'
        }`}>
          {task.item_title}
        </p>
        <p className="text-[10px] text-[var(--on-glass-dim)] truncate mt-0.5">
          {task.due_date && (
            <span style={overdue ? { color: 'var(--danger-500)', fontWeight: 700 } : undefined}>
              Due {formatDateOnly(task.due_date)}{overdue && ' — overdue'}
            </span>
          )}
          {task.due_date && task.assignee && ' · '}
          {task.assignee && <>Owner: {task.assignee.name}</>}
        </p>
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest shrink-0 mt-0.5" style={{ color: iconColor }}>
        {task.status}
      </span>
    </div>
  );
}

/**
 * Onboarding progress card for an employee's detail view. Callers gate
 * rendering on onboarding.view_team (GET /onboarding/user/:id requires it).
 */
export default function EmployeeOnboardingSection({ userId, userName }: { userId: string; userName: string }) {
  const checklistQ = useQuery(onboardingUserQuery(userId));
  const checklist = checklistQ.data;
  const progress = checklist?.progress ?? { done: 0, total: 0 };
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="panel">
      <div className="flex items-center gap-2 mb-2.5">
        <ListChecks size={14} className="text-[var(--on-glass-muted)]" />
        <p className="label-xs flex-1">Onboarding</p>
        {progress.total > 0 && (
          <span className="text-[10px] font-black text-[var(--primary-600)]">
            {progress.done}/{progress.total}
          </span>
        )}
      </div>

      {checklistQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-lg" />)}
        </div>
      ) : !checklist || checklist.tasks.length === 0 ? (
        <p className="text-[11px] text-[var(--on-glass-dim)]">
          No onboarding checklist assigned to {userName} yet.
        </p>
      ) : (
        <>
          <div
            className="w-full h-1.5 rounded-full bg-[var(--glass-10)] overflow-hidden mb-2.5"
            role="progressbar"
            aria-valuenow={progress.done}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label="Onboarding progress"
          >
            <div
              className="h-full rounded-full bg-[var(--primary-600)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {checklist.tasks.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        </>
      )}
    </div>
  );
}

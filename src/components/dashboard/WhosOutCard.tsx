'use client';
import { useQuery } from '@tanstack/react-query';
import { Card, Avatar, Badge, Skeleton } from '@/components/ui';
import { whosOutTodayQuery, type WhosOutLeaveEntry, type WhosOutRemoteEntry } from '@/lib/queries';
import { CalendarOff, Home, PartyPopper, Users } from 'lucide-react';

function PersonRow({ name, avatarUrl, department, chip }: {
  name: string;
  avatarUrl?: string;
  department?: string;
  chip: { label: string; color: string; bg: string };
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--glass-05)] transition-colors">
      <Avatar name={name} imageUrl={avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-white truncate">{name}</p>
        {department && <p className="text-[10px] text-[var(--on-glass-dim)] truncate">{department}</p>}
      </div>
      <Badge label={chip.label} color={chip.color} bg={chip.bg} size="sm" />
    </div>
  );
}

/** Compact dashboard widget: who's away today (leave / remote / holiday). */
export default function WhosOutCard() {
  const { data, isPending } = useQuery(whosOutTodayQuery());

  const onLeave: WhosOutLeaveEntry[] = data?.on_leave ?? [];
  const remote: WhosOutRemoteEntry[] = data?.remote ?? [];
  const isHoliday = (data?.holidays?.length ?? 0) > 0;
  const outCount = onLeave.length + remote.length;

  return (
    <Card>
      <div className="p-5 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
        <div className="flex items-center gap-2">
          <CalendarOff size={16} className="text-[var(--primary-600)]" />
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Who&apos;s Out Today</h3>
          {outCount > 0 && (
            <span className="ml-auto bg-[var(--primary-600)]/15 text-[var(--primary-600)] text-[10px] font-black rounded-full px-2 py-0.5">
              {outCount}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : (
          <>
            {isHoliday && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[var(--warning-500)]/10 border border-[var(--warning-500)]/20 mb-3">
                <PartyPopper size={14} className="text-[var(--warning-500)] flex-shrink-0" />
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--warning-500)]">
                  Public holiday today
                </p>
              </div>
            )}

            {outCount === 0 ? (
              !isHoliday && (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[var(--success-100)] flex items-center justify-center mx-auto mb-2">
                    <Users size={18} className="text-[var(--success-700)]" />
                  </div>
                  <p className="text-sm text-[var(--gray-500)]">Everyone&apos;s in today</p>
                </div>
              )
            ) : (
              <div className="space-y-4">
                {onLeave.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest mb-1.5 px-2.5">
                      On Leave
                    </p>
                    <div className="space-y-0.5">
                      {onLeave.map(entry => (
                        <PersonRow
                          key={entry.id}
                          name={entry.user.name}
                          avatarUrl={entry.user.avatar_url}
                          department={entry.user.department}
                          chip={{
                            label: entry.is_half_day ? `${entry.leave_type} · ½` : entry.leave_type,
                            color: '#00C896',
                            bg: '#00C896',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {remote.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest mb-1.5 px-2.5 flex items-center gap-1">
                      <Home size={10} /> Remote
                    </p>
                    <div className="space-y-0.5">
                      {remote.map(entry => (
                        <PersonRow
                          key={entry.id}
                          name={entry.user.name}
                          avatarUrl={entry.user.avatar_url}
                          department={entry.user.department}
                          chip={{ label: 'Remote', color: '#a78bfa', bg: '#8b5cf6' }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

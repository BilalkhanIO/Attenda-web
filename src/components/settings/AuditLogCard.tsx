'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Skeleton } from '@/components/ui';
import { orgApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, LOCAL_TZ } from '@/lib/i18n';

interface AuditRow {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason?: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  'payroll.adjust': 'Payroll adjusted',
  'payroll.process': 'Payroll processed',
  'leave.balance.update': 'Leave balance changed',
  'attendance.override': 'Attendance overridden',
};

/** Read-only trail of pay-affecting mutations (who/what/why). */
export default function AuditLogCard() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('org.settings.update');
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isPending } = useQuery({
    queryKey: ['audit-logs', page],
    enabled: canView,
    queryFn: async () => (await orgApi.getAuditLogs({ page, limit })).data.data as
      { items: AuditRow[]; total: number },
  });

  if (!canView) return null;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card className="glass-card p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <ScrollText size={16} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100">Audit Trail</h3>
          <p className="text-xs text-slate-400">Pay-affecting changes — payroll, balances, attendance overrides</p>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">No audited changes yet.</p>
      ) : (
        <div className="space-y-1">
          {items.map(row => (
            <div key={row.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03]">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200">
                  <span className="font-bold">{row.actor_name}</span>
                  <span className="text-slate-400"> · {ACTION_LABELS[row.action] ?? row.action}</span>
                </p>
                {row.reason && <p className="text-[11px] text-slate-500 italic truncate">“{row.reason}”</p>}
              </div>
              <span className="text-[11px] text-slate-500 whitespace-nowrap">
                {formatDate(row.created_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: LOCAL_TZ })}
              </span>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-3">
          <Button variant="ghost" size="sm" disabled={page <= 1} icon={<ChevronLeft size={13} />}
            onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-xs text-slate-500">{page} / {pages}</span>
          <Button variant="ghost" size="sm" disabled={page >= pages} icon={<ChevronRight size={13} />}
            onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </Card>
  );
}

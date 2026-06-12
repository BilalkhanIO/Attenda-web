'use client';

import { useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Card, Button, Badge, Table, EmptyState } from '@/components/ui';
import {
  AdminOrg, PLAN_STYLES, ORG_STATUS_STYLES, SUB_STATUS_STYLES, fmtDate, daysLeft,
} from '@/lib/admin-shared';
import { Building2, Eye, EyeOff, Ban, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface OrgsTableProps {
  orgs: AdminOrg[];
  loading: boolean;
  /** Called with the updated org after a successful suspend/reactivate. */
  onOrgUpdated: (org: AdminOrg) => void;
}

/** Full organisations table with suspend actions and show/hide-suspended toggle. */
export default function OrgsTable({ orgs, loading, onOrgUpdated }: OrgsTableProps) {
  const [suspending, setSuspending] = useState<string | null>(null);
  const [showSuspended, setShowSuspended] = useState(true);

  const handleSuspend = async (orgId: string) => {
    setSuspending(orgId);
    try {
      const res = await adminApi.suspendOrg(orgId);
      onOrgUpdated(res.data.data);
      toast.success('Organisation updated');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSuspending(null);
    }
  };

  const visibleOrgs = showSuspended ? orgs : orgs.filter(o => o.status !== 'suspended');

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-widest">Organisations</h2>
          {!loading && (
            <p className="text-xs text-[var(--on-glass-dim)] mt-0.5">{visibleOrgs.length} of {orgs.length} shown</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowSuspended(v => !v)}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--on-glass-dim)] hover:text-white px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)] transition-all"
        >
          {showSuspended ? <EyeOff size={13} /> : <Eye size={13} />}
          {showSuspended ? 'Hide suspended' : 'Show suspended'}
        </button>
      </div>

      <Table
        headers={['Organisation', 'Plan', 'Status', 'Subscription', 'Trial', 'Users', 'Actions']}
        loading={loading}
        emptyState={
          !loading && visibleOrgs.length === 0 ? (
            <EmptyState icon={<Building2 size={24} />} title="No organisations" description="No organisations match the filter." />
          ) : undefined
        }
      >
        {visibleOrgs.map(org => {
          const planStyle = PLAN_STYLES[org.plan] ?? PLAN_STYLES.trial;
          const orgSt = ORG_STATUS_STYLES[org.status] ?? ORG_STATUS_STYLES.active;
          const subSt = SUB_STATUS_STYLES[org.subscription_status] ?? SUB_STATUS_STYLES.active;
          const trial = daysLeft(org.trial_ends_at);
          return (
            <tr key={org.id} className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-05)] transition-all group">
              <td className="py-4 px-6">
                <Link href={`/admin/orgs/${org.id}`} className="text-sm font-black text-white group-hover:text-[var(--primary-600)] transition-colors">
                  {org.name}
                </Link>
                <p className="text-[10px] text-[var(--on-glass-dim)] mt-0.5 font-medium uppercase tracking-wider">{org.timezone}</p>
              </td>
              <td className="py-4 px-6">
                <Badge label={org.plan.toUpperCase()} color={planStyle.color} bg={planStyle.bg} size="sm" />
              </td>
              <td className="py-4 px-6">
                <Badge label={orgSt.label} color={orgSt.color} bg={orgSt.bg} size="sm" />
              </td>
              <td className="py-4 px-6">
                <Badge label={subSt.label} color={subSt.color} bg={subSt.bg} size="sm" />
              </td>
              <td className="py-4 px-6">
                <span className={`text-xs font-bold ${trial !== null && trial <= 3 ? 'text-[var(--danger-500)]' : trial !== null && trial <= 7 ? 'text-[var(--warning-500)]' : 'text-[var(--on-glass-muted)]'}`}>
                  {org.trial_ends_at
                    ? trial !== null && trial <= 0
                      ? 'Expired'
                      : trial !== null
                        ? `${trial}d left`
                        : fmtDate(org.trial_ends_at)
                    : '—'}
                </span>
              </td>
              <td className="py-4 px-6">
                <span className="text-sm font-black text-white">{org.user_count}</span>
              </td>
              <td className="py-4 px-6">
                <div className="flex gap-2">
                  <Link href={`/admin/orgs/${org.id}`}>
                    <Button variant="ghost" size="sm">View</Button>
                  </Link>
                  <Button
                    variant={org.status === 'suspended' ? 'success' : 'ghost'}
                    size="sm"
                    loading={suspending === org.id}
                    icon={org.status === 'suspended' ? <CheckCircle size={14} /> : <Ban size={14} />}
                    onClick={() => handleSuspend(org.id)}
                  />
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </Card>
  );
}

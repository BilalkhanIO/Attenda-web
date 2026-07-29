'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Card, Button, Badge, Table, EmptyState, ConfirmDialog } from '@/components/ui';
import {
  AdminOrg, PLAN_STYLES, ORG_STATUS_STYLES, SUB_STATUS_STYLES, fmtDate, daysLeft,
} from '@/lib/admin-shared';
import { Building2, Eye, EyeOff, Ban, CheckCircle, Search } from 'lucide-react';
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
  const [confirmTarget, setConfirmTarget] = useState<AdminOrg | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  const handleToggleStatus = async () => {
    if (!confirmTarget) return;
    setSuspending(confirmTarget.id);
    try {
      const res = await adminApi.suspendOrg(confirmTarget.id);
      onOrgUpdated(res.data.data);
      toast.success('Organisation updated');
      setConfirmTarget(null);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSuspending(null);
    }
  };

  const filteredOrgs = useMemo(() => {
    return orgs.filter(o => {
      if (!showSuspended && o.status === 'suspended') return false;
      if (planFilter !== 'all' && o.plan !== planFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return o.name.toLowerCase().includes(s) || o.id.toLowerCase().includes(s) || o.contact_email?.toLowerCase().includes(s);
      }
      return true;
    });
  }, [orgs, showSuspended, planFilter, search]);

  const uniquePlans = useMemo(() => {
    const plans = Array.from(new Set(orgs.map(o => o.plan)));
    return [{ value: 'all', label: 'All Plans' }, ...plans.map(p => ({ value: p, label: p.toUpperCase() }))];
  }, [orgs]);

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-[var(--glass-border)] bg-[var(--glass-05)] gap-4">
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Organisations</h2>
            {!loading && (
              <p className="text-xs text-[var(--on-glass-dim)] mt-0.5">{filteredOrgs.length} of {orgs.length} shown</p>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-glass-dim)]" />
              <input 
                type="text"
                placeholder="Search orgs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-xl text-xs text-white focus:outline-none focus:border-[var(--primary-600)] transition-colors"
              />
            </div>

            <select 
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
              className="px-3 py-2 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-xl text-xs text-white focus:outline-none focus:border-[var(--primary-600)] transition-colors appearance-none min-w-[120px]"
            >
              {uniquePlans.map(p => <option key={p.value} value={p.value} className="bg-[var(--dark-950)]">{p.label}</option>)}
            </select>

            <button
              type="button"
              onClick={() => setShowSuspended(v => !v)}
              className="flex items-center gap-1.5 text-xs font-bold text-[var(--on-glass-dim)] hover:text-white px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)] transition-all"
            >
              {showSuspended ? <EyeOff size={13} /> : <Eye size={13} />}
              {showSuspended ? 'Hide suspended' : 'Show suspended'}
            </button>
          </div>
        </div>

        <Table
          headers={['Organisation', 'Plan', 'Status', 'Subscription', 'Trial', 'Users', 'Actions']}
          loading={loading}
          emptyState={
            <EmptyState icon={<Building2 size={24} />} title="No organisations" description="No organisations match the filter." />
          }
        >
          {filteredOrgs.map(org => {
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
                      onClick={() => setConfirmTarget(org)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <ConfirmDialog
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleToggleStatus}
        loading={!!suspending}
        title={confirmTarget?.status === 'suspended' ? 'Reactivate Organisation' : 'Suspend Organisation'}
        message={
          confirmTarget?.status === 'suspended'
            ? `Are you sure you want to reactivate ${confirmTarget?.name}? Users will be able to log in again.`
            : `Are you sure you want to suspend ${confirmTarget?.name}? All users will lose access to the platform immediately.`
        }
        confirmLabel={confirmTarget?.status === 'suspended' ? 'Reactivate' : 'Suspend'}
        variant={confirmTarget?.status === 'suspended' ? 'primary' : 'danger'}
      />
    </>
  );
}

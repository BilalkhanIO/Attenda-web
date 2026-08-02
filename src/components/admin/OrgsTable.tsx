'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { keys, adminOrgsQuery } from '@/lib/queries';
import { useUrlListParams, parsePageParam } from '@/lib/url-list-params';
import { getApiError } from '@/lib/utils';
import { Card, Button, Badge, DataTable, EmptyState, ConfirmDialog } from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';
import {
  AdminOrg, PLAN_STYLES, ORG_STATUS_STYLES, SUB_STATUS_STYLES, fmtDate, daysLeft,
} from '@/lib/admin-shared';
import { Building2, Ban, CheckCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const PAGE_SIZE = 25;
const DEFAULT_SORT = 'created_at'; // server default for GET /admin/orgs (desc)

const STATUS_OPTIONS = [
  { value: '',          label: 'All Statuses' },
  { value: 'active',    label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'rejected',  label: 'Rejected' },
];

/**
 * Full organisations table. Search (q), status filter, sorting and
 * pagination are applied server-side via GET /admin/orgs; the list state
 * lives in the URL so it survives refresh/back-nav. The plan filter stays
 * client-side (the endpoint has no plan param) and narrows the current page.
 */
export default function OrgsTable() {
  const queryClient = useQueryClient();
  const [suspending, setSuspending] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminOrg | null>(null);
  const [planFilter, setPlanFilter] = useState('all');

  const { searchParams, setParams } = useUrlListParams();
  const q      = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? '';
  const page   = parsePageParam(searchParams.get('page'));
  const sort   = searchParams.get('sort') ?? DEFAULT_SORT;
  const order  = searchParams.get('order') === 'asc' ? 'asc' as const : 'desc' as const;

  // Debounced (300ms) org-name search — commits `q` to the URL. Only typing
  // arms the timer, so mount/back-nav never rewrite the URL.
  const [search, setSearch] = useState(q);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      setParams({ q: value || null, page: null });
    }, 300);
  };
  useEffect(() => {
    if (!searchTimer.current) setSearch(q);
  }, [q]);

  const onSort = (key: string) => {
    if (key === sort) setParams({ order: order === 'desc' ? 'asc' : null, page: null });
    else setParams({ sort: key === DEFAULT_SORT ? null : key, order: null, page: null });
  };

  const orgsQuery = useQuery({
    ...adminOrgsQuery({ q, status, page, limit: PAGE_SIZE, sort, order }),
    placeholderData: keepPreviousData,
  });
  const data    = orgsQuery.data;
  const orgs    = useMemo(() => data?.orgs ?? [], [data]);
  const total   = data?.pagination.total ?? 0;
  const loading = orgsQuery.isPending;

  const handleToggleStatus = async () => {
    if (!confirmTarget) return;
    setSuspending(confirmTarget.id);
    try {
      await adminApi.suspendOrg(confirmTarget.id);
      toast.success('Organisation updated');
      setConfirmTarget(null);
      queryClient.invalidateQueries({ queryKey: keys.admin.all });
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSuspending(null);
    }
  };

  const filteredOrgs = useMemo(
    () => planFilter === 'all' ? orgs : orgs.filter(o => o.plan === planFilter),
    [orgs, planFilter],
  );

  const uniquePlans = useMemo(() => {
    const plans = Array.from(new Set(orgs.map(o => o.plan)));
    if (planFilter !== 'all' && !plans.includes(planFilter)) plans.push(planFilter);
    return [{ value: 'all', label: 'All Plans' }, ...plans.map(p => ({ value: p, label: p.toUpperCase() }))];
  }, [orgs, planFilter]);

  const columns: DataTableColumn<AdminOrg>[] = [
    {
      key: 'name',
      header: 'Organisation',
      sortable: true,
      render: (org) => (
        <>
          <Link href={`/admin/orgs/${org.id}`} className="text-sm font-black text-white group-hover:text-[var(--primary-600)] transition-colors">
            {org.name}
          </Link>
          <p className="text-[10px] text-[var(--on-glass-dim)] mt-0.5 font-medium uppercase tracking-wider">{org.timezone}</p>
        </>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      render: (org) => {
        const planStyle = PLAN_STYLES[org.plan] ?? PLAN_STYLES.trial;
        return <Badge label={org.plan.toUpperCase()} color={planStyle.color} bg={planStyle.bg} size="sm" />;
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (org) => {
        const orgSt = ORG_STATUS_STYLES[org.status] ?? ORG_STATUS_STYLES.active;
        return <Badge label={orgSt.label} color={orgSt.color} bg={orgSt.bg} size="sm" />;
      },
    },
    {
      key: 'subscription_status',
      header: 'Subscription',
      sortable: true,
      render: (org) => {
        const subSt = SUB_STATUS_STYLES[org.subscription_status] ?? SUB_STATUS_STYLES.active;
        return <Badge label={subSt.label} color={subSt.color} bg={subSt.bg} size="sm" />;
      },
    },
    {
      key: 'trial',
      header: 'Trial',
      render: (org) => {
        const trial = daysLeft(org.trial_ends_at);
        return (
          <span className={`text-xs font-bold ${trial !== null && trial <= 3 ? 'text-[var(--danger-500)]' : trial !== null && trial <= 7 ? 'text-[var(--warning-500)]' : 'text-[var(--on-glass-muted)]'}`}>
            {org.trial_ends_at
              ? trial !== null && trial <= 0
                ? 'Expired'
                : trial !== null
                  ? `${trial}d left`
                  : fmtDate(org.trial_ends_at)
              : '—'}
          </span>
        );
      },
    },
    {
      key: 'users',
      header: 'Users',
      render: (org) => <span className="text-sm font-black text-white">{org.user_count}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (org) => (
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
      ),
    },
  ];

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-5 border-b border-[var(--glass-border)] bg-[var(--glass-05)] gap-4">
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Organisations</h2>
            {!loading && (
              <p className="text-xs text-[var(--on-glass-dim)] mt-0.5">
                {planFilter === 'all'
                  ? `${total} total`
                  : `${filteredOrgs.length} of ${orgs.length} on this page · ${total} total`}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-glass-dim)]" />
              <input
                type="text"
                placeholder="Search orgs..."
                value={search}
                onChange={e => onSearchChange(e.target.value)}
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

            <select
              value={status}
              onChange={e => setParams({ status: e.target.value || null, page: null })}
              className="px-3 py-2 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-xl text-xs text-white focus:outline-none focus:border-[var(--primary-600)] transition-colors appearance-none min-w-[120px]"
            >
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value} className="bg-[var(--dark-950)]">{s.label}</option>)}
            </select>
          </div>
        </div>

        <DataTable<AdminOrg>
          columns={columns}
          data={filteredOrgs}
          rowKey={org => org.id}
          loading={loading}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={p => setParams({ page: p <= 1 ? null : String(p) })}
          sortKey={sort}
          sortDir={order}
          onSort={onSort}
          emptyState={
            <EmptyState icon={<Building2 size={24} />} title="No organisations" description="No organisations match the filter." />
          }
        />
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

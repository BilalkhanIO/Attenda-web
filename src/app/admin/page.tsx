'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { getApiError, timeAgo } from '@/lib/utils';
import { Card, KPICard, PageHeader, Button, Badge, Skeleton } from '@/components/ui';
import { AdminOrg, PlatformStats, PLAN_STYLES, ORG_STATUS_STYLES } from '@/lib/admin-shared';
import PendingApplications from '@/components/admin/PendingApplications';
import {
  Building2, Users, Activity, RefreshCw, AlertCircle, Clock, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [pendingOrgs, setPendingOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);

  // Note: deliberately does not flip `loading` back on — re-fetches after
  // approve/reject/refresh update in place without a skeleton flash.
  const fetchData = useCallback(async () => {
    try {
      const [statsRes, orgsRes, pendingRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getOrgs(),
        adminApi.getPendingOrgs(),
      ]);
      setStats(statsRes.data.data);
      setOrgs(orgsRes.data.data);
      setPendingOrgs(pendingRes.data.data);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await fetchData(); })();
  }, [fetchData]);

  const recentOrgs = [...orgs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Platform Dashboard"
        subtitle="Organisations, subscriptions, and approvals"
        actions={
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>
            Refresh
          </Button>
        }
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        ) : (
          <>
            <KPICard title="Active Orgs"   value={stats?.org_count ?? 0}      icon={<Building2 size={20} />}     color="#00C896" bg="#00C896" />
            <KPICard title="Total Users"   value={stats?.user_count ?? 0}     icon={<Users size={20} />}         color="#00E5FF" bg="#00E5FF" />
            <KPICard title="Active Today"  value={stats?.active_today ?? 0}   icon={<Activity size={20} />}      color="#a855f7" bg="#a855f7" />
            <KPICard title="Trialing"      value={stats?.trialing_count ?? 0} icon={<Clock size={20} />}         color="#fbbf24" bg="#fbbf24" />
            <KPICard title="Inactive"      value={stats?.inactive_count ?? 0} icon={<Users size={20} />}         color="#94a3b8" bg="#94a3b8" />
            <KPICard
              title="Pending"
              value={stats?.pending_count ?? 0}
              icon={<AlertCircle size={20} />}
              color="#fbbf24"
              bg="#fbbf24"
              delta={stats?.pending_count ? `${stats.pending_count} awaiting` : undefined}
              deltaPositive={false}
            />
          </>
        )}
      </div>

      {/* Pending applications preview */}
      <div className="mb-6">
        {loading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          <PendingApplications
            orgs={pendingOrgs}
            onChanged={fetchData}
            limit={3}
            viewAllHref="/admin/pending"
          />
        )}
      </div>

      {/* Recent organisations */}
      {loading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Recent Organisations</h2>
              <p className="text-xs text-[var(--on-glass-dim)] mt-0.5">{orgs.length} total</p>
            </div>
            <Link
              href="/admin/orgs"
              className="flex items-center gap-1.5 text-xs font-bold text-[var(--on-glass-muted)] hover:text-white transition-colors"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {recentOrgs.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 size={24} className="mx-auto mb-2 text-[var(--on-glass-dim)]" />
              <p className="text-sm text-[var(--on-glass-muted)]">No organisations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--glass-border)]">
              {recentOrgs.map(org => {
                const planStyle = PLAN_STYLES[org.plan] ?? PLAN_STYLES.trial;
                const orgSt = ORG_STATUS_STYLES[org.status] ?? ORG_STATUS_STYLES.active;
                return (
                  <Link
                    key={org.id}
                    href={`/admin/orgs/${org.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--glass-05)] transition-all group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[var(--glass-10)] border border-[var(--glass-border)] flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-[var(--on-glass-muted)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate group-hover:text-[var(--primary-600)] transition-colors">{org.name}</p>
                      <p className="text-[10px] text-[var(--on-glass-dim)] mt-0.5 font-medium uppercase tracking-wider">{org.timezone}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                      <Badge label={org.plan.toUpperCase()} color={planStyle.color} bg={planStyle.bg} size="sm" />
                      <Badge label={orgSt.label} color={orgSt.color} bg={orgSt.bg} size="sm" />
                    </div>
                    <div className="text-right flex-shrink-0 w-20">
                      <p className="text-sm font-black text-white">{org.user_count}</p>
                      <p className="text-[10px] text-[var(--on-glass-dim)]">{timeAgo(org.created_at)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

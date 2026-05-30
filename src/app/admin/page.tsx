'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError, timeAgo } from '@/lib/utils';
import {
  Card, KPICard, PageHeader, Button, Badge, Skeleton, Table, EmptyState, Select,
} from '@/components/ui';
import { Building2, Users, Activity, RefreshCw, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────
interface PlatformStats {
  org_count: number;
  user_count: number;
  active_today: number;
}

interface OrgOnboarding {
  profile_set: boolean;
  ips_set: boolean;
  wa_enabled: boolean;
}

interface OrgRow {
  id: string;
  name: string;
  plan: string;
  timezone: string;
  created_at: string;
  user_count: number;
  onboarding: OrgOnboarding;
  onboarding_score: number; // 0-3
}

// ─── Plan badge colours ───────────────────────────────
const PLAN_STYLES: Record<string, { color: string; bg: string }> = {
  trial:      { color: 'var(--warning-800)', bg: 'var(--warning-100)' },
  starter:    { color: 'var(--primary-600)', bg: 'var(--primary-100)' },
  growth:     { color: 'var(--success-700)', bg: 'var(--success-100)' },
  enterprise: { color: 'var(--purple-700)',  bg: 'var(--purple-100)'  },
  suspended:  { color: 'var(--danger-800)',  bg: 'var(--danger-100)'  },
};

const PLAN_OPTIONS = [
  { value: 'trial',      label: 'Trial' },
  { value: 'starter',    label: 'Starter' },
  { value: 'growth',     label: 'Growth' },
  { value: 'enterprise', label: 'Enterprise' },
];

// ─── Onboarding dots ─────────────────────────────────
function OnboardingDots({ score, onboarding }: { score: number; onboarding: OrgOnboarding }) {
  const steps: { key: keyof OrgOnboarding; label: string }[] = [
    { key: 'profile_set', label: 'Logo uploaded' },
    { key: 'ips_set',     label: 'Office IPs set' },
    { key: 'wa_enabled',  label: 'WhatsApp on' },
  ];
  return (
    <div className="flex items-center gap-1.5" title={`${score}/3 steps complete`}>
      {steps.map((step) => (
        <span
          key={step.key}
          title={step.label}
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{
            backgroundColor: onboarding[step.key]
              ? 'var(--success-700)'
              : 'var(--gray-200)',
          }}
        />
      ))}
      <span className="text-xs text-[var(--gray-500)] ml-1">{score}/3</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────
export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats]           = useState<PlatformStats | null>(null);
  const [orgs, setOrgs]             = useState<OrgRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);
  const [showSuspended, setShowSuspended] = useState(true);

  // Guard: only platform_admin may view this page
  useEffect(() => {
    if (!authLoading && user && user.role !== 'platform_admin') {
      router.replace('/dashboard');
    }
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, orgsRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getOrgs(),
      ]);
      setStats(statsRes.data.data);
      setOrgs(orgsRes.data.data);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === 'platform_admin') {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  const handlePlanChange = async (orgId: string, plan: string) => {
    setUpdatingPlan(orgId);
    try {
      await adminApi.updatePlan(orgId, plan);
      setOrgs(prev =>
        prev.map(o => o.id === orgId ? { ...o, plan } : o)
      );
      toast.success('Plan updated');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setUpdatingPlan(null);
    }
  };

  const visibleOrgs = showSuspended
    ? orgs
    : orgs.filter(o => o.plan !== 'suspended');

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-[var(--gray-50)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--primary-600)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeader
          title="Platform Admin"
          subtitle="Global overview of all organisations on Attenda"
          actions={
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={fetchData}
              loading={loading}
            >
              Refresh
            </Button>
          }
        />

        {/* ─── Stats ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          ) : (
            <>
              <KPICard
                title="Total Organisations"
                value={stats?.org_count ?? 0}
                icon={<Building2 size={20} />}
                color="var(--primary-600)"
                bg="var(--primary-100)"
              />
              <KPICard
                title="Total Users"
                value={stats?.user_count ?? 0}
                icon={<Users size={20} />}
                color="var(--success-700)"
                bg="var(--success-100)"
              />
              <KPICard
                title="Active Today"
                value={stats?.active_today ?? 0}
                icon={<Activity size={20} />}
                color="var(--purple-700)"
                bg="var(--purple-100)"
              />
            </>
          )}
        </div>

        {/* ─── Org table ──────────────────────────────────── */}
        <Card>
          {/* Table header row */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gray-100)]">
            <div>
              <h2 className="text-base font-bold text-[var(--dark-950)]">Organisations</h2>
              {!loading && (
                <p className="text-xs text-[var(--gray-500)] mt-0.5">
                  {visibleOrgs.length} of {orgs.length} shown
                </p>
              )}
            </div>
            <button
              onClick={() => setShowSuspended(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[var(--gray-500)] hover:text-[var(--dark-950)] transition-colors px-3 py-1.5 rounded-lg border border-[var(--gray-200)] hover:bg-[var(--gray-50)]"
            >
              {showSuspended ? <EyeOff size={13} /> : <Eye size={13} />}
              {showSuspended ? 'Hide suspended' : 'Show suspended'}
            </button>
          </div>

          <Table
            headers={['Organisation', 'Plan', 'Users', 'Onboarding', 'Created', 'Change Plan']}
            loading={loading}
            emptyState={
              !loading && visibleOrgs.length === 0 ? (
                <EmptyState
                  icon={<Building2 size={24} />}
                  title="No organisations"
                  description="No organisations match the current filter."
                />
              ) : undefined
            }
          >
            {visibleOrgs.map(org => {
              const planStyle = PLAN_STYLES[org.plan] ?? PLAN_STYLES.trial;
              return (
                <tr
                  key={org.id}
                  className="border-b border-[var(--gray-100)] hover:bg-[var(--gray-50)] transition-colors"
                >
                  {/* Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--primary-100)] flex items-center justify-center flex-shrink-0">
                        <Building2 size={14} className="text-[var(--primary-600)]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--dark-950)]">{org.name}</p>
                        <p className="text-xs text-[var(--gray-500)]">{org.timezone}</p>
                      </div>
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="py-3 px-4">
                    <Badge
                      label={org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}
                      color={planStyle.color}
                      bg={planStyle.bg}
                      size="sm"
                    />
                  </td>

                  {/* Users */}
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-[var(--dark-950)]">
                      {org.user_count}
                    </span>
                  </td>

                  {/* Onboarding */}
                  <td className="py-3 px-4">
                    <OnboardingDots score={org.onboarding_score} onboarding={org.onboarding} />
                  </td>

                  {/* Created */}
                  <td className="py-3 px-4">
                    <span className="text-sm text-[var(--gray-500)]">
                      {timeAgo(org.created_at)}
                    </span>
                  </td>

                  {/* Change plan */}
                  <td className="py-3 px-4">
                    <div className="w-36">
                      <Select
                        options={PLAN_OPTIONS}
                        value={org.plan}
                        disabled={updatingPlan === org.id}
                        onChange={e => handlePlanChange(org.id, e.target.value)}
                        className="text-xs py-1.5"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>
    </div>
  );
}

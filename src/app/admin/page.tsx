'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError, timeAgo } from '@/lib/utils';
import {
  Card, KPICard, PageHeader, Button, Badge, Skeleton, Table, EmptyState, Select, Modal, Input,
} from '@/components/ui';
import {
  Building2, Users, Activity, RefreshCw, Eye, EyeOff, Plus, ChevronRight,
  Ban, CheckCircle, X, Globe, CreditCard, Clock, Mail, AlertCircle, Copy, Check,
  FileText, Tag, Calendar, ChevronDown, Pencil, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────
interface PlatformStats {
  org_count: number; user_count: number; active_today: number;
  pending_count: number; trialing_count?: number; inactive_count?: number;
}

interface OrgOnboarding { profile_set: boolean; ips_set: boolean; wa_enabled: boolean; }

interface OrgRow {
  id: string; name: string; plan: string; status: string;
  subscription_status: string; trial_started_at: string | null; trial_ends_at: string | null;
  seats_limit: number | null; features_override: Record<string, boolean> | null;
  admin_notes: string | null; billing_email: string | null;
  timezone: string; created_at: string; user_count: number;
  onboarding: OrgOnboarding; onboarding_score: number;
  contact_name?: string; contact_email?: string; company_size?: string;
}

interface OrgUser {
  id: string; name: string; email: string; role: string;
  department?: string; job_title?: string; is_active: boolean; created_at: string;
}

// ─── Style maps ───────────────────────────────────────
const PLAN_STYLES: Record<string, { color: string; bg: string }> = {
  trial:      { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
  starter:    { color: '#00C896', bg: 'rgba(0, 200, 150, 0.1)' },
  growth:     { color: '#00E5FF', bg: 'rgba(0, 229, 255, 0.1)' },
  business:   { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  enterprise: { color: '#f8fafc', bg: 'rgba(248, 250, 252, 0.1)' },
  suspended:  { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' },
};

const SUB_STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  trialing:  { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', label: 'Trialing' },
  active:    { color: '#00C896', bg: 'rgba(0, 200, 150, 0.1)', label: 'Active'   },
  inactive:  { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', label: 'Inactive' },
  suspended: { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)', label: 'Suspended'},
  defaulted: { color: '#fb7185', bg: 'rgba(251, 113, 133, 0.1)', label: 'Defaulted'},
};

const ROLE_STYLES: Record<string, { color: string; bg: string }> = {
  super_admin:    { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' },
  hr_admin:       { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  manager:        { color: '#00C896', bg: 'rgba(0, 200, 150, 0.1)' },
  employee:       { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
  platform_admin: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
};

const PLAN_OPTIONS = [
  { value: 'starter',    label: 'Starter' },
  { value: 'growth',     label: 'Growth' },
  { value: 'business',   label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
];

const ALL_FEATURES = [
  { key: 'attendance',          label: 'Attendance' },
  { key: 'leave_management',    label: 'Leave Management' },
  { key: 'shifts',              label: 'Shifts' },
  { key: 'payroll',             label: 'Payroll' },
  { key: 'whatsapp',            label: 'WhatsApp' },
  { key: 'performance_reviews', label: 'Performance Reviews' },
  { key: 'remote_work',         label: 'Remote Work' },
  { key: 'api_access',          label: 'API Access' },
  { key: 'advanced_reports',    label: 'Advanced Reports' },
  { key: 'multi_location',      label: 'Multi-Location' },
];

// ─── Helpers ──────────────────────────────────────────
function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLeft(d: string | null) {
  if (!d) return null;
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function OnboardingDots({ score, onboarding }: { score: number; onboarding: OrgOnboarding }) {
  const steps: { key: keyof OrgOnboarding; label: string }[] = [
    { key: 'profile_set', label: 'Logo uploaded' },
    { key: 'ips_set',     label: 'Office IPs set' },
    { key: 'wa_enabled',  label: 'WhatsApp on' },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {steps.map(step => (
        <span key={step.key} title={step.label} className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: onboarding[step.key] ? 'var(--success-700)' : 'var(--gray-200)' }} />
      ))}
      <span className="text-xs text-[var(--gray-500)] ml-1">{score}/3</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────
export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats]                   = useState<PlatformStats | null>(null);
  const [orgs, setOrgs]                     = useState<OrgRow[]>([]);
  const [pendingOrgs, setPendingOrgs]       = useState<OrgRow[]>([]);
  const [loading, setLoading]               = useState(true);
  const [updatingPlan, setUpdatingPlan]     = useState<string | null>(null);
  const [suspending, setSuspending]         = useState<string | null>(null);
  const [approvingId, setApprovingId]       = useState<string | null>(null);
  const [rejectingId, setRejectingId]       = useState<string | null>(null);
  const [showSuspended, setShowSuspended]   = useState(true);

  const [approveResult, setApproveResult]   = useState<{ setup_url: string; org_name: string; trial_ends_at?: string } | null>(null);
  const [copiedSetupUrl, setCopiedSetupUrl] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTz, setCreateTz]     = useState('UTC');
  const [createPlan, setCreatePlan] = useState('starter');
  const [creating, setCreating]     = useState(false);

  const [selectedOrg, setSelectedOrg]     = useState<OrgRow | null>(null);
  const [orgUsers, setOrgUsers]           = useState<OrgUser[]>([]);
  const [loadingUsers, setLoadingUsers]   = useState(false);
  const [drawerTab, setDrawerTab]         = useState<'info' | 'subscription' | 'users'>('info');

  // Subscription edit state
  const [subStatus, setSubStatus]           = useState('');
  const [subPlan, setSubPlan]               = useState('');
  const [trialEndsAt, setTrialEndsAt]       = useState('');
  const [seatsLimit, setSeatsLimit]         = useState('');
  const [billingEmail, setBillingEmail]     = useState('');
  const [adminNotes, setAdminNotes]         = useState('');
  const [featureOverrides, setFeatureOverrides] = useState<Record<string, boolean>>({});
  const [extendDays, setExtendDays]         = useState('7');
  const [savingSub, setSavingSub]           = useState(false);
  const [extendingTrial, setExtendingTrial] = useState(false);
  const [activating, setActivating]         = useState(false);

  useEffect(() => {
    if (!authLoading && user && user.role !== 'platform_admin') router.replace('/dashboard');
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
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
    if (!authLoading && user?.role === 'platform_admin') fetchData();
  }, [authLoading, user, fetchData]);

  const handlePlanChange = async (orgId: string, plan: string) => {
    setUpdatingPlan(orgId);
    try {
      await adminApi.updatePlan(orgId, plan);
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, plan } : o));
      if (selectedOrg?.id === orgId) setSelectedOrg(prev => prev ? { ...prev, plan } : prev);
      toast.success('Plan updated');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setUpdatingPlan(null);
    }
  };

  const handleSuspend = async (orgId: string) => {
    setSuspending(orgId);
    try {
      const res = await adminApi.suspendOrg(orgId);
      const updated = res.data.data;
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, ...updated } : o));
      if (selectedOrg?.id === orgId) setSelectedOrg(prev => prev ? { ...prev, ...updated } : prev);
      toast.success('Organisation updated');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSuspending(null);
    }
  };

  const handleApprove = async (orgId: string, orgName: string) => {
    setApprovingId(orgId);
    try {
      const res = await adminApi.approveOrg(orgId);
      const { setup_url, trial_ends_at } = res.data.data;
      setApproveResult({ setup_url, org_name: orgName, trial_ends_at });
      await fetchData();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (orgId: string) => {
    if (!confirm('Reject this application? This cannot be undone.')) return;
    setRejectingId(orgId);
    try {
      await adminApi.rejectOrg(orgId);
      setPendingOrgs(prev => prev.filter(o => o.id !== orgId));
      toast.success('Application rejected');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setRejectingId(null);
    }
  };

  const handleCreateOrg = async () => {
    if (!createName.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      await adminApi.createOrg({ name: createName.trim(), timezone: createTz, plan: createPlan });
      toast.success('Organisation created');
      setShowCreate(false); setCreateName(''); setCreateTz('UTC'); setCreatePlan('starter');
      fetchData();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setCreating(false);
    }
  };

  const openOrgDetail = async (org: OrgRow) => {
    setSelectedOrg(org);
    setDrawerTab('info');
    // Pre-fill subscription form
    setSubStatus(org.subscription_status || 'active');
    setSubPlan(org.plan || 'starter');
    setTrialEndsAt(org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : '');
    setSeatsLimit(org.seats_limit?.toString() || '');
    setBillingEmail(org.billing_email || '');
    setAdminNotes(org.admin_notes || '');
    setFeatureOverrides(org.features_override || {});
    setLoadingUsers(true);
    try {
      const res = await adminApi.getOrgUsers(org.id);
      setOrgUsers(res.data.data);
    } catch { setOrgUsers([]); } finally { setLoadingUsers(false); }
  };

  const handleSaveSubscription = async () => {
    if (!selectedOrg) return;
    setSavingSub(true);
    try {
      const res = await adminApi.updateSubscription(selectedOrg.id, {
        subscription_status: subStatus,
        plan:                subPlan,
        trial_ends_at:       trialEndsAt || null,
        seats_limit:         seatsLimit ? Number(seatsLimit) : null,
        billing_email:       billingEmail || null,
        admin_notes:         adminNotes || null,
        features_override:   Object.keys(featureOverrides).length > 0 ? featureOverrides : null,
      });
      const updated = res.data.data;
      setSelectedOrg(prev => prev ? { ...prev, ...updated } : prev);
      setOrgs(prev => prev.map(o => o.id === selectedOrg.id ? { ...o, ...updated } : o));
      toast.success('Subscription updated');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingSub(false);
    }
  };

  const handleExtendTrial = async () => {
    if (!selectedOrg) return;
    const days = Number(extendDays);
    if (!days || days < 1) { toast.error('Enter a valid number of days'); return; }
    setExtendingTrial(true);
    try {
      const res = await adminApi.extendTrial(selectedOrg.id, days);
      const updated = res.data.data;
      setSelectedOrg(prev => prev ? { ...prev, ...updated } : prev);
      setOrgs(prev => prev.map(o => o.id === selectedOrg.id ? { ...o, ...updated } : o));
      setTrialEndsAt(updated.trial_ends_at ? updated.trial_ends_at.slice(0, 10) : '');
      setSubStatus(updated.subscription_status);
      toast.success(`Trial extended by ${days} days`);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setExtendingTrial(false);
    }
  };

  const handleActivate = async () => {
    if (!selectedOrg) return;
    setActivating(true);
    try {
      const res = await adminApi.activateOrg(selectedOrg.id);
      const updated = res.data.data;
      setSelectedOrg(prev => prev ? { ...prev, ...updated } : prev);
      setOrgs(prev => prev.map(o => o.id === selectedOrg.id ? { ...o, ...updated } : o));
      setSubStatus(updated.subscription_status);
      toast.success('Organisation activated');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActivating(false);
    }
  };

  const copySetupUrl = () => {
    if (!approveResult) return;
    navigator.clipboard.writeText(approveResult.setup_url);
    setCopiedSetupUrl(true);
    setTimeout(() => setCopiedSetupUrl(false), 2000);
  };

  const visibleOrgs = showSuspended ? orgs : orgs.filter(o => o.status !== 'suspended');

  if (authLoading || (!user && !authLoading)) {
    return (
    <div className="min-h-screen bg-[#040D12] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
  <div className="min-h-screen bg-[#040D12] text-slate-300">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeader
          title="Platform Admin"
          subtitle="Global SaaS management — organisations, plans, blog"
          actions={
            <div className="flex items-center gap-2">
          <Link href="/admin/blog" className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-glass rounded-lg text-xs font-medium text-slate-400 bg-slate-800/40 hover:bg-slate-800/60 transition-colors">
                <FileText size={13} /> Blog
              </Link>
          <Link href="/admin/plans" className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-glass rounded-lg text-xs font-medium text-slate-400 bg-slate-800/40 hover:bg-slate-800/60 transition-colors">
                <Tag size={13} /> Plans
              </Link>
              <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>Refresh</Button>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>New Org</Button>
            </div>
          }
        />

        {/* ─── Stats ─────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
          <KPICard title="Active Orgs"   value={stats?.org_count ?? 0}       icon={<Building2 size={18} />} color="#00C896" bg="rgba(0, 200, 150, 0.1)" />
          <KPICard title="Total Users"   value={stats?.user_count ?? 0}      icon={<Users size={18} />}     color="#00E5FF" bg="rgba(0, 229, 255, 0.1)" />
          <KPICard title="Active Today"  value={stats?.active_today ?? 0}    icon={<Activity size={18} />}  color="#a855f7" bg="rgba(168, 85, 247, 0.1)" />
          <KPICard title="Trialing"      value={stats?.trialing_count ?? 0}  icon={<Clock size={18} />}     color="#fbbf24" bg="rgba(251, 191, 36, 0.1)" />
          <KPICard title="Inactive"      value={stats?.inactive_count ?? 0}  icon={<Shield size={18} />}    color="#94a3b8" bg="rgba(148, 163, 184, 0.1)" />
          <KPICard title="Pending"       value={stats?.pending_count ?? 0}   icon={<AlertCircle size={18} />} color="#fbbf24" bg="rgba(251, 191, 36, 0.1)"
                delta={stats?.pending_count ? `${stats.pending_count} awaiting` : undefined} deltaPositive={false} />
            </>
          )}
        </div>

        {/* ─── Pending Approvals ─────────────── */}
        {!loading && pendingOrgs.length > 0 && (
      <Card className="glass-card mb-6 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-glass">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={16} className="text-amber-400" />
              </div>
              <div>
            <h2 className="text-sm font-bold text-slate-100">Pending Applications</h2>
            <p className="text-xs text-slate-500 mt-0.5">{pendingOrgs.length} awaiting review</p>
              </div>
          <span className="ml-auto bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full px-2.5 py-1 border border-amber-500/20">{pendingOrgs.length}</span>
            </div>
        <div className="divide-y divide-glass">
              {pendingOrgs.map(org => (
            <div key={org.id} className="flex items-start gap-4 px-5 py-4 hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
                <Building2 size={16} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-200">{org.name}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  {org.contact_name && <span className="text-xs text-slate-400 flex items-center gap-1"><Users size={10} /> {org.contact_name}</span>}
                  {org.contact_email && <span className="text-xs text-slate-400 flex items-center gap-1"><Mail size={10} /> {org.contact_email}</span>}
                  {org.company_size && <span className="text-xs text-slate-400">{org.company_size} employees</span>}
                  <span className="text-xs text-slate-500">{timeAgo(org.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="success" icon={<CheckCircle size={13} />} loading={approvingId === org.id} onClick={() => handleApprove(org.id, org.name)}>Approve</Button>
                    <Button size="sm" variant="danger"  icon={<X size={13} />}            loading={rejectingId === org.id} onClick={() => handleReject(org.id)}>Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ─── Active Org Table ──────────────── */}
    <Card className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-glass">
            <div>
          <h2 className="text-base font-bold text-slate-100">Organisations</h2>
          {!loading && <p className="text-xs text-slate-500 mt-0.5">{visibleOrgs.length} of {orgs.length} shown</p>}
            </div>
            <button onClick={() => setShowSuspended(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors px-3 py-1.5 rounded-lg border border-glass bg-slate-800/40 hover:bg-slate-800/60">
              {showSuspended ? <EyeOff size={13} /> : <Eye size={13} />}
              {showSuspended ? 'Hide suspended' : 'Show suspended'}
            </button>
          </div>

          <Table
            headers={['Organisation', 'Plan', 'Status', 'Trial Ends', 'Users', 'Actions']}
            loading={loading}
            emptyState={!loading && visibleOrgs.length === 0 ? <EmptyState icon={<Building2 size={24} />} title="No organisations" description="No organisations match the current filter." /> : undefined}
          >
            {visibleOrgs.map(org => {
              const planStyle  = PLAN_STYLES[org.plan] ?? PLAN_STYLES.trial;
              const subStyle   = SUB_STATUS_STYLES[org.subscription_status] ?? SUB_STATUS_STYLES.active;
              const days       = daysLeft(org.trial_ends_at);
              return (
                <tr key={org.id} className="border-b border-glass hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 text-slate-300">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                        <Building2 size={14} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{org.name}</p>
                        <p className="text-xs text-slate-500">{org.timezone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge label={org.plan.charAt(0).toUpperCase() + org.plan.slice(1)} color={planStyle.color} bg={planStyle.bg} size="sm" />
                  </td>
                  <td className="py-3 px-4">
                    <Badge label={subStyle.label} color={subStyle.color} bg={subStyle.bg} size="sm" />
                  </td>
                  <td className="py-3 px-4">
                    {org.trial_ends_at ? (
                      <span className={`text-xs font-medium ${days !== null && days <= 3 ? 'text-rose-400' : days !== null && days <= 7 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {days !== null && days <= 0 ? 'Expired' : days !== null ? `${days}d left` : fmt(org.trial_ends_at)}
                      </span>
                    ) : <span className="text-xs text-slate-600">—</span>}
                  </td>
                  <td className="py-3 px-4"><span className="text-sm font-medium text-slate-300">{org.user_count}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openOrgDetail(org)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-200 transition-colors" title="View details">
                        <ChevronRight size={15} />
                      </button>
                      <button onClick={() => handleSuspend(org.id)} disabled={suspending === org.id}
                        className={`p-1.5 rounded-lg transition-colors ${org.status === 'suspended' ? 'hover:bg-emerald-500/10 text-emerald-400' : 'hover:bg-rose-500/10 text-rose-400'}`}
                        title={org.status === 'suspended' ? 'Reactivate' : 'Suspend'}>
                        {org.status === 'suspended' ? <CheckCircle size={15} /> : <Ban size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>

      {/* ─── Approve Result Modal ────────────── */}
      <Modal isOpen={!!approveResult} onClose={() => { setApproveResult(null); setCopiedSetupUrl(false); }} title="Organisation Approved" size="sm">
        {approveResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-400">{approveResult.org_name} is now active!</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">Share the setup link with the org admin. Trial ends {fmt(approveResult.trial_ends_at ?? null)}.</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Admin Setup Link</label>
              <div className="flex gap-2">
                <input readOnly value={approveResult.setup_url}
                  className="flex-1 px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-xs font-mono text-slate-200 truncate" />
                <button onClick={copySetupUrl}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
                  {copiedSetupUrl ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">This link expires in 7 days.</p>
            </div>
            <Button className="w-full" onClick={() => { setApproveResult(null); setCopiedSetupUrl(false); }}>Done</Button>
          </div>
        )}
      </Modal>

      {/* ─── Create Org Modal ────────────────── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Organisation" size="sm">
        <div className="space-y-4">
          <Input label="Organisation Name" placeholder="Acme Corp" value={createName} onChange={e => setCreateName(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Timezone</label>
            <input type="text" className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" placeholder="UTC" value={createTz} onChange={e => setCreateTz(e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">e.g. Asia/Karachi, America/New_York</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Plan</label>
            <Select options={PLAN_OPTIONS} value={createPlan} onChange={e => setCreatePlan(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="flex-1" loading={creating} onClick={handleCreateOrg}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Org Detail Drawer ───────────────── */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedOrg(null)} />
          <div className="w-full max-w-lg bg-[#040D12] h-full shadow-2xl flex flex-col overflow-hidden slide-in-right border-l border-glass">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-glass bg-slate-800/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <Building2 size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-100">{selectedOrg.name}</p>
                  <p className="text-xs text-slate-500">ID: {selectedOrg.id.slice(0, 8)}…</p>
                </div>
              </div>
              <button onClick={() => setSelectedOrg(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-glass bg-slate-800/10">
              {(['info', 'subscription', 'users'] as const).map(tab => (
                <button key={tab} onClick={() => setDrawerTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-all relative
                    ${drawerTab === tab ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                  {tab === 'subscription' ? 'Subscription' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {drawerTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* ── Info tab ─── */}
              {drawerTab === 'info' && (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: <CreditCard size={13} />, label: 'Plan',     val: selectedOrg.plan },
                      { icon: <Globe size={13} />,       label: 'Timezone', val: selectedOrg.timezone },
                      { icon: <Users size={13} />,       label: 'Users',    val: String(selectedOrg.user_count) },
                      { icon: <Calendar size={13} />,    label: 'Created',  val: fmt(selectedOrg.created_at) },
                      { icon: <Mail size={13} />,        label: 'Contact',  val: selectedOrg.contact_email || '—' },
                      { icon: <Activity size={13} />,    label: 'Size',     val: selectedOrg.company_size || '—' },
                    ].map(item => (
                      <div key={item.label} className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/40 border border-glass">
                        <span className="text-slate-600 mt-0.5">{item.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">{item.label}</p>
                          <p className="text-xs font-medium text-slate-200 truncate">{item.val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Onboarding</p>
                    <OnboardingDots score={selectedOrg.onboarding_score} onboarding={selectedOrg.onboarding} />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => handleSuspend(selectedOrg.id)} disabled={suspending === selectedOrg.id}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5
                        ${selectedOrg.status === 'suspended' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'}`}>
                      {selectedOrg.status === 'suspended' ? <><CheckCircle size={12} /> Reactivate</> : <><Ban size={12} /> Suspend</>}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Subscription tab ─── */}
              {drawerTab === 'subscription' && (
                <div className="p-5 space-y-5">
                  {/* Current status display */}
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-glass bg-slate-800/40">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500">Current status</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          label={(SUB_STATUS_STYLES[selectedOrg.subscription_status]?.label) || selectedOrg.subscription_status}
                          color={(SUB_STATUS_STYLES[selectedOrg.subscription_status]?.color) || '#94a3b8'}
                          bg={(SUB_STATUS_STYLES[selectedOrg.subscription_status]?.bg) || 'rgba(148, 163, 184, 0.1)'}
                          size="sm"
                        />
                        {selectedOrg.trial_ends_at && (
                          <span className="text-xs text-slate-500">
                            Trial ends {fmt(selectedOrg.trial_ends_at)}
                            {daysLeft(selectedOrg.trial_ends_at) !== null && (
                              <span className={daysLeft(selectedOrg.trial_ends_at)! <= 3 ? ' text-rose-400 font-semibold' : ''}>
                                {' '}({daysLeft(selectedOrg.trial_ends_at)}d left)
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {(selectedOrg.subscription_status === 'inactive' || selectedOrg.subscription_status === 'defaulted') && (
                      <button onClick={handleActivate} disabled={activating}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 border border-emerald-500/20">
                        {activating ? <span className="w-3 h-3 rounded-full border border-emerald-400 border-t-transparent animate-spin" /> : <CheckCircle size={12} />}
                        Activate
                      </button>
                    )}
                  </div>

                  {/* Extend trial */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Extend Trial</p>
                    <div className="flex gap-2">
                      <input type="number" min="1" max="365" value={extendDays} onChange={e => setExtendDays(e.target.value)}
                        className="flex-1 px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" placeholder="Days to add" />
                      <button onClick={handleExtendTrial} disabled={extendingTrial}
                        className="px-4 py-2 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/20 transition-all flex items-center gap-1.5 border border-amber-500/20">
                        {extendingTrial ? <span className="w-3 h-3 rounded-full border border-amber-400 border-t-transparent animate-spin" /> : <Calendar size={12} />}
                        Extend
                      </button>
                    </div>
                  </div>

                  {/* Edit fields */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Subscription Status</label>
                        <select value={subStatus} onChange={e => setSubStatus(e.target.value)}
                          className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50">
                          {Object.entries(SUB_STATUS_STYLES).map(([k, v]) => (
                            <option key={k} value={k} className="bg-[#040D12] text-slate-100">{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Plan</label>
                        <Select options={PLAN_OPTIONS} value={subPlan} onChange={e => setSubPlan(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Trial Ends</label>
                        <input type="date" value={trialEndsAt} onChange={e => setTrialEndsAt(e.target.value)}
                          className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Seats Limit</label>
                        <input type="number" min="0" value={seatsLimit} onChange={e => setSeatsLimit(e.target.value)} placeholder="Unlimited"
                          className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Billing Email</label>
                      <input type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} placeholder="billing@company.com"
                        className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Admin Notes</label>
                      <textarea rows={2} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes..."
                        className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50 resize-none" />
                    </div>
                  </div>

                  {/* Feature overrides */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Feature Overrides</p>
                    <p className="text-xs text-slate-600 mb-3">Override individual features for this org. Uncheck to remove override and fall back to plan defaults.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_FEATURES.map(f => {
                        const isOverridden = f.key in featureOverrides;
                        const val = featureOverrides[f.key] ?? false;
                        return (
                          <label key={f.key} className="flex items-center gap-2 p-2 rounded-lg border border-glass cursor-pointer hover:bg-white/5 transition-colors">
                            <input type="checkbox" checked={isOverridden && val}
                              onChange={e => {
                                if (e.target.checked) {
                                  setFeatureOverrides(prev => ({ ...prev, [f.key]: true }));
                                } else {
                                  setFeatureOverrides(prev => {
                                    const n = { ...prev };
                                    delete n[f.key];
                                    return n;
                                  });
                                }
                              }}
                              className="w-3.5 h-3.5 rounded bg-slate-800 border-glass checked:bg-emerald-500 accent-emerald-500"
                            />
                            <span className="text-xs text-slate-300">{f.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <Button className="w-full" loading={savingSub} onClick={handleSaveSubscription} icon={<Pencil size={14} />}>
                    Save Subscription Changes
                  </Button>
                </div>
              )}

              {/* ── Users tab ─── */}
              {drawerTab === 'users' && (
                <div>
                  <div className="px-5 py-3 border-b border-glass bg-slate-800/10">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Users ({orgUsers.length})</p>
                  </div>
                  {loadingUsers ? (
                    <div className="p-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
                  ) : orgUsers.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-600">No users found</div>
                  ) : (
                    <div className="divide-y divide-glass">
                      {orgUsers.map(u => {
                        const rs = ROLE_STYLES[u.role] ?? ROLE_STYLES.employee;
                        return (
                          <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                              <span className="text-xs font-bold text-emerald-400">{u.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">{u.name}</p>
                              <p className="text-xs text-slate-500 truncate">{u.email}</p>
                            </div>
                            <Badge label={u.role.replace(/_/g, ' ')} color={rs.color} bg={rs.bg} size="sm" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

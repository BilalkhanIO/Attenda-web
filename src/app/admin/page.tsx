'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError, timeAgo } from '@/lib/utils';
import {
  Card, KPICard, PageHeader, Button, Badge, Skeleton, Table, EmptyState, Select, Modal, Input,
} from '@/components/ui';
import {
  Building2, Users, Activity, RefreshCw, Eye, EyeOff, Plus, ChevronRight,
  Ban, CheckCircle, X, Globe, CreditCard, Clock, Mail, AlertCircle, Copy, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────
interface PlatformStats {
  org_count: number;
  user_count: number;
  active_today: number;
  pending_count: number;
}

interface OrgOnboarding { profile_set: boolean; ips_set: boolean; wa_enabled: boolean; }

interface OrgRow {
  id: string;
  name: string;
  plan: string;
  status: string;
  timezone: string;
  created_at: string;
  user_count: number;
  onboarding: OrgOnboarding;
  onboarding_score: number;
  contact_name?: string;
  contact_email?: string;
  company_size?: string;
}

interface OrgUser {
  id: string; name: string; email: string; role: string;
  department?: string; job_title?: string; is_active: boolean; created_at: string;
}

// ─── Style maps ───────────────────────────────────────
const PLAN_STYLES: Record<string, { color: string; bg: string }> = {
  trial:      { color: 'var(--warning-800)', bg: 'var(--warning-100)' },
  starter:    { color: 'var(--primary-600)', bg: 'var(--primary-100)' },
  growth:     { color: 'var(--success-700)', bg: 'var(--success-100)' },
  enterprise: { color: 'var(--purple-700)',  bg: 'var(--purple-100)'  },
  suspended:  { color: 'var(--danger-800)',  bg: 'var(--danger-100)'  },
};
const ROLE_STYLES: Record<string, { color: string; bg: string }> = {
  super_admin:    { color: 'var(--danger-800)',  bg: 'var(--danger-100)'  },
  hr_admin:       { color: 'var(--purple-700)',  bg: 'var(--purple-100)'  },
  manager:        { color: 'var(--primary-600)', bg: 'var(--primary-100)' },
  employee:       { color: 'var(--gray-600)',    bg: 'var(--gray-100)'    },
  platform_admin: { color: 'var(--warning-800)', bg: 'var(--warning-100)' },
};

const PLAN_OPTIONS = [
  { value: 'trial', label: 'Trial' }, { value: 'starter', label: 'Starter' },
  { value: 'growth', label: 'Growth' }, { value: 'enterprise', label: 'Enterprise' },
];

// ─── Helpers ──────────────────────────────────────────
function OnboardingDots({ score, onboarding }: { score: number; onboarding: OrgOnboarding }) {
  const steps: { key: keyof OrgOnboarding; label: string }[] = [
    { key: 'profile_set', label: 'Logo uploaded' }, { key: 'ips_set', label: 'Office IPs set' }, { key: 'wa_enabled', label: 'WhatsApp on' },
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

  // Approve result
  const [approveResult, setApproveResult]   = useState<{ setup_url: string; org_name: string } | null>(null);
  const [copiedSetupUrl, setCopiedSetupUrl] = useState(false);

  // Create org modal
  const [showCreate, setShowCreate]   = useState(false);
  const [createName, setCreateName]   = useState('');
  const [createTz, setCreateTz]       = useState('UTC');
  const [createPlan, setCreatePlan]   = useState('trial');
  const [creating, setCreating]       = useState(false);

  // Org detail drawer
  const [selectedOrg, setSelectedOrg]   = useState<OrgRow | null>(null);
  const [orgUsers, setOrgUsers]         = useState<OrgUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

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
      await adminApi.suspendOrg(orgId);
      await fetchData();
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
      const { setup_url } = res.data.data;
      setApproveResult({ setup_url, org_name: orgName });
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
      setShowCreate(false); setCreateName(''); setCreateTz('UTC'); setCreatePlan('trial');
      fetchData();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setCreating(false);
    }
  };

  const openOrgDetail = async (org: OrgRow) => {
    setSelectedOrg(org); setLoadingUsers(true);
    try {
      const res = await adminApi.getOrgUsers(org.id);
      setOrgUsers(res.data.data);
    } catch { setOrgUsers([]); } finally { setLoadingUsers(false); }
  };

  const copySetupUrl = () => {
    if (!approveResult) return;
    navigator.clipboard.writeText(approveResult.setup_url);
    setCopiedSetupUrl(true);
    setTimeout(() => setCopiedSetupUrl(false), 2000);
  };

  const visibleOrgs = showSuspended ? orgs : orgs.filter(o => o.plan !== 'suspended');

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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>Refresh</Button>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>New Org</Button>
            </div>
          }
        />

        {/* ─── Stats ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <KPICard title="Active Orgs"   value={stats?.org_count ?? 0}     icon={<Building2 size={20} />} color="var(--primary-600)" bg="var(--primary-100)" />
              <KPICard title="Total Users"   value={stats?.user_count ?? 0}    icon={<Users size={20} />}    color="var(--success-700)" bg="var(--success-100)" />
              <KPICard title="Active Today"  value={stats?.active_today ?? 0}  icon={<Activity size={20} />} color="var(--purple-700)"  bg="var(--purple-100)" />
              <KPICard title="Pending"       value={stats?.pending_count ?? 0} icon={<Clock size={20} />}    color="var(--warning-800)" bg="var(--warning-100)"
                delta={stats?.pending_count ? `${stats.pending_count} awaiting review` : undefined}
                deltaPositive={false}
              />
            </>
          )}
        </div>

        {/* ─── Pending Approvals ──────────────────────────── */}
        {!loading && pendingOrgs.length > 0 && (
          <Card className="mb-6">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--gray-100)]">
              <div className="w-8 h-8 rounded-lg bg-[var(--warning-100)] flex items-center justify-center flex-shrink-0">
                <AlertCircle size={16} className="text-[var(--warning-800)]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--dark-950)]">Pending Applications</h2>
                <p className="text-xs text-[var(--gray-500)] mt-0.5">{pendingOrgs.length} organisation{pendingOrgs.length !== 1 ? 's' : ''} awaiting review</p>
              </div>
              <span className="ml-auto bg-[var(--warning-100)] text-[var(--warning-800)] text-xs font-bold rounded-full px-2.5 py-1">
                {pendingOrgs.length}
              </span>
            </div>
            <div className="divide-y divide-[var(--gray-100)]">
              {pendingOrgs.map(org => (
                <div key={org.id} className="flex items-start gap-4 px-5 py-4 hover:bg-[var(--gray-50)] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-[var(--warning-100)] flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-[var(--warning-800)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--dark-950)]">{org.name}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                      {org.contact_name && (
                        <span className="text-xs text-[var(--gray-500)] flex items-center gap-1">
                          <Users size={10} /> {org.contact_name}
                        </span>
                      )}
                      {org.contact_email && (
                        <span className="text-xs text-[var(--gray-500)] flex items-center gap-1">
                          <Mail size={10} /> {org.contact_email}
                        </span>
                      )}
                      {org.company_size && (
                        <span className="text-xs text-[var(--gray-500)]">{org.company_size} employees</span>
                      )}
                      <span className="text-xs text-[var(--gray-400)]">{timeAgo(org.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="success"
                      icon={<CheckCircle size={13} />}
                      loading={approvingId === org.id}
                      onClick={() => handleApprove(org.id, org.name)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<X size={13} />}
                      loading={rejectingId === org.id}
                      onClick={() => handleReject(org.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ─── Active Org table ───────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gray-100)]">
            <div>
              <h2 className="text-base font-bold text-[var(--dark-950)]">Organisations</h2>
              {!loading && <p className="text-xs text-[var(--gray-500)] mt-0.5">{visibleOrgs.length} of {orgs.length} shown</p>}
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
            headers={['Organisation', 'Plan', 'Users', 'Onboarding', 'Created', 'Change Plan', 'Actions']}
            loading={loading}
            emptyState={!loading && visibleOrgs.length === 0 ? <EmptyState icon={<Building2 size={24} />} title="No organisations" description="No organisations match the current filter." /> : undefined}
          >
            {visibleOrgs.map(org => {
              const planStyle  = PLAN_STYLES[org.plan] ?? PLAN_STYLES.trial;
              const isSuspended = org.plan === 'suspended';
              return (
                <tr key={org.id} className="border-b border-[var(--gray-100)] hover:bg-[var(--gray-50)] transition-colors">
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
                  <td className="py-3 px-4">
                    <Badge label={org.plan.charAt(0).toUpperCase() + org.plan.slice(1)} color={planStyle.color} bg={planStyle.bg} size="sm" />
                  </td>
                  <td className="py-3 px-4"><span className="text-sm font-medium text-[var(--dark-950)]">{org.user_count}</span></td>
                  <td className="py-3 px-4"><OnboardingDots score={org.onboarding_score} onboarding={org.onboarding} /></td>
                  <td className="py-3 px-4"><span className="text-sm text-[var(--gray-500)]">{timeAgo(org.created_at)}</span></td>
                  <td className="py-3 px-4">
                    <div className="w-36">
                      <Select options={PLAN_OPTIONS} value={isSuspended ? 'trial' : org.plan} disabled={updatingPlan === org.id || isSuspended}
                        onChange={e => handlePlanChange(org.id, e.target.value)} className="text-xs py-1.5" />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openOrgDetail(org)} className="p-1.5 rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-500)] hover:text-[var(--dark-950)] transition-colors" title="View details">
                        <ChevronRight size={15} />
                      </button>
                      <button onClick={() => handleSuspend(org.id)} disabled={suspending === org.id}
                        className={`p-1.5 rounded-lg transition-colors ${isSuspended ? 'hover:bg-[var(--success-100)] text-[var(--success-700)]' : 'hover:bg-[var(--danger-100)] text-[var(--danger-700)]'}`}
                        title={isSuspended ? 'Reactivate' : 'Suspend'}>
                        {isSuspended ? <CheckCircle size={15} /> : <Ban size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </div>

      {/* ─── Approve Result Modal ─────────────────────────── */}
      <Modal isOpen={!!approveResult} onClose={() => { setApproveResult(null); setCopiedSetupUrl(false); }} title="Organisation Approved" size="sm">
        {approveResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--success-100)] border border-[var(--success-200)]">
              <CheckCircle size={20} className="text-[var(--success-700)] flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-[var(--success-700)]">{approveResult.org_name} is now active!</p>
                <p className="text-xs text-[var(--success-700)]/70 mt-0.5">Share the setup link below with the organisation admin.</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--gray-500)] mb-1.5 uppercase tracking-wide">Admin Setup Link</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={approveResult.setup_url}
                  className="flex-1 px-3 py-2 border border-[var(--gray-200)] rounded-lg text-xs font-mono bg-[var(--gray-50)] text-[var(--dark-950)] truncate"
                />
                <button
                  onClick={copySetupUrl}
                  className="px-3 py-2 bg-[var(--primary-600)] hover:bg-[var(--primary-900)] text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {copiedSetupUrl ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <p className="text-xs text-[var(--gray-500)] mt-1.5">This link expires in 7 days.</p>
            </div>
            <Button className="w-full" onClick={() => { setApproveResult(null); setCopiedSetupUrl(false); }}>Done</Button>
          </div>
        )}
      </Modal>

      {/* ─── Create Org Modal ─────────────────────────────── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Organisation" size="sm">
        <div className="space-y-4">
          <Input label="Organisation Name" placeholder="Acme Corp" value={createName} onChange={e => setCreateName(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-[var(--dark-950)] mb-1.5">Timezone</label>
            <input type="text" className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]" placeholder="UTC" value={createTz} onChange={e => setCreateTz(e.target.value)} />
            <p className="text-xs text-[var(--gray-500)] mt-1">e.g. Asia/Karachi, America/New_York</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--dark-950)] mb-1.5">Plan</label>
            <Select options={PLAN_OPTIONS} value={createPlan} onChange={e => setCreatePlan(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="flex-1" loading={creating} onClick={handleCreateOrg}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Org Detail Drawer ────────────────────────────── */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelectedOrg(null)} />
          <div className="w-full max-w-md bg-white h-full shadow-xl flex flex-col overflow-hidden slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gray-100)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-100)] flex items-center justify-center">
                  <Building2 size={18} className="text-[var(--primary-600)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--dark-950)]">{selectedOrg.name}</p>
                  <p className="text-xs text-[var(--gray-500)]">ID: {selectedOrg.id.slice(0, 8)}…</p>
                </div>
              </div>
              <button onClick={() => setSelectedOrg(null)} className="p-1.5 rounded-lg hover:bg-[var(--gray-100)]">
                <X size={16} className="text-[var(--gray-500)]" />
              </button>
            </div>
            <div className="px-5 py-4 border-b border-[var(--gray-100)] grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2">
                <CreditCard size={14} className="text-[var(--gray-400)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--gray-500)]">Plan</p>
                  <Badge label={selectedOrg.plan.charAt(0).toUpperCase() + selectedOrg.plan.slice(1)} color={(PLAN_STYLES[selectedOrg.plan] ?? PLAN_STYLES.trial).color} bg={(PLAN_STYLES[selectedOrg.plan] ?? PLAN_STYLES.trial).bg} size="sm" />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Globe size={14} className="text-[var(--gray-400)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--gray-500)]">Timezone</p>
                  <p className="text-xs font-medium text-[var(--dark-950)]">{selectedOrg.timezone}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users size={14} className="text-[var(--gray-400)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--gray-500)]">Users</p>
                  <p className="text-xs font-medium text-[var(--dark-950)]">{selectedOrg.user_count}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Activity size={14} className="text-[var(--gray-400)] mt-0.5" />
                <div>
                  <p className="text-xs text-[var(--gray-500)]">Onboarding</p>
                  <OnboardingDots score={selectedOrg.onboarding_score} onboarding={selectedOrg.onboarding} />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-b border-[var(--gray-100)]">
              <p className="text-xs font-semibold text-[var(--gray-500)] uppercase tracking-wide mb-2">Change Plan</p>
              <div className="flex gap-2">
                <Select options={PLAN_OPTIONS} value={selectedOrg.plan === 'suspended' ? 'trial' : selectedOrg.plan} disabled={updatingPlan === selectedOrg.id || selectedOrg.plan === 'suspended'}
                  onChange={e => handlePlanChange(selectedOrg.id, e.target.value)} className="flex-1 text-xs" />
                <button onClick={() => handleSuspend(selectedOrg.id)} disabled={suspending === selectedOrg.id}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${selectedOrg.plan === 'suspended' ? 'bg-[var(--success-100)] text-[var(--success-700)]' : 'bg-[var(--danger-100)] text-[var(--danger-700)]'}`}>
                  {selectedOrg.plan === 'suspended' ? <><CheckCircle size={12} /> Reactivate</> : <><Ban size={12} /> Suspend</>}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-3 border-b border-[var(--gray-100)]">
                <p className="text-xs font-semibold text-[var(--gray-500)] uppercase tracking-wide">Users ({orgUsers.length})</p>
              </div>
              {loadingUsers ? (
                <div className="p-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              ) : orgUsers.length === 0 ? (
                <div className="py-12 text-center text-sm text-[var(--gray-500)]">No users found</div>
              ) : (
                <div className="divide-y divide-[var(--gray-100)]">
                  {orgUsers.map(u => {
                    const rs = ROLE_STYLES[u.role] ?? ROLE_STYLES.employee;
                    return (
                      <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--primary-100)] flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[var(--primary-600)]">{u.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--dark-950)] truncate">{u.name}</p>
                          <p className="text-xs text-[var(--gray-500)] truncate">{u.email}</p>
                        </div>
                        <Badge label={u.role.replace(/_/g, ' ')} color={rs.color} bg={rs.bg} size="sm" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

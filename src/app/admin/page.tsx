'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { getApiError, timeAgo } from '@/lib/utils';
import {
  Card, KPICard, PageHeader, Button, Badge, Skeleton, Table, EmptyState,
  Select, Modal, Input, ConfirmDialog,
} from '@/components/ui';
import type { PlanDefinition } from '@/types';
import {
  AdminOrg, PlatformStats, PLAN_STYLES, ORG_STATUS_STYLES, SUB_STATUS_STYLES,
  fmtDate, daysLeft,
} from '@/lib/admin-shared';
import {
  Building2, Users, Activity, RefreshCw, Eye, EyeOff, Plus,
  Ban, CheckCircle, X, AlertCircle, Copy, Check, Mail, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [pendingOrgs, setPendingOrgs] = useState<AdminOrg[]>([]);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [suspending, setSuspending] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminOrg | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [showSuspended, setShowSuspended] = useState(true);

  const [approveResult, setApproveResult] = useState<{ setup_url: string; org_name: string; trial_ends_at?: string } | null>(null);
  const [copiedSetupUrl, setCopiedSetupUrl] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTz, setCreateTz] = useState('UTC');
  const [createPlan, setCreatePlan] = useState('starter');
  const [creating, setCreating] = useState(false);

  const planOptions = plans
    .filter(p => p.is_active)
    .map(p => ({ value: p.id, label: p.display_name }));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, orgsRes, pendingRes, plansRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getOrgs(),
        adminApi.getPendingOrgs(),
        adminApi.getPlans(),
      ]);
      setStats(statsRes.data.data);
      setOrgs(orgsRes.data.data);
      setPendingOrgs(pendingRes.data.data);
      const loadedPlans: PlanDefinition[] = plansRes.data.data || [];
      setPlans(loadedPlans);
      if (loadedPlans.length && !loadedPlans.find(p => p.id === createPlan)) {
        setCreatePlan(loadedPlans[0].id);
      }
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSuspend = async (orgId: string) => {
    setSuspending(orgId);
    try {
      const res = await adminApi.suspendOrg(orgId);
      const updated = res.data.data;
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, ...updated } : o));
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

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejectingId(rejectTarget.id);
    try {
      await adminApi.rejectOrg(rejectTarget.id);
      setPendingOrgs(prev => prev.filter(o => o.id !== rejectTarget.id));
      toast.success('Application rejected');
      setRejectTarget(null);
      fetchData();
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
      setShowCreate(false);
      setCreateName('');
      setCreateTz('UTC');
      fetchData();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setCreating(false);
    }
  };

  const copySetupUrl = () => {
    if (!approveResult) return;
    navigator.clipboard.writeText(approveResult.setup_url);
    setCopiedSetupUrl(true);
    setTimeout(() => setCopiedSetupUrl(false), 2000);
  };

  const visibleOrgs = showSuspended ? orgs : orgs.filter(o => o.status !== 'suspended');

  return (
    <>
      <PageHeader
        title="Platform Dashboard"
        subtitle="Organisations, subscriptions, and approvals"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              New Org
            </Button>
          </div>
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

      {/* Pending Applications */}
      {!loading && pendingOrgs.length > 0 && (
        <div id="pending" className="scroll-mt-24 mb-6">
          <Card className="overflow-hidden border-[var(--warning-500)]/20 bg-[var(--warning-500)]/5">
            <div className="flex items-center gap-4 px-6 py-5 border-b border-[var(--glass-border)]">
              <div className="w-10 h-10 rounded-2xl bg-[var(--warning-500)]/15 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={18} className="text-[var(--warning-500)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Pending Applications</h2>
                <p className="text-xs text-[var(--on-glass-dim)] mt-0.5">{pendingOrgs.length} awaiting review</p>
              </div>
            </div>
            <div className="divide-y divide-[var(--glass-border)]">
              {pendingOrgs.map(org => (
                <div key={org.id} className="flex items-start gap-4 px-6 py-5 hover:bg-[var(--glass-05)] transition-all">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--glass-10)] border border-[var(--glass-border)] flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-[var(--on-glass-muted)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white">{org.name}</p>
                    <div className="flex flex-wrap gap-4 mt-1.5">
                      {org.contact_name && (
                        <span className="text-xs font-medium text-[var(--on-glass-muted)]">{org.contact_name}</span>
                      )}
                      {org.contact_email && (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--on-glass-muted)]">
                          <Mail size={10} />{org.contact_email}
                        </span>
                      )}
                      <span className="text-xs text-[var(--on-glass-dim)]">{timeAgo(org.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="success" icon={<CheckCircle size={13} />} loading={approvingId === org.id} onClick={() => handleApprove(org.id, org.name)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" icon={<X size={13} />} onClick={() => setRejectTarget(org)}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Organisations Table */}
      <div id="organisations" className="scroll-mt-24">
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
      </div>

      {/* Approve result modal */}
      <Modal
        isOpen={!!approveResult}
        onClose={() => { setApproveResult(null); setCopiedSetupUrl(false); }}
        title="Organisation Approved"
        size="sm"
      >
        {approveResult && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-[var(--primary-600)]/10 border border-[var(--primary-600)]/20">
              <p className="text-sm font-black text-[var(--primary-600)] uppercase tracking-widest mb-1">
                {approveResult.org_name}
              </p>
              <p className="text-xs text-[var(--on-glass-muted)]">
                Trial active until {fmtDate(approveResult.trial_ends_at ?? null)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest mb-2">Setup URL</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={approveResult.setup_url}
                  className="flex-1 px-3 py-2.5 text-xs font-mono border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-xl text-white truncate outline-none"
                />
                <Button size="sm" onClick={copySetupUrl} icon={copiedSetupUrl ? <Check size={12} /> : <Copy size={12} />}>
                  {copiedSetupUrl ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create org modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Organisation"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button loading={creating} onClick={handleCreateOrg}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" required value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Acme Corp" />
          <Input label="Timezone" value={createTz} onChange={e => setCreateTz(e.target.value)} hint="e.g. Asia/Karachi" />
          {planOptions.length > 0 ? (
            <Select label="Plan" options={planOptions} value={createPlan} onChange={e => setCreatePlan(e.target.value)} />
          ) : (
            <Input label="Plan ID" value={createPlan} onChange={e => setCreatePlan(e.target.value)} />
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        loading={!!rejectingId}
        title="Reject Application"
        message={`Reject ${rejectTarget?.name}? This cannot be undone.`}
        confirmLabel="Reject"
        variant="danger"
      />
    </>
  );
}

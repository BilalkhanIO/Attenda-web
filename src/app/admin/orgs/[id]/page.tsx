'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { getApiError, runDeferred } from '@/lib/utils';
import {
  PageHeader, Card, Button, Badge, Skeleton, Table, EmptyState,
  Select, ConfirmDialog, Modal,
} from '@/components/ui';
import type { PlanDefinition, PlanFeatures } from '@/types';
import {
  AdminOrg, AdminOrgUser, ALL_FEATURE_KEYS, FEATURE_LABELS,
  ORG_STATUS_STYLES, PLAN_STYLES, ROLE_STYLES, SUB_STATUS_STYLES,
  buildFeaturesOverride, daysLeft, featureOverrideState, fmtDate,
  type FeatureOverrideState,
} from '@/lib/admin-shared';
import {
  ChevronLeft, Ban, CheckCircle, Calendar, Pencil, Save, Users,
  RefreshCw, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const inputCls = 'w-full px-3 py-2 border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-lg text-sm text-white';
const labelCls = 'block text-xs font-semibold text-[var(--on-glass-muted)] mb-1.5';

export default function AdminOrgDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = String(params.id);

  const [org, setOrg] = useState<AdminOrg | null>(null);
  const [users, setUsers] = useState<AdminOrgUser[]>([]);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [activating, setActivating] = useState(false);
  const [extendingTrial, setExtendingTrial] = useState(false);
  const [suspendConfirm, setSuspendConfirm] = useState(false);

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [companySize, setCompanySize] = useState('');

  const [subStatus, setSubStatus] = useState('');
  const [subPlan, setSubPlan] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [seatsLimit, setSeatsLimit] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [extendDays, setExtendDays] = useState('7');
  const [featureStates, setFeatureStates] = useState<Record<string, FeatureOverrideState>>({});
  const [showEditOverview, setShowEditOverview] = useState(false);
  const [showEditSubscription, setShowEditSubscription] = useState(false);
  const [showEditFeatures, setShowEditFeatures] = useState(false);

  const planDef = useMemo(
    () => plans.find(p => p.id === subPlan),
    [plans, subPlan],
  );

  const planOptions = useMemo(
    () => plans.filter(p => p.is_active).map(p => ({ value: p.id, label: p.display_name })),
    [plans],
  );

  const loadOrg = useCallback(async () => {
    setLoading(true);
    try {
      const [orgRes, plansRes] = await Promise.all([
        adminApi.getOrg(orgId),
        adminApi.getPlans(),
      ]);
      const orgData = orgRes.data.data as AdminOrg;
      setOrg(orgData);
      setPlans(plansRes.data.data || []);
      const plan = (plansRes.data.data as PlanDefinition[]).find(p => p.id === orgData.plan);
      const states: Record<string, FeatureOverrideState> = {};
      for (const key of ALL_FEATURE_KEYS) {
        states[key] = featureOverrideState(key, plan?.features, orgData.features_override ?? undefined);
      }
      setFeatureStates(states);
      setName(orgData.name);
      setTimezone(orgData.timezone);
      setContactName(orgData.contact_name || '');
      setContactEmail(orgData.contact_email || '');
      setCompanySize(orgData.company_size || '');
      setSubStatus(orgData.subscription_status || 'active');
      setSubPlan(orgData.plan || 'starter');
      setTrialEndsAt(orgData.trial_ends_at ? orgData.trial_ends_at.slice(0, 10) : '');
      setSeatsLimit(orgData.seats_limit?.toString() || '');
      setBillingEmail(orgData.billing_email || '');
      setAdminNotes(orgData.admin_notes || '');
    } catch (err) {
      toast.error(getApiError(err));
      router.replace('/admin/orgs');
    } finally {
      setLoading(false);
    }
  }, [orgId, router]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await adminApi.getOrgUsers(orgId);
      setUsers(res.data.data || []);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [orgId]);

  useEffect(() => runDeferred(() => {
    loadOrg();
    loadUsers();
  }), [loadOrg, loadUsers]);

  const saveOverview = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await adminApi.updateOrg(orgId, {
        name: name.trim(),
        timezone,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        company_size: companySize || null,
      });
      setOrg(res.data.data);
      toast.success('Organisation updated');
      return true;
    } catch (err) {
      toast.error(getApiError(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveSubscription = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await adminApi.updateSubscription(orgId, {
        subscription_status: subStatus,
        plan: subPlan,
        trial_ends_at: trialEndsAt || null,
        seats_limit: seatsLimit ? Number(seatsLimit) : null,
        billing_email: billingEmail || null,
        admin_notes: adminNotes || null,
        features_override: buildFeaturesOverride(featureStates),
      });
      setOrg(res.data.data);
      toast.success('Subscription updated');
      return true;
    } catch (err) {
      toast.error(getApiError(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspend = async () => {
    setSuspending(true);
    try {
      const res = await adminApi.suspendOrg(orgId);
      setOrg(res.data.data);
      toast.success('Organisation updated');
      setSuspendConfirm(false);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSuspending(false);
    }
  };

  const extendTrial = async () => {
    const days = Number(extendDays);
    if (!days || days < 1) {
      toast.error('Enter valid days');
      return;
    }
    setExtendingTrial(true);
    try {
      const res = await adminApi.extendTrial(orgId, days);
      setOrg(res.data.data);
      setTrialEndsAt(res.data.data.trial_ends_at?.slice(0, 10) || '');
      setSubStatus(res.data.data.subscription_status);
      toast.success(`Trial extended by ${days} days`);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setExtendingTrial(false);
    }
  };

  const activateOrg = async () => {
    setActivating(true);
    try {
      const res = await adminApi.activateOrg(orgId);
      setOrg(res.data.data);
      setSubStatus(res.data.data.subscription_status);
      toast.success('Organisation activated');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setActivating(false);
    }
  };

  const setFeatureState = (key: string, state: FeatureOverrideState) => {
    setFeatureStates(prev => ({ ...prev, [key]: state }));
  };

  if (loading || !org) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const planStyle = PLAN_STYLES[org.plan] ?? PLAN_STYLES.trial;
  const orgStatusStyle = ORG_STATUS_STYLES[org.status] ?? ORG_STATUS_STYLES.active;
  const subStyle = SUB_STATUS_STYLES[org.subscription_status] ?? SUB_STATUS_STYLES.active;
  const trialDays = daysLeft(org.trial_ends_at);

  return (
    <>
      <PageHeader
        title={org.name}
        subtitle={`${org.timezone} · ${org.user_count} users`}
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Organisations', href: '/admin/orgs' },
          { label: org.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/orgs">
              <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} />}>Back</Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              icon={org.status === 'suspended' ? <CheckCircle size={14} /> : <Ban size={14} />}
              onClick={() => setSuspendConfirm(true)}
            >
              {org.status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <Badge label={org.plan} color={planStyle.color} bg={planStyle.bg} />
        <Badge label={orgStatusStyle.label} color={orgStatusStyle.color} bg={orgStatusStyle.bg} />
        <Badge label={subStyle.label} color={subStyle.color} bg={subStyle.bg} />
        {org.trial_ends_at && (
          <Badge
            label={trialDays !== null && trialDays <= 0 ? 'Trial expired' : `Trial ${trialDays}d left`}
            color={trialDays !== null && trialDays <= 7 ? '#fbbf24' : '#94a3b8'}
            bg="rgba(148, 163, 184, 0.1)"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Overview & Users */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-05)]">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-[var(--primary-600)]" />
                <h2 className="text-[11px] font-black text-white uppercase tracking-widest">Organisation Details</h2>
              </div>
              <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setShowEditOverview(true)}>
                Edit
              </Button>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <p className={labelCls}>Contact Name</p>
                <p className="text-sm font-black text-white">{org.contact_name || '—'}</p>
              </div>
              <div>
                <p className={labelCls}>Contact Email</p>
                <p className="text-sm font-black text-white">{org.contact_email || '—'}</p>
              </div>
              <div>
                <p className={labelCls}>Company Size</p>
                <p className="text-sm font-black text-white">{org.company_size || '—'}</p>
              </div>
              <div>
                <p className={labelCls}>Timezone</p>
                <p className="text-sm font-black text-white">{org.timezone}</p>
              </div>
              <div>
                <p className={labelCls}>Created At</p>
                <p className="text-sm font-black text-white">{fmtDate(org.created_at)}</p>
              </div>
            </div>
          </Card>

          <Card className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-05)]">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[var(--primary-600)]" />
                <h2 className="text-[11px] font-black text-white uppercase tracking-widest">Users ({users.length})</h2>
              </div>
            </div>
            <Table
              headers={['Name', 'Email', 'Role', 'Status']}
              loading={loadingUsers}
              emptyState={
                <EmptyState
                  icon={<Users size={24} />}
                  title="No users"
                  description="This organisation has no users yet."
                />
              }
            >
              {users.map(u => {
                const rs = ROLE_STYLES[u.role] ?? ROLE_STYLES.employee;
                return (
                  <tr key={u.id} className="border-b border-[var(--glass-border)] hover:bg-[var(--glass-05)] transition-colors">
                    <td className="py-3.5 px-6 text-sm font-black text-white">{u.name}</td>
                    <td className="py-3.5 px-6 text-[13px] font-medium text-[var(--on-glass-muted)]">{u.email}</td>
                    <td className="py-3.5 px-6">
                      <Badge label={u.role.replace(/_/g, ' ')} color={rs.color} bg={rs.bg} size="sm" />
                    </td>
                    <td className="py-3.5 px-6">
                      <Badge
                        label={u.is_active ? 'Active' : 'Inactive'}
                        color={u.is_active ? 'var(--primary-600)' : 'var(--on-glass-muted)'}
                        bg={u.is_active ? 'var(--primary-600)' : 'var(--on-glass-dim)'}
                        size="sm"
                      />
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </div>

        {/* Right Column: Subscription & Features */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-05)]">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-[var(--secondary)]" />
                <h2 className="text-[11px] font-black text-white uppercase tracking-widest">Subscription</h2>
              </div>
              <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setShowEditSubscription(true)}>
                Manage
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className={labelCls}>Status</p>
                <Badge label={subStyle.label} color={subStyle.color} bg={subStyle.bg} size="sm" />
              </div>
              <div>
                <p className={labelCls}>Plan</p>
                <p className="text-sm font-black text-white uppercase tracking-wider">{org.plan}</p>
              </div>
              <div>
                <p className={labelCls}>Seats Limit</p>
                <p className="text-sm font-black text-white">{org.seats_limit ?? 'Unlimited'}</p>
              </div>
              {org.trial_ends_at && (
                <div>
                  <p className={labelCls}>Trial Ends</p>
                  <p className="text-sm font-black text-white">{fmtDate(org.trial_ends_at)}</p>
                </div>
              )}
              {org.billing_email && (
                <div>
                  <p className={labelCls}>Billing Email</p>
                  <p className="text-sm font-black text-white">{org.billing_email}</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--glass-05)]">
              <div className="flex items-center gap-2">
                <RefreshCw size={16} className="text-[#a855f7]" />
                <h2 className="text-[11px] font-black text-white uppercase tracking-widest">Features</h2>
              </div>
              <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setShowEditFeatures(true)}>
                Override
              </Button>
            </div>
            <div className="p-6">
              <p className="text-[10px] text-[var(--on-glass-muted)] font-bold uppercase tracking-wider mb-4">
                Active Overrides: {Object.keys(org.features_override || {}).length}
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(org.features_override || {}).map(([key, val]) => (
                  <Badge
                    key={key}
                    label={FEATURE_LABELS[key] || key}
                    color={val ? 'var(--primary-600)' : 'var(--danger-500)'}
                    bg={val ? 'var(--primary-600)' : 'var(--danger-500)'}
                    size="sm"
                  />
                ))}
                {Object.keys(org.features_override || {}).length === 0 && (
                  <p className="text-[11px] text-[var(--on-glass-dim)] font-black uppercase italic">No active overrides</p>
                )}
              </div>
            </div>
          </Card>

          {org.record_counts && (
            <Card className="glass-card p-6">
              <h2 className="text-[11px] font-black text-white uppercase tracking-widest mb-4">Quick Stats</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--on-glass-muted)] font-bold uppercase tracking-wider">Attendance</span>
                  <span className="font-black text-white">{org.record_counts.attendance}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--on-glass-muted)] font-bold uppercase tracking-wider">Leave</span>
                  <span className="font-black text-white">{org.record_counts.leave}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--on-glass-muted)] font-bold uppercase tracking-wider">Payroll</span>
                  <span className="font-black text-white">{org.record_counts.payroll}</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Overview Modal */}
      <Modal 
        isOpen={showEditOverview} 
        onClose={() => setShowEditOverview(false)} 
        title="Edit Organisation Details"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" className="flex-1" onClick={() => setShowEditOverview(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={async () => { const ok = await saveOverview(); if (ok) setShowEditOverview(false); }} icon={<Save size={14} />}>
              Save Changes
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Organisation name</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Timezone</label>
              <input value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Company size</label>
              <input value={companySize} onChange={e => setCompanySize(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contact name</label>
              <input value={contactName} onChange={e => setContactName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contact email</label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Manage Subscription Modal */}
      <Modal 
        isOpen={showEditSubscription} 
        onClose={() => setShowEditSubscription(false)} 
        title="Manage Subscription"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" className="flex-1" onClick={() => setShowEditSubscription(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={async () => { const ok = await saveSubscription(); if (ok) setShowEditSubscription(false); }} icon={<Save size={14} />}>
              Save Config
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Subscription status</label>
              <select value={subStatus} onChange={e => setSubStatus(e.target.value)} className={inputCls}>
                {Object.entries(SUB_STATUS_STYLES).map(([k, v]) => (
                  <option key={k} value={k} className="bg-[var(--dark-950)]">{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Plan</label>
              {planOptions.length > 0 ? (
                <Select options={planOptions} value={subPlan} onChange={e => setSubPlan(e.target.value)} />
              ) : (
                <input value={subPlan} onChange={e => setSubPlan(e.target.value)} className={inputCls} />
              )}
            </div>
            <div>
              <label className={labelCls}>Trial ends</label>
              <input type="date" value={trialEndsAt} onChange={e => setTrialEndsAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Seats limit</label>
              <input
                type="number"
                min={0}
                value={seatsLimit}
                onChange={e => setSeatsLimit(e.target.value)}
                placeholder="Unlimited"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Billing email</label>
              <input type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Admin notes</label>
              <textarea rows={3} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} className={`${inputCls} resize-none`} />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)] space-y-3">
            <p className="text-[10px] font-black text-white uppercase tracking-widest">Extend Trial</p>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={extendDays}
                onChange={e => setExtendDays(e.target.value)}
                className={`${inputCls} flex-1`}
              />
              <Button variant="outline" size="sm" loading={extendingTrial} onClick={extendTrial} icon={<Calendar size={14} />}>
                Extend
              </Button>
            </div>
          </div>

          {(org.subscription_status === 'inactive' || org.subscription_status === 'defaulted') && (
            <Button variant="success" className="w-full" loading={activating} onClick={activateOrg} icon={<CheckCircle size={14} />}>
              Activate organisation
            </Button>
          )}
        </div>
      </Modal>

      {/* Feature Overrides Modal */}
      <Modal 
        isOpen={showEditFeatures} 
        onClose={() => setShowEditFeatures(false)} 
        title="Feature Overrides" 
        size="lg"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" className="flex-1" onClick={() => setShowEditFeatures(false)}>Cancel</Button>
            <Button className="flex-1" loading={saving} onClick={async () => { const ok = await saveSubscription(); if (ok) setShowEditFeatures(false); }} icon={<Save size={14} />}>
              Save Overrides
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <p className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-wider leading-relaxed">
            Force enable or disable specific features regardless of plan defaults.
            <span className="text-white ml-1">Inherit</span> uses plan defaults.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_FEATURE_KEYS.map(key => {
              const state = featureStates[key] ?? 'inherit';
              const planOn = !!(planDef?.features as PlanFeatures)?.[key];
              return (
                <div key={key} className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-05)]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black text-white uppercase tracking-tight">{FEATURE_LABELS[key]}</p>
                    <span className="text-[8px] font-black uppercase text-[var(--on-glass-dim)]">Default {planOn ? 'On' : 'Off'}</span>
                  </div>
                  <div className="flex gap-1">
                    {(['inherit', 'on', 'off'] as FeatureOverrideState[]).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFeatureState(key, s)}
                        className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg border transition-all ${
                          state === s
                            ? s === 'on'
                              ? 'bg-[var(--success-500)]/15 border-[var(--success-500)]/40 text-[var(--success-500)]'
                              : s === 'off'
                                ? 'bg-[var(--danger-500)]/15 border-[var(--danger-500)]/40 text-[var(--danger-500)]'
                                : 'bg-white/15 border-white/30 text-white'
                            : 'border-[var(--glass-border)] text-[var(--on-glass-dim)] hover:bg-[var(--glass-05)] hover:text-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={suspendConfirm}
        onClose={() => setSuspendConfirm(false)}
        onConfirm={toggleSuspend}
        loading={suspending}
        title={org.status === 'suspended' ? 'Reactivate organisation' : 'Suspend organisation'}
        message={
          org.status === 'suspended'
            ? `Reactivate ${org.name}? Users will regain access.`
            : `Suspend ${org.name}? Users may lose access until reactivated.`
        }
        confirmLabel={org.status === 'suspended' ? 'Reactivate' : 'Suspend'}
        variant={org.status === 'suspended' ? 'primary' : 'danger'}
      />
    </>
  );
}

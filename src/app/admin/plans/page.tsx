'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { PageHeader, Card, Button, Skeleton, Badge, ConfirmDialog } from '@/components/ui';
import { Plus, Pencil, Trash2, Check, X, Star, Tag } from 'lucide-react';
import { FEATURE_LABELS } from '@/lib/admin-shared';
import type { PlanDefinition } from '@/types';
import toast from 'react-hot-toast';

const DEFAULT_FEATURES = Object.fromEntries(Object.keys(FEATURE_LABELS).map(k => [k, false]));

const EMPTY_PLAN: Omit<PlanDefinition, 'updated_at'> = {
  id:            '',
  display_name:  '',
  price_monthly: 0,
  price_annual:  0,
  max_employees: 0,
  trial_days:    14,
  features:      DEFAULT_FEATURES as any,
  description:   '',
  highlight:     false,
  is_active:     true,
  sort_order:    0,
};

export default function AdminPlansPage() {
  const [plans, setPlans]     = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlanDefinition | null>(null);
  const [isNew, setIsNew]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<typeof EMPTY_PLAN>({ ...EMPTY_PLAN });

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getPlans();
      setPlans(res.data.data);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const openEdit = (plan: PlanDefinition) => {
    setIsNew(false);
    setForm({
      id:            plan.id,
      display_name:  plan.display_name,
      price_monthly: plan.price_monthly,
      price_annual:  plan.price_annual,
      max_employees: plan.max_employees,
      trial_days:    plan.trial_days,
      features:      { ...DEFAULT_FEATURES, ...plan.features } as any,
      description:   plan.description || '',
      highlight:     plan.highlight,
      is_active:     plan.is_active,
      sort_order:    plan.sort_order,
    });
    setEditing(plan);
  };

  const openNew = () => {
    setIsNew(true);
    setForm({ ...EMPTY_PLAN, features: { ...DEFAULT_FEATURES } as any });
    setEditing({ ...EMPTY_PLAN, updated_at: '' } as PlanDefinition);
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) { toast.error('Display name is required'); return; }
    if (isNew && !form.id.trim()) { toast.error('Plan ID is required'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const res = await adminApi.createPlan(form as Record<string, unknown>);
        setPlans(prev => [...prev, res.data.data].sort((a, b) => a.sort_order - b.sort_order));
      } else {
        const res = await adminApi.updatePlanDef(form.id, form as Record<string, unknown>);
        setPlans(prev => prev.map(p => p.id === form.id ? res.data.data : p));
      }
      toast.success(isNew ? 'Plan created' : 'Plan updated');
      setEditing(null);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget);
    try {
      await adminApi.deletePlan(deleteTarget);
      setPlans(prev => prev.filter(p => p.id !== deleteTarget));
      toast.success('Plan deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Plan management"
        subtitle="Define pricing tiers and feature access"
        actions={<Button size="sm" icon={<Plus size={14} />} onClick={openNew}>New plan</Button>}
      />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {plans.map(plan => (
              <Card key={plan.id} className={`glass-card relative flex flex-col ${plan.highlight ? 'border-[var(--primary-600)]/50 shadow-[0_0_20px_rgba(0,200,150,0.12)]' : ''} ${!plan.is_active ? 'opacity-60 grayscale' : ''}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--primary-600)] text-white text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1 shadow-lg shadow-[var(--primary-600)]/30">
                    <Star size={10} /> Popular
                  </div>
                )}
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-black text-white">{plan.display_name}</h3>
                        {!plan.is_active && <Badge label="Inactive" color="#94a3b8" bg="rgba(148, 163, 184, 0.1)" size="sm" />}
                      </div>
                      <p className="text-[10px] font-mono text-[var(--on-glass-muted)]">ID: {plan.id}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(plan)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--on-glass-muted)] hover:text-[var(--primary-600)] transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteTarget(plan.id)} disabled={deleting === plan.id}
                        className="p-1.5 rounded-lg hover:bg-[var(--danger-500)]/10 text-[var(--on-glass-muted)] hover:text-[var(--danger-500)] transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-2xl font-black text-white">
                      {plan.price_monthly === 0 ? 'Free' : `$${plan.price_monthly}`}
                      {plan.price_monthly > 0 && <span className="text-sm font-normal text-[var(--on-glass-muted)] ml-1">/mo</span>}
                    </p>
                    {plan.price_annual > 0 && (
                      <p className="text-xs text-[var(--on-glass-muted)]">${plan.price_annual}/yr</p>
                    )}
                  </div>
                  {plan.description && <p className="text-xs text-[var(--on-glass-muted)] mb-4 leading-relaxed line-clamp-2">{plan.description}</p>}
                  <div className="space-y-1.5 mb-4 border-t border-[var(--glass-border)] pt-4">
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                      const enabled = (plan.features as any)[key];
                      return (
                        <div key={key} className="flex items-center gap-2">
                          {enabled
                            ? <Check size={12} className="text-[var(--primary-600)] flex-shrink-0" />
                            : <X    size={12} className="text-[var(--on-glass-dim)] flex-shrink-0" />}
                          <span className={`text-[11px] font-medium ${enabled ? 'text-[var(--on-glass-sub)]' : 'text-[var(--on-glass-dim)]'}`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--on-glass-muted)] pt-3 border-t border-[var(--glass-border)] mt-auto">
                    <span>{plan.max_employees === 0 ? 'Unlimited' : `${plan.max_employees}`} users</span>
                    <span>·</span>
                    <span>{plan.trial_days}d trial</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={!!deleting}
        title="Delete plan"
        message="Delete this plan? Organisations on this plan are not migrated automatically."
        confirmLabel="Delete"
        variant="danger"
      />

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="w-full max-w-lg bg-[var(--dark-950)] h-full shadow-2xl flex flex-col overflow-hidden slide-in-right border-l border-[var(--glass-border)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary-600)]/10 flex items-center justify-center border border-[var(--primary-600)]/20">
                  <Tag size={15} className="text-[var(--primary-600)]" />
                </div>
                <h2 className="text-sm font-bold text-white">{isNew ? 'New Plan' : `Edit ${form.display_name}`}</h2>
              </div>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--on-glass-muted)] transition-colors"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {isNew && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--on-glass-muted)] mb-1.5">Plan ID (slug, no spaces)</label>
                  <input type="text" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g, '-') }))}
                    placeholder="e.g. growth-pro"
                    className="w-full px-3 py-2 border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--primary-600)]/50" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[var(--on-glass-muted)] mb-1.5">Display Name</label>
                <input type="text" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="Growth Pro"
                  className="w-full px-3 py-2 border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--primary-600)]/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--on-glass-muted)] mb-1.5">Monthly Price ($)</label>
                  <input type="number" min="0" value={form.price_monthly} onChange={e => setForm(f => ({ ...f, price_monthly: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--primary-600)]/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--on-glass-muted)] mb-1.5">Annual Price ($)</label>
                  <input type="number" min="0" value={form.price_annual} onChange={e => setForm(f => ({ ...f, price_annual: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--primary-600)]/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--on-glass-muted)] mb-1.5">Max Employees (0 = unlimited)</label>
                  <input type="number" min="0" value={form.max_employees} onChange={e => setForm(f => ({ ...f, max_employees: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--primary-600)]/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--on-glass-muted)] mb-1.5">Trial Days</label>
                  <input type="number" min="0" max="365" value={form.trial_days} onChange={e => setForm(f => ({ ...f, trial_days: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--primary-600)]/50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--on-glass-muted)] mb-1.5">Description</label>
                <textarea rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--primary-600)]/50 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--on-glass-muted)] mb-1.5">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-lg text-sm text-white focus:outline-none focus:border-[var(--primary-600)]/50" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.highlight} onChange={e => setForm(f => ({ ...f, highlight: e.target.checked }))}
                    className="w-4 h-4 rounded bg-[var(--dark-800)] border-[var(--glass-border)] checked:bg-[var(--primary-600)] accent-[var(--primary-600)]" />
                  <span className="text-sm text-[var(--on-glass-sub)]">Highlight (Popular)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded bg-[var(--dark-800)] border-[var(--glass-border)] checked:bg-[var(--primary-600)] accent-[var(--primary-600)]" />
                  <span className="text-sm text-[var(--on-glass-sub)]">Active</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--on-glass-muted)] mb-2">Features</label>
                <div className="space-y-2">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-05)] cursor-pointer hover:bg-white/5 transition-colors">
                      <input type="checkbox" checked={!!(form.features as any)[key]}
                        onChange={e => setForm(f => ({ ...f, features: { ...f.features as any, [key]: e.target.checked } }))}
                        className="w-4 h-4 rounded bg-[var(--dark-800)] border-[var(--glass-border)] checked:bg-[var(--primary-600)] accent-[var(--primary-600)]" />
                      <span className="text-sm text-[var(--on-glass-sub)]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-[var(--glass-border)] flex gap-3 bg-[var(--glass-05)]">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="flex-1" loading={saving} onClick={handleSave}>{isNew ? 'Create Plan' : 'Save Changes'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

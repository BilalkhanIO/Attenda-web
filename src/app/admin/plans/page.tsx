'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError } from '@/lib/utils';
import { Card, Button, Skeleton, Badge } from '@/components/ui';
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, Star, Tag } from 'lucide-react';
import type { PlanDefinition } from '@/types';
import toast from 'react-hot-toast';

const FEATURE_LABELS: Record<string, string> = {
  attendance:          'Attendance',
  leave_management:    'Leave Management',
  shifts:              'Shifts',
  payroll:             'Payroll',
  whatsapp:            'WhatsApp',
  performance_reviews: 'Performance Reviews',
  remote_work:         'Remote Work',
  api_access:          'API Access',
  advanced_reports:    'Advanced Reports',
  multi_location:      'Multi-Location',
};

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
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [plans, setPlans]     = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlanDefinition | null>(null);
  const [isNew, setIsNew]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState<typeof EMPTY_PLAN>({ ...EMPTY_PLAN });

  useEffect(() => {
    if (!authLoading && user && user.role !== 'platform_admin') router.replace('/dashboard');
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

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
    if (!authLoading && user?.role === 'platform_admin') loadPlans();
  }, [authLoading, user, loadPlans]);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plan? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await adminApi.deletePlan(id);
      setPlans(prev => prev.filter(p => p.id !== id));
      toast.success('Plan deleted');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeleting(null);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#040D12] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#040D12] text-slate-300">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-lg hover:bg-white/5 transition-colors group">
              <ArrowLeft size={18} className="text-slate-500 group-hover:text-emerald-400" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-100">Plan Management</h1>
              <p className="text-sm text-slate-500">Define pricing tiers and feature access</p>
            </div>
          </div>
          <Button size="sm" icon={<Plus size={14} />} onClick={openNew}>New Plan</Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {plans.map(plan => (
              <Card key={plan.id} className={`glass-card relative flex flex-col ${plan.highlight ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : ''} ${!plan.is_active ? 'opacity-60 grayscale' : ''}`}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1 shadow-lg shadow-emerald-500/30">
                    <Star size={10} /> Popular
                  </div>
                )}
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-black text-slate-100">{plan.display_name}</h3>
                        {!plan.is_active && <Badge label="Inactive" color="#94a3b8" bg="rgba(148, 163, 184, 0.1)" size="sm" />}
                      </div>
                      <p className="text-[10px] font-mono text-slate-500">ID: {plan.id}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(plan)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-emerald-400 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(plan.id)} disabled={deleting === plan.id}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-2xl font-black text-slate-100">
                      {plan.price_monthly === 0 ? 'Free' : `$${plan.price_monthly}`}
                      {plan.price_monthly > 0 && <span className="text-sm font-normal text-slate-500 ml-1">/mo</span>}
                    </p>
                    {plan.price_annual > 0 && (
                      <p className="text-xs text-slate-500">${plan.price_annual}/yr</p>
                    )}
                  </div>
                  {plan.description && <p className="text-xs text-slate-400 mb-4 leading-relaxed line-clamp-2">{plan.description}</p>}
                  <div className="space-y-1.5 mb-4 border-t border-glass pt-4">
                    {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                      const enabled = (plan.features as any)[key];
                      return (
                        <div key={key} className="flex items-center gap-2">
                          {enabled
                            ? <Check size={12} className="text-emerald-400 flex-shrink-0" />
                            : <X    size={12} className="text-slate-700 flex-shrink-0" />}
                          <span className={`text-[11px] font-medium ${enabled ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 pt-3 border-t border-glass mt-auto">
                    <span>{plan.max_employees === 0 ? 'Unlimited' : `${plan.max_employees}`} users</span>
                    <span>·</span>
                    <span>{plan.trial_days}d trial</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ─── Edit / Create drawer ─── */}
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="w-full max-md bg-[#040D12] h-full shadow-2xl flex flex-col overflow-hidden slide-in-right border-l border-glass">
            <div className="flex items-center justify-between px-5 py-4 border-b border-glass bg-slate-800/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <Tag size={15} className="text-emerald-400" />
                </div>
                <h2 className="text-sm font-bold text-slate-100">{isNew ? 'New Plan' : `Edit ${form.display_name}`}</h2>
              </div>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 transition-colors"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {isNew && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Plan ID (slug, no spaces)</label>
                  <input type="text" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g, '-') }))}
                    placeholder="e.g. growth-pro"
                    className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Display Name</label>
                <input type="text" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="Growth Pro"
                  className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Monthly Price ($)</label>
                  <input type="number" min="0" value={form.price_monthly} onChange={e => setForm(f => ({ ...f, price_monthly: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Annual Price ($)</label>
                  <input type="number" min="0" value={form.price_annual} onChange={e => setForm(f => ({ ...f, price_annual: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Max Employees (0 = unlimited)</label>
                  <input type="number" min="0" value={form.max_employees} onChange={e => setForm(f => ({ ...f, max_employees: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Trial Days</label>
                  <input type="number" min="0" max="365" value={form.trial_days} onChange={e => setForm(f => ({ ...f, trial_days: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Description</label>
                <textarea rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-glass bg-slate-800/50 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.highlight} onChange={e => setForm(f => ({ ...f, highlight: e.target.checked }))}
                    className="w-4 h-4 rounded bg-slate-800 border-glass checked:bg-emerald-500 accent-emerald-500" />
                  <span className="text-sm text-slate-300">Highlight (Popular)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded bg-slate-800 border-glass checked:bg-emerald-500 accent-emerald-500" />
                  <span className="text-sm text-slate-300">Active</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Features</label>
                <div className="space-y-2">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-glass bg-slate-800/20 cursor-pointer hover:bg-white/5 transition-colors">
                      <input type="checkbox" checked={!!(form.features as any)[key]}
                        onChange={e => setForm(f => ({ ...f, features: { ...f.features as any, [key]: e.target.checked } }))}
                        className="w-4 h-4 rounded bg-slate-800 border-glass checked:bg-emerald-500 accent-emerald-500" />
                      <span className="text-sm text-slate-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-glass flex gap-3 bg-slate-800/20">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="flex-1" loading={saving} onClick={handleSave}>{isNew ? 'Create Plan' : 'Save Changes'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, Modal, Badge, EmptyState, Select } from '@/components/ui';
import { overtimeApi } from '@/lib/api';
import { keys, overtimeRulesQuery } from '@/lib/queries';
import type { OvertimeRule } from '@/lib/queries';
import { Clock, Plus, Edit2, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';

const RULE_TYPE_LABELS: Record<string, string> = {
  daily:       'Daily',
  weekly:      'Weekly',
  seventh_day: '7th Day',
};

const RULE_TYPE_OPTIONS = [
  { value: 'daily',       label: 'Daily — hours beyond X per day' },
  { value: 'weekly',      label: 'Weekly — hours beyond X per week' },
  { value: 'seventh_day', label: '7th Day — all hours on 7th consecutive day' },
];

interface RuleForm {
  name: string;
  rule_type: 'daily' | 'weekly' | 'seventh_day';
  threshold_hours: number;
  multiplier: number;
  priority: number;
}

const emptyForm: RuleForm = {
  name: '',
  rule_type: 'daily',
  threshold_hours: 8,
  multiplier: 1.5,
  priority: 1,
};

export default function OvertimeSettingsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<OvertimeRule | null>(null);
  const [form, setForm] = useState<RuleForm>({ ...emptyForm });

  const isAdmin = hasPermission('overtime.manage');

  const rulesQuery = useQuery(overtimeRulesQuery());
  const rules = rulesQuery.data ?? [];
  const loading = rulesQuery.isPending;

  const invalidateRules = () =>
    queryClient.invalidateQueries({ queryKey: keys.overtime.rules() });

  const saveMutation = useMutation({
    mutationFn: (vars: { id?: string; data: Record<string, unknown> }) =>
      vars.id ? overtimeApi.updateRule(vars.id, vars.data) : overtimeApi.createRule(vars.data),
    onSuccess: (_d, vars) => {
      toast.success(vars.id ? 'Overtime rule updated' : 'Overtime rule created');
      setModalOpen(false);
    },
    onSettled: invalidateRules,
  });

  const deleteMutation = useMutation({
    mutationFn: (vars: { id: string }) => overtimeApi.deleteRule(vars.id),
    onSuccess: () => toast.success('Rule deleted'),
    onSettled: invalidateRules,
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) =>
      overtimeApi.updateRule(vars.id, { is_active: vars.is_active }),
    onSettled: invalidateRules,
  });

  const openAdd = () => {
    setEditRule(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (rule: OvertimeRule) => {
    setEditRule(rule);
    setForm({
      name: rule.name,
      rule_type: rule.rule_type as RuleForm['rule_type'],
      threshold_hours: rule.threshold_hours,
      multiplier: rule.multiplier,
      priority: rule.priority,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Rule name is required'); return; }
    if (form.multiplier < 1) { toast.error('Multiplier must be at least 1.0'); return; }
    saveMutation.mutate({ id: editRule?.id, data: form as unknown as Record<string, unknown> });
  };

  const handleDelete = (rule: OvertimeRule) => deleteMutation.mutate({ id: rule.id });

  const handleToggleActive = (rule: OvertimeRule) =>
    toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active });

  return (
    <DashboardLayout>
      <PageHeader
        title="Overtime Rules"
        subtitle="Configure how overtime hours are calculated and compensated"
        breadcrumb={[{ label: 'Settings', href: '/settings' }, { label: 'Overtime' }]}
        actions={
          isAdmin ? (
            <Button size="sm" icon={<Plus size={14} />} onClick={openAdd}>
              Add Rule
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-slate-800/40 rounded-xl border border-glass animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card className="glass-card p-6">
          <EmptyState
            icon={<Clock size={24} />}
            title="No overtime rules configured"
            description="Add overtime rules to define how extra hours are calculated and paid."
            action={
              isAdmin ? (
                <Button icon={<Plus size={14} />} onClick={openAdd}>Add First Rule</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map(rule => (
            <Card key={rule.id} className="glass-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${rule.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`} />
                  <h3 className="text-sm font-bold text-slate-100">{rule.name}</h3>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(rule)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-500 hover:text-emerald-400 transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(rule)}
                      disabled={deleteMutation.isPending && deleteMutation.variables?.id === rule.id}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Type</span>
                  <Badge
                    label={RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                    color="#00C896"
                    bg="rgba(0, 200, 150, 0.1)"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Threshold</span>
                  <span className="text-xs font-semibold text-slate-200">{rule.threshold_hours}h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Multiplier</span>
                  <span className="text-xs font-semibold text-slate-200">{rule.multiplier}×</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Priority</span>
                  <span className="text-xs font-semibold text-slate-200">{rule.priority}</span>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center justify-between pt-3 border-t border-glass">
                  <span className="text-xs text-slate-500">{rule.is_active ? 'Active' : 'Inactive'}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(rule)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${rule.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Rule Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editRule ? 'Edit Overtime Rule' : 'New Overtime Rule'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button icon={<Save size={14} />} loading={saveMutation.isPending} onClick={handleSave}>
              {editRule ? 'Save Changes' : 'Create Rule'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Rule Name"
            required
            placeholder="e.g. Daily Overtime 1.5×"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />

          <Select
            label="Rule Type"
            required
            options={RULE_TYPE_OPTIONS}
            value={form.rule_type}
            onChange={e => setForm(f => ({ ...f, rule_type: e.target.value as typeof f.rule_type }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-300">
                Threshold (hours) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={form.threshold_hours}
                onChange={e => setForm(f => ({ ...f, threshold_hours: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-glass bg-slate-800/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
              />
              <p className="text-xs text-slate-500">Hours before overtime kicks in</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-300">
                Multiplier <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.25"
                min="1"
                max="5"
                value={form.multiplier}
                onChange={e => setForm(f => ({ ...f, multiplier: parseFloat(e.target.value) || 1 }))}
                className="w-full rounded-lg border border-glass bg-slate-800/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
              />
              <p className="text-xs text-slate-500">e.g. 1.5 = 1.5× base pay</p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-slate-300">Priority</label>
            <input
              type="number"
              step="1"
              min="1"
              max="99"
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))}
              className="w-full rounded-lg border border-glass bg-slate-800/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/50"
            />
            <p className="text-xs text-slate-500">Lower number = applied first when multiple rules match</p>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

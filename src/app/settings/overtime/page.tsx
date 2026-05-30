'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, Modal, Badge, EmptyState, Select } from '@/components/ui';
import { overtimeApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Clock, Plus, Edit2, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';

interface OvertimeRule {
  id: string;
  name: string;
  rule_type: 'daily' | 'weekly' | 'seventh_day';
  threshold_hours: number;
  multiplier: number;
  priority: number;
  is_active: boolean;
}

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
  const { hasRole } = useAuth();
  const [rules, setRules] = useState<OvertimeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<OvertimeRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>({ ...emptyForm });

  const isAdmin = hasRole('hr_admin', 'super_admin');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await overtimeApi.getRules();
      setRules(data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

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

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Rule name is required'); return; }
    if (form.multiplier < 1) { toast.error('Multiplier must be at least 1.0'); return; }
    setSaving(true);
    try {
      if (editRule) {
        await overtimeApi.updateRule(editRule.id, form as unknown as Record<string, unknown>);
        toast.success('Overtime rule updated');
      } else {
        await overtimeApi.createRule(form);
        toast.success('Overtime rule created');
      }
      setModalOpen(false);
      loadRules();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: OvertimeRule) => {
    setDeletingId(rule.id);
    try {
      await overtimeApi.deleteRule(rule.id);
      toast.success('Rule deleted');
      setRules(prev => prev.filter(r => r.id !== rule.id));
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (rule: OvertimeRule) => {
    try {
      await overtimeApi.updateRule(rule.id, { is_active: !rule.is_active });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

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
            <div key={i} className="h-40 bg-white rounded-xl border border-[var(--gray-200)] animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card className="p-6">
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
            <Card key={rule.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${rule.is_active ? 'bg-[var(--success-500)]' : 'bg-[var(--gray-300)]'}`} />
                  <h3 className="text-sm font-bold text-[var(--dark-950)]">{rule.name}</h3>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(rule)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-500)]"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(rule)}
                      disabled={deletingId === rule.id}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--danger-100)] text-[var(--gray-500)] hover:text-[var(--danger-800)] disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--gray-500)]">Type</span>
                  <Badge
                    label={RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                    color="var(--primary-600)"
                    bg="var(--primary-100)"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--gray-500)]">Threshold</span>
                  <span className="text-xs font-semibold text-[var(--dark-950)]">{rule.threshold_hours}h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--gray-500)]">Multiplier</span>
                  <span className="text-xs font-semibold text-[var(--dark-950)]">{rule.multiplier}×</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--gray-500)]">Priority</span>
                  <span className="text-xs font-semibold text-[var(--dark-950)]">{rule.priority}</span>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center justify-between pt-3 border-t border-[var(--gray-100)]">
                  <span className="text-xs text-[var(--gray-500)]">{rule.is_active ? 'Active' : 'Inactive'}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(rule)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.is_active ? 'bg-[var(--success-500)]' : 'bg-[var(--gray-300)]'}`}
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
            <Button icon={<Save size={14} />} loading={saving} onClick={handleSave}>
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
              <label className="text-sm font-semibold text-[var(--dark-800)]">
                Threshold (hours) <span className="text-[var(--danger-500)]">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={form.threshold_hours}
                onChange={e => setForm(f => ({ ...f, threshold_hours: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-[var(--gray-200)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary-600)] focus:ring-2 focus:ring-[var(--primary-100)]"
              />
              <p className="text-xs text-[var(--gray-500)]">Hours before overtime kicks in</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-[var(--dark-800)]">
                Multiplier <span className="text-[var(--danger-500)]">*</span>
              </label>
              <input
                type="number"
                step="0.25"
                min="1"
                max="5"
                value={form.multiplier}
                onChange={e => setForm(f => ({ ...f, multiplier: parseFloat(e.target.value) || 1 }))}
                className="w-full rounded-lg border border-[var(--gray-200)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary-600)] focus:ring-2 focus:ring-[var(--primary-100)]"
              />
              <p className="text-xs text-[var(--gray-500)]">e.g. 1.5 = 1.5× base pay</p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[var(--dark-800)]">Priority</label>
            <input
              type="number"
              step="1"
              min="1"
              max="99"
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))}
              className="w-full rounded-lg border border-[var(--gray-200)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary-600)] focus:ring-2 focus:ring-[var(--primary-100)]"
            />
            <p className="text-xs text-[var(--gray-500)]">Lower number = applied first when multiple rules match</p>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Modal, Button, Card, EmptyState, Input, Select, ConfirmDialog, Skeleton
} from '@/components/ui';
import { overtimeApi } from '@/lib/api';
import { keys, overtimeRulesQuery, type OvertimeRule } from '@/lib/queries';
import { Clock, Plus, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { cn, getApiError } from '@/lib/utils';

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

type RuleForm = {
  name: string;
  rule_type: 'daily' | 'weekly' | 'seventh_day';
  threshold_hours: number;
  multiplier: number;
  priority: number;
};

const emptyForm: RuleForm = {
  name: '',
  rule_type: 'daily',
  threshold_hours: 8,
  multiplier: 1.5,
  priority: 1,
};

interface OvertimeRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OvertimeRulesModal({ isOpen, onClose }: OvertimeRulesModalProps) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = hasPermission('overtime.manage');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<OvertimeRule | null>(null);
  const [form, setForm] = useState<RuleForm>({ ...emptyForm });
  const [deleteConfirm, setDeleteConfirm] = useState<OvertimeRule | null>(null);

  const rulesQuery = useQuery(overtimeRulesQuery());
  const rules = rulesQuery.data ?? [];

  const invalidateRules = () =>
    queryClient.invalidateQueries({ queryKey: keys.overtime.rules() });

  const saveMutation = useMutation({
    mutationFn: (vars: { id?: string; data: Record<string, unknown> }) =>
      vars.id ? overtimeApi.updateRule(vars.id, vars.data) : overtimeApi.createRule(vars.data),
    onSuccess: (_d, vars) => {
      toast.success(vars.id ? 'Overtime rule updated' : 'Overtime rule created');
      setFormModalOpen(false);
      invalidateRules();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => overtimeApi.deleteRule(id),
    onSuccess: () => {
      toast.success('Rule deleted');
      setDeleteConfirm(null);
      invalidateRules();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) =>
      overtimeApi.updateRule(vars.id, { is_active: vars.is_active }),
    onSuccess: invalidateRules,
    onError: (err) => toast.error(getApiError(err)),
  });

  const openAdd = () => {
    setEditRule(null);
    setForm({ ...emptyForm });
    setFormModalOpen(true);
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
    setFormModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Rule name is required');
    saveMutation.mutate({ id: editRule?.id, data: form });
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Overtime Rules"
        size="lg"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase text-[var(--on-glass-muted)] tracking-widest">
              Calculation Rules
            </p>
            {isAdmin && (
              <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openAdd}>
                Add Rule
              </Button>
            )}
          </div>

          {rulesQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
          ) : rules.length === 0 ? (
            <EmptyState icon={<Clock size={24} />} title="No rules defined" description="Overtime rules define how extra work is compensated." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map(rule => (
                <Card key={rule.id} className="p-4 bg-[var(--glass-05)] border-[var(--glass-border)] hover:bg-[var(--glass-10)] transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-black text-white">{rule.name}</h4>
                      <p className="text-[10px] font-bold text-[var(--primary-600)] uppercase tracking-widest mt-1">
                        {RULE_TYPE_LABELS[rule.rule_type]}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(rule)} className="p-1.5 rounded-lg hover:bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white transition-all">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => setDeleteConfirm(rule)} className="p-1.5 rounded-lg hover:bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="p-2 rounded-xl bg-[var(--dark-950)]/50 border border-[var(--glass-border)] text-center">
                      <p className="text-[9px] font-black text-[var(--on-glass-muted)] uppercase tracking-tighter">Threshold</p>
                      <p className="text-xs font-black text-white">{rule.threshold_hours}h</p>
                    </div>
                    <div className="p-2 rounded-xl bg-[var(--dark-950)]/50 border border-[var(--glass-border)] text-center">
                      <p className="text-[9px] font-black text-[var(--on-glass-muted)] uppercase tracking-tighter">Rate</p>
                      <p className="text-xs font-black text-[var(--secondary)]">{rule.multiplier}x</p>
                    </div>
                    <div className="p-2 rounded-xl bg-[var(--dark-950)]/50 border border-[var(--glass-border)] text-center">
                      <p className="text-[9px] font-black text-[var(--on-glass-muted)] uppercase tracking-tighter">Priority</p>
                      <p className="text-xs font-black text-white">#{rule.priority}</p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-between pt-3 border-t border-[var(--glass-border)]">
                      <span className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">Status</span>
                      <button
                        onClick={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })}
                        className={cn(
                          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                          rule.is_active ? 'bg-[var(--primary-600)]' : 'bg-[var(--glass-20)]'
                        )}
                      >
                        <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform', rule.is_active ? 'translate-x-5' : 'translate-x-1')} />
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Form Modal */}
      <Modal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={editRule ? 'Edit Overtime Rule' : 'Add Overtime Rule'}
        size="sm"
        footer={<Button onClick={handleSave} loading={saveMutation.isPending}>{editRule ? 'Save' : 'Add'}</Button>}
      >
        <div className="space-y-4">
          <Input label="Rule Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Daily OT" />
          <Select label="Type" options={RULE_TYPE_OPTIONS} value={form.rule_type} onChange={e => setForm(f => ({ ...f, rule_type: e.target.value as RuleForm['rule_type'] }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Threshold (hrs)" type="number" step="0.5" value={form.threshold_hours} onChange={e => setForm(f => ({ ...f, threshold_hours: +e.target.value }))} />
            <Input label="Multiplier" type="number" step="0.1" value={form.multiplier} onChange={e => setForm(f => ({ ...f, multiplier: +e.target.value }))} />
          </div>
          <Input label="Priority (1-99)" type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value }))} />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
        loading={deleteMutation.isPending}
        title="Delete Rule"
        message={`Delete rule "${deleteConfirm?.name}"?`}
        variant="danger"
      />
    </>
  );
}

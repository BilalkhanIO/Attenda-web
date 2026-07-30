'use client';
import { useState } from 'react';
import { Card, Button, Input, Modal, ConfirmDialog, Skeleton } from '@/components/ui';
import { orgApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError } from '@/lib/utils';
import { CalendarPlus, Plus, Edit2, Trash2, CalendarOff } from 'lucide-react';
import toast from 'react-hot-toast';

export interface AccrualRule {
  days_per_year: number;
  carry_over_max?: number;
}

export type LeaveAccrualPolicy = Record<string, AccrualRule>;

interface EditorState {
  mode: 'create' | 'edit';
  type: string;
  daysPerYear: string;
  carryOverMax: string;
  errors: { type?: string; daysPerYear?: string; carryOverMax?: string };
}

interface LeaveAccrualCardProps {
  policy: LeaveAccrualPolicy | null | undefined;
  loading: boolean;
  onSaved: () => void;
}

const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;

/** Org-wide automatic leave accrual policy (per leave type). */
export default function LeaveAccrualCard({ policy, loading, onSaved }: LeaveAccrualCardProps) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.settings.update');

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteType, setDeleteType] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const entries = Object.entries(policy ?? {}).sort(([a], [b]) => a.localeCompare(b));

  const save = async (next: LeaveAccrualPolicy | null) => {
    // Endpoint merges per-key — send only leave_accrual.
    await orgApi.updateSettings({ leave_accrual: next });
    onSaved();
  };

  const validateEditor = (e: EditorState): EditorState['errors'] => {
    const errors: EditorState['errors'] = {};
    const type = e.type.trim().toLowerCase();
    if (!type) errors.type = 'Enter a leave type';
    else if (type.length > 40) errors.type = 'Keep it under 40 characters';
    else if (!SLUG_RE.test(type)) errors.type = 'Lowercase letters, numbers, - and _ only (e.g. annual, sick)';
    else if (e.mode === 'create' && policy?.[type]) errors.type = `"${type}" is already configured — edit it instead`;

    const days = Number(e.daysPerYear);
    if (e.daysPerYear.trim() === '' || Number.isNaN(days)) errors.daysPerYear = 'Enter days per year';
    else if (days < 0.5 || days > 366) errors.daysPerYear = 'Must be between 0.5 and 366';

    if (e.carryOverMax.trim() !== '') {
      const cap = Number(e.carryOverMax);
      if (Number.isNaN(cap)) errors.carryOverMax = 'Enter a number, or leave blank for 0';
      else if (cap < 0 || cap > 366) errors.carryOverMax = 'Must be between 0 and 366';
    }
    return errors;
  };

  const onSaveEditor = async () => {
    if (!editor) return;
    const errors = validateEditor(editor);
    if (Object.keys(errors).length > 0) { setEditor({ ...editor, errors }); return; }

    const type = editor.type.trim().toLowerCase();
    const rule: AccrualRule = { days_per_year: Number(editor.daysPerYear) };
    if (editor.carryOverMax.trim() !== '') rule.carry_over_max = Number(editor.carryOverMax);

    setSaving(true);
    try {
      await save({ ...(policy ?? {}), [type]: rule });
      toast.success(editor.mode === 'create' ? `Accrual added for "${type}"` : `Accrual updated for "${type}"`);
      setEditor(null);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteType) return;
    setDeleting(true);
    try {
      const next = { ...(policy ?? {}) };
      delete next[deleteType];
      await save(Object.keys(next).length > 0 ? next : null);
      toast.success(`Accrual removed for "${deleteType}"`);
      setDeleteType(null);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const onDisable = async () => {
    setDisabling(true);
    try {
      await save(null);
      toast.success('Leave accrual disabled');
      setConfirmDisable(false);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDisabling(false);
    }
  };

  const openCreate = () => setEditor({ mode: 'create', type: '', daysPerYear: '', carryOverMax: '', errors: {} });
  const openEdit = (type: string, rule: AccrualRule) => setEditor({
    mode: 'edit',
    type,
    daysPerYear: String(rule.days_per_year),
    carryOverMax: rule.carry_over_max != null ? String(rule.carry_over_max) : '',
    errors: {},
  });

  return (
    <Card className="glass-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <CalendarPlus size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Leave Accrual</h3>
            <p className="text-xs text-slate-400">Automatic monthly leave balance accrual per leave type</p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <Button variant="ghost" size="sm" icon={<CalendarOff size={14} />} onClick={() => setConfirmDisable(true)}>
                Disable
              </Button>
            )}
            <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={openCreate}>
              Add Leave Type
            </Button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
        On the 1st of each month every active employee accrues days ÷ 12 (rounded to 2 dp) for each type
        below. Each January, unused prior-year balance carries over up to the carry-over cap (default 0).
      </p>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center rounded-xl border border-dashed border-glass">
          <CalendarPlus size={26} className="text-slate-700 mb-2" />
          <p className="text-sm font-semibold text-slate-500">Accrual is off</p>
          <p className="text-xs text-slate-600 mt-1">Add a leave type (e.g. annual, sick) to start accruing balances monthly</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {entries.map(([type, rule]) => (
            <div key={type} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group">
              <span className="text-sm font-semibold text-slate-200 truncate capitalize">{type}</span>
              <span className="text-[11px] text-slate-500">
                {rule.days_per_year} days/yr
                <span className="text-slate-600"> · {(rule.days_per_year / 12).toFixed(2)}/mo</span>
                <span className="text-slate-600"> · carry-over max {rule.carry_over_max ?? 0}</span>
              </span>
              {canManage && (
                <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    title="Edit"
                    aria-label={`Edit ${type} accrual`}
                    onClick={() => openEdit(type, rule)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    title="Remove"
                    aria-label={`Remove ${type} accrual`}
                    onClick={() => setDeleteType(type)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-white/5"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'edit' ? `Edit "${editor.type}" Accrual` : 'Add Leave Type'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditor(null)}>Cancel</Button>
            <Button loading={saving} onClick={onSaveEditor}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Leave Type"
            required
            autoFocus={editor?.mode === 'create'}
            disabled={editor?.mode === 'edit'}
            maxLength={40}
            value={editor?.type ?? ''}
            onChange={e => setEditor(prev => prev ? { ...prev, type: e.target.value.toLowerCase(), errors: { ...prev.errors, type: undefined } } : prev)}
            placeholder="e.g. annual, sick, casual"
            error={editor?.errors.type}
            hint="Lowercase slug, max 40 characters"
          />
          <Input
            label="Days per Year"
            required
            type="number"
            min={0.5}
            max={366}
            step="0.5"
            autoFocus={editor?.mode === 'edit'}
            value={editor?.daysPerYear ?? ''}
            onChange={e => setEditor(prev => prev ? { ...prev, daysPerYear: e.target.value, errors: { ...prev.errors, daysPerYear: undefined } } : prev)}
            placeholder="e.g. 21"
            error={editor?.errors.daysPerYear}
            hint={(() => {
              const d = Number(editor?.daysPerYear);
              return !Number.isNaN(d) && d > 0 ? `≈ ${(d / 12).toFixed(2)} days accrued per month` : 'Accrued monthly at days ÷ 12';
            })()}
          />
          <Input
            label="Carry-over Max (days)"
            type="number"
            min={0}
            max={366}
            step="0.5"
            value={editor?.carryOverMax ?? ''}
            onChange={e => setEditor(prev => prev ? { ...prev, carryOverMax: e.target.value, errors: { ...prev.errors, carryOverMax: undefined } } : prev)}
            placeholder="0"
            error={editor?.errors.carryOverMax}
            hint="Unused balance carried into January, capped here — blank means 0"
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteType}
        onClose={() => setDeleteType(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Remove leave type?"
        message={`"${deleteType}" will stop accruing on the monthly run. Existing balances are not changed.`}
        confirmLabel="Remove"
      />

      <ConfirmDialog
        isOpen={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        onConfirm={onDisable}
        loading={disabling}
        title="Disable leave accrual?"
        message="The whole accrual policy will be cleared and no leave types will accrue on the monthly run. Existing balances are not changed."
        confirmLabel="Disable"
      />
    </Card>
  );
}

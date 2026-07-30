'use client';
import { useState } from 'react';
import { Card, Button, Input, ConfirmDialog, Skeleton } from '@/components/ui';
import { orgApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError } from '@/lib/utils';
import { AlarmClock, Plus, Trash2, Save, Eraser } from 'lucide-react';
import toast from 'react-hot-toast';

export interface LatePolicy {
  absent_after_mins?: number;
  tiers?: { after_mins: number; points: number }[];
  points_window_days?: number;
  alert_threshold_points?: number;
}

interface TierDraft {
  afterMins: string;
  points: string;
  errors: { afterMins?: string; points?: string };
}

interface FormState {
  absentAfter: string;
  windowDays: string;
  alertThreshold: string;
  tiers: TierDraft[];
  errors: { absentAfter?: string; windowDays?: string; alertThreshold?: string };
}

interface LatePolicyCardProps {
  policy: LatePolicy | null | undefined;
  loading: boolean;
  onSaved: () => void;
}

const MAX_TIERS = 10;

function toForm(policy: LatePolicy | null | undefined): FormState {
  return {
    absentAfter: policy?.absent_after_mins != null ? String(policy.absent_after_mins) : '',
    windowDays: policy?.points_window_days != null ? String(policy.points_window_days) : '',
    alertThreshold: policy?.alert_threshold_points != null ? String(policy.alert_threshold_points) : '',
    tiers: (policy?.tiers ?? []).map(t => ({ afterMins: String(t.after_mins), points: String(t.points), errors: {} })),
    errors: {},
  };
}

/** Org-wide lateness policy: no-show absence cutoff + lateness points and alerting. */
export default function LatePolicyCard({ policy, loading, onSaved }: LatePolicyCardProps) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.settings.update');

  const [form, setForm] = useState<FormState>(() => toForm(policy));
  const [seeded, setSeeded] = useState(policy);
  // Re-seed the editable form whenever fresh server data arrives
  // ("adjusting state when props change" pattern — no effect needed).
  if (policy !== seeded) {
    setSeeded(policy);
    setForm(toForm(policy));
  }

  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const hasPolicy = !!policy && Object.keys(policy).length > 0;

  const setField = (key: 'absentAfter' | 'windowDays' | 'alertThreshold', value: string) =>
    setForm(prev => ({ ...prev, [key]: value, errors: { ...prev.errors, [key]: undefined } }));

  const setTier = (i: number, key: 'afterMins' | 'points', value: string) =>
    setForm(prev => ({
      ...prev,
      tiers: prev.tiers.map((t, idx) => idx === i ? { ...t, [key]: value, errors: { ...t.errors, [key]: undefined } } : t),
    }));

  const addTier = () => setForm(prev => prev.tiers.length >= MAX_TIERS ? prev
    : { ...prev, tiers: [...prev.tiers, { afterMins: '', points: '', errors: {} }] });

  const removeTier = (i: number) => setForm(prev => ({ ...prev, tiers: prev.tiers.filter((_, idx) => idx !== i) }));

  const intInRange = (raw: string, min: number, max: number, label: string): string | undefined => {
    const n = Number(raw);
    if (Number.isNaN(n) || !Number.isInteger(n)) return `${label} must be a whole number`;
    if (n < min || n > max) return `Must be between ${min} and ${max}`;
    return undefined;
  };

  const numInRange = (raw: string, min: number, max: number): string | undefined => {
    const n = Number(raw);
    if (Number.isNaN(n)) return 'Enter a number';
    if (n < min || n > max) return `Must be between ${min} and ${max}`;
    return undefined;
  };

  const onSave = async () => {
    const errors: FormState['errors'] = {};
    if (form.absentAfter.trim() !== '') errors.absentAfter = intInRange(form.absentAfter, 30, 720, 'Minutes');
    if (form.windowDays.trim() !== '') errors.windowDays = intInRange(form.windowDays, 7, 365, 'Days');
    if (form.alertThreshold.trim() !== '') errors.alertThreshold = numInRange(form.alertThreshold, 0.5, 1000);

    const tiers = form.tiers.map(t => ({
      ...t,
      errors: {
        afterMins: t.afterMins.trim() === '' ? 'Required' : intInRange(t.afterMins, 1, 720, 'Minutes'),
        points: t.points.trim() === '' ? 'Required' : numInRange(t.points, 0.5, 100),
      },
    }));

    const hasErrors = Object.values(errors).some(Boolean)
      || tiers.some(t => t.errors.afterMins || t.errors.points);
    if (hasErrors) {
      setForm(prev => ({ ...prev, errors, tiers }));
      toast.error('Fix the highlighted fields before saving');
      return;
    }

    const next: LatePolicy = {};
    if (form.absentAfter.trim() !== '') next.absent_after_mins = Number(form.absentAfter);
    if (form.windowDays.trim() !== '') next.points_window_days = Number(form.windowDays);
    if (form.alertThreshold.trim() !== '') next.alert_threshold_points = Number(form.alertThreshold);
    if (form.tiers.length > 0) {
      next.tiers = form.tiers
        .map(t => ({ after_mins: Number(t.afterMins), points: Number(t.points) }))
        .sort((a, b) => a.after_mins - b.after_mins);
    }

    if (Object.keys(next).length === 0) {
      toast.error(hasPolicy ? 'Everything is blank — use Clear Policy to remove it' : 'Set at least one field before saving');
      return;
    }

    setSaving(true);
    try {
      // Endpoint merges per-key — send only late_policy.
      await orgApi.updateSettings({ late_policy: next });
      toast.success('Late policy saved');
      onSaved();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    setClearing(true);
    try {
      await orgApi.updateSettings({ late_policy: null });
      toast.success('Late policy cleared');
      setConfirmClear(false);
      onSaved();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card className="glass-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <AlarmClock size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Late Policy</h3>
            <p className="text-xs text-slate-400">No-show absence cutoff, lateness points and manager alerts</p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {hasPolicy && (
              <Button variant="ghost" size="sm" icon={<Eraser size={14} />} onClick={() => setConfirmClear(true)}>
                Clear Policy
              </Button>
            )}
            <Button variant="outline" size="sm" icon={<Save size={14} />} loading={saving} onClick={onSave}>
              Save Policy
            </Button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
        With no check-in this many minutes after shift start, the hourly detector marks the day absent
        (default 120). Tiers convert minutes-late into points — the highest tier reached applies. A nightly
        scan alerts managers and HR about anyone whose rolling points over the window reach the threshold.
      </p>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Absent After (mins)"
              type="number"
              min={30}
              max={720}
              disabled={!canManage}
              value={form.absentAfter}
              onChange={e => setField('absentAfter', e.target.value)}
              placeholder="120"
              error={form.errors.absentAfter}
              hint="30–720 · blank uses default 120"
            />
            <Input
              label="Points Window (days)"
              type="number"
              min={7}
              max={365}
              disabled={!canManage}
              value={form.windowDays}
              onChange={e => setField('windowDays', e.target.value)}
              placeholder="30"
              error={form.errors.windowDays}
              hint="7–365 · blank uses default 30"
            />
            <Input
              label="Alert Threshold (points)"
              type="number"
              min={0.5}
              max={1000}
              step="0.5"
              disabled={!canManage}
              value={form.alertThreshold}
              onChange={e => setField('alertThreshold', e.target.value)}
              placeholder="e.g. 6"
              error={form.errors.alertThreshold}
              hint="0.5–1000 · alerts managers + HR"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em]">
                Lateness Tiers <span className="text-slate-600 normal-case font-bold">({form.tiers.length}/{MAX_TIERS})</span>
              </p>
              {canManage && (
                <Button variant="ghost" size="sm" icon={<Plus size={13} />} disabled={form.tiers.length >= MAX_TIERS} onClick={addTier}>
                  Add Tier
                </Button>
              )}
            </div>
            {form.tiers.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center rounded-xl border border-dashed border-glass">
                <p className="text-sm font-semibold text-slate-500">No tiers configured</p>
                <p className="text-xs text-slate-600 mt-1">e.g. after 15 min → 1 point, after 60 min → 3 points</p>
              </div>
            ) : (
              <div className="space-y-2">
                {form.tiers.map((tier, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <span className="text-[11px] text-slate-500 pt-3.5 whitespace-nowrap">after</span>
                    <div className="w-28">
                      <Input
                        aria-label={`Tier ${i + 1} minutes late`}
                        type="number"
                        min={1}
                        max={720}
                        disabled={!canManage}
                        value={tier.afterMins}
                        onChange={e => setTier(i, 'afterMins', e.target.value)}
                        placeholder="mins"
                        error={tier.errors.afterMins}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 pt-3.5 whitespace-nowrap">min late →</span>
                    <div className="w-28">
                      <Input
                        aria-label={`Tier ${i + 1} points`}
                        type="number"
                        min={0.5}
                        max={100}
                        step="0.5"
                        disabled={!canManage}
                        value={tier.points}
                        onChange={e => setTier(i, 'points', e.target.value)}
                        placeholder="points"
                        error={tier.errors.points}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 pt-3.5">points</span>
                    {canManage && (
                      <button
                        title="Remove tier"
                        aria-label={`Remove tier ${i + 1}`}
                        onClick={() => removeTier(i)}
                        className="ml-auto mt-2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-white/5"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
                <p className="text-[11px] text-slate-600">Tiers are sorted by minutes when saved; the highest tier reached applies.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={onClear}
        loading={clearing}
        title="Clear late policy?"
        message="Absence cutoff falls back to the 120-minute default and no lateness points or alerts will be tracked."
        confirmLabel="Clear"
      />
    </Card>
  );
}

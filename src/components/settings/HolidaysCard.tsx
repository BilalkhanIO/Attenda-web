'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Modal, ConfirmDialog, Skeleton, DatePicker } from '@/components/ui';
import { orgApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError, runDeferred, formatDateOnly } from '@/lib/utils';
import { CalendarHeart, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export interface OrgHoliday {
  id: string;
  date: string;
  name: string;
  recurring: boolean;
}

interface EditorState {
  date: string;
  name: string;
  recurring: boolean;
  errors: { date?: string; name?: string };
}

/** Org-wide public holidays (rendered on calendars, skipped by attendance). */
export default function HolidaysCard() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.settings.update');

  const [holidays, setHolidays] = useState<OrgHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrgHoliday | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await orgApi.getHolidays();
      setHolidays((data.data as OrgHoliday[]) || []);
    } catch { /* ignore — card stays empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => runDeferred(load), [load]);

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  const validateEditor = (e: EditorState): EditorState['errors'] => {
    const errors: EditorState['errors'] = {};
    if (!e.date) errors.date = 'Pick a date';
    if (!e.name.trim()) errors.name = 'Enter a holiday name';
    else if (e.name.trim().length > 80) errors.name = 'Keep it under 80 characters';
    return errors;
  };

  const onSave = async () => {
    if (!editor) return;
    const errors = validateEditor(editor);
    if (Object.keys(errors).length > 0) { setEditor({ ...editor, errors }); return; }
    setSaving(true);
    try {
      await orgApi.createHoliday({
        date: editor.date,
        name: editor.name.trim(),
        recurring: editor.recurring,
      });
      toast.success('Holiday added');
      setEditor(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await orgApi.deleteHoliday(deleteTarget.id);
      toast.success('Holiday deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="glass-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <CalendarHeart size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Public Holidays</h3>
            <p className="text-xs text-slate-400">Company holidays shown on calendars and excluded from attendance</p>
          </div>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" icon={<Plus size={14} />}
            onClick={() => setEditor({ date: '', name: '', recurring: false, errors: {} })}>
            Add Holiday
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center rounded-xl border border-dashed border-glass">
          <CalendarHeart size={26} className="text-slate-700 mb-2" />
          <p className="text-sm font-semibold text-slate-500">No holidays yet</p>
          <p className="text-xs text-slate-600 mt-1">Add public holidays so nobody is marked absent on days off</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {sorted.map(holiday => (
            <div key={holiday.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group">
              <span className="text-sm font-semibold text-slate-200 whitespace-nowrap">{formatDateOnly(holiday.date)}</span>
              <span className="text-[11px] text-slate-500 truncate">{holiday.name}</span>
              {holiday.recurring && (
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                  Annual
                </span>
              )}
              {canManage && (
                <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    title="Delete"
                    aria-label={`Delete ${holiday.name}`}
                    onClick={() => setDeleteTarget(holiday)}
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
        title="Add Holiday"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditor(null)}>Cancel</Button>
            <Button loading={saving} onClick={onSave}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <DatePicker
            label="Date"
            required
            value={editor?.date ?? ''}
            onChange={v => setEditor(prev => prev ? { ...prev, date: v, errors: { ...prev.errors, date: undefined } } : prev)}
            error={editor?.errors.date}
          />
          <Input
            label="Holiday Name"
            required
            maxLength={80}
            value={editor?.name ?? ''}
            onChange={e => setEditor(prev => prev ? { ...prev, name: e.target.value, errors: { ...prev.errors, name: undefined } } : prev)}
            onKeyDown={e => { if (e.key === 'Enter') onSave(); }}
            placeholder="e.g. New Year's Day"
            error={editor?.errors.name}
          />
          <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={editor?.recurring ?? false}
              onChange={e => setEditor(prev => prev ? { ...prev, recurring: e.target.checked } : prev)}
              className="w-4 h-4 rounded bg-[var(--dark-800)] border-[var(--glass-border)] checked:bg-[var(--primary-600)] accent-[var(--primary-600)]"
            />
            <span className="text-sm text-[var(--on-glass-sub)]">Repeats every year</span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete holiday?"
        message={`"${deleteTarget?.name}" will be removed from the org calendar.`}
        confirmLabel="Delete"
      />
    </Card>
  );
}

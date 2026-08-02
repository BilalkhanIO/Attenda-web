'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Modal, ConfirmDialog, Skeleton } from '@/components/ui';
import { orgWebhooksApi, type OrgWebhook } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, getApiError, runDeferred, formatDateTime } from '@/lib/utils';
import { Webhook, Plus, Trash2, Copy, Check, Send, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

// Mirrors the API's WEBHOOK_EVENT_TYPES enum.
const EVENT_TYPES: { key: string; label: string }[] = [
  { key: 'attendance_changed', label: 'Attendance' },
  { key: 'leave_changed',      label: 'Leave' },
  { key: 'overtime_changed',   label: 'Overtime' },
  { key: 'remote_changed',     label: 'Remote work' },
  { key: 'swap_changed',       label: 'Shift swaps' },
  { key: 'expense_changed',    label: 'Expenses' },
];

const EVENT_LABELS = Object.fromEntries(EVENT_TYPES.map(e => [e.key, e.label]));

interface EditorState {
  url: string;
  events: string[];
  errors: { url?: string; events?: string };
}

function validateEditor(e: EditorState): EditorState['errors'] {
  const errors: EditorState['errors'] = {};
  const url = e.url.trim();
  if (!url) errors.url = 'Enter an endpoint URL';
  else if (!url.startsWith('https://')) errors.url = 'Webhook endpoints must use https://';
  else if (url.length > 1000) errors.url = 'Keep it under 1000 characters';
  else { try { new URL(url); } catch { errors.url = 'Enter a valid URL'; } }
  if (e.events.length === 0) errors.events = 'Pick at least one event';
  return errors;
}

/**
 * Outbound webhooks: signed event notifications pushed to external systems.
 * Every route is gated on org.settings.update, so the card renders only for
 * users holding that permission. The signing secret is shown exactly once —
 * in the confirm dialog right after creation.
 */
export default function WebhooksCard() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.settings.update');

  const [hooks, setHooks] = useState<OrgWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [secretReveal, setSecretReveal] = useState<{ url: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrgWebhook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await orgWebhooksApi.getAll();
      setHooks((data.data as OrgWebhook[]) || []);
    } catch { /* ignore — card stays empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (canManage) return runDeferred(load);
  }, [canManage, load]);

  if (!canManage) return null;

  const toggleEvent = (key: string) => {
    setEditor(prev => prev ? {
      ...prev,
      events: prev.events.includes(key)
        ? prev.events.filter(e => e !== key)
        : [...prev.events, key],
      errors: { ...prev.errors, events: undefined },
    } : prev);
  };

  const onSave = async () => {
    if (!editor) return;
    const errors = validateEditor(editor);
    if (Object.keys(errors).length > 0) { setEditor({ ...editor, errors }); return; }
    setSaving(true);
    try {
      const { data } = await orgWebhooksApi.create({ url: editor.url.trim(), events: editor.events });
      const created = data.data as OrgWebhook & { secret: string };
      setEditor(null);
      setCopied(false);
      // The one and only chance to show the signing secret.
      setSecretReveal({ url: created.url, secret: created.secret });
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const onCopySecret = async () => {
    if (!secretReveal) return;
    try {
      await navigator.clipboard.writeText(secretReveal.secret);
      setCopied(true);
      toast.success('Secret copied to clipboard');
    } catch {
      toast.error('Copy failed — select and copy the secret manually');
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await orgWebhooksApi.remove(deleteTarget.id);
      toast.success('Webhook deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const onTest = async (hook: OrgWebhook) => {
    setTestingId(hook.id);
    try {
      const { data } = await orgWebhooksApi.test(hook.id);
      if (data.data?.delivered) toast.success('Test event delivered');
      else toast.error('Test event was not accepted by the endpoint');
      load(); // refresh last success/failure bookkeeping
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Card className="glass-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
            <Webhook size={16} className="text-sky-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Outbound Webhooks</h3>
            <p className="text-xs text-slate-400">Signed event notifications pushed to your external systems</p>
          </div>
        </div>
        <Button variant="outline" size="sm" icon={<Plus size={14} />}
          onClick={() => setEditor({ url: '', events: [], errors: {} })}>
          Add Webhook
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : hooks.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center rounded-xl border border-dashed border-glass">
          <Webhook size={26} className="text-slate-700 mb-2" />
          <p className="text-sm font-semibold text-slate-500">No webhooks yet</p>
          <p className="text-xs text-slate-600 mt-1">Add an https endpoint to receive signed event notifications</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {hooks.map(hook => (
            <div key={hook.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-mono font-semibold text-slate-200 truncate">{hook.url}</span>
                  <span className={cn(
                    'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border flex-shrink-0',
                    hook.is_active
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                  )}>
                    {hook.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {hook.events.map(ev => (
                    <span key={ev} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {EVENT_LABELS[ev] ?? ev}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {hook.last_success_at
                    ? `Last success ${formatDateTime(hook.last_success_at)}`
                    : 'No successful delivery yet'}
                  {hook.last_failure_at && ` · Last failure ${formatDateTime(hook.last_failure_at)}`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="sm" variant="ghost" icon={<Send size={12} />}
                  loading={testingId === hook.id}
                  onClick={() => onTest(hook)}>
                  Send test
                </Button>
                <button
                  title="Delete"
                  aria-label={`Delete webhook ${hook.url}`}
                  onClick={() => setDeleteTarget(hook)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-white/5"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!editor}
        onClose={() => setEditor(null)}
        title="Add Webhook"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditor(null)}>Cancel</Button>
            <Button loading={saving} onClick={onSave}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Endpoint URL"
            required
            maxLength={1000}
            placeholder="https://example.com/hooks/attenda"
            value={editor?.url ?? ''}
            onChange={e => setEditor(prev => prev ? { ...prev, url: e.target.value, errors: { ...prev.errors, url: undefined } } : prev)}
            error={editor?.errors.url}
            hint="Must be an https endpoint. Deliveries carry an X-Attenda-Signature HMAC header."
          />
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-[0.1em]">
              Events<span className="text-[var(--danger-500)] ml-1">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_TYPES.map(ev => (
                <label key={ev.key} className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)] transition-colors">
                  <input
                    type="checkbox"
                    checked={editor?.events.includes(ev.key) ?? false}
                    onChange={() => toggleEvent(ev.key)}
                    className="w-4 h-4 rounded bg-[var(--dark-800)] border-[var(--glass-border)] checked:bg-[var(--primary-600)] accent-[var(--primary-600)]"
                  />
                  <span className="text-sm text-[var(--on-glass-sub)]">{ev.label}</span>
                </label>
              ))}
            </div>
            {editor?.errors.events && (
              <p className="text-xs text-[var(--danger-500)] font-medium flex items-center gap-1.5"><AlertTriangle size={12} />{editor.errors.events}</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!secretReveal}
        onClose={() => setSecretReveal(null)}
        title="Webhook created — save the secret"
        size="md"
        footer={<Button onClick={() => setSecretReveal(null)}>Done</Button>}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              Store this signing secret now — <span className="font-bold">it won&apos;t be shown again</span>.
              Use it to verify the <span className="font-mono">X-Attenda-Signature</span> HMAC on every delivery
              to <span className="font-mono break-all">{secretReveal?.url}</span>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-[var(--dark-800)] border border-[var(--glass-border)] text-xs font-mono text-white break-all select-all">
              {secretReveal?.secret}
            </code>
            <Button size="sm" variant="outline" icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={onCopySecret}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete webhook?"
        message={`${deleteTarget?.url} will stop receiving event notifications immediately.`}
        confirmLabel="Delete"
      />
    </Card>
  );
}

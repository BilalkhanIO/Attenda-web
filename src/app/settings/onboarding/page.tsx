'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Input, Textarea, Dropdown, Modal, ConfirmDialog,
  Table, Badge, EmptyState,
} from '@/components/ui';
import { onboardingApi, type OnboardingTemplateItemInput } from '@/lib/api';
import {
  keys, onboardingTemplatesQuery, selectableUsersQuery,
  type OnboardingTemplate,
} from '@/lib/queries';
import { getApiError } from '@/lib/utils';
import {
  ListChecks, Plus, Trash2, Pencil, ArrowUp, ArrowDown, UserPlus,
  CheckCircle2, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_ITEMS = 50;

// ─── Template editor ──────────────────────────────────

interface EditableItem {
  key: number; // stable list key across reorders
  title: string;
  description: string;
  due_days: string; // raw input; '' = no due date
  assignee_role: 'employee' | 'manager';
}

let nextItemKey = 1;
const blankItem = (): EditableItem =>
  ({ key: nextItemKey++, title: '', description: '', due_days: '', assignee_role: 'employee' });

function toEditableItems(template?: OnboardingTemplate | null): EditableItem[] {
  if (!template || template.items.length === 0) return [blankItem()];
  return [...template.items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(i => ({
      key: nextItemKey++,
      title: i.title,
      description: i.description ?? '',
      due_days: i.due_days == null ? '' : String(i.due_days),
      assignee_role: i.assignee_role,
    }));
}

const ASSIGNEE_OPTIONS = [
  { value: 'employee', label: 'New hire' },
  { value: 'manager', label: 'Manager' },
];

function TemplateEditorModal({ template, onClose }: {
  template: OnboardingTemplate | null; // null = create
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(template?.name ?? '');
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [items, setItems] = useState<EditableItem[]>(() => toEditableItems(template));

  const patchItem = (key: number, patch: Partial<EditableItem>) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, ...patch } : i)));

  const removeItem = (key: number) =>
    setItems(prev => (prev.length > 1 ? prev.filter(i => i.key !== key) : prev));

  const moveItem = (key: number, dir: -1 | 1) =>
    setItems(prev => {
      const idx = prev.findIndex(i => i.key === key);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  const addItem = () =>
    setItems(prev => (prev.length >= MAX_ITEMS ? prev : [...prev, blankItem()]));

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        is_default: isDefault,
        items: items.map((i, idx): OnboardingTemplateItemInput => ({
          title: i.title.trim(),
          description: i.description.trim() || null,
          due_days: i.due_days === '' ? null : Number(i.due_days),
          sort_order: idx,
          assignee_role: i.assignee_role,
        })),
      };
      return template
        ? onboardingApi.updateTemplate(template.id, payload)
        : onboardingApi.createTemplate(payload);
    },
    meta: { silent: true },
    onSuccess: () => {
      toast.success(template ? 'Template updated' : 'Template created');
      queryClient.invalidateQueries({ queryKey: keys.onboarding.all });
      onClose();
    },
    onError: err => toast.error(getApiError(err)),
  });

  const handleSave = () => {
    if (!name.trim()) { toast.error('Template name is required'); return; }
    if (items.some(i => !i.title.trim())) { toast.error('Every item needs a title'); return; }
    const badDue = items.find(i => i.due_days !== '' &&
      (!Number.isInteger(Number(i.due_days)) || Number(i.due_days) < 0 || Number(i.due_days) > 365));
    if (badDue) { toast.error('Due days must be a whole number between 0 and 365'); return; }
    saveMutation.mutate();
  };

  return (
    <Modal isOpen onClose={onClose} title={template ? 'Edit Template' : 'New Template'} size="xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} loading={saveMutation.isPending}>
            {template ? 'Save Changes' : 'Create Template'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Template Name" required value={name} maxLength={120}
          onChange={e => setName(e.target.value)} placeholder="e.g. Engineering new hire" />

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={e => setIsDefault(e.target.checked)}
            className="w-4 h-4 accent-[var(--primary-600)] cursor-pointer"
          />
          <span className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-[0.1em]">
            Default template (only one per organization)
          </span>
        </label>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-[0.1em]">
              Checklist Items ({items.length}/{MAX_ITEMS})
            </p>
            <Button size="sm" variant="ghost" icon={<Plus size={13} />}
              disabled={items.length >= MAX_ITEMS} onClick={addItem}>
              Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.key} className="panel space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-[var(--on-glass-dim)] w-5 shrink-0">
                    {idx + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <Input value={item.title} maxLength={200} placeholder="Task title"
                      aria-label={`Item ${idx + 1} title`}
                      onChange={e => patchItem(item.key, { title: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" aria-label="Move item up" title="Move up"
                      disabled={idx === 0} onClick={() => moveItem(item.key, -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--on-glass-dim)] hover:bg-[var(--glass-10)] hover:text-white disabled:opacity-30 transition-all">
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" aria-label="Move item down" title="Move down"
                      disabled={idx === items.length - 1} onClick={() => moveItem(item.key, 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--on-glass-dim)] hover:bg-[var(--glass-10)] hover:text-white disabled:opacity-30 transition-all">
                      <ArrowDown size={13} />
                    </button>
                    <button type="button" aria-label="Remove item" title="Remove"
                      disabled={items.length <= 1} onClick={() => removeItem(item.key)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 disabled:opacity-30 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="pl-7 grid grid-cols-1 sm:grid-cols-[1fr_120px_150px] gap-2.5">
                  <Textarea rows={1} value={item.description} maxLength={2000}
                    placeholder="Description (optional)"
                    aria-label={`Item ${idx + 1} description`}
                    onChange={e => patchItem(item.key, { description: e.target.value })} />
                  <Input type="number" min={0} max={365} value={item.due_days}
                    placeholder="Due days" aria-label={`Item ${idx + 1} due days`}
                    hint="Days from assignment"
                    onChange={e => patchItem(item.key, { due_days: e.target.value })} />
                  <Dropdown
                    value={item.assignee_role}
                    onChange={v => patchItem(item.key, { assignee_role: (v || 'employee') as 'employee' | 'manager' })}
                    options={ASSIGNEE_OPTIONS}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Assign card ──────────────────────────────────────

function AssignCard({ templates }: { templates: OnboardingTemplate[] }) {
  const [userId, setUserId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: boolean; userName: string } | null>(null);

  // The users list endpoint the employees page uses (active members).
  const usersQ = useQuery(selectableUsersQuery());
  const users = useMemo(() => usersQ.data ?? [], [usersQ.data]);
  const userOptions = useMemo(
    () => users.map(u => ({ value: u.id, label: `${u.name} — ${u.department || u.email}` })),
    [users],
  );

  const assignMutation = useMutation({
    mutationFn: () => onboardingApi.assign({ user_id: userId, template_id: templateId }),
    onSuccess: res => {
      const data = res.data.data as { created: number; skipped: boolean };
      setResult({
        created: data.created,
        skipped: data.skipped,
        userName: users.find(u => u.id === userId)?.name ?? 'the employee',
      });
      setUserId('');
      setTemplateId('');
    },
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus size={16} className="text-[var(--primary-600)]" />
        <h2 className="text-xs font-black text-white uppercase tracking-widest">Assign to Employee</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Dropdown label="Employee" required value={userId} onChange={setUserId}
          placeholder={usersQ.isLoading ? 'Loading employees…' : 'Select employee'}
          options={userOptions} />
        <Dropdown label="Template" required value={templateId} onChange={setTemplateId}
          placeholder="Select template"
          options={templates.map(t => ({ value: t.id, label: t.is_default ? `${t.name} (default)` : t.name }))} />
      </div>
      <Button size="sm" icon={<UserPlus size={14} />}
        disabled={!userId || !templateId}
        loading={assignMutation.isPending}
        onClick={() => { setResult(null); assignMutation.mutate(); }}>
        Assign Checklist
      </Button>

      {result && (
        <div className={`flex items-center gap-2 p-4 rounded-xl text-sm font-medium ${
          result.skipped
            ? 'bg-[#f59e0b]/10 text-[#f59e0b]'
            : 'bg-[var(--success-500)]/10 text-[var(--success-500)]'
        }`}>
          {result.skipped ? <Info size={16} /> : <CheckCircle2 size={16} />}
          {result.skipped
            ? <>Skipped — {result.userName} already has tasks from this template.</>
            : <>Created {result.created} {result.created === 1 ? 'task' : 'tasks'} for {result.userName}.</>}
        </div>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────

export default function OnboardingSettingsPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<OnboardingTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OnboardingTemplate | null>(null);

  const templatesQ = useQuery(onboardingTemplatesQuery());
  const templates = templatesQ.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => onboardingApi.deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: keys.onboarding.all });
    },
  });

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (t: OnboardingTemplate) => { setEditing(t); setEditorOpen(true); };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title="Onboarding"
          subtitle="Build checklist templates and assign them to new hires"
          actions={
            <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>
              New Template
            </Button>
          }
        />

        <Card>
          <Table
            headers={['Template', 'Items', 'Created By', '']}
            loading={templatesQ.isLoading}
            emptyState={
              <EmptyState
                icon={<ListChecks size={22} />}
                title="No templates yet"
                description="Create your first onboarding checklist template, then assign it to new hires."
                action={<Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>New Template</Button>}
              />
            }
          >
            {templates.map(t => (
              <tr key={t.id} className="hover:bg-[var(--glass-05)] transition-all">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-bold text-white">{t.name}</span>
                    {t.is_default && (
                      <Badge label="Default" color="var(--primary-600)" bg="var(--primary-600)" size="sm" />
                    )}
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className="text-sm font-medium text-[var(--on-glass-muted)]">
                    {t.items.length} {t.items.length === 1 ? 'item' : 'items'}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <span className="text-sm font-medium text-[var(--on-glass-dim)]">{t.creator?.name ?? '—'}</span>
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => openEdit(t)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => setDeleteTarget(t)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <AssignCard templates={templates} />
      </div>

      {editorOpen && (
        <TemplateEditorModal
          key={editing?.id ?? 'new'}
          template={editing}
          onClose={() => setEditorOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Checklists already assigned to employees keep their tasks.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </DashboardLayout>
  );
}

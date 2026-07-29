'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Input, Modal, ConfirmDialog } from '@/components/ui';
import { departmentsApi, type DepartmentNode } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError, runDeferred } from '@/lib/utils';
import { Building2, Plus, Edit2, Trash2, CornerDownRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditorState {
  mode: 'create' | 'rename';
  id?: string;
  parentId?: string | null;
  parentName?: string;
  name: string;
}

export default function DepartmentsCard() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('org.departments.manage');

  const [tree, setTree] = useState<DepartmentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await departmentsApi.getTree();
      setTree((data.data as DepartmentNode[]) || []);
    } catch { /* ignore — card stays empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => runDeferred(load), [load]);

  const onSave = async () => {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) { toast.error('Enter a department name'); return; }
    setSaving(true);
    try {
      if (editor.mode === 'create') {
        await departmentsApi.create(name, editor.parentId ?? null);
        toast.success(editor.parentId ? 'Sub-department added' : 'Department added');
      } else {
        await departmentsApi.update(editor.id!, { name });
        toast.success('Department renamed');
      }
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
      await departmentsApi.remove(deleteTarget.id);
      toast.success('Department deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const row = (node: DepartmentNode, isChild = false) => (
    <div key={node.id}>
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group">
        {isChild && <CornerDownRight size={13} className="text-slate-600 flex-shrink-0 ml-4" />}
        <span className="text-sm font-semibold text-slate-200 truncate">{node.name}</span>
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <Users size={11} /> {node.member_count}
        </span>
        {canManage && (
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isChild && (
              <button
                title="Add sub-department"
                aria-label="Add sub-department"
                onClick={() => setEditor({ mode: 'create', parentId: node.id, parentName: node.name, name: '' })}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:bg-white/5"
              >
                <Plus size={13} />
              </button>
            )}
            <button
              title="Rename"
              aria-label="Rename department"
              onClick={() => setEditor({ mode: 'rename', id: node.id, name: node.name })}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5"
            >
              <Edit2 size={13} />
            </button>
            <button
              title="Delete"
              aria-label="Delete department"
              onClick={() => setDeleteTarget(node)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-white/5"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      {node.children.map(child => row(child, true))}
    </div>
  );

  return (
    <Card className="glass-card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Building2 size={16} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Departments</h3>
            <p className="text-xs text-slate-400">Organise your teams into departments and sub-departments</p>
          </div>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" icon={<Plus size={14} />}
            onClick={() => setEditor({ mode: 'create', parentId: null, name: '' })}>
            Add Department
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-slate-500">Loading…</div>
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center rounded-xl border border-dashed border-glass">
          <Building2 size={26} className="text-slate-700 mb-2" />
          <p className="text-sm font-semibold text-slate-500">No departments yet</p>
          <p className="text-xs text-slate-600 mt-1">Departments keep attendance, leave and reports organised by team</p>
        </div>
      ) : (
        <div className="space-y-0.5">{tree.map(node => row(node))}</div>
      )}

      <Modal
        isOpen={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'rename' ? 'Rename Department'
          : editor?.parentId ? `Add Sub-department to ${editor.parentName}` : 'Add Department'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditor(null)}>Cancel</Button>
            <Button loading={saving} onClick={onSave}>Save</Button>
          </>
        }
      >
        <Input
          label="Department Name"
          required
          autoFocus
          value={editor?.name ?? ''}
          onChange={e => setEditor(prev => prev ? { ...prev, name: e.target.value } : prev)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(); }}
          placeholder="e.g. Engineering"
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete department?"
        message={`"${deleteTarget?.name}" will be removed. Members and sub-departments must be moved out first.`}
        confirmLabel="Delete"
      />
    </Card>
  );
}

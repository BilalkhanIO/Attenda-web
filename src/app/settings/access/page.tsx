'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Input, Modal, ConfirmDialog, Badge, EmptyState,
  Tabs, Skeleton,
} from '@/components/ui';
import { orgRbacApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError } from '@/lib/utils';
import type { OrgRoleRecord, PermissionDef, User, UserPermissionGrant } from '@/types';
import {
  Shield, Plus, Trash2, Edit2, Users, ChevronLeft, KeyRound, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const MODULE_LABELS: Record<string, string> = {
  attendance: 'Attendance',
  leave: 'Leave',
  shifts: 'Shifts',
  payroll: 'Payroll',
  employees: 'Employees',
  org: 'Organisation',
  analytics: 'Analytics',
  reports: 'Reports',
  performance: 'Performance',
  remote: 'Remote work',
  whatsapp: 'WhatsApp',
  overtime: 'Overtime',
};

function groupByModule(catalog: PermissionDef[]): Record<string, PermissionDef[]> {
  const orgCatalog = catalog.filter(p => !p.key.startsWith('platform.'));
  return orgCatalog.reduce<Record<string, PermissionDef[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});
}

export default function AccessSettingsPage() {
  const router = useRouter();
  const { hasPermission, capabilitiesLoading, refreshCapabilities } = useAuth();

  const canManageRoles = hasPermission('org.roles.manage');
  const canGrantPermissions = hasPermission('org.permissions.grant');
  const canAccess = canManageRoles || canGrantPermissions;

  const [activeTab, setActiveTab] = useState(canManageRoles ? 'roles' : 'users');
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [roles, setRoles] = useState<OrgRoleRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [roleModal, setRoleModal] = useState<'create' | 'edit' | 'permissions' | null>(null);
  const [selectedRole, setSelectedRole] = useState<OrgRoleRecord | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleSlug, setRoleSlug] = useState('');
  const [rolePerms, setRolePerms] = useState<Set<string>>(new Set());
  const [savingRole, setSavingRole] = useState(false);
  const [deleteRole, setDeleteRole] = useState<OrgRoleRecord | null>(null);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignRoleId, setAssignRoleId] = useState('');
  const [syncLegacy, setSyncLegacy] = useState(true);
  const [savingAssign, setSavingAssign] = useState(false);
  const [grants, setGrants] = useState<UserPermissionGrant[]>([]);
  const [grantKey, setGrantKey] = useState('');
  const [grantEffect, setGrantEffect] = useState<'allow' | 'deny'>('allow');
  const [savingGrants, setSavingGrants] = useState(false);

  useEffect(() => {
    if (!capabilitiesLoading && !canAccess) {
      router.replace('/settings');
    }
  }, [capabilitiesLoading, canAccess, router]);

  const catalogByModule = useMemo(() => groupByModule(catalog), [catalog]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Promise<void>[] = [
        orgRbacApi.getPermissionCatalog().then(r => setCatalog(r.data.data || [])),
      ];
      if (canManageRoles) {
        tasks.push(orgRbacApi.getRoles().then(r => setRoles(r.data.data || [])));
      }
      if (canGrantPermissions || canManageRoles) {
        tasks.push(
          usersApi.getAll({ limit: 200 }).then(r => setUsers(r.data.data || [])),
        );
      }
      await Promise.all(tasks);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [canManageRoles, canGrantPermissions]);

  useEffect(() => {
    if (canAccess) loadData();
  }, [canAccess, loadData]);

  const openCreateRole = () => {
    setSelectedRole(null);
    setRoleName('');
    setRoleSlug('');
    setRolePerms(new Set());
    setRoleModal('create');
  };

  const openEditRole = (role: OrgRoleRecord) => {
    setSelectedRole(role);
    setRoleName(role.name);
    setRoleSlug(role.slug);
    setRoleModal('edit');
  };

  const openRolePermissions = (role: OrgRoleRecord) => {
    setSelectedRole(role);
    setRolePerms(new Set(role.permission_keys));
    setRoleModal('permissions');
  };

  const togglePerm = (key: string) => {
    setRolePerms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveNewRole = async () => {
    if (!roleName.trim() || !roleSlug.trim()) {
      toast.error('Name and slug are required');
      return;
    }
    setSavingRole(true);
    try {
      await orgRbacApi.createRole({
        name: roleName.trim(),
        slug: roleSlug.trim(),
        permission_keys: [...rolePerms],
      });
      toast.success('Role created');
      setRoleModal(null);
      await loadData();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingRole(false);
    }
  };

  const saveRoleName = async () => {
    if (!selectedRole || !roleName.trim()) return;
    setSavingRole(true);
    try {
      await orgRbacApi.updateRole(selectedRole.id, { name: roleName.trim() });
      toast.success('Role updated');
      setRoleModal(null);
      await loadData();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingRole(false);
    }
  };

  const saveRolePermissions = async () => {
    if (!selectedRole) return;
    setSavingRole(true);
    try {
      await orgRbacApi.updateRolePermissions(selectedRole.id, [...rolePerms]);
      toast.success('Permissions saved');
      setRoleModal(null);
      await loadData();
      await refreshCapabilities();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingRole(false);
    }
  };

  const confirmDeleteRole = async () => {
    if (!deleteRole) return;
    setSavingRole(true);
    try {
      await orgRbacApi.deleteRole(deleteRole.id);
      toast.success('Role deleted');
      setDeleteRole(null);
      await loadData();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingRole(false);
    }
  };

  const ensureSystemRoles = async () => {
    try {
      await orgRbacApi.ensureSystemRoles();
      toast.success('System roles synced');
      await loadData();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const loadUserGrants = async (userId: string) => {
    if (!userId || !canGrantPermissions) return;
    try {
      const { data } = await usersApi.getPermissions(userId);
      setGrants(data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
      setGrants([]);
    }
  };

  useEffect(() => {
    if (selectedUserId) {
      loadUserGrants(selectedUserId);
      const u = users.find(x => x.id === selectedUserId);
      const match = roles.find(r => r.slug === u?.role);
      setAssignRoleId(match?.id ?? '');
    } else {
      setGrants([]);
      setAssignRoleId('');
    }
  }, [selectedUserId, users, roles]);

  const assignRole = async () => {
    if (!selectedUserId || !assignRoleId) {
      toast.error('Select a user and role');
      return;
    }
    setSavingAssign(true);
    try {
      await orgRbacApi.assignUserRole(selectedUserId, assignRoleId, syncLegacy);
      toast.success('Role assigned');
      await loadData();
      await refreshCapabilities();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingAssign(false);
    }
  };

  const addGrant = () => {
    if (!grantKey) return;
    setGrants(prev => {
      const filtered = prev.filter(g => g.permission_key !== grantKey);
      return [...filtered, { permission_key: grantKey, effect: grantEffect }];
    });
    setGrantKey('');
  };

  const removeGrant = (key: string) => {
    setGrants(prev => prev.filter(g => g.permission_key !== key));
  };

  const saveGrants = async () => {
    if (!selectedUserId) return;
    setSavingGrants(true);
    try {
      await usersApi.updatePermissions(selectedUserId, grants);
      toast.success('Permission overrides saved');
      await refreshCapabilities();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingGrants(false);
    }
  };

  const permissionMatrix = (readOnly: boolean) => (
    <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-6 pr-2">
      {Object.entries(catalogByModule).map(([module, perms]) => (
        <div key={module}>
          <h4 className="text-[11px] font-black uppercase tracking-widest text-[var(--on-glass-muted)] mb-3">
            {MODULE_LABELS[module] ?? module}
          </h4>
          <div className="space-y-2">
            {perms.map(p => (
              <label
                key={p.key}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border border-[var(--glass-border)]',
                  readOnly ? 'opacity-80' : 'hover:bg-[var(--glass-05)] cursor-pointer',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 accent-[var(--primary-600)]"
                  checked={rolePerms.has(p.key)}
                  disabled={readOnly}
                  onChange={() => !readOnly && togglePerm(p.key)}
                />
                <div>
                  <p className="text-sm font-bold text-white">{p.key}</p>
                  <p className="text-xs text-[var(--on-glass-muted)]">{p.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (!capabilitiesLoading && !canAccess) {
    return null;
  }

  const tabs = [
    ...(canManageRoles ? [{ id: 'roles', label: 'Roles', icon: <Shield size={14} /> }] : []),
    ...((canManageRoles || canGrantPermissions)
      ? [{ id: 'users', label: 'Users & overrides', icon: <Users size={14} /> }]
      : []),
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Access control"
        subtitle="Custom roles, permissions, and per-user overrides"
        breadcrumb={[
          { label: 'Settings', href: '/settings' },
          { label: 'Access' },
        ]}
        actions={
          <Link href="/settings">
            <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} />}>Back</Button>
          </Link>
        }
      />

      <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} className="mb-6" />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {activeTab === 'roles' && canManageRoles && (
            <Card className="glass-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Organisation roles</h2>
                  <p className="text-sm text-[var(--on-glass-muted)] mt-1">
                    System roles mirror legacy Employee → Super Admin. Custom roles can be edited freely.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={ensureSystemRoles}>
                    Sync system roles
                  </Button>
                  <Button size="sm" icon={<Plus size={14} />} onClick={openCreateRole}>
                    Custom role
                  </Button>
                </div>
              </div>

              {roles.length === 0 ? (
                <EmptyState
                  icon={<Shield size={24} />}
                  title="No roles yet"
                  description="Sync system roles or create a custom role."
                  action={
                    <Button size="sm" onClick={ensureSystemRoles}>Sync system roles</Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {roles.map(role => (
                    <div
                      key={role.id}
                      className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-05)]"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">{role.name}</p>
                          {role.is_system && (
                            <Badge label="System" color="var(--secondary)" bg="#00E5FF" size="sm" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--on-glass-muted)] mt-1">
                          {role.slug} · {role.permission_keys.length} permissions · {role.user_count} users
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<KeyRound size={14} />}
                          onClick={() => openRolePermissions(role)}
                        >
                          {role.is_system ? 'View' : 'Permissions'}
                        </Button>
                        {!role.is_system && (
                          <>
                            <Button variant="ghost" size="sm" icon={<Edit2 size={14} />} onClick={() => openEditRole(role)}>
                              Rename
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Trash2 size={14} />}
                              disabled={role.user_count > 0}
                              onClick={() => setDeleteRole(role)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'users' && (canManageRoles || canGrantPermissions) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {canManageRoles && (
                <Card className="glass-card p-6">
                  <h2 className="text-lg font-bold text-white mb-4">Assign role</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-widest text-[var(--on-glass-muted)]">
                        Employee
                      </label>
                      <select
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                        className="mt-2 w-full rounded-xl border bg-[var(--glass-05)] px-4 py-3 text-sm text-white border-[var(--glass-border)] outline-none"
                      >
                        <option value="" className="bg-[var(--dark-950)]">Select user…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id} className="bg-[var(--dark-950)]">
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-widest text-[var(--on-glass-muted)]">
                        Org role
                      </label>
                      <select
                        value={assignRoleId}
                        onChange={e => setAssignRoleId(e.target.value)}
                        className="mt-2 w-full rounded-xl border bg-[var(--glass-05)] px-4 py-3 text-sm text-white border-[var(--glass-border)] outline-none"
                      >
                        <option value="" className="bg-[var(--dark-950)]">Select role…</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id} className="bg-[var(--dark-950)]">
                            {r.name} ({r.slug})
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--on-glass-sub)]">
                      <input
                        type="checkbox"
                        checked={syncLegacy}
                        onChange={e => setSyncLegacy(e.target.checked)}
                        className="accent-[var(--primary-600)]"
                      />
                      Sync legacy login role for system roles
                    </label>
                    <Button loading={savingAssign} onClick={assignRole} icon={<Save size={14} />}>
                      Save assignment
                    </Button>
                  </div>
                </Card>
              )}

              {canGrantPermissions && (
                <Card className={cn('glass-card p-6', !canManageRoles && 'lg:col-span-2')}>
                  <h2 className="text-lg font-bold text-white mb-1">Per-user overrides</h2>
                  <p className="text-sm text-[var(--on-glass-muted)] mb-4">
                    Allow or deny permissions on top of the user&apos;s role.
                  </p>
                  {!canManageRoles && (
                    <div className="mb-4">
                      <label className="text-[11px] font-black uppercase tracking-widest text-[var(--on-glass-muted)]">
                        Employee
                      </label>
                      <select
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                        className="mt-2 w-full rounded-xl border bg-[var(--glass-05)] px-4 py-3 text-sm text-white border-[var(--glass-border)] outline-none"
                      >
                        <option value="" className="bg-[var(--dark-950)]">Select user…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id} className="bg-[var(--dark-950)]">
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {!selectedUserId ? (
                    <p className="text-sm text-[var(--on-glass-dim)]">
                      {canManageRoles ? 'Select a user in Assign role first.' : 'Select a user above.'}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={grantKey}
                          onChange={e => setGrantKey(e.target.value)}
                          className="flex-1 min-w-[180px] rounded-xl border bg-[var(--glass-05)] px-3 py-2 text-sm text-white border-[var(--glass-border)]"
                        >
                          <option value="" className="bg-[var(--dark-950)]">Permission…</option>
                          {catalog.filter(p => !p.key.startsWith('platform.')).map(p => (
                            <option key={p.key} value={p.key} className="bg-[var(--dark-950)]">
                              {p.key}
                            </option>
                          ))}
                        </select>
                        <select
                          value={grantEffect}
                          onChange={e => setGrantEffect(e.target.value as 'allow' | 'deny')}
                          className="rounded-xl border bg-[var(--glass-05)] px-3 py-2 text-sm text-white border-[var(--glass-border)]"
                        >
                          <option value="allow" className="bg-[var(--dark-950)]">Allow</option>
                          <option value="deny" className="bg-[var(--dark-950)]">Deny</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={addGrant}>Add</Button>
                      </div>
                      {grants.length === 0 ? (
                        <p className="text-xs text-[var(--on-glass-dim)]">No overrides configured.</p>
                      ) : (
                        <ul className="space-y-2">
                          {grants.map(g => (
                            <li
                              key={g.permission_key}
                              className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)]"
                            >
                              <span className="text-sm text-white font-medium">{g.permission_key}</span>
                              <div className="flex items-center gap-2">
                                <Badge
                                  label={g.effect}
                                  color={g.effect === 'allow' ? 'var(--success-500)' : 'var(--danger-500)'}
                                  bg={g.effect === 'allow' ? '#10b981' : '#ef4444'}
                                  size="sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeGrant(g.permission_key)}
                                  className="text-[var(--on-glass-dim)] hover:text-[var(--danger-500)]"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button loading={savingGrants} onClick={saveGrants} icon={<Save size={14} />}>
                        Save overrides
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={roleModal === 'create'}
        onClose={() => setRoleModal(null)}
        title="Create custom role"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleModal(null)}>Cancel</Button>
            <Button loading={savingRole} onClick={saveNewRole}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Display name" value={roleName} onChange={e => setRoleName(e.target.value)} />
          <Input
            label="Slug"
            hint="Lowercase identifier, e.g. team_lead"
            value={roleSlug}
            onChange={e => setRoleSlug(e.target.value)}
          />
          <p className="text-xs text-[var(--on-glass-muted)]">Optional: set permissions after creating.</p>
        </div>
      </Modal>

      <Modal
        isOpen={roleModal === 'edit'}
        onClose={() => setRoleModal(null)}
        title="Rename role"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleModal(null)}>Cancel</Button>
            <Button loading={savingRole} onClick={saveRoleName}>Save</Button>
          </>
        }
      >
        <Input label="Display name" value={roleName} onChange={e => setRoleName(e.target.value)} />
      </Modal>

      <Modal
        isOpen={roleModal === 'permissions'}
        onClose={() => setRoleModal(null)}
        title={selectedRole?.is_system ? `Permissions — ${selectedRole?.name} (read-only)` : `Permissions — ${selectedRole?.name}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleModal(null)}>Close</Button>
            {selectedRole && !selectedRole.is_system && (
              <Button loading={savingRole} onClick={saveRolePermissions}>Save permissions</Button>
            )}
          </>
        }
      >
        {permissionMatrix(!!selectedRole?.is_system)}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteRole}
        onClose={() => setDeleteRole(null)}
        onConfirm={confirmDeleteRole}
        loading={savingRole}
        title="Delete role"
        message={`Delete "${deleteRole?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </DashboardLayout>
  );
}

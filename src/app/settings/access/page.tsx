'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Input, Modal, ConfirmDialog, Badge, EmptyState,
  Tabs, Skeleton, Select,
} from '@/components/ui';
import { orgRbacApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError } from '@/lib/utils';
import type { OrgRoleRecord, PermissionDef, User, UserPermissionGrant } from '@/types';
import {
  Shield, Plus, Trash2, Edit2, Users, ChevronLeft, KeyRound, Save, UserCheck,
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

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
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

  const handleRoleNameChange = (v: string) => {
    setRoleName(v);
    setRoleSlug(toSlug(v));
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
    if (!roleName.trim()) {
      toast.error('Display name is required');
      return;
    }
    const slug = roleSlug.trim() || toSlug(roleName.trim());
    setSavingRole(true);
    try {
      await orgRbacApi.createRole({
        name: roleName.trim(),
        slug,
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

  const userOptions = users.map(u => ({ value: u.id, label: `${u.name} (${u.email})` }));
  const roleOptions = roles.map(r => ({ value: r.id, label: `${r.name} — ${r.slug}` }));
  const permOptions = catalog
    .filter(p => !p.key.startsWith('platform.'))
    .map(p => ({ value: p.key, label: p.key }));
  const effectOptions = [
    { value: 'allow', label: 'Allow' },
    { value: 'deny', label: 'Deny' },
  ];

  const permissionMatrix = (readOnly: boolean) => (
    <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-6 pr-2">
      {Object.entries(catalogByModule).map(([module, perms]) => (
        <div key={module}>
          <h4 className="text-[11px] font-black uppercase tracking-widest text-[var(--on-glass-muted)] mb-3">
            {MODULE_LABELS[module] ?? module}
          </h4>
          <div className="space-y-1.5">
            {perms.map(p => {
              const isChecked = rolePerms.has(p.key);
              return (
                <label
                  key={p.key}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border transition-all',
                    isChecked
                      ? 'border-[var(--primary-600)]/40 bg-[var(--primary-600)]/10'
                      : 'border-[var(--glass-border)] bg-transparent',
                    readOnly ? 'cursor-default opacity-80' : 'cursor-pointer hover:bg-[var(--glass-05)]',
                  )}
                >
                  <div className={cn(
                    'mt-0.5 w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                    isChecked
                      ? 'bg-[var(--primary-600)] border-[var(--primary-600)]'
                      : 'border-[var(--glass-border)] bg-transparent',
                  )}>
                    {isChecked && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChecked}
                      disabled={readOnly}
                      onChange={() => !readOnly && togglePerm(p.key)}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white font-mono">{p.key}</p>
                    <p className="text-xs text-[var(--on-glass-muted)] mt-0.5">{p.description}</p>
                  </div>
                </label>
              );
            })}
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

  const selectedUser = users.find(u => u.id === selectedUserId);

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
          {/* ── Roles Tab ── */}
          {activeTab === 'roles' && canManageRoles && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-widest">Organisation Roles</h2>
                  <p className="text-sm text-[var(--on-glass-muted)] mt-1">
                    System roles mirror legacy Employee → Super Admin. Custom roles can be edited freely.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={ensureSystemRoles}>
                    Sync system roles
                  </Button>
                  <Button size="sm" icon={<Plus size={14} />} onClick={openCreateRole}>
                    New role
                  </Button>
                </div>
              </div>

              {roles.length === 0 ? (
                <EmptyState
                  icon={<Shield size={24} />}
                  title="No roles yet"
                  description="Sync system roles or create a custom role."
                  action={<Button size="sm" onClick={ensureSystemRoles}>Sync system roles</Button>}
                />
              ) : (
                <div className="space-y-2">
                  {roles.map(role => (
                    <div
                      key={role.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--glass-15)] border border-[var(--glass-border)] flex items-center justify-center flex-shrink-0">
                          <Shield size={16} className="text-[var(--primary-600)]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-white">{role.name}</p>
                            {role.is_system && (
                              <Badge label="System" color="var(--secondary)" bg="#00E5FF" size="sm" />
                            )}
                          </div>
                          <p className="text-xs text-[var(--on-glass-dim)] mt-0.5 font-mono">
                            {role.slug}
                            <span className="not-font-mono normal-case text-[var(--on-glass-dim)]">
                              {' '}· {role.permission_keys.length} permissions · {role.user_count} users
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<KeyRound size={14} />}
                          onClick={() => openRolePermissions(role)}
                        >
                          {role.is_system ? 'View permissions' : 'Permissions'}
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
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* ── Users & Overrides Tab ── */}
          {activeTab === 'users' && (canManageRoles || canGrantPermissions) && (
            <div className="space-y-6">
              {/* Users overview */}
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">All Users</h2>
                    <p className="text-xs text-[var(--on-glass-dim)] mt-0.5">{users.length} members</p>
                  </div>
                </div>
                {users.length === 0 ? (
                  <div className="p-8">
                    <EmptyState icon={<Users size={24} />} title="No users" description="No users found in this organisation." />
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--glass-border)]">
                    {users.map(u => {
                      const role = roles.find(r => r.slug === u.role);
                      const isSelected = u.id === selectedUserId;
                      return (
                        <div
                          key={u.id}
                          className={cn(
                            'flex items-center gap-4 px-6 py-4 transition-all',
                            isSelected ? 'bg-[var(--primary-600)]/10' : 'hover:bg-[var(--glass-05)]',
                          )}
                        >
                          <div className="w-9 h-9 rounded-2xl bg-[var(--glass-15)] border border-[var(--glass-border)] flex items-center justify-center text-sm font-black text-white flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-white">{u.name}</p>
                            <p className="text-xs text-[var(--on-glass-muted)]">{u.email}</p>
                          </div>
                          <div className="hidden sm:block flex-shrink-0">
                            <p className="text-xs text-[var(--on-glass-dim)]">{u.department || '—'}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {role ? (
                              <Badge label={role.name} color="var(--primary-600)" bg="#00C896" size="sm" />
                            ) : u.role ? (
                              <Badge label={u.role} color="var(--on-glass-muted)" bg="#334155" size="sm" />
                            ) : (
                              <span className="text-xs text-[var(--on-glass-dim)]">No role</span>
                            )}
                          </div>
                          {(canManageRoles || canGrantPermissions) && (
                            <button
                              type="button"
                              onClick={() => setSelectedUserId(isSelected ? '' : u.id)}
                              className={cn(
                                'flex-shrink-0 flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl border transition-all',
                                isSelected
                                  ? 'bg-[var(--primary-600)]/20 border-[var(--primary-600)]/40 text-[var(--primary-600)]'
                                  : 'bg-[var(--glass-05)] border-[var(--glass-border)] text-[var(--on-glass-dim)] hover:text-white hover:bg-[var(--glass-10)]',
                              )}
                            >
                              <UserCheck size={12} />
                              {isSelected ? 'Selected' : 'Edit'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Edit panel — shown when a user is selected */}
              {selectedUser && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {canManageRoles && (
                    <Card className="p-6">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 rounded-2xl bg-[var(--glass-15)] border border-[var(--glass-border)] flex items-center justify-center text-sm font-black text-white flex-shrink-0">
                          {selectedUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="text-sm font-black text-white">Assign role</h2>
                          <p className="text-xs text-[var(--on-glass-muted)]">{selectedUser.name}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <Select
                          label="Org role"
                          options={roleOptions}
                          value={assignRoleId}
                          onChange={e => setAssignRoleId(e.target.value)}
                          placeholder="Select role…"
                        />
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <div className={cn(
                            'w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all',
                            syncLegacy
                              ? 'bg-[var(--primary-600)] border-[var(--primary-600)]'
                              : 'border-[var(--glass-border)]',
                          )}>
                            {syncLegacy && (
                              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            <input type="checkbox" className="sr-only" checked={syncLegacy} onChange={e => setSyncLegacy(e.target.checked)} />
                          </div>
                          <span className="text-sm text-[var(--on-glass-sub)]">Sync legacy login role for system roles</span>
                        </label>
                        <Button loading={savingAssign} onClick={assignRole} icon={<Save size={14} />} className="w-full">
                          Save assignment
                        </Button>
                      </div>
                    </Card>
                  )}

                  {canGrantPermissions && (
                    <Card className={cn('p-6', !canManageRoles && 'lg:col-span-2')}>
                      <h2 className="text-sm font-black text-white uppercase tracking-widest mb-1">Permission overrides</h2>
                      <p className="text-sm text-[var(--on-glass-muted)] mb-4">
                        Allow or deny permissions on top of the user&apos;s role.
                      </p>
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <div className="flex-1 min-w-[180px]">
                            <Select
                              options={permOptions}
                              value={grantKey}
                              onChange={e => setGrantKey(e.target.value)}
                              placeholder="Permission…"
                            />
                          </div>
                          <Select
                            options={effectOptions}
                            value={grantEffect}
                            onChange={e => setGrantEffect(e.target.value as 'allow' | 'deny')}
                          />
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
                                <span className="text-sm text-white font-mono">{g.permission_key}</span>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    label={g.effect}
                                    color={g.effect === 'allow' ? '#10b981' : '#ef4444'}
                                    bg={g.effect === 'allow' ? '#10b981' : '#ef4444'}
                                    size="sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeGrant(g.permission_key)}
                                    className="text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <Button loading={savingGrants} onClick={saveGrants} icon={<Save size={14} />} className="w-full">
                          Save overrides
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Prompt when no user selected */}
              {!selectedUser && (
                <div className="flex items-center justify-center py-10 rounded-2xl border border-dashed border-[var(--glass-border)]">
                  <p className="text-sm text-[var(--on-glass-dim)]">Select a user above to edit their role or permission overrides</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Create role modal */}
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
          <Input
            label="Display name"
            placeholder="e.g. Team Lead"
            value={roleName}
            onChange={e => handleRoleNameChange(e.target.value)}
          />
          {roleSlug && (
            <p className="text-xs text-[var(--on-glass-dim)] -mt-2">
              Slug: <code className="text-[var(--primary-600)] font-mono">{roleSlug}</code>
            </p>
          )}
          <p className="text-xs text-[var(--on-glass-muted)]">You can set permissions after creating the role.</p>
        </div>
      </Modal>

      {/* Rename role modal */}
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

      {/* Permissions modal */}
      <Modal
        isOpen={roleModal === 'permissions'}
        onClose={() => setRoleModal(null)}
        title={
          selectedRole?.is_system
            ? `${selectedRole?.name} — Permissions (read-only)`
            : `${selectedRole?.name} — Permissions`
        }
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

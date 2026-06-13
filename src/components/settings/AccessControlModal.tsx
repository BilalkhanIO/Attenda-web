'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Modal, Button, Tabs, Badge, EmptyState, Skeleton, Input, Select, ConfirmDialog, Card
} from '@/components/ui';
import { orgRbacApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError } from '@/lib/utils';
import {
  keys, permissionCatalogQuery, orgRolesQuery, userPermissionsQuery,
  type PermissionDef, type OrgRoleRecord, type UserPermissionGrant
} from '@/lib/queries';
import type { User } from '@/types';
import {
  Shield, Plus, Trash2, Edit2, Users, KeyRound, Save, UserCheck, Search, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface AccessControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
}

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

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export default function AccessControlModal({ isOpen, onClose, users }: AccessControlModalProps) {
  const { hasPermission, refreshCapabilities } = useAuth();
  const queryClient = useQueryClient();

  const canManageRoles = hasPermission('org.roles.manage');
  const canGrantPermissions = hasPermission('org.permissions.grant');

  const [activeTab, setActiveTab] = useState(canManageRoles ? 'roles' : 'users');
  const [search, setSearch] = useState('');

  // ── Modals state ────────────────────────────────────
  const [roleModal, setRoleModal] = useState<'create' | 'edit' | 'permissions' | null>(null);
  const [selectedRole, setSelectedRole] = useState<OrgRoleRecord | null>(null);
  const [roleName, setRoleName] = useState('');
  const [rolePerms, setRolePerms] = useState<Set<string>>(new Set());
  const [deleteRole, setDeleteRole] = useState<OrgRoleRecord | null>(null);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignRoleId, setAssignRoleId] = useState('');
  const [syncLegacy, setSyncLegacy] = useState(true);
  const [grantKey, setGrantKey] = useState('');
  const [grantEffect, setGrantEffect] = useState<'allow' | 'deny'>('allow');

  // ── Queries ──────────────────────────────────────────
  const catalogQuery = useQuery(permissionCatalogQuery());
  const rolesQuery = useQuery(orgRolesQuery());
  const grantsQuery = useQuery(userPermissionsQuery(selectedUserId));

  const catalog = catalogQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const grants = grantsQuery.data ?? [];

  const catalogByModule = useMemo(() => {
    const orgCatalog = catalog.filter(p => !p.key.startsWith('platform.'));
    return orgCatalog.reduce<Record<string, PermissionDef[]>>((acc, p) => {
      (acc[p.module] ??= []).push(p);
      return acc;
    }, {});
  }, [catalog]);

  // ── Mutations ────────────────────────────────────────
  const createRoleMutation = useMutation({
    mutationFn: (data: any) => orgRbacApi.createRole(data),
    onSuccess: () => {
      toast.success('Role created');
      setRoleModal(null);
      queryClient.invalidateQueries({ queryKey: keys.rbac.roles() });
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const updateRoleMutation = useMutation({
    mutationFn: (vars: { id: string; data: any }) => orgRbacApi.updateRole(vars.id, vars.data),
    onSuccess: () => {
      toast.success('Role updated');
      setRoleModal(null);
      queryClient.invalidateQueries({ queryKey: keys.rbac.roles() });
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const updateRolePermsMutation = useMutation({
    mutationFn: (vars: { id: string; perms: string[] }) => orgRbacApi.updateRolePermissions(vars.id, vars.perms),
    onSuccess: () => {
      toast.success('Permissions saved');
      setRoleModal(null);
      queryClient.invalidateQueries({ queryKey: keys.rbac.roles() });
      refreshCapabilities();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => orgRbacApi.deleteRole(id),
    onSuccess: () => {
      toast.success('Role deleted');
      setDeleteRole(null);
      queryClient.invalidateQueries({ queryKey: keys.rbac.roles() });
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const assignRoleMutation = useMutation({
    mutationFn: (vars: { userId: string; roleId: string; sync: boolean }) =>
      orgRbacApi.assignUserRole(vars.userId, vars.roleId, vars.sync),
    onSuccess: () => {
      toast.success('Role assigned');
      queryClient.invalidateQueries({ queryKey: keys.users.all });
      refreshCapabilities();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const updateGrantsMutation = useMutation({
    mutationFn: (vars: { userId: string; grants: UserPermissionGrant[] }) =>
      usersApi.updatePermissions(vars.userId, vars.grants),
    onSuccess: () => {
      toast.success('Permission overrides saved');
      refreshCapabilities();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  // ── Handlers ─────────────────────────────────────────
  const openCreateRole = () => {
    setSelectedRole(null);
    setRoleName('');
    setRolePerms(new Set());
    setRoleModal('create');
  };

  const openEditRole = (role: OrgRoleRecord) => {
    setSelectedRole(role);
    setRoleName(role.name);
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

  const saveRole = () => {
    if (!roleName.trim()) return toast.error('Name required');
    if (selectedRole) {
      updateRoleMutation.mutate({ id: selectedRole.id, data: { name: roleName.trim() } });
    } else {
      createRoleMutation.mutate({ name: roleName.trim(), slug: toSlug(roleName), permission_keys: [] });
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleOptions = roles.map(r => ({ value: r.id, label: r.name }));
  const permOptions = catalog
    .filter(p => !p.key.startsWith('platform.'))
    .map(p => ({ value: p.key, label: p.key }));

  const selectedUser = users.find(u => u.id === selectedUserId);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Access Control"
        size="xl"
      >
        <div className="flex flex-col h-[70vh]">
          <Tabs
            tabs={[
              ...(canManageRoles ? [{ id: 'roles', label: 'Roles', icon: <Shield size={14} /> }] : []),
              { id: 'users', label: 'Users & Overrides', icon: <Users size={14} /> },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
            className="mb-4"
          />

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'roles' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-black uppercase text-[var(--on-glass-muted)] tracking-widest">
                    Organisation Roles
                  </p>
                  <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={openCreateRole}>
                    New Role
                  </Button>
                </div>

                {rolesQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
                ) : roles.length === 0 ? (
                  <EmptyState icon={<Shield size={24} />} title="No roles found" description="Create a custom role to define specific permissions." />
                ) : (
                  <div className="space-y-2">
                    {roles.map(role => (
                      <div key={role.id} className="flex items-center justify-between p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)] transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[var(--glass-10)] flex items-center justify-center">
                            <Shield size={16} className="text-[var(--primary-600)]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-white">{role.name}</p>
                              {role.is_system && <Badge label="System" color="var(--secondary)" bg="var(--secondary)" size="sm" />}
                            </div>
                            <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest mt-0.5">
                              {role.slug} · {role.permission_keys.length} permissions
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openRolePermissions(role)} title="Permissions"
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white transition-all">
                            <KeyRound size={14} />
                          </button>
                          {!role.is_system && (
                            <>
                              <button onClick={() => openEditRole(role)} title="Edit"
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white transition-all">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => setDeleteRole(role)} title="Delete" disabled={role.user_count > 0}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] disabled:opacity-20 transition-all">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4">
                  <Input
                    placeholder="Search users by name or email..."
                    leftIcon={<Search size={14} />}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {filteredUsers.map(u => {
                      const isSelected = u.id === selectedUserId;
                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            setSelectedUserId(isSelected ? '' : u.id);
                            if (!isSelected) {
                              const match = roles.find(r => r.slug === u.role);
                              setAssignRoleId(match?.id ?? '');
                            }
                          }}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-2xl border transition-all text-left',
                            isSelected ? 'border-[var(--primary-600)] bg-[var(--primary-600)]/10' : 'border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)]'
                          )}
                        >
                          <div className="w-8 h-8 rounded-lg bg-[var(--glass-15)] flex items-center justify-center text-xs font-black text-white">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-white truncate">{u.name}</p>
                            <p className="text-[10px] text-[var(--on-glass-muted)] truncate">{u.email}</p>
                          </div>
                          <ChevronRight size={14} className={cn('text-[var(--on-glass-dim)] transition-transform', isSelected && 'rotate-90')} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedUser && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <Card className="p-4 bg-[var(--glass-05)]">
                      <p className="text-[10px] font-black uppercase text-[var(--primary-600)] tracking-widest mb-4">Assign Role</p>
                      <div className="space-y-4">
                        <Select
                          label="Target Role"
                          options={roleOptions}
                          value={assignRoleId}
                          onChange={e => setAssignRoleId(e.target.value)}
                        />
                        <Button
                          size="sm"
                          className="w-full"
                          loading={assignRoleMutation.isPending}
                          onClick={() => assignRoleMutation.mutate({ userId: selectedUserId, roleId: assignRoleId, sync: syncLegacy })}
                        >
                          Save Role
                        </Button>
                      </div>
                    </Card>

                    <Card className="p-4 bg-[var(--glass-05)]">
                      <p className="text-[10px] font-black uppercase text-[var(--secondary)] tracking-widest mb-4">Permission Overrides</p>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Select
                              options={permOptions}
                              value={grantKey}
                              onChange={e => setGrantKey(e.target.value)}
                              placeholder="Permission..."
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (!grantKey) return;
                              const nextGrants = [...grants.filter(g => g.permission_key !== grantKey), { permission_key: grantKey, effect: grantEffect }];
                              updateGrantsMutation.mutate({ userId: selectedUserId, grants: nextGrants });
                              setGrantKey('');
                            }}
                            className="w-10 h-10 rounded-xl bg-[var(--primary-600)] text-white flex items-center justify-center hover:brightness-110 transition-all"
                          >
                            <Plus size={18} />
                          </button>
                        </div>

                        <div className="space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                          {grants.length === 0 ? (
                            <p className="text-[10px] text-[var(--on-glass-dim)] italic">No overrides set for this user.</p>
                          ) : grants.map(g => (
                            <div key={g.permission_key} className="flex items-center justify-between p-2 rounded-lg bg-[var(--glass-10)] border border-[var(--glass-border)]">
                              <span className="text-[10px] font-mono text-white truncate max-w-[150px]">{g.permission_key}</span>
                              <div className="flex items-center gap-2">
                                <Badge label={g.effect} color={g.effect === 'allow' ? 'var(--success-500)' : 'var(--danger-500)'} bg={g.effect === 'allow' ? 'var(--success-500)' : 'var(--danger-500)'} size="sm" />
                                <button
                                  onClick={() => updateGrantsMutation.mutate({ userId: selectedUserId, grants: grants.filter(x => x.permission_key !== g.permission_key) })}
                                  className="text-[var(--on-glass-dim)] hover:text-[var(--danger-500)]"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Role Create/Edit Modal */}
      <Modal
        isOpen={!!roleModal && roleModal !== 'permissions'}
        onClose={() => setRoleModal(null)}
        title={roleModal === 'create' ? 'Create Custom Role' : 'Rename Role'}
        size="sm"
        footer={<Button onClick={saveRole} loading={createRoleMutation.isPending || updateRoleMutation.isPending}>{roleModal === 'create' ? 'Create' : 'Save'}</Button>}
      >
        <Input label="Role Name" value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="e.g. Supervisor" required autoFocus />
      </Modal>

      {/* Permissions Matrix Modal */}
      <Modal
        isOpen={roleModal === 'permissions'}
        onClose={() => setRoleModal(null)}
        title={`${selectedRole?.name} — Permissions`}
        size="md"
        footer={!selectedRole?.is_system && <Button onClick={() => selectedRole && updateRolePermsMutation.mutate({ id: selectedRole.id, perms: [...rolePerms] })} loading={updateRolePermsMutation.isPending}>Save Permissions</Button>}
      >
        <div className="space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
          {Object.entries(catalogByModule).map(([module, perms]) => (
            <div key={module}>
              <p className="text-[10px] font-black uppercase text-[var(--on-glass-muted)] tracking-widest mb-3">{MODULE_LABELS[module] ?? module}</p>
              <div className="space-y-1.5">
                {perms.map(p => {
                  const isChecked = rolePerms.has(p.key);
                  return (
                    <label key={p.key} className={cn('flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer', isChecked ? 'border-[var(--primary-600)]/40 bg-[var(--primary-600)]/10' : 'border-[var(--glass-border)] bg-transparent hover:bg-[var(--glass-05)]')}>
                      <div className={cn('mt-0.5 w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all', isChecked ? 'bg-[var(--primary-600)] border-[var(--primary-600)]' : 'border-[var(--glass-border)] bg-transparent')}>
                        {isChecked && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        <input type="checkbox" className="sr-only" checked={isChecked} onChange={() => togglePerm(p.key)} disabled={!!selectedRole?.is_system} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-black text-white font-mono">{p.key}</p>
                        <p className="text-[10px] text-[var(--on-glass-muted)] mt-0.5 leading-tight">{p.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteRole}
        onClose={() => setDeleteRole(null)}
        onConfirm={() => deleteRole && deleteRoleMutation.mutate(deleteRole.id)}
        loading={deleteRoleMutation.isPending}
        title="Delete Role"
        message={`Are you sure you want to delete "${deleteRole?.name}"? This action cannot be undone.`}
        variant="danger"
      />
    </>
  );
}

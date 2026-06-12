'use client';
import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, ConfirmDialog,
  Input, RoleBadge, Dropdown,
} from '@/components/ui';
import type { DropdownOption } from '@/components/ui';
import { usersApi } from '@/lib/api';
import { keys, usersListQuery, managersQuery, departmentsQuery } from '@/lib/queries';
import { roleLabels, getApiError } from '@/lib/utils';
import type { User, Role } from '@/types';
import { UserPlus, Upload, Search, MoreHorizontal, Edit, UserX, Eye } from 'lucide-react';
import { useForm, Controller, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';

const PAGE_SIZE = 20;

// ─── Schema ───────────────────────────────────────────
const userSchema = z.object({
  name:        z.string().min(2, 'Name required'),
  email:       z.string().email('Valid email required'),
  role:        z.enum(['hr_admin','manager','employee']),
  department:  z.string().min(1, 'Department required'),
  job_title:   z.string().min(1, 'Job title required'),
  phone:       z.string().optional(),
  hourly_rate: z.string().optional(),
  manager_id:  z.string().optional(),
  password:    z.string().min(8, 'Password must be at least 8 chars').optional().or(z.literal('')),
});
type UserForm = z.infer<typeof userSchema>;

// Declared at module level so modal inputs keep focus/state across re-renders
function UserFormFields({ form, departments, managers, canUpdateCreds, isEdit }: {
  form: UseFormReturn<UserForm>;
  departments: string[];
  managers: User[];
  canUpdateCreds: boolean;
  isEdit?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Full Name" required error={form.formState.errors.name?.message} {...form.register('name')} />
        <Input
          label="Email"
          type="email"
          required
          disabled={isEdit && !canUpdateCreds}
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
      </div>

      {isEdit && canUpdateCreds && (
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="New Password (leave blank to keep current)"
            type="password"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Controller control={form.control} name="role"
          render={({ field }) => (
            <Dropdown label="Role" required
              value={field.value ?? ''}
              onChange={field.onChange}
              options={[
                { value: 'employee', label: 'Employee' },
                { value: 'manager',  label: 'Manager'  },
                { value: 'hr_admin', label: 'HR Admin'  },
              ]}
              error={form.formState.errors.role?.message}
            />
          )}
        />
        <Controller control={form.control} name="department"
          render={({ field }) => (
            <Dropdown label="Department" required
              value={field.value ?? ''}
              onChange={field.onChange}
              placeholder="Select department"
              options={departments.map(d => ({ value: d, label: d }))}
              error={form.formState.errors.department?.message}
            />
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Job Title" required error={form.formState.errors.job_title?.message} {...form.register('job_title')} />
        <Input label="Phone" type="tel" placeholder="+1 234 567 8900" {...form.register('phone')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Hourly Rate" type="number" placeholder="0.00" {...form.register('hourly_rate')} />
        <Controller control={form.control} name="manager_id"
          render={({ field }) => (
            <Dropdown label="Reporting Manager"
              value={field.value ?? ''}
              onChange={field.onChange}
              placeholder="Select manager"
              options={managers.map(m => ({ value: m.id, label: m.name }))}
            />
          )}
        />
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Server-side pagination/filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Debounce search ~300ms before it reaches the query key
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Modal states
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const form = useForm<UserForm>({ resolver: zodResolver(userSchema) });

  const listParams = {
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch,
    department: deptFilter,
    role: roleFilter,
  };
  const usersQuery = useQuery({
    ...usersListQuery(listParams),
    placeholderData: keepPreviousData,
  });
  const deptsQuery    = useQuery(departmentsQuery());
  const managersQ     = useQuery(managersQuery());

  const users       = usersQuery.data?.users ?? [];
  const total       = usersQuery.data?.pagination.total ?? 0;
  const pageCount   = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading     = usersQuery.isPending;
  const departments = deptsQuery.data ?? [];
  const managers    = managersQ.data ?? [];

  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: keys.users.all });

  // Filter changes always jump back to the first page
  const setSearchAndReset = (v: string) => { setSearch(v); setPage(1); };
  const setDeptAndReset   = (v: string) => { setDeptFilter(v); setPage(1); };
  const setRoleAndReset   = (v: string) => { setRoleFilter(v); setPage(1); };

  const openAdd = () => {
    form.reset({ role: 'employee' });
    setAddOpen(true);
  };

  const openEdit = (user: User) => {
    form.reset({
      name:        user.name,
      email:       user.email,
      role:        user.role as 'hr_admin' | 'manager' | 'employee',
      department:  user.department,
      job_title:   user.job_title,
      phone:       user.phone || '',
      hourly_rate: user.hourly_rate?.toString() || '',
      manager_id:  user.manager_id || '',
      password:    '',
    });
    setEditUser(user);
    setActionMenuId(null);
  };

  const saveMutation = useMutation({
    mutationFn: (vars: { id?: string; data: UserForm }) => {
      const payload = { ...vars.data, hourly_rate: vars.data.hourly_rate ? parseFloat(vars.data.hourly_rate) : undefined };
      return vars.id ? usersApi.update(vars.id, payload) : usersApi.create(payload);
    },
    onSuccess: (_d, vars) => {
      if (vars.id) {
        toast.success('Employee updated');
        setEditUser(null);
      } else {
        toast.success('Employee added — welcome email sent');
        setAddOpen(false);
      }
      form.reset();
    },
    onSettled: invalidateUsers,
  });

  const deactivateMutation = useMutation({
    mutationFn: (vars: { id: string; name: string }) => usersApi.deactivate(vars.id),
    onSuccess: (_d, vars) => {
      toast.success(`${vars.name} deactivated`);
      setDeactivateTarget(null);
    },
    onSettled: invalidateUsers,
  });

  const importMutation = useMutation({
    mutationFn: (rows: Array<{ name: string; email: string; role?: string; department?: string; phone?: string }>) =>
      usersApi.import(rows),
    onSuccess: ({ data }) => {
      const result = data.data || {};
      toast.success(`Imported ${result.created ?? 0} employees${result.skipped ? `, ${result.skipped} skipped` : ''}`);
    },
    onSettled: invalidateUsers,
  });

  const onSubmit = (data: UserForm) =>
    saveMutation.mutate({ id: editUser?.id, data });

  const onDeactivate = () => {
    if (!deactivateTarget) return;
    deactivateMutation.mutate({ id: deactivateTarget.id, name: deactivateTarget.name });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Employees"
        subtitle={`${total} employees`}
        actions={
          <>
            {hasPermission('employees.import') && <Button variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.csv';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                  if (lines.length < 2) { toast.error('CSV must have a header row and at least one employee'); return; }
                  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                  const rows = lines.slice(1).map(line => {
                    const cols = line.split(',').map(c => c.trim());
                    const row: Record<string, string> = {};
                    headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
                    return row;
                  });
                  const parsed = rows
                    .filter(r => r.name && r.email)
                    .map(r => ({ name: r.name, email: r.email, role: r.role || undefined, department: r.department || undefined, phone: r.phone || undefined }));
                  if (!parsed.length) { toast.error('No valid rows found — CSV needs "name" and "email" columns'); return; }
                  importMutation.mutate(parsed);
                } catch (err) { toast.error(getApiError(err)); }
              };
              input.click();
            }}>Import CSV</Button>}
            {hasPermission('employees.create') && <Button size="sm" icon={<UserPlus size={14} />} onClick={openAdd}>Add Employee</Button>}
          </>
        }
      />

      <Card>
        {/* Filters — applied server-side */}
        <div className="flex flex-wrap items-center gap-4 p-4 border-b border-[var(--glass-border)] bg-(--glass-05)">
          <div className="relative flex-1 min-w-[300px] group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-(--on-glass-dim) group-focus-within:text-(--primary-600) transition-colors" />
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearchAndReset(e.target.value)}
              className="panel w-full pl-12 pr-4 py-3 text-sm text-white outline-none placeholder:text-(--on-glass-dim)"
            />
          </div>
          <div className="flex items-center gap-3">
            <Dropdown
              value={deptFilter}
              onChange={setDeptAndReset}
              placeholder="All Departments"
              options={[
                { value: '', label: 'All Departments' },
                ...departments.map((d): DropdownOption => ({ value: d, label: d })),
              ]}
              className="min-w-[160px]"
            />
            <Dropdown
              value={roleFilter}
              onChange={setRoleAndReset}
              placeholder="All Roles"
              options={[
                { value: '', label: 'All Roles' },
                ...(Object.keys(roleLabels) as Role[])
                  .filter(r => r !== 'super_admin')
                  .map((r): DropdownOption => ({ value: r, label: roleLabels[r] })),
              ]}
              className="min-w-[160px]"
            />
          </div>
        </div>

        {/* Table */}
        <Table
          headers={['Employee', 'Role', 'Department', 'Manager', 'Status', 'Rate', '']}
          loading={loading}
        >
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-[var(--glass-05)] transition-all group">
              <td className="py-3 px-4">
                <div className="flex items-center gap-4">
                  <Avatar name={user.name} imageUrl={user.avatar_url} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white group-hover:text-[var(--primary-600)] transition-colors truncate">{user.name}</p>
                    <p className="text-xs font-medium text-[var(--on-glass-muted)] truncate">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <RoleBadge role={user.role} />
              </td>
              <td className="py-3 px-4">
                <span className="text-sm font-medium text-[var(--on-glass-dim)]">{user.department}</span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm font-medium text-[var(--on-glass-dim)]">{user.manager?.name || '—'}</span>
              </td>
              <td className="py-3 px-4">
                <Badge
                  label={user.status === 'active' ? 'Active' : 'Inactive'}
                  color={user.status === 'active' ? 'var(--success-500)' : 'var(--on-glass-muted)'}
                  bg={user.status === 'active'   ? '#10b981' : '#94a3b8'}
                />
              </td>
              <td className="py-3 px-4">
                <span className="text-sm font-black text-[var(--primary-600)]/80 tracking-tighter">
                  {user.hourly_rate ? `$${user.hourly_rate}/hr` : '—'}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="relative flex justify-end">
                  <button
                    onClick={() => setActionMenuId(actionMenuId === user.id ? null : user.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white transition-all active:scale-90"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  {actionMenuId === user.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                      <div className="absolute right-0 top-11 z-20 min-w-[200px] bg-[var(--dark-950)]/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-[var(--glass-border)] py-2 fade-in-up overflow-hidden">
                        <button onClick={() => { setViewUser(user); setActionMenuId(null); }}
                          className="w-full text-left px-5 py-3 text-[13px] font-bold flex items-center gap-3 hover:bg-[var(--glass-10)] text-white transition-all">
                          <Eye size={16} /> View Profile
                        </button>
                        {hasPermission('employees.update') && (
                          <button onClick={() => openEdit(user)}
                            className="w-full text-left px-5 py-3 text-[13px] font-bold flex items-center gap-3 hover:bg-[var(--glass-10)] text-white transition-all">
                            <Edit size={16} /> Edit
                          </button>
                        )}
                        {hasPermission('employees.deactivate') && user.status === 'active' && (
                          <button onClick={() => { setDeactivateTarget(user); setActionMenuId(null); }}
                            className="w-full text-left px-5 py-3 text-[13px] font-bold flex items-center gap-3 hover:bg-[var(--danger-500)]/10 text-[var(--danger-500)] transition-all">
                            <UserX size={16} /> Deactivate
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>

        {!loading && users.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-[var(--on-glass-muted)] text-sm font-medium tracking-wide">
              No employees found matching your filters.
            </p>
          </div>
        )}

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--glass-border)]">
            <p className="text-xs font-medium text-[var(--on-glass-muted)]">
              Page {page} of {pageCount} · {total} total
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={page <= 1 || usersQuery.isFetching}
                onClick={() => setPage(p => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button size="sm" variant="ghost" disabled={page >= pageCount || usersQuery.isFetching}
                onClick={() => setPage(p => Math.min(pageCount, p + 1))}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Employee Modal */}
      <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); form.reset(); }}
        title="Add New Employee" size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={form.handleSubmit(onSubmit)} loading={saveMutation.isPending}>
              Add Employee
            </Button>
          </>
        }
      >
        <UserFormFields form={form} departments={departments} managers={managers}
          canUpdateCreds={hasPermission('employees.credentials.update')} isEdit={false} />
      </Modal>

      {/* Edit Employee Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)}
        title="Edit Employee" size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button size="sm" onClick={form.handleSubmit(onSubmit)} loading={saveMutation.isPending}>
              Save Changes
            </Button>
          </>
        }
      >
        <UserFormFields form={form} departments={departments} managers={managers}
          canUpdateCreds={hasPermission('employees.credentials.update')} isEdit={true} />
      </Modal>

      {/* View Profile Modal */}
      <Modal isOpen={!!viewUser} onClose={() => setViewUser(null)}
        title="Employee Profile" size="sm"
        footer={<Button size="sm" onClick={() => setViewUser(null)}>Close</Button>}
      >
        {viewUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-(--glass-05) rounded-xl border border-(--glass-border)">
              <Avatar name={viewUser.name} imageUrl={viewUser.avatar_url} size="md" />
              <div>
                <h3 className="text-base font-black text-white tracking-tight">{viewUser.name}</h3>
                <p className="text-xs font-bold text-(--primary-600) uppercase tracking-widest mt-0.5">{viewUser.job_title}</p>
                <div className="mt-1.5">
                  <Badge
                    label={viewUser.status === 'active' ? 'Active' : 'Inactive'}
                    color={viewUser.status === 'active' ? 'var(--success-500)' : 'var(--on-glass-muted)'}
                    bg={viewUser.status === 'active' ? '#10b981' : '#94a3b8'}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Email',      viewUser.email],
                ['Phone',      viewUser.phone || '—'],
                ['Role',       roleLabels[viewUser.role]],
                ['Department', viewUser.department],
                ['Manager',    viewUser.manager?.name || '—'],
                ['Hourly Rate', viewUser.hourly_rate ? `$${viewUser.hourly_rate}/hr` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="panel">
                  <p className="label-xs mb-1">{label}</p>
                  <p className="text-xs font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={onDeactivate}
        loading={deactivateMutation.isPending}
        title="Deactivate Employee"
        message={`Are you sure you want to deactivate ${deactivateTarget?.name}? They will lose access immediately. Their data will be preserved.`}
        confirmLabel="Deactivate"
        variant="danger"
      />
    </DashboardLayout>
  );
}

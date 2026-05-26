'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, ConfirmDialog,
  Input, Select, Skeleton
} from '@/components/ui';
import { usersApi, orgApi } from '@/lib/api';
import { roleLabels, getApiError } from '@/lib/utils';
import type { User, Role } from '@/types';
import { UserPlus, Upload, Search, MoreHorizontal, Edit, UserX, Eye } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';

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
});
type UserForm = z.infer<typeof userSchema>;

export default function EmployeesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modal states
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<User | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const form = useForm<UserForm>({ resolver: zodResolver(userSchema) });

  const fetchUsers = useCallback(async () => {
    try {
      const [usersRes, deptsRes] = await Promise.all([
        usersApi.getAll(),
        orgApi.getDepartments(),
      ]);
      const all: User[] = usersRes.data.data || [];
      setUsers(all);
      setDepartments(deptsRes.data.data || []);
      setManagers(all.filter(u => u.role === 'manager' || u.role === 'hr_admin'));
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
    });
    setEditUser(user);
    setActionMenuId(null);
  };

  const onSubmit = async (data: UserForm) => {
    try {
      const payload = { ...data, hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate) : undefined };
      if (editUser) {
        await usersApi.update(editUser.id, payload);
        toast.success('Employee updated');
        setEditUser(null);
      } else {
        await usersApi.create(payload);
        toast.success('Employee added — welcome email sent');
        setAddOpen(false);
      }
      fetchUsers();
      form.reset();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const onDeactivate = async () => {
    if (!deactivateUser) return;
    setDeactivating(true);
    try {
      await usersApi.deactivate(deactivateUser.id);
      toast.success(`${deactivateUser.name} deactivated`);
      setDeactivateUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeactivating(false);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchDept   = !deptFilter || u.department === deptFilter;
    const matchRole   = !roleFilter || u.role === roleFilter;
    return matchSearch && matchDept && matchRole;
  });

  const UserFormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Full Name" required error={form.formState.errors.name?.message} {...form.register('name')} />
        <Input label="Email" type="email" required error={form.formState.errors.email?.message} {...form.register('email')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Role" required error={form.formState.errors.role?.message}
          options={[
            { value: 'employee', label: 'Employee' },
            { value: 'manager',  label: 'Manager'  },
            { value: 'hr_admin', label: 'HR Admin'  },
          ]}
          {...form.register('role')}
        />
        <Select label="Department" required error={form.formState.errors.department?.message}
          placeholder="Select department"
          options={departments.map(d => ({ value: d, label: d }))}
          {...form.register('department')}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Job Title" required error={form.formState.errors.job_title?.message} {...form.register('job_title')} />
        <Input label="Phone" type="tel" placeholder="+1 234 567 8900" {...form.register('phone')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Hourly Rate" type="number" placeholder="0.00" {...form.register('hourly_rate')} />
        <Select label="Reporting Manager"
          placeholder="Select manager"
          options={managers.map(m => ({ value: m.id, label: m.name }))}
          {...form.register('manager_id')}
        />
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Employees"
        subtitle={`${users.filter(u => u.status === 'active').length} active employees`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.csv';
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('file', file);
                try {
                  const { data } = await usersApi.importCSV(formData);
                  toast.success(`Imported ${data.data?.imported || 0} employees`);
                  fetchUsers();
                } catch (err) { toast.error(getApiError(err)); }
              };
              input.click();
            }}>Import CSV</Button>
            <Button size="sm" icon={<UserPlus size={14} />} onClick={openAdd}>Add Employee</Button>
          </>
        }
      />

      <Card>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-5 border-b border-[var(--gray-100)]">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-500)]" />
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg focus:border-[var(--primary-600)] focus:ring-2 focus:ring-[var(--primary-100)] outline-none"
            />
          </div>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg focus:outline-none"
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg focus:outline-none"
          >
            <option value="">All Roles</option>
            {(Object.keys(roleLabels) as Role[]).filter(r => r !== 'super_admin').map(r => (
              <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <Table
          headers={['Employee', 'Role', 'Department', 'Manager', 'Status', 'Rate', '']}
          loading={loading}
        >
          {filtered.map((user) => (
            <tr key={user.id} className="border-b border-[var(--gray-100)] hover:bg-[var(--gray-50)] transition-colors">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Avatar name={user.name} imageUrl={user.avatar_url} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--dark-950)]">{user.name}</p>
                    <p className="text-xs text-[var(--gray-500)]">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-[var(--dark-950)]">{roleLabels[user.role]}</span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-[var(--gray-500)]">{user.department}</span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-[var(--gray-500)]">{user.manager?.name || '—'}</span>
              </td>
              <td className="py-3 px-4">
                <Badge
                  label={user.status === 'active' ? 'Active' : 'Inactive'}
                  color={user.status === 'active' ? 'var(--success-700)' : 'var(--gray-500)'}
                  bg={user.status === 'active'   ? 'var(--success-100)' : 'var(--gray-100)'}
                />
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-[var(--gray-500)] font-mono">
                  {user.hourly_rate ? `$${user.hourly_rate}/hr` : '—'}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="relative flex justify-end">
                  <button
                    onClick={() => setActionMenuId(actionMenuId === user.id ? null : user.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-500)]"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {actionMenuId === user.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                      <div className="absolute right-0 top-9 z-20 min-w-[160px] bg-white rounded-xl shadow-lg border border-[var(--gray-200)] py-1 fade-in-up">
                        <button onClick={() => { setViewUser(user); setActionMenuId(null); }}
                          className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-[var(--gray-50)] text-[var(--dark-950)]">
                          <Eye size={14} /> View Profile
                        </button>
                        <button onClick={() => openEdit(user)}
                          className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-[var(--gray-50)] text-[var(--dark-950)]">
                          <Edit size={14} /> Edit
                        </button>
                        {user.status === 'active' && (
                          <button onClick={() => { setDeactivateUser(user); setActionMenuId(null); }}
                            className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-[var(--danger-100)] text-[var(--danger-800)]">
                            <UserX size={14} /> Deactivate
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

        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[var(--gray-500)]">
            No employees found matching your filters.
          </div>
        )}
      </Card>

      {/* Add Employee Modal */}
      <Modal isOpen={addOpen} onClose={() => { setAddOpen(false); form.reset(); }}
        title="Add New Employee" size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)} loading={form.formState.isSubmitting}>
              Add Employee
            </Button>
          </>
        }
      >
        <UserFormFields />
      </Modal>

      {/* Edit Employee Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)}
        title="Edit Employee" size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)} loading={form.formState.isSubmitting}>
              Save Changes
            </Button>
          </>
        }
      >
        <UserFormFields />
      </Modal>

      {/* View Profile Modal */}
      <Modal isOpen={!!viewUser} onClose={() => setViewUser(null)}
        title="Employee Profile" size="md"
        footer={<Button onClick={() => setViewUser(null)}>Close</Button>}
      >
        {viewUser && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={viewUser.name} imageUrl={viewUser.avatar_url} size="lg" />
              <div>
                <h3 className="text-lg font-bold text-[var(--dark-950)]">{viewUser.name}</h3>
                <p className="text-sm text-[var(--gray-500)]">{viewUser.job_title}</p>
                <Badge
                  label={viewUser.status === 'active' ? 'Active' : 'Inactive'}
                  color={viewUser.status === 'active' ? 'var(--success-700)' : 'var(--gray-500)'}
                  bg={viewUser.status === 'active' ? 'var(--success-100)' : 'var(--gray-100)'}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Email',      viewUser.email],
                ['Phone',      viewUser.phone || '—'],
                ['Role',       roleLabels[viewUser.role]],
                ['Department', viewUser.department],
                ['Manager',    viewUser.manager?.name || '—'],
                ['Hourly Rate', viewUser.hourly_rate ? `$${viewUser.hourly_rate}/hr` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="p-3 rounded-lg bg-[var(--gray-50)]">
                  <p className="text-xs font-semibold text-[var(--gray-500)] mb-0.5">{label}</p>
                  <p className="font-medium text-[var(--dark-950)]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deactivateUser}
        onClose={() => setDeactivateUser(null)}
        onConfirm={onDeactivate}
        loading={deactivating}
        title="Deactivate Employee"
        message={`Are you sure you want to deactivate ${deactivateUser?.name}? They will lose access immediately. Their data will be preserved.`}
        confirmLabel="Deactivate"
        variant="danger"
      />
    </DashboardLayout>
  );
}

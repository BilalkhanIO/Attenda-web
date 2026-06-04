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
import { useAuth } from '@/lib/auth';

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

export default function EmployeesPage() {
  const { hasRole, hasPermission } = useAuth();
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
      password:    '',
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
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                       u.email.toLowerCase().includes(search.toLowerCase()) ||
                       (u.job_title?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchDept   = !deptFilter || u.department === deptFilter;
    const matchRole   = !roleFilter || u.role === roleFilter;
    return matchSearch && matchDept && matchRole;
  });

  const UserFormFields = ({ isEdit }: { isEdit?: boolean }) => {
    const canUpdateCreds = hasPermission('employees.credentials.update') || hasRole('super_admin');
    
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
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Employees"
        subtitle={`${users.filter(u => u.status === 'active').length} active employees`}
        actions={
          <>
            {hasPermission('employees.import') && <Button variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => {
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
            }}>Import CSV</Button>}
            {hasPermission('employees.create') && <Button size="sm" icon={<UserPlus size={14} />} onClick={openAdd}>Add Employee</Button>}
          </>
        }
      />

      <Card>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 p-6 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
          <div className="relative flex-1 min-w-[300px] group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--on-glass-dim)] group-focus-within:text-[var(--primary-600)] transition-colors" />
            <input
              placeholder="Search by name, email or job title..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-sm bg-[var(--glass-10)] text-white border border-[var(--glass-border)] rounded-2xl focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 outline-none transition-all placeholder:text-[var(--on-glass-dim)]"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-4 py-3 text-sm bg-[var(--glass-10)] text-white border border-[var(--glass-border)] rounded-2xl focus:ring-4 focus:ring-[var(--primary-600)]/10 outline-none transition-all min-w-[160px] cursor-pointer appearance-none hover:bg-[var(--glass-15)]"
            >
              <option value="" className="bg-[var(--dark-950)]">All Departments</option>
              {departments.map(d => <option key={d} value={d} className="bg-[var(--dark-950)]">{d}</option>)}
            </select>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-4 py-3 text-sm bg-[var(--glass-10)] text-white border border-[var(--glass-border)] rounded-2xl focus:ring-4 focus:ring-[var(--primary-600)]/10 outline-none transition-all min-w-[160px] cursor-pointer appearance-none hover:bg-[var(--glass-15)]"
            >
              <option value="" className="bg-[var(--dark-950)]">All Roles</option>
              {(Object.keys(roleLabels) as Role[]).filter(r => r !== 'super_admin').map(r => (
                <option key={r} value={r} className="bg-[var(--dark-950)]">{roleLabels[r]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <Table
          headers={['Employee', 'Role', 'Department', 'Manager', 'Status', 'Rate', '']}
          loading={loading}
        >
          {filtered.map((user) => (
            <tr key={user.id} className="hover:bg-[var(--glass-05)] transition-all group">
              <td className="py-4 px-6">
                <div className="flex items-center gap-4">
                  <Avatar name={user.name} imageUrl={user.avatar_url} size="md" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-black text-white group-hover:text-[var(--primary-600)] transition-colors truncate">{user.name}</p>
                    <p className="text-xs font-medium text-[var(--on-glass-muted)] truncate">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-6">
                <span className="text-sm font-bold text-white/90">{roleLabels[user.role]}</span>
              </td>
              <td className="py-4 px-6">
                <span className="text-sm font-medium text-[var(--on-glass-dim)]">{user.department}</span>
              </td>
              <td className="py-4 px-6">
                <span className="text-sm font-medium text-[var(--on-glass-dim)]">{user.manager?.name || '—'}</span>
              </td>
              <td className="py-4 px-6">
                <Badge
                  label={user.status === 'active' ? 'Active' : 'Inactive'}
                  color={user.status === 'active' ? 'var(--success-500)' : 'var(--on-glass-muted)'}
                  bg={user.status === 'active'   ? '#10b981' : '#94a3b8'}
                />
              </td>
              <td className="py-4 px-6">
                <span className="text-sm font-black text-[var(--primary-600)]/80 tracking-tighter">
                  {user.hourly_rate ? `$${user.hourly_rate}/hr` : '—'}
                </span>
              </td>
              <td className="py-4 px-6">
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
                          <button onClick={() => { setDeactivateUser(user); setActionMenuId(null); }}
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

        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-[var(--on-glass-muted)] text-sm font-medium tracking-wide">
              No employees found matching your filters.
            </p>
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
        <UserFormFields isEdit={false} />
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
        <UserFormFields isEdit={true} />
      </Modal>

      {/* View Profile Modal */}
      <Modal isOpen={!!viewUser} onClose={() => setViewUser(null)}
        title="Employee Profile" size="md"
        footer={<Button onClick={() => setViewUser(null)}>Close</Button>}
      >
        {viewUser && (
          <div className="space-y-6">
            <div className="flex items-center gap-5 p-5 bg-[var(--glass-05)] rounded-2xl border border-[var(--glass-border)]">
              <Avatar name={viewUser.name} imageUrl={viewUser.avatar_url} size="xl" />
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">{viewUser.name}</h3>
                <p className="text-sm font-bold text-[var(--primary-600)] uppercase tracking-widest mt-1">{viewUser.job_title}</p>
                <div className="mt-3">
                  <Badge
                    label={viewUser.status === 'active' ? 'Active' : 'Inactive'}
                    color={viewUser.status === 'active' ? 'var(--success-500)' : 'var(--on-glass-muted)'}
                    bg={viewUser.status === 'active' ? '#10b981' : '#94a3b8'}
                  />
                </div>
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
                <div key={label} className="p-4 rounded-2xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                  <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-1.5">{label}</p>
                  <p className="font-bold text-white">{value}</p>
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

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { PageHeader, Card, Table, Button, Modal, ConfirmDialog, Input, Select, Badge, Avatar } from '@/components/ui';
import { UserPlus, Edit, Trash2, Shield, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';

const userSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 chars').optional().or(z.literal('')),
  roles: z.array(z.string()).min(1, 'At least one role is required'),
});

type UserForm = z.infer<typeof userSchema>;

export default function AdminPlatformUsersPage() {
  const { capabilities } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<UserForm>({ resolver: zodResolver(userSchema) });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getPlatformUsers();
      setUsers(res.data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openAdd = () => {
    form.reset({ name: '', email: '', password: '', roles: ['platform_admin'] });
    setAddOpen(true);
  };

  const openEdit = (user: any) => {
    form.reset({
      name: user.name,
      email: user.email,
      password: '',
      roles: user.roles.map((r: any) => r.slug),
    });
    setEditUser(user);
  };

  const onSubmit = async (data: UserForm) => {
    try {
      if (editUser) {
        const payload: any = { name: data.name, email: data.email, roles: data.roles };
        if (data.password) payload.password = data.password;
        await adminApi.updatePlatformUser(editUser.id, payload);
        toast.success('Platform user updated');
        setEditUser(null);
      } else {
        if (!data.password) throw new Error('Password is required for new users');
        await adminApi.createPlatformUser(data);
        toast.success('Platform user created');
        setAddOpen(false);
      }
      fetchUsers();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const onDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await adminApi.deletePlatformUser(deleteUser.id);
      toast.success('Platform user deleted');
      setDeleteUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const s = search.toLowerCase();
    return users.filter(u => 
      u.name.toLowerCase().includes(s) || 
      u.email.toLowerCase().includes(s)
    );
  }, [users, search]);

  const canManage = capabilities?.platform_permissions?.includes('platform.users.manage');

  const UserFormFields = ({ isEdit }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <Input label="Name" required error={form.formState.errors.name?.message} {...form.register('name')} />
      <Input label="Email" type="email" required error={form.formState.errors.email?.message} {...form.register('email')} />
      <Input 
        label={isEdit ? "New Password (leave blank to keep current)" : "Password"} 
        type="password" 
        required={!isEdit}
        error={form.formState.errors.password?.message} 
        {...form.register('password')} 
      />
      <Select 
        label="Role" 
        required 
        error={form.formState.errors.roles?.message}
        options={[
          { value: 'platform_admin', label: 'Platform Admin (Full Access)' },
          { value: 'platform_assistant', label: 'Platform Assistant (Read-only + Assist)' }
        ]}
        value={form.watch('roles')?.[0] || 'platform_admin'}
        onChange={(e) => form.setValue('roles', [e.target.value])}
      />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Platform Users"
        subtitle="Manage platform administrators and support agents"
        actions={
          canManage && (
            <Button size="sm" icon={<UserPlus size={14} />} onClick={openAdd}>
              Add User
            </Button>
          )
        }
      />

      <Card>
        <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-glass-dim)]" />
            <input 
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-xl text-xs text-white focus:outline-none focus:border-[var(--primary-600)] transition-colors"
            />
          </div>
        </div>

        <Table
          headers={['User', 'Role(s)', 'Last Active', '']}
          loading={loading}
        >
          {filteredUsers.map((user) => (
            <tr key={user.id} className="hover:bg-[var(--glass-05)] transition-all">
              <td className="py-4 px-6">
                <div className="flex items-center gap-4">
                  <Avatar name={user.name} size="md" />
                  <div>
                    <p className="text-[15px] font-bold text-white truncate">{user.name}</p>
                    <p className="text-xs text-[var(--on-glass-muted)]">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-4 px-6">
                <div className="flex gap-2 flex-wrap">
                  {user.roles.map((role: any) => (
                    <Badge 
                      key={role.slug} 
                      label={role.name} 
                      color="var(--primary-600)"
                      bg="rgba(0, 200, 150, 0.1)"
                    />
                  ))}
                </div>
              </td>
              <td className="py-4 px-6 text-sm text-[var(--on-glass-dim)]">
                {user.last_active ? new Date(user.last_active).toLocaleString() : 'Never'}
              </td>
              <td className="py-4 px-6">
                {canManage && (
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openEdit(user)}
                      className="p-2 rounded-xl text-[var(--on-glass-dim)] hover:text-white hover:bg-[var(--glass-10)] transition-all"
                      title="Edit User"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteUser(user)}
                      className="p-2 rounded-xl text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 transition-all"
                      title="Delete User"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Table>

        {!loading && filteredUsers.length === 0 && (
          <div className="py-20 text-center">
            <Shield size={32} className="mx-auto text-[var(--on-glass-dim)] mb-3" />
            <p className="text-[var(--on-glass-muted)] text-sm font-medium">
              {search ? 'No users matching your search.' : 'No platform users found.'}
            </p>
          </div>
        )}
      </Card>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)}
        title="Add Platform User" size="md"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={form.handleSubmit(onSubmit)} loading={form.formState.isSubmitting}>
              Create User
            </Button>
          </div>
        }
      >
        <UserFormFields isEdit={false} />
      </Modal>

      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)}
        title="Edit Platform User" size="md"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="ghost" className="flex-1" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button className="flex-1" onClick={form.handleSubmit(onSubmit)} loading={form.formState.isSubmitting}>
              Save Changes
            </Button>
          </div>
        }
      >
        <UserFormFields isEdit={true} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete Platform User"
        message={`Are you sure you want to delete ${deleteUser?.name}? They will lose access to the platform console.`}
        confirmLabel="Delete User"
        variant="danger"
      />
    </>
  );
}

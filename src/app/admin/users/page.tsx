'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { PageHeader, Card, Table, Button, Modal, ConfirmDialog, Input, Select, Badge, Avatar } from '@/components/ui';
import { UserPlus, Edit, Trash2, Shield } from 'lucide-react';
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
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  const canManage = hasPermission('platform.users.manage');

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
        // Simplistic multiple select handling via array wrapper since our UI component might only support single select out of the box
        // To keep it simple, we assume single select for the UI here, mapped to array
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
        <Table
          headers={['User', 'Role(s)', 'Last Active', '']}
          loading={loading}
        >
          {users.map((user) => (
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

        {!loading && users.length === 0 && (
          <div className="py-20 text-center">
            <Shield size={32} className="mx-auto text-[var(--on-glass-dim)] mb-3" />
            <p className="text-[var(--on-glass-muted)] text-sm font-medium">
              No platform users found.
            </p>
          </div>
        )}
      </Card>

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)}
        title="Add Platform User" size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onSubmit)} loading={form.formState.isSubmitting}>
              Create User
            </Button>
          </>
        }
      >
        <UserFormFields isEdit={false} />
      </Modal>

      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)}
        title="Edit Platform User" size="md"
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

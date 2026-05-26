'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, Avatar } from '@/components/ui';
import { usersApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Save, Camera } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import type { User } from '@/types';

const profileSchema = z.object({
  name:      z.string().min(2, 'Name required'),
  phone:     z.string().optional(),
  job_title: z.string().optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password required'),
  new_password:     z.string().min(8, 'At least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm password'),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const profileForm = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    usersApi.getMe().then(r => {
      const u: User = r.data.data;
      setMe(u);
      profileForm.reset({ name: u.name, phone: u.phone || '', job_title: u.job_title || '' });
    }).catch(() => toast.error('Failed to load profile')).finally(() => setLoading(false));
  }, []);

  const onSaveProfile = async (data: ProfileForm) => {
    try {
      await usersApi.updateMe(data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const onChangePassword = async (data: PasswordForm) => {
    try {
      await usersApi.updateMe({ current_password: data.current_password, new_password: data.new_password });
      toast.success('Password changed');
      passwordForm.reset();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="Profile Settings" subtitle="Manage your personal information" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar card */}
        <Card className="p-6 flex flex-col items-center gap-4">
          {loading ? (
            <div className="w-24 h-24 rounded-full bg-[var(--gray-200)] animate-pulse" />
          ) : (
            <Avatar name={me?.name || ''} imageUrl={me?.avatar_url} size="xl" />
          )}
          <div className="text-center">
            <p className="font-bold text-[var(--dark-950)]">{me?.name || '—'}</p>
            <p className="text-sm text-[var(--gray-500)]">{me?.job_title || me?.role}</p>
            <p className="text-xs text-[var(--gray-500)] mt-0.5">{me?.department}</p>
          </div>
          <button className="flex items-center gap-2 text-xs text-[var(--primary-600)] hover:underline">
            <Camera size={13} /> Change photo
          </button>
          <div className="w-full pt-3 border-t border-[var(--gray-100)] space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--gray-500)]">Email</span>
              <span className="font-medium text-[var(--dark-950)] truncate max-w-[160px]">{me?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--gray-500)]">Role</span>
              <span className="font-medium text-[var(--dark-950)] capitalize">{me?.role?.replace('_', ' ')}</span>
            </div>
          </div>
        </Card>

        {/* Edit forms */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <h3 className="text-base font-bold text-[var(--dark-950)] mb-5">Personal Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Full Name" required
                  error={profileForm.formState.errors.name?.message}
                  {...profileForm.register('name')} />
                <Input label="Phone" type="tel"
                  error={profileForm.formState.errors.phone?.message}
                  {...profileForm.register('phone')} />
              </div>
              <Input label="Job Title"
                error={profileForm.formState.errors.job_title?.message}
                {...profileForm.register('job_title')} />
              <Button icon={<Save size={14} />}
                loading={profileForm.formState.isSubmitting}
                onClick={profileForm.handleSubmit(onSaveProfile)}>
                Save Changes
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-base font-bold text-[var(--dark-950)] mb-5">Change Password</h3>
            <div className="space-y-4">
              <Input label="Current Password" type="password"
                error={passwordForm.formState.errors.current_password?.message}
                {...passwordForm.register('current_password')} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="New Password" type="password"
                  error={passwordForm.formState.errors.new_password?.message}
                  {...passwordForm.register('new_password')} />
                <Input label="Confirm Password" type="password"
                  error={passwordForm.formState.errors.confirm_password?.message}
                  {...passwordForm.register('confirm_password')} />
              </div>
              <Button variant="outline" icon={<Save size={14} />}
                loading={passwordForm.formState.isSubmitting}
                onClick={passwordForm.handleSubmit(onChangePassword)}>
                Update Password
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

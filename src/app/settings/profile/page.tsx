'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, Avatar, Skeleton } from '@/components/ui';
import { usersApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import type { User } from '@/types';
import { Save, User as UserIcon, Mail, Phone, Briefcase, Building } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export default function ProfileSettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      job_title: '',
      department: '',
    }
  });

  useEffect(() => {
    usersApi.getMe()
      .then(r => {
        const u = r.data.data;
        setUser(u);
        reset({
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          job_title: u.job_title,
          department: u.department,
        });
      })
      .catch(err => toast.error(getApiError(err)))
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      await usersApi.updateMe(data);
      toast.success('Profile updated successfully');
      // Refresh user data
      const r = await usersApi.getMe();
      setUser(r.data.data);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Profile Settings"
        subtitle="Manage your personal information and preferences"
        actions={
          <Button icon={<Save size={14} />} loading={saving} onClick={handleSubmit(onSubmit)}>
            Save Changes
          </Button>
        }
      />

      <div className="max-w-4xl">
        {loading ? (
          <Card className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <Avatar name={user?.name || ''} imageUrl={user?.avatar_url} size="lg" />
                <div className="text-center">
                  <h3 className="font-bold text-[var(--dark-950)]">{user?.name}</h3>
                  <p className="text-xs text-[var(--gray-500)] uppercase font-semibold tracking-wider">{user?.role?.replace('_', ' ')}</p>
                </div>
                <Button variant="outline" size="sm">Change Photo</Button>
              </div>

              {/* Form Section */}
              <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Full Name"
                    required
                    leftIcon={<UserIcon size={16} />}
                    error={errors.name?.message}
                    {...register('name', { required: 'Name is required' })}
                  />
                  <Input
                    label="Email Address"
                    required
                    type="email"
                    leftIcon={<Mail size={16} />}
                    error={errors.email?.message}
                    {...register('email', { required: 'Email is required' })}
                  />
                  <Input
                    label="Phone Number"
                    leftIcon={<Phone size={16} />}
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                  <Input
                    label="Job Title"
                    required
                    leftIcon={<Briefcase size={16} />}
                    error={errors.job_title?.message}
                    {...register('job_title', { required: 'Job title is required' })}
                  />
                  <Input
                    label="Department"
                    required
                    leftIcon={<Building size={16} />}
                    error={errors.department?.message}
                    {...register('department', { required: 'Department is required' })}
                  />
                </div>

                <div className="pt-4 border-t border-[var(--gray-100)] flex justify-end">
                  <Button type="submit" loading={saving} icon={<Save size={16} />}>
                    Save Profile
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

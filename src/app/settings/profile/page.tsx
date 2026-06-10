'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, Avatar, Modal } from '@/components/ui';
import { usersApi, authApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Save, Camera, Shield, ShieldCheck, ShieldOff } from 'lucide-react';
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

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled]       = useState(false);
  const [setup2FAOpen, setSetup2FAOpen]        = useState(false);
  const [disable2FAOpen, setDisable2FAOpen]    = useState(false);
  const [qrDataUrl, setQrDataUrl]              = useState('');
  const [otpSecret, setOtpSecret]              = useState('');
  const [verifyCode, setVerifyCode]            = useState('');
  const [disableCode, setDisableCode]          = useState('');
  const [saving2FA, setSaving2FA]              = useState(false);

  const profileForm = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    usersApi.getMe().then(r => {
      const u: User = r.data.data;
      setMe(u);
      setTwoFAEnabled(!!(u as unknown as { totp_enabled?: boolean }).totp_enabled);
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

  const onSetup2FA = async () => {
    setSaving2FA(true);
    try {
      const { data } = await authApi.setup2FA();
      setQrDataUrl(data.data?.qr_code || '');
      setOtpSecret(data.data?.secret || '');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving2FA(false);
    }
  };

  const onVerify2FA = async () => {
    if (!verifyCode.trim()) { toast.error('Enter the 6-digit code'); return; }
    setSaving2FA(true);
    try {
      await authApi.verify2FA(verifyCode);
      toast.success('Two-factor authentication enabled');
      setTwoFAEnabled(true);
      setSetup2FAOpen(false);
      setQrDataUrl(''); setOtpSecret(''); setVerifyCode('');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving2FA(false);
    }
  };

  const onDisable2FA = async () => {
    if (!disableCode.trim()) { toast.error('Enter the 6-digit code'); return; }
    setSaving2FA(true);
    try {
      await authApi.disable2FA(disableCode);
      toast.success('Two-factor authentication disabled');
      setTwoFAEnabled(false);
      setDisable2FAOpen(false);
      setDisableCode('');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving2FA(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="Profile Settings" subtitle="Manage your personal information" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar card */}
        <Card className="glass-card p-6 flex flex-col items-center gap-4">
          {loading ? (
            <div className="w-24 h-24 rounded-full bg-slate-800/40 animate-pulse border border-glass" />
          ) : (
            <Avatar name={me?.name || ''} imageUrl={me?.avatar_url} size="xl" />
          )}
          <div className="text-center">
            <p className="font-bold text-slate-100">{me?.name || '—'}</p>
            <p className="text-sm text-slate-400">{me?.job_title || me?.role}</p>
            <p className="text-xs text-slate-500 mt-0.5">{me?.department}</p>
          </div>
          <button className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
            <Camera size={13} /> Change photo
          </button>
          <div className="w-full pt-3 border-t border-glass space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-200 truncate max-w-[160px]">{me?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Role</span>
              <span className="font-medium text-slate-200 capitalize">{me?.role?.replace('_', ' ')}</span>
            </div>
          </div>
        </Card>

        {/* Edit forms */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-card p-6">
            <h3 className="text-base font-bold text-slate-100 mb-5">Personal Information</h3>
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

          <Card className="glass-card p-6">
            <h3 className="text-base font-bold text-slate-100 mb-5">Change Password</h3>
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

          {/* 2FA Card */}
          <Card className="glass-card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${twoFAEnabled ? 'bg-emerald-500/10' : 'bg-slate-800/50 border border-glass'}`}>
                  {twoFAEnabled
                    ? <ShieldCheck size={20} className="text-emerald-400" />
                    : <Shield size={20} className="text-slate-600" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Two-Factor Authentication</h3>
                  <p className="text-sm text-slate-400">
                    {twoFAEnabled ? 'Your account is secured with 2FA.' : 'Add an extra layer of security to your account.'}
                  </p>
                </div>
              </div>
              {twoFAEnabled ? (
                <Button variant="danger" size="sm" icon={<ShieldOff size={14} />}
                  onClick={() => setDisable2FAOpen(true)}>
                  Disable
                </Button>
              ) : (
                <Button variant="outline" size="sm" icon={<Shield size={14} />}
                  onClick={() => { setSetup2FAOpen(true); onSetup2FA(); }}>
                  Enable 2FA
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      <Modal
        isOpen={setup2FAOpen}
        onClose={() => { setSetup2FAOpen(false); setQrDataUrl(''); setOtpSecret(''); setVerifyCode(''); }}
        title="Set Up Two-Factor Authentication"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setSetup2FAOpen(false); setQrDataUrl(''); setOtpSecret(''); setVerifyCode(''); }}>
              Cancel
            </Button>
            <Button loading={saving2FA} onClick={onVerify2FA}>Verify & Enable</Button>
          </>
        }
      >
        <div className="space-y-5">
          {!qrDataUrl ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-400">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.
              </p>
              <div className="flex justify-center">
                <img src={qrDataUrl} alt="2FA QR Code" className="w-48 h-48 border border-glass rounded-xl p-2 bg-white" />
              </div>
              {otpSecret && (
                <div className="p-3 bg-slate-800/50 rounded-lg border border-glass">
                  <p className="text-xs text-slate-500 mb-1">Manual entry key:</p>
                  <p className="font-mono text-sm text-emerald-400 tracking-widest break-all">{otpSecret}</p>
                </div>
              )}
              <Input
                label="Verification Code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-xl tracking-widest font-mono"
              />
            </>
          )}
        </div>
      </Modal>

      {/* Disable 2FA Modal */}
      <Modal
        isOpen={disable2FAOpen}
        onClose={() => { setDisable2FAOpen(false); setDisableCode(''); }}
        title="Disable Two-Factor Authentication"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDisable2FAOpen(false); setDisableCode(''); }}>Cancel</Button>
            <Button variant="danger" loading={saving2FA} onClick={onDisable2FA}>Disable 2FA</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Enter the current code from your authenticator app to disable 2FA. Your account will be less secure without it.</p>
          <Input
            label="Authenticator Code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={disableCode}
            onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
            className="text-center text-xl tracking-widest font-mono"
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}

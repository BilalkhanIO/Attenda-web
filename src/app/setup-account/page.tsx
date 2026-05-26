'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError } from '@/lib/utils';
import { Button, Input } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type Form = z.infer<typeof schema>;

function SetupAccountContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { loginWithTokens } = useAuth();
  const token        = searchParams.get('token');
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!token) toast.error('Missing invite token — please use the link from your invitation email');
  }, [token]);

  const onSubmit = async (data: Form) => {
    if (!token) return;
    try {
      const { data: res } = await authApi.setupAccount(token, data.password);
      const { access_token, refresh_token } = res.data;
      loginWithTokens(access_token, refresh_token);
      toast.success('Account set up! Welcome to Attenda.');
      router.push('/dashboard');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--gray-50)] p-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <AttendaLogo iconSize={40} variant="light" />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-[var(--gray-200)] p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[var(--danger-100)] flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-[var(--danger-800)]" />
            </div>
            <h1 className="text-xl font-bold text-[var(--dark-950)]">Invalid invite link</h1>
            <p className="text-sm text-[var(--gray-500)]">
              This invite link is missing a token. Please use the link sent to your email by your HR administrator.
            </p>
            <Button variant="ghost" className="w-full" onClick={() => router.push('/login')}>
              Go to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-50)] p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <AttendaLogo iconSize={40} variant="light" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[var(--gray-200)] p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--dark-950)] mb-1">Welcome to Attenda</h1>
            <p className="text-sm text-[var(--gray-500)]">
              You&apos;ve been invited to join your team&apos;s workspace. Set a password to activate your account.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Password"
              type={showPass ? 'text' : 'password'}
              required
              error={errors.password?.message}
              rightIcon={
                <button type="button" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              {...register('password')}
            />
            <Input
              label="Confirm Password"
              type={showConf ? 'text' : 'password'}
              required
              error={errors.confirm?.message}
              rightIcon={
                <button type="button" onClick={() => setShowConf(v => !v)}>
                  {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              {...register('confirm')}
            />

            <div className="p-3 bg-[var(--gray-50)] rounded-lg text-xs text-[var(--gray-500)] space-y-1">
              <p className="font-semibold text-[var(--dark-950)]">Password requirements:</p>
              <p>• At least 8 characters</p>
              <p>• One uppercase letter (A–Z)</p>
              <p>• One number (0–9)</p>
              <p>• One special character (!@#$...)</p>
            </div>

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Activate Account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-50)]">
      <div className="w-8 h-8 border-2 border-[var(--primary-600)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function SetupAccountPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <SetupAccountContent />
    </Suspense>
  );
}

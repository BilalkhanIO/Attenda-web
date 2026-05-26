'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Button, Input } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';
import { Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
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

function ResetPasswordContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token');
  const [done, setDone]           = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [showConf, setShowConf]   = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!token) {
      toast.error('Missing reset token — please use the link from your email');
    }
  }, [token]);

  const onSubmit = async (data: Form) => {
    if (!token) return;
    try {
      await authApi.resetPassword(token, data.password);
      setDone(true);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-50)] p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <AttendaLogo iconSize={40} variant="light" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[var(--gray-200)] p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[var(--success-100)] flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-[var(--success-700)]" />
              </div>
              <h1 className="text-xl font-bold text-[var(--dark-950)]">Password reset!</h1>
              <p className="text-sm text-[var(--gray-500)]">Your password has been updated. You can now sign in with your new password.</p>
              <Button className="w-full" onClick={() => router.push('/login')}>
                Go to Sign In
              </Button>
            </div>
          ) : !token ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[var(--danger-100)] flex items-center justify-center mx-auto">
                <AlertTriangle size={28} className="text-[var(--danger-800)]" />
              </div>
              <h1 className="text-xl font-bold text-[var(--dark-950)]">Invalid link</h1>
              <p className="text-sm text-[var(--gray-500)]">This reset link is missing a token. Please request a new password reset from the login page.</p>
              <Button variant="ghost" className="w-full" onClick={() => router.push('/login')}>
                Back to Sign In
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[var(--dark-950)] mb-1">Set new password</h1>
              <p className="text-sm text-[var(--gray-500)] mb-6">
                Choose a strong password with at least 8 characters, one uppercase letter, one number, and one special character.
              </p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="New Password"
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
                <Button type="submit" className="w-full" loading={isSubmitting}>
                  Reset Password
                </Button>
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="w-full text-sm text-[var(--gray-500)] hover:text-[var(--dark-950)] transition-colors"
                >
                  Back to Sign In
                </button>
              </form>
            </>
          )}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

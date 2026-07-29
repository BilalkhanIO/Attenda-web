'use client';
import { useState, useEffect, Suspense } from 'react';
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
    <div className="min-h-screen flex items-center justify-center bg-[var(--dark-950)] p-6 selection:bg-[var(--primary-600)] selection:text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[var(--primary-600)]/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <AttendaLogo iconSize={44} />
        </div>

        <div className="bg-[var(--glass-05)] backdrop-blur-2xl rounded-[3rem] border border-[var(--glass-border)] p-10 md:p-12 shadow-2xl">
          {done ? (
            <div className="text-center page-fade-in">
              <div className="w-20 h-20 rounded-[2rem] bg-[var(--success-500)]/20 border border-[var(--success-500)]/30 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[var(--success-500)]/10 animate-bounce">
                <CheckCircle size={36} className="text-[var(--success-500)]" />
              </div>
              <h1 className="text-2xl font-black text-white mb-4 tracking-tight">Password reset!</h1>
              <p className="text-sm font-medium text-[var(--on-glass-muted)] mb-10 leading-relaxed">
                Your password has been updated successfully. You can now sign in with your new password.
              </p>
              <Button className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em]" onClick={() => router.push('/login')}>
                Go to Login
              </Button>
            </div>
          ) : !token ? (
            <div className="text-center page-fade-in">
              <div className="w-20 h-20 rounded-[2rem] bg-[var(--danger-500)]/20 border border-[var(--danger-500)]/30 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[var(--danger-500)]/10">
                <AlertTriangle size={36} className="text-[var(--danger-500)]" />
              </div>
              <h1 className="text-2xl font-black text-white mb-4 tracking-tight">Invalid Link</h1>
              <p className="text-sm font-medium text-[var(--on-glass-muted)] mb-10 leading-relaxed">
                This recovery link is invalid or has expired. Please request a new link from the login page.
              </p>
              <Button variant="ghost" className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em]" onClick={() => router.push('/login')}>
                Return to Login
              </Button>
            </div>
          ) : (
            <div className="page-fade-in">
              <div className="mb-10">
                <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.3em] mb-4">Security</p>
                <h1 className="text-3xl font-black text-white mb-2 tracking-tight">New Password</h1>
                <p className="text-sm font-medium text-[var(--on-glass-muted)]">Please enter and confirm your new account password.</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <Input
                  label="New Password"
                  type={showPass ? 'text' : 'password'}
                  required
                  error={errors.password?.message}
                  className="bg-[var(--glass-10)]"
                  rightIcon={
                    <button type="button" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Hide password' : 'Show password'} className="hover:text-white transition-colors">
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                  {...register('password')}
                />
                <Input
                  label="Confirm Password"
                  type={showConf ? 'text' : 'password'}
                  required
                  error={errors.confirm?.message}
                  className="bg-[var(--glass-10)]"
                  rightIcon={
                    <button type="button" onClick={() => setShowConf(v => !v)} aria-label={showConf ? 'Hide password' : 'Show password'} className="hover:text-white transition-colors">
                      {showConf ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                  {...register('confirm')}
                />

                <div className="space-y-4 pt-4">
                  <Button type="submit" className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em]" loading={isSubmitting}>
                    Reset Password
                  </Button>
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="w-full text-[10px] font-black text-[var(--on-glass-muted)] hover:text-white uppercase tracking-widest transition-all"
                  >
                    ← Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--dark-950)]">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-12">
             <div className="w-11 h-11 rounded-xl bg-[var(--glass-10)] animate-pulse" />
          </div>
          <div className="bg-[var(--glass-05)] rounded-[3rem] border border-[var(--glass-border)] p-12 h-96">
            <div className="animate-pulse space-y-8">
              <div className="h-8 bg-[var(--glass-10)] rounded-full w-3/4" />
              <div className="h-4 bg-[var(--glass-10)] rounded-full w-full" />
              <div className="space-y-4 pt-10">
                 <div className="h-14 bg-[var(--glass-10)] rounded-2xl w-full" />
                 <div className="h-14 bg-[var(--glass-10)] rounded-2xl w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

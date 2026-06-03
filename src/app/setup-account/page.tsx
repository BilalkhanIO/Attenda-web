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
import { Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--dark-950)] p-6 selection:bg-[var(--primary-600)] selection:text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[var(--primary-600)]/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-12">
          <AttendaLogo iconSize={44} />
        </div>

        <div className="bg-[var(--glass-05)] backdrop-blur-2xl rounded-[3rem] border border-[var(--glass-border)] p-10 md:p-12 shadow-2xl">
          {!token ? (
            <div className="text-center page-fade-in">
              <div className="w-20 h-20 rounded-[2rem] bg-[var(--danger-500)]/20 border border-[var(--danger-500)]/30 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[var(--danger-500)]/10">
                <AlertTriangle size={36} className="text-[var(--danger-500)]" />
              </div>
              <h1 className="text-2xl font-black text-white mb-4 tracking-tight">Invalid invite link</h1>
              <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed mb-10">
                This invite link is missing a token. Please use the link sent to your email by your HR administrator.
              </p>
              <Button variant="ghost" className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em]" onClick={() => router.push('/login')}>
                Go to Sign In
              </Button>
            </div>
          ) : (
            <div className="page-fade-in">
              <div className="mb-10">
                <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.3em] mb-4">Activation</p>
                <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Welcome to Attenda</h1>
                <p className="text-sm font-medium text-[var(--on-glass-muted)]">
                  You&apos;ve been invited to join your team&apos;s workspace. Set a password to activate your account.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <Input
                  label="New Password"
                  type={showPass ? 'text' : 'password'}
                  required
                  error={errors.password?.message}
                  className="bg-[var(--glass-10)]"
                  rightIcon={
                    <button type="button" onClick={() => setShowPass(v => !v)} className="hover:text-white transition-colors">
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
                    <button type="button" onClick={() => setShowConf(v => !v)} className="hover:text-white transition-colors">
                      {showConf ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                  {...register('confirm')}
                />

                <div className="p-4 bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl text-[11px] font-medium text-[var(--on-glass-muted)] space-y-2">
                  <p className="font-bold text-white uppercase tracking-widest">Password requirements:</p>
                  <p>• At least 8 characters</p>
                  <p>• One uppercase letter (A–Z)</p>
                  <p>• One number (0–9)</p>
                  <p>• One special character (!@#$...)</p>
                </div>

                <Button type="submit" className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em] mt-4" loading={isSubmitting}>
                  Activate Account
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--dark-950)]">
       <div className="w-10 h-10 border-4 border-[var(--primary-600)] border-t-transparent rounded-full animate-spin" />
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

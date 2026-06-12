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
import { Eye, EyeOff, AlertTriangle, ShieldCheck, Zap, Lock, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const schema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type Form = z.infer<typeof schema>;

const FEATURES = [
  { icon: ShieldCheck, title: 'Secure access', text: 'Enterprise-grade security for your team' },
  { icon: Zap,         title: 'Instant sync',  text: 'Everything ready from the first login' },
  { icon: Sparkles,    title: 'Modern UX',     text: 'Built for efficiency and speed' },
];

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
      await loginWithTokens(access_token, refresh_token);
      toast.success('Account set up! Welcome to Attenda.');
      router.push('/dashboard');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--dark-950)] selection:bg-[var(--primary-600)] selection:text-white font-sans">
      {/* Left panel */}
      <div className="hidden lg:flex w-[55%] bg-[var(--dark-950)] flex-col justify-between p-16 relative overflow-hidden border-r border-[var(--glass-border)]">
        {/* Background Visuals */}
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-[var(--dark-800)] to-[var(--dark-950)] opacity-50" />
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[var(--primary-600)]/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />

        <div className="relative z-10">
          <AttendaLogo iconSize={44} />
        </div>

        {/* Feature highlights */}
        <div className="space-y-12 relative z-10 max-w-lg">
          <div className="slide-in-left">
            <h1 className="text-6xl font-black text-white leading-[1.05] mb-8 tracking-tighter">
              Activate your<br />workspace<br /><span className="text-[var(--primary-600)]">now.</span>
            </h1>
            <p className="text-lg font-medium text-[var(--on-glass-muted)] leading-relaxed">
              You&apos;ve been invited to join Attenda. Secure your account and start managing your team more effectively.
            </p>
          </div>

          <div className="space-y-6 slide-in-left delay-150">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-center gap-5 group">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[var(--glass-10)] border border-[var(--glass-border)] text-[var(--primary-600)] transition-all group-hover:scale-110 group-hover:border-[var(--primary-600)]/50">
                  <f.icon size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-black text-white uppercase tracking-widest mb-0.5">{f.title}</p>
                  <p className="text-sm font-medium text-[var(--on-glass-muted)]">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
           <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.2em]">&copy; {new Date().getFullYear()} Attenda. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel — Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden bg-gradient-to-br from-[var(--dark-800)]/30 to-transparent">
        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-12">
            <AttendaLogo iconSize={44} />
          </div>

          <div className="relative overflow-hidden page-fade-in">
            {!token ? (
              <div className="text-center py-6">
                <div className="w-20 h-20 rounded-[2rem] bg-[var(--danger-500)]/20 border border-[var(--danger-500)]/30 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[var(--danger-500)]/10">
                  <AlertTriangle size={36} className="text-[var(--danger-500)]" />
                </div>
                <h2 className="text-2xl font-black text-white mb-4 tracking-tight">Invalid invite link</h2>
                <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed mb-10">
                  This invite link is missing a token. Please use the link sent to your email by your HR administrator.
                </p>
                <Button variant="ghost" className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em]" onClick={() => router.push('/login')}>
                  Go to Sign In
                </Button>
              </div>
            ) : (
              <div>
                <div className="mb-10">
                  <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.3em] mb-4">Activation</p>
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Welcome to Attenda</h2>
                  <p className="text-sm font-medium text-[var(--on-glass-muted)]">
                    Set a secure password to activate your workspace account.
                  </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <Input
                    label="New Password"
                    type={showPass ? 'text' : 'password'}
                    required
                    leftIcon={<Lock size={18} />}
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
                    leftIcon={<Lock size={18} />}
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
                    <p className="flex items-center gap-2">• At least 8 characters</p>
                    <p className="flex items-center gap-2">• One uppercase letter (A–Z)</p>
                    <p className="flex items-center gap-2">• One number (0–9)</p>
                    <p className="flex items-center gap-2">• One special character (!@#$...)</p>
                  </div>

                  <Button type="submit" className="w-full py-5 text-[13px] font-black uppercase tracking-[0.2em]" size="lg" loading={isSubmitting}>
                    Activate Account
                  </Button>
                </form>

                <div className="mt-10 text-center">
                  <Link href="/login" className="text-xs font-bold text-[var(--on-glass-muted)] hover:text-white transition-all">
                     ← Back to sign in
                  </Link>
                </div>
              </div>
            )}
          </div>
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

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { authApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Button, Input, Modal } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';
import { Eye, EyeOff, Mail, Shield, MapPin, MessageCircle, Bot, Banknote } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type LoginForm  = z.infer<typeof loginSchema>;
type ForgotForm = z.infer<typeof forgotSchema>;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export default function LoginPage() {
  const { login, loginWithTokens } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [partialToken, setPartialToken] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [submitting2FA, setSubmitting2FA] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const forgotForm = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onLogin = async (data: LoginForm) => {
    try {
      const res = await authApi.login(data.email, data.password);
      const payload = res.data.data;
      if (payload.requires_2fa) {
        setPartialToken(payload.partial_token);
        setRequires2FA(true);
      } else {
        await loginWithTokens(payload.access_token, payload.refresh_token, rememberMe);
        router.push('/dashboard');
      }
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const onVerify2FA = async () => {
    if (!twoFACode.trim()) { toast.error('Enter the 6-digit code from your authenticator app'); return; }
    setSubmitting2FA(true);
    try {
      const res = await authApi.authenticate2FA(partialToken, twoFACode);
      const { access_token, refresh_token } = res.data.data;
      await loginWithTokens(access_token, refresh_token, rememberMe);
      router.push('/dashboard');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSubmitting2FA(false);
    }
  };

  const onForgotPassword = async (data: ForgotForm) => {
    try {
      await authApi.forgotPassword(data.email);
      setForgotSent(true);
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
              Your team,<br />always accounted<br /><span className="text-[var(--primary-600)]">for.</span>
            </h1>
            <p className="text-lg font-medium text-[var(--on-glass-muted)] leading-relaxed">
              Automated attendance, payroll, leave and performance — all in one dashboard built for modern businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 slide-in-left delay-150">
            {[
              { icon: <MapPin size={20} />, text: 'Auto check-in via office WiFi' },
              { icon: <MessageCircle size={20} />, text: 'Real-time WhatsApp alerts' },
              { icon: <Bot size={20} />, text: 'AI-powered remote check-ins' },
              { icon: <Banknote size={20} />, text: 'One-click payroll processing' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-4 group">
                <div className="w-11 h-11 flex items-center justify-center rounded-2xl bg-[var(--glass-10)] border border-[var(--glass-border)] text-[var(--primary-600)] transition-all group-hover:scale-110 group-hover:border-[var(--primary-600)]/50">
                  {f.icon}
                </div>
                <span className="text-white/80 text-[13px] font-bold tracking-tight leading-tight">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
           <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.2em]">&copy; {new Date().getFullYear()} Attenda. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden bg-gradient-to-br from-[var(--dark-800)]/30 to-transparent">
        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-12">
            <AttendaLogo iconSize={44} />
          </div>

          <div className="p-8 md:p-10 rounded-[3rem] bg-[var(--glass-05)] border border-[var(--glass-border)] backdrop-blur-2xl shadow-2xl relative overflow-hidden page-fade-in">
             {/* Subtle Glow */}
             <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[var(--primary-600)]/5 blur-[60px] rounded-full pointer-events-none" />

             {requires2FA ? (
               /* ── 2FA Step ─────────────────────────────── */
               <div className="space-y-8">
                 <div>
                   <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Two-factor verification</h2>
                   <p className="text-sm font-medium text-[var(--on-glass-muted)]">Enter the 6-digit code from your authenticator app.</p>
                 </div>

                 <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--primary-600)]/10 border border-[var(--primary-600)]/20">
                   <Shield size={20} className="text-[var(--primary-600)] flex-shrink-0" />
                   <p className="text-[11px] font-bold text-[var(--primary-600)] uppercase tracking-widest leading-relaxed">Your account has 2FA enabled</p>
                 </div>

                 <Input
                   label="Authenticator Code"
                   type="text"
                   inputMode="numeric"
                   maxLength={6}
                   placeholder="000000"
                   value={twoFACode}
                   onChange={e => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                   className="text-center text-3xl tracking-[0.5em] font-black bg-[var(--glass-10)] border-[var(--glass-border)] h-16"
                 />

                 <Button className="w-full py-4 text-[13px] font-black uppercase tracking-[0.2em]" size="lg" loading={submitting2FA} onClick={onVerify2FA}>
                   Verify
                 </Button>

                 <button
                   type="button"
                   onClick={() => { setRequires2FA(false); setTwoFACode(''); setPartialToken(''); }}
                   className="w-full text-xs font-bold text-[var(--on-glass-dim)] hover:text-white transition-colors"
                 >
                   ← Back to sign in
                 </button>
               </div>
             ) : (
               /* ── Login Form ───────────────────────────── */
               <>
                 <div className="mb-10">
                   <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Welcome back</h2>
                   <p className="text-sm font-medium text-[var(--on-glass-muted)]">Sign in to your workspace</p>
                 </div>

                 {/* SSO */}
                 <div className="space-y-4 mb-8">
                    <a
                      href={`${API_BASE}/auth/sso/google`}
                      className="group flex items-center justify-center gap-4 w-full h-14 bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl hover:bg-[var(--glass-15)] hover:border-[var(--glass-high)] transition-all active:scale-95"
                    >
                      <svg width="20" height="20" viewBox="0 0 18 18">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#FFFFFF"/>
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#FFFFFF" opacity="0.6"/>
                        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FFFFFF" opacity="0.4"/>
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#FFFFFF" opacity="0.2"/>
                      </svg>
                      <span className="text-[13px] font-black text-white uppercase tracking-widest">Sign in with Google</span>
                    </a>
                 </div>

                 <div className="flex items-center gap-6 mb-8">
                   <div className="flex-1 h-px bg-[var(--glass-border)]" />
                   <span className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.2em]">or</span>
                   <div className="flex-1 h-px bg-[var(--glass-border)]" />
                 </div>

                 <form onSubmit={handleSubmit(onLogin)} className="space-y-6">
                   <Input
                     label="Email address"
                     type="email"
                     placeholder="you@company.com"
                     leftIcon={<Mail size={18} />}
                     error={errors.email?.message}
                     required
                     className="bg-[var(--glass-10)]"
                     {...register('email')}
                   />
                   <div className="space-y-2">
                      <Input
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        error={errors.password?.message}
                        required
                        className="bg-[var(--glass-10)]"
                        rightIcon={
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="hover:text-white transition-colors">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        }
                        {...register('password')}
                      />
                      <div className="flex justify-end pr-1">
                        <button
                          type="button"
                          onClick={() => setForgotOpen(true)}
                          className="text-xs font-bold text-[var(--primary-600)] hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                   </div>

                   <label className="flex items-center gap-3 cursor-pointer select-none group">
                     <div className={`relative w-5 h-5 rounded-md border-2 shrink-0 transition-all ${rememberMe ? 'bg-(--primary-600) border-(--primary-600)' : 'bg-transparent border-(--glass-high) group-hover:border-(--primary-600)/50'}`}>
                       <input
                         type="checkbox"
                         className="sr-only"
                         checked={rememberMe}
                         onChange={e => setRememberMe(e.target.checked)}
                       />
                       {rememberMe && (
                         <svg className="absolute inset-0 m-auto w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                         </svg>
                       )}
                     </div>
                     <span className="text-xs font-bold text-(--on-glass-muted) group-hover:text-white transition-colors">Remember me for 30 days</span>
                   </label>

                   <Button type="submit" className="w-full py-5 text-[13px] font-black uppercase tracking-[0.2em]" size="lg" loading={isSubmitting}>
                     Sign In
                   </Button>
                 </form>

                 <div className="mt-10 text-center space-y-4">
                    <p className="text-xs text-[var(--on-glass-dim)]">
                      Don&apos;t have an account? Contact your HR Admin.
                    </p>
                    <Link href="/" className="inline-block text-xs font-bold text-[var(--on-glass-muted)] hover:text-white transition-all">
                       ← Back to homepage
                    </Link>
                 </div>
               </>
             )}
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={forgotOpen}
        onClose={() => { setForgotOpen(false); setForgotSent(false); forgotForm.reset(); }}
        title="Reset your password"
        size="sm"
        footer={
          !forgotSent ? (
            <>
              <Button variant="ghost" onClick={() => setForgotOpen(false)}>Cancel</Button>
              <Button
                onClick={forgotForm.handleSubmit(onForgotPassword)}
                loading={forgotForm.formState.isSubmitting}
              >
                Send reset link
              </Button>
            </>
          ) : (
            <Button onClick={() => { setForgotOpen(false); setForgotSent(false); }}>
              Done
            </Button>
          )
        }
      >
        {forgotSent ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--primary-600)]/10 border border-[var(--primary-600)]/20 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[var(--primary-600)]/10">
              <Mail size={24} className="text-[var(--primary-600)]" />
            </div>
            <p className="text-lg font-black text-white mb-2 tracking-tight">Check your email</p>
            <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed">
              We&apos;ve sent a password reset link. It expires in 15 minutes.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-[13px] font-medium text-[var(--on-glass-muted)] leading-relaxed">
              Enter your email address and we&apos;ll send you a reset link.
            </p>
            <Input
              label="Email address"
              type="email"
              placeholder="you@company.com"
              leftIcon={<Mail size={18} />}
              error={forgotForm.formState.errors.email?.message}
              required
              className="bg-[var(--glass-10)]"
              {...forgotForm.register('email')}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

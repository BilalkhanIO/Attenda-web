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

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type LoginForm  = z.infer<typeof loginSchema>;
type ForgotForm = z.infer<typeof forgotSchema>;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

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
        loginWithTokens(payload.access_token, payload.refresh_token);
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
      loginWithTokens(access_token, refresh_token);
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
    <div className="min-h-screen flex bg-[var(--gray-50)]">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-[var(--dark-950)] flex-col justify-between p-12">
        {/* Logo */}
        <AttendaLogo iconSize={40} variant="dark" />

        {/* Feature highlights */}
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Your team,<br />always accounted<br />for.
            </h1>
            <p className="text-white/50 text-base leading-relaxed">
              Automated attendance, payroll, leave and performance — all in one dashboard built for small businesses.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: <MapPin size={16} />, text: 'Auto check-in via office WiFi IP' },
              { icon: <MessageCircle size={16} />, text: 'Real-time WhatsApp notifications' },
              { icon: <Bot size={16} />, text: 'AI-powered remote work check-ins' },
              { icon: <Banknote size={16} />, text: 'One-click payroll processing' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white/70 flex-shrink-0">{f.icon}</span>
                <span className="text-white/70 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs">© 2026 Attenda. All rights reserved.</p>
      </div>

      {/* Right panel — Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-start mb-8">
            <AttendaLogo iconSize={36} variant="light" />
          </div>

          {requires2FA ? (
            /* ── 2FA Step ─────────────────────────────── */
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-[var(--dark-950)] mb-1">Two-factor verification</h2>
                <p className="text-sm text-[var(--gray-500)]">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--primary-50)] border border-[var(--primary-100)]">
                <Shield size={18} className="text-[var(--primary-600)] flex-shrink-0" />
                <p className="text-sm text-[var(--primary-600)]">Your account has 2FA enabled for extra security.</p>
              </div>
              <Input
                label="Authenticator Code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={twoFACode}
                onChange={e => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono"
              />
              <Button className="w-full" size="lg" loading={submitting2FA} onClick={onVerify2FA}>
                Verify
              </Button>
              <button
                type="button"
                onClick={() => { setRequires2FA(false); setTwoFACode(''); setPartialToken(''); }}
                className="w-full text-sm text-[var(--gray-500)] hover:text-[var(--dark-950)] transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          ) : (
            /* ── Login Form ───────────────────────────── */
            <>
              <h2 className="text-2xl font-bold text-[var(--dark-950)] mb-1">Welcome back</h2>
              <p className="text-sm text-[var(--gray-500)] mb-6">Sign in to your workspace</p>

              {/* Google SSO */}
              <a
                href={`${API_BASE}/auth/sso/google`}
                className="flex items-center justify-center gap-3 w-full px-4 py-2.5 text-sm font-semibold text-[var(--dark-950)] border border-[var(--gray-200)] rounded-lg hover:bg-[var(--gray-50)] transition-colors mb-4"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </a>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[var(--gray-200)]" />
                <span className="text-xs text-[var(--gray-500)]">or</span>
                <div className="flex-1 h-px bg-[var(--gray-200)]" />
              </div>

              <form onSubmit={handleSubmit(onLogin)} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@company.com"
                  leftIcon={<Mail size={16} />}
                  error={errors.email?.message}
                  required
                  {...register('email')}
                />
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  error={errors.password?.message}
                  required
                  rightIcon={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="hover:text-[var(--dark-950)] transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  {...register('password')}
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-sm text-[var(--primary-600)] hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                  Sign In
                </Button>
              </form>

              <p className="text-center text-xs text-[var(--gray-500)] mt-6">
                Don&apos;t have an account? Contact your HR Admin.
              </p>
            </>
          )}
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
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-[var(--success-100)] flex items-center justify-center mx-auto mb-3">
              <Mail size={20} className="text-[var(--success-700)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--dark-950)] mb-1">Check your email</p>
            <p className="text-sm text-[var(--gray-500)]">
              We&apos;ve sent a password reset link. It expires in 15 minutes.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--gray-500)] mb-4">
              Enter your email address and we&apos;ll send you a reset link.
            </p>
            <Input
              label="Email address"
              type="email"
              placeholder="you@company.com"
              leftIcon={<Mail size={16} />}
              error={forgotForm.formState.errors.email?.message}
              required
              {...forgotForm.register('email')}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

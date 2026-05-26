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
import { Eye, EyeOff, Mail } from 'lucide-react';
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

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const forgotForm = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onLogin = async (data: LoginForm) => {
    try {
      await login(data.email, data.password);
      router.push('/dashboard');
    } catch (err) {
      toast.error(getApiError(err));
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
              { icon: '📍', text: 'Auto check-in via office WiFi IP' },
              { icon: '💬', text: 'Real-time WhatsApp notifications' },
              { icon: '🤖', text: 'AI-powered remote work check-ins' },
              { icon: '💰', text: 'One-click payroll processing' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="text-xl">{f.icon}</span>
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
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-600)] flex items-center justify-center">
              <Wifi size={16} className="text-white" />
            </div>
            <span className="text-[var(--dark-950)] font-bold text-xl">Attenda</span>
          </div>

          <h2 className="text-2xl font-bold text-[var(--dark-950)] mb-1">Welcome back</h2>
          <p className="text-sm text-[var(--gray-500)] mb-8">Sign in to your workspace</p>

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

          <p className="text-center text-xs text-[var(--gray-500)] mt-8">
            Don&apos;t have an account? Contact your HR Admin.
          </p>
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

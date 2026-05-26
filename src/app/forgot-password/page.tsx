'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Button, Input } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';
import { Mail, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router  = useRouter();
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    try {
      await authApi.forgotPassword(data.email);
      setSentEmail(data.email);
      setSent(true);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-50)] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <AttendaLogo iconSize={40} variant="light" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[var(--gray-200)] p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[var(--success-100)] flex items-center justify-center mx-auto">
                <CheckCircle size={28} className="text-[var(--success-700)]" />
              </div>
              <h1 className="text-xl font-bold text-[var(--dark-950)]">Check your inbox</h1>
              <p className="text-sm text-[var(--gray-500)]">
                If <span className="font-semibold text-[var(--dark-950)]">{sentEmail}</span> is registered, you&apos;ll receive a reset link within a few minutes.
              </p>
              <p className="text-xs text-[var(--gray-500)]">The link expires in 15 minutes.</p>
              <Button className="w-full" onClick={() => router.push('/login')}>
                Back to Sign In
              </Button>
              <button
                type="button"
                onClick={() => { setSent(false); setSentEmail(''); }}
                className="w-full text-sm text-[var(--gray-500)] hover:text-[var(--dark-950)] transition-colors"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[var(--dark-950)] mb-1">Forgot password?</h1>
              <p className="text-sm text-[var(--gray-500)] mb-6">
                Enter your work email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Work Email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  error={errors.email?.message}
                  leftIcon={<Mail size={16} />}
                  {...register('email')}
                />
                <Button type="submit" className="w-full" loading={isSubmitting}>
                  Send Reset Link
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

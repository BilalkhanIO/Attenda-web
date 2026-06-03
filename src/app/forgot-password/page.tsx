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
    <div className="min-h-screen flex items-center justify-center bg-[var(--dark-950)] p-6 selection:bg-[var(--primary-600)] selection:text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[var(--primary-600)]/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <AttendaLogo iconSize={44} />
        </div>

        <div className="bg-[var(--glass-05)] backdrop-blur-2xl rounded-[3rem] border border-[var(--glass-border)] p-10 md:p-12 shadow-2xl">
          {sent ? (
            <div className="text-center page-fade-in">
              <div className="w-20 h-20 rounded-[2rem] bg-[var(--success-500)]/20 border border-[var(--success-500)]/30 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[var(--success-500)]/10 animate-bounce">
                <CheckCircle size={36} className="text-[var(--success-500)]" />
              </div>
              <h1 className="text-2xl font-black text-white mb-4 tracking-tight">Check your email</h1>
              <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed mb-10">
                If <strong className="text-white">{sentEmail}</strong> is registered, you'll receive a reset link within a few minutes. It expires in 15 minutes.
              </p>
              <Button className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em]" onClick={() => router.push('/login')}>
                Back to Login
              </Button>
              <button
                type="button"
                onClick={() => { setSent(false); setSentEmail(''); }}
                className="mt-6 text-[10px] font-black text-[var(--on-glass-dim)] hover:text-white uppercase tracking-widest transition-colors"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <div className="page-fade-in">
              <div className="mb-10">
                <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.3em] mb-4">Recovery</p>
                <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Lost Access?</h1>
                <p className="text-sm font-medium text-[var(--on-glass-muted)]">Identify your endpoint to receive a recovery link.</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <Input
                  label="Secure Identifier"
                  type="email"
                  placeholder="you@company.com"
                  required
                  error={errors.email?.message}
                  leftIcon={<Mail size={18} />}
                  className="bg-[var(--glass-10)]"
                  {...register('email')}
                />

                <div className="space-y-4">
                  <Button type="submit" className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em]" loading={isSubmitting}>
                    Transmit Recovery Link
                  </Button>
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="w-full text-[10px] font-black text-[var(--on-glass-muted)] hover:text-white uppercase tracking-widest transition-all"
                  >
                    ← Return to Base
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

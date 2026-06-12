'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { CheckCircle, ArrowRight, Clock, Shield, Zap, Building2, User, Phone, Mail, Globe } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import AttendaLogo from '@/components/ui/AttendaLogo';
import toast from 'react-hot-toast';

const onboardSchema = z.object({
  company_name:  z.string().min(2, 'Company name is required'),
  contact_name:  z.string().min(2, 'Your name is required'),
  contact_email: z.string().email('Enter a valid work email'),
  phone:         z.string().optional(),
  company_size:  z.string().min(1, 'Please select company size'),
  timezone:      z.string().min(1, 'Timezone is required'),
});

type OnboardForm = z.infer<typeof onboardSchema>;

const SIZES = [
  { value: '1–10', label: '1–10 employees' },
  { value: '11–50', label: '11–50 employees' },
  { value: '51–200', label: '51–200 employees' },
  { value: '201–500', label: '201–500 employees' },
  { value: '500+', label: '500+ employees' },
];

const PERKS = [
  { icon: Zap,      title: 'Quick Setup', text: 'Activated within 24 hours' },
  { icon: Shield,   title: 'Risk Free',    text: 'No credit card required' },
  { icon: Clock,    title: 'Free Trial',   text: '14-day free trial included' },
];

export default function GetStartedPage() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submittedCompany, setSubmittedCompany] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OnboardForm>({
    resolver: zodResolver(onboardSchema),
    defaultValues: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }
  });

  const onSubmit = async (data: OnboardForm) => {
    try {
      await apiClient.post('/public/onboard', data);
      setSubmittedEmail(data.contact_email);
      setSubmittedCompany(data.company_name);
      setStep('success');
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
          <Link href="/">
            <AttendaLogo iconSize={44} />
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="space-y-12 relative z-10 max-w-lg">
          <div className="slide-in-left">
            <h1 className="text-6xl font-black text-white leading-[1.05] mb-8 tracking-tighter">
              Your team,<br />always accounted<br /><span className="text-[var(--primary-600)]">for.</span>
            </h1>
            <p className="text-lg font-medium text-[var(--on-glass-muted)] leading-relaxed">
              Apply to get your organisation set up on Attenda. Our team will review your application and have you running within 24 hours.
            </p>
          </div>

          <div className="space-y-6 slide-in-left delay-150">
            {PERKS.map((p) => (
              <div key={p.title} className="flex items-center gap-5 group">
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[var(--glass-10)] border border-[var(--glass-border)] text-[var(--primary-600)] transition-all group-hover:scale-110 group-hover:border-[var(--primary-600)]/50">
                  <p.icon size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-black text-white uppercase tracking-widest mb-0.5">{p.title}</p>
                  <p className="text-sm font-medium text-[var(--on-glass-muted)]">{p.text}</p>
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
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-y-auto bg-gradient-to-br from-[var(--dark-800)]/30 to-transparent">
        <div className="w-full max-w-lg relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-12">
            <Link href="/">
              <AttendaLogo iconSize={44} />
            </Link>
          </div>

          {step === 'success' ? (
            <div className="p-8 md:p-12 rounded-[3rem] bg-[var(--glass-05)] border border-[var(--glass-border)] backdrop-blur-2xl shadow-2xl relative overflow-hidden page-fade-in text-center">
              <div className="w-20 h-20 rounded-[2rem] bg-[var(--success-500)]/20 border border-[var(--success-500)]/30 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[var(--success-500)]/10">
                <CheckCircle size={36} className="text-[var(--success-500)]" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Application submitted!</h2>
              <p className="text-[var(--on-glass-muted)] mb-10 leading-relaxed font-medium">
                We&apos;ve received your application for <strong className="text-white">{submittedCompany}</strong>. Our team will review it and email you at <strong className="text-white">{submittedEmail}</strong> within 24 hours.
              </p>

              <div className="p-6 rounded-3xl bg-[var(--dark-950)]/50 border border-[var(--glass-border)] text-left mb-10">
                <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.2em] mb-4">What happens next</p>
                <ul className="space-y-4">
                  {[
                    'We review your application',
                    'You receive a setup link via email',
                    'Create your password and invite your team',
                  ].map((item, i) => (
                    <li key={item} className="flex items-center gap-4 text-[13px] font-bold text-white/70">
                       <span className="text-[var(--primary-600)]">{i+1}.</span>
                       <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link href="/" className="text-sm font-bold text-[var(--primary-600)] hover:underline">
                ← Back to homepage
              </Link>
            </div>
          ) : (
            <div className="p-8 md:p-10 rounded-[3rem] bg-[var(--glass-05)] border border-[var(--glass-border)] backdrop-blur-2xl shadow-2xl relative overflow-hidden page-fade-in">
              <div className="mb-10">
                <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Apply for your organisation</h2>
                <p className="text-sm font-medium text-[var(--on-glass-muted)]">Takes 2 minutes. We&apos;ll be in touch within 24 hours.</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Input
                  label="Company name"
                  placeholder="Acme Corp"
                  leftIcon={<Building2 size={18} />}
                  error={errors.company_name?.message}
                  required
                  className="bg-[var(--glass-10)]"
                  {...register('company_name')}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Input
                    label="Your name"
                    placeholder="Jane Smith"
                    leftIcon={<User size={18} />}
                    error={errors.contact_name?.message}
                    required
                    className="bg-[var(--glass-10)]"
                    {...register('contact_name')}
                  />
                  <Input
                    label="Phone"
                    placeholder="+1 555 000 0000"
                    leftIcon={<Phone size={18} />}
                    error={errors.phone?.message}
                    className="bg-[var(--glass-10)]"
                    {...register('phone')}
                  />
                </div>

                <Input
                  label="Work email"
                  type="email"
                  placeholder="jane@acme.com"
                  leftIcon={<Mail size={18} />}
                  error={errors.contact_email?.message}
                  required
                  className="bg-[var(--glass-10)]"
                  {...register('contact_email')}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Select
                    label="Company size"
                    options={SIZES}
                    placeholder="Select size..."
                    error={errors.company_size?.message}
                    required
                    className="bg-[var(--glass-10)]"
                    {...register('company_size')}
                  />
                  <Input
                    label="Timezone"
                    placeholder="UTC"
                    leftIcon={<Globe size={18} />}
                    error={errors.timezone?.message}
                    required
                    className="bg-[var(--glass-10)]"
                    {...register('timezone')}
                  />
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full py-5 text-[13px] font-black uppercase tracking-[0.2em]"
                    size="lg"
                    loading={isSubmitting}
                    icon={<ArrowRight size={18} />}
                  >
                    Submit Application
                  </Button>
                </div>

                <div className="text-center space-y-4">
                  <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest leading-relaxed">
                    By submitting you agree to our{' '}
                    <Link href="/privacy" className="text-[var(--primary-600)] hover:underline">Privacy Policy</Link>.
                  </p>
                  <p className="text-xs font-bold text-[var(--on-glass-muted)]">
                    Already have an account?{' '}
                    <Link href="/login" className="text-[var(--primary-600)] hover:underline">Sign in</Link>
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

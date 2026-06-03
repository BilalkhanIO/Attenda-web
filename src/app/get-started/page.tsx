'use client';
import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { CheckCircle, ArrowRight, Clock, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import AttendaLogo from '@/components/ui/AttendaLogo';

const SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

const PERKS = [
  { icon: Zap,      title: 'Quick Setup', text: 'Activated within 24 hours' },
  { icon: Shield,   title: 'Risk Free',    text: 'No credit card required' },
  { icon: Clock,    title: 'Free Trial',   text: '14-day free trial included' },
];

export default function GetStartedPage() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [form, setForm] = useState({
    company_name:  '',
    contact_name:  '',
    contact_email: '',
    phone:         '',
    company_size:  '',
    timezone:      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.company_name.trim() || !form.contact_name.trim() || !form.contact_email.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/public/onboard', form);
      setStep('success');
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--dark-950)] flex selection:bg-[var(--primary-600)] selection:text-white">
      {/* Left panel */}
      <div className="hidden lg:flex w-[40%] flex-col justify-between px-20 py-16 relative overflow-hidden border-r border-[var(--glass-border)]">
        {/* Background Visuals */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[var(--dark-800)] to-[var(--dark-950)]" />
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[var(--primary-600)]/10 blur-[100px] rounded-full animate-pulse pointer-events-none" />

        <div className="relative z-10">
          <Link href="/" className="inline-block mb-24">
            <AttendaLogo iconSize={44} />
          </Link>

          <h1 className="text-5xl font-black text-white leading-[1.1] mb-8 tracking-tighter">
            Your team,<br />always accounted <span className="text-[var(--primary-600)]">for.</span>
          </h1>
          <p className="text-lg text-[var(--on-glass-muted)] leading-relaxed mb-16 font-medium max-w-sm">
            Apply to get your organisation set up on Attenda. Our team will review your application and have you running within 24 hours.
          </p>

          <div className="space-y-8">
            {PERKS.map(p => (
              <div key={p.text} className="flex items-center gap-5 group">
                <div className="w-12 h-12 rounded-2xl bg-[var(--glass-10)] border border-[var(--glass-border)] flex items-center justify-center flex-shrink-0">
                  <p.icon size={20} className="text-[var(--primary-600)]" />
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

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-20 relative overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Mobile logo */}
          <div className="lg:hidden mb-12">
            <Link href="/">
              <AttendaLogo iconSize={40} />
            </Link>
          </div>

          {step === 'success' ? (
            <div className="text-center page-fade-in p-10 md:p-16 rounded-[3rem] bg-[var(--glass-05)] border border-[var(--glass-border)] backdrop-blur-2xl shadow-2xl">
              <div className="w-20 h-20 rounded-[2rem] bg-[var(--success-500)]/20 border border-[var(--success-500)]/30 flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-[var(--success-500)]/10 animate-bounce">
                <CheckCircle size={36} className="text-[var(--success-500)]" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Application submitted!</h2>
              <p className="text-[var(--on-glass-muted)] mb-12 leading-relaxed font-medium">
                We&apos;ve received your application for <strong className="text-white">{form.company_name}</strong>. Our team will review it and email you at <strong className="text-white">{form.contact_email}</strong> within 24 hours.
              </p>

              <div className="p-8 rounded-3xl bg-[var(--dark-950)]/50 border border-[var(--glass-border)] text-left mb-12">
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
            <div className="page-fade-in">
              <div className="mb-12">
                <h2 className="text-4xl font-black text-white mb-3 tracking-tighter">Apply for your organisation</h2>
                <p className="text-sm font-medium text-[var(--on-glass-muted)]">Takes 2 minutes. We&apos;ll be in touch within 24 hours.</p>
              </div>

              {error && (
                <div className="mb-8 px-6 py-4 rounded-2xl bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/30">
                  <p className="text-xs font-bold text-[var(--danger-500)] uppercase tracking-wider">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Company name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest ml-1">
                    Company name <span className="text-[var(--primary-600)]">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Acme Corp"
                    value={form.company_name}
                    onChange={set('company_name')}
                    className="w-full bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-white text-sm placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium"
                  />
                </div>

                {/* Name + email in grid */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest ml-1">
                      Your name <span className="text-[var(--primary-600)]">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Jane Smith"
                      value={form.contact_name}
                      onChange={set('contact_name')}
                      className="w-full bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-white text-sm placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest ml-1">Phone</label>
                    <input
                      type="tel"
                      placeholder="+1 555 000 0000"
                      value={form.phone}
                      onChange={set('phone')}
                      className="w-full bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-white text-sm placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest ml-1">
                    Work email <span className="text-[var(--primary-600)]">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="jane@acme.com"
                    value={form.contact_email}
                    onChange={set('contact_email')}
                    className="w-full bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-white text-sm placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium"
                  />
                </div>

                {/* Size + Timezone */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest ml-1">Company size</label>
                    <select
                      value={form.company_size}
                      onChange={set('company_size')}
                      className="w-full bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-white text-sm focus:outline-none focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-[var(--dark-950)]">Select...</option>
                      {SIZES.map(s => <option key={s} value={s} className="bg-[var(--dark-950)]">{s} employees</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest ml-1">Timezone</label>
                    <input
                      type="text"
                      placeholder="UTC"
                      value={form.timezone}
                      onChange={set('timezone')}
                      className="w-full bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-white text-sm placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-[var(--primary-600)] hover:brightness-110 text-white font-black rounded-2xl transition-all shadow-2xl shadow-[var(--primary-600)]/20 text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                  >
                    {loading ? (
                      <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <>Submit Application <ArrowRight size={18} /></>
                    )}
                  </button>
                </div>

                <p className="text-[10px] text-center font-bold text-[var(--on-glass-dim)] uppercase tracking-widest leading-relaxed">
                  By submitting you agree to our{' '}
                  <Link href="/privacy" className="text-[var(--primary-600)] hover:underline">Privacy Policy</Link>.<br />
                  Already have an account?{' '}
                  <Link href="/login" className="text-white hover:text-[var(--primary-600)] underline">Sign in</Link>
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

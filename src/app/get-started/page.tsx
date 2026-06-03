'use client';
import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { CheckCircle, ArrowRight, Clock, Shield, Zap } from 'lucide-react';

const SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

const PERKS = [
  { icon: Zap,     text: 'Activated within 24 hours' },
  { icon: Shield,  text: 'No credit card required' },
  { icon: Clock,   text: '14-day free trial included' },
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
    <div className="min-h-screen bg-[var(--dark-950)] flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-[45%] flex-col justify-between px-16 py-12 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, var(--dark-950) 0%, #4a1050 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 30% 40%, rgba(241,81,83,0.15) 0%, transparent 70%)' }} />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2 mb-16">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-600)] flex items-center justify-center">
              <Clock size={16} className="text-white" />
            </div>
            <span className="font-bold text-white text-lg">Attenda</span>
          </Link>

          <h1 className="text-4xl font-black text-white leading-tight mb-4">
            Your team,<br />always accounted for.
          </h1>
          <p className="text-white/60 leading-relaxed mb-10">
            Apply to get your organisation set up on Attenda. Our team will review your application and have you running within 24 hours.
          </p>

          <div className="space-y-4">
            {PERKS.map(p => (
              <div key={p.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <p.icon size={15} className="text-white/80" />
                </div>
                <span className="text-sm text-white/70">{p.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/30">&copy; {new Date().getFullYear()} Attenda</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary-600)] flex items-center justify-center">
                <Clock size={16} className="text-white" />
              </div>
              <span className="font-bold text-white text-lg">Attenda</span>
            </Link>
          </div>

          {step === 'success' ? (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-[var(--success-100)] flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={36} className="text-[var(--success-700)]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Application submitted!</h2>
              <p className="text-white/60 mb-8 leading-relaxed">
                We&apos;ve received your application for <strong className="text-white">{form.company_name}</strong>. Our team will review it and email you at <strong className="text-white">{form.contact_email}</strong> within 24 hours.
              </p>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left mb-8">
                <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2">What happens next</p>
                <ol className="space-y-2 text-sm text-white/70">
                  <li className="flex items-start gap-2"><span className="font-bold text-[var(--primary-600)]">1.</span> We review your application</li>
                  <li className="flex items-start gap-2"><span className="font-bold text-[var(--primary-600)]">2.</span> You receive a setup link via email</li>
                  <li className="flex items-start gap-2"><span className="font-bold text-[var(--primary-600)]">3.</span> Create your password and invite your team</li>
                </ol>
              </div>
              <Link href="/" className="text-sm text-[var(--primary-600)] hover:underline">
                ← Back to homepage
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Apply for your organisation</h2>
                <p className="text-white/50 text-sm">Takes 2 minutes. We&apos;ll be in touch within 24 hours.</p>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl bg-[var(--danger-100)] border border-[var(--danger-500)]/30">
                  <p className="text-sm font-medium text-[var(--danger-800)]">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Company name */}
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-1.5">
                    Company name <span className="text-[var(--primary-600)]">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Acme Corp"
                    value={form.company_name}
                    onChange={set('company_name')}
                    className="w-full px-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent"
                  />
                </div>

                {/* Name + email in grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-1.5">
                      Your name <span className="text-[var(--primary-600)]">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Jane Smith"
                      value={form.contact_name}
                      onChange={set('contact_name')}
                      className="w-full px-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-1.5">Phone</label>
                    <input
                      type="tel"
                      placeholder="+1 555 000 0000"
                      value={form.phone}
                      onChange={set('phone')}
                      className="w-full px-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-white/80 mb-1.5">
                    Work email <span className="text-[var(--primary-600)]">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="jane@acme.com"
                    value={form.contact_email}
                    onChange={set('contact_email')}
                    className="w-full px-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent"
                  />
                </div>

                {/* Size + Timezone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-1.5">Company size</label>
                    <select
                      value={form.company_size}
                      onChange={set('company_size')}
                      className="w-full px-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent appearance-none"
                    >
                      <option value="">Select...</option>
                      {SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white/80 mb-1.5">Timezone</label>
                    <input
                      type="text"
                      placeholder="UTC"
                      value={form.timezone}
                      onChange={set('timezone')}
                      className="w-full px-3 py-2.5 bg-white/8 border border-white/15 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[var(--primary-600)] hover:bg-[var(--primary-900)] text-white font-bold rounded-xl transition-all text-sm disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <>Submit Application <ArrowRight size={16} /></>
                  )}
                </button>

                <p className="text-xs text-center text-white/30">
                  By submitting you agree to our{' '}
                  <Link href="/privacy" className="text-white/50 hover:text-white underline">Privacy Policy</Link>.
                  Already have an account?{' '}
                  <Link href="/login" className="text-[var(--primary-600)] hover:underline">Sign in</Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

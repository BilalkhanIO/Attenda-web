'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Wifi, Bell, BarChart2, Calendar, DollarSign, Shield,
  CheckCircle, ArrowRight, Menu, X, Star, Clock, Users,
} from 'lucide-react';

// ─── Shared marketing nav ─────────────────────────────
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[var(--dark-950)]/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary-600)] flex items-center justify-center">
            <Clock size={16} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Attenda</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {[{ label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/#pricing' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }].map(l => (
            <Link key={l.label} href={l.href} className="text-sm text-white/70 hover:text-white transition-colors">{l.label}</Link>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-white/70 hover:text-white px-3 py-2 transition-colors">Sign in</Link>
          <Link href="/get-started" className="px-4 py-2 bg-[var(--primary-600)] hover:bg-[var(--primary-900)] text-white text-sm font-semibold rounded-lg transition-colors">
            Start Free Trial
          </Link>
        </div>
        <button onClick={() => setOpen(v => !v)} className="md:hidden p-2 text-white/70 hover:text-white">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-[var(--dark-950)] border-t border-white/10 px-6 py-4 space-y-3">
          {[{ label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/#pricing' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }, { label: 'Sign in', href: '/login' }].map(l => (
            <Link key={l.label} href={l.href} onClick={() => setOpen(false)} className="block text-sm text-white/70 hover:text-white py-1">{l.label}</Link>
          ))}
          <Link href="/get-started" onClick={() => setOpen(false)} className="block w-full text-center px-4 py-2.5 bg-[var(--primary-600)] text-white text-sm font-semibold rounded-lg">
            Start Free Trial
          </Link>
        </div>
      )}
    </nav>
  );
}

// ─── Shared marketing footer ──────────────────────────
export function MarketingFooter() {
  return (
    <footer className="bg-[var(--dark-950)] border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary-600)] flex items-center justify-center">
                <Clock size={16} className="text-white" />
              </div>
              <span className="font-bold text-white text-lg">Attenda</span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">Your team, always accounted for.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Product</p>
            <ul className="space-y-2">
              {[{ label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/#pricing' }, { label: 'Get Started', href: '/get-started' }].map(l => (
                <li key={l.label}><Link href={l.href} className="text-sm text-white/60 hover:text-white transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Company</p>
            <ul className="space-y-2">
              {[{ label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }].map(l => (
                <li key={l.label}><Link href={l.href} className="text-sm text-white/60 hover:text-white transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Legal</p>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-sm text-white/60 hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/40">&copy; {new Date().getFullYear()} Attenda. All rights reserved.</p>
          <p className="text-xs text-white/30">Built for modern teams.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Features ─────────────────────────────────────────
const FEATURES = [
  { icon: Wifi,       title: 'Auto WiFi Check-in',     desc: 'Employees are checked in the moment they connect to the office WiFi. Zero friction, zero forgotten punches.',       color: 'var(--primary-600)' },
  { icon: Bell,       title: 'WhatsApp Notifications', desc: 'Instant alerts for late arrivals, early departures, and absences sent directly to managers via WhatsApp.',          color: 'var(--success-500)' },
  { icon: BarChart2,  title: 'Real-time Dashboard',    desc: 'Live attendance overview with KPIs, alerts panel, and drill-down employee cards — updated every minute.',           color: 'var(--purple-500)' },
  { icon: Calendar,   title: 'Shift Management',       desc: 'Build and publish weekly schedules with AI assistance. Shift swap requests handled entirely in-app.',              color: 'var(--warning-500)' },
  { icon: DollarSign, title: 'Payroll Integration',    desc: 'Hours worked flow directly to payroll. Overtime rules, tax, and pension — all automated at month end.',            color: '#0F766E' },
  { icon: Shield,     title: 'Leave & Compliance',     desc: 'Full leave lifecycle: apply, approve, track balances. Half-day support, late notices, and audit logs included.',  color: 'var(--danger-500)' },
];

// ─── Pricing ──────────────────────────────────────────
const PLANS = [
  { name: 'Trial',      price: 'Free',   period: '14 days',    highlight: false, features: ['Up to 10 employees', 'WiFi auto check-in', 'Basic dashboard', 'Email support'],                                                            cta: 'Start Free',   href: '/get-started' },
  { name: 'Starter',    price: '$49',    period: '/month',      highlight: false, features: ['Up to 50 employees', 'Everything in Trial', 'WhatsApp alerts', 'Shift management', 'Leave tracking'],                                      cta: 'Get Started',  href: '/get-started' },
  { name: 'Growth',     price: '$149',   period: '/month',      highlight: true,  features: ['Up to 200 employees', 'Everything in Starter', 'Payroll integration', 'AI scheduling', 'Remote tracking', 'Analytics'],                   cta: 'Get Started',  href: '/get-started' },
  { name: 'Enterprise', price: 'Custom', period: 'contact us',  highlight: false, features: ['Unlimited employees', 'Everything in Growth', 'Dedicated support', 'Custom integrations', 'SLA guarantee'],                              cta: 'Contact Sales', href: '/contact' },
];

// ─── Page ─────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingNav />

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="bg-[var(--dark-950)] pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(241,81,83,0.2) 0%, transparent 70%)' }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full mb-8 border border-white/20">
            <Star size={11} className="text-[var(--primary-600)]" fill="currentColor" /> Now with AI-assisted scheduling
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6 tracking-tight">
            Attendance,<br /><span className="text-[var(--primary-600)]">Simplified.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Auto WiFi check-in, smart notifications, and real-time dashboards for modern teams. Your team, always accounted for.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/get-started" className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--primary-600)] hover:bg-[var(--primary-900)] text-white font-bold rounded-xl transition-all shadow-lg text-base">
              Start Free Trial <ArrowRight size={18} />
            </Link>
            <Link href="/#features" className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl border border-white/20 transition-all text-base">
              See the features
            </Link>
          </div>
          <p className="text-xs text-white/30 mt-6">No credit card required &middot; 14-day free trial &middot; Cancel anytime</p>
        </div>

        {/* Mini dashboard preview */}
        <div className="max-w-2xl mx-auto mt-16 relative z-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-2xl">
            <p className="text-xs text-white/40 mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success-500)] animate-pulse" /> Live Dashboard &middot; Today
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[{ label: 'In Office', n: '34', c: '#10B981' }, { label: 'Remote', n: '8', c: '#8B5CF6' }, { label: 'On Leave', n: '3', c: '#f15153' }, { label: 'Absent', n: '2', c: '#dc2626' }].map(k => (
                <div key={k.label} className="bg-white/8 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-white">{k.n}</p>
                  <p className="text-[10px] text-white/50 mt-0.5 leading-tight">{k.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-bold text-[var(--dark-950)] mb-4">Everything your team needs</h2>
            <p className="text-lg text-[var(--gray-500)] max-w-2xl mx-auto">From the moment your team walks through the door to the payslip at month end — Attenda handles it all.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="p-6 rounded-2xl border border-[var(--gray-100)] hover:border-[var(--gray-200)] hover:shadow-lg transition-all">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: f.color + '18' }}>
                  <f.icon size={20} style={{ color: f.color }} />
                </div>
                <h3 className="text-base font-bold text-[var(--dark-950)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--gray-500)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="py-24 px-6 bg-[var(--gray-50)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl font-bold text-[var(--dark-950)] mb-4">Up and running in minutes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { n: '01', title: 'Apply for your organisation', desc: 'Fill in a short form. Our team reviews your application and activates your account within 24 hours.' },
              { n: '02', title: 'Add your team',               desc: 'Invite employees by email or bulk-import via CSV. Assign shifts, departments, and managers in minutes.' },
              { n: '03', title: 'Attendance runs itself',       desc: 'Employees check in via WiFi, QR, or mobile. You get live alerts and zero manual paperwork.' },
            ].map(s => (
              <div key={s.n}>
                <div className="text-6xl font-black leading-none mb-4" style={{ color: 'var(--primary-600)', opacity: 0.15 }}>{s.n}</div>
                <h3 className="text-lg font-bold text-[var(--dark-950)] mb-2">{s.title}</h3>
                <p className="text-sm text-[var(--gray-500)] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────── */}
      <section className="py-14 px-6 border-y border-[var(--gray-100)]">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-10 text-center">
          {[{ value: '10,000+', label: 'Employees tracked' }, { value: '99.9%', label: 'Uptime' }, { value: '<2 min', label: 'Avg setup time' }, { value: '40%', label: 'Less HR admin' }].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-black text-[var(--dark-950)]">{s.value}</p>
              <p className="text-xs text-[var(--gray-500)] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-bold text-[var(--dark-950)] mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-[var(--gray-500)]">Start free. Scale when you&apos;re ready.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {PLANS.map(p => (
              <div key={p.name} className={`rounded-2xl p-6 flex flex-col border transition-all ${p.highlight ? 'border-[var(--primary-600)] shadow-xl bg-[var(--dark-950)]' : 'border-[var(--gray-100)] hover:shadow-md'}`}>
                {p.highlight && <div className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-3">Most Popular</div>}
                <p className={`text-sm font-semibold mb-1 ${p.highlight ? 'text-white/60' : 'text-[var(--gray-500)]'}`}>{p.name}</p>
                <div className="mb-5 flex items-baseline gap-1">
                  <span className={`text-4xl font-black ${p.highlight ? 'text-white' : 'text-[var(--dark-950)]'}`}>{p.price}</span>
                  <span className={`text-sm ${p.highlight ? 'text-white/40' : 'text-[var(--gray-500)]'}`}>{p.period}</span>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: p.highlight ? 'var(--primary-600)' : 'var(--success-500)' }} />
                      <span className={`text-sm ${p.highlight ? 'text-white/70' : 'text-[var(--gray-500)]'}`}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${p.highlight ? 'bg-[var(--primary-600)] hover:bg-[var(--primary-900)] text-white' : 'bg-[var(--gray-100)] hover:bg-[var(--gray-200)] text-[var(--dark-950)]'}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: 'linear-gradient(135deg, var(--dark-950) 0%, #4a1050 100%)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to transform attendance?</h2>
          <p className="text-lg text-white/60 mb-10">Join hundreds of companies who have eliminated manual attendance tracking.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/get-started" className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--primary-600)] hover:bg-[var(--primary-900)] text-white font-bold rounded-xl transition-all text-base shadow-lg">
              Apply for Your Organisation <ArrowRight size={18} />
            </Link>
            <Link href="/contact" className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl border border-white/20 transition-all text-base">
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

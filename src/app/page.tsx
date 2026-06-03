'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Wifi, Bell, BarChart2, Calendar, DollarSign, Shield,
  CheckCircle, ArrowRight, Menu, X, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AttendaLogo from '@/components/ui/AttendaLogo';

// ─── Shared marketing nav ─────────────────────────────
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[var(--dark-950)]/70 backdrop-blur-xl border-b border-[var(--glass-border)]">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/">
          <AttendaLogo iconSize={40} />
        </Link>
        <div className="hidden lg:flex items-center gap-10">
          {[{ label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/#pricing' }, { label: 'Blog', href: '/blog' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }].map(l => (
            <Link key={l.label} href={l.href} className="text-sm font-bold text-[var(--on-glass-muted)] hover:text-white transition-colors">{l.label}</Link>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-4">
          <Link href="/login" className="text-sm font-bold text-white hover:text-[var(--primary-600)] px-4 py-2 transition-colors">Sign in</Link>
          <Link href="/get-started" className="px-6 py-3 bg-[var(--primary-600)] hover:brightness-110 text-white text-sm font-bold rounded-xl transition-all shadow-xl shadow-[var(--primary-600)]/20 active:scale-95">
            Start Free Trial
          </Link>
        </div>
        <button onClick={() => setOpen(v => !v)} className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-white/70 hover:text-white transition-all">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {/* Mobile Menu */}
      <div className={cn(
        "lg:hidden fixed inset-x-0 top-20 bg-[var(--dark-950)]/95 backdrop-blur-2xl border-b border-[var(--glass-border)] px-6 py-8 space-y-6 transition-all duration-300 origin-top",
        open ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0 pointer-events-none"
      )}>
        {[{ label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/#pricing' }, { label: 'Blog', href: '/blog' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }, { label: 'Sign in', href: '/login' }].map(l => (
          <Link key={l.label} href={l.href} onClick={() => setOpen(false)} className="block text-sm font-bold text-white/70 hover:text-white">{l.label}</Link>
        ))}
        <Link href="/get-started" onClick={() => setOpen(false)} className="block w-full text-center px-6 py-4 bg-[var(--primary-600)] text-white text-sm font-black rounded-xl">
          Start Free Trial
        </Link>
      </div>
    </nav>
  );
}

// ─── Shared marketing footer ──────────────────────────
export function MarketingFooter() {
  return (
    <footer className="bg-[var(--dark-950)] border-t border-[var(--glass-border)] pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-20">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block mb-6">
              <AttendaLogo iconSize={36} />
            </Link>
            <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed max-w-xs">
              Your team, always accounted for.
            </p>
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-wider mb-6">Product</p>
            <ul className="space-y-4">
              {[{ label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/#pricing' }, { label: 'Get Started', href: '/get-started' }].map(l => (
                <li key={l.label}><Link href={l.href} className="text-sm font-bold text-[var(--on-glass-muted)] hover:text-[var(--primary-600)] transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-wider mb-6">Company</p>
            <ul className="space-y-4">
              {[{ label: 'About', href: '/about' }, { label: 'Blog', href: '/blog' }, { label: 'Contact', href: '/contact' }].map(l => (
                <li key={l.label}><Link href={l.href} className="text-sm font-bold text-[var(--on-glass-muted)] hover:text-[var(--primary-600)] transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-wider mb-6">Legal</p>
            <ul className="space-y-4">
              <li><Link href="/privacy" className="text-sm font-bold text-[var(--on-glass-muted)] hover:text-[var(--primary-600)] transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--glass-border)] pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs font-bold text-[var(--on-glass-dim)]">&copy; {new Date().getFullYear()} Attenda. All rights reserved.</p>
          <p className="text-xs font-bold text-[var(--on-glass-dim)]">Built for modern teams.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Features ─────────────────────────────────────────
const FEATURES = [
  { icon: Wifi,       title: 'Auto WiFi Check-in',     desc: 'Employees are checked in the moment they connect to the office WiFi. Zero friction, zero forgotten punches.',       color: 'var(--primary-600)' },
  { icon: Bell,       title: 'WhatsApp Notifications', desc: 'Instant alerts for late arrivals, early departures, and absences sent directly to managers via WhatsApp.',          color: 'var(--secondary)' },
  { icon: BarChart2,  title: 'Real-time Dashboard',    desc: 'Live attendance overview with KPIs, alerts panel, and drill-down employee cards — updated every minute.',           color: 'var(--primary-100)' },
  { icon: Calendar,   title: 'Shift Management',       desc: 'Build and publish weekly schedules with AI assistance. Shift swap requests handled entirely in-app.',              color: 'var(--warning-500)' },
  { icon: DollarSign, title: 'Payroll Integration',    desc: 'Hours worked flow directly to payroll. Overtime rules, tax, and pension — all automated at month end.',            color: 'var(--success-500)' },
  { icon: Shield,     title: 'Leave & Compliance',     desc: 'Full leave lifecycle: apply, approve, track balances. Half-day support, late notices, and audit logs included.',  color: 'var(--danger-500)' },
];

// ─── Pricing ──────────────────────────────────────────
const PLANS = [
  { name: 'Trial',      price: 'Free',   period: '14 days',    highlight: false, features: ['Up to 10 employees', 'WiFi auto check-in', 'Basic dashboard', 'Email support'],                                                            cta: 'Start Free',   href: '/get-started' },
  { name: 'Starter',    price: '$49',    period: '/month',      highlight: false, features: ['Up to 50 employees', 'Everything in Trial', 'WhatsApp alerts', 'Shift management', 'Leave tracking'],                                      cta: 'Get Started',  href: '/get-started' },
  { name: 'Growth',     price: '$149',   period: '/month',      highlight: true,  features: ['Up to 200 employees', 'Everything in Starter', 'Payroll integration', 'AI scheduling', 'Remote tracking', 'Analytics'],                   cta: 'Get Started',  href: '/get-started' },
  { name: 'Enterprise', price: 'Custom', period: 'contact us',  highlight: false, features: ['Unlimited employees', 'Everything in Growth', 'Dedicated support', 'Custom integrations', 'SLA guarantee'],                              cta: 'Contact Sales', href: '/contact' },
];

export default function LandingPage() {
  return (
    <div className="bg-[var(--dark-950)] min-h-screen selection:bg-[var(--primary-600)] selection:text-white">
      <MarketingNav />

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="pt-44 pb-32 px-6 relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[var(--primary-600)]/10 blur-[120px] rounded-full animate-pulse pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[var(--secondary)]/10 blur-[100px] rounded-full animate-pulse delay-700 pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-[var(--glass-10)] text-[var(--primary-600)] text-xs font-bold px-4 py-2 rounded-full mb-10 border border-[var(--glass-border)] backdrop-blur-md">
            <Star size={12} fill="currentColor" /> Now with AI-assisted scheduling
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-8 tracking-tight page-fade-in">
            Attendance,<br /><span className="text-[var(--primary-600)]">Simplified.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--on-glass-muted)] max-w-2xl mx-auto mb-12 leading-relaxed font-medium page-fade-in delay-100">
            Auto WiFi check-in, smart notifications, and real-time dashboards for modern teams. Your team, always accounted for.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 page-fade-in delay-200">
            <Link href="/get-started" className="inline-flex items-center gap-2 px-10 py-5 bg-[var(--primary-600)] hover:brightness-110 text-white font-bold rounded-2xl transition-all shadow-2xl shadow-[var(--primary-600)]/30 text-base">
              Start Free Trial <ArrowRight size={20} />
            </Link>
            <Link href="/#features" className="inline-flex items-center gap-2 px-10 py-5 bg-[var(--glass-10)] hover:bg-[var(--glass-20)] text-white font-bold rounded-2xl border border-[var(--glass-border)] backdrop-blur-md transition-all text-base active:scale-95">
              See the features
            </Link>
          </div>
          <p className="text-xs text-[var(--on-glass-dim)] mt-8">No credit card required &middot; 14-day free trial &middot; Cancel anytime</p>
        </div>

        {/* Dashboard Preview Overlay */}
        <div className="max-w-5xl mx-auto mt-24 relative z-10 group">
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--dark-950)] via-transparent to-transparent z-20 h-full w-full" />
          <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--glass-05)] backdrop-blur-2xl p-2 md:p-4 shadow-[0_0_100px_-20px_rgba(0,200,150,0.3)] transition-all duration-700">
            <div className="rounded-[1.8rem] border border-[var(--glass-border)] bg-[var(--dark-950)]/80 overflow-hidden relative aspect-[16/9] md:aspect-[21/9]">
               {/* Mock UI Content */}
               <div className="absolute inset-0 p-8 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                     <div className="h-8 w-40 bg-[var(--glass-10)] rounded-lg animate-pulse" />
                     <div className="flex gap-2">
                        <div className="h-8 w-8 bg-[var(--glass-10)] rounded-full animate-pulse" />
                        <div className="h-8 w-8 bg-[var(--glass-10)] rounded-full animate-pulse" />
                     </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                     {[1,2,3,4].map(i => <div key={i} className="h-24 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-2xl animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
                  </div>
                  <div className="flex-1 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-3xl animate-pulse delay-500" />
               </div>
               {/* "Live" Badge Overlay */}
               <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
                  <div className="bg-[var(--dark-950)]/90 backdrop-blur-xl border border-[var(--glass-border)] px-5 py-2 rounded-full flex items-center gap-3">
                     <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success-500)] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success-500)]"></span>
                     </span>
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Dashboard &middot; Today</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────── */}
      <section id="features" className="py-32 px-6 bg-[var(--dark-950)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-4">Features</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Everything your team needs</h2>
            <p className="text-lg text-[var(--on-glass-muted)] max-w-2xl mx-auto font-medium">From the moment your team walks through the door to the payslip at month end — Attenda handles it all.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="p-8 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)] hover:border-[var(--glass-high)] transition-all duration-500 group">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8 bg-[var(--glass-10)] group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-xl" style={{ border: `1px solid ${f.color}30` }}>
                  <f.icon size={24} style={{ color: f.color }} />
                </div>
                <h3 className="text-xl font-black text-white mb-4 group-hover:text-[var(--primary-600)] transition-colors">{f.title}</h3>
                <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed group-hover:text-[var(--on-glass-sub)] transition-colors">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="py-32 px-6 bg-[var(--dark-800)]/30 border-y border-[var(--glass-border)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-4">How it works</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Up and running in minutes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { n: '01', title: 'Apply for your organisation', desc: 'Fill in a short form. Our team reviews your application and activates your account within 24 hours.' },
              { n: '02', title: 'Add your team',               desc: 'Invite employees by email or bulk-import via CSV. Assign shifts, departments, and managers in minutes.' },
              { n: '03', title: 'Attendance runs itself',       desc: 'Employees check in via WiFi, QR, or mobile. You get live alerts and zero manual paperwork.' },
            ].map(s => (
              <div key={s.n}>
                <div className="text-6xl font-black leading-none mb-6 text-[var(--primary-600)] opacity-20">{s.n}</div>
                <h3 className="text-lg font-black text-white mb-3 uppercase tracking-wide">{s.title}</h3>
                <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section id="pricing" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-4">Pricing</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Simple, transparent pricing</h2>
            <p className="text-lg text-[var(--on-glass-muted)] max-w-2xl mx-auto font-medium">Start free. Scale when you&apos;re ready.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {PLANS.map(p => (
              <div key={p.name} className={cn(
                "group relative rounded-[2.5rem] p-8 flex flex-col border transition-all duration-500 hover:scale-[1.02]",
                p.highlight
                  ? "bg-[var(--dark-800)] border-[var(--primary-600)] shadow-[0_0_80px_-20px_rgba(0,200,150,0.3)]"
                  : "bg-[var(--glass-05)] border-[var(--glass-border)] hover:bg-[var(--glass-10)] hover:border-[var(--glass-high)]"
              )}>
                {p.highlight && (
                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--primary-600)] text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-xl">
                      Most Popular
                   </div>
                )}
                <p className={cn("text-sm font-bold mb-6", p.highlight ? "text-[var(--primary-600)]" : "text-[var(--on-glass-muted)]")}>{p.name}</p>
                <div className="mb-10">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white tracking-tighter">{p.price}</span>
                    <span className="text-xs font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">{p.period}</span>
                  </div>
                </div>
                <ul className="space-y-4 flex-1 mb-10">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-3">
                      <CheckCircle size={14} className={p.highlight ? "text-[var(--primary-600)]" : "text-[var(--success-500)]"} />
                      <span className="text-sm font-medium text-[var(--on-glass-sub)]">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className={cn(
                  "block text-center py-4 rounded-2xl font-bold text-sm transition-all",
                  p.highlight
                    ? "bg-[var(--primary-600)] hover:brightness-110 text-white shadow-xl shadow-[var(--primary-600)]/20"
                    : "bg-[var(--glass-10)] hover:bg-[var(--glass-20)] text-white border border-[var(--glass-border)]"
                )}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto rounded-[4rem] bg-gradient-to-br from-[var(--dark-800)] to-[var(--dark-950)] border border-[var(--glass-border)] p-12 md:p-24 text-center relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[var(--primary-600)]/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-125 transition-transform duration-1000" />

          <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight relative z-10">Ready to transform attendance?</h2>
          <p className="text-lg text-[var(--on-glass-muted)] mb-12 max-w-2xl mx-auto font-medium relative z-10 leading-relaxed">
            Join hundreds of companies who have eliminated manual attendance tracking.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 relative z-10">
            <Link href="/get-started" className="group px-12 py-5 bg-[var(--primary-600)] hover:brightness-110 text-white font-bold rounded-2xl transition-all shadow-2xl shadow-[var(--primary-600)]/30 text-base active:scale-95">
              Apply for Your Organisation <ArrowRight size={20} className="inline-block ml-2" />
            </Link>
            <Link href="/contact" className="px-12 py-5 bg-[var(--glass-10)] hover:bg-[var(--glass-20)] text-white font-bold rounded-2xl border border-[var(--glass-border)] backdrop-blur-md transition-all text-base">
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

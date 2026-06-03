'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Wifi, Bell, BarChart2, Calendar, DollarSign, Shield,
  CheckCircle, ArrowRight, Menu, X, Star, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Shared marketing nav ─────────────────────────────
export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[var(--dark-950)]/70 backdrop-blur-xl border-b border-[var(--glass-border)]">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-600)] flex items-center justify-center shadow-lg shadow-[var(--primary-600)]/20 transition-transform group-hover:scale-110">
            <Clock size={20} className="text-white" />
          </div>
          <span className="font-black text-white text-xl tracking-tight uppercase">Attenda</span>
        </Link>
        <div className="hidden lg:flex items-center gap-10">
          {[{ label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/#pricing' }, { label: 'Blog', href: '/blog' }, { label: 'About', href: '/about' }, { label: 'Contact', href: '/contact' }].map(l => (
            <Link key={l.label} href={l.href} className="text-[13px] font-bold text-[var(--on-glass-muted)] hover:text-white uppercase tracking-widest transition-colors">{l.label}</Link>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-4">
          <Link href="/login" className="text-[13px] font-bold text-white hover:text-[var(--primary-600)] px-4 py-2 transition-colors uppercase tracking-widest">Sign in</Link>
          <Link href="/get-started" className="px-6 py-3 bg-[var(--primary-600)] hover:brightness-110 text-white text-[13px] font-black rounded-xl transition-all shadow-xl shadow-[var(--primary-600)]/20 uppercase tracking-widest active:scale-95">
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
          <Link key={l.label} href={l.href} onClick={() => setOpen(false)} className="block text-sm font-bold text-white/70 hover:text-white uppercase tracking-widest">{l.label}</Link>
        ))}
        <Link href="/get-started" onClick={() => setOpen(false)} className="block w-full text-center px-6 py-4 bg-[var(--primary-600)] text-white text-sm font-black rounded-xl uppercase tracking-widest">
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
            <Link href="/" className="flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-[var(--primary-600)] flex items-center justify-center">
                <Clock size={18} className="text-white" />
              </div>
              <span className="font-black text-white text-lg tracking-tight uppercase">Attenda</span>
            </Link>
            <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed max-w-xs">
              Next-generation workforce management. Automated check-ins, real-time analytics, and seamless payroll.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-6">Product</p>
            <ul className="space-y-4">
              {[{ label: 'Features', href: '/#features' }, { label: 'Pricing', href: '/#pricing' }, { label: 'Get Started', href: '/get-started' }].map(l => (
                <li key={l.label}><Link href={l.href} className="text-sm font-bold text-[var(--on-glass-muted)] hover:text-[var(--primary-600)] transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-6">Company</p>
            <ul className="space-y-4">
              {[{ label: 'About', href: '/about' }, { label: 'Blog', href: '/blog' }, { label: 'Contact', href: '/contact' }].map(l => (
                <li key={l.label}><Link href={l.href} className="text-sm font-bold text-[var(--on-glass-muted)] hover:text-[var(--primary-600)] transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-6">Legal</p>
            <ul className="space-y-4">
              <li><Link href="/privacy" className="text-sm font-bold text-[var(--on-glass-muted)] hover:text-[var(--primary-600)] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm font-bold text-[var(--on-glass-muted)] hover:text-[var(--primary-600)] transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--glass-border)] pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[11px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">&copy; {new Date().getFullYear()} ATTENDA TECHNOLOGIES. ALL RIGHTS RESERVED.</p>
          <div className="flex items-center gap-6">
             <span className="text-[11px] font-black text-[var(--primary-600)] uppercase tracking-widest">Aurora Liquid Glass 2026 Edition</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Features ─────────────────────────────────────────
const FEATURES = [
  { icon: Wifi,       title: 'Auto WiFi Check-in',     desc: 'Zero-touch attendance. Employees are checked in automatically the second they connect to your secure office network.', color: 'var(--primary-600)' },
  { icon: Bell,       title: 'WhatsApp Notifications', desc: 'Keep managers in the loop with instant alerts for late arrivals, early departures, and no-shows sent to WhatsApp.',    color: 'var(--secondary)' },
  { icon: BarChart2,  title: 'Real-time Dashboard',    desc: 'Monitor your entire workforce in real-time with premium glassmorphism analytics and live performance tracking.',     color: 'var(--primary-100)' },
  { icon: Calendar,   title: 'Smart Scheduling',       desc: 'Build optimized shifts in seconds with our AI engine. Handle swap requests and availability entirely in-app.',         color: 'var(--warning-500)' },
  { icon: DollarSign, title: 'Payroll Automation',     desc: 'Say goodbye to spreadsheets. Hours worked flow directly into payroll with automated overtime and tax calculation.',   color: 'var(--success-500)' },
  { icon: Shield,     title: 'Compliance Vault',       desc: 'Full audit logs, leave balance tracking, and regulatory reports. Keep your organisation compliant without the effort.', color: 'var(--danger-500)' },
];

// ─── Pricing ──────────────────────────────────────────
const PLANS = [
  { name: 'Trial',      price: 'Free',   period: '14 DAYS',    highlight: false, features: ['Up to 10 employees', 'WiFi auto check-in', 'Basic dashboard', 'Email support'],                                                            cta: 'Start Free',   href: '/get-started' },
  { name: 'Starter',    price: '$49',    period: '/MONTH',      highlight: false, features: ['Up to 50 employees', 'Everything in Trial', 'WhatsApp alerts', 'Shift management', 'Leave tracking'],                                      cta: 'Get Started',  href: '/get-started' },
  { name: 'Growth',     price: '$149',   period: '/MONTH',      highlight: true,  features: ['Up to 200 employees', 'Everything in Starter', 'Payroll integration', 'AI scheduling', 'Remote tracking', 'Analytics'],                   cta: 'Get Started',  href: '/get-started' },
  { name: 'Enterprise', price: 'Custom', period: 'QUOTE',       highlight: false, features: ['Unlimited employees', 'Everything in Growth', 'Dedicated support', 'Custom integrations', 'SLA guarantee'],                              cta: 'Contact Sales', href: '/contact' },
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
          <div className="inline-flex items-center gap-2 bg-[var(--glass-10)] text-[var(--primary-600)] text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full mb-10 border border-[var(--glass-border)] backdrop-blur-md slide-in-bottom">
            <Star size={12} fill="currentColor" /> Now Powered by Aurora AI 2026
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-white leading-[1.05] mb-8 tracking-tighter page-fade-in">
            Attendance,<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-600)] to-[var(--secondary)]">Redefined.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--on-glass-muted)] max-w-2xl mx-auto mb-12 leading-relaxed font-medium page-fade-in delay-100">
            Stop chasing timesheets. Attenda automates workforce tracking with WiFi intelligence, WhatsApp alerts, and premium glass analytics.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 page-fade-in delay-200">
            <Link href="/get-started" className="group relative inline-flex items-center gap-3 px-10 py-5 bg-[var(--primary-600)] hover:brightness-110 text-white font-black rounded-2xl transition-all shadow-2xl shadow-[var(--primary-600)]/30 text-base uppercase tracking-widest overflow-hidden">
              <span className="relative z-10">Apply for Free</span>
              <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </Link>
            <Link href="/#features" className="inline-flex items-center gap-2 px-10 py-5 bg-[var(--glass-10)] hover:bg-[var(--glass-20)] text-white font-bold rounded-2xl border border-[var(--glass-border)] backdrop-blur-md transition-all text-base uppercase tracking-widest active:scale-95">
              Explore Tech
            </Link>
          </div>
          <p className="text-[10px] font-bold text-[var(--on-glass-dim)] mt-8 uppercase tracking-[0.15em]">No credit card required &middot; 14-day premium trial</p>
        </div>

        {/* Dashboard Preview Overlay */}
        <div className="max-w-5xl mx-auto mt-24 relative z-10 group">
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--dark-950)] via-transparent to-transparent z-20 h-full w-full" />
          <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--glass-05)] backdrop-blur-2xl p-2 md:p-4 shadow-[0_0_100px_-20px_rgba(0,200,150,0.3)] transition-all duration-700 group-hover:shadow-[0_0_120px_-10px_rgba(0,200,150,0.4)] group-hover:scale-[1.01]">
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
                     <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live Pulse Engine</span>
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
            <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.3em] mb-4">Core Ecosystem</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Engineered for Perfection</h2>
            <p className="text-lg text-[var(--on-glass-muted)] max-w-2xl mx-auto font-medium">From WiFi check-ins to AI-driven scheduling, Attenda is the operating system for the modern workforce.</p>
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

      {/* ── Steps ─────────────────────────────────────────── */}
      <section className="py-32 px-6 bg-[var(--dark-800)]/30 border-y border-[var(--glass-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
               <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.3em] mb-4">Implementation</p>
               <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight">Zero-Friction Deployment</h2>
               <p className="text-lg text-[var(--on-glass-muted)] mb-12 font-medium leading-relaxed">We&apos;ve eliminated the complexity of workforce software. Scale from 1 to 10,000 employees in record time.</p>

               <div className="space-y-10">
                  {[
                    { n: '01', title: 'Organisation Blueprint', desc: 'Define your departments, shifts, and WiFi zones. Our team activates your digital workspace in under 24 hours.' },
                    { n: '02', title: 'Seamless Onboarding', desc: 'Bulk-import via CSV or direct API sync. Employees receive high-conversion welcome kits automatically.' },
                    { n: '03', title: 'Autonomous Growth', desc: 'The system runs itself. WiFi triggers attendance, AI optimizes shifts, and payroll calculates in real-time.' },
                  ].map(s => (
                    <div key={s.n} className="flex gap-6">
                       <div className="text-4xl font-black text-[var(--primary-600)]/20 leading-none">{s.n}</div>
                       <div>
                          <h3 className="text-lg font-black text-white mb-2 uppercase tracking-wide">{s.title}</h3>
                          <p className="text-sm font-medium text-[var(--on-glass-muted)]">{s.desc}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
            <div className="relative">
               <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-600)]/20 to-[var(--secondary)]/20 blur-[100px] rounded-full opacity-50" />
               <div className="relative bg-[var(--glass-05)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-[3rem] p-10 shadow-2xl">
                  <div className="space-y-6">
                     <div className="h-4 w-3/4 bg-[var(--glass-10)] rounded-full" />
                     <div className="h-4 w-1/2 bg-[var(--glass-10)] rounded-full" />
                     <div className="grid grid-cols-2 gap-4 mt-10">
                        <div className="h-32 bg-[var(--glass-05)] rounded-2xl border border-[var(--glass-border)]" />
                        <div className="h-32 bg-[var(--glass-05)] rounded-2xl border border-[var(--glass-border)]" />
                     </div>
                     <div className="h-12 w-full bg-[var(--primary-600)]/20 rounded-2xl border border-[var(--primary-600)]/30 mt-6" />
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section id="pricing" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.3em] mb-4">Investment</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Transparent Scaling</h2>
            <p className="text-lg text-[var(--on-glass-muted)] max-w-2xl mx-auto font-medium">Select the plan that aligns with your organisation&apos;s growth trajectory.</p>
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
                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[var(--primary-600)] text-white text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-xl">
                      Elite Choice
                   </div>
                )}
                <p className={cn("text-xs font-black uppercase tracking-widest mb-6", p.highlight ? "text-[var(--primary-600)]" : "text-[var(--on-glass-muted)]")}>{p.name}</p>
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
                      <span className="text-[13px] font-medium text-[var(--on-glass-sub)]">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className={cn(
                  "block text-center py-4 rounded-2xl font-black text-[13px] uppercase tracking-widest transition-all",
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

          <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight relative z-10">Ready to Upgrade Your Workspace?</h2>
          <p className="text-lg text-[var(--on-glass-muted)] mb-12 max-w-2xl mx-auto font-medium relative z-10 leading-relaxed">
            Eliminate manual check-ins and join the future of workforce management. Start your free enterprise trial today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 relative z-10">
            <Link href="/get-started" className="group px-12 py-5 bg-[var(--primary-600)] hover:brightness-110 text-white font-black rounded-2xl transition-all shadow-2xl shadow-[var(--primary-600)]/30 text-base uppercase tracking-widest active:scale-95">
              Apply for Organisation
            </Link>
            <Link href="/contact" className="px-12 py-5 bg-[var(--glass-10)] hover:bg-[var(--glass-20)] text-white font-bold rounded-2xl border border-[var(--glass-border)] backdrop-blur-md transition-all text-base uppercase tracking-widest">
              Consult with Expert
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

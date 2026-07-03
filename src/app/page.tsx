'use client';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';
import {
  Wifi, Bell, BarChart2, Calendar, DollarSign, Shield,
  CheckCircle, ArrowRight, Menu, X, Star, Plus, Minus,
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

const TESTIMONIALS = [
  {
    name: 'Sarah Chen',
    role: 'HR Director @ TechFlow',
    content: 'Attenda transformed how we handle attendance. The WiFi check-in eliminated 90% of manual corrections we used to do every Monday morning.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Marcus Rodriguez',
    role: 'Operations Manager @ Global Logistics',
    content: 'The real-time dashboard is a game changer. I can see exactly who is on-site across four different locations from one screen.',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&auto=format&fit=crop&q=80',
  },
  {
    name: 'Jessica Walsh',
    role: 'Founder @ Creative House',
    content: 'Simple, elegant, and effective. Finally, a workforce management tool that doesn’t feel like it was built in the 90s.',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&auto=format&fit=crop&q=80',
  }
];

const FAQS = [
  { q: 'How does WiFi check-in work?', a: 'When an employee joins your office WiFi network, Attenda automatically records their arrival. There’s no need for them to open the app or remember to punch in.' },
  { q: 'Can I use it for remote teams?', a: 'Absolutely. For remote staff, we offer manual check-ins via our mobile app with optional GPS geofencing to ensure they are at their designated workspace.' },
  { q: 'Does it integrate with my payroll software?', a: 'Yes, Attenda exports directly to common payroll formats and has built-in integrations for popular platforms like Xero, Gusto, and more.' },
  { q: 'Is my data secure?', a: 'We use bank-grade encryption (AES-256) for all data at rest and TLS 1.3 for data in transit. We are fully GDPR compliant.' }
];

// ─── Pricing ──────────────────────────────────────────
const PLANS = [
  { name: 'Trial',      price: 'Free',   period: '14 days',    highlight: false, features: ['Up to 10 employees', 'WiFi auto check-in', 'Basic dashboard', 'Email support'],                                                            cta: 'Start Free',   href: '/get-started' },
  { name: 'Starter',    price: '$49',    period: '/month',      highlight: false, features: ['Up to 50 employees', 'Everything in Trial', 'WhatsApp alerts', 'Shift management', 'Leave tracking'],                                      cta: 'Get Started',  href: '/get-started' },
  { name: 'Growth',     price: '$149',   period: '/month',      highlight: true,  features: ['Up to 200 employees', 'Everything in Starter', 'Payroll integration', 'AI scheduling', 'Remote tracking', 'Analytics'],                   cta: 'Get Started',  href: '/get-started' },
  { name: 'Enterprise', price: 'Custom', period: 'contact us',  highlight: false, features: ['Unlimited employees', 'Everything in Growth', 'Dedicated support', 'Custom integrations', 'SLA guarantee'],                              cta: 'Contact Sales', href: '/contact' },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
            Attendance Infrastructure,<br /><span className="text-[var(--primary-600)]">Reimagined.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--on-glass-muted)] max-w-2xl mx-auto mb-12 leading-relaxed font-medium page-fade-in delay-100">
            Attenda automates the entire workforce presence lifecycle. From autonomous WiFi check-ins to AI-powered scheduling, we provide the visibility you need to scale your team with confidence.
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
        <div className="max-w-6xl mx-auto mt-24 relative z-10 group px-4">
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--dark-950)] via-transparent to-transparent z-20 h-full w-full pointer-events-none" />
          <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--glass-05)] backdrop-blur-2xl p-2 md:p-3 shadow-[0_0_100px_-20px_rgba(0,200,150,0.3)] transition-all duration-700">
            <div className="rounded-[1.8rem] border border-[var(--glass-border)] bg-[var(--dark-950)] overflow-hidden relative shadow-2xl">
               <img
                 src="/dashboard-preview.png"
                 alt="Attenda Dashboard"
                 className="w-full h-auto grayscale-0 group-hover:scale-105 transition-all duration-1000"
               />
               {/* UI Mock Elements on top of image */}
               <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-600)]/10 to-transparent pointer-events-none" />

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

      {/* ── Social Proof ───────────────────────────────────── */}
      <section className="py-20 border-y border-[var(--glass-border)] bg-[var(--dark-950)]/50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.3em] mb-12">Trusted by innovative teams worldwide</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
            {['TechFlow', 'GlobalLogix', 'CreativeHouse', 'NanoSystems', 'BrightHR'].map(logo => (
              <span key={logo} className="text-2xl font-black text-white tracking-tighter">{logo}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────── */}
      <section id="features" className="py-32 px-6 bg-[var(--dark-950)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-4">Features</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Enterprise-grade capabilities</h2>
            <p className="text-lg text-[var(--on-glass-muted)] max-w-2xl mx-auto font-medium">Our comprehensive suite of tools covers every touchpoint of the employee experience, ensuring data integrity and operational excellence.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="p-8 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)] hover:border-[var(--glass-high)] transition-all duration-500 group relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-[var(--primary-600)]/5 rounded-full blur-3xl group-hover:bg-[var(--primary-600)]/10 transition-all" />
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

      {/* ── Visual Section ─────────────────────────────────── */}
      <section className="py-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <div className="relative">
                 <div className="absolute -top-20 -left-20 w-64 h-64 bg-[var(--primary-600)]/10 blur-[100px] rounded-full" />
                 <div className="rounded-[3rem] overflow-hidden border border-[var(--glass-border)] shadow-2xl relative z-10">
                    <img
                      src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&q=80&w=1974"
                      alt="Team working"
                      className="w-full h-auto grayscale-[0.3] hover:grayscale-0 transition-all duration-700"
                    />
                 </div>
              </div>
              <div className="space-y-8">
                 <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">Focus on your people,<br /><span className="text-[var(--primary-600)]">not the paperwork.</span></h2>
                 <p className="text-lg text-[var(--on-glass-muted)] leading-relaxed font-medium">
                    Our mission is to make attendance tracking invisible. By automating the mundane, we allow HR teams and managers to focus on what actually matters: building a great culture and driving growth.
                 </p>
                 <ul className="space-y-4">
                    {['Zero manual data entry', 'Eliminate buddy punching', 'Real-time compliance tracking'].map(item => (
                       <li key={item} className="flex items-center gap-4 text-white font-bold">
                          <div className="w-6 h-6 rounded-full bg-[var(--primary-600)]/20 flex items-center justify-center border border-[var(--primary-600)]/30">
                             <CheckCircle size={14} className="text-[var(--primary-600)]" />
                          </div>
                          {item}
                       </li>
                    ))}
                 </ul>
              </div>
           </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="py-32 px-6 bg-[var(--dark-800)]/30 border-y border-[var(--glass-border)]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-4">How it works</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Up and running in minutes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {[
              { n: '01', title: 'Apply for your organisation', desc: 'Fill in a short form. Our team reviews your application and activates your account within 24 hours.' },
              { n: '02', title: 'Add your team',               desc: 'Invite employees by email or bulk-import via CSV. Assign shifts, departments, and managers in minutes.' },
              { n: '03', title: 'Attendance runs itself',       desc: 'Employees check in via WiFi, QR, or mobile. You get live alerts and zero manual paperwork.' },
            ].map(s => (
              <div key={s.n} className="relative">
                <div className="text-8xl font-black leading-none mb-8 text-[var(--primary-600)] opacity-10 absolute -top-12 -left-4 select-none">{s.n}</div>
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-wide relative z-10">{s.title}</h3>
                <p className="text-base font-medium text-[var(--on-glass-muted)] leading-relaxed relative z-10">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
           <div className="text-center mb-20">
             <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-4">Testimonials</p>
             <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Loved by teams everywhere</h2>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {TESTIMONIALS.map((t, i) => (
                <div key={t.name} className="p-10 rounded-[3rem] bg-[var(--glass-05)] border border-[var(--glass-border)] flex flex-col justify-between hover:bg-[var(--glass-10)] transition-all">
                   <div className="mb-10">
                      <div className="flex gap-1 mb-6">
                        {[1,2,3,4,5].map(star => <Star key={star} size={14} className="text-yellow-500" fill="currentColor" />)}
                      </div>
                      <p className="text-lg font-medium text-white leading-relaxed italic">&ldquo;{t.content}&rdquo;</p>
                   </div>
                   <div className="flex items-center gap-4">
                    <Image src={t.avatar} alt={t.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--glass-border)]" />
                      <div>
                         <p className="text-sm font-black text-white">{t.name}</p>
                         <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">{t.role}</p>
                      </div>
                   </div>
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

      {/* ── FAQ ────────────────────────────────────────────── */}
      <section className="py-32 px-6 bg-[var(--dark-800)]/20 border-t border-[var(--glass-border)]">
        <div className="max-w-3xl mx-auto">
           <div className="text-center mb-20">
             <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-4">FAQ</p>
             <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Got questions?</h2>
           </div>
           <div className="space-y-4">
              {FAQS.map((faq, i) => (
                <div key={i} className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--glass-05)] overflow-hidden transition-all">
                   <button
                     onClick={() => setOpenFaq(openFaq === i ? null : i)}
                     className="w-full px-8 py-6 flex items-center justify-between text-left hover:bg-[var(--glass-05)] transition-colors"
                   >
                      <span className="font-bold text-white">{faq.q}</span>
                      {openFaq === i ? <Minus size={18} className="text-[var(--primary-600)]" /> : <Plus size={18} className="text-[var(--on-glass-muted)]" />}
                   </button>
                   <div className={cn(
                     "px-8 transition-all duration-300 ease-in-out",
                     openFaq === i ? "max-h-40 pb-6 opacity-100" : "max-h-0 opacity-0"
                   )}>
                      <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed">{faq.a}</p>
                   </div>
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

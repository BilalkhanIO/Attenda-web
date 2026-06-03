'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MarketingNav, MarketingFooter } from '../page';
import { Mail, MessageSquare, Building2, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="bg-[var(--dark-950)] min-h-screen selection:bg-[var(--primary-600)] selection:text-white">
      <MarketingNav />

      {/* Header */}
      <section className="pt-44 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[var(--primary-600)]/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-6">Contact Us</p>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-tight">We&apos;d love to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-600)] to-[var(--secondary)]">hear from you.</span></h1>
          <p className="text-lg md:text-xl text-[var(--on-glass-muted)] leading-relaxed max-w-2xl mx-auto font-medium">
            Have a question, want a demo, or need help? Our team typically responds within 24 hours.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20">
          {/* Contact info */}
          <div className="space-y-12 slide-in-left">
            <div>
              <h2 className="text-xl font-bold text-white mb-10">Contact information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
                {[
                  { icon: Mail,          label: 'General enquiries',   value: 'hello@attenda.app',   href: 'mailto:hello@attenda.app' },
                  { icon: Building2,     label: 'Sales & enterprise',  value: 'sales@attenda.app',   href: 'mailto:sales@attenda.app' },
                  { icon: MessageSquare, label: 'Support',             value: 'support@attenda.app', href: 'mailto:support@attenda.app' },
                ].map(c => (
                  <div key={c.label} className="p-6 rounded-3xl border border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)] transition-all duration-500 group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--glass-10)] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <c.icon size={20} className="text-[var(--primary-600)]" />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--on-glass-muted)] font-medium mb-1">{c.label}</p>
                        <a href={c.href} className="text-[15px] font-bold text-white hover:text-[var(--primary-600)] transition-colors">{c.value}</a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Response time */}
            <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-[var(--glass-10)] to-transparent border border-[var(--glass-border)] shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Clock size={18} className="text-[var(--primary-600)]" />
                <p className="text-sm font-bold text-white uppercase tracking-widest">Response times</p>
              </div>
              <div className="space-y-4">
                {[
                  ['General enquiries', 'Within 24 hours'],
                  ['Support tickets', 'Within 4 hours (business days)'],
                  ['Enterprise sales', 'Same business day'],
                ].map(([label, time]) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-[var(--glass-border)] last:border-0">
                    <span className="text-sm font-medium text-[var(--on-glass-muted)]">{label}</span>
                    <span className="text-sm font-bold text-white">{time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div>
              <p className="text-xs font-bold text-[var(--on-glass-dim)] uppercase tracking-widest mb-6">Quick links</p>
              <div className="flex gap-4 flex-wrap">
                {[{ label: 'Apply for org', href: '/get-started' }, { label: 'Privacy Policy', href: '/privacy' }, { label: 'About us', href: '/about' }].map(l => (
                  <Link key={l.label} href={l.href} className="px-5 py-2.5 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-full text-xs font-bold text-white hover:bg-[var(--glass-10)] transition-all">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div className="slide-in-right">
            <div className="p-10 md:p-12 rounded-[3.5rem] bg-[var(--glass-05)] border border-[var(--glass-border)] backdrop-blur-2xl shadow-2xl relative overflow-hidden">
               {/* Background Glow */}
               <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-[var(--primary-600)]/5 blur-[80px] rounded-full pointer-events-none" />

               {sent ? (
                 <div className="flex flex-col items-center justify-center min-h-[400px] text-center page-fade-in">
                   <div className="w-20 h-20 rounded-[2rem] bg-[var(--success-500)]/20 border border-[var(--success-500)]/30 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[var(--success-500)]/10 animate-bounce">
                     <CheckCircle size={36} className="text-[var(--success-500)]" />
                   </div>
                   <h3 className="text-3xl font-black text-white mb-4 tracking-tight">Message received!</h3>
                   <p className="text-[var(--on-glass-muted)] font-medium mb-10 max-w-xs mx-auto">Thanks for reaching out. We&apos;ll get back to you within 24 hours.</p>
                   <button onClick={() => setSent(false)} className="px-8 py-3 bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-xl text-xs font-bold text-white uppercase tracking-widest hover:bg-[var(--glass-20)] transition-all">
                     Send another message
                   </button>
                 </div>
               ) : (
                 <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                   <div className="mb-10">
                      <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Send us a message</h2>
                      <p className="text-sm font-medium text-[var(--on-glass-muted)]">Tell us how we can help your team.</p>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                       <label className="text-xs font-bold text-[var(--on-glass-muted)] uppercase tracking-widest ml-1">Your name <span className="text-[var(--primary-600)]">*</span></label>
                       <input
                         required
                         type="text"
                         placeholder="Jane Smith"
                         value={form.name}
                         onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                         className="w-full bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-white text-sm placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium"
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-xs font-bold text-[var(--on-glass-muted)] uppercase tracking-widest ml-1">Work email <span className="text-[var(--primary-600)]">*</span></label>
                       <input
                         required
                         type="email"
                         placeholder="jane@company.com"
                         value={form.email}
                         onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                         className="w-full bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-white text-sm placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium"
                       />
                     </div>
                   </div>

                   <div className="space-y-2">
                     <label className="text-xs font-bold text-[var(--on-glass-muted)] uppercase tracking-widest ml-1">Company name</label>
                     <input
                       type="text"
                       placeholder="Acme Corp"
                       value={form.company}
                       onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                       className="w-full bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-white text-sm placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium"
                     />
                   </div>

                   <div className="space-y-2">
                     <label className="text-xs font-bold text-[var(--on-glass-muted)] uppercase tracking-widest ml-1">Message <span className="text-[var(--primary-600)]">*</span></label>
                     <textarea
                       required
                       rows={4}
                       placeholder="Tell us how we can help..."
                       value={form.message}
                       onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                       className="w-full bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-white text-sm placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium resize-none"
                     />
                   </div>

                   <button
                     type="submit"
                     disabled={loading}
                     className="w-full py-5 bg-[var(--primary-600)] hover:brightness-110 text-white font-black rounded-2xl transition-all shadow-2xl shadow-[var(--primary-600)]/20 text-sm uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95"
                   >
                     {loading ? (
                       <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                     ) : 'Send Message'}
                   </button>

                   <p className="text-xs text-center font-medium text-[var(--on-glass-dim)] leading-relaxed">
                     By submitting, you agree to our{' '}
                     <Link href="/privacy" className="text-[var(--primary-600)] hover:underline">Privacy Policy</Link>.
                   </p>
                 </form>
               )}
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

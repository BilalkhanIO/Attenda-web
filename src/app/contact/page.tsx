'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MarketingNav, MarketingFooter } from '../page';
import { Mail, MessageSquare, Building2, Clock, CheckCircle } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate submission — replace with real endpoint if needed
    await new Promise(r => setTimeout(r, 900));
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="bg-white min-h-screen">
      <MarketingNav />

      {/* Header */}
      <section className="bg-[var(--dark-950)] pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-3">Get In Touch</p>
          <h1 className="text-4xl font-black text-white mb-4">We&apos;d love to hear from you.</h1>
          <p className="text-white/60">Have a question, want a demo, or need help? Our team typically responds within 24 hours.</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact info */}
          <div>
            <h2 className="text-2xl font-bold text-[var(--dark-950)] mb-6">Contact information</h2>
            <div className="space-y-5">
              {[
                { icon: Mail,          label: 'General enquiries',   value: 'hello@attenda.app',   href: 'mailto:hello@attenda.app' },
                { icon: Building2,     label: 'Sales & enterprise',  value: 'sales@attenda.app',   href: 'mailto:sales@attenda.app' },
                { icon: MessageSquare, label: 'Support',             value: 'support@attenda.app', href: 'mailto:support@attenda.app' },
              ].map(c => (
                <div key={c.label} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary-100)] flex items-center justify-center flex-shrink-0">
                    <c.icon size={18} className="text-[var(--primary-600)]" />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--gray-500)] font-medium mb-0.5">{c.label}</p>
                    <a href={c.href} className="text-sm font-semibold text-[var(--dark-950)] hover:text-[var(--primary-600)] transition-colors">{c.value}</a>
                  </div>
                </div>
              ))}
            </div>

            {/* Response time */}
            <div className="mt-10 p-5 rounded-2xl bg-[var(--gray-50)] border border-[var(--gray-100)]">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} className="text-[var(--gray-500)]" />
                <p className="text-xs font-semibold text-[var(--dark-950)]">Response times</p>
              </div>
              <ul className="space-y-1.5 text-xs text-[var(--gray-500)]">
                <li>General enquiries — within 24 hours</li>
                <li>Support tickets — within 4 hours (business days)</li>
                <li>Enterprise sales — same business day</li>
              </ul>
            </div>

            {/* Quick links */}
            <div className="mt-8">
              <p className="text-xs font-semibold text-[var(--gray-500)] uppercase tracking-widest mb-3">Quick links</p>
              <div className="flex gap-3 flex-wrap">
                {[{ label: 'Apply for org', href: '/get-started' }, { label: 'Privacy Policy', href: '/privacy' }, { label: 'About us', href: '/about' }].map(l => (
                  <Link key={l.label} href={l.href} className="px-3 py-1.5 border border-[var(--gray-200)] rounded-lg text-xs font-medium text-[var(--dark-950)] hover:bg-[var(--gray-50)] transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div>
            {sent ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-full bg-[var(--success-100)] flex items-center justify-center mb-5">
                  <CheckCircle size={28} className="text-[var(--success-700)]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--dark-950)] mb-2">Message received!</h3>
                <p className="text-[var(--gray-500)] text-sm max-w-xs">Thanks for reaching out. We&apos;ll get back to you within 24 hours.</p>
                <button onClick={() => setSent(false)} className="mt-6 text-xs text-[var(--primary-600)] hover:underline">Send another message</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="text-2xl font-bold text-[var(--dark-950)] mb-6">Send us a message</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--dark-950)] mb-1.5">Your name <span className="text-[var(--danger-500)]">*</span></label>
                    <input
                      required
                      type="text"
                      placeholder="Jane Smith"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[var(--dark-950)] mb-1.5">Work email <span className="text-[var(--danger-500)]">*</span></label>
                    <input
                      required
                      type="email"
                      placeholder="jane@company.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--dark-950)] mb-1.5">Company name</label>
                  <input
                    type="text"
                    placeholder="Acme Corp"
                    value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[var(--dark-950)] mb-1.5">Message <span className="text-[var(--danger-500)]">*</span></label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Tell us how we can help..."
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] focus:border-transparent resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[var(--primary-600)] hover:bg-[var(--primary-900)] text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : 'Send Message'}
                </button>

                <p className="text-xs text-center text-[var(--gray-500)]">
                  By submitting, you agree to our{' '}
                  <Link href="/privacy" className="text-[var(--primary-600)] hover:underline">Privacy Policy</Link>.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

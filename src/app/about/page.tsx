import Link from 'next/link';
import { MarketingNav, MarketingFooter } from '../page';
import { Target, Heart, Zap, Globe } from 'lucide-react';

export const metadata = { title: 'About — Attenda', description: 'Learn about Attenda and our mission to simplify workforce management.' };

export default function AboutPage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingNav />

      {/* Hero */}
      <section className="bg-[var(--dark-950)] pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-4">About Us</p>
          <h1 className="text-5xl font-black text-white mb-6">We believe attendance should be invisible.</h1>
          <p className="text-lg text-white/60 leading-relaxed">
            Attenda was built by a team tired of watching HR spend hours every week manually reconciling timesheets. We set out to make attendance tracking disappear into the background — automatic, accurate, and effortless.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-3">Our Mission</p>
            <h2 className="text-3xl font-bold text-[var(--dark-950)] mb-4">Eliminate manual time tracking for good.</h2>
            <p className="text-[var(--gray-500)] leading-relaxed mb-4">
              Every minute an HR manager spends chasing attendance data is a minute not spent on growing the business. We built Attenda to give that time back — through smart automation, real-time visibility, and integrations that actually work.
            </p>
            <p className="text-[var(--gray-500)] leading-relaxed">
              From WiFi-based auto check-in to AI-assisted scheduling and WhatsApp notifications, Attenda handles the entire attendance lifecycle so you don&apos;t have to.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Target, title: 'Precision',    desc: 'Accurate to the minute, every time.',           color: 'var(--primary-600)' },
              { icon: Zap,    title: 'Automation',   desc: 'Zero manual check-ins for office workers.',     color: 'var(--success-500)' },
              { icon: Heart,  title: 'People-first', desc: 'Designed for employees, not just managers.',    color: 'var(--danger-500)' },
              { icon: Globe,  title: 'Global',       desc: 'Timezone-aware for distributed teams.',        color: 'var(--purple-500)' },
            ].map(v => (
              <div key={v.title} className="p-5 rounded-2xl border border-[var(--gray-100)] hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: v.color + '18' }}>
                  <v.icon size={18} style={{ color: v.color }} />
                </div>
                <p className="text-sm font-bold text-[var(--dark-950)] mb-1">{v.title}</p>
                <p className="text-xs text-[var(--gray-500)]">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6 bg-[var(--gray-50)]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-3">Our Values</p>
          <h2 className="text-3xl font-bold text-[var(--dark-950)] mb-12">What we stand for</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {[
              { title: 'Simplicity over complexity',    desc: 'If a feature requires a training manual, it&apos;s not designed well enough. We obsess over making hard things simple.' },
              { title: 'Data you can trust',            desc: 'Every check-in timestamp, every absence alert — accurate, immutable, and auditable. No more spreadsheet disputes.' },
              { title: 'Privacy by design',             desc: 'Employee data stays in your organisation. We don&apos;t sell data, we don&apos;t mine it. You own what you put in.' },
            ].map(v => (
              <div key={v.title} className="p-6 rounded-2xl bg-white border border-[var(--gray-100)]">
                <h3 className="text-base font-bold text-[var(--dark-950)] mb-2">{v.title}</h3>
                <p className="text-sm text-[var(--gray-500)] leading-relaxed" dangerouslySetInnerHTML={{ __html: v.desc }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-[var(--dark-950)] mb-4">Ready to get started?</h2>
          <p className="text-[var(--gray-500)] mb-8">Apply for your organisation today. We&apos;ll have you set up within 24 hours.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/get-started" className="px-6 py-3 bg-[var(--primary-600)] hover:bg-[var(--primary-900)] text-white font-semibold rounded-xl transition-all text-sm">
              Apply Now
            </Link>
            <Link href="/contact" className="px-6 py-3 border border-[var(--gray-200)] text-[var(--dark-950)] font-semibold rounded-xl hover:bg-[var(--gray-50)] transition-all text-sm">
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

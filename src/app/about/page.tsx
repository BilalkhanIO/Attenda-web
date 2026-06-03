import Link from 'next/link';
import { MarketingNav, MarketingFooter } from '../page';
import { Target, Heart, Zap, Globe } from 'lucide-react';

export const metadata = { title: 'About — Attenda', description: 'Learn about Attenda and our mission to simplify workforce management.' };

export default function AboutPage() {
  return (
    <div className="bg-[var(--dark-950)] min-h-screen selection:bg-[var(--primary-600)] selection:text-white">
      <MarketingNav />

      {/* Hero */}
      <section className="pt-44 pb-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[var(--primary-600)]/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.4em] mb-6">Our Philosophy</p>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-tight">We believe attendance should be <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-600)] to-[var(--secondary)]">invisible.</span></h1>
          <p className="text-lg md:text-xl text-[var(--on-glass-muted)] leading-relaxed max-w-3xl mx-auto font-medium">
            Attenda was born from a simple observation: human potential is wasted on manual administration. We engineered a platform that makes workforce tracking disappear into the background—allowing teams to focus on what truly matters.
          </p>
        </div>
      </section>

      {/* Mission Grid */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div className="slide-in-left">
            <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.4em] mb-6">The Mission</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight leading-tight">Engineering the Future of Human Capital.</h2>
            <p className="text-lg text-[var(--on-glass-muted)] leading-relaxed mb-6 font-medium">
              Every hour spent reconciling spreadsheets is an hour stolen from innovation. Attenda reclaim that time through autonomous WiFi check-ins, AI-driven resource allocation, and real-time connectivity.
            </p>
            <p className="text-lg text-[var(--on-glass-muted)] leading-relaxed font-medium">
              We aren&apos;t just tracking time; we&apos;re providing the data infrastructure for the next generation of high-performance organisations.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 slide-in-right">
            {[
              { icon: Target, title: 'Precision',    desc: 'Atomic-clock accuracy for every check-in event.', color: 'var(--primary-600)' },
              { icon: Zap,    title: 'Autonomy',   desc: 'Zero manual input required for office personnel.', color: 'var(--secondary)' },
              { icon: Heart,  title: 'Humanity',   desc: 'Designed with empathy for the modern employee.', color: 'var(--danger-500)' },
              { icon: Globe,  title: 'Global',       desc: 'Universal time protocols for distributed teams.', color: 'var(--primary-100)' },
            ].map((v, i) => (
              <div key={v.title} className="p-8 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)] transition-all duration-500 group">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-[var(--glass-10)] group-hover:scale-110 group-hover:rotate-6 transition-all duration-500" style={{ border: `1px solid ${v.color}30` }}>
                  <v.icon size={22} style={{ color: v.color }} />
                </div>
                <h3 className="text-lg font-black text-white mb-3 uppercase tracking-wide group-hover:text-[var(--primary-600)] transition-colors">{v.title}</h3>
                <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-32 px-6 bg-[var(--dark-800)]/30 border-y border-[var(--glass-border)]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.4em] mb-6">Core Values</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-20 tracking-tight">Built on Principles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {[
              { title: 'Elegant Simplicity',    desc: 'Complex problems require simple solutions. If it requires a manual, we haven&apos;t finished engineering it.' },
              { title: 'Radical Integrity',      desc: 'Data is the source of truth. Every record in Attenda is immutable, auditable, and beyond dispute.' },
              { title: 'Privacy First',         desc: 'Your organisation owns its data. We implement state-of-the-art encryption to ensure your sovereignty.' },
            ].map((v, i) => (
              <div key={v.title} className="p-10 rounded-[2.5rem] bg-[var(--glass-05)] border border-[var(--glass-border)] hover:border-[var(--primary-600)]/30 transition-all duration-500">
                <h3 className="text-xl font-black text-white mb-6 uppercase tracking-wide leading-tight">{v.title}</h3>
                <p className="text-[15px] font-medium text-[var(--on-glass-muted)] leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight">Ready to Pioneer?</h2>
          <p className="text-lg text-[var(--on-glass-muted)] mb-12 font-medium leading-relaxed">Join the elite organisations that have already transitioned to the Aurora Liquid Glass ecosystem.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/get-started" className="px-12 py-5 bg-[var(--primary-600)] hover:brightness-110 text-white font-black rounded-2xl transition-all shadow-2xl shadow-[var(--primary-600)]/30 text-base uppercase tracking-widest active:scale-95">
              Secure Your Instance
            </Link>
            <Link href="/contact" className="px-12 py-5 bg-[var(--glass-10)] hover:bg-[var(--glass-20)] text-white font-bold rounded-2xl border border-[var(--glass-border)] backdrop-blur-md transition-all text-base uppercase tracking-widest">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

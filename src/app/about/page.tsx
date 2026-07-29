import Link from 'next/link';
import Image from 'next/image';
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
        <div className="max-w-7xl mx-auto relative z-10">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="text-left">
                <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-6">Our Narrative</p>
                <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-tight">Precision at the core of <span className="text-[var(--primary-600)]">productivity.</span></h1>
                <p className="text-lg md:text-xl text-[var(--on-glass-muted)] leading-relaxed font-medium">
                  Attenda emerged from a critical observation: the most successful organisations are those where operational friction is minimised. We engineered a platform that transforms attendance from a manual chore into a seamless, data-driven background process.
                </p>
              </div>
              <div className="relative">
                 <div className="rounded-[3rem] overflow-hidden border border-[var(--glass-border)] shadow-2xl">
                    <Image
                      src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=2070"
                      alt="Our team"
                      width={1200}
                      height={800}
                      className="w-full h-auto grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
                    />
                 </div>
                 <div className="absolute -bottom-10 -right-10 bg-[var(--dark-950)] border border-[var(--glass-border)] p-8 rounded-[2rem] shadow-2xl hidden md:block">
                    <p className="text-4xl font-black text-white mb-1">500+</p>
                    <p className="text-xs font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">Global Clients</p>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-[var(--dark-800)]/20 border-y border-[var(--glass-border)]">
         <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
               {[
                 { label: 'Check-ins daily', val: '50k+' },
                 { label: 'Time saved/mo', val: '120h' },
                 { label: 'Data accuracy', val: '99.9%' },
                 { label: 'Support rating', val: '4.9/5' },
               ].map(s => (
                 <div key={s.label}>
                    <p className="text-4xl md:text-5xl font-black text-white mb-2">{s.val}</p>
                    <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-[0.2em]">{s.label}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Mission Grid */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div className="slide-in-left">
            <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-6">Our Mission</p>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight leading-tight">Architecting the future of workforce management.</h2>
            <p className="text-lg text-[var(--on-glass-muted)] leading-relaxed mb-6 font-medium">
              Our objective is to empower HR leaders with absolute data integrity. We believe that by automating the foundational aspects of workforce management—presence, scheduling, and compliance—we enable teams to reach their highest potential.
            </p>
            <p className="text-lg text-[var(--on-glass-muted)] leading-relaxed font-medium">
              Through continuous innovation in WiFi-based automation and AI-driven insights, Attenda provides a robust infrastructure that adapts to the complexities of modern, distributed workforces.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 slide-in-right">
            {[
              { icon: Target, title: 'Precision',    desc: 'Accurate to the minute, every time.',           color: 'var(--primary-600)' },
              { icon: Zap,    title: 'Automation',   desc: 'Zero manual check-ins for office workers.',     color: 'var(--secondary)' },
              { icon: Heart,  title: 'People-first', desc: 'Designed for employees, not just managers.',    color: 'var(--danger-500)' },
              { icon: Globe,  title: 'Global',       desc: 'Timezone-aware for distributed teams.',        color: 'var(--primary-100)' },
            ].map((v) => (
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

      {/* Team Section */}
      <section className="py-32 px-6">
         <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
               <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-6">Our Leadership</p>
               <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">The minds behind Attenda</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
               {[
                 { name: 'Alex Rivers', role: 'CEO & Founder', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&auto=format&fit=crop&q=80' },
                 { name: 'Elena Vance', role: 'CTO', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&auto=format&fit=crop&q=80' },
                 { name: 'David Chen', role: 'Head of Product', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&auto=format&fit=crop&q=80' },
                 { name: 'Sofia Bell', role: 'Head of Design', img: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&auto=format&fit=crop&q=80' },
               ].map(m => (
                 <div key={m.name} className="group">
                    <div className="aspect-square rounded-[2rem] overflow-hidden border border-[var(--glass-border)] mb-6 grayscale group-hover:grayscale-0 transition-all duration-500">
                       <Image src={m.img} alt={m.name} width={400} height={400} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    </div>
                    <h3 className="text-xl font-black text-white mb-1">{m.name}</h3>
                    <p className="text-xs font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">{m.role}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Values */}
      <section className="py-32 px-6 bg-[var(--dark-800)]/30 border-y border-[var(--glass-border)]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-6">Our Values</p>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-20 tracking-tight">What we stand for</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {[
              { title: 'Simplicity over complexity',    desc: 'If a feature requires a training manual, it&apos;s not designed well enough. We obsess over making hard things simple.' },
              { title: 'Data you can trust',            desc: 'Every check-in timestamp, every absence alert — accurate, immutable, and auditable. No more spreadsheet disputes.' },
              { title: 'Privacy by design',             desc: 'Employee data stays in your organisation. We don&apos;t sell data, we don&apos;t mine it. You own what you put in.' },
            ].map((v) => (
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
          <h2 className="text-4xl md:text-5xl font-black text-white mb-8 tracking-tight">Ready to get started?</h2>
          <p className="text-lg text-[var(--on-glass-muted)] mb-12 font-medium leading-relaxed">Apply for your organisation today. We&apos;ll have you set up within 24 hours.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/get-started" className="px-12 py-5 bg-[var(--primary-600)] hover:brightness-110 text-white font-black rounded-2xl transition-all shadow-2xl shadow-[var(--primary-600)]/30 text-sm uppercase tracking-widest active:scale-95">
              Apply Now
            </Link>
            <Link href="/contact" className="px-12 py-5 bg-[var(--glass-10)] hover:bg-[var(--glass-20)] text-white font-bold rounded-2xl border border-[var(--glass-border)] backdrop-blur-md transition-all text-base">
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

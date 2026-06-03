import Link from 'next/link';
import { MarketingNav, MarketingFooter } from '../page';

export const metadata = { title: 'Privacy Policy — Attenda', description: 'How Attenda collects, uses, and protects your data.' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-16">
      <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 border-l-4 border-[var(--primary-600)] pl-5">{title}</h2>
      <div className="text-[var(--on-glass-muted)] leading-relaxed space-y-4 text-sm font-medium">{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="bg-[var(--dark-950)] min-h-screen selection:bg-[var(--primary-600)] selection:text-white">
      <MarketingNav />

      {/* Header */}
      <section className="pt-44 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[var(--primary-600)]/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.4em] mb-6">Compliance</p>
          <h1 className="text-5xl md:text-6xl font-black text-white mb-8 tracking-tighter">Privacy & Security Protocols</h1>
          <p className="text-sm font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </section>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-6 py-24">
        <div className="p-10 md:p-16 rounded-[3rem] bg-[var(--glass-05)] border border-[var(--glass-border)] backdrop-blur-2xl">
          <Section title="1. Identity Verification">
            <p>Attenda (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates as a high-security workforce management platform. This document outlines our protocols for the acquisition, retention, and encryption of organisational and personnel data.</p>
            <p>Engagement with the Attenda ecosystem constitutes formal acceptance of these protocols. If your organisation does not align with these standards, access must be terminated immediately.</p>
          </Section>

          <Section title="2. Data Acquisition">
            <p><strong className="text-white">Organisation Blueprint:</strong> Structural data including company identifiers, temporal zones, and operational parameters provided during platform initiation.</p>
            <p><strong className="text-white">Personnel Identifiers:</strong> Names, cryptographic email hashes, job classifications, and hierarchical positioning—managed by authorised administrators.</p>
            <p><strong className="text-white">Operational Telemetry:</strong> Temporal timestamps for attendance events, network identifiers (IP/SSID for WiFi detection), and geospatial coordinates where mobility tracking is active.</p>
            <p><strong className="text-white">System Diagnostics:</strong> Non-personally identifiable telemetry used to optimize platform performance and security response.</p>
          </Section>

          <Section title="3. Processing Logic">
            <p>Acquired data is processed exclusively for:</p>
            <ul className="list-none space-y-3">
              {[
                'Maintenance of the Attenda Pulse Engine',
                'Generation of verifiable attendance telemetry',
                'Execution of automated WhatsApp notification triggers',
                'Synchronisation with registered payroll interfaces',
                'Counter-fraud and security baseline monitoring',
              ].map(item => (
                <li key={item} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-600)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6">Attenda does not engage in data brokerage, advertising syndication, or non-functional data mining.</p>
          </Section>

          <Section title="4. Sovereignty & Control">
            <p>Your organisation retains absolute sovereignty over all personnel data within the Attenda environment. We operate as a data processor, acting only on instructions provided through the administrative interface. Data may be extracted or purged at the discretion of authorised controllers.</p>
          </Section>

          <Section title="5. Cryptographic Security">
            <p>We implement military-grade security architectures:</p>
            <ul className="list-none space-y-3">
              {[
                'TLS 1.3 encryption for all data in transit',
                'AES-256 encryption at rest for all database assets',
                'Zero-trust role-based access protocols',
                'Multi-factor authentication (MFA) mandatory for admins',
                'Real-time intrusion detection and response',
              ].map(item => (
                <li key={item} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-600)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="6. Ecosystem Integration">
            <p>Attenda maintains secure handshakes with the following entities:</p>
            <ul className="list-none space-y-2">
              <li><strong className="text-white">Meta Systems</strong> — For WhatsApp Business API connectivity.</li>
              <li><strong className="text-white">Global Cloud Infrastructure</strong> — High-availability hosting in secure data centers.</li>
            </ul>
          </Section>

          <Section title="7. Cookies & Session Management">
            <p>We utilize strictly functional cookies for identity persistence (HTTP-only JWT). No tracking pixels, marketing beacons, or third-party analytics cookies are permitted within the authenticated environment.</p>
          </Section>

          <Section title="8. Protocol Adjustments">
            <p>Security and privacy protocols are reviewed bi-annually. Organisations will be notified of material adjustments via secure transmission at least 30 temporal days prior to implementation.</p>
          </Section>

          <div className="mt-20 pt-10 border-t border-[var(--glass-border)]">
             <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-4">Inquiries</p>
             <p className="text-sm font-medium text-[var(--on-glass-muted)]">
                Security-related inquiries should be directed to our Privacy Command: <a href="mailto:privacy@attenda.app" className="text-[var(--primary-600)] hover:underline">privacy@attenda.app</a>
             </p>
          </div>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}

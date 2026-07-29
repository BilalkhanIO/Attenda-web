import { MarketingNav, MarketingFooter } from '../page';

export const metadata = { title: 'Privacy Policy — Attenda', description: 'How Attenda collects, uses, and protects your data.' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-16">
      <h2 className="text-xl font-bold text-white mb-6 border-l-4 border-[var(--primary-600)] pl-5">{title}</h2>
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
          <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-6">Legal</p>
          <h1 className="text-5xl md:text-6xl font-black text-white mb-8 tracking-tighter">Privacy Policy</h1>
          <p className="text-sm font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </section>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-6 py-24">
        <div className="p-10 md:p-16 rounded-[3rem] bg-[var(--glass-05)] border border-[var(--glass-border)] backdrop-blur-2xl">
          <Section title="1. Data Governance Framework">
            <p>Attenda (&quot;the Platform&quot;) operates under a stringent data governance framework designed to protect the integrity and confidentiality of organisational data. This Privacy Policy outlines our protocols for the acquisition, processing, and protection of information within our ecosystem.</p>
            <p>Engagement with the Platform constitutes an agreement to these terms. We maintain a policy of absolute transparency regarding data lifecycle management.</p>
          </Section>

          <Section title="2. Information We Collect">
            <p><strong className="text-white">Organisation data:</strong> Company name, timezone, billing plan, and configuration settings you provide during onboarding and setup.</p>
            <p><strong className="text-white">Employee data:</strong> Names, email addresses, phone numbers, job titles, departments, and attendance records — entered by your organisation&apos;s administrators.</p>
            <p><strong className="text-white">Attendance data:</strong> Check-in/check-out timestamps, device IP addresses (for WiFi-based detection), GPS coordinates (mobile app only), and shift adherence metrics.</p>
            <p><strong className="text-white">Usage data:</strong> Log files, page views, feature usage, and performance metrics to improve the platform.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-none space-y-3">
              {[
                'Provide, maintain, and improve the Attenda platform',
                'Process attendance records and generate reports',
                'Send notifications (WhatsApp, email, in-app) as configured by your organisation',
                'Calculate payroll data when payroll integration is enabled',
                'Detect and prevent fraud or abuse',
                'Respond to support requests',
              ].map(item => (
                <li key={item} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-600)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6">We do not sell, rent, or trade your personal information or your employees&apos; data to third parties for marketing purposes.</p>
          </Section>

          <Section title="4. Sovereignty and Portability">
            <p>Organisations retain absolute sovereignty over all employee data processed within Attenda. We operate strictly as a Data Processor. The right to data portability is guaranteed; administrators may execute full data exports or permanent deletion protocols at any time without restriction.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>Attendance records and employee data are retained for as long as your subscription is active, plus 90 days after cancellation to allow for data export. After that period, data is permanently deleted from our servers.</p>
          </Section>

          <Section title="6. Security">
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-none space-y-3">
              {[
                'TLS 1.2+ encryption in transit',
                'Encrypted database storage at rest',
                'Role-based access controls',
                'Two-factor authentication (2FA) support',
                'Regular security audits',
              ].map(item => (
                <li key={item} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-600)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="7. Third-Party Services">
            <p>Attenda integrates with the following third-party services:</p>
            <ul className="list-none space-y-2">
              <li><strong className="text-white">WhatsApp Business API</strong> — for sending attendance notifications (subject to Meta&apos;s Privacy Policy)</li>
              <li><strong className="text-white">Railway / cloud hosting</strong> — for infrastructure</li>
            </ul>
          </Section>

          <Section title="8. Cookies">
            <p>We use essential cookies to maintain your authenticated session (JWT stored as an HTTP-only cookie). We do not use tracking or advertising cookies.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of any significant changes by email or via an in-app notice at least 30 days before they take effect. Continued use of Attenda after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <div className="mt-20 pt-10 border-t border-[var(--glass-border)]">
             <p className="text-xs font-bold text-white uppercase tracking-widest mb-4">Contact</p>
             <p className="text-sm font-medium text-[var(--on-glass-muted)]">
                If you have questions about this Privacy Policy, please contact us at: <a href="mailto:privacy@attenda.app" className="text-[var(--primary-600)] hover:underline">privacy@attenda.app</a>
             </p>
          </div>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}

import Link from 'next/link';
import { MarketingNav, MarketingFooter } from '../page';

export const metadata = { title: 'Privacy Policy — Attenda', description: 'How Attenda collects, uses, and protects your data.' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-[var(--dark-950)] mb-3">{title}</h2>
      <div className="text-[var(--gray-500)] leading-relaxed space-y-3 text-sm">{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingNav />

      {/* Header */}
      <section className="bg-[var(--dark-950)] pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold text-[var(--primary-600)] uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black text-white mb-3">Privacy Policy</h1>
          <p className="text-white/50 text-sm">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
      </section>

      {/* Content */}
      <article className="max-w-3xl mx-auto px-6 py-16">
        <Section title="1. Introduction">
          <p>Attenda (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting the privacy of the organisations and individuals who use our workforce management platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information.</p>
          <p>By using Attenda, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use our services.</p>
        </Section>

        <Section title="2. Information We Collect">
          <p><strong className="text-[var(--dark-950)]">Organisation data:</strong> Company name, timezone, billing plan, and configuration settings you provide during onboarding and setup.</p>
          <p><strong className="text-[var(--dark-950)]">Employee data:</strong> Names, email addresses, phone numbers, job titles, departments, and attendance records — entered by your organisation&apos;s administrators.</p>
          <p><strong className="text-[var(--dark-950)]">Attendance data:</strong> Check-in/check-out timestamps, device IP addresses (for WiFi-based detection), GPS coordinates (mobile app only), and shift adherence metrics.</p>
          <p><strong className="text-[var(--dark-950)]">Usage data:</strong> Log files, page views, feature usage, and performance metrics to improve the platform.</p>
        </Section>

        <Section title="3. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Provide, maintain, and improve the Attenda platform</li>
            <li>Process attendance records and generate reports</li>
            <li>Send notifications (WhatsApp, email, in-app) as configured by your organisation</li>
            <li>Calculate payroll data when payroll integration is enabled</li>
            <li>Detect and prevent fraud or abuse</li>
            <li>Respond to support requests</li>
          </ul>
          <p>We do not sell, rent, or trade your personal information or your employees&apos; data to third parties for marketing purposes.</p>
        </Section>

        <Section title="4. Data Ownership">
          <p>Your organisation owns all employee data you upload or generate within Attenda. We act as a data processor on your behalf. You retain full control and can export or delete your data at any time.</p>
        </Section>

        <Section title="5. Data Retention">
          <p>Attendance records and employee data are retained for as long as your subscription is active, plus 90 days after cancellation to allow for data export. After that period, data is permanently deleted from our servers.</p>
        </Section>

        <Section title="6. Security">
          <p>We implement industry-standard security measures including:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>TLS 1.2+ encryption in transit</li>
            <li>Encrypted database storage at rest</li>
            <li>Role-based access controls</li>
            <li>Two-factor authentication (2FA) support</li>
            <li>Regular security audits</li>
          </ul>
          <p>No method of transmission over the internet is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee absolute security.</p>
        </Section>

        <Section title="7. Third-Party Services">
          <p>Attenda integrates with the following third-party services:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-[var(--dark-950)]">WhatsApp Business API</strong> — for sending attendance notifications (subject to Meta&apos;s Privacy Policy)</li>
            <li><strong className="text-[var(--dark-950)]">Railway / cloud hosting</strong> — for infrastructure</li>
          </ul>
          <p>These providers have their own privacy policies and we recommend reviewing them.</p>
        </Section>

        <Section title="8. Cookies">
          <p>We use essential cookies to maintain your authenticated session (JWT stored as an HTTP-only cookie). We do not use tracking or advertising cookies.</p>
        </Section>

        <Section title="9. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to access, correct, delete, or port your personal data. To exercise these rights, contact us at <a href="mailto:privacy@attenda.app" className="text-[var(--primary-600)] hover:underline">privacy@attenda.app</a>. Administrators can also manage employee data directly within the platform.</p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. We will notify you of any significant changes by email or via an in-app notice at least 30 days before they take effect. Continued use of Attenda after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="11. Contact">
          <p>If you have questions about this Privacy Policy, please contact us:</p>
          <ul className="list-none space-y-1 ml-2">
            <li>Email: <a href="mailto:privacy@attenda.app" className="text-[var(--primary-600)] hover:underline">privacy@attenda.app</a></li>
            <li>Address: Via our <Link href="/contact" className="text-[var(--primary-600)] hover:underline">contact form</Link></li>
          </ul>
        </Section>
      </article>

      <MarketingFooter />
    </div>
  );
}

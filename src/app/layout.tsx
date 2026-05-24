import type { Metadata } from 'next';
import './globals.css';
import { DM_Sans, DM_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from 'react-hot-toast';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-sans' });
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Attenda — Workforce Management',
  description: 'Your team, always accounted for.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '14px',
                borderRadius: '10px',
                border: '1px solid var(--gray-200)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              },
              success: { iconTheme: { primary: 'var(--success-700)', secondary: 'white' } },
              error:   { iconTheme: { primary: 'var(--danger-800)',  secondary: 'white' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}

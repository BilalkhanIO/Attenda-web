'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import AttendaLogo from '@/components/ui/AttendaLogo';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

function SSOCallbackContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { loginWithTokens } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const accessToken  = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const err          = searchParams.get('error');

    if (err) {
      setError(err === 'no_account'
        ? 'No Attenda account found for this Google account. Please contact your HR administrator.'
        : 'Google sign-in failed. Please try again or use email and password.');
      return;
    }

    if (accessToken && refreshToken) {
      try {
        loginWithTokens(accessToken, refreshToken);
        router.replace('/dashboard');
      } catch {
        setError('Failed to complete sign-in. Please try again.');
      }
    } else {
      setError('Sign-in response was incomplete. Please try again.');
    }
  }, [searchParams, loginWithTokens, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--gray-50)] p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="flex justify-center mb-6">
            <AttendaLogo iconSize={40} variant="light" />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-[var(--gray-200)] p-8 space-y-4">
            <div className="w-14 h-14 rounded-full bg-[var(--danger-100)] flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-[var(--danger-800)]" />
            </div>
            <h1 className="text-xl font-bold text-[var(--dark-950)]">Sign-in failed</h1>
            <p className="text-sm text-[var(--gray-500)]">{error}</p>
            <Button className="w-full" onClick={() => router.push('/login')}>Back to Sign In</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-50)]">
      <div className="flex flex-col items-center gap-4">
        <AttendaLogo iconSize={44} variant="light" />
        <div className="w-6 h-6 border-2 border-[var(--primary-600)] border-t-transparent rounded-full animate-spin mt-2" />
        <p className="text-sm text-[var(--gray-500)]">Completing sign-in…</p>
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-50)]">
      <div className="w-8 h-8 border-2 border-[var(--primary-600)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function SSOCallbackPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <SSOCallbackContent />
    </Suspense>
  );
}

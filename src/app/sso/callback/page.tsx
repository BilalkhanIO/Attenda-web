'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { authApi } from '@/lib/api';
import AttendaLogo from '@/components/ui/AttendaLogo';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui';

function SSOCallbackContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { loginWithTokens } = useAuth();
  const [exchangeError, setExchangeError] = useState('');

  const code         = searchParams.get('code');
  const accessToken  = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const errParam     = searchParams.get('error');

  // Errors that depend only on the query string are derived during render;
  // only the async exchange outcome lives in state.
  const paramError = errParam
    ? (errParam === 'no_account'
        ? 'No Attenda account found for this Google account. Please contact your HR administrator.'
        : 'Google sign-in failed. Please try again or use email and password.')
    : (!code && !(accessToken && refreshToken))
      ? 'Sign-in response was incomplete. Please try again.'
      : '';
  const error = paramError || exchangeError;

  useEffect(() => {
    if (errParam || (!code && !(accessToken && refreshToken))) return;

    void (async () => {
      try {
        if (code) {
          // Primary flow: one-time code exchange (Redis-backed)
          const res = await authApi.exchangeSSOCode(code);
          const { access_token, refresh_token } = res.data.data;
          await loginWithTokens(access_token, refresh_token);
        } else if (accessToken && refreshToken) {
          // Fallback: tokens in query string (Redis unavailable during callback)
          await loginWithTokens(accessToken, refreshToken);
        }
        router.replace('/dashboard');
      } catch {
        setExchangeError('Failed to complete sign-in. Please try again.');
      }
    })();
  }, [errParam, code, accessToken, refreshToken, loginWithTokens, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--dark-950)] p-6">
        <div className="w-full max-w-md text-center space-y-4 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[var(--danger-500)]/5 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex justify-center mb-8 relative z-10">
            <AttendaLogo iconSize={44} />
          </div>
          <div className="bg-[var(--glass-05)] backdrop-blur-2xl rounded-[3rem] border border-[var(--glass-border)] p-10 md:p-12 shadow-2xl relative z-10">
            <div className="w-20 h-20 rounded-[2rem] bg-[var(--danger-500)]/20 border border-[var(--danger-500)]/30 flex items-center justify-center mx-auto mb-8">
              <AlertTriangle size={36} className="text-[var(--danger-500)]" />
            </div>
            <h1 className="text-2xl font-black text-white mb-4 tracking-tight">Sign-in failed</h1>
            <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed mb-10">{error}</p>
            <Button className="w-full py-4 text-[11px] font-black uppercase tracking-[0.2em]" onClick={() => router.push('/login')}>Back to Sign In</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--dark-950)] selection:bg-[var(--primary-600)]">
      <div className="flex flex-col items-center gap-6 relative">
        <div className="absolute inset-0 bg-[var(--primary-600)]/10 blur-[60px] rounded-full pointer-events-none" />
        <AttendaLogo iconSize={56} className="relative z-10" />
        <div className="flex flex-col items-center gap-3 relative z-10">
           <div className="w-8 h-8 border-4 border-[var(--primary-600)] border-t-transparent rounded-full animate-spin" />
           <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.3em] mt-2">Authenticating</p>
        </div>
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--dark-950)]">
      <div className="w-10 h-10 border-4 border-[var(--primary-600)] border-t-transparent rounded-full animate-spin" />
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

'use client';
import { useEffect, useState } from 'react';
import React from 'react';
import Link from 'next/link';
import { orgApi } from '@/lib/api';
import { AlertTriangle, Clock, Ban, X } from 'lucide-react';

type SubscriptionStatus = 'trialing' | 'active' | 'inactive' | 'suspended' | 'defaulted';

interface OrgData {
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  plan: string;
}

function daysLeft(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export default function TrialBanner() {
  const [org, setOrg]         = useState<OrgData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    orgApi.getSettings().then(res => {
      setOrg(res.data.data as OrgData);
    }).catch(() => {});
  }, []);

  if (!org || dismissed) return null;

  const status = org.subscription_status;
  const days   = daysLeft(org.trial_ends_at);

  // Don't show anything for healthy active subscriptions
  if (status === 'active') return null;

  // For trialing with plenty of time left (>7 days), don't show
  if (status === 'trialing' && (days === null || days > 7)) return null;

  type Config = { bg: string; border: string; icon: React.ReactElement; text: string; cta: string; ctaHref: string };
  let cfg: Config | null = null;

  if (status === 'trialing' && days !== null && days <= 7 && days > 0) {
    cfg = {
      bg:     'bg-amber-500/10',
      border: 'border-amber-500/20',
      icon:   <Clock size={15} className="text-amber-400 flex-shrink-0" />,
      text:   `Your free trial ends in ${days} day${days !== 1 ? 's' : ''}. Upgrade to keep access.`,
      cta:    'Upgrade Now',
      ctaHref: '/settings',
    };
  } else if (status === 'trialing' && (days === null || days <= 0)) {
    cfg = {
      bg:     'bg-rose-500/10',
      border: 'border-rose-500/20',
      icon:   <AlertTriangle size={15} className="text-rose-400 flex-shrink-0" />,
      text:   'Your free trial has expired. Upgrade to continue using Attenda.',
      cta:    'Upgrade Now',
      ctaHref: '/settings',
    };
  } else if (status === 'inactive') {
    cfg = {
      bg:     'bg-rose-500/10',
      border: 'border-rose-500/20',
      icon:   <AlertTriangle size={15} className="text-rose-400 flex-shrink-0" />,
      text:   'Your subscription is inactive. Please contact support or upgrade your plan to restore access.',
      cta:    'Contact Support',
      ctaHref: '/contact',
    };
  } else if (status === 'suspended') {
    cfg = {
      bg:     'bg-rose-500/10',
      border: 'border-rose-500/20',
      icon:   <Ban size={15} className="text-rose-400 flex-shrink-0" />,
      text:   'Your account has been suspended. Contact support to resolve this.',
      cta:    'Contact Support',
      ctaHref: '/contact',
    };
  } else if (status === 'defaulted') {
    cfg = {
      bg:     'bg-rose-500/10',
      border: 'border-rose-500/20',
      icon:   <AlertTriangle size={15} className="text-rose-400 flex-shrink-0" />,
      text:   'Your account is past due. Please update your payment details to restore full access.',
      cta:    'Contact Support',
      ctaHref: '/contact',
    };
  }

  if (!cfg) return null;

  return (
    <div className={`${cfg.bg} border-b ${cfg.border} px-4 py-2.5 backdrop-blur-md`}>
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        {cfg.icon}
        <p className="flex-1 text-sm font-black text-white uppercase tracking-tight">
          {cfg.text}
        </p>
        <Link href={cfg.ctaHref}
          className="flex-shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all shadow-lg shadow-emerald-500/20">
          {cfg.cta}
        </Link>
        <button onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors" aria-label="Dismiss">
          <X size={14} className="text-white/40" />
        </button>
      </div>
    </div>
  );
}

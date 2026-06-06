'use client';
import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button } from '@/components/ui';
import { analyticsApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { AlertOctagon, RefreshCw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Anomaly {
  user_name: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  date?: string;
  month?: string;
  source?: string;
}

const SEV_STYLE: Record<string, { border: string; badge: { color: string; bg: string } }> = {
  high:   { border: 'border-l-rose-500',   badge: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' } },
  medium: { border: 'border-l-amber-500',  badge: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' } },
  low:    { border: 'border-l-slate-500',  badge: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' } },
};

export default function AIInsightsPage() {
  const [anomalies, setAnomalies]         = useState<Anomaly[]>([]);
  const [payAnomalies, setPayAnomalies]   = useState<Anomaly[]>([]);
  const [loading, setLoading]             = useState(false);
  const [loaded, setLoaded]               = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [attRes, payRes] = await Promise.allSettled([
        analyticsApi.getAnomalies(),
        analyticsApi.getPayrollAnomalies(),
      ]);
      if (attRes.status === 'fulfilled') setAnomalies((attRes.value.data.data || []).map((a: Anomaly) => ({ ...a, source: 'attendance' })));
      if (payRes.status === 'fulfilled') setPayAnomalies((payRes.value.data.data || []).map((a: Anomaly) => ({ ...a, source: 'payroll' })));
      setLoaded(true);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const all = [...anomalies, ...payAnomalies];

  return (
    <DashboardLayout>
      <PageHeader
        title="AI Anomaly Detection"
        subtitle="AI-detected patterns and irregularities in attendance and payroll"
        breadcrumb={[{ label: 'Analytics', href: '/analytics' }, { label: 'AI Insights' }]}
        actions={
          <Button size="sm" icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />} onClick={load} loading={loading}>
            {loaded ? 'Refresh' : 'Run Analysis'}
          </Button>
        }
      />

      {!loaded ? (
        <Card className="glass-card p-12 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <AlertOctagon size={24} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">AI Anomaly Scanner</p>
            <p className="text-xs text-slate-400 mb-4">Click "Run Analysis" to scan attendance and payroll data for irregularities.</p>
          </div>
          <Button icon={<RefreshCw size={13} />} onClick={load} loading={loading}>Run Analysis</Button>
        </Card>
      ) : loading ? (
        <Card className="glass-card p-12 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Scanning data for anomalies…</p>
        </Card>
      ) : all.length === 0 ? (
        <Card className="glass-card p-12 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle size={24} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">No anomalies detected</p>
            <p className="text-xs text-slate-400">Attendance and payroll patterns look normal.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">{all.length} anomalie{all.length !== 1 ? 's' : ''} detected</p>
          {all.map((a, i) => {
            const sev = SEV_STYLE[a.severity] || SEV_STYLE.low;
            return (
              <Card key={i} className={cn('glass-card p-4 border-l-4', sev.border)}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertOctagon size={15} style={{ color: sev.badge.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-white">{a.user_name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider"
                        style={{ color: sev.badge.color, backgroundColor: sev.badge.bg, borderColor: sev.badge.color + '40' }}>
                        {a.severity}
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase">{a.source}</span>
                    </div>
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">{a.type?.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{a.description}</p>
                    {(a.date || a.month) && (
                      <p className="text-xs text-slate-500 mt-2">{a.date ? `Date: ${a.date}` : `Period: ${a.month}`}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

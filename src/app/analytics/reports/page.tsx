'use client';
import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, Badge } from '@/components/ui';
import { analyticsApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Clock, Users, BarChart2, FileText, Download, Sparkles, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const REPORT_TYPES = [
  { id: 'attendance',  label: 'Attendance',  icon: <Clock size={18} /> },
  { id: 'leave',       label: 'Leave',        icon: <Users size={18} /> },
  { id: 'payroll',     label: 'Payroll',      icon: <BarChart2 size={18} /> },
  { id: 'performance', label: 'Performance',  icon: <FileText size={18} /> },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportStart, setReportStart] = useState(format(new Date(), 'yyyy-MM-01'));
  const [reportEnd, setReportEnd]     = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generating, setGenerating]   = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const generate = async () => {
    if (!selectedReport) return;
    setGenerating(true);
    setDownloadUrl(null);
    try {
      // Payroll & performance reports are month-based; attendance & leave use a date range.
      const periodParams = selectedReport === 'payroll' || selectedReport === 'performance'
        ? { month: Number(reportStart.slice(5, 7)), year: Number(reportStart.slice(0, 4)) }
        : { start_date: reportStart, end_date: reportEnd };
      const { data } = await analyticsApi.generateReport(selectedReport, { ...periodParams, format: 'csv' });
      setDownloadUrl(data.data?.download_url || null);
      toast.success('Report ready');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Reports"
        subtitle="Generate and download HR reports"
        breadcrumb={[{ label: 'Analytics', href: '/analytics' }, { label: 'Reports' }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Config panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Report Type</p>
            <div className="space-y-2">
              {REPORT_TYPES.map(rt => (
                <button key={rt.id} onClick={() => { setSelectedReport(rt.id); setDownloadUrl(null); }}
                  className={cn('w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                    selectedReport === rt.id ? 'border-emerald-500/50 bg-emerald-500/10 text-white' : 'border-white/5 hover:border-white/10 hover:bg-white/[0.03] text-slate-400 hover:text-white')}>
                  {rt.icon}
                  <span className="text-sm font-medium">{rt.label}</span>
                  {selectedReport === rt.id && <CheckCircle size={14} className="ml-auto text-emerald-400" />}
                </button>
              ))}
            </div>
          </Card>

          <Card className="glass-card p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Date Range</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="From" type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} />
              <Input label="To" type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
            </div>
          </Card>

          <Button className="w-full" loading={generating} disabled={!selectedReport} onClick={generate}>
            Generate Report
          </Button>
        </div>

        {/* Result panel */}
        <div className="lg:col-span-3">
          <Card className="glass-card h-full min-h-[300px] flex flex-col items-center justify-center">
            {!selectedReport ? (
              <div className="text-center p-8 opacity-50">
                <FileText size={32} className="mx-auto mb-3 text-slate-500" />
                <p className="text-sm font-medium text-slate-400">Select a report type to get started</p>
              </div>
            ) : generating ? (
              <div className="flex flex-col items-center gap-4 p-8">
                <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-400 flex items-center gap-2"><Sparkles size={14} /> Generating…</p>
              </div>
            ) : downloadUrl ? (
              <div className="flex flex-col items-center gap-4 p-8">
                <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <FileText size={24} className="text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white mb-1">Report Ready</p>
                  <p className="text-xs text-slate-400 mb-4">{REPORT_TYPES.find(r => r.id === selectedReport)?.label} · CSV · {reportStart} to {reportEnd}</p>
                  <Button icon={<Download size={14} />} onClick={() => { const a = document.createElement('a'); a.href = downloadUrl!; a.target = '_blank'; a.click(); }}>
                    Download CSV
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-6 w-full space-y-3">
                <p className="text-sm font-semibold text-white mb-4">{REPORT_TYPES.find(r => r.id === selectedReport)?.label}</p>
                <div className="flex justify-between p-3 bg-white/[0.03] rounded-lg border border-white/5">
                  <span className="text-xs text-slate-500">Date range</span>
                  <span className="text-xs font-mono text-slate-300">{reportStart} – {reportEnd}</span>
                </div>
                <div className="flex justify-between p-3 bg-white/[0.03] rounded-lg border border-white/5">
                  <span className="text-xs text-slate-500">Format</span>
                  <span className="text-xs font-semibold text-slate-300">CSV</span>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

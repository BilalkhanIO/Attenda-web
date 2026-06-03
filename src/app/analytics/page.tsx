'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, KPICard, Badge, Skeleton, Input } from '@/components/ui';
import { analyticsApi } from '@/lib/api';
import { formatCurrency, getApiError } from '@/lib/utils';
import type { AnalyticsOverview, AttendanceTrendPoint } from '@/types';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { Users, Clock, BarChart2, Download, RefreshCw, FileText, Sparkles, Send, AlertOctagon, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const REPORT_TYPES = [
  { id: 'attendance',  label: 'Attendance Report',   icon: <Clock size={20} />,     color: 'var(--primary-600)', bg: 'var(--primary-100)'  },
  { id: 'leave',       label: 'Leave Report',         icon: <Users size={20} />,     color: 'var(--success-700)', bg: 'var(--success-100)'  },
  { id: 'payroll',     label: 'Payroll Report',       icon: <BarChart2 size={20} />, color: 'var(--warning-800)', bg: 'var(--warning-100)'  },
  { id: 'performance', label: 'Performance Report',   icon: <FileText size={20} />,  color: 'var(--purple-700)',  bg: 'var(--purple-100)'   },
];

const PIE_COLORS = ['#00C896', '#00E5FF', '#8B5CF6', '#F59E0B', '#EF4444'];

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("p-6 relative overflow-hidden", className)}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[40px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6 relative z-10">{title}</h3>
      <div className="relative z-10">
         {children}
      </div>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [overview, setOverview]     = useState<AnalyticsOverview | null>(null);
  const [trend, setTrend]           = useState<AttendanceTrendPoint[]>([]);
  const [lateData, setLateData]     = useState<{name:string; count:number}[]>([]);
  const [payrollData, setPayrollData] = useState<{month:string; total:number}[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<'overview' | 'reports' | 'ai'>('overview');

  // AI state
  const [chatMessages, setChatMessages] = useState<{role:'user'|'assistant'; text:string}[]>([
    { role: 'assistant', text: "Hi! I'm your HR assistant. Ask me anything about your team — attendance, payroll, leave, or headcount." }
  ]);
  const [chatInput, setChatInput]       = useState('');
  const [chatLoading, setChatLoading]   = useState(false);
  const [anomalies, setAnomalies]       = useState<{user_name:string;type:string;severity:string;description:string;date?:string;month?:string}[]>([]);
  const [payAnomalies, setPayAnomalies] = useState<{user_name:string;type:string;severity:string;description:string;date?:string;month?:string}[]>([]);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Report generator state
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportStart, setReportStart]       = useState(format(new Date(), 'yyyy-MM-01'));
  const [reportEnd, setReportEnd]           = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportFormat, setReportFormat]     = useState<'pdf' | 'csv'>('pdf');
  const [generating, setGenerating]         = useState(false);
  const [reportReady, setReportReady]       = useState(false);
  const [downloadUrl, setDownloadUrl]       = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, trendRes, lateRes, payRes] = await Promise.allSettled([
        analyticsApi.getOverview(),
        analyticsApi.getAttendanceTrend(30),
        analyticsApi.getLateArrivals(),
        analyticsApi.getPayrollCost(),
      ]);
      if (ovRes.status === 'fulfilled')    setOverview(ovRes.value.data.data);
      if (trendRes.status === 'fulfilled') setTrend(trendRes.value.data.data || []);
      if (lateRes.status === 'fulfilled')  setLateData(lateRes.value.data.data || []);
      if (payRes.status === 'fulfilled')   setPayrollData(payRes.value.data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const sendChatMessage = async () => {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatMessages(m => [...m, { role: 'user', text: msg }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const { data } = await analyticsApi.chat(msg);
      setChatMessages(m => [...m, { role: 'assistant', text: data.data?.reply || 'No response.' }]);
    } catch (err) {
      setChatMessages(m => [...m, { role: 'assistant', text: `Error: ${getApiError(err)}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const loadAnomalies = async () => {
    setAnomalyLoading(true);
    try {
      const [attRes, payRes] = await Promise.allSettled([
        analyticsApi.getAnomalies(),
        analyticsApi.getPayrollAnomalies(),
      ]);
      if (attRes.status === 'fulfilled') setAnomalies(attRes.value.data.data?.anomalies || []);
      if (payRes.status === 'fulfilled') setPayAnomalies(payRes.value.data.data?.anomalies || []);
    } finally {
      setAnomalyLoading(false);
    }
  };

  const onGenerateReport = async () => {
    if (!selectedReport) { toast.error('Select a report type'); return; }
    setGenerating(true);
    setReportReady(false);
    setDownloadUrl(null);
    try {
      const { data } = await analyticsApi.generateReport(selectedReport, {
        start_date: reportStart,
        end_date: reportEnd,
        format: reportFormat,
      });
      setDownloadUrl(data.data?.download_url || null);
      setReportReady(true);
      toast.success('Report generated successfully');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setGenerating(false);
    }
  };

  // Pie data from overview
  const pieData = overview ? [
    { name: 'In Office', value: overview.checked_in  },
    { name: 'Remote',    value: overview.remote       },
    { name: 'On Leave',  value: overview.on_leave     },
    { name: 'Absent',    value: overview.absent        },
    { name: 'Checked Out', value: overview.checked_out },
  ].filter(d => d.value > 0) : [];

  return (
    <DashboardLayout>
      <PageHeader
        title="Analytics & Reports"
        subtitle="Workforce insights and data exports"
        actions={
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchAnalytics}>
            Refresh
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 pt-4 pb-0 mb-6 border-b border-[var(--glass-border)] overflow-x-auto bg-[var(--glass-05)] rounded-t-3xl">
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'reports',  label: 'Reports'  },
          { id: 'ai',       label: 'AI Insights' },
        ] as const).map(tab => (
          <button key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'ai' && anomalies.length === 0 && payAnomalies.length === 0) loadAnomalies(); }}
            className={cn(
              "px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2",
              activeTab === tab.id
                ? "text-[var(--primary-600)] border-[var(--primary-600)]"
                : "text-[var(--on-glass-dim)] border-transparent hover:text-white"
            )}
          >
             {tab.id === 'ai' && <Sparkles size={12} className="inline-block mr-2 mb-0.5" />}
             {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI row */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
          ) : overview && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <KPICard title="In Office"   value={overview.checked_in}  icon={<Users size={20} />}   color="var(--success-500)" bg="#10b981" />
              <KPICard title="Checked Out" value={overview.checked_out} icon={<Clock size={20} />}   color="var(--on-glass-muted)" bg="#64748b" />
              <KPICard title="Remote"      value={overview.remote}      icon={<Users size={20} />}   color="var(--secondary)" bg="#00E5FF" />
              <KPICard title="On Leave"    value={overview.on_leave}    icon={<Users size={20} />}   color="var(--primary-600)" bg="#00C896" />
              <KPICard title="Absent"      value={overview.absent}      icon={<BarChart2 size={20} />} color="var(--danger-500)" bg="#ef4444" />
            </div>
          )}

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartCard title="Attendance Rate — Last 30 Days">
                {loading ? <Skeleton className="h-64 rounded-2xl" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trend} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="var(--primary-600)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="var(--primary-600)" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--on-glass-dim)', fontWeight: 700 }} tickFormatter={d => format(new Date(d), 'dd MMM').toUpperCase()} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--on-glass-dim)', fontWeight: 700 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--dark-950)', border: '1px solid var(--glass-border)', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                        itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}
                        labelStyle={{ color: 'var(--on-glass-muted)', marginBottom: '4px', fontSize: '10px', fontWeight: 800 }}
                        formatter={(v: unknown) => [`${v}%`, 'Adherence']}
                      />
                      <Area type="monotone" dataKey="rate" stroke="var(--primary-600)" strokeWidth={3}
                        fill="url(#rateGrad)" dot={{ r: 4, fill: 'var(--primary-600)', strokeWidth: 2, stroke: 'var(--dark-950)' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <ChartCard title="Today's Breakdown">
              {loading ? <Skeleton className="h-64 rounded-2xl" /> : pieData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80}
                        paddingAngle={5} dataKey="value" stroke="none">
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--dark-950)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4">
                     {pieData.map((d, i) => (
                       <div key={d.name} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest">{d.name}</span>
                       </div>
                     ))}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-sm text-[var(--on-glass-dim)] font-black uppercase tracking-widest">No data stream</div>
              )}
            </ChartCard>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Late Arrivals This Month">
              {loading ? <Skeleton className="h-56 rounded-2xl" /> : lateData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={lateData} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--on-glass-dim)', fontWeight: 800 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--on-glass-dim)', fontWeight: 800 }} allowDecimals={false} />
                    <Tooltip
                       contentStyle={{ backgroundColor: 'var(--dark-950)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                       itemStyle={{ fontSize: '11px', fontWeight: 900 }}
                    />
                    <Bar dataKey="count" fill="var(--warning-500)" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-56 flex flex-col items-center justify-center gap-3">
                   <div className="w-12 h-12 rounded-full bg-[var(--success-500)]/10 flex items-center justify-center">
                      <CheckCircle size={24} className="text-[var(--success-500)]" />
                   </div>
                   <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.2em]">Zero Late Arrivals Identified</p>
                </div>
              )}
            </ChartCard>

            <ChartCard title="Monthly Payroll Cost (6 Months)">
              {loading ? <Skeleton className="h-56 rounded-2xl" /> : payrollData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={payrollData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--on-glass-dim)', fontWeight: 800 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--on-glass-dim)', fontWeight: 800 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                       contentStyle={{ backgroundColor: 'var(--dark-950)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}
                       itemStyle={{ fontSize: '11px', fontWeight: 900 }}
                       formatter={(v: unknown) => [formatCurrency(v as number), 'TOTAL COST']}
                    />
                    <Bar dataKey="total" fill="var(--primary-600)" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-[var(--on-glass-dim)] font-black uppercase tracking-widest">No fiscal data identified</div>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── REPORTS TAB ─────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: config */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-[var(--glass-05)]">
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em] mb-6">Report Type</h3>
              <div className="space-y-3">
                {REPORT_TYPES.map(rt => (
                  <button key={rt.id} onClick={() => { setSelectedReport(rt.id); setReportReady(false); setDownloadUrl(null); }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group",
                      selectedReport === rt.id
                        ? "border-[var(--primary-600)] bg-[var(--primary-600)]/10"
                        : "border-[var(--glass-border)] bg-[var(--glass-05)] hover:bg-[var(--glass-10)]"
                    )}>
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                      selectedReport === rt.id ? "bg-[var(--primary-600)] text-white shadow-lg" : "bg-[var(--glass-10)] text-[var(--on-glass-dim)] group-hover:text-white"
                    )}>
                      {rt.icon}
                    </div>
                    <span className={cn("text-[13px] font-black uppercase tracking-tight", selectedReport === rt.id ? "text-white" : "text-[var(--on-glass-muted)]")}>{rt.label}</span>
                    {selectedReport === rt.id && (
                       <div className="ml-auto w-5 h-5 rounded-full bg-[var(--primary-600)] flex items-center justify-center text-white shadow-xl">
                          <CheckCircle size={12} />
                       </div>
                    )}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-6 bg-[var(--glass-05)]">
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em] mb-6">Date Range</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <Input label="From" type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} />
                   <Input label="To" type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest ml-1">Format</label>
                  <div className="flex gap-3">
                    {(['pdf', 'csv'] as const).map(f => (
                      <button key={f} onClick={() => setReportFormat(f)}
                        className={cn(
                          "flex-1 py-3 text-[11px] font-black rounded-xl border transition-all uppercase tracking-widest",
                          reportFormat === f
                            ? "border-[var(--primary-600)] bg-[var(--primary-600)] text-white shadow-xl shadow-[var(--primary-600)]/20"
                            : "border-[var(--glass-border)] bg-[var(--glass-05)] text-[var(--on-glass-dim)] hover:text-white"
                        )}>{f}</button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Button className="w-full py-4 text-[13px] font-black uppercase tracking-[0.2em]" size="lg"
              loading={generating}
              disabled={!selectedReport}
              onClick={onGenerateReport}>
              Generate Report
            </Button>
          </div>

          {/* Right: preview / result */}
          <div className="lg:col-span-3">
            <Card className="h-full min-h-[500px] flex flex-col bg-[var(--dark-950)] border-dashed border-2 border-[var(--glass-border)]">
              {!selectedReport ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-6 opacity-40">
                    <div className="w-20 h-20 rounded-[2rem] bg-[var(--glass-10)] border border-[var(--glass-border)] flex items-center justify-center">
                      <FileText size={32} className="text-[var(--on-glass-dim)]" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white uppercase tracking-widest mb-2">Select a report type</p>
                      <p className="text-xs font-medium text-[var(--on-glass-muted)] uppercase tracking-widest max-w-xs mx-auto">Choose a report type on the left to configure and generate</p>
                    </div>
                </div>
              ) : generating ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-[var(--primary-600)]/20 border-t-[var(--primary-600)] rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                       <Sparkles size={16} className="text-[var(--primary-600)] animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                     <p className="text-[13px] font-black text-white uppercase tracking-[0.3em] animate-pulse">Generating your report…</p>
                     <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">This may take a few seconds</p>
                  </div>
                  <div className="w-64 h-1 bg-[var(--glass-20)] rounded-full overflow-hidden mt-4">
                    <div className="h-full bg-gradient-to-r from-transparent via-[var(--primary-600)] to-transparent w-1/2 animate-[shimmer_2s_infinite]" />
                  </div>
                </div>
              ) : reportReady ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-8 p-12 slide-in-bottom">
                  <div className="w-24 h-24 rounded-[2.5rem] bg-[var(--success-500)]/10 border-2 border-[var(--success-500)]/30 flex items-center justify-center shadow-2xl shadow-[var(--success-500)]/10">
                    <FileText size={40} className="text-[var(--success-500)]" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-black text-white tracking-tight mb-2">Report Ready!</h2>
                    <p className="text-sm font-bold text-[var(--on-glass-dim)] uppercase tracking-[0.2em] mb-10">
                      {REPORT_TYPES.find(r => r.id === selectedReport)?.label} &middot; {reportFormat.toUpperCase()}
                    </p>
                    <Button
                      icon={<Download size={18} />}
                      size="lg"
                      className="px-10 py-5 text-[13px] font-black uppercase tracking-[0.2em]"
                      onClick={() => {
                        if (downloadUrl) {
                          const a = document.createElement('a');
                          a.href = downloadUrl;
                          a.target = '_blank';
                          a.rel = 'noopener noreferrer';
                          a.click();
                        } else {
                          toast.error('Download URL not available');
                        }
                      }}>
                      Download {reportFormat.toUpperCase()}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-8">
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-[var(--glass-border)]">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">{REPORT_TYPES.find(r => r.id === selectedReport)?.label}</h3>
                    <Badge label={reportFormat.toUpperCase()} color="var(--primary-600)" bg="#00C896" size="sm" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-5 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-2xl">
                      <span className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">Date range</span>
                      <span className="text-sm font-black text-white font-mono">{reportStart} &mdash; {reportEnd}</span>
                    </div>
                    <div className="flex justify-between items-center p-5 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-2xl">
                      <span className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">Format</span>
                      <span className="text-sm font-black text-white uppercase tracking-widest">{reportFormat.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ── AI INSIGHTS TAB ──────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* HR Chatbot */}
          <Card className="flex flex-col h-[640px] bg-[var(--glass-05)] border-[var(--glass-border)] overflow-hidden">
            <div className="flex items-center gap-4 p-6 bg-[var(--glass-05)] border-b border-[var(--glass-border)] relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--primary-600)]/10 to-transparent pointer-events-none" />
              <div className="w-12 h-12 rounded-[1.2rem] bg-[var(--primary-600)]/20 border border-[var(--primary-600)]/30 flex items-center justify-center shadow-xl shadow-[var(--primary-600)]/10 relative z-10">
                <Sparkles size={20} className="text-[var(--primary-600)]" />
              </div>
              <div className="relative z-10">
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">HR Assistant</h3>
                <p className="text-[10px] font-bold text-[var(--primary-600)] uppercase tracking-widest mt-0.5">Ask anything about your team</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} slide-in-bottom`}>
                  <div className={cn(
                    "max-w-[85%] px-5 py-4 rounded-[2rem] text-[13px] leading-[1.6] font-medium shadow-2xl transition-all",
                    m.role === 'user'
                      ? "bg-[var(--primary-600)] text-white rounded-br-sm shadow-[var(--primary-600)]/20"
                      : "bg-[var(--glass-10)] text-[var(--on-glass-sub)] border border-[var(--glass-border)] rounded-bl-sm backdrop-blur-xl"
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start slide-in-bottom">
                  <div className="bg-[var(--glass-10)] border border-[var(--glass-border)] px-6 py-4 rounded-[2rem] rounded-bl-sm">
                    <div className="flex gap-1.5 items-center h-4">
                      {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-[var(--primary-600)] rounded-full animate-bounce" style={{animationDelay:`${i*0.2}s`}} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <div className="p-6 bg-[var(--glass-05)] border-t border-[var(--glass-border)] space-y-4">
              <div className="flex gap-3">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                  placeholder="Who's on leave this week?"
                  className="flex-1 bg-[var(--glass-10)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-sm text-white placeholder:text-[var(--on-glass-dim)] outline-none focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 transition-all font-medium"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="w-14 h-14 flex items-center justify-center bg-[var(--primary-600)] text-white rounded-2xl hover:brightness-110 disabled:opacity-30 transition-all shadow-xl shadow-[var(--primary-600)]/20 active:scale-95"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Who's checked in?","Pending leaves?","Current OT load?","Monthly budget?"].map(q => (
                  <button key={q} onClick={() => { setChatInput(q); }}
                    className="text-[9px] font-black px-3 py-1.5 bg-[var(--glass-10)] border border-[var(--glass-border)] text-[var(--on-glass-muted)] rounded-full hover:bg-[var(--glass-20)] hover:text-white uppercase tracking-widest transition-all">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Anomalies */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">AI-Detected Anomalies</h3>
              <button
                onClick={loadAnomalies}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white transition-all active:rotate-180 duration-500"
              >
                <RefreshCw size={16} className={cn(anomalyLoading && "animate-spin")} />
              </button>
            </div>

            {anomalyLoading ? (
              <Card className="p-12 flex flex-col items-center justify-center gap-6 bg-[var(--glass-05)]">
                  <div className="w-12 h-12 border-4 border-[var(--primary-600)]/20 border-t-[var(--primary-600)] rounded-full animate-spin" />
                  <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.3em] animate-pulse">Scanning Data Ecosystem…</p>
              </Card>
            ) : [...anomalies, ...payAnomalies].length === 0 ? (
              <Card className="p-12 text-center bg-[var(--glass-05)]">
                <div className="w-20 h-20 rounded-[2rem] bg-[var(--success-500)]/10 border-2 border-[var(--success-500)]/30 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[var(--success-500)]/10">
                  <AlertOctagon size={32} className="text-[var(--success-500)]" />
                </div>
                <h4 className="text-lg font-black text-white tracking-tight mb-2 uppercase">No anomalies detected</h4>
                <p className="text-xs font-bold text-[var(--on-glass-dim)] uppercase tracking-widest">Attendance and payroll patterns look normal.</p>
              </Card>
            ) : (
              <div className="space-y-4 max-h-[560px] overflow-y-auto custom-scrollbar pr-2">
                {[...anomalies.map(a => ({...a, source:'attendance'})), ...payAnomalies.map(a => ({...a, source:'payroll'}))].map((a, i) => {
                  const isHigh = a.severity === 'high';
                  const isMed  = a.severity === 'medium';
                  const sevColor = isHigh ? ['#ef4444','rgba(239,68,68,0.1)'] : isMed ? ['#f59e0b','rgba(245,158,11,0.1)'] : ['var(--on-glass-muted)','rgba(255,255,255,0.05)'];
                  return (
                    <Card key={i} className={cn("p-5 hover:bg-[var(--glass-05)] transition-all group border-l-4", isHigh ? "border-l-rose-500" : isMed ? "border-l-amber-500" : "border-l-slate-500")}>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[var(--glass-10)]">
                          <AlertOctagon size={18} style={{color: sevColor[0]}} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <p className="text-[13px] font-black text-white uppercase tracking-tight">{a.user_name}</p>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border" style={{color: sevColor[0], backgroundColor: sevColor[1], borderColor: sevColor[0] + '40'}}>{a.severity}</span>
                            <span className="text-[9px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">{a.source}</span>
                          </div>
                          <p className="text-[10px] font-bold text-[var(--primary-600)] uppercase tracking-widest mb-1.5">{a.type?.replace(/_/g, ' ')}</p>
                          <p className="text-sm font-medium text-[var(--on-glass-sub)] leading-relaxed">{a.description}</p>
                          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/5">
                             {'date' in a && a.date && (
                               <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">Occurred &middot; {a.date}</p>
                             )}
                             {'month' in a && a.month && (
                               <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">Period &middot; {a.month}</p>
                             )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

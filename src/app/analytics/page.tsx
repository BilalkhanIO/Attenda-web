'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, KPICard, Badge, Skeleton } from '@/components/ui';
import { analyticsApi } from '@/lib/api';
import { formatCurrency, getApiError } from '@/lib/utils';
import type { AnalyticsOverview, AttendanceTrendPoint } from '@/types';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { Users, Clock, BarChart2, Download, RefreshCw, FileText, Sparkles, Send, AlertOctagon } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const REPORT_TYPES = [
  { id: 'attendance',  label: 'Attendance Report',   icon: <Clock size={20} />,     color: 'var(--primary-600)', bg: 'var(--primary-100)'  },
  { id: 'leave',       label: 'Leave Report',         icon: <Users size={20} />,     color: 'var(--success-700)', bg: 'var(--success-100)'  },
  { id: 'payroll',     label: 'Payroll Report',       icon: <BarChart2 size={20} />, color: 'var(--warning-800)', bg: 'var(--warning-100)'  },
  { id: 'performance', label: 'Performance Report',   icon: <FileText size={20} />,  color: 'var(--purple-700)',  bg: 'var(--purple-100)'   },
];

const PIE_COLORS = ['#f15153','#065F46','#5B21B6','#92400E','#7f1d1d'];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-bold text-[var(--dark-950)] mb-4">{title}</h3>
      {children}
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
  const [anomalies, setAnomalies]       = useState<{user_name:string;type:string;severity:string;description:string;date?:string}[]>([]);
  const [payAnomalies, setPayAnomalies] = useState<{user_name:string;type:string;severity:string;description:string;month?:string}[]>([]);
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
          <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={fetchAnalytics}>
            Refresh
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--gray-200)]">
        {([
          { id: 'overview', label: 'Overview' },
          { id: 'reports',  label: 'Reports'  },
          { id: 'ai',       label: '✦ AI Insights' },
        ] as const).map(tab => (
          <button key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'ai' && anomalies.length === 0 && payAnomalies.length === 0) loadAnomalies(); }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)]'
                : 'text-[var(--gray-500)] hover:text-[var(--dark-950)]'
            }`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI row */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : overview && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <KPICard title="In Office"   value={overview.checked_in}  icon={<Users size={20} />}   color="var(--success-700)" bg="var(--success-100)" />
              <KPICard title="Checked Out" value={overview.checked_out} icon={<Clock size={20} />}   color="var(--gray-500)"    bg="var(--gray-100)"    />
              <KPICard title="Remote"      value={overview.remote}      icon={<Users size={20} />}   color="var(--purple-700)"  bg="var(--purple-100)"  />
              <KPICard title="On Leave"    value={overview.on_leave}    icon={<Users size={20} />}   color="var(--primary-600)" bg="var(--primary-100)" />
              <KPICard title="Absent"      value={overview.absent}      icon={<BarChart2 size={20} />} color="var(--danger-800)" bg="var(--danger-100)"  />
            </div>
          )}

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartCard title="Attendance Rate — Last 30 Days">
                {loading ? <Skeleton className="h-56" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f15153" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#f15153" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => format(new Date(d), 'MMM d')} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v: unknown) => [`${v}%`, 'Attendance Rate']}
                        contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid var(--gray-200)' }} />
                      <Area type="monotone" dataKey="rate" stroke="#f15153" strokeWidth={2}
                        fill="url(#rateGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <ChartCard title="Today's Breakdown">
              {loading ? <Skeleton className="h-56" /> : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid var(--gray-200)' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-[var(--gray-500)]">No data</div>
              )}
            </ChartCard>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Late Arrivals This Month">
              {loading ? <Skeleton className="h-48" /> : lateData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={lateData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid var(--gray-200)' }} />
                    <Bar dataKey="count" fill="var(--warning-500)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-[var(--gray-500)]">No late arrivals 🎉</div>
              )}
            </ChartCard>

            <ChartCard title="Monthly Payroll Cost (6 Months)">
              {loading ? <Skeleton className="h-48" /> : payrollData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={payrollData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: unknown) => [formatCurrency(v as number), 'Payroll Total']}
                      contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid var(--gray-200)' }} />
                    <Bar dataKey="total" fill="var(--primary-600)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-[var(--gray-500)]">No payroll data</div>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── REPORTS TAB ─────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: config */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-bold text-[var(--dark-950)] mb-4">Report Type</h3>
              <div className="space-y-2">
                {REPORT_TYPES.map(rt => (
                  <button key={rt.id} onClick={() => { setSelectedReport(rt.id); setReportReady(false); setDownloadUrl(null); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      selectedReport === rt.id
                        ? 'border-[var(--primary-600)] bg-[var(--primary-100)]'
                        : 'border-[var(--gray-200)] hover:border-[var(--gray-200)] hover:bg-[var(--gray-50)]'
                    }`}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: rt.bg, color: rt.color }}>
                      {rt.icon}
                    </div>
                    <span className="text-sm font-semibold text-[var(--dark-950)]">{rt.label}</span>
                    {selectedReport === rt.id && <span className="ml-auto text-[var(--primary-600)]">✓</span>}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-bold text-[var(--dark-950)] mb-4">Date Range</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--gray-500)] block mb-1">From</label>
                  <input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--gray-500)] block mb-1">To</label>
                  <input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--gray-500)] block mb-1">Format</label>
                  <div className="flex gap-2">
                    {(['pdf', 'csv'] as const).map(f => (
                      <button key={f} onClick={() => setReportFormat(f)}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg border-2 transition-colors uppercase ${
                          reportFormat === f
                            ? 'border-[var(--primary-600)] bg-[var(--primary-600)] text-white'
                            : 'border-[var(--gray-200)] text-[var(--gray-500)] hover:border-[var(--gray-200)]'
                        }`}>{f}</button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Button className="w-full" size="lg"
              loading={generating}
              disabled={!selectedReport}
              onClick={onGenerateReport}>
              Generate Report
            </Button>
          </div>

          {/* Right: preview / result */}
          <div className="lg:col-span-3">
            <Card className="h-full min-h-[400px] flex flex-col">
              {!selectedReport ? (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-[var(--gray-100)] flex items-center justify-center mx-auto mb-3">
                      <FileText size={24} className="text-[var(--gray-500)]" />
                    </div>
                    <p className="text-sm font-semibold text-[var(--dark-950)] mb-1">Select a report type</p>
                    <p className="text-sm text-[var(--gray-500)]">Choose a report type on the left to configure and generate</p>
                  </div>
                </div>
              ) : generating ? (
                <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8">
                  <div className="w-10 h-10 border-[3px] border-[var(--primary-600)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-[var(--dark-950)]">Generating your report…</p>
                  <p className="text-xs text-[var(--gray-500)]">This may take a few seconds</p>
                  {/* Progress bar */}
                  <div className="w-48 h-1.5 bg-[var(--gray-200)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--primary-600)] rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
              ) : reportReady ? (
                <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--success-100)] flex items-center justify-center">
                    <FileText size={24} className="text-[var(--success-700)]" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-[var(--dark-950)] mb-1">Report Ready!</p>
                    <p className="text-sm text-[var(--gray-500)] mb-4">
                      {REPORT_TYPES.find(r => r.id === selectedReport)?.label} — {reportFormat.toUpperCase()}
                    </p>
                    <Button icon={<Download size={14} />} size="lg"
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
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold">{REPORT_TYPES.find(r => r.id === selectedReport)?.label}</h3>
                    <Badge label={reportFormat.toUpperCase()} color="var(--primary-600)" bg="var(--primary-100)" />
                  </div>
                  <div className="text-sm text-[var(--gray-500)] space-y-2">
                    <div className="flex justify-between p-3 bg-[var(--gray-50)] rounded-lg">
                      <span>Date range</span>
                      <span className="font-medium text-[var(--dark-950)]">{reportStart} → {reportEnd}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-[var(--gray-50)] rounded-lg">
                      <span>Format</span>
                      <span className="font-medium text-[var(--dark-950)]">{reportFormat.toUpperCase()}</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* HR Chatbot */}
          <Card className="flex flex-col h-[560px]">
            <div className="flex items-center gap-2 p-5 border-b border-[var(--gray-100)]">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary-100)] flex items-center justify-center">
                <Sparkles size={16} className="text-[var(--primary-600)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--dark-950)]">HR Assistant</h3>
                <p className="text-xs text-[var(--gray-500)]">Ask anything about your team</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[var(--primary-600)] text-white rounded-br-sm'
                      : 'bg-[var(--gray-100)] text-[var(--dark-950)] rounded-bl-sm'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--gray-100)] px-3.5 py-2.5 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1 items-center h-4">
                      {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-[var(--gray-500)] rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
            <div className="p-3 border-t border-[var(--gray-100)]">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                  placeholder="Who's on leave this week?"
                  className="flex-1 px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="w-9 h-9 flex items-center justify-center bg-[var(--primary-600)] text-white rounded-lg hover:bg-[var(--primary-900)] disabled:opacity-40 transition-colors"
                >
                  <Send size={15} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {["Who's checked in?","Pending leaves?","Last month payroll?","Top late arrivals?"].map(q => (
                  <button key={q} onClick={() => { setChatInput(q); }}
                    className="text-xs px-2.5 py-1 bg-[var(--gray-100)] text-[var(--gray-500)] rounded-full hover:bg-[var(--primary-100)] hover:text-[var(--primary-600)] transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Anomalies */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--dark-950)]">AI-Detected Anomalies</h3>
              <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={loadAnomalies} loading={anomalyLoading}>
                Refresh
              </Button>
            </div>

            {anomalyLoading ? (
              <Card className="p-6 flex justify-center">
                <div className="flex flex-col items-center gap-3 text-[var(--gray-500)]">
                  <div className="w-6 h-6 border-2 border-[var(--primary-600)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">Analysing attendance & payroll patterns…</p>
                </div>
              </Card>
            ) : [...anomalies, ...payAnomalies].length === 0 ? (
              <Card className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--success-100)] flex items-center justify-center mx-auto mb-3">
                  <AlertOctagon size={20} className="text-[var(--success-700)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--dark-950)]">No anomalies detected</p>
                <p className="text-xs text-[var(--gray-500)] mt-1">Attendance and payroll patterns look normal.</p>
              </Card>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {[...anomalies.map(a => ({...a, source:'attendance'})), ...payAnomalies.map(a => ({...a, source:'payroll'}))].map((a, i) => {
                  const sevColor = a.severity === 'high' ? ['var(--danger-800)','var(--danger-100)'] : a.severity === 'medium' ? ['var(--warning-800)','var(--warning-100)'] : ['var(--gray-500)','var(--gray-100)'];
                  return (
                    <Card key={i} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor: sevColor[1]}}>
                          <AlertOctagon size={16} style={{color: sevColor[0]}} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-semibold text-[var(--dark-950)]">{a.user_name}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{color: sevColor[0], backgroundColor: sevColor[1]}}>{a.severity}</span>
                            <span className="text-xs text-[var(--gray-500)] capitalize">{a.source}</span>
                          </div>
                          <p className="text-xs text-[var(--gray-500)] capitalize mb-1">{a.type?.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-[var(--dark-950)] leading-snug">{a.description}</p>
                          {'date' in a && a.date && (
                            <p className="text-xs text-[var(--gray-500)] mt-1">{a.date}</p>
                          )}
                          {'month' in a && a.month && (
                            <p className="text-xs text-[var(--gray-500)] mt-1">{a.month}</p>
                          )}
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

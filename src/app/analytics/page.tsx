'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, KPICard, Skeleton } from '@/components/ui';
import { analyticsApi } from '@/lib/api';
import { formatCurrency, getApiError } from '@/lib/utils';
import type { AnalyticsOverview, AttendanceTrendPoint } from '@/types';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Users, Clock, BarChart2, RefreshCw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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
    </DashboardLayout>
  );
}

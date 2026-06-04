'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, ConfirmDialog,
  Input, Select, KPICard, Textarea, EmptyState, Skeleton
} from '@/components/ui';
import { payrollApi } from '@/lib/api';
import { formatCurrency, formatHours, getApiError } from '@/lib/utils';
import type { Payroll, PayrollRecord } from '@/types';
import { Wallet, Download, Play, AlertTriangle, Lock, ChevronDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

const adjustSchema = z.object({
  field:  z.string().min(1, 'Select field to adjust'),
  value:  z.string().min(1, 'Enter new value'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});
type AdjustForm = z.infer<typeof adjustSchema>;

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
});

export default function PayrollPage() {
  const router = useRouter();
  const { hasFeature, hasPermission, capabilitiesLoading } = useAuth();
  const canAccessPayroll = hasFeature('payroll') && hasPermission('payroll.view');

  useEffect(() => {
    if (!capabilitiesLoading && !canAccessPayroll) {
      router.replace('/dashboard');
    }
  }, [capabilitiesLoading, canAccessPayroll, router]);
  const [payroll, setPayroll]       = useState<Payroll | null>(null);
  const [loading, setLoading]       = useState(true);
  const [selectedMonth, setMonth]   = useState(MONTHS[0].value);
  const [adjustRow, setAdjustRow]   = useState<PayrollRecord | null>(null);
  const [processConfirm, setProcess] = useState(false);
  const [processing, setProcessing]  = useState(false);

  const form = useForm<AdjustForm>({ resolver: zodResolver(adjustSchema) });

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const { data } = await payrollApi.getPayrolls();
      // Filter client-side since API returns list
      const found = (data.data || []).find((p: Payroll) => p.year === +year && p.month === +month);
      setPayroll(found || null);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  const onAdjust = async (data: AdjustForm) => {
    if (!adjustRow) return;
    try {
      await payrollApi.adjust(adjustRow.id, {
        field: data.field,
        value: parseFloat(data.value),
        reason: data.reason,
      });
      toast.success('Payroll record adjusted');
      setAdjustRow(null);
      fetchPayroll();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const onProcess = async () => {
    if (!payroll) return;
    setProcessing(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      await payrollApi.processFull(month, year);
      toast.success('Payroll processed — payslips generated and employees notified');
      setProcess(false);
      fetchPayroll();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setProcessing(false);
    }
  };

  const onGenerate = async () => {
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      await payrollApi.generate(month, year);
      toast.success('Payroll generated');
      fetchPayroll();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const onDownloadPayslip = async (recordId: string) => {
    try {
      const { data } = await payrollApi.downloadPayslip(recordId);
      const url = data.data?.url;
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
      } else {
        toast.error('Payslip URL not available');
      }
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const isProcessed = payroll?.status === 'processed';
  const hasErrors   = payroll?.records.some(r => r.is_incomplete);

  // Helper: Prisma Decimal fields come back as strings over JSON — always parse to number
  const n = (v: unknown) => Number(v) || 0;

  const onExportCSV = () => {
    if (!payroll?.records?.length) { toast.error('No payroll data to export'); return; }
    const headers = ['Name','Department','Regular Hrs','Overtime Hrs','Hourly Rate','Adjustments','Gross Pay','Net Pay','Status'];
    const rows = payroll.records.map(r => [
      r.user?.name || '',
      r.user?.department || '',
      n(r.regular_hours).toFixed(1),
      n(r.overtime_hours).toFixed(1),
      n(r.hourly_rate).toFixed(2),
      n(((r as unknown) as Record<string, unknown>).manual_adjustment ?? r.adjustments).toFixed(2),
      n(r.gross_pay).toFixed(2),
      n(r.net_pay).toFixed(2),
      r.is_incomplete ? 'Incomplete' : 'OK',
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `payroll-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const adjustment = (r: PayrollRecord) => n(((r as unknown) as Record<string, unknown>).manual_adjustment ?? r.adjustments);

  const totalGross     = payroll?.records.reduce((s, r) => s + n(r.gross_pay), 0) ?? 0;
  const totalOT        = payroll?.records.reduce((s, r) => s + n(r.overtime_hours), 0) ?? 0;
  const totalDeductions= payroll?.records.reduce((s, r) => s + Math.abs(adjustment(r)), 0) ?? 0;

  const statusBadge = (s: string) => {
    const map: Record<string, [string, string]> = {
      draft:      ['var(--warning-500)', '#f59e0b'],
      reviewing:  ['var(--primary-600)', '#00C896'],
      processed:  ['var(--success-500)', '#10b981'],
    };
    const [c, b] = map[s] || map.draft;
    return <Badge label={s.toUpperCase()} color={c} bg={b} size="sm" />;
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Payroll"
        subtitle="Review, adjust and process monthly payroll"
        actions={
          <div className="flex items-center gap-3 bg-[var(--glass-10)] p-1.5 pl-4 rounded-2xl border border-[var(--glass-border)] shadow-xl backdrop-blur-md">
            <select value={selectedMonth} onChange={e => setMonth(e.target.value)}
              className="bg-transparent text-[11px] font-black text-white uppercase tracking-widest outline-none cursor-pointer pr-2">
              {MONTHS.map(m => <option key={m.value} value={m.value} className="bg-[var(--dark-950)]">{m.label.toUpperCase()}</option>)}
            </select>
            <div className="h-6 w-px bg-[var(--glass-border)]" />
            {hasPermission('payroll.manage') && (
              <Button variant="ghost" size="sm" className="h-9 py-0 border-none bg-transparent hover:bg-[var(--glass-15)]" icon={<Download size={14} />} onClick={onExportCSV}>Export CSV</Button>
            )}
            {hasPermission('payroll.process') && !isProcessed && payroll && (
              <Button size="sm" className="h-9 py-0 px-4" icon={<Play size={14} />}
                onClick={() => setProcess(true)}
                disabled={hasErrors}>
                Process Payroll
              </Button>
            )}
            {isProcessed && (
              <div className="flex items-center gap-2 px-3 h-9 bg-[var(--success-500)]/10 text-[var(--success-500)] rounded-xl text-[11px] font-black uppercase tracking-widest border border-[var(--success-500)]/20">
                <Lock size={12} /> Processed
              </div>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : payroll ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard title="Total Gross Pay"   value={formatCurrency(totalGross)}    icon={<Wallet size={20} />}       color="var(--success-500)" bg="#10b981" />
            <KPICard title="Employees"         value={payroll.records.length}        icon={<Wallet size={20} />}       color="var(--primary-600)" bg="#00C896" />
            <KPICard title="Overtime Hours"    value={`${totalOT.toFixed(1)}h`}      icon={<AlertTriangle size={20} />} color="var(--warning-500)" bg="#f59e0b" />
            <KPICard title="Total Deductions"  value={formatCurrency(totalDeductions)} icon={<Download size={20} />}  color="var(--danger-500)"  bg="#ef4444"  />
          </div>

          {/* Status banner */}
          {hasErrors && (
            <div className="flex items-center gap-4 mb-6 p-5 rounded-[2rem] bg-[var(--danger-500)]/10 border border-[var(--danger-500)]/20 text-[var(--danger-500)] slide-in-bottom shadow-2xl shadow-[var(--danger-500)]/10">
              <div className="w-10 h-10 rounded-xl bg-[var(--danger-500)]/20 flex items-center justify-center flex-shrink-0">
                 <AlertTriangle size={20} />
              </div>
              <p className="text-sm font-bold uppercase tracking-tight">
                Some employees have missing hourly rates. Fix them before processing payroll.
              </p>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 bg-[var(--glass-05)] border-b border-[var(--glass-border)]">
              <h3 className="text-[13px] font-black text-white uppercase tracking-widest">
                {format(new Date(selectedMonth + '-01'), 'MMMM yyyy').toUpperCase()} Payroll
              </h3>
              {statusBadge(payroll.status)}
            </div>
            <Table
              headers={['Employee', 'Regular Hrs', 'Overtime Hrs', 'Base Pay', 'Overtime Pay', 'Adjustments', 'Gross Pay', 'Actions']}
            >
              {payroll.records.map(rec => (
                <tr key={rec.id} className={cn(
                  "hover:bg-[var(--glass-05)] transition-all group",
                  rec.is_incomplete ? "bg-[var(--danger-500)]/5" : ""
                )}>
                  <td className="py-4 px-6">
                    {rec.user ? (
                      <div className="flex items-center gap-4">
                        <Avatar name={rec.user.name} size="md" />
                        <div className="min-w-0">
                          <p className="text-[15px] font-black text-white group-hover:text-[var(--primary-600)] transition-colors truncate">{rec.user.name}</p>
                          <p className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest truncate">{rec.user.department || 'Operations'}</p>
                          {rec.is_incomplete && (
                            <p className="text-[9px] text-[var(--danger-500)] font-black uppercase tracking-widest mt-1">MISSING RATE</p>
                          )}
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="py-4 px-6 text-sm font-black text-white font-mono">{formatHours(n(rec.regular_hours))}</td>
                  <td className="py-4 px-6">
                    <span className={cn(
                      "text-sm font-black font-mono",
                      n(rec.overtime_hours) > 0 ? "text-[var(--warning-500)]" : "text-[var(--on-glass-dim)]"
                    )}>
                      {n(rec.overtime_hours) > 0 ? formatHours(n(rec.overtime_hours)) : '—'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm font-black text-white/50 font-mono">{formatCurrency(n(rec.regular_hours) * n(rec.hourly_rate))}</td>
                  <td className="py-4 px-6 text-sm font-black text-white/50 font-mono">
                    {n(rec.overtime_hours) > 0 ? formatCurrency(n(rec.overtime_hours) * n(rec.hourly_rate) * 1.5) : '—'}
                  </td>
                  <td className="py-4 px-6">
                    {(() => { const adj = adjustment(rec); return (
                      <span className={cn(
                        "text-sm font-black font-mono",
                        adj < 0 ? "text-[var(--danger-500)]" : adj > 0 ? "text-[var(--success-500)]" : "text-[var(--on-glass-dim)]"
                      )}>
                        {adj !== 0 ? formatCurrency(adj) : '—'}
                      </span>
                    ); })()}
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-[15px] font-black text-[var(--primary-600)]">{formatCurrency(n(rec.gross_pay))}</span>
                  </td>
                  <td className="py-4 px-6">
                    {!isProcessed && hasPermission('payroll.manage') ? (
                      <button
                        onClick={() => { form.reset(); setAdjustRow(rec); }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white hover:bg-[var(--glass-15)] transition-all"
                      >
                         <ChevronDown size={18} />
                      </button>
                    ) : isProcessed ? (
                      <Button variant="outline" size="sm" icon={<Download size={12} />}
                        onClick={() => onDownloadPayslip(rec.id)}>PAYSLIP</Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<Wallet size={24} />}
            title="No payroll generated for this period"
            description="Operational payroll is generated automatically at the end of each month."
            action={hasPermission('payroll.manage') ? <Button icon={<Play size={14} />} onClick={onGenerate}>GENERATE NOW</Button> : undefined}
          />
        </Card>
      )}

      {/* Adjust modal */}
      <Modal isOpen={!!adjustRow} onClose={() => setAdjustRow(null)}
        title="Adjust Payroll Record" size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjustRow(null)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onAdjust)} loading={form.formState.isSubmitting}>Save Adjustment</Button>
          </>
        }
      >
        {adjustRow && (
          <div className="space-y-6">
            {adjustRow.user && (
              <div className="flex items-center gap-4 p-5 rounded-[2rem] bg-[var(--glass-05)] border border-[var(--glass-border)]">
                <Avatar name={adjustRow.user.name} size="md" />
                <div>
                  <p className="text-lg font-black text-white tracking-tight">{adjustRow.user.name}</p>
                  <p className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest">Current Gross: {formatCurrency(adjustRow.gross_pay)}</p>
                </div>
              </div>
            )}
            <Select label="Field to Adjust" required
              placeholder="Select field..."
              options={[
                { value: 'regular_hours',  label: 'Regular Hours' },
                { value: 'overtime_hours', label: 'Overtime Hours' },
                { value: 'adjustments',    label: 'Adjustment Amount' },
              ]}
              error={form.formState.errors.field?.message}
              {...form.register('field')}
            />
            <Input label="New Value" type="number" required placeholder="Enter corrected value"
              error={form.formState.errors.value?.message}
              {...form.register('value')}
            />
            <Textarea label="Reason for Adjustment" required
              placeholder="Explain why this adjustment was made (min 10 characters)..."
              error={form.formState.errors.reason?.message}
              {...form.register('reason')}
            />
            <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest leading-relaxed">
              This adjustment will be logged with your name and timestamp for audit purposes.
            </p>
          </div>
        )}
      </Modal>

      {/* Process payroll confirm */}
      <ConfirmDialog
        isOpen={processConfirm}
        onClose={() => setProcess(false)}
        onConfirm={onProcess}
        loading={processing}
        title="Process Payroll"
        message={`This will generate payslips for ${payroll?.records.length || 0} employees and notify them via WhatsApp. This action cannot be undone — the payroll will be locked.`}
        confirmLabel="Process & Generate Payslips"
        variant="primary"
      />
    </DashboardLayout>
  );
}

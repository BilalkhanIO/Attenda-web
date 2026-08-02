'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, ConfirmDialog,
  Input, KPICard, Textarea, EmptyState, Skeleton, Dropdown,
  type DropdownOption,
} from '@/components/ui';
import { payrollApi } from '@/lib/api';
import { formatCurrency, formatHours, getApiError, runDeferred } from '@/lib/utils';
import type { Payroll, PayrollRecord } from '@/types';
import { Wallet, Download, Play, AlertTriangle, Lock, ChevronDown } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format, subMonths } from 'date-fns';
import { formatDate as intlFormatDate, formatNumber, LOCAL_TZ } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const adjustSchema = z.object({
  field:  z.string().min(1, 'Select field to adjust'),
  value:  z.string().min(1, 'Enter new value'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});
type AdjustForm = z.infer<typeof adjustSchema>;

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, 'yyyy-MM'), label: intlFormatDate(d, { month: 'long', year: 'numeric', timeZone: LOCAL_TZ }) };
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

  useEffect(() => runDeferred(fetchPayroll), [fetchPayroll]);

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
            <Dropdown
              value={selectedMonth}
              onChange={setMonth}
              options={MONTHS.map(m => ({ value: m.value, label: m.label.toUpperCase() } as DropdownOption))}
              className="min-w-[9rem]"
            />
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : payroll ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <KPICard title="Total Gross Pay"   value={formatCurrency(totalGross)}    icon={<Wallet size={16} />}       color="var(--success-500)" bg="#10b981" />
            <KPICard title="Employees"         value={payroll.records.length}        icon={<Wallet size={16} />}       color="var(--primary-600)" bg="#00C896" />
            <KPICard title="Overtime Hours"    value={`${formatNumber(totalOT, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`} icon={<AlertTriangle size={16} />} color="var(--warning-500)" bg="#f59e0b" />
            <KPICard title="Total Deductions"  value={formatCurrency(totalDeductions)} icon={<Download size={16} />}  color="var(--danger-500)"  bg="#ef4444"  />
          </div>

          {/* Status banner */}
          {hasErrors && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-(--danger-500)/10 border border-(--danger-500)/20 text-(--danger-500) slide-in-bottom">
              <AlertTriangle size={16} className="shrink-0" />
              <p className="text-xs font-bold uppercase tracking-tight">
                Some employees have missing hourly rates. Fix them before processing payroll.
              </p>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-(--glass-05) border-b border-(--glass-border)">
              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">
                {intlFormatDate(new Date(selectedMonth + '-01'), { month: 'long', year: 'numeric', timeZone: LOCAL_TZ }).toUpperCase()} Payroll
              </h3>
              {statusBadge(payroll.status)}
            </div>
            <Table
              headers={['Employee', 'Regular Hrs', 'Overtime Hrs', 'Base Pay', 'OT Pay', 'Adj', 'Gross', '']}
            >
              {payroll.records.map(rec => (
                <tr key={rec.id} className={cn(
                  "hover:bg-(--glass-05) transition-all group",
                  rec.is_incomplete ? "bg-(--danger-500)/5" : ""
                )}>
                  <td className="py-3 px-4">
                    {rec.user ? (
                      <div className="flex items-center gap-3">
                        <Avatar name={rec.user.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white group-hover:text-(--primary-600) transition-colors truncate">{rec.user.name}</p>
                          <p className="text-[10px] font-bold text-(--on-glass-muted) uppercase tracking-widest truncate">{rec.user.department || 'Operations'}</p>
                          {rec.is_incomplete && (
                            <p className="text-[9px] text-(--danger-500) font-black uppercase tracking-widest mt-0.5">MISSING RATE</p>
                          )}
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-4 text-xs font-black text-white font-mono">{formatHours(n(rec.regular_hours))}</td>
                  <td className="py-3 px-4">
                    <span className={cn(
                      "text-xs font-black font-mono",
                      n(rec.overtime_hours) > 0 ? "text-(--warning-500)" : "text-(--on-glass-dim)"
                    )}>
                      {n(rec.overtime_hours) > 0 ? formatHours(n(rec.overtime_hours)) : '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-black text-white/50 font-mono">{formatCurrency(n(rec.regular_hours) * n(rec.hourly_rate))}</td>
                  <td className="py-3 px-4 text-xs font-black text-white/50 font-mono">
                    {n(rec.overtime_hours) > 0 ? formatCurrency(n(rec.overtime_hours) * n(rec.hourly_rate) * 1.5) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    {(() => { const adj = adjustment(rec); return (
                      <span className={cn(
                        "text-xs font-black font-mono",
                        adj < 0 ? "text-(--danger-500)" : adj > 0 ? "text-(--success-500)" : "text-(--on-glass-dim)"
                      )}>
                        {adj !== 0 ? formatCurrency(adj) : '—'}
                      </span>
                    ); })()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-black text-(--primary-600)">{formatCurrency(n(rec.gross_pay))}</span>
                  </td>
                  <td className="py-3 px-4">
                    {!isProcessed && hasPermission('payroll.manage') ? (
                      <button
                        onClick={() => { form.reset(); setAdjustRow(rec); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-(--glass-10) text-(--on-glass-dim) hover:text-white hover:bg-(--glass-15) transition-all"
                      >
                         <ChevronDown size={14} />
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
        title="Adjust Payroll Record" size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAdjustRow(null)}>Cancel</Button>
            <Button size="sm" onClick={form.handleSubmit(onAdjust)} loading={form.formState.isSubmitting}>Save Adjustment</Button>
          </>
        }
      >
        {adjustRow && (
          <div className="space-y-4">
            {adjustRow.user && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-(--glass-05) border border-(--glass-border)">
                <Avatar name={adjustRow.user.name} size="sm" />
                <div>
                  <p className="text-sm font-black text-white tracking-tight">{adjustRow.user.name}</p>
                  <p className="label-xs mt-0.5">Current Gross: {formatCurrency(adjustRow.gross_pay)}</p>
                </div>
              </div>
            )}
            <Controller control={form.control} name="field"
              render={({ field }) => (
                <Dropdown label="Field to Adjust" required
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Select field..."
                  options={[
                    { value: 'regular_hours',  label: 'Regular Hours' },
                    { value: 'overtime_hours', label: 'Overtime Hours' },
                    { value: 'adjustments',    label: 'Adjustment Amount' },
                  ]}
                  error={form.formState.errors.field?.message}
                />
              )}
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
            <p className="label-xs leading-relaxed">
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

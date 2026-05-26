'use client';
import { useState, useEffect, useCallback } from 'react';
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

  const onExportCSV = () => {
    if (!payroll?.records?.length) { toast.error('No payroll data to export'); return; }
    const headers = ['Name','Department','Gross Pay','Tax','Pension','Adjustments','Net Pay','Hours Worked','Overtime Hours','Status'];
    const rows = payroll.records.map(r => [
      r.user?.name || '',
      r.user?.department || '',
      r.gross_pay.toFixed(2),
      r.tax.toFixed(2),
      r.pension.toFixed(2),
      r.adjustments.toFixed(2),
      r.net_pay.toFixed(2),
      r.hours_worked.toFixed(1),
      r.overtime_hours.toFixed(1),
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

  const totalGross     = payroll?.records.reduce((s, r) => s + r.gross_pay, 0) || 0;
  const totalOT        = payroll?.records.reduce((s, r) => s + r.overtime_hours, 0) || 0;
  const totalDeductions= payroll?.records.reduce((s, r) => s + Math.abs(r.adjustments), 0) || 0;

  const statusBadge = (s: string) => {
    const map: Record<string, [string, string]> = {
      draft:      ['var(--warning-800)', 'var(--warning-100)'],
      reviewing:  ['var(--primary-600)', 'var(--primary-100)'],
      processed:  ['var(--success-700)', 'var(--success-100)'],
    };
    const [c, b] = map[s] || map.draft;
    return <Badge label={s.charAt(0).toUpperCase() + s.slice(1)} color={c} bg={b} />;
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Payroll"
        subtitle="Review, adjust and process monthly payroll"
        actions={
          <div className="flex items-center gap-3">
            <select value={selectedMonth} onChange={e => setMonth(e.target.value)}
              className="px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]">
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={onExportCSV}>Export CSV</Button>
            {!isProcessed && payroll && (
              <Button size="sm" icon={<Play size={14} />}
                onClick={() => setProcess(true)}
                disabled={hasErrors}>
                Process Payroll
              </Button>
            )}
            {isProcessed && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--success-100)] text-[var(--success-700)] rounded-lg text-sm font-semibold">
                <Lock size={14} /> Processed
              </div>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : payroll ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard title="Total Gross Pay"   value={formatCurrency(totalGross)}    icon={<Wallet size={20} />}       color="var(--success-700)" bg="var(--success-100)" />
            <KPICard title="Employees"         value={payroll.records.length}        icon={<Wallet size={20} />}       color="var(--primary-600)" bg="var(--primary-100)" />
            <KPICard title="Overtime Hours"    value={`${totalOT.toFixed(1)}h`}      icon={<AlertTriangle size={20} />} color="var(--warning-800)" bg="var(--warning-100)" />
            <KPICard title="Total Deductions"  value={formatCurrency(totalDeductions)} icon={<Download size={20} />}  color="var(--danger-800)"  bg="var(--danger-100)"  />
          </div>

          {/* Status banner */}
          {hasErrors && (
            <div className="flex items-center gap-3 mb-4 p-4 rounded-xl bg-[var(--danger-100)] text-[var(--danger-800)]">
              <AlertTriangle size={18} />
              <p className="text-sm font-semibold">
                Some employees have missing hourly rates. Fix them before processing payroll.
              </p>
            </div>
          )}

          <Card>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gray-100)]">
              <h3 className="text-sm font-bold text-[var(--dark-950)]">
                {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')} Payroll
              </h3>
              {statusBadge(payroll.status)}
            </div>
            <Table
              headers={['Employee', 'Regular Hrs', 'Overtime Hrs', 'Base Pay', 'Overtime Pay', 'Adjustments', 'Gross Pay', '']}
            >
              {payroll.records.map(rec => (
                <tr key={rec.id} className={`border-b border-[var(--gray-100)] transition-colors ${rec.is_incomplete ? 'bg-[var(--danger-100)]' : 'hover:bg-[var(--gray-50)]'}`}>
                  <td className="py-3 px-4">
                    {rec.user ? (
                      <div className="flex items-center gap-3">
                        <Avatar name={rec.user.name} size="sm" />
                        <div>
                          <p className="text-sm font-semibold">{rec.user.name}</p>
                          <p className="text-xs text-[var(--gray-500)]">{rec.user.department}</p>
                          {rec.is_incomplete && (
                            <p className="text-xs text-[var(--danger-800)] font-semibold">Missing rate</p>
                          )}
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-4 text-sm font-mono">{formatHours(rec.regular_hours)}</td>
                  <td className="py-3 px-4">
                    <span className={`text-sm font-mono ${rec.overtime_hours > 0 ? 'text-[var(--warning-800)] font-semibold' : 'text-[var(--gray-500)]'}`}>
                      {rec.overtime_hours > 0 ? formatHours(rec.overtime_hours) : '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm font-mono">{formatCurrency(rec.regular_hours * rec.hourly_rate)}</td>
                  <td className="py-3 px-4 text-sm font-mono">
                    {rec.overtime_hours > 0 ? formatCurrency(rec.overtime_hours * rec.hourly_rate * 1.5) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-sm font-mono ${rec.adjustments < 0 ? 'text-[var(--danger-800)]' : rec.adjustments > 0 ? 'text-[var(--success-700)]' : 'text-[var(--gray-500)]'}`}>
                      {rec.adjustments !== 0 ? formatCurrency(rec.adjustments) : '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-bold text-[var(--dark-950)]">{formatCurrency(rec.gross_pay)}</span>
                  </td>
                  <td className="py-3 px-4">
                    {!isProcessed ? (
                      <Button variant="ghost" size="sm" onClick={() => { form.reset(); setAdjustRow(rec); }}>
                        Adjust
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" icon={<Download size={12} />}
                        onClick={() => onDownloadPayslip(rec.id)}>Payslip</Button>
                    )}
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
            title="No payroll for this period"
            description="Payroll is generated automatically at the end of each month. You can also trigger it manually."
            action={<Button icon={<Play size={14} />} onClick={onGenerate}>Generate Payroll</Button>}
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
          <div className="space-y-4">
            {adjustRow.user && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gray-50)]">
                <Avatar name={adjustRow.user.name} size="sm" />
                <div>
                  <p className="text-sm font-bold">{adjustRow.user.name}</p>
                  <p className="text-xs text-[var(--gray-500)]">Current gross: {formatCurrency(adjustRow.gross_pay)}</p>
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
            <p className="text-xs text-[var(--gray-500)]">
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

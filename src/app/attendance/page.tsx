'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, Input, Textarea,
  EmptyState
} from '@/components/ui';
import { attendanceApi } from '@/lib/api';
import { statusConfig, formatTime, formatDate, getApiError } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';
import { Clock, Edit2, Download, Calendar } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const overrideSchema = z.object({
  check_in_at:  z.string().optional(),
  check_out_at: z.string().optional(),
  reason:       z.string().min(5, 'Please provide a reason (min 5 characters)'),
});
type OverrideForm = z.infer<typeof overrideSchema>;

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideRecord, setOverrideRecord] = useState<AttendanceRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('');

  const form = useForm<OverrideForm>({ resolver: zodResolver(overrideSchema) });

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await attendanceApi.getToday();
      setRecords(data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const openOverride = (record: AttendanceRecord) => {
    form.reset({
      check_in_at:  record.check_in_at ? format(new Date(record.check_in_at), "yyyy-MM-dd'T'HH:mm") : '',
      check_out_at: record.check_out_at ? format(new Date(record.check_out_at), "yyyy-MM-dd'T'HH:mm") : '',
      reason: '',
    });
    setOverrideRecord(record);
  };

  const onOverride = async (data: OverrideForm) => {
    if (!overrideRecord) return;
    try {
      await attendanceApi.override(overrideRecord.id, {
        check_in_at:  data.check_in_at || undefined,
        check_out_at: data.check_out_at || undefined,
        reason:       data.reason,
      });
      toast.success('Attendance record updated');
      setOverrideRecord(null);
      fetchAttendance();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const filtered = records.filter(r => !statusFilter || r.status === statusFilter);

  const typeLabel: Record<string, string> = {
    auto_ip: 'Auto (IP)',
    qr:      'QR Scan',
    manual:  'Manual',
    remote:  'Remote',
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Attendance"
        subtitle="Track and manage daily attendance records"
        actions={
          <Button variant="outline" size="sm" icon={<Download size={14} />}>Export CSV</Button>
        }
      />

      <Card>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 p-5 border-b border-[var(--gray-100)]">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[var(--gray-500)]" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none"
          >
            <option value="">All Statuses</option>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <span className="text-sm text-[var(--gray-500)] ml-auto">{filtered.length} records</span>
        </div>

        <Table
          headers={['Employee', 'Status', 'Check In', 'Check Out', 'Hours', 'Type', 'Actions']}
          loading={loading}
          emptyState={
            <EmptyState
              icon={<Clock size={24} />}
              title="No attendance records"
              description="No records found for the selected date and filters."
            />
          }
        >
          {filtered.map((record) => {
            const user = record.user;
            const cfg  = statusConfig[record.status];
            return (
              <tr key={record.id} className="border-b border-[var(--gray-100)] hover:bg-[var(--gray-50)] transition-colors">
                <td className="py-3 px-4">
                  {user ? (
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} imageUrl={user.avatar_url} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--dark-950)]">{user.name}</p>
                        <p className="text-xs text-[var(--gray-500)]">{user.department}</p>
                      </div>
                    </div>
                  ) : <span className="text-xs text-[var(--gray-500)]">—</span>}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} />
                    {record.is_overridden && (
                      <span className="text-xs text-[var(--primary-600)] font-medium">edited</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-mono text-[var(--dark-950)]">
                    {record.check_in_at ? formatTime(record.check_in_at) : '—'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-mono text-[var(--dark-950)]">
                    {record.check_out_at ? formatTime(record.check_out_at) : '—'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-[var(--gray-500)]">
                    {record.hours_worked ? `${record.hours_worked.toFixed(1)}h` : '—'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs text-[var(--gray-500)]">{typeLabel[record.type] || record.type}</span>
                </td>
                <td className="py-3 px-4">
                  <Button variant="ghost" size="sm" icon={<Edit2 size={12} />} onClick={() => openOverride(record)}>
                    Override
                  </Button>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {/* Override Modal */}
      <Modal
        isOpen={!!overrideRecord}
        onClose={() => setOverrideRecord(null)}
        title="Override Attendance"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOverrideRecord(null)}>Cancel</Button>
            <Button onClick={form.handleSubmit(onOverride)} loading={form.formState.isSubmitting}>
              Save Override
            </Button>
          </>
        }
      >
        {overrideRecord && (
          <div className="space-y-4">
            {overrideRecord.user && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gray-50)]">
                <Avatar name={overrideRecord.user.name} size="sm" />
                <div>
                  <p className="text-sm font-semibold">{overrideRecord.user.name}</p>
                  <p className="text-xs text-[var(--gray-500)]">{formatDate(overrideRecord.date)}</p>
                </div>
                <Badge label={statusConfig[overrideRecord.status].label} color={statusConfig[overrideRecord.status].color} bg={statusConfig[overrideRecord.status].bg} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Check In Time"
                type="datetime-local"
                error={form.formState.errors.check_in_at?.message}
                {...form.register('check_in_at')}
              />
              <Input
                label="Check Out Time"
                type="datetime-local"
                error={form.formState.errors.check_out_at?.message}
                {...form.register('check_out_at')}
              />
            </div>
            <Textarea
              label="Reason for Override"
              required
              placeholder="Explain why you are overriding this record..."
              error={form.formState.errors.reason?.message}
              {...form.register('reason')}
            />
            <p className="text-xs text-[var(--gray-500)]">
              This action will be logged with your name and timestamp for audit purposes.
            </p>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

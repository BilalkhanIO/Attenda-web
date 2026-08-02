'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Input, Textarea, Dropdown, DateTimePicker,
  Modal, Avatar, Skeleton, EmptyState,
} from '@/components/ui';
import { announcementsApi, departmentsApi, type DepartmentNode } from '@/lib/api';
import {
  keys, announcementsQuery, announcementReceiptsQuery, type Announcement,
} from '@/lib/queries';
import { cn, formatDateTime, getApiError } from '@/lib/utils';
import { toISODate } from '@/lib/i18n';
import { Send, CheckCircle2, Clock3, Megaphone, Users } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────

interface DeptOption { value: string; label: string }

function flattenDeptTree(nodes: DepartmentNode[], depth = 0): DeptOption[] {
  return nodes.flatMap(n => [
    { value: n.id, label: `${'— '.repeat(depth)}${n.name}` },
    ...flattenDeptTree(n.children ?? [], depth + 1),
  ]);
}

/** DateTimePicker value ('yyyy-MM-dd HH:MM', local time) → ISO string. */
function localToIso(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v.replace(' ', 'T'));
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

interface SendResult {
  scheduled: boolean;
  count: number;
  audienceLabel: string;
  scheduledFor?: string; // ISO
}

// ─── Receipts modal ───────────────────────────────────

function ReceiptsModal({ announcement, onClose }: { announcement: Announcement; onClose: () => void }) {
  const receiptsQ = useQuery(announcementReceiptsQuery(announcement.id));
  const receipts = receiptsQ.data;

  return (
    <Modal isOpen onClose={onClose} title="Read Receipts" size="md"
      footer={<Button size="sm" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        <div className="panel">
          <p className="text-sm font-bold text-white">{announcement.title}</p>
          {announcement.published_at && (
            <p className="text-[11px] text-[var(--on-glass-muted)] mt-0.5">
              Sent {formatDateTime(announcement.published_at)}
            </p>
          )}
        </div>

        {receiptsQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : !receipts ? (
          <p className="text-xs text-[var(--on-glass-muted)] text-center py-4">Could not load read stats.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Users size={14} className="text-[var(--primary-600)]" />
              Read by {receipts.read_count} of {receipts.audience_count}
            </div>
            {receipts.readers.length === 0 ? (
              <p className="text-xs text-[var(--on-glass-muted)]">No one has read this announcement yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {receipts.readers.map(r => (
                  <div key={r.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-05)] px-3 py-2">
                    <Avatar name={r.name} imageUrl={r.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{r.name}</p>
                      {r.department && <p className="text-[10px] text-[var(--on-glass-dim)] truncate">{r.department}</p>}
                    </div>
                    <span className="text-[10px] text-[var(--on-glass-muted)] shrink-0">{formatDateTime(r.read_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────

export default function OrgAnnouncementsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(''); // 'yyyy-MM-dd HH:MM' local
  const [result, setResult] = useState<SendResult | null>(null);
  const [receiptsFor, setReceiptsFor] = useState<Announcement | null>(null);

  const deptTreeQ = useQuery({
    queryKey: [...keys.org.all, 'departments-tree'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DepartmentNode[]> =>
      (await departmentsApi.getTree()).data.data ?? [],
  });
  const deptOptions = useMemo(() => flattenDeptTree(deptTreeQ.data ?? []), [deptTreeQ.data]);
  const deptName = (id: string | null) =>
    id ? (deptOptions.find(o => o.value === id)?.label.replace(/^(— )+/, '') ?? 'One department') : null;

  const listQ = useQuery(announcementsQuery());
  const announcements = listQ.data ?? [];

  const sendMutation = useMutation({
    mutationFn: () => announcementsApi.send({
      title: title.trim(),
      body: body.trim(),
      department_id: departmentId || undefined,
      scheduled_for: schedule ? localToIso(scheduledAt) : undefined,
    }),
    onSuccess: res => {
      const data = res.data.data as { count: number; message: string; announcement: Announcement };
      const audienceLabel = deptName(departmentId || null) ?? 'the entire organization';
      setResult({
        scheduled: data.message === 'Announcement scheduled',
        count: data.count,
        audienceLabel,
        scheduledFor: data.announcement?.scheduled_for ?? localToIso(scheduledAt),
      });
      setTitle(''); setBody(''); setDepartmentId(''); setSchedule(false); setScheduledAt('');
      queryClient.invalidateQueries({ queryKey: keys.announcements.all });
    },
    onError: err => toast.error(getApiError(err)),
  });

  const handleSend = () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message body are required');
      return;
    }
    const scheduledIso = schedule ? localToIso(scheduledAt) : undefined;
    if (schedule && !scheduledIso) {
      toast.error('Pick a date and time to schedule the announcement');
      return;
    }
    const audience = deptName(departmentId || null) ?? 'all employees';
    const when = scheduledIso ? `schedule this announcement for ${formatDateTime(scheduledIso)}` : 'send this announcement now';
    if (!confirm(`Are you sure you want to ${when} to ${audience}?`)) return;
    setResult(null);
    sendMutation.mutate();
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Announcements" subtitle="Send an announcement to your team" />

        <Card className="p-6 space-y-4">
          <Input label="Title" required value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
          <Textarea label="Message" required value={body} onChange={e => setBody(e.target.value)} rows={5} />
          <Dropdown
            label="Audience"
            value={departmentId}
            onChange={setDepartmentId}
            placeholder="Entire organization"
            options={deptOptions}
          />

          <div className="space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={schedule}
                onChange={e => setSchedule(e.target.checked)}
                className="w-4 h-4 accent-[var(--primary-600)] cursor-pointer"
              />
              <span className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-[0.1em] flex items-center gap-1.5">
                <Clock3 size={12} /> Schedule for later
              </span>
            </label>
            {schedule && (
              <DateTimePicker
                label="Publish At"
                required
                value={scheduledAt}
                onChange={setScheduledAt}
                minDate={toISODate(new Date())}
                placeholder="Select date & time"
              />
            )}
          </div>

          <Button
            icon={schedule ? <Clock3 size={16} /> : <Send size={16} />}
            onClick={handleSend}
            loading={sendMutation.isPending}
          >
            {schedule ? 'Schedule Announcement' : 'Send Announcement'}
          </Button>
        </Card>

        {result && (
          <div className={cn(
            'mt-4 flex items-center gap-2 p-4 rounded-xl text-sm font-medium',
            result.scheduled
              ? 'bg-[#f59e0b]/10 text-[#f59e0b]'
              : 'bg-[var(--success-500)]/10 text-[var(--success-500)]',
          )}>
            {result.scheduled ? <Clock3 size={16} /> : <CheckCircle2 size={16} />}
            {result.scheduled
              ? <>Scheduled for {result.scheduledFor ? formatDateTime(result.scheduledFor) : 'later'} — audience: {result.audienceLabel}.</>
              : <>Sent to {result.count} {result.count === 1 ? 'person' : 'people'} in {result.audienceLabel}.</>}
          </div>
        )}

        {/* Recent announcements — the list endpoint returns published
            announcements targeted at YOU (org-wide + your own department),
            so department announcements outside your dept won't appear. */}
        <div className="mt-8">
          <h2 className="text-xs font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2">
            <Megaphone size={13} className="text-[var(--primary-600)]" /> Recent Announcements
          </h2>
          {listQ.isLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : announcements.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Megaphone size={22} />}
                title="No announcements yet"
                description="Announcements you send org-wide or to your own department will show up here once published."
              />
            </Card>
          ) : (
            <div className="space-y-2.5">
              {announcements.map(a => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white truncate">{a.title}</p>
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-[var(--glass-10)] text-[var(--on-glass-sub)]">
                          {a.department_id ? (deptName(a.department_id) ?? 'Department') : 'Org-wide'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--on-glass-muted)] mt-0.5 line-clamp-2">{a.body}</p>
                      <p className="text-[10px] text-[var(--on-glass-dim)] mt-1">
                        {a.author?.name ? `${a.author.name} · ` : ''}
                        {a.published_at ? formatDateTime(a.published_at) : 'Scheduled'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Users size={13} />}
                      onClick={() => setReceiptsFor(a)}
                    >
                      Reads
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <p className="text-[10px] text-[var(--on-glass-dim)] mt-3">
            This list shows published announcements visible to you: org-wide ones plus those sent to your own department.
          </p>
        </div>
      </div>

      {receiptsFor && <ReceiptsModal announcement={receiptsFor} onClose={() => setReceiptsFor(null)} />}
    </DashboardLayout>
  );
}

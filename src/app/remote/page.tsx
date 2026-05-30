'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Badge, Avatar, Modal, EmptyState, KPICard } from '@/components/ui';
import { remoteApi } from '@/lib/api';
import { getApiError, formatDate } from '@/lib/utils';
import {
  Home, Wifi, WifiOff, MessageCircle, AlertTriangle, RefreshCw, Clock,
  CheckCircle, XCircle, Loader, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';

interface NudgeLog {
  id: string;
  nudge_type: 'morning' | 'midday' | 'end_of_day';
  nudge_sent_at: string;
  reply_text: string | null;
  reply_at: string | null;
  task_summary: string | null;
  blockers: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  no_reply_alerted: boolean;
}

interface RemoteSession {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  duration_type: string;
  morning_nudge_at: string | null;
  midday_nudge_at: string | null;
  end_nudge_at: string | null;
  ai_summary: string | null;
  is_online: boolean;
  last_seen: string | null;
  responded_count: number;
  no_reply_count: number;
  latest_sentiment: 'positive' | 'neutral' | 'negative' | null;
  latest_task_summary: string | null;
  user?: { id: string; name: string; department?: string; avatar_url?: string };
  attendance?: { date: string };
  checkin_logs: NudgeLog[];
}

interface MonitorData {
  date: string;
  stats: { total: number; responded: number; no_reply: number; avg_sentiment: string | null };
  sessions: RemoteSession[];
}

const SENTIMENT = {
  positive: { color: 'var(--success-700)', bg: 'var(--success-100)', label: '😊 Positive' },
  neutral:  { color: 'var(--gray-500)',    bg: 'var(--gray-100)',    label: '😐 Neutral'  },
  negative: { color: 'var(--danger-500)',  bg: 'var(--danger-100)', label: '😟 Negative' },
} as const;

const NUDGE_LABELS: Record<string, string> = { morning: 'Morning', midday: 'Midday', end_of_day: 'EOD' };

function NudgePill({ label, sent, replied, noReply }: { label: string; sent: boolean; replied: boolean; noReply: boolean }) {
  if (!sent)    return <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[var(--gray-100)] text-[var(--gray-400)]">{label}</span>;
  if (replied)  return <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[var(--success-100)] text-[var(--success-700)]">✓ {label}</span>;
  if (noReply)  return <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[var(--danger-100)] text-[var(--danger-500)]">⚠ {label}</span>;
  return <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[var(--warning-100)] text-[var(--warning-800)]">… {label}</span>;
}

export default function RemoteMonitorPage() {
  const [data, setData]             = useState<MonitorData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [detail, setDetail]         = useState<RemoteSession | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const { data: res } = await remoteApi.getMonitor();
      setData(res.data);
      setLastRefreshed(new Date());
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const sessions = data?.sessions ?? [];
  const stats    = data?.stats;

  return (
    <DashboardLayout>
      <PageHeader
        title="Remote Work Monitor"
        subtitle="Live view of remote workers — AI nudge conversations, productivity signals, and online status"
        actions={
          <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={load} loading={loading}>
            Refresh
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Remote Today"
          value={stats?.total ?? 0}
          icon={<Home size={20} />}
          color="var(--purple-700)"
          bg="var(--purple-100)"
        />
        <KPICard
          title="Responded"
          value={stats?.responded ?? 0}
          icon={<CheckCircle size={20} />}
          color="var(--success-700)"
          bg="var(--success-100)"
        />
        <KPICard
          title="No Reply Alerts"
          value={stats?.no_reply ?? 0}
          icon={<AlertTriangle size={20} />}
          color="var(--danger-500)"
          bg="var(--danger-100)"
        />
        <KPICard
          title="Avg Sentiment"
          value={stats?.avg_sentiment
            ? SENTIMENT[stats.avg_sentiment as keyof typeof SENTIMENT]?.label ?? '—'
            : '—'}
          icon={<Sparkles size={20} />}
          color="var(--primary-600)"
          bg="var(--primary-100)"
        />
      </div>

      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gray-100)]">
          <h3 className="text-sm font-bold text-[var(--dark-950)]">
            Active Sessions — {data?.date ? formatDate(data.date) : formatDate(new Date().toISOString())}
          </h3>
          <span className="text-xs text-[var(--gray-500)] flex items-center gap-1">
            <Clock size={11} />
            Updated {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
          </span>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <Loader size={24} className="animate-spin text-[var(--primary-600)]" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<Home size={24} />}
            title="No remote workers today"
            description="Remote session requests will appear here once submitted and approved by a manager."
          />
        ) : (
          <div className="divide-y divide-[var(--gray-100)]">
            {sessions.map(session => {
              const morningLog = session.checkin_logs.find(l => l.nudge_type === 'morning');
              const middayLog  = session.checkin_logs.find(l => l.nudge_type === 'midday');
              const eodLog     = session.checkin_logs.find(l => l.nudge_type === 'end_of_day');
              const sentCfg    = session.latest_sentiment ? SENTIMENT[session.latest_sentiment] : null;

              return (
                <div key={session.id} className="px-5 py-4 hover:bg-[var(--gray-50)] transition-colors">
                  <div className="flex items-center gap-4 flex-wrap">

                    {/* Employee */}
                    <div className="flex items-center gap-3 w-48 shrink-0">
                      <div className="relative shrink-0">
                        <Avatar name={session.user?.name || '?'} imageUrl={session.user?.avatar_url} size="sm" />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${session.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--dark-950)] truncate">{session.user?.name || '—'}</p>
                        <p className="text-xs text-[var(--gray-500)] truncate">{session.user?.department || '—'}</p>
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-col gap-1 w-24 shrink-0">
                      <Badge label={session.duration_type.replace(/_/g, ' ')} color="var(--purple-700)" bg="var(--purple-100)" size="sm" />
                      <Badge
                        label={session.status}
                        size="sm"
                        color={session.status === 'approved' ? 'var(--success-700)' : session.status === 'rejected' ? 'var(--danger-500)' : 'var(--warning-800)'}
                        bg={session.status === 'approved' ? 'var(--success-100)' : session.status === 'rejected' ? 'var(--danger-100)' : 'var(--warning-100)'}
                      />
                    </div>

                    {/* Nudge pills */}
                    <div className="flex items-center gap-1 shrink-0">
                      <NudgePill label="AM"  sent={!!session.morning_nudge_at} replied={!!morningLog?.reply_at} noReply={morningLog?.no_reply_alerted || false} />
                      <NudgePill label="Mid" sent={!!session.midday_nudge_at}  replied={!!middayLog?.reply_at}  noReply={middayLog?.no_reply_alerted || false} />
                      <NudgePill label="EOD" sent={!!session.end_nudge_at}     replied={!!eodLog?.reply_at}     noReply={eodLog?.no_reply_alerted || false} />
                    </div>

                    {/* Latest summary + online status */}
                    <div className="flex-1 min-w-0">
                      {session.latest_task_summary ? (
                        <p className="text-xs text-[var(--dark-950)] line-clamp-2">{session.latest_task_summary}</p>
                      ) : (
                        <p className="text-xs text-[var(--gray-400)] italic">No replies yet</p>
                      )}
                      {session.last_seen && (
                        <p className="text-[11px] text-[var(--gray-400)] mt-0.5 flex items-center gap-1">
                          {session.is_online
                            ? <Wifi size={10} className="text-green-500" />
                            : <WifiOff size={10} />}
                          {session.is_online ? 'Online' : 'Offline'} · last seen {formatDistanceToNow(new Date(session.last_seen), { addSuffix: true })}
                        </p>
                      )}
                    </div>

                    {/* Sentiment + view button */}
                    <div className="flex items-center gap-2 shrink-0">
                      {sentCfg && <Badge label={sentCfg.label} color={sentCfg.color} bg={sentCfg.bg} size="sm" />}
                      {session.no_reply_count > 0 && (
                        <span title="No-reply alert sent">
                          <AlertTriangle size={15} className="text-[var(--danger-500)]" />
                        </span>
                      )}
                      <Button variant="ghost" size="sm" icon={<MessageCircle size={13} />} onClick={() => setDetail(session)}>
                        View Logs
                      </Button>
                    </div>
                  </div>

                  {/* AI day summary */}
                  {session.ai_summary && (
                    <div className="mt-2 ml-[52px] px-3 py-2 rounded-lg bg-[var(--purple-100)] border border-[var(--purple-200)]">
                      <p className="text-[11px] font-bold text-[var(--purple-700)] mb-0.5 flex items-center gap-1">
                        <Sparkles size={11} /> AI Day Summary
                      </p>
                      <p className="text-xs text-[var(--purple-700)]">{session.ai_summary}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Remote Work Activity Log" size="xl">
        {detail && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--gray-50)]">
              <div className="relative">
                <Avatar name={detail.user?.name || '?'} imageUrl={detail.user?.avatar_url} size="md" />
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${detail.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
              <div>
                <p className="font-semibold text-[var(--dark-950)]">{detail.user?.name}</p>
                <p className="text-xs text-[var(--gray-500)]">
                  {detail.user?.department} · {detail.duration_type.replace(/_/g, ' ')} · {formatDate(detail.attendance?.date || '')}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${detail.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-xs text-[var(--gray-500)]">{detail.is_online ? 'Online' : 'Offline'}</span>
                {detail.last_seen && (
                  <span className="text-xs text-[var(--gray-400)]">
                    · last seen {formatDistanceToNow(new Date(detail.last_seen), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>

            {/* Three nudge sections */}
            {(['morning', 'midday', 'end_of_day'] as const).map(nudgeType => {
              const log      = detail.checkin_logs.find(l => l.nudge_type === nudgeType);
              const sentAt   = nudgeType === 'morning' ? detail.morning_nudge_at : nudgeType === 'midday' ? detail.midday_nudge_at : detail.end_nudge_at;
              const heading  = nudgeType === 'morning' ? '🌅 Morning Check-in' : nudgeType === 'midday' ? '☀️ Midday Check-in' : '🌙 End of Day';

              return (
                <div key={nudgeType} className="border border-[var(--gray-200)] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--gray-50)] border-b border-[var(--gray-200)]">
                    <p className="text-sm font-bold text-[var(--dark-950)]">{heading}</p>
                    {sentAt
                      ? <span className="text-xs text-[var(--gray-500)]">Sent {format(new Date(sentAt), 'HH:mm')}</span>
                      : <span className="text-xs text-[var(--gray-400)]">Not sent yet</span>}
                  </div>

                  <div className="p-4">
                    {!sentAt ? (
                      <p className="text-sm text-[var(--gray-400)] italic">Scheduled — not yet sent</p>
                    ) : !log?.reply_text ? (
                      <div className="flex items-center gap-2 text-sm">
                        {log?.no_reply_alerted
                          ? <><AlertTriangle size={14} className="text-[var(--danger-500)]" /><span className="text-[var(--danger-500)]">No reply — manager alerted</span></>
                          : <><Clock size={14} className="text-[var(--gray-400)]" /><span className="text-[var(--gray-400)]">Waiting for reply…</span></>}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Employee reply */}
                        <div className="flex gap-2">
                          <div className="w-6 h-6 rounded-full bg-[var(--primary-100)] flex items-center justify-center shrink-0 mt-0.5">
                            <MessageCircle size={12} className="text-[var(--primary-600)]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-[var(--gray-500)] mb-1">
                              {detail.user?.name} replied · {log.reply_at ? format(new Date(log.reply_at), 'HH:mm') : ''}
                            </p>
                            <p className="text-sm text-[var(--dark-950)] bg-[var(--gray-50)] px-3 py-2 rounded-lg">{log.reply_text}</p>
                          </div>
                        </div>

                        {/* AI interpretation */}
                        {(log.task_summary || log.blockers || log.sentiment) && (
                          <div className="ml-8 p-3 rounded-lg bg-[var(--purple-100)] space-y-1.5">
                            <p className="text-[11px] font-bold text-[var(--purple-700)] uppercase tracking-wide flex items-center gap-1">
                              <Sparkles size={11} /> AI Interpretation
                            </p>
                            {log.task_summary && (
                              <p className="text-xs text-[var(--purple-700)]">
                                <span className="font-semibold">Working on: </span>{log.task_summary}
                              </p>
                            )}
                            {log.blockers && (
                              <p className="text-xs text-[var(--purple-700)]">
                                <span className="font-semibold">Blockers: </span>{log.blockers}
                              </p>
                            )}
                            {log.sentiment && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-[var(--purple-700)]">Mood:</span>
                                <Badge
                                  label={SENTIMENT[log.sentiment]?.label || log.sentiment}
                                  color={SENTIMENT[log.sentiment]?.color || 'var(--gray-500)'}
                                  bg={SENTIMENT[log.sentiment]?.bg || 'var(--gray-100)'}
                                  size="sm"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* AI day summary */}
            {detail.ai_summary && (
              <div className="p-4 rounded-xl bg-[var(--purple-100)] border border-[var(--purple-200)]">
                <p className="text-sm font-bold text-[var(--purple-700)] mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} /> AI Day Summary
                </p>
                <p className="text-sm text-[var(--purple-700)]">{detail.ai_summary}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Badge, Avatar, Modal, EmptyState,
  StatBox, SectionCard, RequestItem,
} from '@/components/ui';
import { remoteApi } from '@/lib/api';
import { getApiError, formatDate } from '@/lib/utils';
import {
  Home, MessageCircle, AlertTriangle, RefreshCw,
  CheckCircle, XCircle, Loader, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

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
  positive: { color: 'var(--success-500)', bg: '#10b981', label: '😊 Positive' },
  neutral:  { color: 'var(--on-glass-muted)', bg: '#64748b', label: '😐 Neutral'  },
  negative: { color: 'var(--danger-500)',  bg: '#ef4444', label: '😟 Negative' },
} as const;

function NudgePill({ label, sent, replied, noReply }: { label: string; sent: boolean; replied: boolean; noReply: boolean }) {
  if (!sent)    return <span className="px-2 py-0.5 text-[9px] font-black rounded-lg bg-[var(--glass-10)] text-[var(--on-glass-dim)] border border-[var(--glass-border)] uppercase tracking-widest">{label}</span>;
  if (replied)  return <span className="px-2 py-0.5 text-[9px] font-black rounded-lg bg-[var(--success-500)]/10 text-[var(--success-500)] border border-[var(--success-500)]/20 uppercase tracking-widest">{label}</span>;
  if (noReply)  return <span className="px-2 py-0.5 text-[9px] font-black rounded-lg bg-[var(--danger-500)]/10 text-[var(--danger-500)] border border-[var(--danger-500)]/20 uppercase tracking-widest">{label}</span>;
  return <span className="px-2 py-0.5 text-[9px] font-black rounded-lg bg-[var(--warning-500)]/10 text-[var(--warning-500)] border border-[var(--warning-500)]/20 uppercase tracking-widest">{label}</span>;
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
        subtitle="Live view of remote workers — AI nudge conversations and online status"
        actions={
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={load} loading={loading}>
            Refresh
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatBox
          label="Remote Today"
          labelIcon={<Home size={14} />}
          value={stats?.total ?? 0}
        />
        <StatBox
          label="Responded"
          labelIcon={<CheckCircle size={14} />}
          value={stats?.responded ?? 0}
          noteColor="var(--success-500)"
        />
        <StatBox
          label="No Reply Alerts"
          labelIcon={<AlertTriangle size={14} />}
          value={stats?.no_reply ?? 0}
          noteColor="var(--danger-500)"
        />
        <StatBox
          label="Avg Sentiment"
          labelIcon={<Sparkles size={14} />}
          value={stats?.avg_sentiment
            ? (SENTIMENT[stats.avg_sentiment as keyof typeof SENTIMENT]?.label.split(' ')[1] || '—')
            : '—'}
        />
      </div>

      <SectionCard
        icon={<Home size={16} />}
        title={`Active Remote Sessions · ${data?.date ? format(new Date(data.date), 'dd MMM yyyy').toUpperCase() : 'TODAY'}`}
        className="overflow-hidden"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--success-500)] animate-pulse" />
          <span className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.2em]">
            Updated {formatDistanceToNow(lastRefreshed, { addSuffix: true }).toUpperCase()}
          </span>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader size={32} className="animate-spin text-[var(--primary-600)]" />
            <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">Loading Remote Workers...</p>
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<Home size={24} />}
            title="No remote sessions detected"
            description="Active remote work sessions will appear here in real-time."
          />
        ) : (
          <div className="divide-y divide-[var(--glass-border)]">
            {sessions.map(session => {
              const morningLog = session.checkin_logs.find(l => l.nudge_type === 'morning');
              const middayLog  = session.checkin_logs.find(l => l.nudge_type === 'midday');
              const eodLog     = session.checkin_logs.find(l => l.nudge_type === 'end_of_day');
              const sentCfg    = session.latest_sentiment ? SENTIMENT[session.latest_sentiment] : null;

              return (
                <div key={session.id} className="py-4 hover:bg-[var(--glass-05)] transition-all group">
                  <RequestItem
                    name={session.user?.name || '—'}
                    avatarUrl={session.user?.avatar_url}
                    primary={session.user?.department || 'Operations'}
                    secondary={session.last_seen
                      ? `${session.is_online ? 'Online' : 'Offline'} · last seen ${formatDistanceToNow(new Date(session.last_seen), { addSuffix: true })}`
                      : undefined}
                    actions={
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Online indicator */}
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          session.is_online ? 'bg-[var(--success-500)]' : 'bg-gray-600'
                        )} />

                        {/* Duration badge */}
                        <Badge label={session.duration_type.replace(/_/g, ' ')} color="var(--secondary)" bg="#00E5FF" size="sm" />

                        {/* Nudge pills */}
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-2xl">
                          <NudgePill label="AM"  sent={!!session.morning_nudge_at} replied={!!morningLog?.reply_at} noReply={morningLog?.no_reply_alerted || false} />
                          <NudgePill label="MID" sent={!!session.midday_nudge_at}  replied={!!middayLog?.reply_at}  noReply={middayLog?.no_reply_alerted || false} />
                          <NudgePill label="EOD" sent={!!session.end_nudge_at}     replied={!!eodLog?.reply_at}     noReply={eodLog?.no_reply_alerted || false} />
                        </div>

                        {/* Sentiment badge */}
                        {sentCfg && <Badge label={sentCfg.label} color={sentCfg.color} bg={sentCfg.bg} size="sm" />}

                        {/* View conversation */}
                        <button
                          onClick={() => setDetail(session)}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white hover:bg-[var(--glass-15)] transition-all"
                        >
                          <MessageCircle size={16} />
                        </button>
                      </div>
                    }
                  />

                  {/* Latest task summary */}
                  {session.latest_task_summary && (
                    <p className="text-sm font-medium text-[var(--on-glass-sub)] line-clamp-1 italic tracking-tight mt-1 ml-10">
                      &ldquo;{session.latest_task_summary}&rdquo;
                    </p>
                  )}

                  {/* AI day summary */}
                  {session.ai_summary && (
                    <div className="mt-3 ml-10 p-3 rounded-2xl bg-[var(--primary-600)]/5 border border-[var(--primary-600)]/10">
                      <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                        <Sparkles size={12} /> AI Day Summary
                      </p>
                      <p className="text-sm font-medium text-white/70 leading-relaxed">{session.ai_summary}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Detail modal */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title="Remote Work Activity Log" size="xl">
        {detail && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-4 p-4 rounded-[2rem] bg-[var(--glass-05)] border border-[var(--glass-border)]">
              <div className="relative">
                <Avatar name={detail.user?.name || '?'} imageUrl={detail.user?.avatar_url} size="lg" />
                <span className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-4 border-[var(--dark-950)]",
                  detail.is_online ? "bg-[var(--success-500)]" : "bg-gray-600"
                )} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-white tracking-tight">{detail.user?.name}</h3>
                <p className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase tracking-[0.2em] mt-1">
                  {detail.user?.department} &middot; {detail.duration_type.replace(/_/g, ' ')} &middot; {formatDate(detail.attendance?.date || '')}
                </p>
              </div>
            </div>

            {/* Three nudge sections */}
            <div className="grid grid-cols-1 gap-4">
              {(['morning', 'midday', 'end_of_day'] as const).map(nudgeType => {
                const log      = detail.checkin_logs.find(l => l.nudge_type === nudgeType);
                const sentAt   = nudgeType === 'morning' ? detail.morning_nudge_at : nudgeType === 'midday' ? detail.midday_nudge_at : detail.end_nudge_at;
                const heading  = nudgeType === 'morning' ? 'MORNING CHECK-IN' : nudgeType === 'midday' ? 'MIDDAY SYNC' : 'EOD STATUS';

                return (
                  <div key={nudgeType} className="bg-(--glass-05) border border-(--glass-border) rounded-[2rem] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--glass-05)]">
                      <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">{heading}</p>
                      {sentAt
                        ? <span className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase">Triggered @ {format(new Date(sentAt), 'HH:mm')}</span>
                        : <span className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest italic">Pending</span>}
                    </div>

                    <div className="p-4">
                      {!sentAt ? (
                        <p className="text-xs font-bold text-[var(--on-glass-dim)] uppercase tracking-widest italic">Nudge not yet sent</p>
                      ) : !log?.reply_text ? (
                        <div className="flex items-center gap-3">
                          {log?.no_reply_alerted
                            ? <><AlertTriangle size={14} className="text-[var(--danger-500)]" /><span className="text-[11px] font-black text-[var(--danger-500)] uppercase tracking-widest">No Response — Manager Alerted</span></>
                            : <><div className="w-1.5 h-1.5 rounded-full bg-[var(--warning-500)] animate-pulse" /><span className="text-[11px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">Waiting for reply...</span></>}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Employee reply */}
                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-xl bg-[var(--primary-600)]/10 flex items-center justify-center shrink-0 border border-[var(--primary-600)]/20">
                              <MessageCircle size={14} className="text-[var(--primary-600)]" />
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-2">
                                Employee Reply &middot; {log.reply_at ? format(new Date(log.reply_at), 'HH:mm') : ''}
                              </p>
                              <div className="p-4 rounded-2xl bg-[var(--glass-05)] border border-[var(--glass-border)]">
                                 <p className="text-sm font-medium text-white italic leading-relaxed">&ldquo;{log.reply_text}&rdquo;</p>
                              </div>
                            </div>
                          </div>

                          {/* AI interpretation */}
                          {(log.task_summary || log.blockers || log.sentiment) && (
                            <div className="ml-12 p-4 rounded-2xl bg-[var(--primary-600)]/5 border border-[var(--primary-600)]/20 space-y-3">
                              <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.2em] flex items-center gap-2">
                                <Sparkles size={12} /> AI Interpretation
                              </p>
                              {log.task_summary && (
                                <p className="text-xs text-[var(--on-glass-sub)] leading-relaxed">
                                  <span className="font-black text-white uppercase tracking-widest text-[9px] mr-2">Working on:</span> {log.task_summary}
                                </p>
                              )}
                              {log.blockers && (
                                <p className="text-xs text-[var(--danger-500)] leading-relaxed">
                                  <span className="font-black uppercase tracking-widest text-[9px] mr-2">Blockers:</span> {log.blockers}
                                </p>
                              )}
                              {log.sentiment && (
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Sentiment:</span>
                                  <Badge
                                    label={SENTIMENT[log.sentiment]?.label || log.sentiment}
                                    color={SENTIMENT[log.sentiment]?.color || 'var(--on-glass-muted)'}
                                    bg={SENTIMENT[log.sentiment]?.bg || '#334155'}
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
            </div>

            {/* AI day summary */}
            {detail.ai_summary && (
              <div className="p-4 rounded-[2.5rem] bg-gradient-to-br from-[var(--primary-600)]/10 to-transparent border border-[var(--primary-600)]/20 shadow-2xl">
                <p className="text-[11px] font-black text-[var(--primary-600)] uppercase tracking-[0.3em] mb-3 flex items-center gap-3">
                  <Sparkles size={16} /> AI Day Summary
                </p>
                <p className="text-sm font-medium text-white/80 leading-[1.8]">{detail.ai_summary}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

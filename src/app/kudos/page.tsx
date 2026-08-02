'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Textarea, Dropdown, Modal, ConfirmDialog,
  Avatar, Skeleton, EmptyState, StatBox,
} from '@/components/ui';
import { kudosApi } from '@/lib/api';
import {
  keys, kudosFeedQuery, kudosMineQuery, selectableUsersQuery,
  type KudosEntry, type KudosUser,
} from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { cn, timeAgo, getApiError } from '@/lib/utils';
import { Award, HeartHandshake, Send, Trash2, ArrowRight, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const EMOJI_PICKS = ['👏', '🎉', '🙌', '💯', '🚀', '❤️', '⭐', '🔥'];
const MESSAGE_MAX = 500;

// ─── Give Kudos modal ─────────────────────────────────

function GiveKudosModal({ recipients, onClose }: {
  recipients: KudosUser[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [toUserId, setToUserId] = useState('');
  const [message, setMessage] = useState('');
  const [emoji, setEmoji] = useState('');

  const giveMutation = useMutation({
    mutationFn: () => kudosApi.give({
      to_user_id: toUserId,
      message: message.trim(),
      emoji: emoji || undefined,
    }),
    // Custom error handling below — keep the global toast quiet.
    meta: { silent: true },
    onSuccess: () => {
      toast.success('Kudos sent!');
      queryClient.invalidateQueries({ queryKey: keys.kudos.all });
      onClose();
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 429) {
        toast.error('Daily kudos limit reached — you can send more tomorrow.');
      } else {
        toast.error(getApiError(err));
      }
    },
  });

  const handleSend = () => {
    if (!toUserId) { toast.error('Pick someone to recognise'); return; }
    if (message.trim().length < 3) { toast.error('Message must be at least 3 characters'); return; }
    giveMutation.mutate();
  };

  return (
    <Modal isOpen onClose={onClose} title="Give Kudos" size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" icon={<Send size={14} />} onClick={handleSend} loading={giveMutation.isPending}>
            Send Kudos
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {recipients.length === 0 ? (
          <p className="text-xs text-[var(--on-glass-muted)]">
            No one to recognise yet — once teammates appear in the kudos feed you can pick them here.
          </p>
        ) : (
          <Dropdown
            label="Recipient"
            required
            value={toUserId}
            onChange={setToUserId}
            placeholder="Who are you recognising?"
            options={recipients.map(r => ({
              value: r.id,
              label: r.department ? `${r.name} — ${r.department}` : r.name,
            }))}
          />
        )}

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-[0.1em]">
            Emoji
          </span>
          <div className="flex flex-wrap gap-2">
            {EMOJI_PICKS.map(e => (
              <button
                key={e}
                type="button"
                aria-label={`Pick emoji ${e}`}
                aria-pressed={emoji === e}
                onClick={() => setEmoji(prev => (prev === e ? '' : e))}
                className={cn(
                  'w-10 h-10 flex items-center justify-center text-lg rounded-xl border transition-all active:scale-90',
                  emoji === e
                    ? 'bg-[var(--primary-600)]/20 border-[var(--primary-600)] ring-2 ring-[var(--primary-600)]/20'
                    : 'bg-[var(--glass-05)] border-[var(--glass-border)] hover:bg-[var(--glass-10)]',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Textarea
            label="Message"
            required
            rows={4}
            value={message}
            maxLength={MESSAGE_MAX}
            placeholder="What did they do that deserves a shout-out?"
            onChange={e => setMessage(e.target.value)}
          />
          <p className="text-[10px] text-[var(--on-glass-dim)] mt-1 text-right">
            {message.length}/{MESSAGE_MAX}
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ─── Feed entry ───────────────────────────────────────

function KudosCard({ entry, canDelete, onDelete }: {
  entry: KudosEntry;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar name={entry.giver.name} imageUrl={entry.giver.avatar_url} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="font-bold text-white truncate">{entry.giver.name}</span>
            <ArrowRight size={11} className="text-[var(--on-glass-dim)] shrink-0" />
            <span className="inline-flex items-center gap-1.5 font-bold text-[var(--primary-600)] truncate">
              <Avatar name={entry.recipient.name} imageUrl={entry.recipient.avatar_url} size="xs" />
              {entry.recipient.name}
            </span>
            {entry.emoji && <span className="text-base leading-none">{entry.emoji}</span>}
          </div>
          <p className="text-[13px] text-[var(--on-glass-sub)] mt-1.5 whitespace-pre-wrap break-words">
            {entry.message}
          </p>
          <p className="text-[10px] text-[var(--on-glass-dim)] mt-1.5">{timeAgo(entry.created_at)}</p>
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            aria-label="Delete kudos"
            title="Delete"
            className="p-1.5 rounded-lg text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10 transition-all shrink-0"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────

export default function KudosPage() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [giveOpen, setGiveOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KudosEntry | null>(null);

  const canModerate = hasPermission('org.settings.update');
  // GET /users requires employees.view or employees.view_team — plain
  // employees have neither, so the recipient select falls back to people
  // already visible in the kudos feed (giver/recipient mini-objects are
  // permission-free for org members).
  const canListUsers = hasPermission('employees.view') || hasPermission('employees.view_team');

  const feedQ = useQuery(kudosFeedQuery());
  const mineQ = useQuery(kudosMineQuery());
  const usersQ = useQuery({ ...selectableUsersQuery(), enabled: canListUsers });

  const feed = useMemo(() => feedQ.data ?? [], [feedQ.data]);
  const mine = mineQ.data;

  const recipients = useMemo(() => {
    const byId = new Map<string, KudosUser>();
    for (const u of usersQ.data ?? []) {
      byId.set(u.id, { id: u.id, name: u.name, avatar_url: u.avatar_url, department: u.department });
    }
    // Feed fallback/top-up for callers who can't list the directory.
    for (const entry of feed) {
      for (const p of [entry.giver, entry.recipient]) {
        if (!byId.has(p.id)) byId.set(p.id, p);
      }
    }
    for (const entry of mine?.recent_received ?? []) {
      if (!byId.has(entry.giver.id)) byId.set(entry.giver.id, entry.giver);
    }
    if (user) byId.delete(user.sub); // no self-kudos
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [usersQ.data, feed, mine?.recent_received, user]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => kudosApi.remove(id),
    onSuccess: () => {
      toast.success('Kudos deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: keys.kudos.all });
    },
  });

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title="Kudos"
          subtitle="Recognise great work across the organization"
          actions={
            <Button size="sm" icon={<HeartHandshake size={14} />} onClick={() => setGiveOpen(true)}>
              Give Kudos
            </Button>
          }
        />

        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatBox
            label="Received"
            labelIcon={<Award size={11} />}
            value={mineQ.isLoading ? '…' : (mine?.received ?? 0)}
          />
          <StatBox
            label="Given"
            labelIcon={<Sparkles size={11} />}
            value={mineQ.isLoading ? '…' : (mine?.given ?? 0)}
          />
        </div>

        {feedQ.isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : feed.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Award size={22} />}
              title="No kudos yet"
              description="Be the first to recognise a teammate — kudos you and others give show up here for the whole organization."
              action={
                <Button size="sm" icon={<HeartHandshake size={14} />} onClick={() => setGiveOpen(true)}>
                  Give Kudos
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-2.5">
            {feed.map(entry => (
              <KudosCard
                key={entry.id}
                entry={entry}
                canDelete={canModerate || entry.giver.id === user?.sub}
                onDelete={() => setDeleteTarget(entry)}
              />
            ))}
          </div>
        )}
      </div>

      {giveOpen && (
        <GiveKudosModal recipients={recipients} onClose={() => setGiveOpen(false)} />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
        title="Delete Kudos"
        message={`Delete this kudos from ${deleteTarget?.giver.name ?? ''} to ${deleteTarget?.recipient.name ?? ''}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </DashboardLayout>
  );
}

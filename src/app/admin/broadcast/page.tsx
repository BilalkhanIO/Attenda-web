'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { PageHeader, Card, Button, Input, Textarea, Select } from '@/components/ui';
import { Send, AlertCircle, Megaphone, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminBroadcastPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'all' | 'super_admins'>('all');
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message body are required');
      return;
    }

    if (!confirm(`Are you sure you want to send this broadcast to ${target === 'all' ? 'ALL active users' : 'all SUPER ADMINS'}? This cannot be undone.`)) {
      return;
    }

    setSending(true);
    try {
      const res = await adminApi.broadcast({ title, body, target });
      setSentCount(res.data.data.count);
      toast.success('Broadcast sent successfully');
      setTitle('');
      setBody('');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Platform Broadcast"
        subtitle="Send high-priority notifications to all users"
      />

      <div className="grid grid-cols-1 gap-6">
        <Card className="p-8 border-[var(--primary-600)]/20 bg-[var(--primary-600)]/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Megaphone size={120} className="text-[var(--primary-600)]" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[var(--primary-600)] flex items-center justify-center text-white shadow-lg shadow-[var(--primary-600)]/20">
                <Megaphone size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Create Announcement</h2>
                <p className="text-sm text-[var(--on-glass-muted)]">This will appear in the notification bell for all targeted users.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  label="Announcement Title"
                  placeholder="e.g. Scheduled Maintenance"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
                <Select 
                  label="Target Audience"
                  value={target}
                  onChange={e => setTarget(e.target.value as 'all' | 'super_admins')}
                  options={[
                    { value: 'all', label: 'All Active Users' },
                    { value: 'super_admins', label: 'Super Admins Only' }
                  ]}
                  required
                />
              </div>

              <Textarea 
                label="Message Body"
                placeholder="Details about the announcement..."
                rows={6}
                value={body}
                onChange={e => setBody(e.target.value)}
                required
              />

              <div className="pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[var(--warning-500)] bg-[var(--warning-500)]/10 px-4 py-2 rounded-xl border border-[var(--warning-500)]/20">
                  <AlertCircle size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Use sparingly</span>
                </div>
                
                <Button 
                  size="lg"
                  icon={<Send size={18} />}
                  loading={sending}
                  onClick={handleSend}
                  className="min-w-[200px]"
                >
                  Send Broadcast
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {sentCount !== null && (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--success-500)]/10 border border-[var(--success-500)]/20 text-[var(--success-500)] animate-fade-in">
            <CheckCircle2 size={24} />
            <div>
              <p className="text-sm font-black uppercase tracking-wider">Last broadcast successful</p>
              <p className="text-xs font-bold opacity-80">Message delivered to {sentCount} users.</p>
            </div>
            <button onClick={() => setSentCount(null)} className="ml-auto text-xs font-black uppercase hover:underline">Dismiss</button>
          </div>
        )}

        <Card className="p-6 bg-[var(--glass-05)] border-[var(--glass-border)]">
          <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-4">Guidelines</h3>
          <ul className="space-y-3">
            {[
              'Broadcasts appear immediately in the in-app notification bell.',
              'Use this for critical platform updates or emergency maintenance only.',
              'Avoid sending multiple broadcasts in a single day.',
              'The author will appear as "Platform System" by default.'
            ].map((g, i) => (
              <li key={i} className="flex items-start gap-3 text-xs text-[var(--on-glass-muted)] leading-relaxed">
                <div className="w-1 h-1 rounded-full bg-[var(--primary-600)] mt-1.5 flex-shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

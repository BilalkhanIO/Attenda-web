'use client';

import { useState } from 'react';
import { adminApi as api } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { PageHeader, Card, Button, Input, Textarea } from '@/components/ui';
import { Send, Megaphone, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrgAnnouncementsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message body are required');
      return;
    }

    if (!confirm('Are you sure you want to send this announcement to all employees?')) return;

    setSending(true);
    try {
      await api.sendAnnouncement({ title, body });
      toast.success('Announcement sent');
      setTitle('');
      setBody('');
      setSent(true);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Announcements" subtitle="Send an announcement to your team" />
      
      <Card className="p-6 space-y-4">
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea label="Message" value={body} onChange={e => setBody(e.target.value)} rows={5} />
        <Button icon={<Send size={16} />} onClick={handleSend} loading={sending}>Send Announcement</Button>
      </Card>
      
      {sent && (
        <div className="mt-4 flex items-center gap-2 p-4 rounded-xl bg-[var(--success-500)]/10 text-[var(--success-500)]">
          <CheckCircle2 size={16} /> Sent!
        </div>
      )}
    </div>
  );
}

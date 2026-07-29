'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Modal, Button, Card, Input, EmptyState, Badge
} from '@/components/ui';
import { orgApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { MessageSquare, Save, Plus, Trash2, TestTube2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

type WASettings = {
  enabled: boolean;
  phone_number_id: string;
  access_token: string;
  groups: { id: string; name: string; phone: string }[];
  events: Record<string, boolean>;
};

const EVENT_LABELS: Record<string, string> = {
  check_in:     '✅ Check-in',
  check_out:    '🔴 Check-out',
  late_arrival: '⚠️ Late arrival',
  absent:       '🚫 Absence',
  leave_approved: '📅 Leave approved',
  payslip_ready:  '💰 Payslip ready',
};

interface WhatsAppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsAppSettingsModal({ isOpen, onClose }: WhatsAppSettingsModalProps) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<WASettings>({
    enabled: false,
    phone_number_id: '',
    access_token: '',
    groups: [],
    events: Object.fromEntries(Object.keys(EVENT_LABELS).map(k => [k, true])),
  });

  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', phone: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-settings'],
    queryFn: async () => (await orgApi.getWhatsAppSettings()).data.data,
  });

  // Seed the editable form state whenever fresh server data arrives
  // ("adjusting state when props change" pattern — no effect needed).
  const [seededData, setSeededData] = useState(data);
  if (data !== seededData) {
    setSeededData(data);
    if (data) {
      setSettings({
        enabled:         data.enabled ?? false,
        phone_number_id: data.phone_number_id || '',
        access_token:    data.access_token || '',
        groups:          Array.isArray(data.groups) ? data.groups : [],
        events:          (data.events && typeof data.events === 'object') ? data.events : settings.events,
      });
    }
  }

  const saveMutation = useMutation({
    mutationFn: (vars: Record<string, unknown>) => orgApi.updateWhatsAppSettings(vars),
    onSuccess: () => {
      toast.success('WhatsApp settings saved');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-settings'] });
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const testMutation = useMutation({
    mutationFn: () => orgApi.testWhatsApp(),
    onSuccess: (res) => toast.success(res.data.data?.message || 'Test message sent'),
    onError: (err) => toast.error(getApiError(err)),
  });

  const toggleEvent = (key: string) => {
    setSettings(s => ({
      ...s,
      events: { ...s.events, [key]: !s.events[key] }
    }));
  };

  const addGroup = () => {
    if (!newGroup.name || !newGroup.phone) return;
    setSettings(s => ({
      ...s,
      groups: [...s.groups, { id: Date.now().toString(), ...newGroup }]
    }));
    setNewGroup({ name: '', phone: '' });
    setAddGroupOpen(false);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="WhatsApp Notifications"
        size="lg"
        footer={
          <div className="flex w-full justify-between items-center">
            <Button variant="ghost" size="sm" icon={<TestTube2 size={14} />} loading={testMutation.isPending} onClick={() => testMutation.mutate()}>
              Test
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button icon={<Save size={14} />} loading={saveMutation.isPending} onClick={() => saveMutation.mutate(settings)}>
                Save Settings
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Meta API Config */}
            <Card className="p-4 bg-[var(--glass-05)] border-[var(--glass-border)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--success-500)]/10 flex items-center justify-center">
                    <MessageSquare size={16} className="text-[var(--success-500)]" />
                  </div>
                  <h4 className="text-sm font-black text-white">Cloud API</h4>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    settings.enabled ? 'bg-[var(--success-500)]' : 'bg-[var(--glass-20)]'
                  )}
                >
                  <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform', settings.enabled ? 'translate-x-5' : 'translate-x-1')} />
                </button>
              </div>
              <div className="space-y-3">
                <Input label="Phone Number ID" value={settings.phone_number_id} onChange={e => setSettings(s => ({ ...s, phone_number_id: e.target.value }))} placeholder="Meta ID" />
                <Input label="Access Token" type="password" value={settings.access_token} onChange={e => setSettings(s => ({ ...s, access_token: e.target.value }))} placeholder="Meta Token" />
              </div>
            </Card>

            {/* Target Groups */}
            <Card className="p-4 bg-[var(--glass-05)] border-[var(--glass-border)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase text-[var(--on-glass-muted)] tracking-widest">Target Groups</p>
                <button onClick={() => setAddGroupOpen(true)} className="text-[10px] font-black uppercase text-[var(--primary-600)] hover:text-white transition-all flex items-center gap-1">
                  <Plus size={12} /> Add
                </button>
              </div>
              {settings.groups.length === 0 ? (
                <div className="py-4 text-center border border-dashed border-[var(--glass-border)] rounded-xl">
                  <p className="text-[10px] text-[var(--on-glass-dim)] uppercase font-bold">No groups added</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                  {settings.groups.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-2 rounded-xl bg-[var(--glass-10)] border border-[var(--glass-border)] group">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-white truncate">{g.name}</p>
                        <p className="text-[10px] font-mono text-[var(--on-glass-dim)]">{g.phone}</p>
                      </div>
                      <button onClick={() => setSettings(s => ({ ...s, groups: s.groups.filter(x => x.id !== g.id) }))} className="text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Events Selector */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle size={14} className="text-[var(--primary-600)]" />
              <p className="text-[11px] font-black uppercase text-[var(--on-glass-muted)] tracking-widest">Notification Triggers</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(EVENT_LABELS).map(([key, label]) => {
                const active = settings.events[key];
                return (
                  <button
                    key={key}
                    onClick={() => toggleEvent(key)}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-2xl border transition-all text-left group',
                      active ? 'border-[var(--success-500)]/40 bg-[var(--success-500)]/10' : 'border-[var(--glass-border)] bg-transparent hover:bg-[var(--glass-05)]'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      active ? 'bg-[var(--success-500)] border-[var(--success-500)]' : 'border-[var(--glass-border)]'
                    )}>
                      {active && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                    <span className={cn('text-xs font-black transition-colors', active ? 'text-white' : 'text-[var(--on-glass-muted)] group-hover:text-white')}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Group Modal */}
      <Modal
        isOpen={addGroupOpen}
        onClose={() => setAddGroupOpen(false)}
        title="Add Recipient Group"
        size="sm"
        footer={<Button onClick={addGroup}>Add Group</Button>}
      >
        <div className="space-y-4">
          <Input label="Group Name" value={newGroup.name} onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))} placeholder="e.g. Management" required />
          <Input label="Phone or Group ID" value={newGroup.phone} onChange={e => setNewGroup(g => ({ ...g, phone: e.target.value }))} placeholder="+1234..." required />
        </div>
      </Modal>
    </>
  );
}

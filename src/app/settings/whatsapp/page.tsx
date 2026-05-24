'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, Modal } from '@/components/ui';
import { orgApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { MessageSquare, Save, Plus, Trash2, TestTube2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface WASettings {
  enabled: boolean;
  phone_number_id: string;
  access_token: string;
  groups: { id: string; name: string; phone: string }[];
  events: Record<string, boolean>;
}

const EVENT_LABELS: Record<string, string> = {
  check_in:     '✅ Employee checks in',
  check_out:    '🔴 Employee checks out',
  late_arrival: '⚠️ Late arrival alert',
  absent:       '🚫 Employee absent',
  leave_approved: '📅 Leave approved',
  payslip_ready:  '💰 Payslip ready',
  remote_checkin: '🏠 Remote check-in',
};

export default function WhatsAppSettingsPage() {
  const [settings, setSettings] = useState<WASettings>({
    enabled: false,
    phone_number_id: '',
    access_token: '',
    groups: [],
    events: Object.fromEntries(Object.keys(EVENT_LABELS).map(k => [k, true])),
  });
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', phone: '' });

  useEffect(() => {
    orgApi.getWhatsAppSettings().then(r => setSettings(r.data.data || settings)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await orgApi.updateWhatsAppSettings(settings as unknown as Record<string, unknown>);
      toast.success('WhatsApp settings saved');
    } catch (err) {
      toast.error(getApiError(err));
    } finally { setSaving(false); }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await orgApi.updateSettings({ wa_test: true });
      toast.success('Test message sent to all configured groups');
    } catch (err) {
      toast.error(getApiError(err));
    } finally { setTesting(false); }
  };

  const addGroup = () => {
    if (!newGroup.name || !newGroup.phone) return;
    setSettings(s => ({
      ...s,
      groups: [...s.groups, { id: Date.now().toString(), ...newGroup }],
    }));
    setNewGroup({ name: '', phone: '' });
    setAddGroupOpen(false);
  };

  return (
    <DashboardLayout>
      <PageHeader title="WhatsApp Notifications"
        subtitle="Configure real-time attendance alerts for your team"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" size="sm" icon={<TestTube2 size={14} />}
              loading={testing} onClick={sendTest}>Send Test</Button>
            <Button size="sm" icon={<Save size={14} />} loading={saving} onClick={save}>Save Settings</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Config */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-[var(--success-700)]" />
              <h3 className="text-base font-bold">Meta Cloud API</h3>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-[var(--success-500)]' : 'bg-[var(--gray-200)]'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div className="space-y-4">
            <Input label="Phone Number ID" placeholder="Enter Meta phone number ID"
              value={settings.phone_number_id}
              onChange={e => setSettings(s => ({ ...s, phone_number_id: e.target.value }))} />
            <Input label="Access Token" type="password" placeholder="Enter access token"
              value={settings.access_token}
              onChange={e => setSettings(s => ({ ...s, access_token: e.target.value }))} />
            <p className="text-xs text-[var(--gray-500)]">
              Get your credentials from the Meta for Developers console. Token must have <code className="font-mono bg-[var(--gray-100)] px-1 rounded">whatsapp_business_messaging</code> permission.
            </p>
          </div>
        </Card>

        {/* WhatsApp Groups */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold">Target Groups</h3>
            <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => setAddGroupOpen(true)}>
              Add Group
            </Button>
          </div>
          {settings.groups.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--gray-100)] flex items-center justify-center mx-auto mb-2">
                <MessageSquare size={18} className="text-[var(--gray-500)]" />
              </div>
              <p className="text-sm text-[var(--gray-500)]">No groups added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {settings.groups.map(g => (
                <div key={g.id} className="flex items-center justify-between p-3 bg-[var(--gray-50)] rounded-lg">
                  <div>
                    <p className="text-sm font-semibold">{g.name}</p>
                    <p className="text-xs text-[var(--gray-500)] font-mono">{g.phone}</p>
                  </div>
                  <button onClick={() => setSettings(s => ({ ...s, groups: s.groups.filter(x => x.id !== g.id) }))}
                    className="text-[var(--gray-500)] hover:text-[var(--danger-800)]">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Notification Events */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-base font-bold mb-4">Notification Events</h3>
          <p className="text-sm text-[var(--gray-500)] mb-5">
            Choose which events trigger WhatsApp messages to your groups.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(EVENT_LABELS).map(([key, label]) => (
              <div key={key}
                onClick={() => setSettings(s => ({ ...s, events: { ...s.events, [key]: !s.events[key] } }))}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  settings.events[key]
                    ? 'border-[var(--success-500)] bg-[var(--success-100)]'
                    : 'border-[var(--gray-200)] hover:border-[var(--gray-200)] hover:bg-[var(--gray-50)]'
                }`}>
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${settings.events[key] ? 'bg-[var(--success-500)]' : 'bg-[var(--gray-200)]'}`}>
                  {settings.events[key] && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Add group modal */}
      <Modal isOpen={addGroupOpen} onClose={() => setAddGroupOpen(false)}
        title="Add WhatsApp Group" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddGroupOpen(false)}>Cancel</Button>
            <Button onClick={addGroup}>Add Group</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Group Name" placeholder="e.g. All Staff" required
            value={newGroup.name} onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))} />
          <Input label="WhatsApp Group ID / Phone" placeholder="+1234567890 or group ID" required
            value={newGroup.phone} onChange={e => setNewGroup(g => ({ ...g, phone: e.target.value }))} />
          <p className="text-xs text-[var(--gray-500)]">
            For group messages, add the Attenda bot as a group admin first. For individual numbers, use the international format with + prefix.
          </p>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, Modal, ConfirmDialog } from '@/components/ui';
import { orgApi, attendanceApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Wifi, Plus, Trash2, Save, QrCode, RefreshCw, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [ips, setIps]                 = useState<string[]>([]);
  const [newIp, setNewIp]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [qrCode, setQrCode]           = useState<string | null>(null);
  const [qrLoading, setQrLoading]     = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleteIp, setDeleteIp]       = useState<string | null>(null);
  const [orgName, setOrgName]         = useState('');
  const [timezone, setTimezone]       = useState('UTC');

  useEffect(() => {
    const load = async () => {
      setQrLoading(true);
      try {
        const [ipsRes, settingsRes, qrRes] = await Promise.allSettled([
          orgApi.getOfficeIPs(),
          orgApi.getSettings(),
          attendanceApi.getQRCode(),
        ]);
        if (ipsRes.status === 'fulfilled')      setIps(ipsRes.value.data.data || []);
        if (settingsRes.status === 'fulfilled') {
          const s = settingsRes.value.data.data;
          setOrgName(s?.name || '');
          setTimezone(s?.timezone || 'UTC');
        }
        if (qrRes.status === 'fulfilled') {
          const qr = qrRes.value.data.data;
          setQrCode(qr?.qr_code_url || qr?.qr_code_base64 || null);
        }
      } catch { /* ignore */ } finally {
        setQrLoading(false);
      }
    };
    load();
  }, []);

  const addIp = () => {
    const trimmed = newIp.trim();
    if (!trimmed) return;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(trimmed)) { toast.error('Invalid IP address format'); return; }
    if (ips.includes(trimmed))  { toast.error('IP already added'); return; }
    if (ips.length >= 10)       { toast.error('Maximum 10 IPs allowed'); return; }
    setIps([...ips, trimmed]);
    setNewIp('');
  };

  const saveIPs = async () => {
    setSaving(true);
    try {
      await orgApi.updateOfficeIPs(ips);
      toast.success('Office IP addresses saved');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const regenQR = async () => {
    setRegenerating(true);
    try {
      const { data } = await attendanceApi.regenerateQR();
      toast.success('QR code regenerated');
      setRegenConfirm(false);
      const qr = data.data;
      setQrCode(qr?.qr_code_url || qr?.qr_code_base64 || null);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setRegenerating(false);
    }
  };

  const saveOrgSettings = async () => {
    setSaving(true);
    try {
      await orgApi.updateSettings({ name: orgName, timezone });
      toast.success('Organisation settings saved');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="Settings" subtitle="Organisation configuration" />

      {/* Row 1: QR Code (prominent, top of page) */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-[var(--primary-600)]" />
            <h3 className="text-base font-bold text-[var(--dark-950)]">Attendance QR Code</h3>
          </div>
          {qrCode && (
            <Button variant="danger" size="sm" icon={<RefreshCw size={14} />}
              onClick={() => setRegenConfirm(true)}>
              Regenerate
            </Button>
          )}
        </div>
        <p className="text-xs text-[var(--gray-500)] mb-6">
          Display this QR code at the office entrance. Employees scan it to check in when IP auto-check-in fails.
        </p>

        {qrLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-[var(--primary-600)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : qrCode ? (
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="p-4 bg-white border-2 border-[var(--gray-200)] rounded-2xl shadow-sm">
              <img src={qrCode} alt="Attendance QR Code" className="w-44 h-44" />
            </div>
            <div className="space-y-3 text-sm text-[var(--gray-500)]">
              <p>✓ Print and display at the office entrance</p>
              <p>✓ Employees scan using the Attenda mobile app</p>
              <p>✓ Auto-rotates every 24 hours for security</p>
              <div className="flex gap-3 pt-2">
                <a href={qrCode} download="attenda-qr.png">
                  <Button variant="outline" size="sm" icon={<Download size={14} />}>Download PNG</Button>
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6 py-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--gray-100)] flex items-center justify-center flex-shrink-0">
              <QrCode size={28} className="text-[var(--gray-500)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--dark-950)] mb-1">No QR code generated yet</p>
              <p className="text-xs text-[var(--gray-500)] mb-3">
                Generate a QR code for your office entrance so employees can scan to check in.
              </p>
              <Button icon={<QrCode size={14} />} onClick={regenQR} loading={regenerating}>
                Generate QR Code
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Row 2: Organisation + Office IPs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organisation */}
        <Card className="p-6">
          <h3 className="text-base font-bold text-[var(--dark-950)] mb-4">Organisation</h3>
          <div className="space-y-4">
            <Input label="Organisation Name" value={orgName} onChange={e => setOrgName(e.target.value)} />
            <div>
              <label className="text-sm font-semibold text-[var(--dark-800)] block mb-1">Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]">
                {['UTC','Africa/Nairobi','Africa/Lagos','America/New_York','Europe/London','Asia/Dubai','Asia/Kolkata'].map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <Button icon={<Save size={14} />} loading={saving} onClick={saveOrgSettings}>Save Settings</Button>
          </div>
        </Card>

        {/* Office IPs */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wifi size={18} className="text-[var(--primary-600)]" />
              <h3 className="text-base font-bold text-[var(--dark-950)]">Office IP Addresses</h3>
            </div>
            <span className="text-xs text-[var(--gray-500)]">{ips.length}/10</span>
          </div>
          <p className="text-xs text-[var(--gray-500)] mb-4">
            Register your office WiFi IPs. Employees connecting from these IPs will be auto-checked in.
          </p>

          <div className="space-y-2 mb-4 min-h-[80px]">
            {ips.length === 0 ? (
              <p className="text-sm text-[var(--gray-500)] text-center py-6">No IPs configured yet</p>
            ) : ips.map(ip => (
              <div key={ip} className="flex items-center justify-between px-3 py-2 bg-[var(--gray-50)] rounded-lg">
                <span className="text-sm font-mono text-[var(--dark-950)]">{ip}</span>
                <button onClick={() => setDeleteIp(ip)}
                  className="text-[var(--gray-500)] hover:text-[var(--danger-800)] transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            <input value={newIp} onChange={e => setNewIp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addIp()}
              placeholder="e.g. 192.168.1.1"
              className="flex-1 px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg font-mono outline-none focus:border-[var(--primary-600)]"
            />
            <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={addIp}>Add</Button>
          </div>

          <Button icon={<Save size={14} />} loading={saving} onClick={saveIPs} className="w-full">
            Save IP Addresses
          </Button>
        </Card>
      </div>

      {/* Delete IP confirm */}
      <ConfirmDialog
        isOpen={!!deleteIp}
        onClose={() => setDeleteIp(null)}
        onConfirm={() => { setIps(ips.filter(i => i !== deleteIp)); setDeleteIp(null); }}
        title="Remove IP Address"
        message={`Remove ${deleteIp} from the office IP list? Employees on this network will no longer auto-check in.`}
        confirmLabel="Remove"
        variant="danger"
      />

      {/* Regen QR confirm */}
      <ConfirmDialog
        isOpen={regenConfirm}
        onClose={() => setRegenConfirm(false)}
        onConfirm={regenQR}
        loading={regenerating}
        title="Regenerate QR Code"
        message="The current QR code will be invalidated immediately. Print and display the new code at the office entrance."
        confirmLabel="Regenerate"
        variant="danger"
      />
    </DashboardLayout>
  );
}

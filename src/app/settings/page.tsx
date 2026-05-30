'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, ConfirmDialog } from '@/components/ui';
import { orgApi, attendanceApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Wifi, Radio, Plus, Trash2, Save, QrCode, RefreshCw, Download, Clock, ChevronRight, MessageSquare, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function SettingsPage() {
  const { hasRole } = useAuth();

  // IPs / CIDRs
  const [ips, setIps]       = useState<string[]>([]);
  const [newIp, setNewIp]   = useState('');

  // SSIDs
  const [ssids, setSsids]     = useState<string[]>([]);
  const [newSsid, setNewSsid] = useState('');

  const [savingIps, setSavingIps]     = useState(false);
  const [savingSsids, setSavingSsids] = useState(false);

  // QR code
  const [qrCode, setQrCode]           = useState<string | null>(null);
  const [qrLoading, setQrLoading]     = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Org settings
  const [orgName, setOrgName]             = useState('');
  const [timezone, setTimezone]           = useState('UTC');
  const [lateThreshold, setLateThreshold] = useState(15);
  const [savingOrg, setSavingOrg]         = useState(false);

  // Delete confirms
  const [deleteIp, setDeleteIp]     = useState<string | null>(null);
  const [deleteSsid, setDeleteSsid] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setQrLoading(true);
      try {
        const [networksRes, settingsRes, qrRes] = await Promise.allSettled([
          orgApi.getOfficeNetworks(),
          orgApi.getSettings(),
          attendanceApi.getQRCode(),
        ]);
        if (networksRes.status === 'fulfilled') {
          const d = networksRes.value.data.data;
          setIps(d?.ips || []);
          setSsids(d?.ssids || []);
        }
        if (settingsRes.status === 'fulfilled') {
          const s = settingsRes.value.data.data;
          setOrgName(s?.name || '');
          setTimezone(s?.timezone || 'UTC');
          setLateThreshold(s?.late_threshold ?? 15);
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

  // ── IPs / CIDRs ──────────────────────────────────────
  const addIp = () => {
    const trimmed = newIp.trim();
    if (!trimmed) return;
    const ipRegex  = /^(\d{1,3}\.){3}\d{1,3}$/;
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!ipRegex.test(trimmed) && !cidrRegex.test(trimmed)) {
      toast.error('Enter a valid IP (192.168.1.1) or CIDR range (192.168.1.0/24)');
      return;
    }
    if (ips.includes(trimmed)) { toast.error('Already added'); return; }
    if (ips.length >= 20)      { toast.error('Maximum 20 entries allowed'); return; }
    setIps([...ips, trimmed]);
    setNewIp('');
  };

  const saveIPs = async () => {
    setSavingIps(true);
    try {
      await orgApi.updateOfficeIPs(ips);
      toast.success('IP / CIDR ranges saved');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingIps(false);
    }
  };

  // ── SSIDs ──────────────────────────────────────────
  const addSsid = () => {
    const trimmed = newSsid.trim();
    if (!trimmed) return;
    if (ssids.includes(trimmed)) { toast.error('Already added'); return; }
    if (ssids.length >= 10)      { toast.error('Maximum 10 SSIDs allowed'); return; }
    setSsids([...ssids, trimmed]);
    setNewSsid('');
  };

  const saveSsids = async () => {
    setSavingSsids(true);
    try {
      await orgApi.updateOfficeSSIDs(ssids);
      toast.success('WiFi network names saved');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingSsids(false);
    }
  };

  // ── QR code ──────────────────────────────────────────
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

  // ── Org settings ──────────────────────────────────────
  const saveOrgSettings = async () => {
    setSavingOrg(true);
    try {
      await orgApi.updateSettings({ name: orgName, timezone, late_threshold: lateThreshold });
      toast.success('Organisation settings saved');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingOrg(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="Settings" subtitle="Organisation configuration" />

      {/* QR Code */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-[var(--primary-600)]" />
            <h3 className="text-base font-bold text-[var(--dark-950)]">Attendance QR Code</h3>
          </div>
          {qrCode && hasRole('hr_admin', 'super_admin') && (
            <Button variant="danger" size="sm" icon={<RefreshCw size={14} />} onClick={() => setRegenConfirm(true)}>
              Regenerate
            </Button>
          )}
        </div>
        <p className="text-xs text-[var(--gray-500)] mb-6">
          Display this QR code at the office entrance. Employees scan it to check in when WiFi auto-check-in isn&apos;t available.
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
              <p className="text-xs text-[var(--gray-500)] mb-3">Generate one for your office entrance.</p>
              {hasRole('hr_admin', 'super_admin') && (
                <Button icon={<QrCode size={14} />} onClick={regenQR} loading={regenerating}>Generate QR Code</Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Organisation + Auto Check-in */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Organisation */}
        <Card className="p-6">
          <h3 className="text-base font-bold text-[var(--dark-950)] mb-4">Organisation</h3>
          <div className="space-y-4">
            <Input label="Organisation Name" value={orgName} onChange={e => setOrgName(e.target.value)} />
            <div>
              <label className="text-sm font-semibold text-[var(--dark-800)] block mb-1">Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]">
                {['UTC','Africa/Nairobi','Africa/Lagos','America/New_York','Europe/London','Asia/Dubai','Asia/Karachi','Asia/Kolkata'].map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--dark-800)] block mb-1">
                Late Arrival Threshold
                <span className="font-normal text-[var(--gray-500)] ml-1">(minutes after shift start)</span>
              </label>
              <input
                type="number" min={0} max={120} value={lateThreshold}
                onChange={e => setLateThreshold(Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))}
                className="w-full px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]"
              />
            </div>
            {hasRole('super_admin') && (
              <Button icon={<Save size={14} />} loading={savingOrg} onClick={saveOrgSettings}>Save Settings</Button>
            )}
          </div>
        </Card>

        {/* Auto Check-in: WiFi Network Names (SSIDs) — recommended */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Radio size={18} className="text-[var(--primary-600)]" />
            <h3 className="text-base font-bold text-[var(--dark-950)]">Office WiFi Names</h3>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--success-100)] text-[var(--success-700)] font-semibold">Recommended</span>
          </div>
          <div className="flex items-start gap-2 p-3 bg-[var(--primary-50)] rounded-lg border border-[var(--primary-100)] mb-4 mt-2">
            <Info size={14} className="text-[var(--primary-600)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--primary-700)]">
              Register your office WiFi network name (SSID). Works even without a static IP — the mobile app detects the network name, which never changes with DHCP.
            </p>
          </div>

          <div className="space-y-2 mb-4 min-h-[60px]">
            {ssids.length === 0 ? (
              <p className="text-sm text-[var(--gray-500)] text-center py-4">No WiFi networks registered</p>
            ) : ssids.map(ssid => (
              <div key={ssid} className="flex items-center justify-between px-3 py-2 bg-[var(--gray-50)] rounded-lg">
                <div className="flex items-center gap-2">
                  <Wifi size={13} className="text-[var(--primary-600)]" />
                  <span className="text-sm font-mono text-[var(--dark-950)]">{ssid}</span>
                </div>
                {hasRole('super_admin') && (
                  <button onClick={() => setDeleteSsid(ssid)} className="text-[var(--gray-500)] hover:text-[var(--danger-800)] transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {hasRole('super_admin') && (
            <>
              <div className="flex gap-2 mb-4">
                <input value={newSsid} onChange={e => setNewSsid(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSsid()}
                  placeholder='e.g. "Office-WiFi" or "CompanyNet"'
                  className="flex-1 px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]"
                />
                <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={addSsid}>Add</Button>
              </div>
              <Button icon={<Save size={14} />} loading={savingSsids} onClick={saveSsids} className="w-full">
                Save WiFi Names
              </Button>
            </>
          )}
        </Card>
      </div>

      {/* Office IPs / CIDR (fallback / advanced) */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Wifi size={18} className="text-[var(--gray-500)]" />
          <h3 className="text-base font-bold text-[var(--dark-950)]">Office IP Ranges</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--gray-100)] text-[var(--gray-600)] font-semibold">Advanced / Fallback</span>
        </div>
        <div className="flex items-start gap-2 p-3 bg-[var(--gray-50)] rounded-lg border border-[var(--gray-200)] mb-4 mt-2">
          <Info size={14} className="text-[var(--gray-500)] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--gray-600)]">
            Used when WiFi name matching isn&apos;t enough. Supports exact IPs (<span className="font-mono">192.168.1.5</span>) or subnet ranges (<span className="font-mono">192.168.1.0/24</span> — matches all devices on that subnet). Subnet ranges solve DHCP rotation for orgs without a static public IP.
          </p>
        </div>

        <div className="space-y-2 mb-4">
          {ips.length === 0 ? (
            <p className="text-sm text-[var(--gray-500)] text-center py-4">No IP ranges configured</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ips.map(ip => (
                <div key={ip} className="flex items-center justify-between px-3 py-2 bg-[var(--gray-50)] rounded-lg border border-[var(--gray-100)]">
                  <span className="text-sm font-mono text-[var(--dark-950)]">{ip}</span>
                  {hasRole('super_admin') && (
                    <button onClick={() => setDeleteIp(ip)} className="text-[var(--gray-500)] hover:text-[var(--danger-800)] transition-colors ml-2">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {hasRole('super_admin') && (
          <div className="flex gap-2">
            <input value={newIp} onChange={e => setNewIp(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addIp()}
              placeholder="IP (192.168.1.5) or CIDR (192.168.1.0/24)"
              className="flex-1 px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg font-mono outline-none focus:border-[var(--primary-600)]"
            />
            <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={addIp}>Add</Button>
            <Button icon={<Save size={14} />} loading={savingIps} onClick={saveIPs}>Save</Button>
          </div>
        )}
      </Card>

      {/* Additional Settings Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/settings/overtime" className="block">
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--warning-100)] flex items-center justify-center">
                  <Clock size={18} className="text-[var(--warning-800)]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--dark-950)]">Overtime Rules</h3>
                  <p className="text-xs text-[var(--gray-500)]">Multipliers &amp; thresholds</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[var(--gray-500)] group-hover:text-[var(--primary-600)] transition-colors" />
            </div>
          </Card>
        </Link>

        <Link href="/settings/whatsapp" className="block">
          <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--success-100)] flex items-center justify-center">
                  <MessageSquare size={18} className="text-[var(--success-700)]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--dark-950)]">WhatsApp Notifications</h3>
                  <p className="text-xs text-[var(--gray-500)]">Alerts &amp; integrations</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[var(--gray-500)] group-hover:text-[var(--primary-600)] transition-colors" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Confirms */}
      <ConfirmDialog
        isOpen={!!deleteIp}
        onClose={() => setDeleteIp(null)}
        onConfirm={() => { setIps(ips.filter(i => i !== deleteIp)); setDeleteIp(null); }}
        title="Remove IP Range"
        message={`Remove ${deleteIp}? Devices on this range will no longer auto-check in via IP.`}
        confirmLabel="Remove"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={!!deleteSsid}
        onClose={() => setDeleteSsid(null)}
        onConfirm={() => { setSsids(ssids.filter(s => s !== deleteSsid)); setDeleteSsid(null); }}
        title="Remove WiFi Network"
        message={`Remove "${deleteSsid}"? Employees on this network will no longer auto-check in.`}
        confirmLabel="Remove"
        variant="danger"
      />
      <ConfirmDialog
        isOpen={regenConfirm}
        onClose={() => setRegenConfirm(false)}
        onConfirm={regenQR}
        loading={regenerating}
        title="Regenerate QR Code"
        message="The current QR code will be invalidated immediately. Print and display the new code at the entrance."
        confirmLabel="Regenerate"
        variant="danger"
      />
    </DashboardLayout>
  );
}

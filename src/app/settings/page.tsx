'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, Modal, ConfirmDialog } from '@/components/ui';
import { orgApi, attendanceApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import {
  Wifi, Network, Plus, Trash2, Save, QrCode, RefreshCw, Download,
  Clock, ChevronRight, MessageSquare, Info, Search, ChevronDown, ChevronUp,
  Monitor, Smartphone, Globe, CheckCircle2, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

// ─── Network detection helpers ────────────────────────

function detectLocalIPs(): Promise<string[]> {
  return new Promise((resolve) => {
    const ips: string[] = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { pc.close(); } catch { /* ignore */ }
      resolve([...new Set(ips)]);
    };
    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.onicecandidate = (e) => {
        if (!e.candidate) { finish(); return; }
        const m = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(e.candidate.candidate);
        if (m && m[1] !== '0.0.0.0') ips.push(m[1]);
      };
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(finish);
    } catch { resolve([]); return; }
    setTimeout(finish, 3500);
  });
}

function isPrivateIp(ip: string): boolean {
  return ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip);
}

function toSubnet24(ip: string): string {
  const p = ip.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.0/24` : ip;
}

/**
 * Full IANA timezone list (every region/country) via the Intl API, so late /
 * auto-checkout math on the server matches the org's real wall clock. Falls
 * back to a curated list on the rare browser without supportedValuesOf.
 */
function allTimezones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    if (typeof intl.supportedValuesOf === 'function') {
      return ['UTC', ...intl.supportedValuesOf('timeZone').filter(tz => tz !== 'UTC')];
    }
  } catch { /* fall through */ }
  return ['UTC','Africa/Nairobi','Africa/Lagos','Africa/Cairo','America/New_York',
    'America/Chicago','America/Los_Angeles','America/Sao_Paulo','Europe/London',
    'Europe/Paris','Europe/Berlin','Asia/Dubai','Asia/Karachi','Asia/Kolkata',
    'Asia/Dhaka','Asia/Singapore','Asia/Shanghai','Asia/Tokyo','Australia/Sydney'];
}
const TIMEZONES = allTimezones();

// ─── Types ────────────────────────────────────────────
type NetworkEntry = { type: 'ssid'; value: string } | { type: 'ip'; value: string };
interface DetectedIp { ip: string; label: string; }

// ─── Shared chip style ────────────────────────────────
const pillClass = (active: boolean) =>
  `px-4 py-1.5 text-sm font-semibold rounded-full cursor-pointer transition-all border ${
    active
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
      : 'bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-800/60'
  }`;

// ─── Add-Network Modal ────────────────────────────────
interface AddNetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: NetworkEntry) => void;
  existingIps: string[];
  existingSsids: string[];
}

function AddNetworkModal({ isOpen, onClose, onAdd, existingIps, existingSsids }: AddNetworkModalProps) {
  const [tab, setTab]               = useState<'ssid' | 'ip'>('ssid');
  const [ssidInput, setSsidInput]   = useState('');
  const [ipInput, setIpInput]       = useState('');
  const [detecting, setDetecting]   = useState(false);
  const [detected, setDetected]     = useState<DetectedIp[]>([]);
  const [showHelp, setShowHelp]     = useState(false);

  const reset = () => { setSsidInput(''); setIpInput(''); setDetected([]); setShowHelp(false); setTab('ssid'); };

  const handleClose = () => { reset(); onClose(); };

  const detectNetwork = async () => {
    setDetecting(true);
    setDetected([]);
    const results: DetectedIp[] = [];
    try {
      const localIps = await detectLocalIPs();
      localIps.filter(isPrivateIp).forEach(ip => results.push({ ip, label: 'LAN (browser)' }));
    } catch { /* WebRTC blocked */ }
    try {
      const { data } = await orgApi.detectMyIp();
      const serverIp: string = data.data?.ip || '';
      if (serverIp && !results.some(r => r.ip === serverIp)) {
        results.push({ ip: serverIp, label: 'Server-seen' });
      }
    } catch { /* ignore */ }
    setDetected(results);
    setDetecting(false);
    if (results.length === 0) {
      toast.error('Could not detect any IP — check browser permissions or add manually');
    }
  };

  const handleAdd = () => {
    if (tab === 'ssid') {
      const val = ssidInput.trim();
      if (!val) return;
      if (existingSsids.includes(val)) { toast.error('Already in the list'); return; }
      if (existingSsids.length >= 10)  { toast.error('Maximum 10 WiFi names'); return; }
      onAdd({ type: 'ssid', value: val });
    } else {
      const val = ipInput.trim();
      if (!val) return;
      const ipRegex   = /^(\d{1,3}\.){3}\d{1,3}$/;
      const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
      if (!ipRegex.test(val) && !cidrRegex.test(val)) {
        toast.error('Enter a valid IP (192.168.1.5) or CIDR (192.168.1.0/24)');
        return;
      }
      if (existingIps.includes(val)) { toast.error('Already in the list'); return; }
      if (existingIps.length >= 20)  { toast.error('Maximum 20 IP entries'); return; }
      onAdd({ type: 'ip', value: val });
    }
    reset();
    onClose();
  };

  const pickIp = (ip: string) => { setIpInput(ip); };
  const pickSubnet = (ip: string) => { setIpInput(toSubnet24(ip)); };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Office Network"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAdd} icon={<Plus size={14} />}>
            Add Network
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Tab selector */}
        <div className="flex gap-2">
          <button className={pillClass(tab === 'ssid')} onClick={() => setTab('ssid')}>
            📶 WiFi Name (SSID)
          </button>
          <button className={pillClass(tab === 'ip')} onClick={() => setTab('ip')}>
            🌐 IP / CIDR Range
          </button>
        </div>

        {tab === 'ssid' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <Info size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300">
                <strong className="text-emerald-400">Recommended.</strong> Works even with DHCP — the network name never changes.
                Employees&apos; phones detect the WiFi name and check in automatically.
              </p>
            </div>

            <Input
              label="WiFi Network Name"
              placeholder='e.g. "Office-WiFi" or "CompanyNet"'
              value={ssidInput}
              onChange={e => setSsidInput(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleAdd()}
              autoFocus
            />

            {/* How to find SSID */}
            <button
              type="button"
              onClick={() => setShowHelp(h => !h)}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
            >
              {showHelp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              How to find your WiFi name
            </button>

            {showHelp && (
              <div className="rounded-xl border border-glass overflow-hidden text-xs">
                {[
                  { icon: Monitor, label: 'Windows', desc: 'Click the WiFi icon in the taskbar → the checked network is your SSID' },
                  { icon: Monitor, label: 'macOS', desc: 'Click the WiFi icon in the menu bar → the ticked network at the top' },
                  { icon: Smartphone, label: 'Android / iOS', desc: 'Settings → WiFi → the connected network name at the top' },
                  { icon: Globe, label: 'Router admin page', desc: 'Log in to 192.168.1.1 → Wireless settings → SSID field' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3 px-3 py-2.5 border-b last:border-b-0 border-glass">
                    <Icon size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-200">{label}</p>
                      <p className="text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-slate-800/40 rounded-xl border border-glass">
              <Info size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400">
                Use for orgs with static IPs or VPNs. Supports exact IPs (<span className="font-mono text-slate-200">192.168.1.5</span>) or
                subnets (<span className="font-mono text-slate-200">192.168.1.0/24</span> — covers entire floor).
              </p>
            </div>

            <Input
              label="IP Address or CIDR Range"
              placeholder="192.168.1.0/24"
              value={ipInput}
              onChange={e => setIpInput(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleAdd()}
              className="font-mono"
            />

            <Button
              variant="outline"
              size="sm"
              icon={<Search size={13} />}
              loading={detecting}
              onClick={detectNetwork}
              className="w-full"
            >
              {detecting ? 'Scanning for your IP…' : 'Detect My IP Automatically'}
            </Button>

            {detected.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Detected on this device</p>
                {detected.map(({ ip, label }) => (
                  <div key={ip} className="flex items-center justify-between px-3 py-2.5 bg-slate-800/40 rounded-xl border border-emerald-500/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <Wifi size={13} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-sm font-mono font-semibold text-slate-100 truncate">{ip}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{label}</span>
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-3">
                      <button
                        type="button"
                        onClick={() => pickIp(ip)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      >
                        Exact
                      </button>
                      <button
                        type="button"
                        onClick={() => pickSubnet(ip)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-700/50 transition-colors"
                      >
                        /24 Subnet
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-400">/24 subnet recommended</strong> — covers the whole floor even if DHCP rotates IPs.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────
export default function SettingsPage() {
  const { hasRole } = useAuth();

  const [ips, setIps]     = useState<string[]>([]);
  const [ssids, setSsids] = useState<string[]>([]);
  const [savingNetworks, setSavingNetworks] = useState(false);
  const [networksChanged, setNetworksChanged] = useState(false);

  const [showAddModal, setShowAddModal]   = useState(false);
  const [deleteEntry, setDeleteEntry]     = useState<NetworkEntry | null>(null);

  const [qrCode, setQrCode]         = useState<string | null>(null);
  const [qrLoading, setQrLoading]   = useState(false);
  const [regenConfirm, setRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [orgName, setOrgName]           = useState('');
  const [timezone, setTimezone]         = useState('UTC');
  const [lateThreshold, setLateThreshold] = useState(15);
  const [savingOrg, setSavingOrg]       = useState(false);

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

  const handleAddEntry = (entry: NetworkEntry) => {
    if (entry.type === 'ssid') setSsids(prev => [...prev, entry.value]);
    else                        setIps(prev => [...prev, entry.value]);
    setNetworksChanged(true);
  };

  const handleDeleteEntry = (entry: NetworkEntry) => {
    if (entry.type === 'ssid') setSsids(prev => prev.filter(s => s !== entry.value));
    else                        setIps(prev => prev.filter(i => i !== entry.value));
    setDeleteEntry(null);
    setNetworksChanged(true);
  };

  const saveNetworks = async () => {
    setSavingNetworks(true);
    try {
      await Promise.all([
        orgApi.updateOfficeIPs(ips),
        orgApi.updateOfficeSSIDs(ssids),
      ]);
      toast.success('Office networks saved');
      setNetworksChanged(false);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingNetworks(false);
    }
  };

  const regenQR = async () => {
    setRegenerating(true);
    try {
      const { data } = await attendanceApi.regenerateQR();
      const qr = data.data;
      setQrCode(qr?.qr_code_url || qr?.qr_code_base64 || null);
      toast.success('QR code regenerated');
      setRegenConfirm(false);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setRegenerating(false);
    }
  };

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

  const totalNetworks = ssids.length + ips.length;
  const isConfigured = totalNetworks > 0;

  // Build unified list for display
  const networkEntries: NetworkEntry[] = [
    ...ssids.map(s => ({ type: 'ssid' as const, value: s })),
    ...ips.map(i => ({ type: 'ip' as const, value: i })),
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Settings" subtitle="Organisation configuration" />

      {/* ── Organisation Settings ─────────────────────── */}
      <Card className="glass-card p-6 mb-6">
        <h3 className="text-base font-bold text-slate-100 mb-4">Organisation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <Input
            label="Organisation Name"
            value={orgName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrgName(e.target.value)}
          />
          <div>
            <label className="text-sm font-semibold text-slate-300 block mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-glass rounded-lg text-slate-100 outline-none focus:border-emerald-500/50"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz} className="bg-slate-900 text-slate-100">{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-300 block mb-1">
              Late Threshold
              <span className="font-normal text-slate-500 ml-1">(mins after shift start)</span>
            </label>
            <input
              type="number" min={0} max={120} value={lateThreshold}
              onChange={e => setLateThreshold(Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))}
              className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-glass rounded-lg text-slate-100 outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
        {hasRole('super_admin') && (
          <Button icon={<Save size={14} />} loading={savingOrg} onClick={saveOrgSettings} size="sm">
            Save Settings
          </Button>
        )}
      </Card>

      {/* ── Office Networks ───────────────────────────── */}
      <Card className="glass-card p-6 mb-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isConfigured ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
              <Wifi size={18} className={isConfigured ? 'text-emerald-400' : 'text-amber-400'} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Office Networks</h3>
              <p className="text-xs text-slate-400">WiFi auto check-in configuration for the mobile app</p>
            </div>
          </div>

          {/* Status pill */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            isConfigured
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {isConfigured
              ? <><CheckCircle2 size={12} /> {totalNetworks} network{totalNetworks !== 1 ? 's' : ''} configured</>
              : <><AlertCircle size={12} /> Auto check-in not set up</>
            }
          </div>
        </div>

        {!isConfigured && (
          <div className="flex items-start gap-2 p-3 bg-amber-500/5 rounded-xl border border-amber-500/20 mb-4">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/80">
              No networks configured. Employees can&apos;t auto check-in via WiFi until you add at least one office network.
              WiFi name matching is recommended — it works even without a static IP.
            </p>
          </div>
        )}

        {/* Network list */}
        <div className={`rounded-xl border border-glass overflow-hidden mb-4 ${networkEntries.length === 0 ? 'hidden' : ''}`}>
          {networkEntries.map((entry, i) => (
            <div
              key={`${entry.type}-${entry.value}`}
              className={`flex items-center gap-3 px-4 py-3 ${i < networkEntries.length - 1 ? 'border-b border-glass' : ''} hover:bg-white/5 transition-colors group`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                entry.type === 'ssid' ? 'bg-emerald-500/10' : 'bg-slate-700/50'
              }`}>
                {entry.type === 'ssid'
                  ? <Wifi size={13} className="text-emerald-400" />
                  : <Network size={13} className="text-slate-400" />
                }
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-sm font-mono font-semibold text-slate-200 truncate block">{entry.value}</span>
              </div>

              <span className={`hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                entry.type === 'ssid'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
              }`}>
                {entry.type === 'ssid' ? 'WiFi Name' : 'IP Range'}
              </span>

              {hasRole('super_admin') && (
                <button
                  onClick={() => setDeleteEntry(entry)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-rose-400 ml-1"
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {networkEntries.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center rounded-xl border border-dashed border-glass mb-4">
            <Wifi size={28} className="text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-500">No office networks added yet</p>
            <p className="text-xs text-slate-600 mt-1">Add a WiFi name or IP range to enable auto check-in</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {hasRole('super_admin') && (
            <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddModal(true)}>
              Add Network
            </Button>
          )}
          {networksChanged && hasRole('super_admin') && (
            <Button
              size="sm"
              icon={<Save size={14} />}
              loading={savingNetworks}
              onClick={saveNetworks}
            >
              Save Changes
            </Button>
          )}
          {!networksChanged && networkEntries.length > 0 && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-500" />
              Saved
            </span>
          )}

          {/* Legend */}
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Wifi size={11} className="text-emerald-500/70" />
              WiFi = more reliable
            </span>
            <span className="flex items-center gap-1">
              <Network size={11} className="text-slate-600" />
              IP = advanced/fallback
            </span>
          </div>
        </div>
      </Card>

      {/* ── Attendance QR Code ────────────────────────── */}
      <Card className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <QrCode size={18} className="text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Attendance QR Code</h3>
              <p className="text-xs text-slate-400">Display at the office entrance for manual scan check-in</p>
            </div>
          </div>
          {qrCode && hasRole('hr_admin', 'super_admin') && (
            <Button variant="outline" size="sm" icon={<RefreshCw size={13} />} onClick={() => setRegenConfirm(true)}>
              Regenerate
            </Button>
          )}
        </div>

        {qrLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : qrCode ? (
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="p-4 bg-white border-2 border-glass rounded-2xl shadow-lg flex-shrink-0">
              <img src={qrCode} alt="Attendance QR Code" className="w-40 h-40" />
            </div>
            <div className="space-y-2 text-sm text-slate-400">
              <p className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-500" /> Print and display at the office entrance</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-500" /> Employees scan using the Attenda mobile app</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={13} className="text-emerald-500" /> Auto-rotates every 24 hours for security</p>
              <div className="pt-2">
                <a href={qrCode} download="attenda-qr.png">
                  <Button variant="outline" size="sm" icon={<Download size={13} />}>Download PNG</Button>
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-5 py-2">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/50 flex items-center justify-center flex-shrink-0 border border-glass">
              <QrCode size={24} className="text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200 mb-1">No QR code generated yet</p>
              <p className="text-xs text-slate-500 mb-3">Generate one for your office entrance.</p>
              {hasRole('hr_admin', 'super_admin') && (
                <Button size="sm" icon={<QrCode size={13} />} onClick={regenQR} loading={regenerating}>
                  Generate QR Code
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── More Settings ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            href: '/settings/overtime',
            icon: Clock, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-400',
            title: 'Overtime Rules', sub: 'Multipliers & thresholds',
          },
          {
            href: '/settings/whatsapp',
            icon: MessageSquare, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400',
            title: 'WhatsApp Notifications', sub: 'Alerts & integrations',
          },
        ].map(({ href, icon: Icon, iconBg, iconColor, title, sub }) => (
          <Link href={href} key={href} className="block">
            <Card className="glass-card p-5 hover:border-emerald-500/30 transition-all cursor-pointer group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
                    <Icon size={18} className={iconColor} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{title}</h3>
                    <p className="text-xs text-slate-400">{sub}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-emerald-400 transition-colors" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Modals & Confirms ────────────────────────── */}
      <AddNetworkModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddEntry}
        existingIps={ips}
        existingSsids={ssids}
      />

      <ConfirmDialog
        isOpen={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
        onConfirm={() => deleteEntry && handleDeleteEntry(deleteEntry)}
        title={deleteEntry?.type === 'ssid' ? 'Remove WiFi Network' : 'Remove IP Range'}
        message={
          deleteEntry?.type === 'ssid'
            ? `Remove "${deleteEntry.value}"? Employees on this network won't auto check-in.`
            : `Remove ${deleteEntry?.value}? Devices on this range won't auto check-in via IP.`
        }
        confirmLabel="Remove"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={regenConfirm}
        onClose={() => setRegenConfirm(false)}
        onConfirm={regenQR}
        loading={regenerating}
        title="Regenerate QR Code"
        message="The current QR code will stop working immediately. Print and display the new code at your entrance."
        confirmLabel="Regenerate"
        variant="danger"
      />
    </DashboardLayout>
  );
}

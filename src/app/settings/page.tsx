'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button, Input, ConfirmDialog } from '@/components/ui';
import { orgApi, attendanceApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import {
  Wifi, Radio, Plus, Trash2, Save, QrCode, RefreshCw, Download,
  Clock, ChevronRight, MessageSquare, Info, Search, ChevronDown, ChevronUp,
  Monitor, Smartphone, Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

// ─── Network detection helpers ────────────────────────

/** Detect LAN IPs via WebRTC ICE candidates (works without a STUN server). */
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
      pc.createOffer()
        .then(o => pc.setLocalDescription(o))
        .catch(finish);
    } catch {
      resolve([]);
      return;
    }
    setTimeout(finish, 3500);
  });
}

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)
  );
}

function toSubnet24(ip: string): string {
  const p = ip.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.0/24` : ip;
}

// ─── Component ────────────────────────────────────────

interface DetectedIp { ip: string; label: string; }

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

  // Network auto-detection
  const [detecting, setDetecting]       = useState(false);
  const [detectedIps, setDetectedIps]   = useState<DetectedIp[]>([]);
  const [showSsidHelp, setShowSsidHelp] = useState(false);

  // QR code
  const [qrCode, setQrCode]             = useState<string | null>(null);
  const [qrLoading, setQrLoading]       = useState(false);
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
  const addIp = useCallback((value?: string) => {
    const trimmed = (value ?? newIp).trim();
    if (!trimmed) return;
    const ipRegex   = /^(\d{1,3}\.){3}\d{1,3}$/;
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!ipRegex.test(trimmed) && !cidrRegex.test(trimmed)) {
      toast.error('Enter a valid IP (192.168.1.1) or CIDR range (192.168.1.0/24)');
      return;
    }
    if (ips.includes(trimmed)) { toast.error('Already in the list'); return; }
    if (ips.length >= 20)      { toast.error('Maximum 20 entries'); return; }
    setIps(prev => [...prev, trimmed]);
    if (!value) setNewIp('');
  }, [newIp, ips]);

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
  const addSsid = (value?: string) => {
    const trimmed = (value ?? newSsid).trim();
    if (!trimmed) return;
    if (ssids.includes(trimmed)) { toast.error('Already in the list'); return; }
    if (ssids.length >= 10)      { toast.error('Maximum 10 SSIDs'); return; }
    setSsids(prev => [...prev, trimmed]);
    if (!value) setNewSsid('');
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

  // ── Network detection ─────────────────────────────
  const detectNetwork = useCallback(async () => {
    setDetecting(true);
    setDetectedIps([]);
    const results: DetectedIp[] = [];

    // 1. WebRTC LAN IPs (browser-side, no server needed)
    try {
      const localIps = await detectLocalIPs();
      localIps
        .filter(isPrivateIp)
        .forEach(ip => results.push({ ip, label: 'LAN (browser)' }));
    } catch { /* WebRTC blocked */ }

    // 2. Server-seen IP (catches public IP / NAT exit)
    try {
      const { data } = await orgApi.detectMyIp();
      const serverIp: string = data.data?.ip || '';
      if (serverIp && !results.some(r => r.ip === serverIp)) {
        results.push({ ip: serverIp, label: 'Seen by server' });
      }
    } catch { /* ignore */ }

    setDetectedIps(results);
    setDetecting(false);

    if (results.length === 0) {
      toast.error('Could not detect any IP — add one manually or check your browser permissions');
    }
  }, []);

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

      {/* Organisation + WiFi Names */}
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

        {/* Auto Check-in: WiFi Network Names (SSIDs) */}
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
              <div className="flex gap-2 mb-3">
                <input value={newSsid} onChange={e => setNewSsid(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSsid()}
                  placeholder='e.g. "Office-WiFi" or "CompanyNet"'
                  className="flex-1 px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]"
                />
                <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => addSsid()}>Add</Button>
              </div>

              {/* How to find your WiFi name */}
              <button
                type="button"
                onClick={() => setShowSsidHelp(h => !h)}
                className="flex items-center gap-1.5 text-xs text-[var(--primary-600)] hover:text-[var(--primary-700)] font-semibold mb-3 transition-colors"
              >
                {showSsidHelp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                How to find your WiFi name
              </button>

              {showSsidHelp && (
                <div className="mb-3 rounded-xl border border-[var(--gray-200)] overflow-hidden text-xs">
                  <div className="px-3 py-2 bg-[var(--gray-50)] border-b border-[var(--gray-200)] font-semibold text-[var(--dark-800)]">
                    Browser security prevents reading WiFi names automatically — find it manually:
                  </div>
                  <div className="divide-y divide-[var(--gray-100)]">
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      <Monitor size={14} className="text-[var(--gray-500)] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[var(--dark-800)]">Windows</p>
                        <p className="text-[var(--gray-500)]">Click the WiFi icon in the taskbar → the checked network name is your SSID</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      <Monitor size={14} className="text-[var(--gray-500)] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[var(--dark-800)]">macOS</p>
                        <p className="text-[var(--gray-500)]">Click the WiFi icon in the menu bar → the ticked network at the top is your SSID</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      <Smartphone size={14} className="text-[var(--gray-500)] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[var(--dark-800)]">Android / iOS</p>
                        <p className="text-[var(--gray-500)]">Settings → WiFi → the connected network name at the top is your SSID</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 px-3 py-2.5">
                      <Globe size={14} className="text-[var(--gray-500)] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[var(--dark-800)]">Router admin page</p>
                        <p className="text-[var(--gray-500)]">Log into your router (usually 192.168.1.1) → Wireless settings → SSID field</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button icon={<Save size={14} />} loading={savingSsids} onClick={saveSsids} className="w-full">
                Save WiFi Names
              </Button>
            </>
          )}
        </Card>
      </div>

      {/* Office IPs / CIDR */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Wifi size={18} className="text-[var(--gray-500)]" />
          <h3 className="text-base font-bold text-[var(--dark-950)]">Office IP Ranges</h3>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-[var(--gray-100)] text-[var(--gray-600)] font-semibold">Advanced / Fallback</span>
        </div>
        <div className="flex items-start gap-2 p-3 bg-[var(--gray-50)] rounded-lg border border-[var(--gray-200)] mb-4 mt-2">
          <Info size={14} className="text-[var(--gray-500)] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--gray-600)]">
            Used when WiFi name matching isn&apos;t enough. Supports exact IPs (<span className="font-mono">192.168.1.5</span>) or subnet ranges (<span className="font-mono">192.168.1.0/24</span> — matches all devices on that subnet).
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
          <>
            {/* Manual add */}
            <div className="flex gap-2 mb-4">
              <input value={newIp} onChange={e => setNewIp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addIp()}
                placeholder="IP (192.168.1.5) or CIDR (192.168.1.0/24)"
                className="flex-1 px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg font-mono outline-none focus:border-[var(--primary-600)]"
              />
              <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => addIp()}>Add</Button>
              <Button icon={<Save size={14} />} loading={savingIps} onClick={saveIPs}>Save</Button>
            </div>

            {/* ── Auto-detect panel ─────────────────────── */}
            <div className="border border-[var(--primary-200)] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[var(--primary-50)]">
                <div className="flex items-center gap-2">
                  <Search size={14} className="text-[var(--primary-600)]" />
                  <span className="text-sm font-semibold text-[var(--primary-700)]">Detect My Network</span>
                  <span className="text-xs text-[var(--primary-500)]">— auto-fill IP from this device</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  loading={detecting}
                  icon={<Search size={13} />}
                  onClick={detectNetwork}
                >
                  {detecting ? 'Scanning…' : 'Detect'}
                </Button>
              </div>

              {detectedIps.length > 0 ? (
                <div className="p-3 space-y-2">
                  {detectedIps.map(({ ip, label }) => (
                    <div key={ip} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-[var(--primary-100)]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Wifi size={13} className="text-[var(--primary-600)] flex-shrink-0" />
                        <span className="text-sm font-mono font-semibold text-[var(--dark-950)] truncate">{ip}</span>
                        <span className="text-xs text-[var(--gray-500)] whitespace-nowrap">{label}</span>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => { addIp(ip); toast.success(`Added exact IP: ${ip}`); }}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--primary-300)] text-[var(--primary-700)] hover:bg-[var(--primary-100)] transition-colors"
                        >
                          + Exact IP
                        </button>
                        <button
                          type="button"
                          onClick={() => { const s = toSubnet24(ip); addIp(s); toast.success(`Added subnet: ${s}`); }}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[var(--gray-300)] text-[var(--gray-700)] hover:bg-[var(--gray-100)] transition-colors"
                        >
                          + /24 Subnet
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-[var(--gray-500)] px-1 pt-1">
                    <strong>/24 subnet</strong> (recommended) covers the whole office floor even if DHCP rotates IPs. Exact IP only works for a single device.
                    Don&apos;t forget to <strong>Save</strong> after adding.
                  </p>
                </div>
              ) : (
                <div className="px-4 py-3 text-xs text-[var(--gray-500)]">
                  Click <strong>Detect</strong> to scan this device&apos;s IP. The browser reads your LAN IP and the server records what it sees — both are shown so you can pick the right one to register.
                </div>
              )}
            </div>
          </>
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

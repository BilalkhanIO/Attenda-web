'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Input, Modal, ConfirmDialog, Skeleton, Dropdown
} from '@/components/ui';
import DepartmentsCard from '@/components/settings/DepartmentsCard';
import AuditLogCard from '@/components/settings/AuditLogCard';
import AccessControlModal from '@/components/settings/AccessControlModal';
import OvertimeRulesModal from '@/components/settings/OvertimeRulesModal';
import WhatsAppSettingsModal from '@/components/settings/WhatsAppSettingsModal';
import { orgApi, attendanceApi, usersApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { keys } from '@/lib/queries';
import {
  Wifi, Network, Plus, Trash2, Save, RefreshCw, Download,
  Clock, MessageSquare, Search, Shield, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

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


const TIMEZONES = [
  'UTC', 'Africa/Nairobi', 'Africa/Lagos', 'Africa/Cairo', 'America/New_York',
  'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo', 'Europe/London',
  'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata',
  'Asia/Dhaka', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney'
];

type NetworkEntry = { type: 'ssid'; value: string } | { type: 'ip'; value: string };
interface DetectedIp { ip: string; label: string; }

// ─── Add-Network Modal ────────────────────────────────
interface AddNetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: NetworkEntry) => void;
}

function AddNetworkModal({ isOpen, onClose, onAdd }: AddNetworkModalProps) {
  const [tab, setTab] = useState<'ssid' | 'ip'>('ssid');
  const [ssidInput, setSsidInput] = useState('');
  const [ipInput, setIpInput] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedIp[]>([]);

  const handleAdd = () => {
    if (tab === 'ssid') {
      if (!ssidInput.trim()) return;
      onAdd({ type: 'ssid', value: ssidInput.trim() });
    } else {
      if (!ipInput.trim()) return;
      onAdd({ type: 'ip', value: ipInput.trim() });
    }
    setSsidInput(''); setIpInput(''); onClose();
  };

  const detectNetwork = async () => {
    setDetecting(true);
    const results: DetectedIp[] = [];
    try {
      const localIps = await detectLocalIPs();
      localIps.filter(isPrivateIp).forEach(ip => results.push({ ip, label: 'Local Scan' }));
      const { data } = await orgApi.detectMyIp();
      if (data.data?.ip) results.push({ ip: data.data.ip, label: 'Server IP' });
    } catch {}
    setDetected(results);
    setDetecting(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Network Entrance" size="sm">
      <div className="space-y-4">
        <div className="flex bg-[var(--glass-05)] p-1 rounded-xl border border-[var(--glass-border)]">
          {(['ssid', 'ip'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={cn(
              'flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all',
              tab === t ? 'bg-[var(--primary-600)] text-white shadow-lg' : 'text-[var(--on-glass-dim)] hover:text-white'
            )}>
              {t === 'ssid' ? 'WiFi Name' : 'IP Address'}
            </button>
          ))}
        </div>

        {tab === 'ssid' ? (
          <Input label="Network SSID" placeholder="e.g. Office_Guest" value={ssidInput} onChange={e => setSsidInput(e.target.value)} autoFocus />
        ) : (
          <div className="space-y-3">
            <Input label="IP or CIDR" placeholder="192.168.1.0/24" value={ipInput} onChange={e => setIpInput(e.target.value)} />
            <Button variant="ghost" size="sm" className="w-full" loading={detecting} onClick={detectNetwork} icon={<Search size={14} />}>Detect My IP</Button>
            {detected.map(d => (
              <button key={d.ip} onClick={() => setIpInput(d.ip)} className="w-full flex items-center justify-between p-2 rounded-xl bg-[var(--glass-10)] border border-[var(--glass-border)] hover:bg-[var(--glass-15)] transition-all">
                <span className="text-[10px] font-mono text-white">{d.ip}</span>
                <span className="text-[9px] font-black uppercase text-[var(--on-glass-dim)]">{d.label}</span>
              </button>
            ))}
          </div>
        )}
        <Button className="w-full" onClick={handleAdd}>Add to List</Button>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────
export default function SettingsPage() {
  const queryClient = useQueryClient();

  // ── States ──
  const [activeModal, setActiveModal] = useState<'access' | 'overtime' | 'whatsapp' | null>(null);
  const [showAddNetwork, setShowAddNetwork] = useState(false);
  const [deleteNetwork, setDeleteNetwork] = useState<NetworkEntry | null>(null);

  // Form states
  const [orgData, setOrgData] = useState({
    name: '', timezone: 'UTC', late_threshold: 15, address: '', phone: '', website: '', industry: ''
  });
  const [networks, setNetworks] = useState<{ ips: string[], ssids: string[] }>({ ips: [], ssids: [] });
  const [networksChanged, setNetworksChanged] = useState(false);

  // ── Queries ──
  const usersQuery = useQuery({ queryKey: keys.users.all, queryFn: async () => (await usersApi.getAll({ limit: 1000 })).data.data ?? [] });
  const settingsQuery = useQuery({ queryKey: ['org-settings'], queryFn: async () => (await orgApi.getSettings()).data.data });
  const networksQuery = useQuery({ queryKey: ['org-networks'], queryFn: async () => (await orgApi.getOfficeNetworks()).data.data });
  const qrQuery = useQuery({ queryKey: ['attendance-qr'], queryFn: async () => (await attendanceApi.getQRCode()).data.data });

  // Seed the editable form state whenever fresh server data arrives
  // ("adjusting state when props change" pattern — no effect needed).
  const [seededSettings, setSeededSettings] = useState(settingsQuery.data);
  if (settingsQuery.data !== seededSettings) {
    setSeededSettings(settingsQuery.data);
    if (settingsQuery.data) setOrgData(settingsQuery.data);
  }

  const [seededNetworks, setSeededNetworks] = useState(networksQuery.data);
  if (networksQuery.data !== seededNetworks) {
    setSeededNetworks(networksQuery.data);
    if (networksQuery.data) setNetworks({ ips: networksQuery.data.ips || [], ssids: networksQuery.data.ssids || [] });
  }

  // ── Mutations ──
  const saveOrgMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => orgApi.updateSettings(data),
    onSuccess: () => toast.success('Settings saved'),
    onError: (err) => toast.error(getApiError(err)),
  });

  const saveNetworksMutation = useMutation({
    mutationFn: async () => {
      await orgApi.updateOfficeIPs(networks.ips);
      await orgApi.updateOfficeSSIDs(networks.ssids);
    },
    onSuccess: () => {
      toast.success('Networks saved');
      setNetworksChanged(false);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const regenQRMutation = useMutation({
    mutationFn: () => attendanceApi.regenerateQR(),
    onSuccess: () => {
      toast.success('QR code rotated');
      queryClient.invalidateQueries({ queryKey: ['attendance-qr'] });
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const handleAddNetwork = (e: NetworkEntry) => {
    setNetworks(prev => ({
      ...prev,
      [e.type === 'ssid' ? 'ssids' : 'ips']: [...prev[e.type === 'ssid' ? 'ssids' : 'ips'], e.value]
    }));
    setNetworksChanged(true);
  };

  const removeNetwork = (e: NetworkEntry) => {
    setNetworks(prev => ({
      ...prev,
      [e.type === 'ssid' ? 'ssids' : 'ips']: prev[e.type === 'ssid' ? 'ssids' : 'ips'].filter(v => v !== e.value)
    }));
    setNetworksChanged(true);
    setDeleteNetwork(null);
  };

  const menuItems = [
    { id: 'access' as const, label: 'Access Control', sub: 'Roles & Overrides', icon: Shield, color: 'var(--secondary)' },
    { id: 'overtime' as const, label: 'Overtime Rules', sub: 'Rate Calculations', icon: Clock, color: 'var(--warning-500)' },
    { id: 'whatsapp' as const, label: 'WhatsApp Bot', sub: 'Alert Integrations', icon: MessageSquare, color: 'var(--success-500)' },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Settings" subtitle="System & Organisation Management" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Main Config */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[11px] font-black uppercase text-[var(--primary-600)] tracking-widest">General Configuration</p>
              <Button size="sm" icon={<Save size={14} />} loading={saveOrgMutation.isPending} onClick={() => saveOrgMutation.mutate(orgData)}>Save Settings</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <Input label="Organisation Name" value={orgData.name} onChange={e => setOrgData(d => ({ ...d, name: e.target.value }))} />
              <Dropdown label="Timezone" value={orgData.timezone} onChange={v => setOrgData(d => ({ ...d, timezone: v }))} options={TIMEZONES.map(t => ({ value: t, label: t.replace('_', ' ') }))} />
              <Input label="Late Threshold (mins)" type="number" value={orgData.late_threshold} onChange={e => setOrgData(d => ({ ...d, late_threshold: +e.target.value }))} />
              <Input label="Industry" value={orgData.industry} onChange={e => setOrgData(d => ({ ...d, industry: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Input label="Office Phone" value={orgData.phone} onChange={e => setOrgData(d => ({ ...d, phone: e.target.value }))} />
              <div className="md:col-span-2">
                <Input label="Office Address" value={orgData.address} onChange={e => setOrgData(d => ({ ...d, address: e.target.value }))} />
              </div>
            </div>
          </Card>

          <DepartmentsCard />
          <AuditLogCard />
        </div>

        {/* Right Column: Entrance & Quick Access */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Access Grid */}
          <div className="grid grid-cols-1 gap-3">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveModal(item.id)}
                className="group flex items-center gap-4 p-4 rounded-2xl bg-[var(--glass-10)] border border-[var(--glass-border)] hover:bg-[var(--glass-15)] hover:border-[var(--primary-600)]/30 transition-all text-left relative overflow-hidden"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--glass-10)] border border-[var(--glass-border)] flex items-center justify-center group-hover:scale-110 transition-transform" style={{ color: item.color }}>
                  <item.icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-white">{item.label}</p>
                  <p className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase tracking-wider mt-0.5">{item.sub}</p>
                </div>
                <ExternalLink size={14} className="text-[var(--on-glass-dim)] group-hover:text-white transition-colors" />
              </button>
            ))}
          </div>

          {/* Entrance Config */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-5">
              <p className="text-[11px] font-black uppercase text-[var(--secondary)] tracking-widest">Office Entrances</p>
              <div className="flex gap-2">
                {networksChanged && <Button size="sm" variant="outline" icon={<Save size={12} />} onClick={() => saveNetworksMutation.mutate()} />}
                <button onClick={() => setShowAddNetwork(true)} aria-label="Add office network" title="Add office network" className="w-7 h-7 flex items-center justify-center rounded-lg bg-[var(--primary-600)] text-white hover:brightness-110 transition-all">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {[...networks.ssids.map(s => ({ type: 'ssid' as const, value: s })), ...networks.ips.map(i => ({ type: 'ip' as const, value: i }))].map(n => (
                <div key={n.value} className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--glass-05)] border border-[var(--glass-border)] group">
                  <div className="flex items-center gap-2 min-w-0">
                    {n.type === 'ssid' ? <Wifi size={12} className="text-[var(--success-500)]" /> : <Network size={12} className="text-[var(--secondary)]" />}
                    <span className="text-[11px] font-mono text-white truncate">{n.value}</span>
                  </div>
                  <button onClick={() => setDeleteNetwork(n)} aria-label={`Remove ${n.value}`} title="Remove network" className="text-[var(--on-glass-dim)] hover:text-[var(--danger-500)] opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {networks.ips.length === 0 && networks.ssids.length === 0 && (
                <div className="py-4 text-center border border-dashed border-[var(--glass-border)] rounded-xl">
                  <p className="text-[10px] text-[var(--on-glass-dim)] font-bold uppercase">No entrances set</p>
                </div>
              )}
            </div>

            {/* QR Code Section */}
            <div className="pt-5 border-t border-[var(--glass-border)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-black uppercase text-[var(--on-glass-muted)] tracking-widest">Entrance QR</p>
                <button onClick={() => regenQRMutation.mutate()} className="text-[10px] font-black text-[var(--primary-600)] hover:text-white flex items-center gap-1 transition-all">
                  <RefreshCw size={10} /> Rotate
                </button>
              </div>
              <div className="bg-white p-3 rounded-2xl flex items-center justify-center relative group overflow-hidden">
                {qrQuery.isLoading ? <Skeleton className="w-32 h-32" /> : <img src={qrQuery.data?.qr_code} className="w-32 h-32" alt="QR" />}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <a href={qrQuery.data?.qr_code} download="attenda-qr.png" className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[var(--dark-950)] hover:scale-110 transition-transform">
                    <Download size={18} />
                  </a>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <AccessControlModal isOpen={activeModal === 'access'} onClose={() => setActiveModal(null)} users={usersQuery.data || []} />
      <OvertimeRulesModal isOpen={activeModal === 'overtime'} onClose={() => setActiveModal(null)} />
      <WhatsAppSettingsModal isOpen={activeModal === 'whatsapp'} onClose={() => setActiveModal(null)} />

      <AddNetworkModal isOpen={showAddNetwork} onClose={() => setShowAddNetwork(false)} onAdd={handleAddNetwork} />

      <ConfirmDialog
        isOpen={!!deleteNetwork}
        onClose={() => setDeleteNetwork(null)}
        onConfirm={() => deleteNetwork && removeNetwork(deleteNetwork)}
        title="Remove Entrance"
        message={`Delete this ${deleteNetwork?.type === 'ssid' ? 'WiFi' : 'IP'} entry? Auto check-in will no longer work from here.`}
        variant="danger"
      />
    </DashboardLayout>
  );
}

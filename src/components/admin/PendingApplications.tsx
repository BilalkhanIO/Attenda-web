'use client';

import { useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { getApiError, timeAgo } from '@/lib/utils';
import { Card, Button, Modal, ConfirmDialog, EmptyState } from '@/components/ui';
import { AdminOrg, fmtDate } from '@/lib/admin-shared';
import {
  AlertCircle, Building2, CheckCircle, X, Mail, Copy, Check, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ApproveResult {
  setup_url: string;
  org_name: string;
  trial_ends_at?: string;
}

interface PendingApplicationsProps {
  orgs: AdminOrg[];
  /** Called after a successful approve/reject so the parent can refetch. */
  onChanged: () => void;
  /** Show at most this many applications (dashboard preview). */
  limit?: number;
  /** When set, renders a "View all" link in the card header. */
  viewAllHref?: string;
}

/**
 * Pending-applications card with approve/reject actions and the
 * approve-result (setup URL) modal. Shared by /admin and /admin/pending.
 */
export default function PendingApplications({ orgs, onChanged, limit, viewAllHref }: PendingApplicationsProps) {
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminOrg | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approveResult, setApproveResult] = useState<ApproveResult | null>(null);
  const [copiedSetupUrl, setCopiedSetupUrl] = useState(false);

  const visible = limit ? orgs.slice(0, limit) : orgs;

  const handleApprove = async (org: AdminOrg) => {
    setApprovingId(org.id);
    try {
      const res = await adminApi.approveOrg(org.id);
      const { setup_url, trial_ends_at } = res.data.data;
      setApproveResult({ setup_url, org_name: org.name, trial_ends_at });
      onChanged();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejectingId(rejectTarget.id);
    try {
      await adminApi.rejectOrg(rejectTarget.id);
      toast.success('Application rejected');
      setRejectTarget(null);
      onChanged();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setRejectingId(null);
    }
  };

  const copySetupUrl = () => {
    if (!approveResult) return;
    navigator.clipboard.writeText(approveResult.setup_url);
    setCopiedSetupUrl(true);
    setTimeout(() => setCopiedSetupUrl(false), 2000);
  };

  return (
    <>
      <Card className="overflow-hidden border-[var(--warning-500)]/20 bg-[var(--warning-500)]/5">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--glass-border)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--warning-500)]/15 flex items-center justify-center flex-shrink-0 shadow-inner">
            <AlertCircle size={18} className="text-[var(--warning-500)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Pending Applications</h2>
            <p className="text-[10px] text-[var(--on-glass-dim)] mt-0.5 font-bold">
              {orgs.length === 0 ? 'Nothing awaiting review' : `${orgs.length} applications awaiting review`}
            </p>
          </div>
          {viewAllHref && orgs.length > 0 && (
            <Link
              href={viewAllHref}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--on-glass-muted)] hover:text-[var(--warning-500)] transition-colors flex-shrink-0"
            >
              View all <ArrowRight size={12} />
            </Link>
          )}
        </div>
        {orgs.length === 0 ? (
          <EmptyState
            icon={<AlertCircle size={24} />}
            title="No pending applications"
            description="New sign-up applications will appear here for review."
          />
        ) : (
          <div className="divide-y divide-[var(--glass-border)]">
            {visible.map(org => (
              <div key={org.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-[var(--glass-05)] transition-all group">
                <div className="w-10 h-10 rounded-xl bg-[var(--glass-10)] border border-[var(--glass-border)] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Building2 size={18} className="text-[var(--on-glass-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white group-hover:text-[var(--warning-500)] transition-colors">{org.name}</p>
                  <div className="flex items-center gap-3 mt-1 font-bold">
                    {org.contact_name && (
                      <span className="text-[10px] text-[var(--on-glass-muted)] uppercase tracking-tight">{org.contact_name}</span>
                    )}
                    {org.contact_email && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--on-glass-dim)] uppercase tracking-tight">
                        <Mail size={10} />{org.contact_email}
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--on-glass-dim)] font-bold">{timeAgo(org.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="success" className="h-8 px-3" icon={<CheckCircle size={13} />} loading={approvingId === org.id} onClick={() => handleApprove(org)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" className="h-8 px-3" icon={<X size={13} />} onClick={() => setRejectTarget(org)}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Approve result modal */}
      <Modal
        isOpen={!!approveResult}
        onClose={() => { setApproveResult(null); setCopiedSetupUrl(false); }}
        title="Organisation Approved"
        size="sm"
      >
        {approveResult && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-[var(--primary-600)]/10 border border-[var(--primary-600)]/20">
              <p className="text-sm font-black text-[var(--primary-600)] uppercase tracking-widest mb-1">
                {approveResult.org_name}
              </p>
              <p className="text-xs text-[var(--on-glass-muted)]">
                Trial active until {fmtDate(approveResult.trial_ends_at ?? null)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest mb-2">Setup URL</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={approveResult.setup_url}
                  className="flex-1 px-3 py-2.5 text-xs font-mono border border-[var(--glass-border)] bg-[var(--glass-05)] rounded-xl text-white truncate outline-none"
                />
                <Button size="sm" onClick={copySetupUrl} icon={copiedSetupUrl ? <Check size={12} /> : <Copy size={12} />}>
                  {copiedSetupUrl ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        loading={!!rejectingId}
        title="Reject Application"
        message={`Reject ${rejectTarget?.name}? This cannot be undone.`}
        confirmLabel="Reject"
        variant="danger"
      />
    </>
  );
}

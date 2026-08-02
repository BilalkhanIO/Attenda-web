'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, ConfirmDialog, EmptyState, Skeleton } from '@/components/ui';
import { documentsApi } from '@/lib/api';
import { keys, type EmployeeDocument } from '@/lib/queries';
import { cn, formatDateOnly, getApiError } from '@/lib/utils';
import { DOCUMENT_CATEGORY_META, formatFileSize, daysUntil } from './document-shared';
import { Download, FileText, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface DocumentListProps {
  docs: EmployeeDocument[];
  loading?: boolean;
  /** Whether the current viewer may delete this document (self-uploaded only). */
  canDelete?: (doc: EmployeeDocument) => boolean;
  emptyDescription?: string;
  /** Compact rows for embedding inside modals/cards. */
  compact?: boolean;
}

function ExpiryLabel({ expiresAt }: { expiresAt: string }) {
  const days = daysUntil(expiresAt);
  const soon = days <= 30; // amber tint when expiring within 30 days (or past)
  return (
    <span
      className={cn(
        'text-[10px] font-bold',
        soon ? 'text-[#f59e0b]' : 'text-[var(--on-glass-dim)]',
      )}
    >
      {days < 0 ? 'Expired' : 'Expires'} {formatDateOnly(expiresAt)}
    </span>
  );
}

export default function DocumentList({ docs, loading, canDelete, emptyDescription, compact }: DocumentListProps) {
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDocument | null>(null);

  const onDownload = async (doc: EmployeeDocument) => {
    setDownloadingId(doc.id);
    try {
      const res = await documentsApi.download(doc.id);
      const url = res.data.data?.download_url as string | undefined;
      if (!url) throw new Error('Download link unavailable');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => {
      toast.success('Document deleted');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: keys.documents.all });
    },
    onError: err => toast.error(getApiError(err)),
  });

  if (loading) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className={compact ? 'h-14 rounded-xl' : 'h-18 rounded-2xl'} />)}
      </div>
    );
  }

  if (docs.length === 0) {
    return compact ? (
      <p className="text-xs text-[var(--on-glass-muted)] py-3 text-center">
        {emptyDescription ?? 'No documents yet.'}
      </p>
    ) : (
      <EmptyState
        icon={<FileText size={22} />}
        title="No documents yet"
        description={emptyDescription ?? 'Uploaded documents will appear here.'}
      />
    );
  }

  return (
    <>
      <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
        {docs.map(doc => {
          const cat = DOCUMENT_CATEGORY_META[doc.category] ?? DOCUMENT_CATEGORY_META.other;
          return (
            <div
              key={doc.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-05)]',
                compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
              )}
            >
              <span className="w-9 h-9 rounded-xl bg-[var(--glass-10)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--on-glass-dim)] shrink-0">
                <FileText size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-white truncate">{doc.title}</p>
                  <Badge label={cat.label} color={cat.color} bg={cat.color} size="sm" />
                  {doc.expires_at && <ExpiryLabel expiresAt={doc.expires_at} />}
                </div>
                <p className="text-[11px] text-[var(--on-glass-muted)] truncate mt-0.5">
                  {doc.file_name} · {formatFileSize(doc.file_size)}
                  {doc.uploader && <> · Uploaded by {doc.uploader.name} on {formatDateOnly(doc.created_at)}</>}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Download size={13} />}
                  loading={downloadingId === doc.id}
                  onClick={() => onDownload(doc)}
                  aria-label={`Download ${doc.title}`}
                >
                  {!compact && 'Download'}
                </Button>
                {canDelete?.(doc) && (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 size={13} />}
                    onClick={() => setDeleteTarget(doc)}
                    aria-label={`Delete ${doc.title}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
        title="Delete Document"
        message={`Delete "${deleteTarget?.title}"? This removes it from your document list.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}

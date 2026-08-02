'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Input, Dropdown, DatePicker } from '@/components/ui';
import { documentsApi } from '@/lib/api';
import { keys } from '@/lib/queries';
import { cn, getApiError } from '@/lib/utils';
import { formatFileSize, DOCUMENT_CATEGORY_OPTIONS } from './document-shared';
import { FileUp, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

// Mirrors the API's document constraints (services/documents.ts):
// 20MB cap, fixed mime allowlist.
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',                                                       // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  // .docx
  'application/vnd.ms-excel',                                                 // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // .xlsx
];

const ACCEPT_ATTR = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx';
const ALLOWED_TYPES_HINT = 'PDF, PNG, JPEG, WebP, Word or Excel — up to 20MB';

type UploadStep = 'url' | 'put' | 'register';

const STEP_LABELS: Record<UploadStep, string> = {
  url:      'Preparing upload…',
  put:      'Uploading file…',
  register: 'Saving document…',
};

interface Errors { file?: string; title?: string; category?: string }

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Upload on behalf of this user (requires documents.manage). Omit for self. */
  userId?: string;
  /** Shown in the modal title when uploading for someone else. */
  userName?: string;
}

export default function UploadDocumentModal({ isOpen, onClose, userId, userName }: UploadDocumentModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState<UploadStep | null>(null);

  const busy = step !== null;

  const reset = () => {
    setFile(null); setTitle(''); setCategory(''); setExpiresAt(''); setErrors({}); setStep(null);
  };

  const close = () => {
    if (busy) return; // don't lose an in-flight upload
    reset();
    onClose();
  };

  const validateFile = (f: File): string | undefined => {
    if (!ALLOWED_MIME_TYPES.includes(f.type)) return `Unsupported file type — use ${ALLOWED_TYPES_HINT.toLowerCase()}`;
    if (f.size > MAX_DOCUMENT_BYTES) return `File exceeds the 20MB limit (${formatFileSize(f.size)})`;
    return undefined;
  };

  const onPickFile = (f: File | null) => {
    if (!f) return;
    const fileError = validateFile(f);
    setFile(f);
    setErrors(prev => ({ ...prev, file: fileError }));
    // Pre-fill the title from the file name (sans extension) if still empty
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const onUpload = async () => {
    const nextErrors: Errors = {};
    if (!file) nextErrors.file = 'Choose a file to upload';
    else nextErrors.file = validateFile(file);
    if (!title.trim()) nextErrors.title = 'Enter a title';
    else if (title.trim().length > 200) nextErrors.title = 'Keep it under 200 characters';
    if (!category) nextErrors.category = 'Pick a category';
    if (Object.values(nextErrors).some(Boolean)) { setErrors(nextErrors); return; }

    try {
      // Step 1 — presigned upload URL
      setStep('url');
      const urlRes = await documentsApi.getUploadUrl({
        user_id: userId,
        file_name: file!.name,
        mime_type: file!.type,
        file_size: file!.size,
      });
      const { upload_url, file_key, headers } = urlRes.data.data as {
        upload_url: string; file_key: string; headers?: Record<string, string>;
      };

      // Step 2 — raw PUT to S3 with exactly the presigned Content-Type header.
      // Plain fetch, not the axios client: no Authorization header here.
      setStep('put');
      const putRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': headers?.['Content-Type'] ?? file!.type },
        body: file!,
      });
      if (!putRes.ok) throw new Error(`File upload failed (${putRes.status})`);

      // Step 3 — register the document
      setStep('register');
      await documentsApi.register({
        user_id: userId,
        title: title.trim(),
        category,
        file_key,
        file_name: file!.name,
        file_size: file!.size,
        mime_type: file!.type,
        expires_at: expiresAt || undefined,
      });

      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: keys.documents.all });
      reset();
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
      setStep(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={userName ? `Upload Document — ${userName}` : 'Upload Document'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
          <Button onClick={onUpload} loading={busy} icon={!busy ? <FileUp size={14} /> : undefined}>
            {busy ? STEP_LABELS[step!] : 'Upload'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* File picker */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-[0.1em]">
            File<span className="text-[var(--danger-500)] ml-1">*</span>
          </span>
          <label
            className={cn(
              'flex items-center gap-3 rounded-xl border border-dashed px-4 py-4 cursor-pointer transition-all',
              'bg-[var(--glass-05)] hover:bg-[var(--glass-10)]',
              errors.file ? 'border-[var(--danger-500)]' : 'border-[var(--glass-border)] hover:border-[var(--primary-600)]/50',
              busy && 'opacity-50 pointer-events-none',
            )}
          >
            <input
              type="file"
              className="hidden"
              accept={ACCEPT_ATTR}
              disabled={busy}
              onChange={e => onPickFile(e.target.files?.[0] ?? null)}
            />
            <span className="w-10 h-10 rounded-xl bg-[var(--primary-600)]/10 border border-[var(--primary-600)]/25 flex items-center justify-center text-[var(--primary-600)] shrink-0">
              <FileText size={18} />
            </span>
            <span className="min-w-0">
              {file ? (
                <>
                  <span className="block text-sm font-bold text-white truncate">{file.name}</span>
                  <span className="block text-[11px] text-[var(--on-glass-muted)]">{formatFileSize(file.size)} — click to change</span>
                </>
              ) : (
                <>
                  <span className="block text-sm font-bold text-white">Choose a file</span>
                  <span className="block text-[11px] text-[var(--on-glass-muted)]">{ALLOWED_TYPES_HINT}</span>
                </>
              )}
            </span>
          </label>
          {errors.file && <p className="text-xs text-[var(--danger-500)] font-medium">{errors.file}</p>}
        </div>

        <Input
          label="Title"
          required
          maxLength={200}
          placeholder="e.g. Employment Contract 2026"
          value={title}
          disabled={busy}
          onChange={e => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: undefined })); }}
          error={errors.title}
        />

        <Dropdown
          label="Category"
          required
          value={category}
          disabled={busy}
          onChange={v => { setCategory(v); setErrors(prev => ({ ...prev, category: undefined })); }}
          placeholder="Select category"
          options={DOCUMENT_CATEGORY_OPTIONS}
          error={errors.category}
        />

        <DatePicker
          label="Expiry Date (optional)"
          value={expiresAt}
          disabled={busy}
          onChange={setExpiresAt}
          placeholder="No expiry"
        />
      </div>
    </Modal>
  );
}

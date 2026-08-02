'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import DocumentList from './DocumentList';
import UploadDocumentModal from './UploadDocumentModal';
import { userDocumentsQuery } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { FileText, FileUp } from 'lucide-react';

/**
 * Documents card for an employee's detail view. Callers gate rendering on
 * documents.view_team (the list endpoint requires it); the upload-for-employee
 * button additionally needs documents.manage.
 */
export default function EmployeeDocumentsSection({ userId, userName }: { userId: string; userName: string }) {
  const { hasPermission } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const canManage = hasPermission('documents.manage');

  const docsQ = useQuery(userDocumentsQuery(userId));

  return (
    <div className="panel">
      <div className="flex items-center gap-2 mb-2.5">
        <FileText size={14} className="text-[var(--on-glass-muted)]" />
        <p className="label-xs flex-1">Documents</p>
        {canManage && (
          <Button size="sm" variant="ghost" icon={<FileUp size={12} />} onClick={() => setUploadOpen(true)}>
            Upload
          </Button>
        )}
      </div>

      <DocumentList
        docs={docsQ.data ?? []}
        loading={docsQ.isLoading}
        compact
        emptyDescription={`No documents on ${userName}'s profile yet.`}
      />

      {/* Portaled to <body>: this section sits inside the profile Modal, whose
          backdrop-blur panel would otherwise trap the nested fixed overlay. */}
      {uploadOpen && createPortal(
        <UploadDocumentModal
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          userId={userId}
          userName={userName}
        />,
        document.body,
      )}
    </div>
  );
}

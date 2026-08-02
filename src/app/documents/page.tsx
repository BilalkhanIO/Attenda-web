'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader, Card, Button } from '@/components/ui';
import DocumentList from '@/components/documents/DocumentList';
import UploadDocumentModal from '@/components/documents/UploadDocumentModal';
import { myDocumentsQuery } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { FileUp } from 'lucide-react';

export default function DocumentsPage() {
  const { user } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);

  const docsQ = useQuery(myDocumentsQuery());
  const docs = docsQ.data ?? [];

  return (
    <DashboardLayout>
      <PageHeader
        title="My Documents"
        subtitle="Contracts, IDs, visas and certificates on your profile"
        actions={
          <Button size="sm" icon={<FileUp size={14} />} onClick={() => setUploadOpen(true)}>
            Upload
          </Button>
        }
      />

      <Card className="glass-card p-4">
        <DocumentList
          docs={docs}
          loading={docsQ.isLoading}
          // The API only lets owners delete documents they uploaded themselves
          canDelete={doc => !!user && doc.uploader?.id === user.sub && doc.user_id === user.sub}
          emptyDescription="Upload contracts, IDs, visas or certificates to keep them on your profile. Documents HR adds for you also show up here."
        />
      </Card>

      <UploadDocumentModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} />
    </DashboardLayout>
  );
}

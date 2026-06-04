'use client';

import { PageHeader, Card, EmptyState } from '@/components/ui';
import { Settings } from 'lucide-react';

export default function AdminAuditPage() {
  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Platform activity and configuration history"
      />
      <Card className="glass-card p-8">
        <EmptyState
          icon={<Settings size={28} />}
          title="Coming soon"
          description="Audit logging for platform actions is planned. Subscription and org changes are recorded on each organisation’s admin notes field for now."
        />
      </Card>
    </>
  );
}

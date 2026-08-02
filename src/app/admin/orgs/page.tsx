'use client';

import { Suspense, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { keys, adminPlansQuery } from '@/lib/queries';
import { PageHeader, Button } from '@/components/ui';
import OrgsTable from '@/components/admin/OrgsTable';
import CreateOrgModal from '@/components/admin/CreateOrgModal';
import { RefreshCw, Plus } from 'lucide-react';

export default function AdminOrgsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const plansQuery = useQuery(adminPlansQuery());
  const plans = plansQuery.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: keys.admin.all });

  return (
    <>
      <PageHeader
        title="Organisations"
        subtitle="All organisations on the platform"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={refresh}>
              Refresh
            </Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              New Org
            </Button>
          </div>
        }
      />

      {/* OrgsTable reads list state from the URL (useSearchParams), which
          requires a Suspense boundary during prerendering */}
      <Suspense fallback={null}>
        <OrgsTable />
      </Suspense>

      <CreateOrgModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        plans={plans}
        onCreated={refresh}
      />
    </>
  );
}

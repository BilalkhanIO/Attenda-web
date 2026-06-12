'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { PageHeader, Button } from '@/components/ui';
import type { PlanDefinition } from '@/types';
import { AdminOrg } from '@/lib/admin-shared';
import OrgsTable from '@/components/admin/OrgsTable';
import CreateOrgModal from '@/components/admin/CreateOrgModal';
import { RefreshCw, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Note: deliberately does not flip `loading` back on — re-fetches after
  // create/refresh update in place without a skeleton flash.
  const fetchData = useCallback(async () => {
    try {
      const [orgsRes, plansRes] = await Promise.all([
        adminApi.getOrgs(),
        adminApi.getPlans(),
      ]);
      setOrgs(orgsRes.data.data);
      setPlans(plansRes.data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await fetchData(); })();
  }, [fetchData]);

  const handleOrgUpdated = (updated: AdminOrg) => {
    setOrgs(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
  };

  return (
    <>
      <PageHeader
        title="Organisations"
        subtitle="All organisations on the platform"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
              New Org
            </Button>
          </div>
        }
      />

      <OrgsTable orgs={orgs} loading={loading} onOrgUpdated={handleOrgUpdated} />

      <CreateOrgModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        plans={plans}
        onCreated={fetchData}
      />
    </>
  );
}

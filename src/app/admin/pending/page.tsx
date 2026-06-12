'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { PageHeader, Button, Skeleton } from '@/components/ui';
import { AdminOrg } from '@/lib/admin-shared';
import PendingApplications from '@/components/admin/PendingApplications';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPendingPage() {
  const [pendingOrgs, setPendingOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);

  // Note: deliberately does not flip `loading` back on — re-fetches after
  // approve/reject/refresh update in place without a skeleton flash.
  const fetchData = useCallback(async () => {
    try {
      const res = await adminApi.getPendingOrgs();
      setPendingOrgs(res.data.data);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await fetchData(); })();
  }, [fetchData]);

  return (
    <>
      <PageHeader
        title="Pending Applications"
        subtitle="Sign-up applications awaiting review"
        actions={
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>
            Refresh
          </Button>
        }
      />

      {loading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (
        <PendingApplications orgs={pendingOrgs} onChanged={fetchData} />
      )}
    </>
  );
}

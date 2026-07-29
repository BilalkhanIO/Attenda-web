'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { PageHeader, Card, Table, Button, Skeleton, Badge } from '@/components/ui';
import { History, RefreshCw, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

interface AuditLog {
  id: string;
  created_at: string;
  org_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason: string | null;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  const [action, setAction] = useState('');

  const fetchLogs = useCallback(async (p = 1) => {
    try {
      setLoading(true);
      const res = await adminApi.getAuditLogs({ 
        page: p, 
        limit: 50,
        org_id: orgId || undefined,
        action: action || undefined
      });
      setLogs(res.data.data.logs || []);
      setTotal(res.data.data.total);
      setPage(p);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [orgId, action]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <>
      <PageHeader
        title="System Audit Logs"
        subtitle="Track platform-wide administrative actions"
        actions={
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => fetchLogs(page)} loading={loading}>
            Refresh
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--glass-05)] flex flex-wrap gap-4">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-glass-dim)]" />
            <input 
              type="text"
              placeholder="Filter by Org ID..."
              value={orgId}
              onChange={e => setOrgId(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-xl text-xs text-white focus:outline-none focus:border-[var(--primary-600)] transition-colors"
            />
          </div>
          <div className="relative max-w-xs flex-1">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-glass-dim)]" />
            <input 
              type="text"
              placeholder="Filter by Action (e.g. payroll.process)..."
              value={action}
              onChange={e => setAction(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--glass-05)] border border-[var(--glass-border)] rounded-xl text-xs text-white focus:outline-none focus:border-[var(--primary-600)] transition-colors"
            />
          </div>
        </div>

        <Table
          headers={['Time', 'Organisation', 'Actor', 'Action', 'Entity', 'Details']}
          loading={loading}
        >
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-[var(--glass-05)] transition-all text-xs">
              <td className="py-3 px-6 text-[var(--on-glass-dim)] font-mono">
                {new Date(log.created_at).toLocaleString()}
              </td>
              <td className="py-3 px-6 font-bold text-white truncate max-w-[120px]" title={log.org_id}>
                {log.org_id === 'SYSTEM' ? <Badge label="SYSTEM" color="#a855f7" bg="rgba(168, 85, 247, 0.1)" /> : log.org_id.split('-')[0]}
              </td>
              <td className="py-3 px-6 font-mono text-[var(--on-glass-muted)]">
                {log.actor_id.split('-')[0]}
              </td>
              <td className="py-3 px-6">
                <code className="px-1.5 py-0.5 rounded bg-[var(--glass-10)] text-[var(--primary-600)] font-bold">
                  {log.action}
                </code>
              </td>
              <td className="py-3 px-6 text-[var(--on-glass-dim)]">
                {log.entity_type}: {log.entity_id.split('-')[0]}
              </td>
              <td className="py-3 px-6 max-w-xs truncate text-[var(--on-glass-muted)]">
                {log.reason || '—'}
              </td>
            </tr>
          ))}
        </Table>

        {!loading && logs.length === 0 && (
          <div className="py-20 text-center">
            <History size={32} className="mx-auto text-[var(--on-glass-dim)] mb-3" />
            <p className="text-[var(--on-glass-muted)] text-sm font-medium">
              No audit logs found.
            </p>
          </div>
        )}

        {total > 50 && (
          <div className="p-4 border-t border-[var(--glass-border)] flex justify-between items-center bg-[var(--glass-05)]">
            <p className="text-xs text-[var(--on-glass-dim)]">Showing {logs.length} of {total} logs</p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => fetchLogs(page - 1)}>Previous</Button>
              <Button size="sm" variant="ghost" disabled={logs.length < 50} onClick={() => fetchLogs(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

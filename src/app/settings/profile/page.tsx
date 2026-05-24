'use client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui';
export default function Page() {
  return (
    <DashboardLayout>
      <PageHeader title="Profile Settings" />
      <div className="flex items-center justify-center h-64 text-sm text-[var(--gray-500)] border-2 border-dashed border-[var(--gray-200)] rounded-2xl">
        Profile settings — Phase 2 build
      </div>
    </DashboardLayout>
  );
}

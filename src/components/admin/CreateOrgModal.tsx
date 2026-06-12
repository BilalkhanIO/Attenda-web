'use client';

import { useState } from 'react';
import { adminApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import { Modal, Button, Input, Select } from '@/components/ui';
import type { PlanDefinition } from '@/types';
import toast from 'react-hot-toast';

interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: PlanDefinition[];
  /** Called after a successful create so the parent can refetch. */
  onCreated: () => void;
}

/** "New Org" modal shared by the admin dashboard and the organisations page. */
export default function CreateOrgModal({ isOpen, onClose, plans, onCreated }: CreateOrgModalProps) {
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [plan, setPlan] = useState('starter');
  const [creating, setCreating] = useState(false);

  const planOptions = plans
    .filter(p => p.is_active)
    .map(p => ({ value: p.id, label: p.display_name }));

  // Fall back to the first available plan when the current selection isn't loaded.
  const selectedPlan = plans.length && !plans.find(p => p.id === plan)
    ? plans[0].id
    : plan;

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      await adminApi.createOrg({ name: name.trim(), timezone, plan: selectedPlan });
      toast.success('Organisation created');
      setName('');
      setTimezone('UTC');
      onClose();
      onCreated();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Organisation"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={creating} onClick={handleCreate}>Create</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Name" required value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp" />
        <Input label="Timezone" value={timezone} onChange={e => setTimezone(e.target.value)} hint="e.g. Asia/Karachi" />
        {planOptions.length > 0 ? (
          <Select label="Plan" options={planOptions} value={selectedPlan} onChange={e => setPlan(e.target.value)} />
        ) : (
          <Input label="Plan ID" value={selectedPlan} onChange={e => setPlan(e.target.value)} />
        )}
      </div>
    </Modal>
  );
}

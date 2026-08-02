'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Button, Badge, EmptyState, Modal, Input, Textarea,
  DatePicker, Skeleton,
} from '@/components/ui';
import { expensesApi } from '@/lib/api';
import { keys, myExpensesQuery } from '@/lib/queries';
import type { ExpenseClaim, ExpenseStatus } from '@/lib/queries';
import { cn, formatDate, formatDateOnly, getApiError } from '@/lib/utils';
import { Receipt, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_BADGE: Record<ExpenseStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: '#f59e0b', bg: '#f59e0b' },
  approved:   { label: 'Approved',   color: '#10b981', bg: '#10b981' },
  rejected:   { label: 'Rejected',   color: '#ef4444', bg: '#ef4444' },
  reimbursed: { label: 'Reimbursed', color: '#8b5cf6', bg: '#8b5cf6' },
};

const CATEGORY_PICKS = ['Travel', 'Meals', 'Accommodation', 'Office Supplies', 'Software', 'Training'];

// Mirrors the API's expenseClaimSchema bounds (amount > 0, category ≤ 50,
// description 5–1000, expense_date not in the future).
interface ClaimForm {
  amount: string;
  category: string;
  description: string;
  expense_date: string;
  errors: { amount?: string; category?: string; description?: string; expense_date?: string };
}

const EMPTY_FORM: ClaimForm = { amount: '', category: '', description: '', expense_date: '', errors: {} };

function fmtAmount(claim: ExpenseClaim) {
  return `${claim.currency} ${Number(claim.amount).toFixed(2)}`;
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ExpenseStatus | 'all'>('all');
  const [form, setForm] = useState<ClaimForm | null>(null);

  const claimsQ = useQuery(myExpensesQuery());
  const claims = claimsQ.data ?? [];

  // "Today" in the org timezone — matches the server-side future-date check.
  const today = formatDate(new Date(), 'yyyy-MM-dd');

  const validate = (f: ClaimForm): ClaimForm['errors'] => {
    const errors: ClaimForm['errors'] = {};
    const amount = Number(f.amount);
    if (!f.amount.trim() || !Number.isFinite(amount)) errors.amount = 'Enter an amount';
    else if (amount <= 0) errors.amount = 'Amount must be greater than 0';
    if (!f.category.trim()) errors.category = 'Pick or enter a category';
    else if (f.category.trim().length > 50) errors.category = 'Keep it under 50 characters';
    const desc = f.description.trim();
    if (desc.length < 5) errors.description = 'Describe the expense (at least 5 characters)';
    else if (desc.length > 1000) errors.description = 'Keep it under 1000 characters';
    if (!f.expense_date) errors.expense_date = 'Pick a date';
    else if (f.expense_date > today) errors.expense_date = 'Date cannot be in the future';
    return errors;
  };

  const createMutation = useMutation({
    mutationFn: (f: ClaimForm) => expensesApi.create({
      amount: Number(f.amount),
      category: f.category.trim(),
      description: f.description.trim(),
      expense_date: f.expense_date,
    }),
    onSuccess: () => {
      toast.success('Expense claim submitted');
      setForm(null);
      queryClient.invalidateQueries({ queryKey: keys.expenses.all });
    },
    onError: err => toast.error(getApiError(err)),
  });

  const onSubmit = () => {
    if (!form) return;
    const errors = validate(form);
    if (Object.keys(errors).length > 0) { setForm({ ...form, errors }); return; }
    createMutation.mutate(form);
  };

  const visible = filter === 'all' ? claims : claims.filter(c => c.status === filter);
  const countsByStatus = claims.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <PageHeader
        title="Expenses"
        subtitle="Submit and track your expense claims"
        actions={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setForm({ ...EMPTY_FORM })}>
            New Claim
          </Button>
        }
      />

      {/* Status filter */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
        {(['all', ...Object.keys(STATUS_BADGE)] as const).map(s => {
          const active = filter === s;
          const count = s === 'all' ? claims.length : countsByStatus[s] ?? 0;
          return (
            <button key={s} onClick={() => setFilter(s as ExpenseStatus | 'all')}
              className={cn(
                'px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border',
                active
                  ? 'bg-[var(--primary-600)]/15 text-[var(--primary-600)] border-[var(--primary-600)]/25'
                  : 'text-[var(--on-glass-dim)] border-transparent hover:text-white hover:bg-white/5',
              )}>
              {s === 'all' ? 'All' : STATUS_BADGE[s as ExpenseStatus].label}
              {count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {claimsQ.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <Card className="glass-card">
          <EmptyState
            icon={<Receipt size={22} />}
            title={filter === 'all' ? 'No expense claims yet' : `No ${STATUS_BADGE[filter as ExpenseStatus].label.toLowerCase()} claims`}
            description="Submit a claim for work expenses and track its approval and reimbursement here."
            action={filter === 'all' ? (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setForm({ ...EMPTY_FORM })}>
                New Claim
              </Button>
            ) : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {visible.map(claim => {
            const badge = STATUS_BADGE[claim.status];
            return (
              <Card key={claim.id} className="glass-card">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white">{fmtAmount(claim)}</p>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-[var(--glass-10)] text-[var(--on-glass-sub)]">
                        {claim.category}
                      </span>
                      <span className="text-[10px] text-[var(--on-glass-dim)]">{formatDateOnly(claim.expense_date)}</span>
                    </div>
                    <p className="text-xs text-[var(--on-glass-muted)] mt-0.5 truncate">{claim.description}</p>
                    {claim.review_note && (
                      <p className="text-[11px] text-[var(--on-glass-dim)] mt-0.5 truncate italic">
                        {claim.reviewer?.name ? `${claim.reviewer.name}: ` : 'Reviewer note: '}“{claim.review_note}”
                      </p>
                    )}
                  </div>
                  <div className="flex items-center sm:flex-shrink-0">
                    <Badge label={badge.label} color={badge.color} bg={badge.bg} size="sm" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!form}
        onClose={() => setForm(null)}
        title="New Expense Claim"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button loading={createMutation.isPending} onClick={onSubmit}>Submit Claim</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Amount"
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={form?.amount ?? ''}
            onChange={e => setForm(prev => prev ? { ...prev, amount: e.target.value, errors: { ...prev.errors, amount: undefined } } : prev)}
            error={form?.errors.amount}
            hint="Billed in your organisation's currency"
          />
          <div className="flex flex-col gap-2">
            <Input
              label="Category"
              required
              maxLength={50}
              placeholder="e.g. Travel"
              value={form?.category ?? ''}
              onChange={e => setForm(prev => prev ? { ...prev, category: e.target.value, errors: { ...prev.errors, category: undefined } } : prev)}
              error={form?.errors.category}
            />
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_PICKS.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm(prev => prev ? { ...prev, category: cat, errors: { ...prev.errors, category: undefined } } : prev)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all',
                    form?.category === cat
                      ? 'bg-[var(--primary-600)]/15 text-[var(--primary-600)] border-[var(--primary-600)]/25'
                      : 'text-[var(--on-glass-dim)] border-[var(--glass-border)] hover:text-white hover:bg-white/5',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <DatePicker
            label="Expense Date"
            required
            maxDate={today}
            value={form?.expense_date ?? ''}
            onChange={v => setForm(prev => prev ? { ...prev, expense_date: v, errors: { ...prev.errors, expense_date: undefined } } : prev)}
            error={form?.errors.expense_date}
          />
          <Textarea
            label="Description"
            required
            rows={3}
            maxLength={1000}
            placeholder="What was this expense for?"
            value={form?.description ?? ''}
            onChange={e => setForm(prev => prev ? { ...prev, description: e.target.value, errors: { ...prev.errors, description: undefined } } : prev)}
            error={form?.errors.description}
          />
        </div>
      </Modal>
    </DashboardLayout>
  );
}

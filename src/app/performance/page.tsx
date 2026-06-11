'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, ConfirmDialog,
  Textarea, Skeleton, KPICard, Dropdown,
  type DropdownOption,
} from '@/components/ui';
import { performanceApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import type { PerformanceReview } from '@/types';
import { TrendingUp, Star, Target, CheckCircle, Clock, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

// ─── Schemas ────────────────────────────────────────────
const reviewSchema = z.object({
  score:    z.number().min(0).max(5),
  comments: z.string().min(10, 'Comments must be at least 10 characters'),
  month:    z.string(),
});
type ReviewForm = z.infer<typeof reviewSchema>;


// ─── Helpers ────────────────────────────────────────────
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
});

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={cn(
            "transition-all duration-300",
            readonly ? "cursor-default" : "cursor-pointer hover:scale-125 active:scale-90"
          )}
        >
          <Star size={24}
            fill={(hover || value) >= n ? 'var(--warning-500)' : 'none'}
            stroke={(hover || value) >= n ? 'var(--warning-500)' : 'var(--on-glass-dim)'}
            strokeWidth={2}
          />
        </button>
      ))}
    </div>
  );
}

function CompletionBar({ value }: { value: number }) {
  const color = value >= 100 ? '#10b981' : value >= 50 ? '#00C896' : '#f59e0b';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-[var(--glass-10)] rounded-full overflow-hidden border border-white/5">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-black w-8 text-right uppercase tracking-tighter" style={{ color }}>{value}%</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function PerformancePage() {
  const { hasPermission } = useAuth();

  // Reviews state
  const [reviews, setReviews]   = useState<PerformanceReview[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [selectedMonth, setMth] = useState(MONTHS[0].value);
  const [reviewUser, setReviewUser] = useState<PerformanceReview | null>(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [starValue, setStarValue] = useState(0);
  const [pendingData, setPendingData] = useState<ReviewForm | null>(null);

  // AI Insights state
  const [insightsUser, setInsightsUser] = useState<PerformanceReview | null>(null);
  const [insights, setInsights]         = useState<string>('');
  const [insightsLoading, setInsightsLoading] = useState(false);

  const reviewForm = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { score: 0, comments: '', month: MONTHS[0].value },
  });

  // ── Fetch reviews ────────────────────────────────────
  const fetchReviews = useCallback(async () => {
    setReviewLoading(true);
    try {
      const { data } = await performanceApi.getReviews({ month: selectedMonth });
      setReviews(data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setReviewLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);


  // ── Review logic ─────────────────────────────────────
  const openReview = (review: PerformanceReview) => {
    reviewForm.reset({ score: review.score || 0, comments: review.comments || '', month: selectedMonth });
    setStarValue(review.score || 0);
    setReviewUser(review);
  };

  const onSubmitReviewForm = (data: ReviewForm) => {
    if (starValue === 0) { toast.error('Please select a star rating before submitting'); return; }
    setPendingData({ ...data, score: starValue });
    setSubmitConfirm(true);
  };

  const onConfirmSubmit = async () => {
    if (!reviewUser || !pendingData) return;
    setSubmitting(true);
    try {
      await performanceApi.submitReview(reviewUser.user_id, {
        score: pendingData.score, comments: pendingData.comments, month: pendingData.month,
      });
      toast.success('Performance review submitted and locked');
      setSubmitConfirm(false);
      setReviewUser(null);
      fetchReviews();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Goal logic ───────────────────────────────────────
  const openInsights = async (review: PerformanceReview) => {
    setInsightsUser(review);
    setInsights('');
    setInsightsLoading(true);
    try {
      const { data } = await performanceApi.getInsights(review.user_id);
      setInsights(data.data?.insights || 'No insights available.');
    } catch (err) {
      setInsights(`Error: ${getApiError(err)}`);
    } finally {
      setInsightsLoading(false);
    }
  };

  // ── Derived ──────────────────────────────────────────
  const scoreColor = (s: number) => {
    if (s >= 80) return ['var(--success-500)', '#10b981'];
    if (s >= 60) return ['var(--primary-600)', '#00C896'];
    if (s >= 40) return ['var(--warning-500)', '#f59e0b'];
    return ['var(--danger-500)', '#ef4444'];
  };
  const starToScore = (stars: number) => stars * 20;
  const submitted = reviews.filter(r => r.submitted_at).length;
  const pending   = reviews.length - submitted;

  return (
    <DashboardLayout>
      <PageHeader
        title="Performance Tracking"
        subtitle="Monthly reviews and goal tracking"
        actions={
          <Dropdown
            value={selectedMonth}
            onChange={setMth}
            options={MONTHS.map(m => ({ value: m.value, label: m.label.toUpperCase() } as DropdownOption))}
            className="min-w-40"
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {reviewLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />) : (<>
            <KPICard title="Reviews Submitted" value={submitted}  icon={<CheckCircle size={16} />} color="var(--success-500)" bg="#10b981" />
            <KPICard title="Pending Reviews"   value={pending}    icon={<Clock size={16} />}        color="var(--warning-500)" bg="#f59e0b" />
            <div className="lg:col-span-1 col-span-2">
              <KPICard title="Team Average"
                value={reviews.length > 0 && submitted > 0
                  ? Math.round(reviews.filter(r => r.score > 0).reduce((s, r) => s + starToScore(r.score), 0) / submitted)
                  : '—'}
                icon={<TrendingUp size={16} />} color="var(--primary-600)" bg="#00C896"
              />
            </div>
          </>)}
        </div>

        <Card className="overflow-hidden">
          <Table
            headers={['Employee', 'Department', 'Score', 'Rating', 'Status', 'Actions']}
            loading={reviewLoading}
            emptyState={
              <div className="py-24 text-center">
                 <Target size={32} className="mx-auto text-[var(--on-glass-dim)] mb-4" />
                 <p className="text-[11px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.3em]">No Reviews for this Period</p>
              </div>
            }
          >
            {reviews.map(review => {
              const isSubmitted = !!review.submitted_at;
              const score = starToScore(review.score);
              const [c] = scoreColor(isSubmitted ? score : 0);
              return (
                <tr key={review.id} className="hover:bg-(--glass-05) transition-all group">
                  <td className="py-3 px-4">
                    {review.user ? (
                      <div className="flex items-center gap-3">
                        <Avatar name={review.user.name} size="sm" />
                        <p className="text-sm font-black text-white group-hover:text-(--primary-600) transition-colors truncate">{review.user.name}</p>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] font-bold text-(--on-glass-muted) uppercase tracking-widest">{review.user?.department || 'Operations'}</span>
                  </td>
                  <td className="py-3 px-4">
                    {isSubmitted
                      ? <span className="text-base font-black" style={{ color: c }}>{score}</span>
                      : <span className="text-xs font-bold text-(--on-glass-dim)">—</span>}
                  </td>
                  <td className="py-3 px-4"><StarRating value={review.score} readonly /></td>
                  <td className="py-3 px-4">
                    <Badge
                      label={isSubmitted ? 'SUBMITTED' : 'PENDING'}
                      color={isSubmitted ? 'var(--success-500)' : 'var(--warning-500)'}
                      bg={isSubmitted ? '#10b981' : '#f59e0b'}
                      size="sm"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      {hasPermission('performance.manage') && (
                        <button onClick={() => openReview(review)} title={isSubmitted ? 'View Review' : 'Create Review'}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-(--glass-10) text-(--on-glass-dim) hover:text-white hover:bg-(--glass-15) transition-all">
                          {isSubmitted ? <TrendingUp size={14} /> : <Star size={14} />}
                        </button>
                      )}
                      <button onClick={() => openInsights(review)} title="AI Analysis"
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-(--glass-10) text-(--on-glass-dim) hover:text-(--secondary) hover:bg-(--glass-15) transition-all">
                        <Sparkles size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>

      {/* ── REVIEW MODAL ────────────────────────────── */}
      <Modal
        isOpen={!!reviewUser}
        onClose={() => setReviewUser(null)}
        title="Performance Review"
        size="sm"
        footer={
          reviewUser?.submitted_at ? (
            <Button size="sm" onClick={() => setReviewUser(null)}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setReviewUser(null)}>Cancel</Button>
              {hasPermission('performance.manage') && (
                <Button size="sm" onClick={reviewForm.handleSubmit(onSubmitReviewForm)}>Submit Review</Button>
              )}
            </>
          )
        }
      >
        {reviewUser && (
          <div className="space-y-4">
            {reviewUser.user && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-(--glass-05) border border-(--glass-border)">
                <Avatar name={reviewUser.user.name} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-black text-white tracking-tight">{reviewUser.user.name}</p>
                  <p className="label-xs mt-0.5">Period: {format(new Date(selectedMonth + '-01'), 'MMMM yyyy').toUpperCase()}</p>
                </div>
              </div>
            )}
            <div className="p-4 rounded-xl border border-(--glass-border) bg-(--glass-05)">
              <p className="text-[10px] font-black text-(--primary-600) uppercase tracking-[0.2em] mb-3">Manager Rating</p>
              <div className="flex items-center justify-between">
                <StarRating
                  value={starValue}
                  onChange={reviewUser.submitted_at ? undefined : setStarValue}
                  readonly={!!reviewUser.submitted_at}
                />
                {starValue > 0 && (
                  <span className="text-2xl font-black" style={{ color: scoreColor(starToScore(starValue))[0] }}>
                    {starToScore(starValue)}
                  </span>
                )}
              </div>
              {!reviewUser.submitted_at && starValue === 0 && (
                <p className="label-xs mt-3">Select a star rating</p>
              )}
            </div>
            <Textarea
              label="Performance Notes"
              required={!reviewUser.submitted_at}
              placeholder="Notes about performance, achievements, and areas for improvement..."
              error={reviewForm.formState.errors.comments?.message}
              className="h-28"
              readOnly={!!reviewUser.submitted_at}
              {...reviewForm.register('comments')}
            />
            {reviewUser.submitted_at && (
              <p className="label-xs leading-relaxed">
                Submitted on {format(new Date(reviewUser.submitted_at), 'MMM d, yyyy')} by {reviewUser.reviewer?.name}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ── AI INSIGHTS MODAL ──────────────────────── */}
      <Modal
        isOpen={!!insightsUser}
        onClose={() => { setInsightsUser(null); setInsights(''); }}
        title="AI Performance Insights"
        size="md"
        footer={<Button size="sm" onClick={() => { setInsightsUser(null); setInsights(''); }}>Close</Button>}
      >
        {insightsUser && (
          <div className="space-y-4">
            {insightsUser.user && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-(--glass-05) border border-(--glass-border)">
                <Avatar name={insightsUser.user.name} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-black text-white tracking-tight">{insightsUser.user.name}</p>
                  <p className="text-[10px] font-bold text-(--secondary) uppercase tracking-[0.2em] mt-0.5 flex items-center gap-1.5">
                    <Sparkles size={10} /> AI Performance Insights
                  </p>
                </div>
              </div>
            )}
            {insightsLoading ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="w-8 h-8 border-4 border-(--primary-600) border-t-transparent rounded-full animate-spin" />
                <p className="label-xs">Processing Data Stream…</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-gradient-to-br from-(--primary-600)/10 to-transparent border border-(--primary-600)/20 text-(--on-glass-sub) text-sm leading-relaxed font-medium whitespace-pre-wrap">
                {insights}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── SUBMIT CONFIRMATION ─────────────────────── */}
      <ConfirmDialog
        isOpen={submitConfirm}
        onClose={() => setSubmitConfirm(false)}
        onConfirm={onConfirmSubmit}
        loading={submitting}
        title="Submit Performance Review"
        message="This review will be locked once submitted and will be visible to the employee. This action cannot be undone."
        confirmLabel="Submit & Lock Review"
        variant="primary"
      />
    </DashboardLayout>
  );
}

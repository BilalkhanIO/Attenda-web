'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, ConfirmDialog,
  Input, Textarea, Skeleton
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
  const { hasRole } = useAuth();

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
          <div className="flex items-center gap-3 bg-[var(--glass-10)] p-1.5 pl-4 rounded-2xl border border-[var(--glass-border)] shadow-xl backdrop-blur-md">
            <select value={selectedMonth} onChange={e => setMth(e.target.value)}
              className="bg-transparent text-[11px] font-black text-white uppercase tracking-widest outline-none cursor-pointer pr-2">
              {MONTHS.map(m => <option key={m.value} value={m.value} className="bg-[var(--dark-950)]">{m.label.toUpperCase()}</option>)}
            </select>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {reviewLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />) : (<>
            <Card className="p-6 relative overflow-hidden group hover:bg-[var(--glass-10)] transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--success-500)]/5 blur-[40px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="flex items-center justify-between relative z-10">
                 <div>
                    <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-1">Reviews Submitted</p>
                    <p className="text-3xl font-black text-white group-hover:text-[var(--success-500)] transition-colors">{submitted}</p>
                 </div>
                 <div className="w-12 h-12 rounded-2xl bg-[var(--success-500)]/10 border border-[var(--success-500)]/20 flex items-center justify-center text-[var(--success-500)] shadow-xl">
                    <CheckCircle size={24} />
                 </div>
              </div>
            </Card>
            <Card className="p-6 relative overflow-hidden group hover:bg-[var(--glass-10)] transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--warning-500)]/5 blur-[40px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="flex items-center justify-between relative z-10">
                 <div>
                    <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-1">Pending Reviews</p>
                    <p className="text-3xl font-black text-white group-hover:text-[var(--warning-500)] transition-colors">{pending}</p>
                 </div>
                 <div className="w-12 h-12 rounded-2xl bg-[var(--warning-500)]/10 border border-[var(--warning-500)]/20 flex items-center justify-center text-[var(--warning-500)] shadow-xl">
                    <Clock size={24} />
                 </div>
              </div>
            </Card>
            <Card className="p-6 relative overflow-hidden group hover:bg-[var(--glass-10)] transition-all lg:col-span-1 col-span-2">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--primary-600)]/5 blur-[40px] rounded-full translate-x-1/2 -translate-y-1/2" />
              <div className="flex items-center justify-between relative z-10">
                 <div>
                    <p className="text-[10px] font-black text-[var(--on-glass-muted)] uppercase tracking-widest mb-1">Team Average</p>
                    <p className="text-3xl font-black text-white group-hover:text-[var(--primary-600)] transition-colors">
                      {reviews.length > 0 && submitted > 0
                        ? Math.round(reviews.filter(r => r.score > 0).reduce((s, r) => s + starToScore(r.score), 0) / submitted)
                        : '—'}
                    </p>
                 </div>
                 <div className="w-12 h-12 rounded-2xl bg-[var(--primary-600)]/10 border border-[var(--primary-600)]/20 flex items-center justify-center text-[var(--primary-600)] shadow-xl">
                    <TrendingUp size={24} />
                 </div>
              </div>
            </Card>
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
                <tr key={review.id} className="hover:bg-[var(--glass-05)] transition-all group">
                  <td className="py-4 px-6">
                    {review.user ? (
                      <div className="flex items-center gap-4">
                        <Avatar name={review.user.name} size="md" />
                        <div className="min-w-0">
                          <p className="text-[15px] font-black text-white group-hover:text-[var(--primary-600)] transition-colors truncate">{review.user.name}</p>
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest">{review.user?.department || 'Operations'}</span>
                  </td>
                  <td className="py-4 px-6">
                    {isSubmitted
                      ? <span className="text-xl font-black" style={{ color: c }}>{score}</span>
                      : <span className="text-sm font-bold text-[var(--on-glass-dim)]">—</span>}
                  </td>
                  <td className="py-4 px-6"><StarRating value={review.score} readonly /></td>
                  <td className="py-4 px-6">
                    <Badge
                      label={isSubmitted ? 'SUBMITTED' : 'PENDING'}
                      color={isSubmitted ? 'var(--success-500)' : 'var(--warning-500)'}
                      bg={isSubmitted ? '#10b981' : '#f59e0b'}
                      size="sm"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      {hasRole('manager', 'hr_admin', 'super_admin') && (
                        <button
                          onClick={() => openReview(review)}
                          title={isSubmitted ? 'View Review' : 'Create Review'}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white hover:bg-[var(--glass-15)] transition-all"
                        >
                          {isSubmitted ? <TrendingUp size={16} /> : <Star size={16} />}
                        </button>
                      )}
                      <button
                        onClick={() => openInsights(review)}
                        title="AI Analysis"
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-[var(--secondary)] hover:bg-[var(--glass-15)] transition-all"
                      >
                         <Sparkles size={16} />
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
        size="md"
        footer={
          reviewUser?.submitted_at ? (
            <Button onClick={() => setReviewUser(null)}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setReviewUser(null)}>Cancel</Button>
              {hasRole('manager', 'hr_admin', 'super_admin') && (
                <Button onClick={reviewForm.handleSubmit(onSubmitReviewForm)}>Submit Review</Button>
              )}
            </>
          )
        }
      >
        {reviewUser && (
          <div className="space-y-6">
            {reviewUser.user && (
              <div className="flex items-center gap-4 p-5 rounded-[2rem] bg-[var(--glass-05)] border border-[var(--glass-border)]">
                <Avatar name={reviewUser.user.name} size="md" />
                <div className="flex-1">
                  <p className="text-lg font-black text-white tracking-tight">{reviewUser.user.name}</p>
                  <p className="text-[10px] font-bold text-[var(--on-glass-muted)] uppercase tracking-widest mt-1">Period: {format(new Date(selectedMonth + '-01'), 'MMMM yyyy').toUpperCase()}</p>
                </div>
              </div>
            )}
            <div className="p-6 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--glass-05)]">
              <p className="text-[10px] font-black text-[var(--primary-600)] uppercase tracking-[0.2em] mb-4">Manager Rating</p>
              <div className="flex items-center justify-between">
                <StarRating
                  value={starValue}
                  onChange={reviewUser.submitted_at ? undefined : setStarValue}
                  readonly={!!reviewUser.submitted_at}
                />
                {starValue > 0 && (
                  <span className="text-3xl font-black" style={{ color: scoreColor(starToScore(starValue))[0] }}>
                    {starToScore(starValue)}
                  </span>
                )}
              </div>
              {!reviewUser.submitted_at && starValue === 0 && (
                <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest mt-4">Select Rating Identity</p>
              )}
            </div>
            <Textarea
              label="Performance Notes"
              required={!reviewUser.submitted_at}
              placeholder="Add qualitative notes about this month's performance, achievements, and areas for improvement..."
              error={reviewForm.formState.errors.comments?.message}
              className="h-32"
              readOnly={!!reviewUser.submitted_at}
              {...reviewForm.register('comments')}
            />
            {reviewUser.submitted_at && (
              <p className="text-[10px] font-bold text-[var(--on-glass-dim)] uppercase tracking-widest leading-relaxed">
                Review submitted on {format(new Date(reviewUser.submitted_at), 'MMM d, yyyy')} by {reviewUser.reviewer?.name}
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
        size="lg"
        footer={<Button onClick={() => { setInsightsUser(null); setInsights(''); }}>Close</Button>}
      >
        {insightsUser && (
          <div className="space-y-6">
            {insightsUser.user && (
              <div className="flex items-center gap-4 p-5 rounded-[2rem] bg-[var(--glass-05)] border border-[var(--glass-border)]">
                <Avatar name={insightsUser.user.name} size="md" />
                <div className="flex-1">
                  <p className="text-lg font-black text-white tracking-tight">{insightsUser.user.name}</p>
                  <p className="text-[10px] font-bold text-[var(--secondary)] uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                    <Sparkles size={10} /> AI Performance Insights
                  </p>
                </div>
              </div>
            )}
            {insightsLoading ? (
              <div className="flex flex-col items-center gap-4 py-16">
                <div className="w-8 h-8 border-4 border-[var(--primary-600)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-[0.3em]">Processing Data Stream…</p>
              </div>
            ) : (
              <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-[var(--primary-600)]/10 to-transparent border border-[var(--primary-600)]/20 shadow-2xl text-[var(--on-glass-sub)] text-sm leading-[1.8] font-medium whitespace-pre-wrap">
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

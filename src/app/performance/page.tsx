'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, ConfirmDialog,
  Input, Textarea, Select, EmptyState, Skeleton
} from '@/components/ui';
import { performanceApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import type { PerformanceReview, User } from '@/types';
import { TrendingUp, Star, Target, CheckCircle, Clock, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format, subMonths } from 'date-fns';

const reviewSchema = z.object({
  score:    z.number().min(1).max(5),
  comments: z.string().min(10, 'Comments must be at least 10 characters'),
  month:    z.string(),
});
type ReviewForm = z.infer<typeof reviewSchema>;

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
});

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
        >
          <Star size={22}
            fill={(hover || value) >= n ? 'var(--warning-500)' : 'none'}
            stroke={(hover || value) >= n ? 'var(--warning-500)' : 'var(--gray-200)'}
          />
        </button>
      ))}
    </div>
  );
}

export default function PerformancePage() {
  const [reviews, setReviews]   = useState<PerformanceReview[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedMonth, setMth] = useState(MONTHS[0].value);
  const [reviewUser, setReviewUser] = useState<PerformanceReview | null>(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [starValue, setStarValue] = useState(0);
  const [pendingData, setPendingData] = useState<ReviewForm | null>(null);

  const form = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { score: 0, comments: '', month: MONTHS[0].value },
  });

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await performanceApi.getReviews({ month: selectedMonth });
      setReviews(data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const openReview = (review: PerformanceReview) => {
    form.reset({ score: review.score || 0, comments: review.comments || '', month: selectedMonth });
    setStarValue(review.score || 0);
    setReviewUser(review);
  };

  const onSubmitForm = (data: ReviewForm) => {
    if (starValue === 0) {
      toast.error('Please select a star rating before submitting');
      return;
    }
    setPendingData({ ...data, score: starValue });
    setSubmitConfirm(true);
  };

  const onConfirmSubmit = async () => {
    if (!reviewUser || !pendingData) return;
    setSubmitting(true);
    try {
      await performanceApi.submitReview(reviewUser.user_id, {
        score: pendingData.score,
        comments: pendingData.comments,
        month: pendingData.month,
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

  const scoreColor = (s: number) => {
    if (s >= 80) return ['var(--success-700)', 'var(--success-100)'];
    if (s >= 60) return ['var(--primary-600)', 'var(--primary-100)'];
    if (s >= 40) return ['var(--warning-800)', 'var(--warning-100)'];
    return ['var(--danger-800)', 'var(--danger-100)'];
  };

  // Overall score formula: stars(1-5) map to 20-100
  const starToScore = (stars: number) => stars * 20;

  const submitted = reviews.filter(r => r.submitted_at).length;
  const pending   = reviews.length - submitted;

  return (
    <DashboardLayout>
      <PageHeader
        title="Performance Tracking"
        subtitle="Monthly reviews and goal tracking"
        actions={
          <div className="flex items-center gap-3">
            <select value={selectedMonth} onChange={e => setMth(e.target.value)}
              className="px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none">
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : (<>
          <Card className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--success-100)] flex items-center justify-center">
              <CheckCircle size={20} className="text-[var(--success-700)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--gray-500)] font-medium">Reviews Submitted</p>
              <p className="text-2xl font-bold text-[var(--success-700)]">{submitted}</p>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--warning-100)] flex items-center justify-center">
              <Clock size={20} className="text-[var(--warning-800)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--gray-500)] font-medium">Pending Reviews</p>
              <p className="text-2xl font-bold text-[var(--warning-800)]">{pending}</p>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--primary-100)] flex items-center justify-center">
              <TrendingUp size={20} className="text-[var(--primary-600)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--gray-500)] font-medium">Team Average</p>
              <p className="text-2xl font-bold text-[var(--primary-600)]">
                {reviews.length > 0 && submitted > 0
                  ? Math.round(reviews.filter(r=>r.score>0).reduce((s,r)=>s+starToScore(r.score),0) / submitted)
                  : '—'}
              </p>
            </div>
          </Card>
        </>)}
      </div>

      <Card>
        <Table
          headers={['Employee', 'Department', 'Score', 'Rating', 'Status', 'Actions']}
          loading={loading}
          emptyState={
            <EmptyState
              icon={<Target size={24} />}
              title="No reviews for this period"
              description="Performance reviews appear here once the month begins."
            />
          }
        >
          {reviews.map(review => {
            const isSubmitted = !!review.submitted_at;
            const score = starToScore(review.score);
            const [c, b] = scoreColor(isSubmitted ? score : 0);
            return (
              <tr key={review.id} className="border-b border-[var(--gray-100)] hover:bg-[var(--gray-50)]">
                <td className="py-3 px-4">
                  {review.user ? (
                    <div className="flex items-center gap-3">
                      <Avatar name={review.user.name} size="sm" />
                      <p className="text-sm font-semibold">{review.user.name}</p>
                    </div>
                  ) : '—'}
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-[var(--gray-500)]">{review.user?.department || '—'}</span>
                </td>
                <td className="py-3 px-4">
                  {isSubmitted ? (
                    <span className="text-xl font-bold" style={{ color: c }}>{score}</span>
                  ) : (
                    <span className="text-sm text-[var(--gray-500)]">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <StarRating value={review.score} readonly />
                </td>
                <td className="py-3 px-4">
                  <Badge
                    label={isSubmitted ? 'Submitted' : 'Pending'}
                    color={isSubmitted ? 'var(--success-700)' : 'var(--warning-800)'}
                    bg={isSubmitted ? 'var(--success-100)' : 'var(--warning-100)'}
                  />
                </td>
                <td className="py-3 px-4">
                  <Button variant="ghost" size="sm"
                    icon={isSubmitted ? <TrendingUp size={12} /> : <Star size={12} />}
                    onClick={() => openReview(review)}>
                    {isSubmitted ? 'View' : 'Review'}
                  </Button>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {/* Review Modal */}
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
              <Button onClick={form.handleSubmit(onSubmitForm)}>Submit Review</Button>
            </>
          )
        }
      >
        {reviewUser && (
          <div className="space-y-5">
            {reviewUser.user && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gray-50)]">
                <Avatar name={reviewUser.user.name} size="md" />
                <div>
                  <p className="font-bold text-[var(--dark-950)]">{reviewUser.user.name}</p>
                  <p className="text-sm text-[var(--gray-500)]">{reviewUser.user.department}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-[var(--gray-500)]">Period</p>
                  <p className="text-sm font-semibold">{format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}</p>
                </div>
              </div>
            )}

            {/* Score section */}
            <div className="p-4 rounded-xl border border-[var(--gray-200)]">
              <p className="text-sm font-semibold text-[var(--dark-800)] mb-3">Manager Rating</p>
              <div className="flex items-center gap-4">
                <StarRating
                  value={starValue}
                  onChange={reviewUser.submitted_at ? undefined : setStarValue}
                  readonly={!!reviewUser.submitted_at}
                />
                {starValue > 0 && (
                  <span className="text-2xl font-bold" style={{ color: scoreColor(starToScore(starValue))[0] }}>
                    {starToScore(starValue)}/100
                  </span>
                )}
              </div>
              {!reviewUser.submitted_at && starValue === 0 && (
                <p className="text-xs text-[var(--gray-500)] mt-2">Click a star to rate this employee's performance</p>
              )}
            </div>

            <Textarea
              label="Performance Notes"
              required={!reviewUser.submitted_at}
              placeholder="Add qualitative notes about this month's performance, achievements, and areas for improvement..."
              error={form.formState.errors.comments?.message}
              className="h-28"
              readOnly={!!reviewUser.submitted_at}
              {...form.register('comments')}
            />

            {reviewUser.submitted_at && (
              <p className="text-xs text-[var(--gray-500)]">
                Review submitted on {format(new Date(reviewUser.submitted_at), 'MMM d, yyyy')} by {reviewUser.reviewer?.name}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Submit confirmation */}
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

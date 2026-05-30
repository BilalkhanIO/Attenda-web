'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  PageHeader, Card, Table, Avatar, Badge, Button, Modal, ConfirmDialog,
  Input, Textarea, Select, EmptyState, Skeleton
} from '@/components/ui';
import { performanceApi } from '@/lib/api';
import { getApiError } from '@/lib/utils';
import type { PerformanceReview } from '@/types';
import { TrendingUp, Star, Target, CheckCircle, Clock, Plus, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { format, subMonths } from 'date-fns';

// ─── Types ──────────────────────────────────────────────
interface Goal {
  id: string;
  user_id: string;
  review_id: string;
  title: string;
  description?: string;
  weight: number;
  target_date?: string;
  completion: number;
  user?: { id: string; name: string; department?: string };
}

// ─── Schemas ────────────────────────────────────────────
const reviewSchema = z.object({
  score:    z.number().min(1).max(5),
  comments: z.string().min(10, 'Comments must be at least 10 characters'),
  month:    z.string(),
});
type ReviewForm = z.infer<typeof reviewSchema>;

const goalSchema = z.object({
  title:       z.string().min(2, 'Title required'),
  description: z.string().optional(),
  weight:      z.number().min(1).max(100),
  target_date: z.string().optional(),
});
type GoalForm = z.infer<typeof goalSchema>;

// ─── Helpers ────────────────────────────────────────────
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

function CompletionBar({ value }: { value: number }) {
  const color = value >= 100 ? 'var(--success-700)' : value >= 50 ? 'var(--primary-600)' : 'var(--warning-800)';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--gray-100)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{value}%</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function PerformancePage() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'reviews' | 'goals'>('reviews');

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

  // Goals state
  const [goals, setGoals]         = useState<Goal[]>([]);
  const [goalLoading, setGoalLoading] = useState(false);
  const [goalUserFilter, setGoalUserFilter] = useState('');
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const [editGoal, setEditGoal]   = useState<Goal | null>(null);
  const [goalReviewId, setGoalReviewId] = useState('');
  const [goalUserId, setGoalUserId]     = useState('');
  const [savingGoal, setSavingGoal]     = useState(false);
  const [completionEdit, setCompletionEdit] = useState<Goal | null>(null);
  const [newCompletion, setNewCompletion]   = useState(0);

  const reviewForm = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { score: 0, comments: '', month: MONTHS[0].value },
  });
  const goalForm = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: { title: '', description: '', weight: 25, target_date: '' },
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

  // ── Fetch goals ──────────────────────────────────────
  const fetchGoals = useCallback(async () => {
    setGoalLoading(true);
    try {
      const { data } = await performanceApi.getGoals(goalUserFilter || undefined);
      setGoals(data.data || []);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setGoalLoading(false);
    }
  }, [goalUserFilter]);

  useEffect(() => {
    if (activeTab === 'goals') fetchGoals();
  }, [activeTab, fetchGoals]);

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

  const openAddGoal = (review: PerformanceReview) => {
    setGoalUserId(review.user_id);
    setGoalReviewId(review.id);
    goalForm.reset({ title: '', description: '', weight: 25, target_date: '' });
    setAddGoalOpen(true);
  };

  const onSaveGoal = async (data: GoalForm) => {
    setSavingGoal(true);
    try {
      if (editGoal) {
        await performanceApi.updateGoal(editGoal.id, data);
        toast.success('Goal updated');
        setEditGoal(null);
      } else {
        await performanceApi.createGoal({ user_id: goalUserId, review_id: goalReviewId, ...data });
        toast.success('Goal created');
        setAddGoalOpen(false);
      }
      goalForm.reset();
      fetchGoals();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingGoal(false);
    }
  };

  const openEditCompletion = (goal: Goal) => {
    setCompletionEdit(goal);
    setNewCompletion(goal.completion);
  };

  const onUpdateCompletion = async () => {
    if (!completionEdit) return;
    setSavingGoal(true);
    try {
      await performanceApi.updateGoal(completionEdit.id, { completion: newCompletion });
      toast.success('Goal progress updated');
      setCompletionEdit(null);
      fetchGoals();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSavingGoal(false);
    }
  };

  // ── Derived ──────────────────────────────────────────
  const scoreColor = (s: number) => {
    if (s >= 80) return ['var(--success-700)', 'var(--success-100)'];
    if (s >= 60) return ['var(--primary-600)', 'var(--primary-100)'];
    if (s >= 40) return ['var(--warning-800)', 'var(--warning-100)'];
    return ['var(--danger-800)', 'var(--danger-100)'];
  };
  const starToScore = (stars: number) => stars * 20;
  const submitted = reviews.filter(r => r.submitted_at).length;
  const pending   = reviews.length - submitted;

  // Unique employees from reviews for goal creation dropdown
  const reviewEmployees = reviews.map(r => ({ id: r.id, userId: r.user_id, name: r.user?.name || 'Unknown' }));

  return (
    <DashboardLayout>
      <PageHeader
        title="Performance Tracking"
        subtitle="Monthly reviews and goal tracking"
        actions={
          <div className="flex items-center gap-3">
            {activeTab === 'reviews' && (
              <select value={selectedMonth} onChange={e => setMth(e.target.value)}
                className="px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none">
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-[var(--gray-200)] mb-6">
        {(['reviews', 'goals'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'text-[var(--primary-600)] border-b-2 border-[var(--primary-600)]'
                : 'text-[var(--gray-500)] hover:text-[var(--dark-950)]'
            }`}
          >
            {tab === 'reviews' ? `Reviews${pending > 0 ? ` (${pending} pending)` : ''}` : 'Goals'}
          </button>
        ))}
      </div>

      {/* ── REVIEWS TAB ─────────────────────────────── */}
      {activeTab === 'reviews' && (<>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {reviewLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : (<>
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
                    ? Math.round(reviews.filter(r => r.score > 0).reduce((s, r) => s + starToScore(r.score), 0) / submitted)
                    : '—'}
                </p>
              </div>
            </Card>
          </>)}
        </div>

        <Card>
          <Table
            headers={['Employee', 'Department', 'Score', 'Rating', 'Status', 'Actions']}
            loading={reviewLoading}
            emptyState={
              <EmptyState icon={<Target size={24} />} title="No reviews for this period"
                description="Performance reviews appear here once the month begins." />
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
                    {isSubmitted
                      ? <span className="text-xl font-bold" style={{ color: c }}>{score}</span>
                      : <span className="text-sm text-[var(--gray-500)]">—</span>}
                  </td>
                  <td className="py-3 px-4"><StarRating value={review.score} readonly /></td>
                  <td className="py-3 px-4">
                    <Badge
                      label={isSubmitted ? 'Submitted' : 'Pending'}
                      color={isSubmitted ? 'var(--success-700)' : 'var(--warning-800)'}
                      bg={isSubmitted ? 'var(--success-100)' : 'var(--warning-100)'}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {hasRole('manager', 'hr_admin', 'super_admin') && (
                        <Button variant="ghost" size="sm"
                          icon={isSubmitted ? <TrendingUp size={12} /> : <Star size={12} />}
                          onClick={() => openReview(review)}>
                          {isSubmitted ? 'View' : 'Review'}
                        </Button>
                      )}
                      {hasRole('manager', 'hr_admin', 'super_admin') && (
                        <Button variant="ghost" size="sm" icon={<Target size={12} />}
                          onClick={() => openAddGoal(review)}>
                          Goal
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" icon={<Sparkles size={12} />}
                        onClick={() => openInsights(review)}>
                        AI
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      </>)}

      {/* ── GOALS TAB ───────────────────────────────── */}
      {activeTab === 'goals' && (<>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <select value={goalUserFilter} onChange={e => setGoalUserFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none">
              <option value="">All Employees</option>
              {reviewEmployees.map(e => (
                <option key={e.userId} value={e.userId}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>

        <Card>
          <Table
            headers={['Employee', 'Goal', 'Weight', 'Target Date', 'Progress', 'Actions']}
            loading={goalLoading}
            emptyState={
              <EmptyState icon={<Target size={24} />} title="No goals set"
                description="Set goals for team members from the Reviews tab by clicking the Goal button." />
            }
          >
            {goals.map(goal => (
              <tr key={goal.id} className="border-b border-[var(--gray-100)] hover:bg-[var(--gray-50)]">
                <td className="py-3 px-4">
                  {goal.user ? (
                    <div className="flex items-center gap-3">
                      <Avatar name={goal.user.name} size="sm" />
                      <p className="text-sm font-semibold">{goal.user.name}</p>
                    </div>
                  ) : '—'}
                </td>
                <td className="py-3 px-4 max-w-xs">
                  <p className="text-sm font-semibold text-[var(--dark-950)] truncate">{goal.title}</p>
                  {goal.description && (
                    <p className="text-xs text-[var(--gray-500)] truncate">{goal.description}</p>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-semibold text-[var(--dark-950)]">{goal.weight}%</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-[var(--gray-500)]">
                    {goal.target_date ? format(new Date(goal.target_date), 'MMM d, yyyy') : '—'}
                  </span>
                </td>
                <td className="py-3 px-4 min-w-[140px]">
                  <CompletionBar value={goal.completion} />
                </td>
                <td className="py-3 px-4">
                  {hasRole('manager', 'hr_admin', 'super_admin') && (
                    <Button variant="ghost" size="sm" icon={<CheckCircle size={12} />}
                      onClick={() => openEditCompletion(goal)}>
                      Update
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </>)}

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
                <p className="text-xs text-[var(--gray-500)] mt-2">Click a star to rate this employee&apos;s performance</p>
              )}
            </div>
            <Textarea
              label="Performance Notes"
              required={!reviewUser.submitted_at}
              placeholder="Add qualitative notes about this month's performance, achievements, and areas for improvement..."
              error={reviewForm.formState.errors.comments?.message}
              className="h-28"
              readOnly={!!reviewUser.submitted_at}
              {...reviewForm.register('comments')}
            />
            {reviewUser.submitted_at && (
              <p className="text-xs text-[var(--gray-500)]">
                Review submitted on {format(new Date(reviewUser.submitted_at), 'MMM d, yyyy')} by {reviewUser.reviewer?.name}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ── ADD GOAL MODAL ─────────────────────────── */}
      <Modal
        isOpen={addGoalOpen || !!editGoal}
        onClose={() => { setAddGoalOpen(false); setEditGoal(null); goalForm.reset(); setGoalUserId(''); setGoalReviewId(''); }}
        title={editGoal ? 'Edit Goal' : 'Set New Goal'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setAddGoalOpen(false); setEditGoal(null); goalForm.reset(); }}>
              Cancel
            </Button>
            <Button loading={savingGoal} onClick={goalForm.handleSubmit(onSaveGoal)}>
              {editGoal ? 'Save Changes' : 'Create Goal'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Goal Title" required error={goalForm.formState.errors.title?.message}
            placeholder="e.g. Complete onboarding process" {...goalForm.register('title')} />
          <Textarea label="Description" placeholder="Optional details about this goal..."
            {...goalForm.register('description')} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-[var(--dark-800)] block mb-1">
                Weight (%) <span className="font-normal text-[var(--gray-500)]">contribution to overall</span>
              </label>
              <input type="number" min={1} max={100}
                className="w-full px-3 py-2 text-sm border border-[var(--gray-200)] rounded-lg outline-none focus:border-[var(--primary-600)]"
                {...goalForm.register('weight', { valueAsNumber: true })}
              />
            </div>
            <Input label="Target Date" type="date" {...goalForm.register('target_date')} />
          </div>
        </div>
      </Modal>

      {/* ── UPDATE COMPLETION MODAL ────────────────── */}
      <Modal
        isOpen={!!completionEdit}
        onClose={() => setCompletionEdit(null)}
        title="Update Goal Progress"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCompletionEdit(null)}>Cancel</Button>
            <Button loading={savingGoal} onClick={onUpdateCompletion}>Save Progress</Button>
          </>
        }
      >
        {completionEdit && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[var(--dark-950)]">{completionEdit.title}</p>
            <div>
              <label className="text-sm font-semibold text-[var(--dark-800)] block mb-2">
                Completion: {newCompletion}%
              </label>
              <input type="range" min={0} max={100} value={newCompletion}
                onChange={e => setNewCompletion(parseInt(e.target.value))}
                className="w-full accent-[var(--primary-600)]"
              />
              <CompletionBar value={newCompletion} />
            </div>
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
          <div className="space-y-4">
            {insightsUser.user && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--gray-50)]">
                <Avatar name={insightsUser.user.name} size="md" />
                <div>
                  <p className="font-bold text-[var(--dark-950)]">{insightsUser.user.name}</p>
                  <p className="text-sm text-[var(--gray-500)]">{insightsUser.user.department}</p>
                </div>
                <div className="ml-auto flex items-center gap-1 text-xs text-[var(--primary-600)] font-medium">
                  <Sparkles size={12} /> AI-generated
                </div>
              </div>
            )}
            {insightsLoading ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="w-6 h-6 border-2 border-[var(--primary-600)] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[var(--gray-500)]">Analysing performance data…</p>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none text-[var(--dark-950)] leading-relaxed whitespace-pre-wrap bg-[var(--gray-50)] rounded-xl p-4 text-sm">
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

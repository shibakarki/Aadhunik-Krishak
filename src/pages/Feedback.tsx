import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  Clock,
  Lightbulb,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { supabase } from '../lib/supabase';

type FeedbackCategory = 'issue' | 'feature' | 'general';

interface FeedbackRecord {
  id: string;
  user_id: string;
  farm_id: string | null;
  category: FeedbackCategory;
  page_area: string | null;
  subject: string;
  description: string;
  status: 'open' | 'reviewed' | 'resolved';
  created_at: string;
}

const PAGE_AREAS = [
  'Dashboard',
  'Add Farmland Map',
  'Land Intelligence',
  'Crops & Recommendations',
  'Farming Calendar & Irrigation',
  'AI Plant Doctor',
  'AI Assistant',
  'Login / Account',
  'Other',
];

export function Feedback() {
  const { user } = useAuth();
  const { activeFarm } = useFarm();

  const [category, setCategory] = useState<FeedbackCategory>('issue');
  const [pageArea, setPageArea] = useState('Dashboard');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoadingList(false);
      return;
    }

    setLoadingList(true);
    const { data, error: fetchError } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Failed to load feedback:', fetchError.message);
      setError(
        'Could not load feedback history yet. Make sure Shiba has created the `feedback` table in Supabase.'
      );
      setItems([]);
    } else {
      setItems((data as FeedbackRecord[]) ?? []);
    }
    setLoadingList(false);
  }, [user]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!user) {
      setError('You must be signed in to submit feedback.');
      return;
    }

    const trimmedSubject = subject.trim();
    const trimmedDescription = description.trim();

    if (!trimmedSubject || !trimmedDescription) {
      setError('Please enter both a short title and details.');
      return;
    }

    setSubmitting(true);

    const { error: insertError } = await supabase.from('feedback').insert({
      user_id: user.id,
      farm_id: activeFarm?.id ?? null,
      category,
      page_area: pageArea,
      subject: trimmedSubject,
      description: trimmedDescription,
    });

    setSubmitting(false);

    if (insertError) {
      setError(
        `Could not submit feedback: ${insertError.message}. (Ask Shiba to verify the feedback table and RLS policy.)`
      );
      return;
    }

    setSubject('');
    setDescription('');
    setSuccess('Thank you! Your feedback has been submitted to our team.');
    await loadFeedback();
  };

  const getCategoryBadge = (cat: FeedbackCategory) => {
    if (cat === 'issue') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          <Bug className="w-3 h-3" />
          Issue
        </span>
      );
    }
    if (cat === 'feature') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
          <Sparkles className="w-3 h-3" />
          Feature Idea
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
        <MessageSquare className="w-3 h-3" />
        General
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Farmer Feedback &amp; Suggestions
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Found a bug or want a new feature in Aadhunik Krishak? Let us know so
          we can improve the platform for Nepal&apos;s farmers.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Feedback Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 h-fit"
        >
          <h2 className="text-lg font-bold text-slate-900">Send Feedback</h2>

          <div>
            <span className="block text-sm font-medium text-slate-700 mb-2">
              Feedback Type
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setCategory('issue')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  category === 'issue'
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Bug className="w-4 h-4" />
                Report Issue
              </button>

              <button
                type="button"
                onClick={() => setCategory('feature')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  category === 'feature'
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                New Feature
              </button>

              <button
                type="button"
                onClick={() => setCategory('general')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  category === 'general'
                    ? 'bg-sky-50 border-sky-300 text-sky-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                General
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="pageArea"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Related Feature / Page
            </label>
            <select
              id="pageArea"
              value={pageArea}
              onChange={(e) => setPageArea(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PAGE_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="subject"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Title / Summary *
            </label>
            <input
              id="subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={
                category === 'issue'
                  ? 'e.g. Satellite map is slow to load on mobile'
                  : 'e.g. Add Nepali language toggle'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-slate-700 mb-1.5"
            >
              Details *
            </label>
            <textarea
              id="description"
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened or what feature would help you most on your farm..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {activeFarm && (
            <p className="text-xs text-slate-500">
              Submitting with active farm context:{' '}
              <strong className="text-slate-700">{activeFarm.name}</strong>
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 text-sm transition-colors cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Feedback
              </>
            )}
          </button>
        </form>

        {/* Submitted History */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-fit">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Your Submitted Feedback
          </h2>

          {loadingList ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              Loading your feedback...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              You haven&apos;t submitted any feedback yet.
            </div>
          ) : (
            <ul className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    {getCategoryBadge(item.category)}
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 capitalize">
                      <Clock className="w-3 h-3" />
                      {item.status}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-900">
                    {item.subject}
                  </p>
                  <p className="text-xs text-slate-600 whitespace-pre-line">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>{item.page_area || 'General'}</span>
                    <span>
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
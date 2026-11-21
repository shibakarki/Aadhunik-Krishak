import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Sprout } from 'lucide-react';
import { useFarm } from '../context/FarmContext';

interface PlaceholderPageProps {
  title: string;
  description: string;
  owner: string;
}

export function PlaceholderPage({
  title,
  description,
  owner,
}: PlaceholderPageProps) {
  const { activeFarm } = useFarm();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center max-w-xl mx-auto mt-8">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
        <Sprout className="w-7 h-7" />
      </div>

      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 mb-3">
        <Clock className="w-3.5 h-3.5" />
        In Progress &bull; Owner: {owner}
      </span>

      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600 mt-2">{description}</p>

      {activeFarm && (
        <p className="mt-4 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 inline-block">
          Ready for active farm: <strong>{activeFarm.name}</strong>
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
        >
          Back to Dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>
        {!activeFarm && (
          <Link
            to="/farms/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
          >
            Add Farmland
          </Link>
        )}
      </div>
    </div>
  );
}
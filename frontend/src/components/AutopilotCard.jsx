import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, AlertCircle, Clock, HelpCircle } from 'lucide-react';
import api from '../api/axios';

const AutopilotCard = ({ suggestion }) => {
  const navigate = useNavigate();
  const [explanation, setExplanation] = useState(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  const handleLaunch = () => {
    navigate('/campaigns/new', { state: { suggestion } });
  };

  const handleWhy = async () => {
    if (explanation) {
      setShowWhy(!showWhy);
      return;
    }
    setShowWhy(true);
    setLoadingExplain(true);
    try {
      const res = await api.post('/ai/segment-explain', {
        type: suggestion.type,
        title: suggestion.title,
        description: suggestion.description,
        audience_count: suggestion.audience_count,
        segment_rule: suggestion.segment_rule,
      });
      setExplanation(res.data.explanation);
    } catch {
      setExplanation(suggestion.description);
    } finally {
      setLoadingExplain(false);
    }
  };

  return (
    <div className={`card p-6 flex flex-col justify-between group h-full ${suggestion.urgency === 'high' ? 'ring-1 ring-red-100' : 'ring-1 ring-yellow-50'}`}>
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            {suggestion.urgency === 'high' ? (
              <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-red-50 text-red-500 rounded-full flex items-center border border-red-100">
                <AlertCircle className="w-3 h-3 mr-1" /> High Urgency
              </span>
            ) : (
              <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-600 rounded-full flex items-center border border-amber-100">
                <Clock className="w-3 h-3 mr-1" /> Medium
              </span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
              {suggestion.audience_count} AUDIENCE
            </span>
          </div>
        </div>

        <h4 className="font-bold text-slate-800 text-lg mb-2 leading-tight">{suggestion.title}</h4>
        <p className="text-sm text-slate-500 mb-4 line-clamp-2 leading-relaxed">{suggestion.description}</p>

        <button
          onClick={handleWhy}
          className="text-xs text-accent-500 hover:text-accent-600 flex items-center gap-1.5 mb-5 font-semibold transition-colors group/btn"
        >
          <HelpCircle className="w-4 h-4 transition-transform group-hover/btn:rotate-12" />
          Why this segment?
        </button>

        {showWhy && (
          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-4 mb-5 leading-relaxed border border-slate-100 animate-fade-in">
            {loadingExplain ? (
              <span className="flex items-center gap-2 text-slate-400">
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent-500" />
                AI is analyzing...
              </span>
            ) : (
              <span className="italic">"{explanation}"</span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleLaunch}
        className="w-full btn-primary text-sm flex items-center justify-center group-hover:shadow-lg group-hover:shadow-accent-500/15 transition-all"
      >
        <Rocket className="w-4 h-4 mr-2" />
        Launch Campaign
      </button>
    </div>
  );
};

export default AutopilotCard;

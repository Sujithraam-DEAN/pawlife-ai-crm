import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import CampaignCard from '../components/CampaignCard';

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, sending, completed, draft

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await api.get('/campaigns');
        setCampaigns(res.data);
      } catch (error) {
        console.error("Error fetching campaigns", error);
        toast.error('Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  const filteredCampaigns = campaigns.filter(c => filter === 'all' || c.status === filter);

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto animate-fade-in">
      <div className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">Campaigns</h1>
          <p className="text-slate-500 font-medium mt-2">Manage and track your marketing campaigns</p>
        </div>
        
        <Link to="/campaigns/new" className="btn-primary flex items-center shadow-lg shadow-accent-500/15 group">
          <PlusCircle className="w-5 h-5 mr-2 transition-transform group-hover:rotate-90" />
          Create Campaign
        </Link>
      </div>

      <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-100 shadow-sm mb-10 w-fit">
        {['all', 'sending', 'completed', 'draft'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              filter === f 
                ? 'bg-white text-accent-600 shadow-sm border border-slate-50' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-600"></div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Accessing Archives...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredCampaigns.length > 0 ? (
            filteredCampaigns.map(camp => (
              <CampaignCard key={camp._id} campaign={camp} />
            ))
          ) : (
            <div className="col-span-full bg-white/50 backdrop-blur-sm p-24 rounded-[3rem] border-2 border-dashed border-slate-100 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner">
                <PlusCircle className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">No campaigns found</h3>
              <p className="text-slate-500 font-medium mb-8 max-w-xs mx-auto text-sm">You haven't created any campaigns with this status yet.</p>
              <Link to="/campaigns/new" className="px-8 py-3 bg-accent-600 text-white rounded-2xl font-bold shadow-xl shadow-accent-200 hover:bg-accent-700 transition-all active:scale-95">
                Draft first campaign
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Campaigns;

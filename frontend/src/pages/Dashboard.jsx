import { useState, useEffect } from 'react';
import { Users, Megaphone, MessageSquare, Eye, MapPin, PawPrint, Bot, Sparkles, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';
import toast from 'react-hot-toast';
import StatCard from '../components/StatCard';
import AutopilotCard from '../components/AutopilotCard';
import CampaignCard from '../components/CampaignCard';
import DashboardChat from '../components/DashboardChat';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todayInsight, setTodayInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const fetchCoreData = async () => {
    setError(null);
    setStatsLoading(true);
    try {
      const [statsRes, campRes] = await Promise.all([
        api.get('/stats/overview'),
        api.get('/campaigns'),
      ]);
      setStats(statsRes.data);
      setCampaigns(campRes.data.slice(0, 5));
    } catch (err) {
      console.error('Error fetching dashboard data', err);
      setError('Could not load dashboard data.');
      toast.error('Failed to load dashboard');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const res = await api.get('/autopilot/suggestions');
      setSuggestions(res.data);
    } catch (err) {
      console.error('Error fetching suggestions', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const fetchTodayInsight = async () => {
    setInsightLoading(true);
    try {
      const res = await api.post('/ai/dashboard-insight');
      setTodayInsight(res.data.insight);
    } catch (err) {
      console.error('Error fetching today insight', err);
    } finally {
      setInsightLoading(false);
    }
  };

  useEffect(() => {
    fetchCoreData();
    fetchSuggestions();
    fetchTodayInsight();
  }, []);

  const chartData = campaigns.map(c => {
    const s = c.stats || {};
    return {
      name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
      Delivered: s.delivered || 0,
      Opened: s.opened || 0,
      Clicked: s.clicked || 0,
    };
  }).reverse();

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-10 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Welcome back, marketer! Here's your overview.</p>
        </div>
        <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-white/20 shadow-sm">
          <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 text-xs font-bold text-slate-800 uppercase tracking-widest">
            Last 30 Days
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm flex justify-between items-center animate-fade-in shadow-sm">
          <span className="flex items-center"><AlertCircle className="w-4 h-4 mr-2" /> {error}</span>
          <button onClick={fetchCoreData} className="font-bold hover:underline">Retry</button>
        </div>
      )}

      {/* Today's AI Insight */}
      <div className="card p-6 bg-brand-800 text-white border-brand-700 shadow-sm overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-700">
          <Bot className="w-32 h-32" />
        </div>
        <div className="flex items-start gap-4 relative z-10">
          <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl text-white shrink-0 shadow-inner">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-300 text-xs uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
              Daily AI Strategy
            </h3>
            {insightLoading ? (
              <div className="flex items-center text-sm text-slate-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3" />
                Processing customer data pipeline...
              </div>
            ) : (
              <p className="text-white text-lg font-semibold leading-relaxed max-w-3xl">{todayInsight}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-8 animate-pulse h-32 bg-slate-100" />
          ))
        ) : (
          <>
            <StatCard title="Total Pet Owners" value={stats?.total_customers?.toLocaleString() ?? '0'} icon={Users} trend={`${stats?.total_pets ?? 0} total pets`} />
            <StatCard title="Total Campaigns" value={stats?.total_campaigns?.toLocaleString() ?? '0'} icon={Megaphone} trend={`${stats?.campaigns_this_week ?? 0} this week`} />
            <StatCard title="Messages Sent" value={stats?.total_messages_sent?.toLocaleString() ?? '0'} icon={MessageSquare} trend={`${stats?.avg_click_rate?.toFixed(1) ?? 0}% click rate`} />
            <StatCard title="Avg Open Rate" value={`${stats?.avg_open_rate?.toFixed(1) ?? '0'}%`} icon={Eye} />
          </>
        )}
      </div>

      {!statsLoading && (stats?.top_city || stats?.most_common_breed) && (
        <div className="flex flex-wrap gap-4">
          <div className="bg-white px-5 py-3 rounded-2xl flex items-center text-xs font-bold text-slate-500 shadow-sm border border-slate-50 uppercase tracking-widest">
            <MapPin className="w-4 h-4 mr-2 text-accent-500" />
            Top city <span className="text-slate-900 ml-2">{stats.top_city}</span>
          </div>
          <div className="bg-white px-5 py-3 rounded-2xl flex items-center text-xs font-bold text-slate-500 shadow-sm border border-slate-50 uppercase tracking-widest">
            <PawPrint className="w-4 h-4 mr-2 text-accent-500" />
            Common breed <span className="text-slate-900 ml-2">{stats.most_common_breed}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card p-8 flex flex-col">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-bold text-slate-900">Performance</h2>
            <div className="flex gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100 p-1 rounded-xl">
              <span className="flex items-center px-2 py-1"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span> Delivery</span>
              <span className="flex items-center px-2 py-1"><span className="w-2 h-2 rounded-full bg-accent-500 mr-1.5"></span> Open</span>
            </div>
          </div>
          <div className="flex-1 min-h-[350px]">
            {statsLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-600" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(15 23 42 / 0.08)', padding: '12px' }} 
                  />
                  <Bar dataKey="Delivered" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="Opened" fill="#059669" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="Clicked" fill="#1E40AF" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400 font-medium italic">No campaign data yet - launch one from AI suggestions!</div>
            )}
          </div>
        </div>

        <div className="card p-8 bg-brand-900 border-brand-800 text-white shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent-600/10 blur-[60px] rounded-full -mr-16 -mt-16"></div>
          <div className="flex items-center mb-8 relative z-10">
            <div className="w-10 h-10 rounded-lg bg-brand-800 flex items-center justify-center text-accent-400 text-lg border border-brand-700 mr-4">
              AI
            </div>
            <h2 className="text-xl font-bold tracking-tight">AI Autopilot</h2>
          </div>
          <div className="space-y-6 relative z-10">
            {suggestionsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent-400" />
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Scanning Data...</p>
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.slice(0, 3).map((sugg, idx) => (
                <AutopilotCard key={sugg.type || idx} suggestion={sugg} />
              ))
            ) : (
              <div className="text-center py-10 text-slate-500 bg-white/5 rounded-2xl border border-white/5">
                <p className="font-semibold">All quiet for now.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Recent Campaigns</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {!statsLoading && campaigns.length > 0 ? (
            campaigns.map(camp => <CampaignCard key={camp._id} campaign={camp} />)
          ) : statsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-8 animate-pulse h-48 bg-slate-100" />
            ))
          ) : (
            <div className="col-span-full bg-white/50 backdrop-blur-sm p-20 rounded-[2.5rem] border-2 border-dashed border-slate-100 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl mb-4">Empty</div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No active campaigns</p>
            </div>
          )}
        </div>
      </div>

      <DashboardChat />
    </div>
  );
};

export default Dashboard;

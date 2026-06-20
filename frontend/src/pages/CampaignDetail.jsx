import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Mail, Smartphone, CheckCircle, Eye, MousePointer, XCircle, Bot, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';
import api from '../api/axios';
import toast from 'react-hot-toast';

const CampaignDetail = () => {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingInsight, setGeneratingInsight] = useState(false);

  const generateInsight = useCallback(async () => {
    setGeneratingInsight(true);
    try {
      const res = await api.post('/ai/campaign-insight', { campaign_id: id });
      setInsight(res.data.insight);
    } catch (error) {
      console.error('Error generating insight', error);
      toast.error('Could not generate AI insight');
    } finally {
      setGeneratingInsight(false);
    }
  }, [id]);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await api.get(`/campaigns/${id}`);
      setCampaign(res.data);
      return res.data;
    } catch (error) {
      console.error('Error fetching campaign details', error);
      toast.error('Failed to load campaign');
      return null;
    }
  }, [id]);

  useEffect(() => {
    let interval;

    const init = async () => {
      setLoading(true);
      const [campData] = await Promise.all([
        fetchCampaign(),
        api.get('/campaigns').then(res => setAllCampaigns(res.data)).catch(() => {}),
      ]);
      setLoading(false);

      if (!campData) return;

      if (campData.status === 'sending') {
        interval = setInterval(async () => {
          const updated = await fetchCampaign();
          if (updated?.status === 'completed') {
            clearInterval(interval);
            generateInsight();
          }
        }, 5000);
      } else if (campData.status === 'completed') {
        generateInsight();
      }
    };

    init();
    return () => { if (interval) clearInterval(interval); };
  }, [id, fetchCampaign, generateInsight]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) {
    return <div className="text-center py-20 text-slate-500">Campaign not found</div>;
  }

  const getChannelIcon = (ch) => {
    switch (ch) {
      case 'whatsapp': return <MessageSquare className="w-5 h-5" />;
      case 'email': return <Mail className="w-5 h-5" />;
      case 'sms': return <Smartphone className="w-5 h-5" />;
      default: return <MessageSquare className="w-5 h-5" />;
    }
  };

  const stats = campaign.stats || {};
  const totalSent = stats.sent || 0;
  const openRate = totalSent > 0 ? Math.round((stats.opened || 0) / totalSent * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((stats.clicked || 0) / totalSent * 100) : 0;

  const prevCampaign = allCampaigns
    .filter(c => c._id !== campaign._id && c.status === 'completed' && new Date(c.created_at) < new Date(campaign.created_at))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const prevSent = prevCampaign?.stats?.sent || 0;
  const prevOpenRate = prevSent > 0 ? Math.round((prevCampaign.stats.opened || 0) / prevSent * 100) : null;
  const prevClickRate = prevSent > 0 ? Math.round((prevCampaign.stats.clicked || 0) / prevSent * 100) : null;
  const openDelta = prevOpenRate != null ? openRate - prevOpenRate : null;
  const clickDelta = prevClickRate != null ? clickRate - prevClickRate : null;

  const chartData = [
    { name: 'Delivered', value: stats.delivered || 0, color: '#2563EB' },
    { name: 'Opened', value: stats.opened || 0, color: '#059669' },
    { name: 'Clicked', value: stats.clicked || 0, color: '#1E40AF' },
    { name: 'Failed', value: stats.failed || 0, color: '#DC2626' },
  ].filter(d => d.value > 0);

  if (chartData.length === 0 && totalSent > 0) {
    chartData.push({ name: 'Sent', value: totalSent, color: '#94A3B8' });
  }

  return (
    <div className="max-w-7xl mx-auto pb-10 animate-fade-in">
      <Link to="/campaigns" className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl text-xs font-bold text-slate-500 hover:text-accent-600 shadow-sm border border-slate-100 transition-all mb-8 group">
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" /> BACK TO CAMPAIGNS
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight mb-4">{campaign.name}</h1>
          <div className="flex flex-wrap items-center gap-4">
            <span className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl border-2 ${
              campaign.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
              campaign.status === 'sending' ? 'bg-accent-50 text-accent-600 border-accent-100' : 
              'bg-slate-50 text-slate-500 border-slate-100'
            } flex items-center`}>
              {campaign.status === 'sending' && <span className="w-2 h-2 rounded-full bg-accent-500 mr-2 animate-ping" />}
              {campaign.status}
            </span>
            <span className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm">
              <div className="text-accent-500">{getChannelIcon(campaign.channel)}</div>
              {campaign.channel}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
              Launched {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
            </span>
          </div>
          {prevCampaign && openDelta != null && campaign.status === 'completed' && (
            <div className="mt-6 flex flex-wrap gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border bg-white shadow-sm ${
                openDelta >= 0 ? 'text-emerald-600 border-emerald-50' : 'text-rose-600 border-rose-50'
              }`}>
                {openDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-xs font-black uppercase tracking-widest">Open Rate {openRate}%</span>
                <span className="text-[10px] font-bold opacity-70">({openDelta >= 0 ? '+' : ''}{openDelta}% benchmarks)</span>
              </div>
              {clickDelta != null && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border bg-white shadow-sm ${
                  clickDelta >= 0 ? 'text-accent-700 border-accent-100' : 'text-rose-600 border-rose-50'
                }`}>
                  {clickDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-xs font-black uppercase tracking-widest">Click Rate {clickRate}%</span>
                  <span className="text-[10px] font-bold opacity-70">({clickDelta >= 0 ? '+' : ''}{clickDelta}% benchmarks)</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card p-8 mb-12 border-brand-700 bg-brand-800 text-white shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
          <Bot className="w-32 h-32" />
        </div>
        <div className="flex items-start relative z-10">
          <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl text-white mr-6 shadow-inner ring-1 ring-white/20">
            <Bot className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[10px] uppercase tracking-[0.15em] mb-3 text-slate-300">Performance Telemetry</h3>
            {generatingInsight ? (
              <div className="flex items-center text-sm text-slate-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3" />
                Aggregating engagement metrics...
              </div>
            ) : insight ? (
              <p className="text-white text-lg font-semibold leading-relaxed max-w-4xl">{insight}</p>
            ) : campaign.status === 'sending' ? (
              <p className="text-slate-400 text-sm font-medium">Telemetry will initialize once deployment completes.</p>
            ) : (
              <button onClick={generateInsight} className="inline-flex items-center gap-2 bg-white text-accent-700 px-6 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all active:scale-95 border-none">
                <Sparkles className="w-4 h-4" /> GENERATE INSIGHT
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-12">
        <div className="card p-6 bg-slate-50 border-slate-100 group hover:bg-white transition-colors">
          <div className="flex items-center text-slate-400 font-black text-[10px] uppercase tracking-widest mb-3"><MessageSquare className="w-4 h-4 mr-2" /> DISPATCHED</div>
          <div className="text-4xl font-black text-slate-900 tabular-nums">{stats.sent || 0}</div>
          <div className="text-[10px] font-bold text-slate-400 mt-2">POOL: {stats.total || 0}</div>
        </div>
        <div className="card p-6 border-accent-100 bg-white group hover:shadow-lg transition-all">
          <div className="flex items-center text-accent-500 font-black text-[10px] uppercase tracking-widest mb-3"><CheckCircle className="w-4 h-4 mr-2" /> REACH</div>
          <div className="text-4xl font-black text-slate-900 tabular-nums group-hover:text-accent-600 transition-colors">{stats.delivered || 0}</div>
          <div className="text-[10px] font-black text-accent-500 uppercase tracking-widest mt-2">{totalSent > 0 ? Math.round(stats.delivered / totalSent * 100) : 0}% success</div>
        </div>
        <div className="card p-6 border-emerald-100 bg-white group hover:shadow-lg transition-all">
          <div className="flex items-center text-emerald-500 font-black text-[10px] uppercase tracking-widest mb-3"><Eye className="w-4 h-4 mr-2" /> ATTENTION</div>
          <div className="text-4xl font-black text-slate-900 tabular-nums group-hover:text-emerald-600 transition-colors">{stats.opened || 0}</div>
          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2">{totalSent > 0 ? Math.round(stats.opened / totalSent * 100) : 0}% rate</div>
        </div>
        <div className="card p-6 border-accent-200 bg-white group hover:shadow-lg transition-all">
          <div className="flex items-center text-accent-600 font-semibold text-[10px] uppercase tracking-widest mb-3"><MousePointer className="w-4 h-4 mr-2" /> ACTIONS</div>
          <div className="text-4xl font-black text-slate-900 tabular-nums group-hover:text-accent-700 transition-colors">{stats.clicked || 0}</div>
          <div className="text-[10px] font-black text-accent-700 uppercase tracking-widest mt-2">{totalSent > 0 ? Math.round(stats.clicked / totalSent * 100) : 0}% ctr</div>
        </div>
        <div className="card p-6 border-rose-100 bg-white group hover:shadow-lg transition-all">
          <div className="flex items-center text-rose-500 font-black text-[10px] uppercase tracking-widest mb-3"><XCircle className="w-4 h-4 mr-2" /> DROPOUTS</div>
          <div className="text-4xl font-black text-slate-900 tabular-nums group-hover:text-rose-600 transition-colors">{stats.failed || 0}</div>
          <div className="text-[10px] font-black text-rose-600 uppercase tracking-widest mt-2">{totalSent > 0 ? Math.round(stats.failed / totalSent * 100) : 0}% error</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="card p-10 flex flex-col items-center shadow-sm ring-1 ring-accent-50">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-10 w-full">Impact Distribution</h3>
          <div className="w-full h-72">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={75} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full animate-pulse border-2 border-dashed border-slate-100"></div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Awaiting delivery...</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-8 w-full">
            {chartData.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 card flex flex-col overflow-hidden shadow-sm border-white ring-1 ring-accent-50">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Message Log</h3>
            {campaign.status === 'sending' && (
              <span className="text-[10px] font-black text-accent-600 flex items-center bg-accent-50 px-3 py-1.5 rounded-full shadow-sm ring-1 ring-accent-100 uppercase tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse mr-2" />
                Live Tracking
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto max-h-[500px]">
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
              <thead className="bg-white/80 backdrop-blur-sm text-slate-400 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10 border-b border-slate-50 shadow-sm">
                <tr>
                  <th className="px-8 py-5">Customer</th>
                  <th className="px-8 py-5">Patient</th>
                  <th className="px-8 py-5 text-center">Status</th>
                  <th className="px-8 py-5 text-right pr-12">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaign.messages?.map((msg) => (
                  <tr key={msg._id} className="hover:bg-accent-50/20 transition-all group">
                    <td className="px-8 py-5 font-bold text-slate-900 group-hover:text-accent-600 transition-colors">{msg.owner_name || msg.phone}</td>
                    <td className="px-8 py-5 text-slate-500 font-medium uppercase text-xs tracking-tight">{msg.pet_name}</td>
                    <td className="px-8 py-5 flex justify-center">
                      <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest scale-95 transition-transform group-hover:scale-100" style={{
                        backgroundColor: msg.status === 'opened' ? '#ECFDF5' : msg.status === 'clicked' ? '#EFF6FF' : '#F8FAFC',
                        color: msg.status === 'opened' ? '#047857' : msg.status === 'clicked' ? '#1E40AF' : '#64748B'
                      }}>
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right text-slate-400 font-bold tabular-nums pr-12">
                      {msg.updated_at ? format(new Date(msg.updated_at), 'HH:mm:ss') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetail;

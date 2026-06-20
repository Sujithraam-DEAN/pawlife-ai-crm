import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wand2, Users, MessageSquare, Rocket, Sparkles, Smartphone, Mail, CheckCircle } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const CHAR_LIMITS = { sms: 160, whatsapp: 300, email: 2000 };

const NewCampaign = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const suggestion = location.state?.suggestion;

  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [isFindingAudience, setIsFindingAudience] = useState(false);
  const [audienceResult, setAudienceResult] = useState(null);
  const [message, setMessage] = useState('');
  const [isGeneratingMsg, setIsGeneratingMsg] = useState(false);
  const [channel, setChannel] = useState('whatsapp');
  const [campaignName, setCampaignName] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [launchedCampaignId, setLaunchedCampaignId] = useState(null);
  const [liveStats, setLiveStats] = useState(null);

  const loadAudienceFromRules = async (segmentRule, goalText) => {
    setIsFindingAudience(true);
    try {
      const res = await api.post('/segment/manual', segmentRule);
      setAudienceResult({
        owners: res.data.owners,
        count: res.data.count,
        filter_used: res.data.filter_used || segmentRule,
      });
      if (!campaignName) {
        setCampaignName(`Campaign: ${goalText.substring(0, 40)}`);
      }
      setStep(2);
    } catch (error) {
      toast.error('Failed to load autopilot audience');
      console.error(error);
    } finally {
      setIsFindingAudience(false);
    }
  };

  useEffect(() => {
    if (suggestion) {
      const goalText = suggestion.goal || `Find ${suggestion.description}`;
      setGoal(goalText);
      setChannel(suggestion.suggested_channel || 'whatsapp');
      if (suggestion.suggested_message) setMessage(suggestion.suggested_message);
      setCampaignName(`${suggestion.title} - ${new Date().toLocaleDateString()}`);
      if (suggestion.segment_rule) {
        loadAudienceFromRules(suggestion.segment_rule, goalText);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion]);

  useEffect(() => {
    if (step !== 4 || !launchedCampaignId) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/campaigns/${launchedCampaignId}`);
        setLiveStats(res.data.stats);
      } catch (e) {
        console.error(e);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [step, launchedCampaignId]);

  const quickTemplates = [
    { label: 'Reorder Reminder', prompt: "Find dog owners who haven't bought food in 25 days and send them a restock reminder" },
    { label: 'Birthday Campaign', prompt: 'Find pets with birthdays in the next 7 days and send a birthday offer' },
    { label: 'Win-Back Inactive', prompt: "Find customers who haven't ordered in 45 days and give them 20% off to come back" },
    { label: 'VIP Appreciation', prompt: "Find top spenders who haven't ordered in 20 days and offer exclusive early access" },
  ];

  const charLimit = CHAR_LIMITS[channel] || 300;
  const charCount = message.length;
  const charOverLimit = charCount > charLimit;

  const handleFindAudience = async () => {
    if (!goal) return toast.error('Please describe your goal');
    setIsFindingAudience(true);
    try {
      const res = await api.post('/segment/ai', { query: goal });
      setAudienceResult(res.data);
      if (!campaignName) setCampaignName(`Campaign: ${goal.substring(0, 30)}...`);
      setStep(2);
    } catch (error) {
      toast.error('Failed to find audience. Try being more specific.');
      console.error(error);
    } finally {
      setIsFindingAudience(false);
    }
  };

  const handleGenerateMessage = async () => {
    setIsGeneratingMsg(true);
    try {
      const sampleOwner = audienceResult?.owners[0] || {};
      const samplePet = sampleOwner.pets?.[0] || {};
      const res = await api.post('/ai/write-message', {
        goal,
        channel,
        sample_owner_name: sampleOwner.name || 'Priya',
        sample_pet_name: samplePet.pet_name || 'Bruno',
        sample_breed: samplePet.breed || 'Labrador',
        sample_product: 'Premium Food',
      });
      setMessage(res.data.message);
    } catch {
      toast.error('Failed to generate message');
    } finally {
      setIsGeneratingMsg(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!campaignName || !message || !audienceResult) return toast.error('Missing required fields');

    setIsSavingDraft(true);
    try {
      await api.post('/campaigns', {
        name: campaignName,
        goal,
        message_template: message,
        channel,
        segment_rule: audienceResult.filter_used,
        audience_ids: audienceResult.owners.map(o => o._id),
      });
      toast.success('Campaign saved as draft');
      navigate('/campaigns');
    } catch {
      toast.error('Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleLaunch = async () => {
    if (!campaignName || !message || !audienceResult) return toast.error('Missing required fields');
    if (charOverLimit) return toast.error(`Message exceeds ${charLimit} character limit for ${channel}`);

    setIsLaunching(true);
    try {
      const campRes = await api.post('/campaigns', {
        name: campaignName,
        goal,
        message_template: message,
        channel,
        segment_rule: audienceResult.filter_used,
        audience_ids: audienceResult.owners.map(o => o._id),
      });
      const campaignId = campRes.data._id;
      await api.post(`/campaigns/${campaignId}/send`);
      setLaunchedCampaignId(campaignId);
      setLiveStats(campRes.data.stats);
      setStep(4);
      setTimeout(() => navigate(`/campaigns/${campaignId}`), 5000);
    } catch {
      toast.error('Failed to launch campaign');
      setIsLaunching(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
      <div className="mb-12">
        <h1 className="text-4xl font-semibold text-slate-900 tracking-tight mb-2">New Campaign</h1>
        <p className="text-slate-500 font-medium">Design and launch targeted outreach with AI assistance.</p>
      </div>

      <div className="mb-12 relative px-2">
        <div className="overflow-hidden h-2.5 mb-6 text-xs flex rounded-full bg-slate-100">
          <div style={{ width: `${(step / 4) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-accent-600 transition-all duration-700 ease-out" />
        </div>
        <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          <span className={step >= 1 ? 'text-accent-600' : ''}>Audience</span>
          <span className={step >= 2 ? 'text-accent-600' : ''}>Message</span>
          <span className={step >= 3 ? 'text-accent-600' : ''}>Review</span>
          <span className={step === 4 ? 'text-accent-600' : ''}>Launch</span>
        </div>
      </div>

      {step === 1 && (
        <div className="card p-10 animate-fade-in shadow-sm">
          {isFindingAudience && suggestion ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-600 mb-6" />
              <p className="text-slate-900 text-lg font-bold tracking-tight">AI Strategy in Progress</p>
              <p className="text-sm text-slate-400 font-medium mt-2">Finding your {suggestion.title} audience...</p>
            </div>
          ) : (
          <>
          <div className="flex items-center mb-8">
            <div className="bg-accent-50 p-3 rounded-2xl text-accent-600 mr-4 shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Campaign Goal</h2>
          </div>

          <div className="relative mb-8">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={"Describe your campaign goal in plain English...\nExample: Find dog owners who haven't bought food in 25 days and send them a restock reminder"}
              className="w-full h-40 p-6 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-accent-500/10 focus:bg-white focus:border-accent-300 outline-none resize-none text-slate-700 font-medium leading-relaxed transition-all"
            />
            <div className="absolute top-4 right-4 opacity-10">
              <Wand2 className="w-8 h-8" />
            </div>
          </div>

          <div className="mb-10">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 pl-1">Inspiration Templates</p>
            <div className="flex flex-wrap gap-3">
              {quickTemplates.map((t, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setGoal(t.prompt)} 
                  className="px-5 py-2.5 bg-white hover:bg-accent-50 text-slate-600 hover:text-accent-600 rounded-xl text-xs font-bold shadow-sm border border-slate-100 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-slate-50">
            <button 
              onClick={handleFindAudience} 
              disabled={isFindingAudience || !goal} 
              className="px-8 py-4 bg-accent-600 hover:bg-accent-700 text-white rounded-2xl font-bold flex items-center shadow-lg shadow-accent-200 transition-all active:scale-95 disabled:opacity-50"
            >
              {isFindingAudience ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3" /> Processing Segment...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-3" /> Find Audience</>
              )}
            </button>
          </div>
          </>
          )}
        </div>
      )}

      {step === 2 && audienceResult && (
        <div className="space-y-8 animate-fade-in">
          <div className="bg-accent-50/50 backdrop-blur-sm border border-accent-100 p-6 rounded-[2rem] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-white p-3 rounded-2xl shadow-sm text-accent-600">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">
                  {audienceResult.count} Pet Owners Identified
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(audienceResult.filter_used || {}).map(([k, v]) => (
                    <span key={k} className="px-2 py-0.5 bg-white/60 text-[10px] font-bold text-slate-500 rounded-md border border-accent-50/50 uppercase tracking-wider">
                      {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setStep(1)} className="text-xs font-bold text-accent-600 hover:text-accent-700 px-4 py-2 hover:bg-white rounded-xl transition-all">Modify Segment</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card p-8 bg-slate-900 border-none text-white shadow-xl flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                  <div className="w-2 h-2 bg-accent-400 rounded-full animate-ping"></div>
                </div>
                <h3 className="text-lg font-bold tracking-tight">Selection Pool</h3>
              </div>
              <div className="space-y-4">
                {audienceResult.owners.slice(0, 5).map((o, i) => (
                  <div key={i} className="flex items-center bg-white/5 p-3 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-white text-slate-900 flex items-center justify-center text-sm font-black mr-4 shadow-lg group-hover:scale-105 transition-transform">{o.name.charAt(0)}</div>
                    <div>
                      <p className="font-bold text-sm text-white">{o.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{o.pets?.[0]?.pet_name} owners</p>
                    </div>
                  </div>
                ))}
                {audienceResult.count > 5 && (
                  <div className="text-center pt-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">+{audienceResult.count - 5} others in group</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card p-8 shadow-sm ring-1 ring-accent-50">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-accent-50 p-2.5 rounded-2xl text-accent-600 shadow-inner">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Message</h2>
                </div>
                <button 
                  onClick={handleGenerateMessage} 
                  disabled={isGeneratingMsg} 
                  className="bg-accent-50 text-accent-600 hover:bg-accent-100 px-4 py-2 rounded-xl text-xs font-bold flex items-center transition-all shadow-sm border border-accent-100 active:scale-95 disabled:opacity-50"
                >
                  {isGeneratingMsg ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent-600 mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                  AI Draft
                </button>
              </div>

              <div className="relative mb-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Your campaign copy here..."
                  className="w-full h-56 p-6 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-accent-500/10 focus:bg-white outline-none resize-none text-slate-700 font-medium leading-relaxed transition-all shadow-inner"
                />
              </div>
              <div className={`flex justify-end text-[10px] font-black uppercase tracking-widest mb-10 ${charOverLimit ? 'text-red-500' : charCount > charLimit * 0.9 ? 'text-warning' : 'text-slate-400'}`}>
                {charCount} / {charLimit} CHARACTERS
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Primary Channel</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'emerald' },
                    { id: 'sms', name: 'SMS', icon: Smartphone, color: 'accent' },
                    { id: 'email', name: 'Email', icon: Mail, color: 'blue' },
                  ].map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => setChannel(c.id)} 
                      className={`p-4 rounded-2xl cursor-pointer transition-all border-2 text-center group ${
                        channel === c.id 
                          ? `border-accent-600 bg-accent-50 text-accent-600 shadow-lg shadow-accent-100` 
                          : 'border-slate-50 bg-slate-50 hover:border-slate-200 text-slate-400 font-bold'
                      }`}
                    >
                      <c.icon className={`w-6 h-6 mx-auto mb-2 transition-transform group-hover:scale-110 ${channel === c.id ? `text-accent-600` : 'text-slate-400'}`} />
                      <p className="text-[10px] font-black uppercase tracking-widest leading-none">{c.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-10">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-4 uppercase tracking-widest text-xs font-bold">Back</button>
                <button onClick={() => setStep(3)} disabled={!message || charOverLimit} className="px-8 py-4 bg-accent-600 hover:bg-accent-700 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 transition-all flex-[2] active:scale-95 disabled:opacity-50">Continue</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-10 animate-fade-in shadow-sm-hover ring-1 ring-accent-50">
          <div className="flex items-center gap-4 mb-12">
            <div className="bg-accent-600 p-4 rounded-3xl text-white shadow-xl shadow-accent-500/20">
              <Rocket className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Final Check</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12 items-center">
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pl-1">Campaign Identity</label>
                <input 
                  type="text" 
                  value={campaignName} 
                  onChange={(e) => setCampaignName(e.target.value)} 
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 focus:ring-4 focus:ring-accent-500/10 focus:bg-white outline-none transition-all shadow-inner" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner group transition-colors hover:bg-accent-50/30">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Segment</p>
                  <p className="text-3xl font-black text-slate-900 mb-1 group-hover:text-accent-600 transition-colors">{audienceResult?.count}</p>
                  <p className="text-[10px] font-bold text-slate-400">TARGET USERS</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner group transition-colors hover:bg-accent-50/30">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Medium</p>
                  <p className="text-xl font-black text-slate-900 mb-1 flex items-center capitalize group-hover:text-accent-600 transition-colors tracking-tight">
                    <Smartphone className="w-5 h-5 mr-2 text-accent-500" /> {channel}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-accent-600/5 blur-3xl rounded-full scale-75 group-hover:scale-100 transition-transform duration-700"></div>
              <div className="relative w-full max-w-[320px] mx-auto bg-white rounded-[2.5rem] shadow-2xl border-4 border-slate-900 p-6 z-10 aspect-[9/16] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80"></div>
                  </div>
                  <div className="w-16 h-1 bg-slate-100 rounded-full"></div>
                </div>
                <div className="flex items-center mb-6 gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-white px-1">PL</div>
                  <div>
                    <span className="font-black text-[11px] text-slate-900 uppercase tracking-[0.1em] block">PawLife CRM</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Digital Assistant</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border-l-4 border-accent-500 shadow-sm grow overflow-y-auto">
                  <p className="text-[11px] font-bold text-slate-700 leading-relaxed italic whitespace-pre-wrap">
                    {message.replace('{owner_name}', audienceResult?.owners[0]?.name || 'Priya').replace('{pet_name}', audienceResult?.owners[0]?.pets?.[0]?.pet_name || 'Bruno')}
                  </p>
                </div>
                <div className="mt-6 flex justify-center pb-2">
                  <div className="w-10 h-10 rounded-full border-2 border-slate-100 shadow-inner"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-12 border-t border-slate-50 gap-4">
            <button onClick={() => setStep(2)} className="btn-secondary px-8 py-4 uppercase tracking-widest text-xs font-bold">Back</button>
            <div className="flex gap-4">
              <button
                onClick={handleSaveDraft}
                disabled={isSavingDraft || isLaunching}
                className="bg-white hover:bg-slate-50 text-slate-500 font-bold px-8 py-4 rounded-2xl border border-slate-200 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs shadow-sm"
              >
                {isSavingDraft ? 'Archiving...' : 'Store Draft'}
              </button>
              <button onClick={handleLaunch} disabled={isLaunching || isSavingDraft} className="px-10 py-4 bg-accent-600 hover:bg-accent-700 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-accent-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-3">
                {isLaunching ? (
                  <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Dispatching...</>
                ) : (
                  <><Rocket className="w-5 h-5 transition-transform group-hover:-translate-y-1" /> Launch</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card p-20 text-center animate-fade-in flex flex-col items-center relative overflow-hidden shadow-[0_40px_80px_-15px_rgba(30,27,75,0.1)] border-none ring-1 ring-accent-50 rounded-[3rem]">
          <div className="absolute inset-0 pointer-events-none opacity-40">
            {['Toys', 'PL', 'Home', 'Treats', 'Care'].map((emoji, i) => (
              <span key={i} className="absolute text-3xl animate-bounce" style={{ left: `${5 + i * 22}%`, top: `${15 + (i % 3) * 20}%`, animationDelay: `${i * 0.2}s` }}>{emoji}</span>
            ))}
          </div>
          <div className="w-32 h-32 bg-emerald-50 rounded-[3rem] flex items-center justify-center mb-8 relative z-10 shadow-inner group">
            <CheckCircle className="w-16 h-16 text-emerald-500 transition-transform duration-500 group-hover:rotate-[360deg]" />
          </div>
          <h2 className="text-4xl font-black text-slate-900 mb-4 relative z-10 tracking-tight">Active Deployment! AI</h2>
          <p className="text-lg text-slate-500 mb-12 max-w-md mx-auto relative z-10 font-bold leading-relaxed">
            Messaging {audienceResult?.count} users via {channel}. Stand by for performance telemetry.
          </p>
          {liveStats && (
            <div className="grid grid-cols-4 gap-6 w-full max-w-2xl mb-12 relative z-10">
              {[
                { label: 'Sent', value: liveStats.sent, color: 'slate' },
                { label: 'Delivery', value: liveStats.delivered, color: 'accent' },
                { label: 'Opens', value: liveStats.opened, color: 'accent' },
                { label: 'Clicks', value: liveStats.clicked, color: 'orange' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-50 group hover:border-accent-100 transition-all">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{s.label}</p>
                  <p className="text-3xl font-black text-slate-900 tabular-nums">{s.value || 0}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center text-xs font-black text-accent-500 uppercase tracking-widest bg-accent-50 px-8 py-3 rounded-full relative z-10 shadow-sm border border-accent-100 animate-pulse">
            <div className="w-2.5 h-2.5 rounded-full bg-accent-600 mr-4 shadow-sm" />
            Loading Live Dashboard
          </div>
        </div>
      )}
    </div>
  );
};

export default NewCampaign;

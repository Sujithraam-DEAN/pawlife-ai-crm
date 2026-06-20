import { Link } from 'react-router-dom';
import { MessageCircle, Mail, Smartphone, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const CampaignCard = ({ campaign }) => {
  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'whatsapp': return <MessageCircle className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'sms': return <Smartphone className="w-4 h-4" />;
      default: return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full">Completed</span>;
      case 'sending':
        return (
          <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-accent-50 text-accent-600 border border-accent-100 rounded-full flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 mr-2 animate-pulse"></span>
            Sending
          </span>
        );
      default:
        return <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-slate-50 text-slate-500 border border-slate-100 rounded-full">Draft</span>;
    }
  };

  const stats = campaign.stats || {};
  const sent = stats.sent || 0;
  const opened = stats.opened || 0;
  const clicked = stats.clicked || 0;
  
  const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
  const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;

  return (
    <div className="card p-6 hover:translate-y-[-2px] transition-all group">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-bold text-slate-800 text-lg mb-1.5 group-hover:text-accent-600 transition-colors">{campaign.name}</h3>
          <div className="flex items-center text-xs text-slate-400 space-x-3 font-medium">
            <span className="flex items-center capitalize bg-slate-50 px-2 py-0.5 rounded-md">
              {getChannelIcon(campaign.channel)}
              <span className="ml-1.5">{campaign.channel}</span>
            </span>
            <span className="text-slate-200">-</span>
            <span>{campaign.created_at ? formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true }) : 'Just now'}</span>
          </div>
        </div>
        {getStatusBadge(campaign.status)}
      </div>
      
      <div className="grid grid-cols-3 gap-6 mb-6 p-4 bg-accent-50/30 rounded-2xl border border-accent-50/50">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sent</p>
          <p className="text-lg font-bold text-slate-800">{sent}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Opened</p>
          <p className="text-lg font-bold text-accent-600">{openRate}%</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Clicked</p>
          <p className="text-lg font-bold text-emerald-600">{clickRate}%</p>
        </div>
      </div>
      
      <div className="flex justify-end">
        <Link 
          to={`/campaigns/${campaign._id}`}
          className="text-sm font-bold text-accent-500 hover:text-accent-600 flex items-center transition-all group-hover:gap-2 gap-1"
        >
          View Details <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default CampaignCard;

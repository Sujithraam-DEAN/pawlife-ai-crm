import { useState } from 'react';
import { MessageCircle, Send, X, Bot } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const DashboardChat = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ask me anything about your customers - cities, overdue restocks, pet types, and more.' },
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userMsg = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', { query: userMsg });
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.answer }]);
    } catch {
      toast.error('Could not get an answer');
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I could not process that. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-8 right-8 z-50 bg-accent-600 hover:bg-accent-700 text-white rounded-full p-4 shadow-xl shadow-accent-500/20 flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
        aria-label="Open AI chat"
      >
        <div className="relative">
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
        </div>
        <span className="text-sm font-bold pr-2 hidden sm:inline">Ask Assistant</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-md border border-accent-50 flex flex-col overflow-hidden animate-fade-in">
      <div className="bg-accent-600 text-white px-6 py-5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-sm block">PawLife AI</span>
            <span className="text-[10px] text-accent-100 font-medium">Online & ready to help</span>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 max-h-80 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
              msg.role === 'user'
                ? 'bg-accent-600 text-white rounded-tr-none'
                : 'bg-white text-slate-700 border border-accent-50 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-3 text-xs text-slate-400 pl-2 font-medium">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 bg-accent-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
            AI is thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-white flex gap-3 border-t border-slate-50">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything..."
          className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:bg-white transition-all"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-lg shadow-accent-500/20 active:scale-95"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

export default DashboardChat;

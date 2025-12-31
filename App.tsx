
import React, { useState, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, LineChart, Line, Cell, PieChart, Pie, ScatterChart, Scatter, ZAxis,
  ComposedChart
} from 'recharts';
import { 
  LayoutDashboard, Search, Settings, Bell, ChevronDown, 
  Filter, Download, Calendar, Globe, Target, Facebook, Activity,
  ExternalLink, TrendingUp, Compass, Cpu, Share2, Map, Zap,
  AlertCircle, DollarSign, Sparkles, Plus, MoreHorizontal, X, User,
  MousePointer2, BarChart3, Layers, ArrowUpRight, ArrowDownRight,
  TrendingDown, Info, Link as LinkIcon, Clock, Send, Bot, FileText, ChevronRight,
  ShieldCheck, Unlink, RefreshCw, ShoppingBag, ArrowLeft
} from 'lucide-react';
import { 
  PERFORMANCE_METRICS, CHART_DATA, CALENDAR_DATA, CORE_WEB_VITALS, 
  SEO_METRICS, COMPETITORS, LEAD_GEOGRAPHY, CAMPAIGNS, LTV_COHORTS,
  REPORTING_DATA, INTEGRATIONS
} from './mockData';
import { getAdvancedInsights, chatWithMarketingAI } from './services/geminiService';
import { AIInsight, DashboardView, ChatMessage, Campaign, Integration } from './types';

const App: React.FC = () => {
  const [domain, setDomain] = useState('omnichannel-analytics.io');
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  useEffect(() => {
    const fetchAI = async () => {
      setLoadingInsights(true);
      const res = await getAdvancedInsights(domain, { metrics: PERFORMANCE_METRICS, campaigns: CAMPAIGNS });
      setInsights(res);
      setLoadingInsights(false);
    };
    fetchAI();
  }, [domain]);

  const handleAIQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiInput.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content: aiInput, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMsg]);
    const currentInput = aiInput;
    setAiInput('');
    setActiveView('strategy');
    setIsAiThinking(true);

    try {
      // Updated to handle object response containing sources
      const responseData = await chatWithMarketingAI(currentInput, { domain, metrics: PERFORMANCE_METRICS });
      const assistantMsg: ChatMessage = { 
        role: 'assistant', 
        content: responseData.text, 
        timestamp: new Date(),
        sources: responseData.sources 
      };
      setChatHistory(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = { role: 'assistant', content: "I encountered an error analyzing that data. Please try again.", timestamp: new Date() };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const renderContent = () => {
    if (selectedCampaign) {
      return <CampaignDetailView campaign={selectedCampaign} onBack={() => setSelectedCampaign(null)} />;
    }

    switch (activeView) {
      case 'overview': return <OverviewView />;
      case 'campaigns': return <CampaignsView onSelect={setSelectedCampaign} />;
      case 'seo': return <SEOView />;
      case 'ltv': return <LTVView />;
      case 'forecast': return <ForecastView />;
      case 'reporting': return <ReportingView />;
      case 'strategy': return <StrategyAIView history={chatHistory} isThinking={isAiThinking} />;
      case 'connectors': return <ConnectorsView />;
      default: return <OverviewView />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden text-white bg-[#0a0a0b]">
      {/* SIDEBAR */}
      <aside className="w-[240px] border-r border-[#212124] bg-[#0a0a0b] flex flex-col p-6 shrink-0">
        <div className="flex items-center gap-2 mb-10 px-2 cursor-pointer" onClick={() => { setActiveView('overview'); setSelectedCampaign(null); }}>
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-black"></div>
          </div>
          <span className="font-bold text-lg tracking-tight">Origin</span>
        </div>

        <div className="space-y-8 flex-1 overflow-y-auto no-scrollbar">
          <div>
            <nav className="space-y-1">
              <SidebarItem icon={<LayoutDashboard size={18} />} label="Overview" active={activeView === 'overview' && !selectedCampaign} onClick={() => { setActiveView('overview'); setSelectedCampaign(null); }} />
              <SidebarItem icon={<Target size={18} />} label="Campaigns" active={activeView === 'campaigns' || !!selectedCampaign} onClick={() => { setActiveView('campaigns'); setSelectedCampaign(null); }} />
              <SidebarItem icon={<Compass size={18} />} label="Forecast" active={activeView === 'forecast'} onClick={() => { setActiveView('forecast'); setSelectedCampaign(null); }} />
              <SidebarItem icon={<Share2 size={18} />} label="LTV Analysis" active={activeView === 'ltv'} onClick={() => { setActiveView('ltv'); setSelectedCampaign(null); }} />
            </nav>
          </div>

          <div>
            <p className="text-[10px] font-bold text-[#80808a] uppercase tracking-widest mb-4 px-2">Growth Services</p>
            <nav className="space-y-1">
              <SidebarItem icon={<Globe size={18} />} label="SEO Strategy" active={activeView === 'seo'} onClick={() => { setActiveView('seo'); setSelectedCampaign(null); }} />
              <SidebarItem icon={<BarChart3 size={18} />} label="Reporting" active={activeView === 'reporting'} onClick={() => { setActiveView('reporting'); setSelectedCampaign(null); }} />
              <SidebarItem icon={<Bot size={18} />} label="Strategy AI" active={activeView === 'strategy'} onClick={() => { setActiveView('strategy'); setSelectedCampaign(null); }} />
            </nav>
          </div>

          <div>
            <p className="text-[10px] font-bold text-[#80808a] uppercase tracking-widest mb-4 px-2">Management</p>
            <nav className="space-y-1">
              <SidebarItem icon={<Layers size={18} />} label="Connectors" active={activeView === 'connectors'} onClick={() => { setActiveView('connectors'); setSelectedCampaign(null); }} />
              <SidebarItem icon={<Settings size={18} />} label="Settings" active={false} onClick={() => {}} />
            </nav>
          </div>
        </div>

        <div className="mt-auto">
          <button onClick={() => { setActiveView('strategy'); setSelectedCampaign(null); }} className="w-full flex items-center gap-2 py-3 px-4 rounded-xl border border-[#212124] text-sm text-[#80808a] hover:bg-[#141416] transition-all">
            <Plus size={16} />
            Ask Strategy AI
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-[#212124] flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-6">
            <button className={`text-sm font-bold border-b-2 transition-all pb-4 mt-4 h-14 ${activeView === 'overview' ? 'border-white' : 'border-transparent text-[#80808a]'}`} onClick={() => { setActiveView('overview'); setSelectedCampaign(null); }}>Growth Center</button>
            <button className={`text-sm font-medium pb-4 mt-4 h-14 hover:text-white transition-colors ${activeView === 'reporting' ? 'text-white border-b-2 border-white' : 'text-[#80808a]'}`} onClick={() => { setActiveView('reporting'); setSelectedCampaign(null); }}>Live Data</button>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-[#141416] border border-[#212124] rounded-full px-3 py-1">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
               <span className="text-[11px] font-bold uppercase tracking-widest">Attributing</span>
             </div>
             <Bell size={18} className="text-[#80808a] cursor-pointer hover:text-white" />
             <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shadow-[0_0_12px_rgba(79,70,229,0.3)]">MK</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {renderContent()}
        </div>

        {/* BOTTOM AI COMMAND BAR */}
        <form onSubmit={handleAIQuery} className="h-16 border-t border-[#212124] bg-[#0a0a0b] flex items-center px-8 gap-4 shrink-0">
           <div className="flex-1 relative group">
             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400"><Sparkles size={16} /></div>
             <input 
               type="text" 
               value={aiInput}
               onChange={(e) => setAiInput(e.target.value)}
               placeholder="How is our CAC trending for search campaigns?"
               className="w-full bg-[#141416] border border-[#212124] rounded-xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-[#4a4a4f]"
             />
           </div>
           <button type="submit" className="bg-white text-black text-sm font-bold px-8 py-2.5 rounded-xl hover:bg-slate-200 transition-all active:scale-95 shadow-lg flex items-center gap-2">
             Analyze <Send size={14} />
           </button>
        </form>
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="w-[320px] border-l border-[#212124] p-8 space-y-8 overflow-y-auto custom-scrollbar bg-[#0a0a0b] shrink-0">
        <div className="bg-gradient-to-br from-[#0a0a0b] to-[#141416] border border-indigo-500/30 p-6 rounded-2xl relative overflow-hidden shadow-2xl">
          <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
             <Sparkles size={12} className="animate-pulse" /> AI Optimizer Engaged
          </h4>
          <p className="text-xl font-bold leading-tight mb-4 text-white">Gemini 3.0 Real-time</p>
          <div className="w-full h-1 bg-[#212124] rounded-full mb-2">
            <div className="bg-indigo-500 h-full w-[92%] rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
          </div>
          <p className="text-[11px] text-[#80808a] font-medium leading-relaxed">Analyzing conversion paths for <span className="text-white font-bold">{domain}</span>.</p>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-bold text-[#80808a] uppercase tracking-widest px-2">Top Insights</p>
          {loadingInsights ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-32 bg-[#141416] animate-pulse rounded-2xl border border-[#212124]"></div>)}
            </div>
          ) : (
            insights.length > 0 ? insights.map((insight, idx) => (
              <div key={idx} className="origin-card p-5 border-[#212124] hover:border-indigo-500/30 transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase text-indigo-400">{insight.category}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                    insight.priority === 'high' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  }`}>
                    {insight.priority}
                  </span>
                </div>
                <h5 className="text-sm font-bold mb-2 leading-snug group-hover:text-indigo-400 transition-colors">{insight.title}</h5>
                <p className="text-[11px] text-[#80808a] leading-relaxed line-clamp-3">{insight.description}</p>
              </div>
            )) : <div className="text-xs text-[#80808a] italic p-4 text-center">No real-time insights available. Check your internet connection.</div>
          )}
        </div>

        <div className="origin-card p-6 bg-[#141416]/50">
           <h3 className="text-sm font-bold uppercase tracking-widest text-[#80808a] mb-6">Conversion Health</h3>
           <div className="space-y-6">
             {CORE_WEB_VITALS.map(vital => (
               <div key={vital.label}>
                 <div className="flex justify-between items-end mb-2">
                   <span className="text-xs font-bold text-[#80808a]">{vital.label}</span>
                   <span className={`text-xs font-bold ${vital.status === 'Good' ? 'text-emerald-500' : 'text-amber-500'}`}>{vital.value}</span>
                 </div>
                 <div className="h-1 bg-[#212124] rounded-full overflow-hidden">
                   <div className={`h-full rounded-full transition-all duration-1000 ${vital.status === 'Good' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${vital.score}%` }}></div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </aside>
    </div>
  );
};

/* --- SUB-VIEWS --- */

const CampaignDetailView: React.FC<{ campaign: Campaign; onBack: () => void }> = ({ campaign, onBack }) => (
  <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
    <button onClick={onBack} className="flex items-center gap-2 text-[#80808a] hover:text-white transition-colors mb-4 group">
      <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
      <span className="text-sm font-bold">Back to Campaigns</span>
    </button>
    
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-3 mb-2">
          {campaign.platform === 'google' ? <Globe size={24} className="text-blue-400" /> : <Facebook size={24} className="text-indigo-400" />}
          <h3 className="text-3xl font-bold">{campaign.name}</h3>
        </div>
        <p className="text-sm text-[#80808a]">Individual Campaign deep-dive • ID: {campaign.id}</p>
      </div>
      <div className={`px-4 py-2 rounded-xl border ${campaign.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'} font-bold text-sm uppercase`}>
        {campaign.status}
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatItem label="Total Spend" value={`$${campaign.spend.toLocaleString()}`} sub="Current Budget" />
      <StatItem label="Total Revenue" value={`$${campaign.revenue.toLocaleString()}`} sub="Attributed Gross" />
      <StatItem label="Conversions" value={campaign.conversions.toString()} sub="Unique Events" />
      <StatItem label="ROAS" value={`${campaign.roas}x`} sub="Return Multiplier" />
    </div>

    <div className="origin-card p-8">
      <h4 className="text-sm font-bold uppercase tracking-widest text-[#80808a] mb-8">Recent 7-Day Performance Trend</h4>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={campaign.dailyTrend || CHART_DATA.slice(-7)}>
            <defs>
              <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#212124" />
            <XAxis dataKey="date" stroke="#4a4a4f" fontSize={10} axisLine={false} tickLine={false} />
            <YAxis stroke="#4a4a4f" fontSize={10} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#0a0a0b', border: '1px solid #212124' }} />
            <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorTrend)" strokeWidth={3} />
            <Area type="monotone" dataKey="spend" stroke="#ef4444" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-8 mt-6">
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#6366f1] rounded-full"></div><span className="text-xs text-[#80808a]">Daily Revenue</span></div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#ef4444] rounded-full"></div><span className="text-xs text-[#80808a]">Daily Ad Spend</span></div>
      </div>
    </div>
  </div>
);

const ConnectorsView: React.FC = () => (
  <div className="space-y-12 animate-in fade-in duration-500">
    <div>
      <h3 className="text-2xl font-bold">Data Connectors</h3>
      <p className="text-sm text-[#80808a]">Securely link your advertising and analytics accounts for real-time attribution.</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {INTEGRATIONS.map(int => (
        <div key={int.id} className="origin-card p-6 flex flex-col justify-between hover:border-indigo-500/30 transition-all group">
          <div className="flex items-start justify-between mb-8">
            <div className={`p-3 rounded-2xl ${int.status === 'connected' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-[#141416] text-[#4a4a4f]'}`}>
              {int.icon === 'google' ? <Globe size={24} /> : 
               int.icon === 'facebook' ? <Facebook size={24} /> : 
               int.icon === 'activity' ? <Activity size={24} /> : <ShoppingBag size={24} />}
            </div>
            <div className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full border ${int.status === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
              {int.status}
            </div>
          </div>
          
          <div className="mb-8">
            <h4 className="text-lg font-bold mb-1">{int.name}</h4>
            <p className="text-xs text-[#80808a]">{int.status === 'connected' ? `Linked as ${int.accountName}` : 'No active connection found'}</p>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-[#212124]">
            <div className="text-[10px] text-[#4a4a4f] font-bold uppercase tracking-widest">
              {int.status === 'connected' ? `Last sync: ${int.lastSync}` : 'Requires OAuth'}
            </div>
            {int.status === 'connected' ? (
              <button className="text-[#80808a] hover:text-red-400 transition-colors"><Unlink size={16} /></button>
            ) : (
              <button className="text-indigo-400 hover:text-white transition-colors flex items-center gap-1 text-[11px] font-bold">Connect <ChevronRight size={14} /></button>
            )}
          </div>
        </div>
      ))}
      <div className="origin-card p-6 border-dashed border-[#212124] bg-transparent flex flex-col items-center justify-center text-center py-12 hover:border-indigo-500/50 transition-all group cursor-pointer">
        <div className="w-12 h-12 rounded-full bg-[#141416] flex items-center justify-center mb-4 group-hover:bg-indigo-500/10 transition-colors">
          <Plus size={24} className="text-[#4a4a4f] group-hover:text-indigo-400 transition-colors" />
        </div>
        <p className="text-sm font-bold text-[#4a4a4f] group-hover:text-white transition-colors">Add Custom Source</p>
      </div>
    </div>

    <div className="origin-card p-8 bg-gradient-to-r from-indigo-500/5 to-transparent flex items-center justify-between border-indigo-500/10">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 rounded-3xl bg-indigo-500 flex items-center justify-center shadow-lg">
          <ShieldCheck size={32} className="text-black" />
        </div>
        <div>
          <h4 className="text-lg font-bold mb-1">Enterprise-Grade Security</h4>
          <p className="text-sm text-[#80808a] max-w-md">Your API credentials are never stored. We use short-lived OAuth tokens and read-only access where possible.</p>
        </div>
      </div>
      <button className="bg-white text-black text-sm font-bold px-6 py-3 rounded-xl hover:bg-slate-200 transition-all">
        Security Audit Logs
      </button>
    </div>
  </div>
);

const StrategyAIView: React.FC<{ history: ChatMessage[], isThinking: boolean }> = ({ history, isThinking }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [history, isThinking]);

  return (
    <div className="flex flex-col h-full space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="text-indigo-400" /> Marketing Strategist</h3>
          <p className="text-sm text-[#80808a]">Real-time reasoning across campaigns, SEO, and budget distributions.</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-8 pr-4 custom-scrollbar">
        {history.length === 0 && !isThinking && (
          <div className="h-full flex flex-col items-center justify-center opacity-40 text-center space-y-6 py-20">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Bot size={32} className="text-indigo-400" />
            </div>
            <div className="max-w-md">
              <h4 className="font-bold text-white mb-2">How can I help you grow today?</h4>
              <p className="text-sm text-[#80808a]">Try asking: "What are our best performing search keywords this month?" or "How should we reallocate budget for Q4?"</p>
            </div>
          </div>
        )}
        {history.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-6 rounded-2xl border ${msg.role === 'user' ? 'bg-[#141416] border-[#212124]' : 'bg-[#0d0d0f] border-indigo-500/20 shadow-xl'}`}>
              <div className="flex items-center gap-2 mb-3">
                {msg.role === 'assistant' ? <Bot size={14} className="text-indigo-400" /> : <User size={14} className="text-[#80808a]" />}
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#80808a]">{msg.role === 'assistant' ? 'Gemini AI Strategy Engine' : 'Marketing Executive'}</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200">{msg.content}</p>
              
              {/* Added to display search sources as per grounding guidelines */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 pt-4 border-t border-indigo-500/10">
                  <p className="text-[10px] font-bold text-[#80808a] uppercase mb-2 tracking-widest">Sources & Grounding</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.map((src, i) => (
                      <a 
                        key={i} 
                        href={src.uri} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded hover:bg-indigo-500/20 transition-colors"
                      >
                        <ExternalLink size={10} /> {src.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="p-6 rounded-2xl bg-[#0d0d0f] border border-indigo-500/10 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                </div>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Synthesizing Analytics...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ReportingView: React.FC = () => {
  const [platformFilter, setPlatformFilter] = useState('All');
  const filteredData = platformFilter === 'All' ? REPORTING_DATA : REPORTING_DATA.filter(d => d.platform === platformFilter);

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Robust Performance Engine</h3>
          <p className="text-sm text-[#80808a]">Daily attribution metrics and multi-channel spending reports.</p>
        </div>
        <div className="flex gap-3">
           <div className="relative">
             <select 
               value={platformFilter} 
               onChange={(e) => setPlatformFilter(e.target.value)}
               className="appearance-none bg-[#141416] border border-[#212124] rounded-xl pl-4 pr-10 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/50"
             >
               <option>All</option>
               <option>Google Ads</option>
               <option>Meta Ads</option>
             </select>
             <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#80808a]" size={14} />
           </div>
           <button className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-xs font-bold hover:bg-slate-200 transition-all shadow-lg active:scale-95">
             <Download size={14} /> Generate Report
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatItem label="Aggregated Spend" value="$12,400" sub="across selected period" />
        <StatItem label="Performance CTR" value="2.72%" sub="average engagement" />
        <StatItem label="CPA" value="$25.72" sub="cost per conversion" />
        <StatItem label="Effective ROAS" value="6.78x" sub="+$42.5k revenue" />
      </div>

      <div className="origin-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#141416] text-[#80808a] text-[10px] uppercase font-bold tracking-widest">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Source</th>
              <th className="px-6 py-4">Clicks (CTR)</th>
              <th className="px-6 py-4">Spend</th>
              <th className="px-6 py-4">Conv.</th>
              <th className="px-6 py-4 text-right">Revenue (ROAS)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#212124]">
            {filteredData.map((row, i) => (
              <tr key={i} className="hover:bg-[#141416] transition-colors group">
                <td className="px-6 py-4 text-xs font-bold text-white">{row.date}</td>
                <td className="px-6 py-4 text-xs">
                  <span className="flex items-center gap-2">
                    {row.platform === 'Google Ads' ? <Globe size={12} className="text-blue-400" /> : <Facebook size={12} className="text-indigo-400" />}
                    {row.platform}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs font-medium">
                  {row.clicks.toLocaleString()} <span className="text-[10px] text-[#4a4a4f] ml-1">({row.ctr}%)</span>
                </td>
                <td className="px-6 py-4 text-xs font-bold text-slate-300">${row.spend.toLocaleString()}</td>
                <td className="px-6 py-4 text-xs font-bold text-indigo-400">{row.conversions}</td>
                <td className="px-6 py-4 text-right">
                  <div className="text-xs font-bold text-emerald-500">${row.revenue.toLocaleString()}</div>
                  <div className="text-[10px] text-[#4a4a4f] font-bold">{(row.revenue / row.spend).toFixed(2)}x ROAS</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, sub }: { label: string, value: string, sub: string }) => (
  <div className="origin-card p-5 border-l-4 border-l-indigo-500/50">
    <p className="text-[10px] font-bold text-[#80808a] uppercase tracking-widest mb-1">{label}</p>
    <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
    <p className="text-[10px] text-[#4a4a4f] font-bold mt-1 uppercase">{sub}</p>
  </div>
);

const OverviewView: React.FC = () => {
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  
  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <section>
        <p className="text-[10px] font-bold text-[#80808a] uppercase tracking-widest mb-2">TOTAL ATTRIBUTED REVENUE</p>
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-4xl font-bold tracking-tight">$842,592</h2>
            <p className="text-emerald-500 font-bold text-sm mt-1 flex items-center gap-1">
              <TrendingUp size={14} /> +14.2% vs last month
            </p>
          </div>
        </div>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CHART_DATA}>
              <defs>
                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVal)" className="chart-glow" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="origin-card p-6 min-h-[420px] flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#80808a] mb-8">Global Lead Origins</h3>
          <div className="flex-1 relative overflow-hidden rounded-xl border border-[#212124] bg-[#0d0d0f]">
            <svg viewBox="0 0 800 400" className="w-full h-full opacity-20">
              <path fill="#212124" d="M150,100 Q180,80 220,100 T300,120 T380,90 T450,110 T550,80 T650,100 T750,120 L750,300 Q700,320 650,300 T550,280 T450,310 T350,290 T250,310 T150,280 Z" />
            </svg>
            {LEAD_GEOGRAPHY.map(lead => (
              <div key={lead.id} className="absolute w-2 h-2 bg-indigo-500 rounded-full border border-white shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" style={{ left: `${lead.coordinates.x}%`, top: `${lead.coordinates.y}%` }}></div>
            ))}
          </div>
        </div>

        <div className="origin-card p-6 min-h-[420px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#80808a]">Lead Velocity Heatmap</h3>
            <div className="flex items-center gap-1 bg-[#141416] border border-[#212124] px-2 py-1 rounded text-[10px] font-bold text-[#80808a]">
              <Calendar size={10} /> OCT 2023
            </div>
          </div>

          <div className="flex flex-1 gap-6">
            <div className="flex-1">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {weekDays.map(d => <div key={d} className="text-[10px] font-bold text-[#4a4a4f] text-center">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 6 }).map((_, i) => <div key={`pad-${i}`} className="w-full aspect-square opacity-0" />)}
                {CALENDAR_DATA.map(d => (
                  <div key={d.day} className="w-full aspect-square rounded-[6px] flex items-center justify-center text-[9px] font-bold border border-transparent hover:border-indigo-500 transition-all cursor-default" style={{ backgroundColor: `rgba(99, 102, 241, ${0.05 + (d.intensity * 0.18)})`, color: d.intensity > 3 ? '#fff' : '#4a4a4f' }}>{d.day}</div>
                ))}
              </div>
            </div>
            <div className="w-32 border-l border-[#212124] pl-6 flex flex-col justify-between py-2">
              <div className="space-y-6">
                <div><p className="text-[9px] font-bold text-[#80808a] uppercase tracking-tighter mb-1 flex items-center gap-1"><Zap size={10} className="text-amber-400" /> Peak Hour</p><p className="text-sm font-bold">14:00 EST</p></div>
                <div><p className="text-[9px] font-bold text-[#80808a] uppercase tracking-tighter mb-1 flex items-center gap-1"><Clock size={10} /> Avg. Lead Time</p><p className="text-sm font-bold">18s</p></div>
              </div>
              <div className="h-16 w-full opacity-40">
                <ResponsiveContainer width="100%" height="100%"><LineChart data={CALENDAR_DATA.slice(-7)}><Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CampaignsView: React.FC<{ onSelect: (c: Campaign) => void }> = ({ onSelect }) => (
  <section className="space-y-8 animate-in slide-in-from-right-4 duration-500">
    <div className="flex items-center justify-between">
      <h3 className="text-2xl font-bold">Ad Campaigns</h3>
      <div className="flex gap-2">
        <button className="px-4 py-2 bg-[#141416] border border-[#212124] rounded-xl text-xs font-bold hover:bg-[#212124]">All Channels</button>
        <button className="px-4 py-2 bg-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-700">Add Campaign</button>
      </div>
    </div>
    <div className="origin-card overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-[#141416] text-[#80808a] text-[10px] uppercase font-bold tracking-widest">
          <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Spend</th><th className="px-6 py-4">Revenue</th><th className="px-6 py-4 text-right">ROAS</th></tr>
        </thead>
        <tbody className="divide-y divide-[#212124]">
          {CAMPAIGNS.map(c => (
            <tr key={c.id} onClick={() => onSelect(c)} className="hover:bg-[#141416] transition-colors cursor-pointer group">
              <td className="px-6 py-4 text-sm font-bold group-hover:text-indigo-400 transition-colors">{c.name}</td>
              <td className="px-6 py-4"><span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{c.status}</span></td>
              <td className="px-6 py-4 text-sm">${c.spend.toLocaleString()}</td>
              <td className="px-6 py-4 text-sm font-bold">${c.revenue.toLocaleString()}</td>
              <td className={`px-6 py-4 text-sm text-right font-bold ${c.roas > 4 ? 'text-emerald-500' : 'text-amber-500'}`}>{c.roas}x</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

const LTVView: React.FC = () => (
  <section className="space-y-8 animate-in zoom-in-95 duration-500">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="origin-card p-6 border-indigo-500/20"><p className="text-[10px] font-bold text-[#80808a] uppercase tracking-widest mb-2 flex items-center gap-2"><Target size={12} /> LTV:CAC Ratio</p><h4 className="text-3xl font-bold">3.8x</h4><p className="text-emerald-500 text-[10px] font-bold mt-1">Efficient Growth Segment</p></div>
      <div className="origin-card p-6"><p className="text-[10px] font-bold text-[#80808a] uppercase tracking-widest mb-2 flex items-center gap-2"><Clock size={12} /> Avg Payback</p><h4 className="text-3xl font-bold">4.2 Mo</h4><p className="text-[#80808a] text-[10px] font-bold mt-1">Trending Down (Better)</p></div>
      <div className="origin-card p-6"><p className="text-[10px] font-bold text-[#80808a] uppercase tracking-widest mb-2 flex items-center gap-2"><User size={12} /> Avg ACV</p><h4 className="text-3xl font-bold">$12.4k</h4><p className="text-indigo-400 text-[10px] font-bold mt-1">High Intent Cohorts</p></div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="origin-card p-8"><h3 className="text-sm font-bold uppercase tracking-widest text-[#80808a] mb-8">Cohort Profitability</h3><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={LTV_COHORTS}><XAxis dataKey="month" stroke="#80808a" fontSize={12} tickLine={false} axisLine={false} /><Tooltip cursor={{ fill: '#141416' }} contentStyle={{ backgroundColor: '#0a0a0b', border: '1px solid #212124' }} /><Bar dataKey="ltv" name="LTV" fill="#6366f1" radius={[4,4,0,0]} /><Bar dataKey="cac" name="CAC" fill="#ef4444" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div></div>
      <div className="origin-card p-8"><h3 className="text-sm font-bold uppercase tracking-widest text-[#80808a] mb-8">Segment Distribution</h3><div className="h-[300px] flex items-center justify-center"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{n:'High LTV', v:45}, {n:'Medium', v:35}, {n:'Low', v:20}]} dataKey="v" nameKey="n" innerRadius={60} outerRadius={80} paddingAngle={5}><Cell fill="#6366f1" /><Cell fill="#818cf8" /><Cell fill="#212124" /></Pie><Tooltip contentStyle={{ backgroundColor: '#0a0a0b', border: '1px solid #212124' }} /></PieChart></ResponsiveContainer></div></div>
    </div>
  </section>
);

const SEOView: React.FC = () => (
  <section className="space-y-8 animate-in slide-in-from-left-4 duration-500">
    <div className="flex items-center justify-between"><div><h3 className="text-2xl font-bold">SEO Strategy</h3><p className="text-sm text-[#80808a]">Analyzing search intent and authority scores</p></div><div className="origin-card px-4 py-2 border-emerald-500/20"><p className="text-[10px] font-bold text-[#80808a] uppercase">Authority Score</p><p className="text-sm font-bold text-emerald-500">64/100</p></div></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="origin-card p-6 overflow-hidden"><h4 className="text-sm font-bold uppercase tracking-widest text-[#80808a] mb-6">Master Keyword Monitor</h4><div className="space-y-4">{SEO_METRICS.map(seo => (<div key={seo.keyword} className="flex items-center justify-between pb-4 border-b border-[#212124] last:border-0 group cursor-default"><div><p className="text-sm font-bold group-hover:text-indigo-400 transition-colors">{seo.keyword}</p><p className="text-[10px] text-[#4a4a4f] uppercase font-bold">Vol: {seo.volume.toLocaleString()}</p></div><div className="text-right"><p className="text-sm font-bold text-white">#{seo.position}</p><p className={`text-[10px] font-bold ${seo.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{seo.change >= 0 ? `+${seo.change}` : seo.change}</p></div></div>))}</div></div>
      <div className="origin-card p-6"><h4 className="text-sm font-bold uppercase tracking-widest text-[#80808a] mb-6">Traffic Intensity Matrix</h4><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><ScatterChart><XAxis dataKey="volume" hide /><YAxis dataKey="position" reversed stroke="#80808a" fontSize={10} /><ZAxis dataKey="difficulty" range={[50, 400]} /><Tooltip /><Scatter data={SEO_METRICS} fill="#6366f1" /></ScatterChart></ResponsiveContainer></div></div>
    </div>
  </section>
);

const ForecastView: React.FC = () => {
  const [growthFactor, setGrowthFactor] = useState(1.15);
  return (
    <section className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between"><div><h3 className="text-2xl font-bold">Revenue Forecasting</h3><p className="text-sm text-[#80808a]">Predictive modelling based on current ROAS trends</p></div><div className="flex items-center gap-4 bg-[#141416] p-4 rounded-xl border border-[#212124]"><span className="text-[10px] font-bold text-[#80808a] uppercase">Simulate Ad Boost:</span><input type="range" min="0.8" max="2" step="0.05" value={growthFactor} onChange={(e) => setGrowthFactor(parseFloat(e.target.value))} className="accent-indigo-500" /><span className="text-xs font-bold text-indigo-400">{(growthFactor * 100 - 100).toFixed(0)}%</span></div></div>
      <div className="origin-card p-8"><div className="h-[400px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={CHART_DATA}><XAxis dataKey="date" stroke="#4a4a4f" fontSize={10} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip contentStyle={{ backgroundColor: '#0a0a0b', border: '1px solid #212124' }} /><Area type="monotone" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.05} /><Line type="monotone" dataKey={(v) => v.value * growthFactor} stroke="#6366f1" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Forecasted Revenue" /></ComposedChart></ResponsiveContainer></div></div>
    </section>
  );
};

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${active ? 'bg-[#141416] text-white font-bold shadow-sm' : 'text-[#80808a] hover:text-white hover:bg-[#141416]/50'}`}><span className={active ? 'text-indigo-400' : 'text-[#80808a]'}>{icon}</span><span className="text-sm">{label}</span></button>
);

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (<div className="bg-[#141416] border border-[#212124] p-4 rounded-xl shadow-2xl backdrop-blur-md"><p className="text-[10px] font-bold text-[#80808a] uppercase mb-1 tracking-widest">{payload[0].payload.date}</p><p className="text-lg font-bold text-white">${payload[0].value.toLocaleString()} <span className="text-[10px] text-[#80808a]">Revenue</span></p></div>);
  }
  return null;
};

export default App;

import { useState, type ReactNode } from 'react';
import { 
  Sparkles, Video, Wand2, Zap, Youtube,
  Search, Check,
  Loader2, X, User, Play, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

interface ToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

const ToolModal = ({ isOpen, onClose, title, icon, children }: ToolModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#1a1a1a] border border-[#333] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
        >
          <div className="p-6 border-b border-[#333] flex justify-between items-center bg-gradient-to-r from-purple-900/20 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/20 rounded-lg text-purple-400">
                {icon}
              </div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#333] rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export const AutomationTools = ({ assets, onAssetCreated }: { assets: any[], onAssetCreated?: (asset: any) => void }) => {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [formData, setFormData] = useState<any>({ videoId: '' });

  const tools = [
    {
      id: 'faceless',
      title: 'Faceless Video Gen',
      desc: 'Topic to full video with TTS & visuals',
      icon: <Video className="w-5 h-5" />,
      color: 'from-blue-500 to-cyan-500',
      badge: 'Premium'
    },
    {
      id: 'avatar',
      title: 'AI Avatar Creator',
      desc: 'Create custom AI avatars with voice',
      icon: <User className="w-5 h-5" />,
      color: 'from-emerald-500 to-teal-500',
      badge: 'New'
    },
    {
      id: 'reel',
      title: 'Viral Reel Maker',
      desc: 'Turn long videos into viral shorts',
      icon: <Zap className="w-5 h-5" />,
      color: 'from-purple-500 to-pink-500',
      badge: 'Pro'
    },
    {
      id: 'monetize',
      title: 'Monetization Pack',
      desc: 'AI Titles, Descriptions & Tags',
      icon: <Youtube className="w-5 h-5" />,
      color: 'from-red-500 to-orange-500',
      badge: 'SEO'
    }
  ];

  const handleGenerate = async (type: string) => {
    setLoading(true);
    setResult(null);
    try {
      let endpoint = '';
      let body = {};

      switch (type) {
        case 'faceless':
          endpoint = '/api/ai/generate-script';
          body = { topic: formData.topic };
          break;
        case 'monetize':
          endpoint = '/api/ai/monetize';
          body = { projectData: formData };
          break;
        case 'avatar':
          endpoint = '/api/ai/generate-avatar';
          body = { prompt: formData.avatarPrompt, text: formData.avatarText };
          break;
        case 'reel':
          endpoint = '/api/ai/generate-reels';
          body = { inputId: formData.videoId }; // Assuming videoId is set
          break;
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) throw new Error('Generation failed');
      const resData = await response.json();
      
      if (resData.jobId) {
        // Poll for job status
        const pollJob = async () => {
          const jobRes = await fetch(`/api/job/${resData.jobId}`);
          const jobData = await jobRes.json();
          if (jobData.status === 'completed') {
            setResult(jobData.result);
            setLoading(false);
            if (onAssetCreated && jobData.result.id && jobData.result.url) {
              onAssetCreated({
                id: jobData.result.id,
                url: jobData.result.url,
                name: jobData.result.name || 'AI Generated Asset',
                type: 'video'
              });
            }
          } else if (jobData.status === 'failed') {
            setResult({ error: jobData.error || 'Job failed' });
            setLoading(false);
          } else {
            setTimeout(pollJob, 2000);
          }
        };
        pollJob();
      } else {
        setResult(resData);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setResult({ error: 'AI generation failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold text-white uppercase tracking-widest text-[10px]">AI Automation</h3>
        </div>
        <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">v2.5</span>
      </div>

      <div className="grid gap-3">
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => { setActiveTool(tool.id); setResult(null); setFormData({}); }}
            className="group relative p-4 bg-[#1a1a1a] border border-[#222] rounded-2xl text-left hover:border-purple-500/50 transition-all hover:bg-[#222] shadow-sm"
          >
            <div className={cn("absolute top-3 right-3 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#333] text-gray-400 group-hover:bg-purple-600 group-hover:text-white transition-colors")}>
              {tool.badge}
            </div>
            <div className="flex items-start gap-4">
              <div className={cn("p-2.5 rounded-xl text-white shadow-lg bg-gradient-to-br", tool.color)}>
                {tool.icon}
              </div>
              <div>
                <h4 className="font-bold text-white text-sm tracking-tight">{tool.title}</h4>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{tool.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Modals */}
      <ToolModal 
        isOpen={activeTool === 'faceless'} 
        onClose={() => setActiveTool(null)}
        title="Faceless Video Generator"
        icon={<Video className="w-5 h-5" />}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">What's the video about?</label>
            <textarea 
              value={formData.topic || ''}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="e.g. 5 facts about Space that will blow your mind..."
              className="w-full bg-[#2a2a2a] border border-[#333] rounded-xl p-4 text-white focus:ring-2 focus:ring-purple-500 outline-none h-32"
            />
          </div>
          <button 
            disabled={loading || !formData.topic}
            onClick={() => handleGenerate('faceless')}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? 'Generating Assets...' : 'Generate Full Video'}
          </button>
          
          {result && !result.error && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <h4 className="text-green-400 font-bold mb-2">Script Generated!</h4>
              <p className="text-sm text-gray-400 line-clamp-3">{result.voiceover}</p>
            </div>
          )}
        </div>
      </ToolModal>

      <ToolModal 
        isOpen={activeTool === 'avatar'} 
        onClose={() => setActiveTool(null)}
        title="AI Avatar Creator"
        icon={<User className="w-5 h-5" />}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Avatar Appearance</label>
            <input 
              type="text"
              value={formData.avatarPrompt || ''}
              onChange={(e) => setFormData({ ...formData, avatarPrompt: e.target.value })}
              placeholder="e.g. A futuristic robot with blue glowing eyes"
              className="w-full bg-[#2a2a2a] border border-[#333] rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">What should it say?</label>
            <textarea 
              value={formData.avatarText || ''}
              onChange={(e) => setFormData({ ...formData, avatarText: e.target.value })}
              placeholder="Enter the script for your avatar..."
              className="w-full bg-[#2a2a2a] border border-[#333] rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-emerald-500 h-24"
            />
          </div>
          <button 
            disabled={loading || !formData.avatarPrompt || !formData.avatarText}
            onClick={() => handleGenerate('avatar')}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? 'Creating Avatar...' : 'Create AI Avatar'}
          </button>

          {result && !result.error && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="aspect-square rounded-xl overflow-hidden border border-[#333]">
                <img src={result.imageUrl} alt="AI Avatar" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-center gap-3">
                <audio controls src={result.audioUrl} className="w-full" />
                <button className="flex items-center justify-center gap-2 p-3 bg-[#333] rounded-xl text-white hover:bg-[#444]">
                  <Download className="w-4 h-4" />
                  Save to Assets
                </button>
              </div>
            </div>
          )}
        </div>
      </ToolModal>

      <ToolModal 
        isOpen={activeTool === 'reel'} 
        onClose={() => setActiveTool(null)}
        title="Viral Reel Maker"
        icon={<Zap className="w-5 h-5" />}
      >
        <div className="space-y-6">
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-400 mt-1" />
            <p className="text-sm text-purple-200">AI will find the most engaging highlights and crop them for TikTok/Reels.</p>
          </div>
          
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-400">Select Source Video</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
              {assets.filter(a => a.type === 'video').map(asset => (
                <button
                  key={asset.id}
                  onClick={() => setFormData({ ...formData, videoId: asset.id })}
                  className={cn(
                    "p-2 rounded-xl border text-left transition-all",
                    formData.videoId === asset.id ? "border-purple-500 bg-purple-500/10" : "border-[#333] bg-[#222] hover:border-[#444]"
                  )}
                >
                  <div className="aspect-video bg-black rounded mb-2 overflow-hidden">
                    <video src={asset.url} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[10px] text-white truncate font-bold">{asset.name}</p>
                </button>
              ))}
              {assets.filter(a => a.type === 'video').length === 0 && (
                <div className="col-span-2 p-8 border-2 border-dashed border-[#333] rounded-2xl flex flex-col items-center justify-center gap-2">
                  <Video className="w-8 h-8 text-gray-600" />
                  <p className="text-xs text-gray-500">No videos uploaded yet</p>
                </div>
              )}
            </div>
          </div>

          <button 
            disabled={loading || !formData.videoId}
            onClick={() => handleGenerate('reel')}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Play className="w-5 h-5" />}
            {loading ? 'Processing Reel...' : 'Create Viral Reel'}
          </button>
        </div>
      </ToolModal>

      <ToolModal 
        isOpen={activeTool === 'monetize'} 
        onClose={() => setActiveTool(null)}
        title="Monetization Pack"
        icon={<Youtube className="w-5 h-5" />}
      >
        <div className="space-y-6">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-red-400 mt-1" />
            <p className="text-sm text-red-200">AI will analyze your current project and generate high-engagement metadata.</p>
          </div>
          
          <button 
            disabled={loading}
            onClick={() => handleGenerate('monetize')}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Search className="w-5 h-5" />}
            {loading ? 'Analyzing Project...' : 'Generate SEO Pack'}
          </button>

          {result && !result.error && (
            <div className="space-y-4">
              <div className="p-4 bg-[#2a2a2a] rounded-xl border border-[#333]">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-2">Suggested Titles</span>
                <ul className="space-y-2">
                  {result.titles?.map((t: string, i: number) => (
                    <li key={i} className="flex items-center justify-between p-2 hover:bg-[#333] rounded group cursor-pointer">
                      <span className="text-sm text-white">{t}</span>
                      <Check className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100" />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-[#2a2a2a] rounded-xl border border-[#333]">
                <span className="text-xs font-bold text-gray-500 uppercase block mb-2">Viral Tags</span>
                <div className="flex flex-wrap gap-2">
                  {result.tags?.map((tag: string) => (
                    <span key={tag} className="px-3 py-1 bg-[#333] rounded-full text-xs text-purple-300 border border-purple-500/30">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </ToolModal>
    </div>
  );
};

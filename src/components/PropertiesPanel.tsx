import { useState } from 'react';
import { 
  SkipBack, Mic, Sparkles, Sliders, Palette, 
  Info, History as HistoryIcon, Zap, Shield,
  Volume2, Maximize, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface TimelineClip {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  offset: number;
  track: number;
  type: 'video' | 'audio' | 'text';
  effects?: any[];
}

export const PropertiesPanel = ({ 
  selectedClip, 
  history,
  onUpdateClip 
}: { 
  selectedClip: TimelineClip | null, 
  history: string[],
  onUpdateClip: (id: string, updates: Partial<TimelineClip>) => void
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'history'>('properties');

  return (
    <div className="w-72 bg-[#111] border-l border-[#222] flex flex-col shadow-2xl overflow-hidden">
      <div className="flex border-b border-[#222] bg-[#141414]">
        <button 
          onClick={() => setActiveTab('properties')}
          className={cn(
            "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2", 
            activeTab === 'properties' ? "text-purple-500 border-b-2 border-purple-500 bg-purple-500/5" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <Sliders className="w-3 h-3" />
          Properties
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2", 
            activeTab === 'history' ? "text-purple-500 border-b-2 border-purple-500 bg-purple-500/5" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <HistoryIcon className="w-3 h-3" />
          History
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
        {activeTab === 'properties' ? (
          <AnimatePresence mode="wait">
            {selectedClip ? (
              <motion.div 
                key={selectedClip.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                      <Info className="w-3 h-3" /> Clip Info
                    </label>
                    <span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                      {selectedClip.type}
                    </span>
                  </div>
                  <div className="p-3 bg-[#1a1a1a] rounded-xl border border-[#222] space-y-2">
                    <p className="text-[10px] text-gray-400 font-bold truncate">{selectedClip.id}</p>
                    <div className="flex justify-between text-[9px] text-gray-500 uppercase font-bold tracking-widest">
                      <span>Start: {selectedClip.startTime.toFixed(2)}s</span>
                      <span>Dur: {selectedClip.duration.toFixed(2)}s</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                    <Maximize className="w-3 h-3" /> Transform
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Scale</span>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={selectedClip.effects?.find((e: any) => e.type === 'scale')?.value || 100} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            const effects = selectedClip.effects || [];
                            const newEffects = effects.filter((ef: any) => ef.type !== 'scale');
                            newEffects.push({ type: 'scale', value: val });
                            onUpdateClip(selectedClip.id, { effects: newEffects });
                          }}
                          className="w-full bg-[#0f0f0f] border border-[#222] rounded-lg p-2 text-xs text-white focus:border-purple-500/50 outline-none" 
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-600">%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Opacity</span>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={selectedClip.effects?.find((e: any) => e.type === 'opacity')?.value || 100} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            const effects = selectedClip.effects || [];
                            const newEffects = effects.filter((ef: any) => ef.type !== 'opacity');
                            newEffects.push({ type: 'opacity', value: val });
                            onUpdateClip(selectedClip.id, { effects: newEffects });
                          }}
                          className="w-full bg-[#0f0f0f] border border-[#222] rounded-lg p-2 text-xs text-white focus:border-purple-500/50 outline-none" 
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-600">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-3 h-3" /> AI Enhancements
                  </label>
                  <div className="space-y-2">
                    <button className="w-full flex items-center justify-between p-3 bg-[#1a1a1a] hover:bg-[#222] rounded-xl text-[11px] border border-[#222] transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                          <Mic className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <span className="font-medium">Voice Isolation</span>
                      </div>
                      <div className="w-8 h-4 bg-[#333] rounded-full relative">
                        <div className="absolute right-1 top-1 w-2 h-2 bg-purple-500 rounded-full shadow-lg shadow-purple-500/50" />
                      </div>
                    </button>
                    <button className="w-full flex items-center justify-between p-3 bg-[#1a1a1a] hover:bg-[#222] rounded-xl text-[11px] border border-[#222] transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <span className="font-medium">4K Upscaling</span>
                      </div>
                      <div className="w-8 h-4 bg-[#333] rounded-full" />
                    </button>
                    <button className="w-full flex items-center justify-between p-3 bg-[#1a1a1a] hover:bg-[#222] rounded-xl text-[11px] border border-[#222] transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                          <Volume2 className="w-3.5 h-3.5 text-green-400" />
                        </div>
                        <span className="font-medium">Auto Normalization</span>
                      </div>
                      <div className="w-8 h-4 bg-[#333] rounded-full relative">
                        <div className="absolute right-1 top-1 w-2 h-2 bg-green-500 rounded-full shadow-lg shadow-green-500/50" />
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                    <Palette className="w-3 h-3" /> Color Grading
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['grayscale', 'sepia', 'vivid', 'cinematic', 'blur', 'sharpen'].map(f => (
                      <button 
                        key={f} 
                        onClick={() => {
                          const effects = selectedClip.effects || [];
                          const newEffects = effects.filter((ef: any) => ef.type !== 'filter');
                          newEffects.push({ type: 'filter', name: f });
                          onUpdateClip(selectedClip.id, { effects: newEffects });
                        }}
                        className={cn(
                          "p-2.5 rounded-xl text-[10px] border transition-all font-medium capitalize",
                          selectedClip.effects?.find((e: any) => e.type === 'filter' && e.name === f)
                            ? "bg-purple-600 border-purple-500 text-white"
                            : "bg-[#1a1a1a] border-[#222] hover:bg-purple-600/20 hover:border-purple-500/50"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => onUpdateClip(selectedClip.id, { effects: (selectedClip.effects || []).filter((e: any) => e.type !== 'filter') })}
                    className="w-full py-2 flex items-center justify-center gap-2 text-[10px] text-gray-500 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Grading
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20"
              >
                <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#222] flex items-center justify-center">
                  <Sliders className="w-8 h-8 text-gray-700" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Selection</p>
                  <p className="text-[10px] text-gray-600 mt-1">Select a clip on the timeline to edit its properties.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                <SkipBack className="w-3 h-3" /> Recent Actions
              </label>
              <button className="text-[9px] text-purple-500 hover:text-purple-400 font-bold uppercase tracking-widest">Clear All</button>
            </div>
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="text-[10px] text-gray-600 text-center py-10 italic">No actions recorded yet.</p>
              ) : (
                history.map((h, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i} 
                    className="text-[11px] text-gray-400 flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-xl border border-[#222] group hover:border-purple-500/30 transition-all"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50" />
                    <span className="flex-1">{h}</span>
                    <span className="text-[9px] text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">Just now</span>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="p-4 bg-[#0a0a0a] border-t border-[#222]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Security Status</span>
          <div className="flex items-center gap-1 text-[9px] text-green-500 font-bold uppercase">
            <Shield className="w-3 h-3" />
            Verified
          </div>
        </div>
        <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div className="h-full bg-green-500/50 w-full" />
        </div>
      </div>
    </div>
  );
};

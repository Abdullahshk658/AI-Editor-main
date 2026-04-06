import { X, Monitor, Smartphone, Settings, Info, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ProjectSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  project: { name: string; aspectRatio: '16:9' | '9:16' };
  onUpdate: (updates: any) => void;
}

export const ProjectSettings = ({ isOpen, onClose, project, onUpdate }: ProjectSettingsProps) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-[#141414] border border-[#222] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          <div className="p-6 border-b border-[#222] flex items-center justify-between bg-gradient-to-r from-purple-900/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/20 rounded-xl">
                <Settings className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="font-bold text-white tracking-tight">Project Settings</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#222] rounded-full text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-8 space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                <Info className="w-3.5 h-3.5" /> Project Name
              </label>
              <input 
                type="text" 
                value={project.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl p-4 text-sm text-white focus:border-purple-500/50 outline-none transition-all"
                placeholder="Enter project name..."
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5" /> Project Aspect Ratio
              </label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: '16:9', label: '16:9', icon: Monitor, sub: 'Vlog' },
                  { id: '9:16', label: '9:16', icon: Smartphone, sub: 'Reel' }
                ].map((ratio) => (
                  <button
                    key={ratio.id}
                    onClick={() => onUpdate({ aspectRatio: ratio.id as '16:9' | '9:16' })}
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all relative group",
                      project.aspectRatio === ratio.id 
                        ? "bg-purple-600/10 border-purple-500 text-purple-400" 
                        : "bg-[#0a0a0a] border-[#222] text-gray-600 hover:border-[#333] hover:text-gray-400"
                    )}
                  >
                    <ratio.icon className={cn("w-6 h-6", project.aspectRatio === ratio.id ? "text-purple-400" : "text-gray-700")} />
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest">{ratio.label}</p>
                      <p className="text-[8px] opacity-60 mt-0.5">{ratio.sub}</p>
                    </div>
                    {project.aspectRatio === ratio.id && (
                      <div className="absolute -top-2 -right-2 bg-purple-500 text-white rounded-full p-1 shadow-lg shadow-purple-500/50">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Frame Rate
              </label>
              <div className="flex gap-2">
                {[24, 30, 60].map(fps => (
                  <button key={fps} className="flex-1 py-3 bg-[#0a0a0a] border border-[#222] rounded-xl text-xs font-bold text-gray-600 hover:border-purple-500/50 hover:text-purple-400 transition-all">
                    {fps} FPS
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-blue-400">
                <Info className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Hybrid Mode Active</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Your media is still processed and stored locally on this machine, while AI command parsing and metadata analysis now use the configured Gemini API key.
                Cloud synchronization is still disabled.
              </p>
            </div>
          </div>

          <div className="p-6 bg-[#0a0a0a] border-t border-[#222] flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-[#1a1a1a] hover:bg-[#222] text-gray-400 font-bold text-xs uppercase tracking-widest rounded-2xl transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-purple-500/20"
            >
              Save Changes
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

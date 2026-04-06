import { useEffect, useState } from 'react';
import { X, Download, Monitor, Smartphone, Square, CheckCircle2, Sparkles, Zap, Shield, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: any) => void;
  project: {
    aspectRatio: '16:9' | '9:16';
    clips: any[];
    assets: any[];
  };
}

export const ExportModal = ({ isOpen, onClose, onExport, project }: ExportModalProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [format, setFormat] = useState<'mp4' | 'mov'>('mp4');
  const [preset, setPreset] = useState<'youtube' | 'shorts' | 'custom'>('youtube');
  const [exportResult, setExportResult] = useState<string | null>(null);

  useEffect(() => {
    setPreset(project.aspectRatio === '9:16' ? 'shorts' : 'youtube');
  }, [project.aspectRatio, isOpen]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportResult(null);
    setProgress(0);

    try {
      const inputId = project.assets[0]?.id;
      if (!inputId || project.clips.length === 0) throw new Error('No media to export');

      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          inputId, 
          preset,
          aspectRatio: project.aspectRatio,
          timeline: project.clips,
          assets: project.assets,
          commands: [],
          settings: { quality, format } 
        })
      });
      
      if (!res.ok) throw new Error('Export failed');
      const { jobId } = await res.json();

      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/job/${jobId}`);
          const job = await statusRes.json();
          
          setProgress(job.progress);

          if (job.status === 'completed') {
            clearInterval(interval);
            setExportResult(job.result.url);
            setIsExporting(false);
            onExport({ quality, format, url: job.result.url });
          } else if (job.status === 'failed') {
            clearInterval(interval);
            setIsExporting(false);
            alert(`Export failed: ${job.error}`);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      setIsExporting(false);
      alert('Failed to start export');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/90 backdrop-blur-md"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 40 }}
          className="relative bg-[#111] border border-[#222] rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-[0_0_100px_rgba(147,51,234,0.15)]"
        >
          {isExporting ? (
            <div className="p-16 flex flex-col items-center justify-center text-center space-y-10">
              <div className="relative w-48 h-48">
                <div className="absolute inset-0 rounded-full border-8 border-purple-500/10" />
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="96" cy="96" r="88"
                    fill="none" stroke="currentColor" strokeWidth="8"
                    className="text-purple-500 transition-all duration-500 ease-out"
                    strokeDasharray={552.9}
                    strokeDashoffset={552.9 - (552.9 * progress) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-white tracking-tighter">{Math.round(progress)}%</span>
                  <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mt-1">Rendering</span>
                </div>
              </div>
              
              <div className="space-y-4 max-w-xs">
                <h2 className="text-2xl font-black text-white tracking-tight">Exporting Your Masterpiece</h2>
                <p className="text-sm text-gray-500 leading-relaxed font-medium">We're applying final touches, optimizing bitrate, and ensuring cinematic quality for your video.</p>
              </div>

              <div className="w-full max-w-md space-y-3">
                <div className="flex justify-between text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                  <span>Encoding Frames</span>
                  <span>{Math.round(progress * 24)} / 2400</span>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-8 border-b border-[#222] flex items-center justify-between bg-gradient-to-br from-purple-900/20 via-transparent to-transparent">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-600/20 rounded-2xl shadow-lg shadow-purple-500/20">
                    <Download className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight">Export Video</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Production Grade Output</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2.5 hover:bg-[#222] rounded-full text-gray-500 hover:text-white transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 grid grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                      <Monitor className="w-3.5 h-3.5 text-purple-500" /> Export Preset
                    </label>
                    <div className="flex gap-2">
                      {[
                        { id: 'youtube', label: 'YouTube', icon: <Monitor className="w-4 h-4" /> },
                        { id: 'shorts', label: 'Shorts/Reels', icon: <Smartphone className="w-4 h-4" /> },
                        { id: 'custom', label: 'Custom', icon: <Square className="w-4 h-4" /> }
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPreset(p.id as any)}
                          className={cn(
                            "flex-1 p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                            preset === p.id 
                              ? "bg-purple-600/10 border-purple-500 text-purple-400" 
                              : "bg-[#0a0a0a] border-[#222] text-gray-600 hover:text-gray-400"
                          )}
                        >
                          {p.icon}
                          <span className="text-[9px] font-bold uppercase tracking-widest">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-purple-500" /> Resolution
                    </label>
                    <div className="space-y-2">
                      {[
                        { id: '720p', label: 'HD Ready', sub: '1280x720 • Social Media' },
                        { id: '1080p', label: 'Full HD', sub: '1920x1080 • YouTube/Vimeo' },
                        { id: '4k', label: 'Ultra HD', sub: '3840x2160 • Professional' }
                      ].map((q) => (
                        <button
                          key={q.id}
                          onClick={() => setQuality(q.id as any)}
                          className={cn(
                            "w-full p-4 rounded-2xl border transition-all flex items-center justify-between group",
                            quality === q.id 
                              ? "bg-purple-600/10 border-purple-500 text-white" 
                              : "bg-[#0a0a0a] border-[#222] text-gray-500 hover:border-[#333] hover:text-gray-300"
                          )}
                        >
                          <div className="text-left">
                            <p className="text-xs font-bold uppercase tracking-widest">{q.label}</p>
                            <p className="text-[9px] opacity-60 mt-0.5">{q.sub}</p>
                          </div>
                          {quality === q.id && <CheckCircle2 className="w-4 h-4 text-purple-500" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-blue-500" /> Format
                    </label>
                    <div className="flex gap-2">
                      {['mp4', 'mov'].map((f) => (
                        <button
                          key={f}
                          onClick={() => setFormat(f as any)}
                          className={cn(
                            "flex-1 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                            format === f 
                              ? "bg-blue-600/10 border-blue-500 text-blue-400" 
                              : "bg-[#0a0a0a] border-[#222] text-gray-600 hover:text-gray-400"
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="p-6 bg-[#0a0a0a] border border-[#222] rounded-3xl space-y-6">
                    <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Export Summary</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-gray-500">Estimated Size</span>
                        <span className="text-[11px] font-bold text-white">~42.5 MB</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-gray-500">Bitrate</span>
                        <span className="text-[11px] font-bold text-white">12 Mbps (VBR)</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-gray-500">Codec</span>
                        <span className="text-[11px] font-bold text-white">H.264 / AAC</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-[#222] flex items-start gap-3">
                      <Info className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                      <p className="text-[9px] text-gray-600 leading-relaxed uppercase font-bold tracking-widest">Optimized for high-speed playback and minimal buffering on social platforms.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-purple-400">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">AI Upscaling Enabled</span>
                    </div>
                    {exportResult ? (
                      <a 
                        href={exportResult} 
                        download 
                        className="w-full py-5 bg-green-600 hover:bg-green-500 text-white font-black text-sm uppercase tracking-[0.2em] rounded-3xl transition-all shadow-[0_10px_30px_rgba(34,197,94,0.3)] flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Download Video
                      </a>
                    ) : (
                      <button 
                        onClick={handleExport}
                        className="w-full py-5 bg-purple-600 hover:bg-purple-500 text-white font-black text-sm uppercase tracking-[0.2em] rounded-3xl transition-all shadow-[0_10px_30px_rgba(147,51,234,0.3)] hover:-translate-y-1 active:translate-y-0"
                      >
                        Start Export
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

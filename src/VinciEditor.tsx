import { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward,
  Download, Settings, Layers, Monitor,
  Video, Loader2, Undo2, Redo2, HelpCircle, Keyboard
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from './lib/utils';

// --- Components ---
import { AIChatPanel } from './components/AIChatPanel';
import { MediaLibrary } from './components/MediaLibrary';
import { Timeline } from './components/Timeline';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ProjectSettings } from './components/ProjectSettings';
import { ExportModal } from './components/ExportModal';

// --- Hooks ---
import { useUndoRedo } from './hooks/useUndoRedo';
import { useAutoSave } from './hooks/useAutoSave';

// --- Types ---
type ProjectAspectRatio = '16:9' | '9:16';

type ClipEffect =
  | { type: 'scale'; value: number }
  | { type: 'opacity'; value: number }
  | { type: 'filter'; name: string };

interface MediaAsset {
  id: string;
  url: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  duration?: number;
  thumbnail?: string;
  metadata?: {
    resolution?: string;
    fps?: string;
    codec?: string;
    duration?: number;
    audioCodec?: string;
    bitrate?: string | number;
  };
}

interface TimelineClip {
  id: string;
  assetId: string;
  startTime: number;
  duration: number;
  offset: number;
  track: number;
  type: 'video' | 'audio' | 'text';
  effects?: ClipEffect[];
}

interface Project {
  id: string;
  name: string;
  aspectRatio: ProjectAspectRatio;
  clips: TimelineClip[];
  assets: MediaAsset[];
}

const normalizeAspectRatio = (value: unknown): ProjectAspectRatio => value === '9:16' ? '9:16' : '16:9';

export default function VinciEditor() {
  // --- State ---
  const { state: project, set: setProject, undo, redo, canUndo, canRedo } = useUndoRedo<Project>({
    id: '1',
    name: 'Untitled Project',
    aspectRatio: '16:9',
    clips: [],
    assets: []
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(["Project created"]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- Auto Save ---
  const { load } = useAutoSave('vinci_project', project, () => {
    // toast.success('Project auto-saved');
  });

  useEffect(() => {
    const saved = load();
    if (saved) {
      setProject({
        ...saved,
        aspectRatio: normalizeAspectRatio(saved.aspectRatio)
      });
      toast.info('Loaded previous project');
    }
  }, []);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        if (e.shiftKey) redo();
        else undo();
      } else if (e.code === 'KeyS' && selectedClipId) {
        handleSplitClip(selectedClipId, currentTime);
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedClipId) handleDeleteClip(selectedClipId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, selectedClipId, currentTime, undo, redo]);

  // --- Handlers ---
  const addHistory = (action: string) => {
    setHistory(prev => [action, ...prev].slice(0, 15));
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/job/${jobId}`);
        const job = await res.json();
        
        setProcessingProgress(job.progress);

        if (job.status === 'completed') {
          clearInterval(interval);
        setIsProcessing(false);
        setProcessingProgress(0);
        toast.success('AI processing complete!');
        addHistory("AI Edit Applied");
          
          const processedAsset: MediaAsset = {
            id: job.result.id,
            url: job.result.url,
            name: `Vinci_${project.assets[0]?.name || 'video'}`,
            type: 'video'
          };
          
          setProject((currentProject) => ({
            ...currentProject,
            assets: [processedAsset, ...currentProject.assets]
          }));
        } else if (job.status === 'failed') {
          clearInterval(interval);
          setIsProcessing(false);
          setProcessingProgress(0);
          toast.error(`Processing failed: ${job.error}`);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1000);
  };

  const addAssetToTimeline = (asset: MediaAsset) => {
    const newClip: TimelineClip = {
      id: `clip-${Math.random().toString(36).substr(2, 9)}`,
      assetId: asset.id,
      startTime: project.clips.length > 0 ? Math.max(...project.clips.map(c => c.startTime + c.duration)) : 0,
      duration: asset.duration || 10,
      offset: 0,
      track: 0,
      type: asset.type === 'video' ? 'video' : asset.type === 'audio' ? 'audio' : 'text'
    };

    setProject((currentProject) => ({
      ...currentProject,
      clips: [...currentProject.clips, newClip]
    }));
    addHistory(`Added ${asset.name} to timeline`);
    toast.success(`Added ${asset.name} to timeline`);
  };

  const handleUpload = async (files: File[]) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('video', files[0]);

    const toastId = toast.loading(`Uploading ${files[0].name}...`);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) throw new Error('Upload failed');

      const uploadedAsset = await res.json();
      const asset: MediaAsset = {
        ...uploadedAsset,
        duration: Number(uploadedAsset.metadata?.duration ?? uploadedAsset.duration ?? 10),
        metadata: uploadedAsset.metadata
      };
      
      const newAssets = [asset, ...project.assets];
      let newClips = [...project.clips];

      if (project.assets.length === 0 && project.clips.length === 0) {
        newClips.push({
          id: `clip-${Math.random().toString(36).substr(2, 9)}`,
          assetId: asset.id,
          startTime: 0,
          duration: asset.duration || 10,
          offset: 0,
          track: 0,
          type: 'video'
        });
      }

      setProject((currentProject) => ({
        ...currentProject,
        assets: newAssets,
        clips: newClips
      }));
      
      toast.success('Upload complete', { id: toastId });
      addHistory(`Uploaded ${asset.name}`);
    } catch (err) {
      toast.error('Upload failed', { id: toastId });
      console.error('Upload failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAICommand = async (prompt: string) => {
    if (project.assets.length === 0) {
      toast.error('Please upload a video first');
      return;
    }
    
    setIsProcessing(true);
    addHistory(`AI: ${prompt}`);
    const toastId = toast.loading('AI is thinking...');

    try {
      const parseRes = await fetch('/api/ai/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, videoMetadata: {} })
      });
      const { commands, interpretation } = await parseRes.json();
      
      toast.info(interpretation, { id: toastId });
      
      const processRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputId: project.assets[0].id, commands })
      });
      const { jobId } = await processRes.json();
      
      pollJobStatus(jobId);
    } catch (err) {
      toast.error('AI Command failed', { id: toastId });
      setIsProcessing(false);
    }
  };

  const handleSplitClip = (id: string, time: number) => {
    const clip = project.clips.find(c => c.id === id);
    if (!clip) return;

    const splitPoint = time - clip.startTime;
    if (splitPoint <= 0 || splitPoint >= clip.duration) return;

    const newClip1 = { ...clip, duration: splitPoint };
    const newClip2 = { 
      ...clip, 
      id: `clip-${Math.random().toString(36).substr(2, 9)}`,
      startTime: time,
      duration: clip.duration - splitPoint,
      offset: clip.offset + splitPoint
    };

    setProject((currentProject) => ({
      ...currentProject,
      clips: [...currentProject.clips.filter(c => c.id !== id), newClip1, newClip2]
    }));
    addHistory("Split clip");
    toast.success("Clip split successfully");
  };

  const handleDeleteClip = (id: string) => {
    setProject((currentProject) => ({
      ...currentProject,
      clips: currentProject.clips.filter(c => c.id !== id)
    }));
    if (selectedClipId === id) setSelectedClipId(null);
    addHistory("Deleted clip");
    toast.success("Clip removed");
  };

  const handleDeleteAsset = (id: string) => {
    setProject((currentProject) => ({
      ...currentProject,
      assets: currentProject.assets.filter(a => a.id !== id),
      clips: currentProject.clips.filter(c => c.assetId !== id)
    }));
    addHistory("Deleted asset");
    toast.success("Asset removed");
  };

  const handleUpdateClip = (id: string, updates: Partial<TimelineClip>) => {
    setProject((currentProject) => ({
      ...currentProject,
      clips: currentProject.clips.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const handleMoveClip = (id: string, newStartTime: number, newTrack: number) => {
    const startTime = Math.max(0, Math.round(newStartTime * 20) / 20);

    setProject((currentProject) => ({
      ...currentProject,
      clips: currentProject.clips.map((clip) =>
        clip.id === id
          ? { ...clip, startTime, track: newTrack }
          : clip
      )
    }));
  };

  const handleMoveClipDrop = (id: string, newStartTime: number) => {
    const startTime = Math.max(0, Math.round(newStartTime * 20) / 20);
    setCurrentTime(startTime);
    setSelectedClipId(id);
    addHistory(`Moved ${id} on timeline`);
  };

  const handleAssetCreated = (asset: MediaAsset) => {
    setProject((currentProject) => ({
      ...currentProject,
      assets: [asset, ...currentProject.assets]
    }));
    toast.success(`AI generated: ${asset.name}`);
  };

  const selectedClip = project.clips.find(c => c.id === selectedClipId) || null;
  const sortedClips = [...project.clips].sort((a, b) => a.startTime - b.startTime || a.track - b.track);
  const activeTimelineClip =
    sortedClips.find((clip) => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) ||
    selectedClip ||
    sortedClips[0] ||
    null;
  const previewAsset =
    (activeTimelineClip && project.assets.find((asset) => asset.id === activeTimelineClip.assetId)) ||
    project.assets[0] ||
    null;
  const previewTime = activeTimelineClip
    ? Math.max(0, activeTimelineClip.offset + Math.max(0, currentTime - activeTimelineClip.startTime))
    : currentTime;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewAsset) return;

    if (video.readyState >= 1 && Math.abs(video.currentTime - previewTime) > 0.15) {
      try {
        video.currentTime = previewTime;
      } catch (error) {
        console.error('Preview seek failed:', error);
      }
    }
  }, [previewAsset?.id, previewTime]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-300 font-sans overflow-hidden">
      {/* Top Navigation */}
      <header className="h-14 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between px-4 z-40 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 text-purple-500 group cursor-pointer">
            <div className="p-1.5 bg-purple-600/20 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-all">
              <Video className="w-5 h-5" />
            </div>
            <h1 className="font-black text-xl tracking-tighter text-white">VINCI</h1>
          </div>
          <div className="h-6 w-[1px] bg-[#333]" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{project.name}</span>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-1.5 hover:bg-[#333] rounded-lg text-gray-500 hover:text-white transition-all"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Hybrid Mode</span>
            </div>
            <div className="flex items-center gap-1 bg-[#0f0f0f] p-1 rounded-xl border border-[#222]">
              <button 
                onClick={undo}
                disabled={!canUndo}
                className="p-1.5 hover:bg-[#333] rounded-lg text-gray-500 hover:text-white disabled:opacity-20 transition-all"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button 
                onClick={redo}
                disabled={!canRedo}
                className="p-1.5 hover:bg-[#333] rounded-lg text-gray-500 hover:text-white disabled:opacity-20 transition-all"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Auto-saved</span>
          </div>
          <button 
            onClick={() => setIsExportOpen(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-widest px-6 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20 hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        <MediaLibrary 
          assets={project.assets} 
          onUpload={handleUpload} 
          onAddToTimeline={addAssetToTimeline} 
          onDeleteAsset={handleDeleteAsset}
          onAssetCreated={handleAssetCreated}
        />
        
        <div className="flex-1 flex flex-col bg-[#0f0f0f] relative">
          {/* Preview Area */}
          <div className="flex-1 flex items-center justify-center p-12 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f]">
            <div 
                className={cn(
                  "bg-black shadow-[0_0_100px_rgba(0,0,0,0.5)] relative group overflow-hidden rounded-2xl border border-[#222]",
                  project.aspectRatio === '16:9' ? "aspect-video w-full max-w-5xl" : "aspect-[9/16] h-full"
                )}
              >
              {previewAsset?.url ? (
                <video 
                  key={previewAsset.id}
                  ref={videoRef}
                  src={previewAsset.url} 
                  className="w-full h-full object-contain"
                  onLoadedMetadata={(e) => {
                    try {
                      e.currentTarget.currentTime = previewTime;
                    } catch (error) {
                      console.error('Initial preview seek failed:', error);
                    }
                  }}
                  onTimeUpdate={(e) => {
                    if (!activeTimelineClip) {
                      setCurrentTime(e.currentTarget.currentTime);
                      return;
                    }

                    const clipTime = activeTimelineClip.startTime + Math.max(0, e.currentTarget.currentTime - activeTimelineClip.offset);
                    setCurrentTime(Math.min(activeTimelineClip.startTime + activeTimelineClip.duration, clipTime));
                  }}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 space-y-6">
                  <div className="p-6 bg-[#111] rounded-3xl border border-[#222] shadow-inner">
                    <Video className="w-16 h-16 opacity-20" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold uppercase tracking-[0.2em]">No Media in Preview</p>
                    <p className="text-[10px] text-gray-600 mt-2">Upload a video to start your cinematic journey</p>
                  </div>
                </div>
              )}

              {/* Preview Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                <div className="flex items-center justify-center gap-10">
                  <button className="text-gray-400 hover:text-white transition-colors"><SkipBack className="w-6 h-6" /></button>
                  <button 
                    onClick={togglePlay}
                    className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl"
                  >
                    {isPlaying ? <Pause className="fill-current w-6 h-6" /> : <Play className="fill-current w-6 h-6 ml-1" />}
                  </button>
                  <button className="text-gray-400 hover:text-white transition-colors"><SkipForward className="w-6 h-6" /></button>
                </div>
              </div>

              {isProcessing && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center z-50">
                  <div className="relative w-32 h-32 mb-8">
                    <Loader2 className="w-full h-full text-purple-500 animate-spin opacity-10" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-black text-white tracking-tighter">{Math.round(processingProgress)}%</span>
                    </div>
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle
                        cx="64" cy="64" r="58"
                        fill="none" stroke="currentColor" strokeWidth="6"
                        className="text-purple-500 transition-all duration-500"
                        strokeDasharray={364.4}
                        strokeDashoffset={364.4 - (364.4 * processingProgress) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-purple-400 font-black tracking-[0.3em] uppercase text-[10px] animate-pulse">AI Neural Processing</p>
                    <p className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">Applying cinematic intelligence...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Timeline 
            clips={project.clips} 
            currentTime={currentTime} 
            duration={Math.max(60, ...project.clips.map(c => c.startTime + c.duration), 0)} 
            onTimeChange={setCurrentTime}
            onClipSelect={setSelectedClipId}
            selectedClipId={selectedClipId}
            onSplitClip={handleSplitClip}
            onDeleteClip={handleDeleteClip}
            onMoveClip={handleMoveClip}
            onMoveClipDrop={handleMoveClipDrop}
          />
        </div>

        <AIChatPanel onCommand={handleAICommand} isProcessing={isProcessing} />

        <PropertiesPanel 
          selectedClip={selectedClip} 
          history={history}
          onUpdateClip={handleUpdateClip}
        />
      </div>

      {/* Status Bar */}
      <footer className="h-10 bg-[#1a1a1a] border-t border-[#333] flex items-center justify-between px-6 text-[9px] font-bold uppercase tracking-[0.15em] text-gray-600 z-40">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            <span className="text-gray-400">System Engine: Stable</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Monitor className="w-3 h-3" />
              <span>CPU: 8%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3 h-3" />
              <span>MEM: 0.8GB</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button className="hover:text-purple-400 flex items-center gap-1.5 transition-colors"><Keyboard className="w-3.5 h-3.5" /> Shortcuts</button>
          <button className="hover:text-purple-400 flex items-center gap-1.5 transition-colors"><HelpCircle className="w-3.5 h-3.5" /> Help Center</button>
          <div className="px-2 py-0.5 bg-[#222] rounded border border-[#333] text-gray-500">v1.2.0-PRO</div>
        </div>
      </footer>

      {/* Modals */}
      <ProjectSettings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        project={project}
        onUpdate={(updates) => setProject((currentProject) => ({
          ...currentProject,
          ...updates,
          aspectRatio: normalizeAspectRatio(updates.aspectRatio ?? currentProject.aspectRatio)
        }))}
      />
      <ExportModal 
        isOpen={isExportOpen} 
        onClose={() => setIsExportOpen(false)}
        project={project}
        onExport={(settings) => {
          toast.success(`Exporting ${settings.quality} ${settings.format} video...`);
        }}
      />
    </div>
  );
}

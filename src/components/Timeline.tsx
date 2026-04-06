import { useState, useRef, type MouseEvent } from 'react';
import { 
  Scissors, Trash2, Layers, Music,
  Video, ZoomIn, ZoomOut, Maximize2, Clock,
  Lock, Eye
} from 'lucide-react';
import { motion } from 'motion/react';
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

export const Timeline = ({ 
  clips, 
  currentTime, 
  duration, 
  onTimeChange, 
  onClipSelect, 
  selectedClipId,
  onSplitClip,
  onDeleteClip,
  onMoveClip,
  onMoveClipDrop
}: { 
  clips: TimelineClip[], 
  currentTime: number, 
  duration: number,
  onTimeChange: (time: number) => void,
  onClipSelect: (id: string) => void,
  selectedClipId: string | null,
  onSplitClip?: (id: string, time: number) => void,
  onDeleteClip?: (id: string) => void,
  onMoveClip?: (id: string, newStartTime: number, newTrack: number) => void,
  onMoveClipDrop?: (id: string, newStartTime: number, newTrack: number) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(60); // pixels per second
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isDraggingClip, setIsDraggingClip] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handleTimelineClick = (e: MouseEvent) => {
    if (!containerRef.current || isDraggingPlayhead || isDraggingClip) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    onTimeChange(Math.max(0, x / zoom));
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;

    if (isDraggingPlayhead) {
      onTimeChange(Math.max(0, x / zoom));
    } else if (isDraggingClip) {
      const newStartTime = Math.max(0, (x - dragOffset) / zoom);
      // Determine track based on Y position
      const y = e.clientY - rect.top;
      const newTrack = Math.max(0, Math.min(2, Math.floor((y - 48) / 64))); // 48 is ruler height, 64 is track height
      onMoveClip?.(isDraggingClip, newStartTime, newTrack);
    }
  };

  const handleClipMouseDown = (e: MouseEvent, clip: TimelineClip) => {
    e.stopPropagation();
    onClipSelect(clip.id);
    setIsDraggingClip(clip.id);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left + (containerRef.current?.scrollLeft || 0);
      setDragOffset(x - (clip.startTime * zoom));
    }
  };

  const finishClipDrag = () => {
    if (!isDraggingClip) return;

    const droppedClip = clips.find((clip) => clip.id === isDraggingClip);
    if (droppedClip) {
      onMoveClipDrop?.(droppedClip.id, droppedClip.startTime, droppedClip.track);
      onTimeChange(droppedClip.startTime);
    }

    setIsDraggingClip(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-80 bg-[#0a0a0a] border-t border-[#222] flex flex-col shadow-2xl overflow-hidden select-none">
      {/* Timeline Toolbar */}
      <div className="h-12 border-b border-[#222] flex items-center px-4 justify-between bg-[#111] z-30">
        <div className="flex items-center gap-4">
          <div className="flex bg-[#1a1a1a] rounded-xl p-1 border border-[#333] shadow-inner">
            <button 
              onClick={() => selectedClipId && onSplitClip?.(selectedClipId, currentTime)}
              disabled={!selectedClipId}
              className="p-2 hover:bg-[#333] rounded-lg text-gray-400 hover:text-purple-500 disabled:opacity-30 disabled:hover:text-gray-400 transition-all" 
              title="Split Clip (S)"
            >
              <Scissors className="w-4 h-4" />
            </button>
            <button 
              onClick={() => selectedClipId && onDeleteClip?.(selectedClipId)}
              disabled={!selectedClipId}
              className="p-2 hover:bg-red-600/20 rounded-lg text-gray-400 hover:text-red-500 disabled:opacity-30 transition-all" 
              title="Delete Clip (Del)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          
          <div className="h-6 w-[1px] bg-[#333]" />
          
          <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-xl p-1 border border-[#333]">
            <button className="p-2 hover:bg-[#333] rounded-lg text-gray-400 hover:text-blue-400"><Layers className="w-4 h-4" /></button>
            <button className="p-2 hover:bg-[#333] rounded-lg text-gray-400 hover:text-green-400"><Music className="w-4 h-4" /></button>
            <button className="p-2 hover:bg-[#333] rounded-lg text-gray-400 hover:text-orange-400"><Maximize2 className="w-4 h-4" /></button>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-[#0a0a0a] px-4 py-1.5 rounded-full border border-[#222] shadow-inner">
            <Clock className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs font-mono text-white tracking-widest w-24 text-center">
              {formatTime(currentTime)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 bg-[#1a1a1a] p-1 rounded-xl border border-[#333]">
            <button onClick={() => setZoom(z => Math.max(20, z - 10))} className="p-1.5 hover:bg-[#333] rounded-lg text-gray-500 hover:text-white transition-colors"><ZoomOut className="w-4 h-4" /></button>
            <div className="w-24 h-1 bg-[#333] rounded-full relative">
              <div className="absolute top-0 left-0 h-full bg-purple-500 rounded-full" style={{ width: `${((zoom - 20) / 180) * 100}%` }} />
            </div>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-1.5 hover:bg-[#333] rounded-lg text-gray-500 hover:text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Tracks Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers */}
        <div className="w-14 border-r border-[#222] bg-[#0d0d0d] flex flex-col pt-12 space-y-2 z-20">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 flex flex-col items-center justify-center gap-2 border-b border-[#1a1a1a] group">
              <div className="flex flex-col gap-1">
                <button className="p-1 hover:text-purple-500 text-gray-700 transition-colors"><Eye className="w-3 h-3" /></button>
                <button className="p-1 hover:text-purple-500 text-gray-700 transition-colors"><Lock className="w-3 h-3" /></button>
              </div>
              <span className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter">V{i+1}</span>
            </div>
          ))}
        </div>

        {/* Timeline Content */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative scrollbar-hide bg-[#0d0d0d]"
          onClick={handleTimelineClick}
          onMouseMove={handleMouseMove}
          onMouseUp={() => { setIsDraggingPlayhead(false); finishClipDrag(); }}
          onMouseLeave={() => { setIsDraggingPlayhead(false); finishClipDrag(); }}
        >
          <div className="absolute top-0 left-0 h-full" style={{ width: Math.max(duration * zoom + 400, 2000) }}>
            {/* Time Rulers */}
            <div className="h-12 border-b border-[#1a1a1a] flex items-end bg-[#0d0d0d] sticky top-0 z-20">
              {Array.from({ length: Math.ceil(duration) + 10 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 border-l border-[#222] h-4 relative" style={{ width: zoom }}>
                  <span className="absolute -top-7 left-1 text-[10px] font-bold text-gray-600 tracking-tighter">{i}s</span>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="absolute bottom-0 h-1.5 border-l border-[#1a1a1a]" style={{ left: (zoom / 5) * (j + 1) }} />
                  ))}
                  {i % 5 === 0 && <div className="absolute top-0 left-0 w-full h-full bg-purple-500/5 pointer-events-none" />}
                </div>
              ))}
            </div>

            {/* Tracks Container */}
            <div className="relative h-full pt-2 space-y-2 px-0">
              {[0, 1, 2].map(trackIndex => (
                <div key={trackIndex} className="h-16 bg-[#141414]/30 border-b border-[#1a1a1a] relative group">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-purple-500/5 transition-opacity pointer-events-none" />
                  
                  {clips.filter(c => c.track === trackIndex).map(clip => (
                    <motion.div
                      layoutId={clip.id}
                      key={clip.id}
                      onMouseDown={(e) => handleClipMouseDown(e, clip)}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-xl border flex flex-col justify-center px-3 overflow-hidden cursor-pointer transition-all shadow-xl group/clip",
                        selectedClipId === clip.id ? "ring-2 ring-purple-500 border-purple-400 z-10" : "border-white/5 hover:border-white/20",
                        clip.type === 'video' ? "bg-gradient-to-br from-blue-600/40 to-blue-900/40" : 
                        clip.type === 'audio' ? "bg-gradient-to-br from-green-600/40 to-green-900/40" : 
                        "bg-gradient-to-br from-orange-600/40 to-orange-900/40"
                      )}
                      style={{ 
                        left: clip.startTime * zoom, 
                        width: clip.duration * zoom 
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {clip.type === 'video' ? <Video className="w-3.5 h-3.5 text-blue-400" /> : <Music className="w-3.5 h-3.5 text-green-400" />}
                          <span className="text-[10px] font-bold text-white truncate uppercase tracking-tighter">{clip.id}</span>
                        </div>
                        <div className="opacity-0 group-hover/clip:opacity-100 transition-opacity flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        </div>
                      </div>
                      
                      {/* Waveform/Thumbnail Placeholder */}
                      <div className="mt-1.5 h-2 w-full bg-black/30 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 flex items-center justify-around opacity-20">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="w-0.5 bg-white rounded-full" style={{ height: `${20 + Math.random() * 80}%` }} />
                          ))}
                        </div>
                        <div className="h-full bg-purple-500/20" style={{ width: '100%' }} />
                      </div>

                      {/* Resize Handles */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 hover:bg-white/30 cursor-ew-resize transition-colors" />
                      <div className="absolute right-0 top-0 bottom-0 w-1.5 hover:bg-white/30 cursor-ew-resize transition-colors" />
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>

            {/* Playhead */}
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-40 cursor-ew-resize group/playhead"
              style={{ left: currentTime * zoom }}
              onMouseDown={(e) => { e.stopPropagation(); setIsDraggingPlayhead(true); }}
            >
              <div className="absolute -top-0 -left-[8px] w-4 h-6 bg-red-500 rounded-b-md shadow-2xl flex items-center justify-center">
                <div className="w-[1px] h-3 bg-white/40" />
              </div>
              <div className="absolute top-0 bottom-0 left-0 w-20 bg-gradient-to-r from-red-500/10 to-transparent pointer-events-none" />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover/playhead:opacity-100 transition-opacity whitespace-nowrap">
                {formatTime(currentTime)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

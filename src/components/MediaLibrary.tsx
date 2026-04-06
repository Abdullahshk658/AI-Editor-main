import { useState } from 'react';
import { 
  Plus, Upload, Image as ImageIcon, Music,
  Search, Trash2, Grid, List as ListIcon,
  Sparkles, Layout, X, Loader2
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { AutomationTools } from '../AutomationTools';
import { cn } from '../lib/utils';

interface MediaAsset {
  id: string;
  url: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  duration?: number;
  thumbnail?: string;
  metadata?: {
    resolution: string;
    fps: string;
    codec: string;
    duration: number;
  };
}

export const MediaLibrary = ({ 
  assets, 
  onUpload, 
  onAddToTimeline,
  onDeleteAsset,
  onAssetCreated
}: { 
  assets: MediaAsset[], 
  onUpload: (files: File[]) => void, 
  onAddToTimeline: (asset: MediaAsset) => void,
  onDeleteAsset?: (id: string) => void,
  onAssetCreated?: (asset: any) => void
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'ai'>('media');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const fetchAnalysis = async (id: string) => {
    try {
      const res = await fetch(`/api/analysis/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      } else {
        setAnalysis(null);
      }
    } catch (err) {
      setAnalysis(null);
    }
  };
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => onUpload(acceptedFiles as File[]),
    accept: { 'video/*': [], 'audio/*': [], 'image/*': [] },
    multiple: true,
    onDragEnter: undefined,
    onDragOver: undefined,
    onDragLeave: undefined
  });

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] border-r border-[#333] w-72 shadow-2xl">
      <div className="flex border-b border-[#333] bg-[#141414]">
        <button 
          onClick={() => setActiveTab('media')}
          className={cn(
            "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2", 
            activeTab === 'media' ? "text-purple-500 border-b-2 border-purple-500 bg-purple-500/5" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <Layout className="w-3 h-3" />
          Media
        </button>
        <button 
          onClick={() => setActiveTab('ai')}
          className={cn(
            "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2", 
            activeTab === 'ai' ? "text-purple-500 border-b-2 border-purple-500 bg-purple-500/5" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <Sparkles className="w-3 h-3" />
          AI Tools
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {activeTab === 'media' ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white text-xs uppercase tracking-widest text-gray-400">Project Assets</h2>
              <div className="flex gap-1">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={cn("p-1.5 rounded transition-colors", viewMode === 'grid' ? "bg-[#333] text-purple-500" : "text-gray-600 hover:text-gray-400")}
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={cn("p-1.5 rounded transition-colors", viewMode === 'list' ? "bg-[#333] text-purple-500" : "text-gray-600 hover:text-gray-400")}
                >
                  <ListIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 group-focus-within:text-purple-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-[#333] rounded-lg py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
              />
            </div>

            <div {...getRootProps()} className={cn(
              "border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-gray-500 p-6 text-center cursor-pointer transition-all group",
              isDragActive ? "border-purple-500 bg-purple-500/10" : "border-[#333] hover:border-[#444] hover:bg-[#222]"
            )}>
              <div className="w-10 h-10 rounded-full bg-[#222] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5 text-gray-400 group-hover:text-purple-500" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Upload Media</p>
              <p className="text-[9px] text-gray-600">Video, Audio, or Images</p>
              <input {...getInputProps()} />
            </div>

            {filteredAssets.length > 0 && (
              <div className={cn(
                "gap-3",
                viewMode === 'grid' ? "grid grid-cols-2" : "flex flex-col"
              )}>
                {filteredAssets.map(asset => (
                  <div 
                    key={asset.id} 
                    onClick={() => {
                      setSelectedAssetId(asset.id);
                      fetchAnalysis(asset.id);
                    }}
                    className={cn(
                      "group relative bg-[#2a2a2a] rounded-xl overflow-hidden cursor-pointer border transition-all shadow-lg",
                      selectedAssetId === asset.id ? "border-purple-500" : "border-[#333] hover:border-purple-500/50",
                      viewMode === 'list' ? "flex items-center h-16" : "aspect-video"
                    )}
                  >
                    {asset.type === 'video' ? (
                      <video src={asset.url} className={cn("object-cover", viewMode === 'list' ? "w-24 h-full" : "w-full h-full")} />
                    ) : (
                      <div className={cn("flex items-center justify-center bg-[#1a1a1a]", viewMode === 'list' ? "w-24 h-full" : "w-full h-full")}>
                        {asset.type === 'image' ? <ImageIcon className="w-6 h-6 text-gray-600" /> : <Music className="w-6 h-6 text-gray-600" />}
                      </div>
                    )}
                    
                    <div className={cn(
                      "flex-1 p-2 min-w-0",
                      viewMode === 'grid' ? "absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-all" : ""
                    )}>
                      {viewMode === 'list' && (
                        <div className="flex flex-col justify-center h-full px-2">
                          <p className="text-[10px] font-bold text-white truncate">{asset.name}</p>
                          <p className="text-[9px] text-gray-500 uppercase tracking-widest">{asset.type}</p>
                        </div>
                      )}
                      
                      <div className={cn(
                        "flex gap-1",
                        viewMode === 'grid' ? "flex-col w-full px-3" : "ml-auto pr-2"
                      )}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onAddToTimeline(asset); }}
                          className="bg-purple-600 hover:bg-purple-500 text-white text-[9px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors shadow-lg"
                        >
                          <Plus className="w-3 h-3" /> Add to Timeline
                        </button>
                        {onDeleteAsset && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteAsset(asset.id); }}
                            className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white text-[9px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        )}
                      </div>
                      
                      {viewMode === 'grid' && (
                        <span className="text-[9px] text-gray-400 truncate px-2 absolute bottom-2 left-0 right-0 text-center">{asset.name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedAssetId && (
              <div className="mt-6 p-4 bg-[#0f0f0f] rounded-2xl border border-[#222] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Asset Details</h3>
                  <button onClick={() => setSelectedAssetId(null)}><X className="w-3 h-3" /></button>
                </div>
                
                {assets.find(a => a.id === selectedAssetId)?.metadata && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-[#1a1a1a] rounded-lg">
                      <p className="text-[8px] text-gray-600 uppercase font-bold">Resolution</p>
                      <p className="text-[10px] text-white font-bold">{assets.find(a => a.id === selectedAssetId)?.metadata?.resolution}</p>
                    </div>
                    <div className="p-2 bg-[#1a1a1a] rounded-lg">
                      <p className="text-[8px] text-gray-600 uppercase font-bold">FPS</p>
                      <p className="text-[10px] text-white font-bold">{assets.find(a => a.id === selectedAssetId)?.metadata?.fps}</p>
                    </div>
                  </div>
                )}

                {analysis ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">AI Summary</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed">{analysis.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.tags?.map((tag: string) => (
                        <span key={tag} className="px-2 py-0.5 bg-[#222] rounded text-[8px] text-gray-500 border border-[#333]">#{tag}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-600 p-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">Analyzing Content...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <AutomationTools assets={assets} onAssetCreated={onAssetCreated} />
        )}
      </div>
    </div>
  );
};

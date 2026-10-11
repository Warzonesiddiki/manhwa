import React from 'react';
import { Play, Sparkles, Layers, Download, Plus, Check, RefreshCw, AlertCircle, Save } from 'lucide-react';

interface HeaderProps {
  onOpenIngest: () => void;
  onOpenExport: () => void;
  activeView: 'auto_dub' | 'dubbing' | 'creator' | 'arcs' | 'subtitles' | 'batch';
  setActiveView: (view: 'auto_dub' | 'dubbing' | 'creator' | 'arcs' | 'subtitles' | 'batch') => void;
  completedArcsCount: number;
  totalArcsCount: number;
  saveStatus?: 'saved' | 'saving' | 'conflict' | 'error' | 'unsaved';
  revision?: number;
  onManualSave?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenIngest,
  onOpenExport,
  activeView,
  setActiveView,
  completedArcsCount,
  totalArcsCount,
  saveStatus = 'saved',
  revision = 1,
  onManualSave,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-950 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Play className="w-4 h-4 text-slate-950 fill-slate-950" />
          </div>
          <span className="font-display font-extrabold tracking-tight">
            Manhwa<span className="text-amber-400">Urdu</span> <span className="text-slate-400 font-normal text-sm">DubStudio</span>
          </span>
        </a>
        <span className="hidden sm:inline-block text-xs font-urdu text-amber-300/80 pr-2 border-r border-slate-800">
          مانہوا اردو ڈب
        </span>
      </div>

      {/* Zone 2: 4 single-line nav links with whitespace-nowrap */}
      <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-300">
        <button
          onClick={() => setActiveView('auto_dub')}
          className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1 ${
            activeView === 'auto_dub'
              ? 'text-amber-400 font-bold border-b-2 border-amber-400'
              : 'hover:text-white text-slate-400'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Dub Video (1-Click)
        </button>
        <button
          onClick={() => setActiveView('dubbing')}
          className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1 ${
            activeView === 'dubbing'
              ? 'text-amber-400 font-bold border-b-2 border-amber-400'
              : 'hover:text-white text-slate-400'
          }`}
        >
          Script Workbench
        </button>
        <button
          onClick={() => setActiveView('creator')}
          className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1 ${
            activeView === 'creator'
              ? 'text-amber-400 font-bold border-b-2 border-amber-400'
              : 'hover:text-white text-slate-400'
          }`}
        >
          <Play className="w-4 h-4" />
          Manhwa Video Creator
        </button>
        <button
          onClick={() => setActiveView('arcs')}
          className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1 ${
            activeView === 'arcs'
              ? 'text-amber-400 font-bold border-b-2 border-amber-400'
              : 'hover:text-white text-slate-400'
          }`}
        >
          <Layers className="w-4 h-4" />
          10h+ Marathon Arcs
        </button>
        <button
          onClick={() => setActiveView('subtitles')}
          className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1 ${
            activeView === 'subtitles'
              ? 'text-amber-400 font-bold border-b-2 border-amber-400'
              : 'hover:text-white text-slate-400'
          }`}
        >
          Subtitles & SRT
        </button>
        <button
          onClick={() => setActiveView('batch')}
          className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1 ${
            activeView === 'batch'
              ? 'text-amber-400 font-bold border-b-2 border-amber-400'
              : 'hover:text-white text-slate-400'
          }`}
        >
          Batch ({completedArcsCount}/{totalArcsCount})
        </button>
      </nav>

      {/* Zone 3: Action Buttons & Autosave Status */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Autosave Status Pill */}
        {saveStatus === 'saved' && (
          <span
            className="hidden lg:flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg"
            title={`Project changes saved on server (revision ${revision})`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Saved (rev-{revision})</span>
          </span>
        )}
        {saveStatus === 'saving' && (
          <span className="hidden lg:flex items-center gap-1.5 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Saving...</span>
          </span>
        )}
        {saveStatus === 'conflict' && (
          <button
            onClick={onManualSave}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300 bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-rose-500/30"
            title="Concurrent modification on server. Click to resolve."
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Conflict (Click to resolve)</span>
          </button>
        )}
        {saveStatus === 'error' && (
          <button
            onClick={onManualSave}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300 bg-rose-500/20 border border-rose-500/40 px-2.5 py-1 rounded-lg cursor-pointer hover:bg-rose-500/30"
            title="Autosave failed. Click to retry."
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Retry Save</span>
          </button>
        )}
        {onManualSave && saveStatus !== 'conflict' && (
          <button
            onClick={onManualSave}
            disabled={saveStatus === 'saving'}
            className="p-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors cursor-pointer"
            title="Save Project to Server (Durable Storage)"
          >
            <Save className="w-4 h-4 text-amber-400" />
          </button>
        )}

        <button
          onClick={onOpenIngest}
          className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          title="Import YouTube video or raw manhwa"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          <span>New Video / Manhwa</span>
        </button>

        <button
          onClick={onOpenExport}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md shadow-amber-500/10 transition-all hover:shadow-amber-500/25 whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Package</span>
        </button>
      </div>
    </header>
  );
};

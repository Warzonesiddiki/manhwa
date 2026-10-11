import React from 'react';
import { ExternalLink, Clock, BookOpen, User, Wand2, RefreshCw } from 'lucide-react';
import { MarathonProject } from '../types';

interface MarathonHeaderBarProps {
  project: MarathonProject;
  onChunkWithAI: () => void;
  isChunking: boolean;
  onSwitchProjectModal: () => void;
}

export const MarathonHeaderBar: React.FC<MarathonHeaderBarProps> = ({
  project,
  onChunkWithAI,
  isChunking,
  onSwitchProjectModal,
}) => {
  const hours = (project.totalDurationMinutes / 60).toFixed(1);

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
      {/* Left: Project Info */}
      <div className="flex flex-col gap-1 min-w-0 max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 whitespace-nowrap">
            10h+ Marathon Recap
          </span>
          <button
            onClick={onSwitchProjectModal}
            className="text-xs text-slate-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1"
          >
            <span>Change Project</span>
          </button>
        </div>

        <h1 className="text-lg font-bold text-white tracking-tight truncate flex items-center gap-2">
          {project.title}
        </h1>

        <p className="text-sm font-urdu text-amber-200/90 truncate dir-rtl text-right sm:text-left">
          {project.titleUrdu}
        </p>

        {/* Unboxed Metadata with typographic separators */}
        <div className="flex items-center flex-wrap gap-2 text-xs text-slate-400 font-mono-numbers mt-0.5">
          <span className="flex items-center gap-1 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{project.totalDurationMinutes} mins ({hours} hrs)</span>
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>{project.arcs.length} Episodic Arcs</span>
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Hero: {project.mainCharacter}</span>
          </span>
          {project.sourceVideoUrl && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <a
                href={project.sourceVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 underline underline-offset-2"
              >
                <span>Original YouTube Video</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onChunkWithAI}
          disabled={isChunking}
          className="px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm disabled:opacity-50"
          title="Re-analyze marathon chapters into 15-30m arcs"
        >
          {isChunking ? (
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          ) : (
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
          )}
          <span>{isChunking ? 'Chunking with Gemini...' : 'Re-Chunk 15-30m Arcs'}</span>
        </button>
      </div>
    </div>
  );
};

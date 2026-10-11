import React, { useState } from 'react';
import { Layers, Play, CheckCircle2, Clock, Sparkles, RefreshCw, Download, ArrowRight, Mic } from 'lucide-react';
import { MarathonProject, StoryArc } from '../types';
import { formatTimeDisplay, downloadFile, generateYouTubeChapters } from '../utils/audioSynthesizer';

interface BatchPipelineViewProps {
  project: MarathonProject;
  onSelectArc: (arcId: string) => void;
  onBatchProcessAll: () => void;
  isBatchProcessing: boolean;
  onOpenExport: () => void;
}

export const BatchPipelineView: React.FC<BatchPipelineViewProps> = ({
  project,
  onSelectArc,
  onBatchProcessAll,
  isBatchProcessing,
  onOpenExport,
}) => {
  const completedCount = project.arcs.filter((a) => a.status === 'dubbed').length;
  const scriptedCount = project.arcs.filter((a) => a.status === 'scripted' || a.status === 'dubbed').length;
  const totalArcs = project.arcs.length;
  const percentComplete = Math.round((completedCount / (totalArcs || 1)) * 100);

  const handleDownloadChapterMarkers = () => {
    const chaptersText = generateYouTubeChapters(project.arcs);
    downloadFile(chaptersText, `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_YouTube_Chapters.txt`);
  };

  return (
    <div className="space-y-6">
      {/* Top Marathon Summary Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                10-Hour Marathon Queue
              </span>
              <span className="text-xs text-slate-400 font-mono-numbers">
                {project.totalDurationMinutes} mins total duration
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {project.title}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadChapterMarkers}
              className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>YouTube Chapters TXT</span>
            </button>

            <button
              onClick={onBatchProcessAll}
              disabled={isBatchProcessing}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isBatchProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{isBatchProcessing ? 'Batch Processing Arcs...' : 'Auto-Script All Remaining Arcs'}</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono-numbers text-slate-400">
            <span>Production Progress: {completedCount} of {totalArcs} Arcs Dubbed</span>
            <span>{percentComplete}% Ready</span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              style={{ width: `${percentComplete}%` }}
              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Arcs Table / Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Episodic 15–30 Minute Story Arcs Schedule
          </h3>
          <span className="text-xs text-slate-400">
            Each arc is independently editable, dubbable, and exportable
          </span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {project.arcs.map((arc) => {
            const isDubbed = arc.status === 'dubbed';
            const isScripted = arc.status === 'scripted';

            return (
              <div
                key={arc.id}
                className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors"
              >
                {/* Arc Title and Info */}
                <div className="flex items-start gap-4 min-w-[280px] max-w-xl">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center shrink-0 font-mono-numbers">
                    <span className="text-[10px] text-slate-500 font-bold">ARC</span>
                    <span className="text-sm font-extrabold text-amber-400 leading-none">
                      {arc.arcNumber}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-100">
                        {arc.title}
                      </h4>
                      {isDubbed ? (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Dubbed
                        </span>
                      ) : isScripted ? (
                        <span className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Scripted
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-urdu text-amber-200/90 mt-0.5">
                      {arc.titleUrdu}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono-numbers">
                      <span>{arc.chaptersCovered}</span>
                      <span aria-hidden="true">·</span>
                      <span>{arc.durationMinutes} mins ({arc.startMinute}m – {arc.endMinute}m)</span>
                      <span aria-hidden="true">·</span>
                      <span>{arc.segments.length} lines</span>
                    </div>

                    {arc.cliffhangerHook && (
                      <div className="text-[11px] text-rose-300/80 mt-1.5 italic bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10 max-w-lg">
                        Climax: {arc.cliffhangerHook}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectArc(arc.id)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <span>Open in Dubber</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

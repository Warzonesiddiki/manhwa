import React from 'react';
import { ChevronRight, Play, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { StoryArc } from '../types';

interface ArcSelectorStripProps {
  arcs: StoryArc[];
  selectedArcId: string;
  onSelectArc: (arcId: string) => void;
  onAddArc?: () => void;
}

export const ArcSelectorStrip: React.FC<ArcSelectorStripProps> = ({
  arcs,
  selectedArcId,
  onSelectArc,
}) => {
  return (
    <div className="bg-slate-950/80 border-b border-slate-800/80 px-6 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Episodic Story Arcs (15–30 Mins Each)
          </span>
          <span className="text-xs text-slate-500 font-mono-numbers">
            {arcs.length} Arcs Chunked
          </span>
        </div>
        <span className="text-xs text-amber-400/90 font-mono-numbers hidden sm:inline">
          Marathon Timeline: 00:00 → {arcs[arcs.length - 1]?.endMinute || 0}m
        </span>
      </div>

      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
        {arcs.map((arc) => {
          const isSelected = arc.id === selectedArcId;
          const isDubbed = arc.status === 'dubbed';
          const isScripted = arc.status === 'scripted';

          return (
            <button
              key={arc.id}
              onClick={() => onSelectArc(arc.id)}
              className={`flex-shrink-0 text-left px-3.5 py-2.5 rounded-xl border transition-all duration-150 min-w-[220px] max-w-[260px] group ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500/80 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-800/80 border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-xs font-bold font-mono-numbers ${isSelected ? 'text-amber-400' : 'text-slate-300'}`}>
                  Arc {arc.arcNumber}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-mono-numbers">
                    {arc.durationMinutes}m
                  </span>
                  {isDubbed ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Dubbed
                    </span>
                  ) : isScripted ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                      <Sparkles className="w-2.5 h-2.5" />
                      Scripted
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                      Pending
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs font-semibold text-slate-100 truncate group-hover:text-amber-300 transition-colors">
                {arc.title.replace(/^Arc \d+:\s*/, '')}
              </div>

              <div className="text-[11px] font-urdu text-amber-200/80 truncate mt-0.5 dir-rtl">
                {arc.titleUrdu}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800/60 font-mono-numbers">
                <span>{arc.chaptersCovered}</span>
                <span>{arc.startMinute}m – {arc.endMinute}m</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

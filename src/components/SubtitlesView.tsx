import React, { useState } from 'react';
import { Download, Copy, Check, FileText, Globe } from 'lucide-react';
import { StoryArc, RecapSegment } from '../types';
import { generateSrtContent, downloadFile } from '../utils/audioSynthesizer';

interface SubtitlesViewProps {
  arc: StoryArc;
}

export const SubtitlesView: React.FC<SubtitlesViewProps> = ({ arc }) => {
  const [langMode, setLangMode] = useState<'dual' | 'urdu' | 'roman'>('dual');
  const [copied, setCopied] = useState(false);

  const srtContent = generateSrtContent(arc.segments, langMode);

  const handleCopy = () => {
    navigator.clipboard.writeText(srtContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = `${arc.title.replace(/[^a-zA-Z0-9]/g, '_')}_${langMode}.srt`;
    downloadFile(srtContent, filename, 'application/x-subrip');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              SRT & Subtitles Hub
            </span>
            <span className="text-xs text-slate-400 font-mono-numbers">
              {arc.segments.length} Timed Subtitle Cues
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {arc.title} Subtitle Exporter
          </h2>
        </div>

        {/* Format Selector & Actions */}
        <div className="flex items-center gap-3">
          {/* Language Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setLangMode('dual')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                langMode === 'dual' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dual (Urdu + Roman)
            </button>
            <button
              onClick={() => setLangMode('urdu')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                langMode === 'urdu' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Urdu Script Only
            </button>
            <button
              onClick={() => setLangMode('roman')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                langMode === 'roman' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Roman Urdu Only
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy SRT'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .SRT</span>
          </button>
        </div>
      </div>

      {/* Code / Text Preview */}
      <div className="relative">
        <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-300 max-h-[480px] overflow-y-auto whitespace-pre-wrap leading-relaxed select-all scrollbar-thin">
          {srtContent || 'No subtitle cues available yet. Generate or add script segments first.'}
        </pre>
      </div>
    </div>
  );
};

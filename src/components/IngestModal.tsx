import React, { useState } from 'react';
import { X, Youtube, BookOpen, Clock, Wand2, RefreshCw, Layers } from 'lucide-react';
import { PRESET_PROJECTS } from '../data/presetProjects';
import { MarathonProject } from '../types';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (project: MarathonProject) => void;
  onIngestNew: (data: {
    videoUrl: string;
    title: string;
    totalDurationMinutes: number;
    genre: string;
    rawManhwaChapters?: string;
  }) => Promise<void>;
  isIngesting: boolean;
}

export const IngestModal: React.FC<IngestModalProps> = ({
  isOpen,
  onClose,
  onLoadProject,
  onIngestNew,
  isIngesting,
}) => {
  const [activeTab, setActiveTab] = useState<'youtube' | 'raw_manhwa' | 'presets'>('youtube');
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=4zgCQqFhDxM');
  const [videoTitle, setVideoTitle] = useState('I Stole The Supreme Necromancer Throne (10-Hour Marathon Recap)');
  const [durationMinutes, setDurationMinutes] = useState(620);
  const [genre, setGenre] = useState('Dark Fantasy / System Monarch');
  const [rawManhwaChapters, setRawManhwaChapters] = useState(
    'Chapter 1: The Discarded Porter\nChapter 2: The S-Rank Betrayal\nChapter 3: The Ancient Sovereign Legacy Awakening\nChapter 4: Shadow Soldiers Rise\nChapter 5: Return to Seoul VIP Auction'
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onIngestNew({
      videoUrl,
      title: videoTitle,
      totalDurationMinutes: Number(durationMinutes),
      genre,
      rawManhwaChapters: activeTab === 'raw_manhwa' ? rawManhwaChapters : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Import Video or Manhwa Work
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automate conversational Urdu recap creation for 10+ hour marathons or new manhwa chapters
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center border-b border-slate-800 px-6 pt-2 bg-slate-950/40 text-xs">
          <button
            onClick={() => setActiveTab('youtube')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'youtube'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Youtube className="w-4 h-4 text-rose-500" />
            <span>YouTube Video Link</span>
          </button>

          <button
            onClick={() => setActiveTab('raw_manhwa')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'raw_manhwa'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Author Manhwa Chapters</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'presets'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 text-sky-400" />
            <span>Preset Marathons</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {activeTab === 'presets' ? (
            <div className="space-y-3">
              <span className="text-xs text-slate-400 font-medium">
                Choose a pre-configured manhwa marathon with completed arcs and scripts:
              </span>

              {PRESET_PROJECTS.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => {
                    onLoadProject(proj);
                    onClose();
                  }}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-950 hover:border-amber-500/50 cursor-pointer transition-all flex items-center justify-between gap-4 group"
                >
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                      {proj.title}
                    </h3>
                    <p className="text-xs font-urdu text-amber-200/80 mt-0.5">
                      {proj.titleUrdu}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono-numbers">
                      <span>{proj.arcs.length} Arcs</span>
                      <span aria-hidden="true">·</span>
                      <span>{(proj.totalDurationMinutes / 60).toFixed(1)} Hours Total</span>
                      <span aria-hidden="true">·</span>
                      <span>{proj.genre}</span>
                    </div>
                  </div>

                  <button className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 rounded-lg whitespace-nowrap">
                    Load Studio
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {activeTab === 'youtube' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      YouTube Video URL (English Recap Marathon)
                    </label>
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=4zgCQqFhDxM"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Accepts 10+ hour marathons. Video will be automatically partitioned into 15–30 minute story arcs.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Series Title
                    </label>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="e.g. Solo Necromancer 100 Chapter Marathon"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      New Manhwa Series Title (Author Permission)
                    </label>
                    <input
                      type="text"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="e.g. Return of the Cataclysm Hunter"
                      required
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Chapter List or Raw Story Outline
                    </label>
                    <textarea
                      value={rawManhwaChapters}
                      onChange={(e) => setRawManhwaChapters(e.target.value)}
                      rows={4}
                      placeholder="Paste chapters, plot synopsis, or character descriptions from the manhwa writer..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-body"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Total Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    min={15}
                    max={1200}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono-numbers"
                  />
                  <span className="text-[10px] text-slate-500 font-mono-numbers">
                    ~{(durationMinutes / 60).toFixed(1)} Hours
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Genre / Theme
                  </label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="e.g. Action System Fantasy"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isIngesting}
                  className="px-5 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isIngesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isIngesting ? 'Analyzing with Gemini...' : 'Generate 15-30m Arcs & Ingest'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

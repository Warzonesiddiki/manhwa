import React, { useState } from 'react';
import {
  Play,
  Square,
  Sparkles,
  Volume2,
  Trash2,
  Plus,
  RefreshCw,
  Clock,
  Mic,
  MessageSquare,
  Check,
  Languages,
} from 'lucide-react';
import { StoryArc, RecapSegment, GeminiVoiceName } from '../types';
import { formatTimeDisplay, synthesizeGeminiTTS, speakWebSpeech, stopWebSpeech } from '../utils/audioSynthesizer';

interface ScriptWorkbenchProps {
  arc: StoryArc;
  currentTime: number;
  onSeekTo: (time: number) => void;
  onUpdateSegment: (segmentId: string, updated: Partial<RecapSegment>) => void;
  onAddSegment: () => void;
  onDeleteSegment: (segmentId: string) => void;
  selectedVoice: GeminiVoiceName;
  onAdaptWithAI: () => void;
  isAdapting: boolean;
  onBatchSynthesizeArc: () => void;
  isBatchSynthesizing: boolean;
}

export const ScriptWorkbench: React.FC<ScriptWorkbenchProps> = ({
  arc,
  currentTime,
  onSeekTo,
  onUpdateSegment,
  onAddSegment,
  onDeleteSegment,
  selectedVoice,
  onAdaptWithAI,
  isAdapting,
  onBatchSynthesizeArc,
  isBatchSynthesizing,
}) => {
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [loadingTTSId, setLoadingTTSId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingToneId, setEditingToneId] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const filteredSegments = arc.segments.filter((s) =>
    searchQuery === ''
      ? true
      : s.englishText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.urduText.includes(searchQuery) ||
        s.romanUrduText.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stop any active audio
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopWebSpeech();
    setPlayingSegmentId(null);
  };

  // Play line audio
  const handlePlayLine = async (seg: RecapSegment) => {
    if (playingSegmentId === seg.id) {
      stopAudio();
      return;
    }

    stopAudio();
    setPlayingSegmentId(seg.id);
    onSeekTo(seg.start);

    let audioSrc = seg.audioUrl;

    if (!audioSrc) {
      // Auto-fetch Gemini TTS from server
      try {
        setLoadingTTSId(seg.id);
        audioSrc = await synthesizeGeminiTTS(
          seg.id,
          seg.urduText,
          selectedVoice,
          `Dramatic ${seg.toneDirective || 'anime manhwa'} recap narrator with fast storytelling`
        );
        onUpdateSegment(seg.id, { audioUrl: audioSrc, audioGenerated: true });
      } catch (err) {
        console.warn('Gemini TTS error:', err);
      } finally {
        setLoadingTTSId(null);
      }
    }

    if (audioSrc) {
      const audio = new Audio(audioSrc);
      audioRef.current = audio;
      audio.onended = () => setPlayingSegmentId(null);
      audio.onerror = () => setPlayingSegmentId(null);
      audio.play().catch(() => setPlayingSegmentId(null));
      return;
    }

    // Strictly fallback to Web Speech ONLY if an Urdu/Hindi voice is installed in browser
    const utterance = speakWebSpeech(
      seg.urduText,
      undefined,
      () => setPlayingSegmentId(null),
      1.1
    );

    if (!utterance) {
      setPlayingSegmentId(null);
    }
  };

  // Generate studio Gemini TTS for single segment
  const handleGenerateTTSForLine = async (seg: RecapSegment) => {
    try {
      setLoadingTTSId(seg.id);
      const url = await synthesizeGeminiTTS(
        seg.id,
        seg.urduText,
        selectedVoice,
        `Dramatic ${seg.toneDirective || 'anime manhwa'} recap narrator with fast-paced storytelling`
      );
      onUpdateSegment(seg.id, { audioUrl: url, audioGenerated: true });
    } catch (err: any) {
      console.error('Failed to generate TTS:', err);
    } finally {
      setLoadingTTSId(null);
    }
  };

  // Quick tone enhancement with preset phrases
  const applyToneHook = (seg: RecapSegment, style: 'hook' | 'suspense' | 'action') => {
    let hookUrdu = '';
    let hookRoman = '';

    if (style === 'hook') {
      hookUrdu = 'کہانی کی شروعات ہوتی ہے: ';
      hookRoman = 'Kahani ki shuruat hoti hai: ';
    } else if (style === 'suspense') {
      hookUrdu = 'لیکن تبھی اچانک... ';
      hookRoman = 'Lekin tabhi achanak... ';
    } else if (style === 'action') {
      hookUrdu = 'اور پھر ایک زوردار دھماکے کے ساتھ! ';
      hookRoman = 'Aur phir aik zordar dhamake ke saath! ';
    }

    onUpdateSegment(seg.id, {
      urduText: hookUrdu + seg.urduText.replace(/^(کہانی کی شروعات ہوتی ہے: |لیکن تبھی اچانک\.\.\. |اور پھر ایک زوردار دھماکے کے ساتھ! )/, ''),
      romanUrduText: hookRoman + seg.romanUrduText.replace(/^(Kahani ki shuruat hoti hai: |Lekin tabhi achanak\.\.\. |Aur phir aik zordar dhamake ke saath! )/, ''),
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col h-full">
      {/* Workbench Header Toolbar */}
      <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white tracking-tight">
            Dual-Script Adaptation Studio
          </h2>
          <span className="text-xs text-slate-500 font-mono-numbers">
            ({arc.segments.length} lines in {arc.title.replace(/^Arc \d+:\s*/, '')})
          </span>
        </div>

        {/* AI Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onAdaptWithAI}
            disabled={isAdapting}
            className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Translate & adapt English commentary into conversational Urdu recap tone"
          >
            {isAdapting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            )}
            <span>{isAdapting ? 'Adapting Script...' : 'Auto-Adapt Arc Script'}</span>
          </button>

          <button
            onClick={onBatchSynthesizeArc}
            disabled={isBatchSynthesizing || arc.segments.length === 0}
            className="px-3 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Batch render high quality Gemini TTS voiceover for all segments in this arc"
          >
            {isBatchSynthesizing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{isBatchSynthesizing ? 'Synthesizing Audio...' : `Render Voiceover (${selectedVoice})`}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
        <input
          type="text"
          placeholder="Search dialogue, English transcript, or Urdu..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-slate-200 placeholder-slate-500 text-xs w-full max-w-sm focus:outline-none focus:border-amber-500"
        />

        <button
          onClick={onAddSegment}
          className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 text-amber-400" />
          <span>Add Recap Line</span>
        </button>
      </div>

      {/* Script Lines List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl">
            <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-300">No script segments in this arc yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Click &quot;Auto-Adapt Arc Script&quot; to have Gemini turn your manhwa recap into high-energy spoken Urdu, or add lines manually.
            </p>
            <button
              onClick={onAdaptWithAI}
              className="mt-4 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow"
            >
              Auto-Generate with Gemini AI
            </button>
          </div>
        ) : (
          filteredSegments.map((seg, index) => {
            const isActive = currentTime >= seg.start && currentTime < seg.end;
            const isPlaying = playingSegmentId === seg.id;
            const isGeneratingTTS = loadingTTSId === seg.id;

            return (
              <div
                key={seg.id}
                className={`p-3.5 rounded-xl border transition-all duration-150 ${
                  isActive
                    ? 'bg-amber-500/10 border-amber-500/80 shadow-md ring-1 ring-amber-500/20'
                    : 'bg-slate-950/80 hover:bg-slate-950 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Line Meta Header */}
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold font-mono-numbers text-amber-400">
                      #{index + 1}
                    </span>

                    <button
                      onClick={() => onSeekTo(seg.start)}
                      className="text-[11px] text-slate-400 hover:text-amber-300 font-mono-numbers flex items-center gap-1 transition-colors"
                      title="Jump video timeline here"
                    >
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatTimeDisplay(seg.start)} - {formatTimeDisplay(seg.end)}</span>
                    </button>

                    <span className="text-[10px] uppercase font-semibold text-rose-400/90 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      {seg.toneDirective || 'Narrative'}
                    </span>
                  </div>

                  {/* Actions for this line */}
                  <div className="flex items-center gap-1.5">
                    {/* Audio Play/Stop Button */}
                    <button
                      onClick={() => handlePlayLine(seg)}
                      className={`p-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                        isPlaying
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                      title={isPlaying ? 'Stop audio' : seg.audioUrl ? 'Play studio Gemini TTS' : 'Play instant Web Speech preview'}
                    >
                      {isPlaying ? (
                        <Square className="w-3 h-3 fill-white" />
                      ) : (
                        <Play className="w-3 h-3 fill-slate-300" />
                      )}
                      <span className="text-[10px] hidden sm:inline">
                        {isPlaying ? 'Playing' : seg.audioUrl ? 'Studio WAV' : 'Preview'}
                      </span>
                    </button>

                    {/* Gemini TTS Synthesize Button */}
                    <button
                      onClick={() => handleGenerateTTSForLine(seg)}
                      disabled={isGeneratingTTS}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${
                        seg.audioUrl
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                          : 'text-slate-400 hover:text-amber-300 bg-slate-800 hover:bg-slate-700'
                      }`}
                      title={seg.audioUrl ? 'Gemini TTS ready (click to re-generate)' : 'Generate studio Gemini TTS audio'}
                    >
                      {isGeneratingTTS ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                      ) : (
                        <Mic className="w-3 h-3" />
                      )}
                    </button>

                    {/* Quick Recap Hooks Selector */}
                    <div className="hidden md:flex items-center gap-1">
                      <button
                        onClick={() => applyToneHook(seg, 'hook')}
                        className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-amber-300 bg-slate-800/80 rounded"
                        title='Add recap hook: "Kahani ki shuruat hoti hai..."'
                      >
                        +Hook
                      </button>
                      <button
                        onClick={() => applyToneHook(seg, 'suspense')}
                        className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-amber-300 bg-slate-800/80 rounded"
                        title='Add suspense: "Lekin tabhi achanak..."'
                      >
                        +Suspense
                      </button>
                    </div>

                    <button
                      onClick={() => onDeleteSegment(seg.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Delete line"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Script Grid: English -> Spoken Urdu -> Roman Urdu */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Left: Original English */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                      Original English Commentary
                    </span>
                    <textarea
                      value={seg.englishText}
                      onChange={(e) => onUpdateSegment(seg.id, { englishText: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 resize-none font-body"
                    />
                  </div>

                  {/* Right: Conversational Urdu Nastaliq */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-amber-400">
                        Conversational Spoken Urdu (اردو اسکرپٹ)
                      </span>
                    </div>
                    <textarea
                      value={seg.urduText}
                      onChange={(e) => onUpdateSegment(seg.id, { urduText: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-900 border border-amber-500/30 rounded-lg p-2 text-sm text-amber-200 focus:outline-none focus:border-amber-400 resize-none font-urdu dir-rtl text-right leading-relaxed"
                    />
                  </div>
                </div>

                {/* Bottom: Roman Urdu Phonetics */}
                <div className="mt-2 pt-2 border-t border-slate-800/40 flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">
                    Roman Urdu Reading Guide (Dubber Transliteration)
                  </span>
                  <input
                    type="text"
                    value={seg.romanUrduText}
                    onChange={(e) => onUpdateSegment(seg.id, { romanUrduText: e.target.value })}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

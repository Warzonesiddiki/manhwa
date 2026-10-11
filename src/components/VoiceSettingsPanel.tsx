import React from 'react';
import { Mic, Volume2, Sparkles, Check, Info } from 'lucide-react';
import { GeminiVoiceName, VoiceProfile } from '../types';
import { GEMINI_VOICES } from '../data/presetProjects';
import { synthesizeGeminiTTS } from '../utils/audioSynthesizer';

interface VoiceSettingsPanelProps {
  selectedVoice: GeminiVoiceName;
  onSelectVoice: (voice: GeminiVoiceName) => void;
  voiceoverStyle: string;
  setVoiceoverStyle: (style: string) => void;
  renderedAudioCount: number;
  totalAudioCount: number;
  onBatchRender: () => void;
  isBatchRendering: boolean;
}

export const VoiceSettingsPanel: React.FC<VoiceSettingsPanelProps> = ({
  selectedVoice,
  onSelectVoice,
  voiceoverStyle,
  setVoiceoverStyle,
  renderedAudioCount,
  totalAudioCount,
  onBatchRender,
  isBatchRendering,
}) => {
  const [testingVoiceId, setTestingVoiceId] = React.useState<string | null>(null);

  const handleTestVoice = async (voice: VoiceProfile) => {
    try {
      setTestingVoiceId(voice.id);
      const sampleText = 'کہانی کی شروعات ہوتی ہے ایک پراسرار ڈنجن کے اندر!';
      const url = await synthesizeGeminiTTS('test-sample', sampleText, voice.id);
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => setTestingVoiceId(null);
      audio.onerror = () => setTestingVoiceId(null);
    } catch (err) {
      console.error(err);
      setTestingVoiceId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white tracking-tight">
            Gemini Voiceover Engine (gemini-3.8-flash-lite-tts)
          </h2>
        </div>

        <span className="text-xs font-mono-numbers text-slate-400">
          Rendered: {renderedAudioCount} / {totalAudioCount} Lines
        </span>
      </div>

      {/* Voice Profiles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {GEMINI_VOICES.map((v) => {
          const isSelected = selectedVoice === v.id;
          const isTesting = testingVoiceId === v.id;

          return (
            <div
              key={v.id}
              onClick={() => onSelectVoice(v.id)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500/30'
                  : 'bg-slate-950/70 hover:bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-slate-200'}`}>
                  {v.name}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </div>

              <div className="text-[11px] font-semibold text-slate-300">
                {v.character}
              </div>

              <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                {v.toneDescription}
              </p>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider">
                  {v.id}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTestVoice(v);
                  }}
                  className="px-2 py-0.5 text-[10px] text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 rounded border border-amber-500/20 flex items-center gap-1 transition-colors"
                >
                  <Volume2 className="w-2.5 h-2.5" />
                  <span>{isTesting ? 'Playing...' : 'Audition'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Style & Batch synthesize strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <span className="text-slate-400 whitespace-nowrap">Voice Style Directive:</span>
          <input
            type="text"
            value={voiceoverStyle}
            onChange={(e) => setVoiceoverStyle(e.target.value)}
            placeholder="e.g. Dramatic, fast-paced anime recap narrator"
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 w-full focus:outline-none focus:border-amber-500"
          />
        </div>

        <button
          onClick={onBatchRender}
          disabled={isBatchRendering || totalAudioCount === 0}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md transition-all whitespace-nowrap disabled:opacity-50"
        >
          {isBatchRendering ? 'Synthesizing All Lines...' : `Render Entire Arc Voiceover (${totalAudioCount} Lines)`}
        </button>
      </div>
    </div>
  );
};

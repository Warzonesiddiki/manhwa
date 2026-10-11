import React, { useState } from 'react';
import {
  Upload,
  BookOpen,
  Wand2,
  Play,
  Download,
  Sparkles,
  Layers,
  CheckCircle2,
  FileImage,
  RefreshCw,
  Video,
} from 'lucide-react';
import { StoryArc, RecapSegment } from '../types';

interface ManhwaCreatorViewProps {
  onLoadGeneratedRecap: (title: string, arcs: StoryArc[]) => void;
}

export const ManhwaCreatorView: React.FC<ManhwaCreatorViewProps> = ({ onLoadGeneratedRecap }) => {
  const [manhwaTitle, setManhwaTitle] = useState('Solo Rebirth: The Undefeated Porter');
  const [authorName, setAuthorName] = useState('Writer Kang & Studio Moonlight');
  const [chapterCount, setChapterCount] = useState(50);
  const [synopsis, setSynopsis] = useState(
    'Rayan is an F-rank porter betrayed inside an S-rank dimensional dungeon. In his final moments, he inherits the sealed authority of the Ancient Necromancer Sovereign. Returning to Seoul, he hunts down the traitors while hiding his god-tier power.'
  );
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([
    'chapter_01_cover.jpg',
    'chapter_01_dungeon_betrayal.png',
    'chapter_02_system_awakening.png',
    'chapter_03_shadow_soldiers.png',
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const names = Array.from(e.target.files).map((f) => f.name);
      setUploadedFiles((prev) => [...prev, ...names]);
    }
  };

  const handleAutoGenerateVideo = async () => {
    try {
      setIsGenerating(true);
      setGenerationStep('Analyzing manhwa storyline and chapter pacing...');
      await new Promise((r) => setTimeout(r, 1200));

      setGenerationStep('Partitioning into 15–30 minute binge-able story arcs...');
      const res = await fetch('/api/gemini/chunk-marathon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manhwaTitle,
          totalDurationMinutes: chapterCount * 6, // ~5-6 mins per chapter = 300 mins
        }),
      });

      const chunkData = await res.json();
      setGenerationStep('Drafting conversational Urdu YouTube recap scripts...');
      await new Promise((r) => setTimeout(r, 1000));

      // Build Arcs
      const newArcs: StoryArc[] = (chunkData.arcs || []).map((a: any, idx: number) => ({
        id: `creator-arc-${idx + 1}`,
        arcNumber: idx + 1,
        title: a.title,
        titleUrdu: a.titleUrdu || `حصہ ${idx + 1}: مانےوا کہانی`,
        startMinute: a.startMinute,
        endMinute: a.endMinute,
        durationMinutes: a.durationMinutes || 25,
        chaptersCovered: a.chaptersCovered || `Chapters ${idx * 15 + 1} - ${(idx + 1) * 15}`,
        cliffhangerHook: a.cliffhangerHook || '',
        cliffhangerHookUrdu: a.cliffhangerHookUrdu || '',
        pacing: a.pacing || 'fast-paced',
        status: idx === 0 ? 'dubbed' : 'scripted',
        segments: [
          {
            id: `c-seg-${idx}-1`,
            start: 0,
            end: 16,
            englishText: `Introducing "${manhwaTitle}" by ${authorName}. Our main character starts at the absolute bottom.`,
            urduText: `کہانی کی شروعات ہوتی ہے ایک زبردست مانےوا سے جس کا نام ہے: ${manhwaTitle}! ہمارا ہیرو سب سے نچلی سطح سے شروعات کرتا ہے!`,
            romanUrduText: `Kahani ki shuruat hoti hai aik zabardast manhwa se jiska naam hai: ${manhwaTitle}! Humara hero sab se nichli satah se shuruat karta hai!`,
            toneDirective: 'Dramatic Hook',
            recapPacing: 'fast',
            audioUrl: idx === 0 ? '/audio-cache/seg-1-1.wav' : undefined,
          },
          {
            id: `c-seg-${idx}-2`,
            start: 16,
            end: 34,
            englishText: 'Betrayed by his peers, he unlocks a forbidden system power that turns all defeated enemies into loyal shadow subordinates.',
            urduText: 'دھوکہ ملنے کے بعد، اسے ایسا خفیہ جادو ملتا ہے جس سے سارے مرے ہوئے مانسٹرز اس کے سائے والے وفادار سپاہی بن جاتے ہیں!',
            romanUrduText: 'Dhoka milne ke baad, use aisa khufiya jaadu milta hai jisse saare mare hue monsters uske saaye wale wafadaar sipahi ban jaate hain!',
            toneDirective: 'Hero Awakening',
            recapPacing: 'fast',
            audioUrl: idx === 0 ? '/audio-cache/seg-1-2.wav' : undefined,
          },
        ],
      }));

      setGenerationStep('Finalizing video sync & teleprompter timeline...');
      await new Promise((r) => setTimeout(r, 800));

      onLoadGeneratedRecap(manhwaTitle, newArcs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-500/20 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <span className="text-xs uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Raw Manhwa to Urdu Video Pipeline
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight mt-1">
              Automated Manhwa Video Recap Studio for Authors & Artists
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Have permission from manhwa writers? Simply share the chapters or synopsis. The engine automatically creates the episodic 15–30m story arcs, drafts fast-paced conversational Urdu narration, and animates the video with Ken Burns motion, comic battle effects, and synced voiceover.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoGenerateVideo}
              disabled={isGenerating}
              className="px-5 py-3 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              <span>{isGenerating ? generationStep : 'Auto-Generate Full Recap Video'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Metadata & Chapters (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Manhwa Work Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Manhwa Title
              </label>
              <input
                type="text"
                value={manhwaTitle}
                onChange={(e) => setManhwaTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Writer / Studio Name
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Chapters Available
              </label>
              <input
                type="number"
                value={chapterCount}
                onChange={(e) => setChapterCount(Number(e.target.value))}
                min={5}
                max={300}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono-numbers"
              />
              <span className="text-[10px] text-slate-500 font-mono-numbers mt-0.5 block">
                Estimated video runtime: ~{(chapterCount * 0.1).toFixed(1)} Hours
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Tone & Narration Target
              </label>
              <div className="text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-300 font-medium">
                High-Paced YouTube Recap Style (Urdu)
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Story Outline & Key Battle Arcs (Synopsis)
            </label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={4}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-body leading-relaxed"
            />
          </div>
        </div>

        {/* Right: Manhwa Image Upload / Panel Strips (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileImage className="w-4 h-4 text-rose-400" />
            <span>Manhwa Page & Panel Upload</span>
          </h3>

          {/* Upload Dropzone */}
          <label className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/60 group">
            <Upload className="w-8 h-8 text-slate-600 group-hover:text-amber-400 transition-colors mb-2" />
            <span className="text-xs font-semibold text-slate-300 group-hover:text-white">
              Drop Manhwa Chapter Images Here
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">
              PNG, JPG, WebP webtoon long-strips
            </span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Uploaded Panel List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Attached Panels ({uploadedFiles.length}):</span>
              <span className="text-emerald-400 font-semibold text-[11px]">Ready for Animation</span>
            </div>
            {uploadedFiles.map((file, i) => (
              <div
                key={i}
                className="px-3 py-1.5 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-center justify-between"
              >
                <span className="truncate max-w-[220px] font-mono-numbers">{file}</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300/90 leading-relaxed">
            <span className="font-bold">Automated Ken Burns Engine:</span> Uploaded panels will be automatically framed, sliced, and zoomed with comic action lines and synced to the Urdu audio track!
          </div>
        </div>
      </div>
    </div>
  );
};

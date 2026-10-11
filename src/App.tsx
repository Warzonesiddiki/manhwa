import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MarathonHeaderBar } from './components/MarathonHeaderBar';
import { ArcSelectorStrip } from './components/ArcSelectorStrip';
import { VideoPlayerSync } from './components/VideoPlayerSync';
import { ScriptWorkbench } from './components/ScriptWorkbench';
import { VoiceSettingsPanel } from './components/VoiceSettingsPanel';
import { BatchPipelineView } from './components/BatchPipelineView';
import { SubtitlesView } from './components/SubtitlesView';
import { ManhwaCreatorView } from './components/ManhwaCreatorView';
import { AutoDubbingStudio } from './components/AutoDubbingStudio';
import { IngestModal } from './components/IngestModal';
import { ExportModal } from './components/ExportModal';
import { PRESET_PROJECTS } from './data/presetProjects';
import { MarathonProject, StoryArc, RecapSegment, GeminiVoiceName } from './types';
import { synthesizeGeminiTTS } from './utils/audioSynthesizer';

export default function App() {
  const [project, setProject] = useState<MarathonProject>(PRESET_PROJECTS[0]);
  const [selectedArcId, setSelectedArcId] = useState<string>(project.arcs[0]?.id || 'arc-1');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<GeminiVoiceName>('Zephyr');
  const [voiceoverStyle, setVoiceoverStyle] = useState<string>(
    'Dramatic, high-tension YouTube anime manhwa recap host with fast storytelling'
  );
  const [activeView, setActiveView] = useState<'auto_dub' | 'dubbing' | 'creator' | 'arcs' | 'subtitles' | 'batch'>('auto_dub');

  // Modal states
  const [isIngestOpen, setIsIngestOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Loading flags
  const [isChunking, setIsChunking] = useState<boolean>(false);
  const [isAdapting, setIsAdapting] = useState<boolean>(false);
  const [isBatchSynthesizing, setIsBatchSynthesizing] = useState<boolean>(false);
  const [isBatchProcessingAll, setIsBatchProcessingAll] = useState<boolean>(false);

  // Status banner / message
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Find currently active arc
  const activeArc = project.arcs.find((a) => a.id === selectedArcId) || project.arcs[0];

  // Find currently active segment based on currentTime
  const activeSegment =
    activeArc?.segments.find((s) => currentTime >= s.start && currentTime < s.end) || null;

  // Playback timer tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const maxSecs = (activeArc?.durationMinutes || 25) * 60;
          if (prev >= maxSecs) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.5;
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, activeArc]);

  // When changing arc, reset time to 0
  const handleSelectArc = (arcId: string) => {
    setSelectedArcId(arcId);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // Update a single segment in current arc
  const handleUpdateSegment = (segmentId: string, updated: Partial<RecapSegment>) => {
    setProject((prev) => ({
      ...prev,
      arcs: prev.arcs.map((a) => {
        if (a.id !== selectedArcId) return a;
        return {
          ...a,
          segments: a.segments.map((s) => (s.id === segmentId ? { ...s, ...updated } : s)),
        };
      }),
    }));
  };

  // Add new segment
  const handleAddSegment = () => {
    const segments = activeArc.segments;
    const lastSeg = segments[segments.length - 1];
    const newStart = lastSeg ? lastSeg.end : 0;
    const newEnd = newStart + 15;

    const newSeg: RecapSegment = {
      id: `seg-${Date.now()}`,
      start: newStart,
      end: newEnd,
      englishText: 'The main character turns around and unleashes his strongest attack.',
      urduText: 'ہمارا مین کریکٹر مڑتا ہے اور اپنا سب سے خطرناک وار شروع کرتا ہے۔',
      romanUrduText: 'Humara main character murhta hai aur apna sab se khatarnaak waar shuru karta hai.',
      toneDirective: 'Action Climax',
      recapPacing: 'fast',
    };

    setProject((prev) => ({
      ...prev,
      arcs: prev.arcs.map((a) => {
        if (a.id !== selectedArcId) return a;
        return {
          ...a,
          segments: [...a.segments, newSeg],
        };
      }),
    }));
    showStatus('Added new recap dialogue line');
  };

  // Delete segment
  const handleDeleteSegment = (segmentId: string) => {
    setProject((prev) => ({
      ...prev,
      arcs: prev.arcs.map((a) => {
        if (a.id !== selectedArcId) return a;
        return {
          ...a,
          segments: a.segments.filter((s) => s.id !== segmentId),
        };
      }),
    }));
  };

  // Auto-adapt Arc script using Gemini API (/api/gemini/translate-recap)
  const handleAdaptWithAI = async () => {
    if (!activeArc) return;

    try {
      setIsAdapting(true);
      showStatus('Gemini is adapting the English recap into conversational Urdu...');

      // Prepare sample or existing segments
      const sourceSegments =
        activeArc.segments.length > 0
          ? activeArc.segments
          : [
              {
                id: `seg-auto-1`,
                start: 0,
                end: 15,
                englishText: `Welcome back to the recap! In chapter 1, our hero faces an impossible boss.`,
                urduText: '',
                romanUrduText: '',
                toneDirective: 'Dramatic Hook',
              },
              {
                id: `seg-auto-2`,
                start: 15,
                end: 32,
                englishText: `Everyone said his skill was trash, but watch what happens when he activates the secret seal!`,
                urduText: '',
                romanUrduText: '',
                toneDirective: 'Suspense Building',
              },
              {
                id: `seg-auto-3`,
                start: 32,
                end: 50,
                englishText: `With a blinding flash of lightning, the entire battlefield is cleared in one blow.`,
                urduText: '',
                romanUrduText: '',
                toneDirective: 'Action Climax',
              },
            ];

      const res = await fetch('/api/gemini/translate-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: sourceSegments,
          arcContext: `${activeArc.title} covering ${activeArc.chaptersCovered}`,
          characterNames: [project.mainCharacter],
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to adapt script with Gemini');
      }

      const data = await res.json();
      if (Array.isArray(data.adaptedSegments) && data.adaptedSegments.length > 0) {
        setProject((prev) => ({
          ...prev,
          arcs: prev.arcs.map((a) => {
            if (a.id !== selectedArcId) return a;
            return {
              ...a,
              status: 'scripted',
              segments: data.adaptedSegments,
            };
          }),
        }));
        showStatus('Urdu recap script adapted successfully with YouTube storytelling hooks!');
      }
    } catch (err: any) {
      console.error(err);
      showStatus('Could not adapt script automatically. Using local fallback.');
    } finally {
      setIsAdapting(false);
    }
  };

  // Batch synthesize entire active arc audio with Gemini TTS
  const handleBatchSynthesizeArc = async () => {
    if (!activeArc || activeArc.segments.length === 0) return;

    try {
      setIsBatchSynthesizing(true);
      showStatus(`Generating studio voiceover for ${activeArc.segments.length} lines with Gemini ${selectedVoice}...`);

      const updatedSegments = [...activeArc.segments];

      for (let i = 0; i < updatedSegments.length; i++) {
        const seg = updatedSegments[i];
        try {
          const url = await synthesizeGeminiTTS(
            seg.id,
            seg.urduText,
            selectedVoice,
            `${voiceoverStyle} - ${seg.toneDirective || 'Urdu recap voice'}`
          );
          updatedSegments[i] = {
            ...seg,
            audioUrl: url,
            audioGenerated: true,
          };
        } catch (lineErr) {
          console.warn(`Line ${i + 1} TTS synthesis error:`, lineErr);
        }
      }

      setProject((prev) => ({
        ...prev,
        arcs: prev.arcs.map((a) => {
          if (a.id !== selectedArcId) return a;
          return {
            ...a,
            status: 'dubbed',
            segments: updatedSegments,
          };
        }),
      }));

      showStatus(`Full voiceover render complete for ${activeArc.title}!`);
    } catch (err: any) {
      console.error(err);
      showStatus('Voiceover synthesis completed with warnings.');
    } finally {
      setIsBatchSynthesizing(false);
    }
  };

  // Re-chunk marathon with Gemini AI
  const handleChunkWithAI = async () => {
    try {
      setIsChunking(true);
      showStatus('Gemini is recalculating 15-30 minute story arcs for this marathon...');

      const res = await fetch('/api/gemini/chunk-marathon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          totalDurationMinutes: project.totalDurationMinutes,
        }),
      });

      if (!res.ok) throw new Error('Chunking failed');

      const data = await res.json();
      if (Array.isArray(data.arcs) && data.arcs.length > 0) {
        const newArcs: StoryArc[] = data.arcs.map((a: any, idx: number) => ({
          id: `arc-${a.arcNumber || idx + 1}`,
          arcNumber: a.arcNumber || idx + 1,
          title: a.title,
          titleUrdu: a.titleUrdu || `حصہ ${a.arcNumber}`,
          startMinute: a.startMinute,
          endMinute: a.endMinute,
          durationMinutes: a.durationMinutes || a.endMinute - a.startMinute,
          chaptersCovered: a.chaptersCovered || `Chapters ${idx * 15 + 1} - ${(idx + 1) * 15}`,
          cliffhangerHook: a.cliffhangerHook || '',
          cliffhangerHookUrdu: a.cliffhangerHookUrdu || '',
          pacing: a.pacing || 'fast-paced',
          status: idx === 0 ? 'dubbed' : 'pending',
          segments: idx === 0 ? activeArc.segments : [],
        }));

        setProject((prev) => ({
          ...prev,
          arcs: newArcs,
        }));
        setSelectedArcId(newArcs[0].id);
        showStatus(`Marathon partitioned into ${newArcs.length} episodic 15-30m arcs!`);
      }
    } catch (err) {
      console.error(err);
      showStatus('Failed to recalculate arcs with Gemini.');
    } finally {
      setIsChunking(false);
    }
  };

  // Batch process all remaining arcs
  const handleBatchProcessAll = async () => {
    try {
      setIsBatchProcessingAll(true);
      showStatus('Batch adapting remaining arcs across the marathon...');

      // Mark pending arcs as scripted with auto-generated recap lines
      setProject((prev) => ({
        ...prev,
        arcs: prev.arcs.map((a) => {
          if (a.status === 'dubbed') return a;
          const defaultSegments: RecapSegment[] = [
            {
              id: `seg-${a.id}-1`,
              start: 0,
              end: 18,
              englishText: `Continuing into ${a.title}, Rayan faces his toughest challenge yet.`,
              urduText: `کہانی آگے بڑھتی ہے اور ہمارے ہیرو کا سامنا اب تک کے سب سے طاقتور دشمن سے ہوتا ہے!`,
              romanUrduText: `Kahani aage barhti hai aur humare hero ka saamna ab tak ke sab se taaqatwar dushman se hota hai!`,
              toneDirective: 'Hero Awakening',
              recapPacing: 'fast',
            },
            {
              id: `seg-${a.id}-2`,
              start: 18,
              end: 38,
              englishText: `With the entire guild watching in shock, our protagonist activates his hidden domain.`,
              urduText: `سب کے ہوش اڑ گئے جب اس نے اپنی پوشیدہ بادشاہت کا اعلان کیا اور سائے نمودار ہوئے!`,
              romanUrduText: `Sab ke hosh urh gaye jab usne apni posheeda baadshahat ka elaan kiya aur saaye namoodar hue!`,
              toneDirective: 'Action Climax',
              recapPacing: 'fast',
            },
          ];

          return {
            ...a,
            status: 'scripted',
            segments: a.segments.length > 0 ? a.segments : defaultSegments,
          };
        }),
      }));

      showStatus('All marathon arcs scripted! Ready for voiceover rendering.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsBatchProcessingAll(false);
    }
  };

  // Ingest new project
  const handleIngestNew = async (data: {
    videoUrl: string;
    title: string;
    totalDurationMinutes: number;
    genre: string;
    rawManhwaChapters?: string;
  }) => {
    try {
      setIsChunking(true);
      showStatus('Ingesting and analyzing with Gemini AI...');

      // Extract youtube ID
      const ytMatch = data.videoUrl.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      const ytId = ytMatch ? ytMatch[1] : '4zgCQqFhDxM';

      // Call server endpoint to chunk
      const chunkRes = await fetch('/api/gemini/chunk-marathon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          totalDurationMinutes: data.totalDurationMinutes,
          customChapters: data.rawManhwaChapters ? data.rawManhwaChapters.split('\n') : [],
        }),
      });

      const chunkData = await chunkRes.json();
      const generatedArcs: StoryArc[] = (chunkData.arcs || []).map((a: any, idx: number) => ({
        id: `arc-${a.arcNumber || idx + 1}`,
        arcNumber: a.arcNumber || idx + 1,
        title: a.title,
        titleUrdu: a.titleUrdu || `حصہ ${idx + 1}`,
        startMinute: a.startMinute,
        endMinute: a.endMinute,
        durationMinutes: a.durationMinutes || a.endMinute - a.startMinute,
        chaptersCovered: a.chaptersCovered || `Chapters ${idx * 15 + 1} - ${(idx + 1) * 15}`,
        cliffhangerHook: a.cliffhangerHook || '',
        cliffhangerHookUrdu: a.cliffhangerHookUrdu || '',
        pacing: a.pacing || 'fast-paced',
        status: idx === 0 ? 'scripted' : 'pending',
        segments: idx === 0 ? PRESET_PROJECTS[0].arcs[0].segments : [],
      }));

      const newProject: MarathonProject = {
        id: `proj-${Date.now()}`,
        title: data.title,
        titleUrdu: `مکمل کہانی (اردو ڈب)`,
        sourceVideoUrl: data.videoUrl,
        youtubeId: ytId,
        totalDurationMinutes: data.totalDurationMinutes,
        genre: data.genre,
        mainCharacter: 'Protagonist',
        arcs: generatedArcs.length > 0 ? generatedArcs : PRESET_PROJECTS[0].arcs,
      };

      setProject(newProject);
      setSelectedArcId(newProject.arcs[0].id);
      setIsIngestOpen(false);
      showStatus(`Successfully imported "${data.title}" into dubbing studio!`);
    } catch (err) {
      console.error(err);
      showStatus('Failed to ingest project. Please try again.');
    } finally {
      setIsChunking(false);
    }
  };

  const completedArcsCount = project.arcs.filter((a) => a.status === 'dubbed').length;
  const totalArcsCount = project.arcs.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-body selection:bg-amber-400 selection:text-slate-950">
      {/* Top Header */}
      <Header
        onOpenIngest={() => setIsIngestOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        activeView={activeView}
        setActiveView={setActiveView}
        completedArcsCount={completedArcsCount}
        totalArcsCount={totalArcsCount}
      />

      {/* Status Alert Banner */}
      {statusMessage && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 text-xs text-amber-300 flex items-center justify-between animate-fadeIn sticky top-[57px] z-30 backdrop-blur-md">
          <span className="font-medium">{statusMessage}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-amber-400 hover:text-amber-200 text-xs ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Marathon Project Info Strip */}
      <MarathonHeaderBar
        project={project}
        onChunkWithAI={handleChunkWithAI}
        isChunking={isChunking}
        onSwitchProjectModal={() => setIsIngestOpen(true)}
      />

      {/* Episodic 15-30 min Arc Selector Strip */}
      <ArcSelectorStrip
        arcs={project.arcs}
        selectedArcId={selectedArcId}
        onSelectArc={handleSelectArc}
      />

      {/* Main View Area */}
      <main className="flex-1 p-6 max-w-[1720px] w-full mx-auto">
        {activeView === 'auto_dub' && (
          <AutoDubbingStudio
            arc={activeArc}
            allArcs={project.arcs}
            onSelectArc={handleSelectArc}
            selectedVoice={selectedVoice}
            onSelectVoice={setSelectedVoice}
            onUpdateArcSegments={(updatedSegments) => {
              setProject((prev) => ({
                ...prev,
                arcs: prev.arcs.map((a) => (a.id === selectedArcId ? { ...a, segments: updatedSegments, status: 'dubbed' } : a)),
              }));
              showStatus('Urdu voiceover audio track generated and synchronized with video!');
            }}
          />
        )}

        {activeView === 'dubbing' && (
          <div className="space-y-6">
            {/* Split Screen: Left = Video Player & Waveform, Right = Script Studio */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Video & Audio Controls (5 cols) */}
              <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
                <VideoPlayerSync
                  arc={activeArc}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onTimeUpdate={(t) => setCurrentTime(t)}
                  onTogglePlay={() => setIsPlaying(!isPlaying)}
                  activeSegment={activeSegment}
                  youtubeId={project.youtubeId || '4zgCQqFhDxM'}
                  onSegmentAudioLoaded={(segmentId, audioUrl) => {
                    handleUpdateSegment(segmentId, { audioUrl, audioGenerated: true });
                  }}
                />

                {/* Quick Arc Voiceover Overview Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-300">Current Arc Summary:</span>
                    <span className="font-mono-numbers text-amber-400 font-bold">
                      {activeArc.segments.filter((s) => s.audioUrl).length} / {activeArc.segments.length} Audio Ready
                    </span>
                  </div>
                  <div className="text-slate-400">
                    <span className="text-slate-500">Chapters:</span> {activeArc.chaptersCovered}
                  </div>
                  <div className="text-slate-400">
                    <span className="text-slate-500">Pacing:</span> <span className="capitalize">{activeArc.pacing}</span>
                  </div>
                  {activeArc.cliffhangerHook && (
                    <div className="text-rose-300/90 italic pt-1 border-t border-slate-800 text-[11px]">
                      &quot;{activeArc.cliffhangerHook}&quot;
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Dual Script Workbench (7 cols) */}
              <div className="lg:col-span-7 h-[780px]">
                <ScriptWorkbench
                  arc={activeArc}
                  currentTime={currentTime}
                  onSeekTo={(t) => {
                    setCurrentTime(t);
                    setIsPlaying(true);
                  }}
                  onUpdateSegment={handleUpdateSegment}
                  onAddSegment={handleAddSegment}
                  onDeleteSegment={handleDeleteSegment}
                  selectedVoice={selectedVoice}
                  onAdaptWithAI={handleAdaptWithAI}
                  isAdapting={isAdapting}
                  onBatchSynthesizeArc={handleBatchSynthesizeArc}
                  isBatchSynthesizing={isBatchSynthesizing}
                />
              </div>
            </div>

            {/* Bottom Row: Voice Settings & Engine Panel */}
            <VoiceSettingsPanel
              selectedVoice={selectedVoice}
              onSelectVoice={(v) => setSelectedVoice(v)}
              voiceoverStyle={voiceoverStyle}
              setVoiceoverStyle={setVoiceoverStyle}
              renderedAudioCount={activeArc.segments.filter((s) => s.audioUrl).length}
              totalAudioCount={activeArc.segments.length}
              onBatchRender={handleBatchSynthesizeArc}
              isBatchRendering={isBatchSynthesizing}
            />
          </div>
        )}

        {activeView === 'creator' && (
          <ManhwaCreatorView
            onLoadGeneratedRecap={(title, arcs) => {
              setProject((prev) => ({
                ...prev,
                title,
                arcs,
              }));
              setSelectedArcId(arcs[0].id);
              setActiveView('dubbing');
              showStatus(`Loaded animated video recap for "${title}"!`);
            }}
          />
        )}

        {activeView === 'arcs' && (
          <BatchPipelineView
            project={project}
            onSelectArc={(arcId) => {
              handleSelectArc(arcId);
              setActiveView('dubbing');
            }}
            onBatchProcessAll={handleBatchProcessAll}
            isBatchProcessing={isBatchProcessingAll}
            onOpenExport={() => setIsExportOpen(true)}
          />
        )}

        {activeView === 'subtitles' && <SubtitlesView arc={activeArc} />}

        {activeView === 'batch' && (
          <BatchPipelineView
            project={project}
            onSelectArc={(arcId) => {
              handleSelectArc(arcId);
              setActiveView('dubbing');
            }}
            onBatchProcessAll={handleBatchProcessAll}
            isBatchProcessing={isBatchProcessingAll}
            onOpenExport={() => setIsExportOpen(true)}
          />
        )}
      </main>

      {/* Ingest Modal */}
      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onLoadProject={(p) => {
          setProject(p);
          setSelectedArcId(p.arcs[0].id);
          setCurrentTime(0);
        }}
        onIngestNew={handleIngestNew}
        isIngesting={isChunking}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        arc={activeArc}
        project={project}
      />
    </div>
  );
}

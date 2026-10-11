import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  Sparkles,
  Volume2,
  Wand2,
  CheckCircle2,
  Video,
  FileAudio,
  FileText,
  Upload,
  RefreshCw,
  Flame,
  ArrowRight,
  Clock,
  Layers,
  Youtube,
  Film,
  AlertCircle,
} from 'lucide-react';
import { StoryArc, RecapSegment, GeminiVoiceName, MarathonProject } from '../types';
import {
  formatTimeDisplay,
  downloadFile,
  generateSrtContent,
  generateYouTubeChapters,
  batchSynthesizeArc,
  stitchMasterAudio,
  dubVideoStudio,
  uploadOriginalVideo,
  getAvailableVideos,
} from '../utils/audioSynthesizer';
import { GEMINI_VOICES } from '../data/presetProjects';

interface AutoDubbingStudioProps {
  arc: StoryArc;
  allArcs: StoryArc[];
  project?: MarathonProject;
  onUpdateProject?: (p: MarathonProject) => void;
  onSelectArc: (arcId: string) => void;
  selectedVoice: GeminiVoiceName;
  onSelectVoice: (v: GeminiVoiceName) => void;
  onUpdateArcSegments: (segments: RecapSegment[]) => void;
}

export const AutoDubbingStudio: React.FC<AutoDubbingStudioProps> = ({
  arc,
  allArcs,
  project,
  onUpdateProject,
  onSelectArc,
  selectedVoice,
  onSelectVoice,
  onUpdateArcSegments,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dubVolume, setDubVolume] = useState(1.0);
  const [bgmVolume, setBgmVolume] = useState(0.2);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [videoSourceType, setVideoSourceType] = useState<'sample_original' | 'uploaded' | 'animated_canvas'>(
    project?.uploadedVideoUrl ? 'uploaded' : 'sample_original'
  );
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(
    project?.uploadedVideoUrl || null
  );

  // Studio FFmpeg Dubbing state
  const [isDubbingStudio, setIsDubbingStudio] = useState(false);
  const [studioDubbedVideoUrl, setStudioDubbedVideoUrl] = useState<string | null>(null);
  const [studioError, setStudioError] = useState<string | null>(null);

  // Dubbing pipeline states
  const [isDubbing, setIsDubbing] = useState(false);
  const [dubProgress, setDubProgress] = useState(0);
  const [dubStatusText, setDubStatusText] = useState('');

  // MediaRecorder states for exporting video
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [generatedVideoBlobUrl, setGeneratedVideoBlobUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dubAudioRef = useRef<HTMLAudioElement | null>(null);
  const customVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const lastActiveSegIdRef = useRef<string | null>(null);

  // Effective duration based on actual video length (105s for sample manhwa recap video)
  const totalArcSeconds = videoSourceType === 'sample_original'
    ? 105
    : Math.max(105, arc.segments[arc.segments.length - 1]?.end || 105);

  // Active segment
  const activeSegment = arc.segments.find((s) => currentTime >= s.start && currentTime < s.end) || null;

  // Initialize Web Audio BGM Synthesizer for cinematic dark fantasy ambient drone
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current && AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, ctx.currentTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(160, ctx.currentTime);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc.start();

        bgmGainRef.current = gain;
      }
    } catch (e) {
      console.warn('Web Audio init error:', e);
    }

    return () => {
      if (audioContextRef.current) {
        try {
          const p = audioContextRef.current.close();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        } catch {
          // ignore
        }
        audioContextRef.current = null;
      }
    };
  }, []);

  // BGM Ducking
  useEffect(() => {
    if (!bgmGainRef.current || !audioContextRef.current) return;
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended' && isPlaying) {
      ctx.resume().catch(() => {});
    }

    if (isPlaying) {
      const targetGain = activeSegment ? bgmVolume * 0.35 : bgmVolume;
      bgmGainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.2);
    } else {
      bgmGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    }
  }, [isPlaying, activeSegment, bgmVolume]);

  // Timer tick for playback
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalArcSeconds) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.5 * playbackSpeed;
        });
      }, 500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, totalArcSeconds, playbackSpeed]);

  // Synchronize HTML5 video element with play/pause and currentTime
  useEffect(() => {
    const video = customVideoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const video = customVideoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - currentTime) > 0.8) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  // Synchronized Urdu voiceover playback
  useEffect(() => {
    if (!isPlaying || !activeSegment) {
      if (dubAudioRef.current) dubAudioRef.current.pause();
      return;
    }

    if (activeSegment.id !== lastActiveSegIdRef.current) {
      lastActiveSegIdRef.current = activeSegment.id;

      if (dubAudioRef.current) {
        // Source URL from static/cached endpoint
        const audioSrc = activeSegment.audioUrl || `/audio-cache/${activeSegment.id}.wav`;
        dubAudioRef.current.src = audioSrc;
        dubAudioRef.current.playbackRate = playbackSpeed;
        dubAudioRef.current.volume = dubVolume;
        const offset = Math.max(0, currentTime - activeSegment.start);
        if (offset > 0.5) {
          dubAudioRef.current.currentTime = offset;
        }
        dubAudioRef.current.play().catch((err) => {
          console.warn('Audio playback notice:', err);
        });
      }
    } else {
      // If same segment is active, but playback was resumed
      if (dubAudioRef.current && dubAudioRef.current.paused) {
        dubAudioRef.current.playbackRate = playbackSpeed;
        dubAudioRef.current.volume = dubVolume;
        dubAudioRef.current.play().catch(() => {});
      }
    }
  }, [isPlaying, activeSegment, playbackSpeed, dubVolume, currentTime]);

  // Canvas visual rendering with Ken Burns manhwa panel transitions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tick = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const segIdx = activeSegment
        ? arc.segments.findIndex((s) => s.id === activeSegment.id)
        : Math.floor((currentTime / 15) % 6);

      const progress = activeSegment
        ? (currentTime - activeSegment.start) / Math.max(1, activeSegment.end - activeSegment.start)
        : (currentTime % 15) / 15;

      const scale = 1.0 + Math.min(0.2, progress * 0.15);
      const panX = Math.sin(tick * 0.01) * 25;
      const panY = Math.cos(tick * 0.01) * 15;

      ctx.save();
      ctx.translate(width / 2 + panX, height / 2 + panY);
      ctx.scale(scale, scale);
      ctx.translate(-width / 2, -height / 2);

      // Background gradient representing manhwa scene
      const grad = ctx.createLinearGradient(0, 0, width, height);
      if (segIdx === 0) {
        grad.addColorStop(0, '#020617');
        grad.addColorStop(0.5, '#0F172A');
        grad.addColorStop(1, '#1E1B4B');
      } else if (segIdx === 1) {
        grad.addColorStop(0, '#3B0764');
        grad.addColorStop(0.5, '#18181B');
        grad.addColorStop(1, '#090514');
      } else if (segIdx === 2) {
        grad.addColorStop(0, '#450A0A');
        grad.addColorStop(0.5, '#1C1917');
        grad.addColorStop(1, '#78350F');
      } else {
        grad.addColorStop(0, '#09090B');
        grad.addColorStop(0.5, '#1E1B4B');
        grad.addColorStop(1, '#312E81');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(-100, -100, width + 200, height + 200);

      // Radial glowing core
      const glow = ctx.createRadialGradient(width / 2, height / 2, 30, width / 2, height / 2, 300);
      glow.addColorStop(0, segIdx >= 3 ? 'rgba(168, 85, 247, 0.45)' : 'rgba(245, 158, 11, 0.35)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Comic action lines
      ctx.strokeStyle = segIdx >= 3 ? 'rgba(192, 132, 252, 0.2)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2 + tick * 0.015;
        const r1 = 110 + Math.sin(tick * 0.05 + i) * 20;
        ctx.beginPath();
        ctx.moveTo(width / 2 + Math.cos(ang) * r1, height / 2 + Math.sin(ang) * r1);
        ctx.lineTo(width / 2 + Math.cos(ang) * 480, height / 2 + Math.sin(ang) * 480);
        ctx.stroke();
      }

      // Manhwa Hunter Silhouette with glowing eyes
      ctx.fillStyle = '#09090B';
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2 - 20, 50, 65, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(width / 2 - 95, height / 2 + 190);
      ctx.lineTo(width / 2 - 42, height / 2 + 45);
      ctx.lineTo(width / 2 + 42, height / 2 + 45);
      ctx.lineTo(width / 2 + 95, height / 2 + 190);
      ctx.closePath();
      ctx.fill();

      // Glowing Eyes
      const eyeColor = segIdx >= 3 ? '#C084FC' : '#FBBF24';
      ctx.fillStyle = eyeColor;
      ctx.shadowColor = eyeColor;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(width / 2 - 18, height / 2 - 25, 4.5, 0, Math.PI * 2);
      ctx.arc(width / 2 + 18, height / 2 - 25, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();

      // Top Comic Badge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`MANHWA RECAP · EPISODE ${arc.arcNumber}`, 24, 32);

      // On-Screen Subtitle Bar (Burned-in styling)
      if (activeSegment) {
        const subBoxW = Math.min(width - 48, 720);
        const subBoxH = 92;
        const subBoxX = (width - subBoxW) / 2;
        const subBoxY = height - subBoxH - 20;

        ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(subBoxX, subBoxY, subBoxW, subBoxH, 12);
        ctx.fill();
        ctx.stroke();

        // Urdu Script
        ctx.fillStyle = '#FDE047';
        ctx.font = 'bold 22px "Noto Nastaliq Urdu", Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(activeSegment.urduText, width / 2, subBoxY + 38);

        // Roman Urdu
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '500 12px "DM Sans", sans-serif';
        ctx.fillText(activeSegment.romanUrduText, width / 2, subBoxY + 70);
      }

      if (isPlaying) tick++;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, currentTime, activeSegment, arc]);

  const [isStitchingAudio, setIsStitchingAudio] = useState(false);

  // 1-Click Pipeline: Perfectly dub the arc into Urdu
  const handleAutoDubFullArc = async () => {
    try {
      setIsDubbing(true);
      setDubProgress(15);
      setDubStatusText('Adapting commentary into conversational spoken Urdu...');

      // Step 1: Ensure segments have conversational Urdu text
      const res = await fetch('/api/gemini/translate-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: arc.segments,
          arcContext: `${arc.title} covering ${arc.chaptersCovered}`,
        }),
      });

      setDubProgress(40);
      setDubStatusText('Synthesizing studio Urdu voiceovers with Gemini TTS...');

      const data = await res.json();
      const adapted = data.adaptedSegments || arc.segments;

      // Step 2: Batch synthesize with Gemini TTS
      const batchResults = await batchSynthesizeArc(adapted, selectedVoice);
      const resultMap = new Map(batchResults.map((r) => [r.id, r.audioUrl]));

      const updatedWithAudio: RecapSegment[] = adapted.map((seg: any) => ({
        ...seg,
        audioUrl: resultMap.get(seg.id) || `/audio-cache/${seg.id}.wav`,
        audioGenerated: true,
      }));

      onUpdateArcSegments(updatedWithAudio);
      setDubProgress(90);
      setDubStatusText('Urdu narration audio generated & cached! Synchronizing player...');
      await new Promise((r) => setTimeout(r, 600));

      setDubProgress(100);
      setDubStatusText('Urdu Dub Complete! Ready to play and download.');
      setTimeout(() => {
        setIsDubbing(false);
        setIsPlaying(true);
      }, 500);
    } catch (err) {
      console.error(err);
      setIsDubbing(false);
    }
  };

  // Download complete master continuous WAV audio track for the episode
  const handleDownloadMasterAudio = async () => {
    try {
      setIsStitchingAudio(true);
      const totalSecs = (arc.durationMinutes || 25) * 60;
      const res = await stitchMasterAudio(arc.segments, totalSecs, arc.id);
      if (res.masterAudioUrl) {
        const audioBlob = await fetch(res.masterAudioUrl).then((r) => r.blob());
        downloadFile(audioBlob, `${arc.title.replace(/[^a-zA-Z0-9]/g, '_')}_Master_Urdu_Dub.wav`, 'audio/wav');
      }
    } catch (err: any) {
      console.error('Audio stitch error:', err);
      setStudioError('Could not stitch master audio track: ' + (err?.message || 'Please check segments.'));
    } finally {
      setIsStitchingAudio(false);
    }
  };

  // Render & Export Full Video (.webm / .mp4) with MediaRecorder INCLUDING SYNCHRONIZED AUDIO TRACK
  const handleExportFullDubbedVideo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setIsExportingVideo(true);
      setExportProgress(10);
      recordedChunksRef.current = [];

      // Capture stream from canvas
      const canvasStream = canvas.captureStream(30);
      let combinedStream = canvasStream;

      // Connect Web Audio into MediaRecorder so the recorded video contains the Urdu voiceover!
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const destNode = ctx.createMediaStreamDestination();

        // Connect BGM if active
        if (bgmGainRef.current) {
          bgmGainRef.current.connect(destNode);
        }

        // Connect Urdu audio element into destination
        if (dubAudioRef.current && !(dubAudioRef.current as any).__mediaStreamSource) {
          try {
            const source = ctx.createMediaElementSource(dubAudioRef.current);
            source.connect(ctx.destination);
            source.connect(destNode);
            (dubAudioRef.current as any).__mediaStreamSource = source;
          } catch (e) {
            console.warn('Audio node connection notice:', e);
          }
        }

        const audioTracks = destNode.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioTracks,
          ]);
        }
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(combinedStream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setGeneratedVideoBlobUrl(url);
        setIsExportingVideo(false);
        setExportProgress(100);

        // Auto trigger download
        downloadFile(blob, `${arc.title.replace(/[^a-zA-Z0-9]/g, '_')}_UrduDub.webm`, 'video/webm');
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      // Start playback from 0
      setCurrentTime(0);
      setIsPlaying(true);

      // Record full scene or arc duration
      const recordDurationMs = totalArcSeconds * 1000;
      const startTime = Date.now();

      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(95, Math.round((elapsed / recordDurationMs) * 100));
        setExportProgress(pct);

        if (elapsed >= recordDurationMs) {
          clearInterval(progressInterval);
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }
      }, 500);
    } catch (err) {
      console.error('Export video error:', err);
      setIsExportingVideo(false);
    }
  };

  // Studio Quality Dubbing using server-side FFmpeg:
  // Combines Original Video Visuals + Spoken Urdu Narration Audio into full-length MP4
  const handleStudioDubVideo = async () => {
    try {
      setIsDubbingStudio(true);
      setDubProgress(15);
      setDubStatusText('Ensuring spoken Urdu narration audio for all scenes...');

      // Ensure all segments have generated audio
      const missingSegments = arc.segments.filter((s) => !s.audioUrl);
      if (missingSegments.length > 0) {
        setDubStatusText('Synthesizing studio Urdu voiceovers with Gemini TTS...');
        const batchResults = await batchSynthesizeArc(arc.segments, selectedVoice);
        const map = new Map(batchResults.map((r) => [r.id, r.audioUrl]));
        const updated = arc.segments.map((s) => ({
          ...s,
          audioUrl: map.get(s.id) || `/audio-cache/${s.id}.wav`,
          audioGenerated: true,
        }));
        onUpdateArcSegments(updated);
      }

      setDubProgress(50);
      setDubStatusText('Muxing original manhwa video with studio Urdu audio via FFmpeg...');

      const totalSecs = Math.max(105, arc.segments[arc.segments.length - 1]?.end || 105);

      const result = await dubVideoStudio({
        videoSource: videoSourceType === 'uploaded' ? 'uploaded' : 'sample',
        uploadedVideoUrl: uploadedVideoUrl || undefined,
        arcId: arc.id,
        segments: arc.segments,
        totalDurationSeconds: totalSecs,
      });

      setDubProgress(90);
      setDubStatusText('Finalizing studio MP4 output...');
      await new Promise((r) => setTimeout(r, 400));

      setDubProgress(100);
      setDubStatusText('Studio Dubbed Video Ready! Original Video + Urdu Audio combined.');
      setStudioDubbedVideoUrl(result.dubbedVideoUrl);
      setIsDubbingStudio(false);

      // Auto trigger download of the dubbed MP4
      const link = document.createElement('a');
      link.href = result.dubbedVideoUrl;
      link.download = `${arc.title.replace(/[^a-zA-Z0-9]/g, '_')}_OriginalVideo_UrduDub.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Studio dubbing error:', err);
      setStudioError(`Studio dubbing notice: ${err.message || 'Failed to merge video and audio'}`);
      setIsDubbingStudio(false);
    }
  };

  const handleCustomVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setDubStatusText(`Uploading ${file.name} to studio server...`);
        const res = await uploadOriginalVideo(file);
        setUploadedVideoUrl(res.videoUrl);
        setVideoSourceType('uploaded');
        setDubStatusText(`Uploaded "${file.name}"! Ready to dub.`);
        if (onUpdateProject && project) {
          onUpdateProject({
            ...project,
            uploadedVideoUrl: res.videoUrl,
            uploadedVideoFilename: res.filename,
          });
        }
      } catch (err) {
        console.warn('Fallback to local object URL:', err);
        const url = URL.createObjectURL(file);
        setUploadedVideoUrl(url);
        setVideoSourceType('uploaded');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden Audio Element playing Urdu narration */}
      <audio ref={dubAudioRef} preload="auto" />

      {/* Dismissible Error / Notice Banner */}
      {studioError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{studioError}</span>
          </div>
          <button
            onClick={() => setStudioError(null)}
            className="text-rose-400 hover:text-white font-bold ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Headline Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs uppercase font-extrabold text-slate-950 bg-amber-400 px-2.5 py-0.5 rounded shadow-sm">
                AI Manhwa Video Dubber
              </span>
              <span className="text-xs font-urdu text-amber-300 font-semibold pr-2">
                مانہوا اردو ویڈیو ڈبر
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
              Turn English Manhwa Recap Videos into Spoken Urdu Dubbed Videos
            </h1>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Merges the original manhwa recap video with high-fidelity conversational spoken Urdu voiceovers using FFmpeg and Gemini TTS. Produces full-length studio quality dubbed video files (.MP4) ready for YouTube upload.
            </p>
          </div>

          {/* Big Action: Studio Dub Video (Original Video + Urdu Audio) */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleStudioDubVideo}
              disabled={isDubbingStudio}
              className="px-5 py-3 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 disabled:opacity-50 whitespace-nowrap cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              title="Combines the original manhwa video with studio Urdu voiceovers using FFmpeg into a full-length MP4"
            >
              {isDubbingStudio ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Video className="w-4 h-4 text-slate-950 fill-slate-950" />
              )}
              <span>{isDubbingStudio ? dubStatusText : '🎬 Dub Original Video with Urdu (.MP4)'}</span>
            </button>

            <button
              onClick={handleAutoDubFullArc}
              disabled={isDubbing}
              className="px-4 py-3 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl shadow transition-all flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
              title="Ensure all narration lines are scripted and synthesized in Urdu"
            >
              {isDubbing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Wand2 className="w-4 h-4 text-amber-400" />
              )}
              <span>{isDubbing ? 'Synthesizing...' : '1-Click Audio Dub (TTS)'}</span>
            </button>
          </div>
        </div>

        {/* Pipeline Progress Bar */}
        {isDubbing && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-amber-400 font-mono-numbers">
              <span>{dubStatusText}</span>
              <span>{dubProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                style={{ width: `${dubProgress}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* Intake & Audio Replacement Status Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* YouTube Reference Link Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
              <Youtube className="w-4 h-4 text-rose-500" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">YouTube Reference</span>
              <span className="text-slate-200 font-medium truncate block max-w-[200px]" title={project?.sourceVideoUrl || 'No YouTube link'}>
                {project?.sourceVideoUrl || 'YouTube reference link'}
              </span>
            </div>
          </div>
          {project?.sourceVideoUrl && (
            <a
              href={project.sourceVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-amber-400 hover:underline flex-shrink-0 ml-2"
            >
              Open Link
            </a>
          )}
        </div>

        {/* Source Media Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Film className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Original Source Media</span>
              <span className="text-slate-200 font-medium truncate block max-w-[200px]" title={uploadedVideoUrl ? (project?.uploadedVideoFilename || 'Uploaded Video') : 'Sample Manhwa Original Video'}>
                {uploadedVideoUrl ? (project?.uploadedVideoFilename || 'Uploaded Video') : 'Sample Manhwa Original Video'}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex-shrink-0">
            {videoSourceType === 'uploaded' && uploadedVideoUrl ? 'Custom Video' : 'Built-in 105s'}
          </span>
        </div>

        {/* Audio Replacement Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5 text-xs">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Volume2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">Audio Replacement</span>
            <span className="text-slate-200 font-medium text-[11px] leading-tight block">
              100% Spoken Urdu Narration (Original English audio completely replaced)
            </span>
          </div>
        </div>
      </div>

      {/* Main Studio View: Video on Left, Arc Controls & Settings on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: The Dubbed Video Player (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
          {/* Top Video Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Urdu Dub Active</span>
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-amber-400 font-mono-numbers">
                {formatTimeDisplay(currentTime)} / {formatTimeDisplay(totalArcSeconds)}
              </span>
            </div>

            {/* Video Source Switcher Tabs */}
            <div className="flex items-center gap-1.5 text-slate-400">
              <button
                onClick={() => setVideoSourceType('sample_original')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  videoSourceType === 'sample_original'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
                title="Use built-in high-definition original manhwa recap video (Solo Leveling 105s)"
              >
                Original Video
              </button>

              <label className={`text-[11px] transition-colors cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded ${
                videoSourceType === 'uploaded'
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}>
                <Upload className="w-3 h-3 text-amber-400" />
                <span>{uploadedVideoUrl ? 'Replace Video' : 'Upload Video'}</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleCustomVideoUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setVideoSourceType('animated_canvas')}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                  videoSourceType === 'animated_canvas'
                    ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
                title="View animated comic panels with Ken Burns zoom"
              >
                Panels
              </button>
            </div>
          </div>

          {/* Video Screen */}
          <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
            {videoSourceType === 'animated_canvas' ? (
              // Animated Manhwa Recap Canvas
              <canvas
                ref={canvasRef}
                width={854}
                height={480}
                className="w-full h-full object-cover"
              />
            ) : (
              // Original Manhwa Video (Built-in Sample or User Upload)
              <div className="relative w-full h-full">
                <video
                  ref={customVideoRef}
                  src={videoSourceType === 'uploaded' && uploadedVideoUrl ? uploadedVideoUrl : '/videos/sample-manhwa-original.mp4'}
                  muted={true}
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Badge showing English audio is completely replaced by Urdu */}
                <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md border border-amber-500/40 rounded-lg px-2.5 py-1 text-[11px] text-amber-300 font-medium z-10 flex items-center gap-1.5 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{videoSourceType === 'uploaded' ? 'Uploaded Original Video' : 'Original Video'} · 100% Spoken Urdu Narration (English Audio Completely Replaced)</span>
                </div>

                {/* On-Screen Nastaliq Urdu Subtitles Card */}
                {activeSegment && (
                  <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
                    <div className="max-w-xl mx-auto bg-slate-950/90 backdrop-blur-md border border-amber-500/40 rounded-xl px-4 py-2.5 shadow-2xl text-center">
                      <div className="text-lg md:text-xl font-bold font-urdu text-amber-300 leading-relaxed dir-rtl mb-0.5">
                        {activeSegment.urduText}
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        {activeSegment.romanUrduText}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scrubber */}
          <div className="px-4 pt-3 pb-2 bg-slate-950 border-t border-slate-800">
            <div className="relative w-full h-2 bg-slate-800 rounded-full cursor-pointer">
              <div
                style={{ width: `${(currentTime / totalArcSeconds) * 100}%` }}
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
              />
              <input
                type="range"
                min={0}
                max={totalArcSeconds}
                step={0.5}
                value={currentTime}
                onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-full z-10"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono-numbers text-slate-400 mt-1">
              <span>{formatTimeDisplay(currentTime)}</span>
              <span className="text-amber-400">
                {activeSegment ? `Scene: ${activeSegment.toneDirective || 'Urdu Narration'}` : 'Timeline'}
              </span>
              <span>{formatTimeDisplay(totalArcSeconds)}</span>
            </div>
          </div>

          {/* Transport & Audio Mixer Controls */}
          <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md flex items-center gap-1.5"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-slate-950" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                    <span>Play Dubbed Video</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setCurrentTime(Math.min(totalArcSeconds, currentTime + 5))}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 ml-1">
                {[1.0, 1.25].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-0.5 text-[11px] font-mono-numbers rounded ${
                      playbackSpeed === speed
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Volume controls */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300">Urdu Voice:</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={dubVolume}
                  onChange={(e) => setDubVolume(parseFloat(e.target.value))}
                  className="w-16 accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <span className="text-[10px] text-slate-400 font-mono-numbers w-6">
                  {Math.round(dubVolume * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-slate-400">BGM:</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgmVolume}
                  onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                  className="w-16 accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Studio Dubbed Video Player Preview & Download Banner */}
          {studioDubbedVideoUrl && (
            <div className="p-4 bg-emerald-950/40 border-t border-emerald-500/30 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-300">
                      Studio Dubbed Video Ready (.MP4)
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Original video visuals + synchronized spoken Urdu audio merged via FFmpeg.
                    </p>
                  </div>
                </div>
                <a
                  href={studioDubbedVideoUrl}
                  download={`${arc.title.replace(/[^a-zA-Z0-9]/g, '_')}_OriginalVideo_UrduDub.mp4`}
                  className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Dubbed Video (.MP4)</span>
                </a>
              </div>
              <div className="rounded-xl overflow-hidden border border-emerald-500/30 bg-black">
                <video
                  src={studioDubbedVideoUrl}
                  controls
                  className="w-full max-h-56 object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Voiceover Director & Export Station (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Download & Export Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-amber-400" />
              <span>Download & Export Dubbed Media</span>
            </h2>

            <div className="space-y-2.5">
              {/* Button 1: Studio Quality MP4 via FFmpeg */}
              <button
                onClick={handleStudioDubVideo}
                disabled={isDubbingStudio}
                className="w-full p-3.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-amber-500/10 hover:from-amber-500/30 hover:to-amber-500/20 text-left flex items-center justify-between group transition-all cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow">
                    {isDubbingStudio ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white group-hover:text-amber-300">
                      {isDubbingStudio ? 'Muxing Studio Video...' : 'Download Studio Dubbed Video (.MP4)'}
                    </h3>
                    <p className="text-[10px] text-slate-300">
                      Original video visuals + studio spoken Urdu audio merged via FFmpeg (Full Duration)
                    </p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-amber-400 group-hover:translate-y-0.5 transition-transform" />
              </button>

              {/* Button 2: Download Dubbed Audio Track */}
              <button
                onClick={handleDownloadMasterAudio}
                disabled={isStitchingAudio}
                className="w-full p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-800 text-left flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-3">
                  <FileAudio className="w-4 h-4 text-rose-400" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 group-hover:text-amber-300">
                      {isStitchingAudio ? 'Stitching Audio Track...' : 'Download Urdu Voiceover Track (.WAV)'}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Master continuous audio track for video editors (CapCut / Premiere)
                    </p>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Button 3: Download Subtitles (.SRT) */}
              <button
                onClick={() => {
                  const srt = generateSrtContent(arc.segments, 'dual');
                  downloadFile(srt, `${arc.title.replace(/[^a-zA-Z0-9]/g, '_')}_Subtitles.srt`, 'application/x-subrip');
                }}
                className="w-full p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-800 text-left flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 group-hover:text-amber-300">
                      Download Timed Subtitles (.SRT)
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Nastaliq and Roman Urdu subtitles with exact video sync
                    </p>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Voice Narrator Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-400" />
              <span>Urdu Narrator Persona</span>
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {GEMINI_VOICES.map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => onSelectVoice(v.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-slate-950/60 hover:bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-slate-200'}`}>
                        {v.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-1">{v.character}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Episodic Story Arc Picker (for 10+ Hour Marathons) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>10h+ Marathon Arcs ({allArcs.length} Episodes)</span>
              </h2>
              <span className="text-xs text-slate-400 font-mono-numbers">
                Arc {arc.arcNumber} Active
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
              {allArcs.map((a) => {
                const isCur = a.id === arc.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => onSelectArc(a.id)}
                    className={`w-full px-3 py-2 rounded-xl text-left border flex items-center justify-between transition-all ${
                      isCur
                        ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                        : 'bg-slate-950/60 hover:bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="truncate max-w-[240px]">
                      <div className="text-xs font-semibold truncate">{a.title}</div>
                      <div className="text-[10px] text-slate-400 font-urdu truncate mt-0.5">{a.titleUrdu}</div>
                    </div>
                    <span className="text-[10px] font-mono-numbers text-slate-400 shrink-0">
                      {a.durationMinutes}m
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

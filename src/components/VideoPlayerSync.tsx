import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Type,
  Sparkles,
  Layers,
  Upload,
  Download,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { StoryArc, RecapSegment } from '../types';
import { formatTimeDisplay, synthesizeGeminiTTS } from '../utils/audioSynthesizer';

interface VideoPlayerSyncProps {
  arc: StoryArc;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onTogglePlay: () => void;
  activeSegment: RecapSegment | null;
  youtubeId?: string;
  onSegmentAudioLoaded?: (segmentId: string, audioUrl: string) => void;
}

export const VideoPlayerSync: React.FC<VideoPlayerSyncProps> = ({
  arc,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onTogglePlay,
  activeSegment,
  youtubeId = '4zgCQqFhDxM',
  onSegmentAudioLoaded,
}) => {
  const [dubVolume, setDubVolume] = useState(1.0);
  const [bgmVolume, setBgmVolume] = useState(0.2);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showTeleprompter, setShowTeleprompter] = useState(true);
  const [viewMode, setViewMode] = useState<'original_video' | 'manhwa_canvas' | 'youtube_dub'>('original_video');
  const [uploadedPanels, setUploadedPanels] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dubAudioRef = useRef<HTMLAudioElement | null>(null);
  const sampleVideoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const lastPlayedSegmentIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const bgmOscRef = useRef<OscillatorNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);

  const totalArcSeconds = Math.max(105, arc.segments[arc.segments.length - 1]?.end || 105);

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
        osc.frequency.setValueAtTime(55, ctx.currentTime); // Low A1 note

        // Filter for dark ambient warmth
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, ctx.currentTime);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        osc.start();

        bgmOscRef.current = osc;
        bgmGainRef.current = gain;
      }
    } catch (e) {
      console.warn('Web Audio init error:', e);
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  // Control BGM volume with automatic speech ducking
  useEffect(() => {
    if (!bgmGainRef.current || !audioContextRef.current) return;
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended' && isPlaying) {
      ctx.resume().catch(() => {});
    }

    if (isPlaying) {
      // Duck BGM when narrator is actively speaking
      const targetGain = activeSegment ? bgmVolume * 0.4 : bgmVolume;
      bgmGainRef.current.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.2);
    } else {
      bgmGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    }
  }, [isPlaying, activeSegment, bgmVolume]);

  // Synchronized Urdu Voiceover Playback
  useEffect(() => {
    if (!isPlaying) {
      if (dubAudioRef.current) {
        dubAudioRef.current.pause();
      }
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
      }
      return;
    }

    // When isPlaying is true, ensure YouTube player starts in sync and MUTED
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        '*'
      );
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'mute', args: [] }),
        '*'
      );
    }

    if (!activeSegment) {
      if (dubAudioRef.current) {
        dubAudioRef.current.pause();
      }
      return;
    }

    // If segment changed while playing, play the new segment's audio!
    if (activeSegment.id !== lastPlayedSegmentIdRef.current) {
      lastPlayedSegmentIdRef.current = activeSegment.id;

      const playUrduAudio = async () => {
        let audioSrc = activeSegment.audioUrl || `/audio-cache/${activeSegment.id}.wav`;

        if (!activeSegment.audioUrl) {
          try {
            audioSrc = await synthesizeGeminiTTS(activeSegment.id, activeSegment.urduText);
            if (onSegmentAudioLoaded) {
              onSegmentAudioLoaded(activeSegment.id, audioSrc);
            }
          } catch (err) {
            console.warn('Urdu TTS load failed:', err);
          }
        }

        if (dubAudioRef.current && audioSrc) {
          dubAudioRef.current.src = audioSrc;
          dubAudioRef.current.playbackRate = playbackSpeed;
          dubAudioRef.current.volume = dubVolume;
          const offset = Math.max(0, currentTime - activeSegment.start);
          if (offset > 0.5) {
            dubAudioRef.current.currentTime = offset;
          }
          dubAudioRef.current.play().catch((err) => {
            console.warn('Audio play prevented:', err);
          });
        }
      };

      playUrduAudio();
    } else {
      // Same segment is active, but playback was resumed
      if (dubAudioRef.current && dubAudioRef.current.paused) {
        dubAudioRef.current.playbackRate = playbackSpeed;
        dubAudioRef.current.volume = dubVolume;
        dubAudioRef.current.play().catch(() => {});
      }
    }
  }, [isPlaying, activeSegment, playbackSpeed, dubVolume, currentTime, onSegmentAudioLoaded]);

  // Canvas Manhwa Animation Engine (Ken Burns Effect + Particles + Dynamic Action Text)
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

      // Determine active scene based on currentTime
      const segIndex = activeSegment
        ? arc.segments.findIndex((s) => s.id === activeSegment.id)
        : Math.floor((currentTime / 15) % 6);

      // Ken Burns scaling & pan calculation
      const progressInSegment = activeSegment
        ? (currentTime - activeSegment.start) / Math.max(1, activeSegment.end - activeSegment.start)
        : (currentTime % 15) / 15;

      const scale = 1.0 + Math.min(0.2, progressInSegment * 0.15);
      const panX = (Math.sin(tick * 0.01) * 30);
      const panY = (Math.cos(tick * 0.01) * 20);

      ctx.save();
      ctx.translate(width / 2 + panX, height / 2 + panY);
      ctx.scale(scale, scale);
      ctx.translate(-width / 2, -height / 2);

      // Draw Cinematic Manhwa Scene Background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      if (segIndex === 0) {
        // Scene 1: Dark Dungeon Abyss & Betrayal
        gradient.addColorStop(0, '#020617');
        gradient.addColorStop(0.5, '#0F172A');
        gradient.addColorStop(1, '#1E1B4B');
      } else if (segIndex === 1) {
        // Scene 2: Red Demon Wolves Ambush
        gradient.addColorStop(0, '#450A0A');
        gradient.addColorStop(0.5, '#1C1917');
        gradient.addColorStop(1, '#0C0A09');
      } else if (segIndex === 2) {
        // Scene 3: Golden System Screen Window
        gradient.addColorStop(0, '#022C22');
        gradient.addColorStop(0.5, '#0F172A');
        gradient.addColorStop(1, '#78350F');
      } else if (segIndex === 3) {
        // Scene 4: Necromancer Purple Sovereign Awakening
        gradient.addColorStop(0, '#2E1065');
        gradient.addColorStop(0.5, '#3B0764');
        gradient.addColorStop(1, '#090514');
      } else {
        // Scene 5+: Shadow Monarch Empire Rising
        gradient.addColorStop(0, '#09090B');
        gradient.addColorStop(0.5, '#1E1B4B');
        gradient.addColorStop(1, '#312E81');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(-100, -100, width + 200, height + 200);

      // Visual Manhwa Composition (Silhouettes, energy auras, speed lines)
      // 1. Radial Energy Glow
      const auraGlow = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, 280);
      auraGlow.addColorStop(0, segIndex >= 3 ? 'rgba(168, 85, 247, 0.45)' : 'rgba(245, 158, 11, 0.3)');
      auraGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGlow;
      ctx.fillRect(0, 0, width, height);

      // 2. Action Speed Lines (Manhwa comic aesthetic)
      ctx.strokeStyle = segIndex >= 3 ? 'rgba(192, 132, 252, 0.15)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2 + (tick * 0.02);
        const r1 = 120 + Math.sin(tick * 0.05 + i) * 30;
        const r2 = 450;
        ctx.beginPath();
        ctx.moveTo(width / 2 + Math.cos(angle) * r1, height / 2 + Math.sin(angle) * r1);
        ctx.lineTo(width / 2 + Math.cos(angle) * r2, height / 2 + Math.sin(angle) * r2);
        ctx.stroke();
      }

      // 3. Central Hunter Silhouette with Glowing Eyes
      ctx.fillStyle = '#09090B';
      // Head & body silhouette
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2 - 20, 48, 62, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(width / 2 - 90, height / 2 + 180);
      ctx.lineTo(width / 2 - 40, height / 2 + 40);
      ctx.lineTo(width / 2 + 40, height / 2 + 40);
      ctx.lineTo(width / 2 + 90, height / 2 + 180);
      ctx.closePath();
      ctx.fill();

      // Glowing Eyes (Iconic Solo Leveling / Manhwa Monarch trope)
      const eyeColor = segIndex >= 3 ? '#C084FC' : '#FBBF24';
      ctx.fillStyle = eyeColor;
      ctx.shadowColor = eyeColor;
      ctx.shadowBlur = 18;

      // Left eye & glow trail
      ctx.beginPath();
      ctx.arc(width / 2 - 16, height / 2 - 25, 4, 0, Math.PI * 2);
      ctx.fill();
      // Right eye
      ctx.beginPath();
      ctx.arc(width / 2 + 16, height / 2 - 25, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0; // reset shadow
      ctx.restore();

      // Top Comic Action Watermark (Overlay)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`MANHWA RECAP CH. ${activeSegment ? '1-18' : '1'}`, 24, 32);

      // Floating System Notification Window if in Scene 3
      if (segIndex === 2 || (activeSegment && activeSegment.englishText.includes('notification'))) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(width / 2 - 160, 48, 320, 64, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FBBF24';
        ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('[SYSTEM QUEST INITIATED]', width / 2 - 140, 72);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Claim the Undead Sovereign Legacy? [Y/N]', width / 2 - 140, 92);
      }

      // Live On-Screen Teleprompter / Subtitles
      if (showTeleprompter && activeSegment) {
        // Draw subtitle background plate
        ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.lineWidth = 1.5;
        const subBoxW = Math.min(width - 48, 700);
        const subBoxH = 88;
        const subBoxX = (width - subBoxW) / 2;
        const subBoxY = height - subBoxH - 24;

        ctx.beginPath();
        ctx.roundRect(subBoxX, subBoxY, subBoxW, subBoxH, 12);
        ctx.fill();
        ctx.stroke();

        // Urdu Script (Primary)
        ctx.fillStyle = '#FDE047'; // Vivid yellow-gold
        ctx.font = 'bold 22px "Noto Nastaliq Urdu", Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(activeSegment.urduText, width / 2, subBoxY + 36);

        // Roman Urdu (Sub)
        ctx.fillStyle = '#E2E8F0';
        ctx.font = '500 12px "DM Sans", sans-serif';
        ctx.fillText(activeSegment.romanUrduText, width / 2, subBoxY + 66);
      }

      if (isPlaying) {
        tick++;
      }
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, currentTime, activeSegment, showTeleprompter, arc.segments]);

  // Video Recording (.webm / .mp4 capture) WITH SYNCHRONIZED URDU AUDIO
  const handleStartRecord = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const canvasStream = canvas.captureStream(30);
      let combinedStream = canvasStream;

      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const dest = ctx.createMediaStreamDestination();
        if (bgmGainRef.current) {
          bgmGainRef.current.connect(dest);
        }
        if (dubAudioRef.current && !(dubAudioRef.current as any).__mediaStreamSource) {
          try {
            const src = ctx.createMediaElementSource(dubAudioRef.current);
            src.connect(ctx.destination);
            src.connect(dest);
            (dubAudioRef.current as any).__mediaStreamSource = src;
          } catch (e) {
            console.warn('Audio node connection:', e);
          }
        }
        const audioTracks = dest.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioTracks,
          ]);
        }
      }

      recordedChunksRef.current = [];
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
        setRecordedVideoUrl(url);
        setIsRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      if (!isPlaying) onTogglePlay();
    } catch (err) {
      console.warn('Recording error:', err);
    }
  };

  const handleStopRecord = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    onTimeUpdate(newTime);
    if (sampleVideoRef.current) {
      sampleVideoRef.current.currentTime = newTime;
    }
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [newTime, true] }),
        '*'
      );
    }
  };

  const handleSkip = (seconds: number) => {
    const newTime = Math.min(Math.max(0, currentTime + seconds), totalArcSeconds);
    onTimeUpdate(newTime);
    if (sampleVideoRef.current) {
      sampleVideoRef.current.currentTime = newTime;
    }
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [newTime, true] }),
        '*'
      );
    }
  };

  // Synchronize sample original video element
  useEffect(() => {
    const vid = sampleVideoRef.current;
    if (!vid) return;
    if (isPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const vid = sampleVideoRef.current;
    if (!vid) return;
    if (Math.abs(vid.currentTime - currentTime) > 0.8) {
      vid.currentTime = currentTime;
    }
  }, [currentTime]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Hidden Audio Element dedicated to playing Urdu Voiceover */}
      <audio
        ref={dubAudioRef}
        onEnded={() => {
          // Finished this segment line
        }}
        onError={(e) => {
          console.warn('Urdu dub audio element notice:', e);
        }}
        preload="auto"
      />

      {/* Top Header / Status Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Urdu Voiceover Synced</span>
          </div>
          <span className="text-slate-500">·</span>
          <span className="text-amber-400 font-mono-numbers">
            {formatTimeDisplay(currentTime)} / {formatTimeDisplay(totalArcSeconds)}
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            onClick={() => setViewMode('original_video')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              viewMode === 'original_video'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
            title="Play high-definition original manhwa video with synchronized Urdu dubbing"
          >
            Original Video
          </button>

          <button
            onClick={() => setViewMode('manhwa_canvas')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              viewMode === 'manhwa_canvas'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
            title="View animated manhwa panels with speed lines and Ken Burns zoom"
          >
            Panels
          </button>

          <button
            onClick={() => setViewMode('youtube_dub')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              viewMode === 'youtube_dub'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
            title="Sync with muted YouTube video"
          >
            YouTube
          </button>
        </div>
      </div>

      {/* Main Video Screen Container */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        {viewMode === 'original_video' ? (
          // Original Manhwa Video Player with Muted Audio & Synced Urdu Voiceover
          <div className="relative w-full h-full">
            <video
              ref={sampleVideoRef}
              src="/videos/sample-manhwa-original.mp4"
              muted={true}
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md border border-amber-500/30 rounded-lg px-2.5 py-1 text-[11px] text-amber-300 font-medium z-10 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Original Video Active · Spoken Urdu Dub Synced</span>
            </div>
            {showTeleprompter && activeSegment && (
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
        ) : viewMode === 'youtube_dub' && youtubeId ? (
          // Embedded YouTube player MUTED (so original English is silenced, Urdu plays in sync!)
          <div className="relative w-full h-full">
            <iframe
              ref={iframeRef}
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&mute=1&controls=0&rel=0&modestbranding=1`}
              title={arc.title}
              className="w-full h-full border-0 pointer-events-none"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                if (iframeRef.current?.contentWindow) {
                  iframeRef.current.contentWindow.postMessage(
                    JSON.stringify({ event: 'command', func: 'mute', args: [] }),
                    '*'
                  );
                }
              }}
            />
            {/* Overlay badge letting user know YouTube English audio is muted in favor of Urdu */}
            <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-amber-500/30 rounded-lg px-2.5 py-1 text-[11px] text-amber-300 font-medium">
              English Audio Muted · Dubbed Urdu Active
            </div>

            {/* Urdu Subtitle Teleprompter Overlay */}
            {showTeleprompter && activeSegment && (
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
        ) : (
          // High-Octane Manhwa Animated Canvas with Ken Burns, Lighting, and Glowing Eyes
          <div className="relative w-full h-full flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={854}
              height={480}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Timeline Scrubber */}
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
            onChange={handleSeek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full z-10"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono-numbers text-slate-400 mt-1">
          <span>{formatTimeDisplay(currentTime)}</span>
          <span className="text-amber-400 font-semibold">
            {activeSegment ? `Scene: ${activeSegment.toneDirective || 'Narration'}` : 'Timeline'}
          </span>
          <span>{formatTimeDisplay(totalArcSeconds)}</span>
        </div>
      </div>

      {/* Playback Controls & Dual Audio Mixer */}
      <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
        {/* Play/Pause/Skip */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSkip(-5)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Rewind 5s"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md shadow-amber-500/20 transition-transform active:scale-95 flex items-center gap-1.5"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-slate-950" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                <span>Play in Urdu</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleSkip(5)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Forward 5s"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Speed Selector */}
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

        {/* Dual Audio Mixer Sliders */}
        <div className="flex items-center gap-4 text-xs">
          {/* Urdu Voiceover Slider */}
          <div className="flex items-center gap-2" title="Urdu Narration Voice Volume">
            <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-slate-200 font-medium">Urdu Voice:</span>
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

          {/* Cinematic BGM Volume Slider */}
          <div className="flex items-center gap-2" title="Cinematic Background Music (Auto-ducked during dialogue)">
            <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
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
            <span className="text-[10px] text-slate-400 font-mono-numbers w-6">
              {Math.round(bgmVolume * 100)}%
            </span>
          </div>

          {/* Video Recorder */}
          {viewMode === 'manhwa_canvas' && (
            <div className="flex items-center gap-1.5 ml-2">
              {!isRecording ? (
                <button
                  onClick={handleStartRecord}
                  className="px-2.5 py-1 text-[11px] font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors flex items-center gap-1"
                  title="Capture animated canvas to video file"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>Record Video</span>
                </button>
              ) : (
                <button
                  onClick={handleStopRecord}
                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1"
                >
                  <span>Stop & Save</span>
                </button>
              )}

              {recordedVideoUrl && (
                <a
                  href={recordedVideoUrl}
                  download="manhwa_recap_urdu.webm"
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Video</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

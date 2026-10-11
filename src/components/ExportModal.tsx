import React, { useState } from 'react';
import { X, Download, FileAudio, FileText, Check, Youtube, FolderArchive, Video, RefreshCw, AlertCircle } from 'lucide-react';
import { StoryArc, MarathonProject } from '../types';
import { generateSrtContent, downloadFile, generateYouTubeChapters, dubVideoStudio } from '../utils/audioSynthesizer';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  arc: StoryArc;
  project: MarathonProject;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  arc,
  project,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isStitching, setIsStitching] = useState(false);
  const [isDubbingVideo, setIsDubbingVideo] = useState(false);

  if (!isOpen) return null;

  const triggerSuccess = (msg: string) => {
    setDownloadSuccess(msg);
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

  const triggerError = (msg: string) => {
    setDownloadError(msg);
    setTimeout(() => setDownloadError(null), 5000);
  };

  const handleDownloadSrt = (mode: 'dual' | 'urdu' | 'roman') => {
    const srt = generateSrtContent(arc.segments, mode);
    downloadFile(srt, `${arc.title.replace(/[^a-zA-Z0-9]/g, '_')}_${mode}.srt`, 'application/x-subrip');
    triggerSuccess(`Downloaded ${mode} .SRT subtitles!`);
  };

  const handleDownloadYouTubeMetadata = () => {
    const chapters = generateYouTubeChapters(project.arcs);
    const text = `TITLE (Urdu/English):
${project.titleUrdu} | ${project.title}

DESCRIPTION:
Manhwa Full Marathon Hindi/Urdu Recap!
Watch the entire story in simple, conversational Urdu.

${chapters}

#ManhwaRecapUrdu #ManhwaInHindi #UrduRecap #AnimeRecap
`;
    downloadFile(text, `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_YouTube_Metadata.txt`);
    triggerSuccess('Downloaded YouTube Description & Chapter Timestamps!');
  };

  const handleDownloadScriptJson = () => {
    const data = JSON.stringify(project, null, 2);
    downloadFile(data, `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_Project_Data.json`, 'application/json');
    triggerSuccess('Downloaded full studio project JSON!');
  };

  const handleDownloadAudioTrack = async () => {
    try {
      setIsStitching(true);
      triggerSuccess('Stitching full continuous master audio track for the episode...');
      
      const { stitchMasterAudio } = await import('../utils/audioSynthesizer');
      const totalSecs = (arc.durationMinutes || 25) * 60;
      const res = await stitchMasterAudio(arc.segments, totalSecs, arc.id);

      if (res.masterAudioUrl) {
        const audioBlob = await fetch(res.masterAudioUrl).then((r) => r.blob());
        downloadFile(audioBlob, `${arc.title.replace(/[^a-zA-Z0-9]/g, '_')}_Master_Urdu_Dub.wav`, 'audio/wav');
        triggerSuccess(`Downloaded Complete Master Audio Track (${Math.round(res.durationSeconds / 60)} min WAV)!`);
      }
    } catch (err: any) {
      console.error(err);
      triggerError('Could not stitch master audio: ' + (err?.message || 'Please ensure segments are dubbed.'));
    } finally {
      setIsStitching(false);
    }
  };

  const handleDownloadStudioVideo = async () => {
    try {
      setIsDubbingVideo(true);
      triggerSuccess('Muxing original manhwa video with spoken Urdu audio via FFmpeg (original English audio completely replaced)...');

      const totalSecs = Math.max(105, arc.segments[arc.segments.length - 1]?.end || 105);
      const res = await dubVideoStudio({
        videoSource: project.uploadedVideoUrl ? 'uploaded' : 'sample',
        uploadedVideoUrl: project.uploadedVideoUrl || undefined,
        arcId: arc.id,
        segments: arc.segments,
        totalDurationSeconds: totalSecs,
      });

      if (res.dubbedVideoUrl) {
        const link = document.createElement('a');
        link.href = res.dubbedVideoUrl;
        link.download = `${arc.title.replace(/[^a-zA-Z0-9]/g, '_')}_OriginalVideo_UrduDub.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        triggerSuccess(`Downloaded Full Studio Dubbed Video (${Math.round(res.durationSeconds)}s .MP4)!`);
      }
    } catch (err: any) {
      console.error(err);
      triggerError(`Video download notice: ${err.message || 'Failed to merge video and audio'}`);
    } finally {
      setIsDubbingVideo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Export Dubbed Production Package
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ready for YouTube upload or video editing in CapCut and Premiere Pro
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {downloadSuccess && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 flex items-center gap-2 text-xs text-emerald-400">
            <Check className="w-4 h-4" />
            <span>{downloadSuccess}</span>
          </div>
        )}

        {downloadError && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2.5 flex items-center gap-2 text-xs text-rose-400">
            <AlertCircle className="w-4 h-4" />
            <span>{downloadError}</span>
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Group 1: Complete Dubbed Video */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" />
              <span>1. Complete Dubbed Video (.MP4)</span>
            </h3>
            <button
              onClick={handleDownloadStudioVideo}
              disabled={isDubbingVideo}
              className="w-full p-3.5 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-slate-950 hover:from-amber-500/30 hover:to-slate-900 transition-all text-left flex items-center justify-between group shadow-lg shadow-amber-500/10 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow">
                  {isDubbingVideo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-amber-300">
                    {isDubbingVideo ? 'Processing FFmpeg Muxing...' : 'Download Studio Dubbed Video (.MP4)'}
                  </h4>
                  <p className="text-[10px] text-slate-300">
                    Original Video Visuals + Spoken Urdu Narration (Original English audio completely replaced)
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-amber-400 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>

          {/* Subtitles Group */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Timed Subtitle Files (.SRT)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => handleDownloadSrt('dual')}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800 hover:border-amber-500/50 transition-all text-left flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">Dual Subtitles</span>
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-[10px] text-slate-400">Nastaliq + Roman Urdu</span>
              </button>

              <button
                onClick={() => handleDownloadSrt('urdu')}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800 hover:border-amber-500/50 transition-all text-left flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">Urdu Script</span>
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-[10px] text-slate-400">Native Nastaliq only</span>
              </button>

              <button
                onClick={() => handleDownloadSrt('roman')}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800 hover:border-amber-500/50 transition-all text-left flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400">Roman Urdu</span>
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-[10px] text-slate-400">Latin phonetic text</span>
              </button>
            </div>
          </div>

          {/* Audio Tracks Group */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              3. Dubbed Voiceover Audio (.WAV)
            </h3>
            <button
              onClick={handleDownloadAudioTrack}
              className="w-full p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800 hover:border-amber-500/50 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <FileAudio className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-amber-400">
                    Export Arc Voiceover Track ({arc.title.replace(/^Arc \d+:\s*/, '')})
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    High quality 24kHz mono master WAV for video dubbing timeline
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-amber-400" />
            </button>
          </div>

          {/* YouTube Metadata Group */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              4. YouTube Video Metadata & Chapters
            </h3>
            <button
              onClick={handleDownloadYouTubeMetadata}
              className="w-full p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800 hover:border-amber-500/50 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Youtube className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-amber-400">
                    Download YouTube Video Description & Chapter Markers
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Exact YouTube timestamp syntax (00:00 - Introduction) for high retention
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-amber-400" />
            </button>
          </div>

          {/* Full Package JSON */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              5. Studio Project Archive
            </h3>
            <button
              onClick={handleDownloadScriptJson}
              className="w-full p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800 hover:border-amber-500/50 transition-all text-left flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <FolderArchive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-amber-400">
                    Full Studio Project JSON
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    Complete backup with all arcs, timestamps, English scripts & Urdu dubs
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 group-hover:text-amber-400" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

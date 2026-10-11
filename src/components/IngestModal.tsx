import React, { useState } from 'react';
import {
  X,
  Youtube,
  BookOpen,
  Wand2,
  RefreshCw,
  Layers,
  Upload,
  CheckCircle2,
  AlertCircle,
  Film,
  FileCheck,
} from 'lucide-react';
import { PRESET_PROJECTS } from '../data/presetProjects';
import { MarathonProject } from '../types';
import { uploadOriginalVideo } from '../utils/audioSynthesizer';

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
    uploadedVideoUrl?: string;
    uploadedVideoFilename?: string;
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
  const [activeTab, setActiveTab] = useState<'youtube' | 'upload' | 'raw_manhwa' | 'presets'>('youtube');
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=4zgCQqFhDxM');
  const [videoTitle, setVideoTitle] = useState('I Stole The Supreme Necromancer Throne (10-Hour Marathon Recap)');
  const [durationMinutes, setDurationMinutes] = useState(620);
  const [genre, setGenre] = useState('Dark Fantasy / System Monarch');
  const [rawManhwaChapters, setRawManhwaChapters] = useState(
    'Chapter 1: The Discarded Porter\nChapter 2: The S-Rank Betrayal\nChapter 3: The Ancient Sovereign Legacy Awakening\nChapter 4: Shadow Soldiers Rise\nChapter 5: Return to Seoul VIP Auction'
  );

  // Uploaded original video state
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedVideoFilename, setUploadedVideoFilename] = useState<string | null>(null);
  const [uploadOriginalName, setUploadOriginalName] = useState<string | null>(null);
  const [uploadSizeBytes, setUploadSizeBytes] = useState<number | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    try {
      setIsUploadingFile(true);
      setUploadError(null);
      const res = await uploadOriginalVideo(file);
      setUploadedVideoUrl(res.videoUrl);
      setUploadedVideoFilename(res.filename);
      setUploadOriginalName(res.originalname);
      setUploadSizeBytes(res.size);

      // Auto-set clean title if default or empty
      const cleanName = res.originalname.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      if (!videoTitle || videoTitle.includes('I Stole The Supreme')) {
        setVideoTitle(cleanName);
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadError(err.message || 'Failed to upload video file. Ensure it is a valid MP4/WebM/MKV file under 500MB.');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onIngestNew({
      videoUrl: videoUrl || 'https://www.youtube.com/watch?v=4zgCQqFhDxM',
      title: videoTitle,
      totalDurationMinutes: Number(durationMinutes),
      genre,
      rawManhwaChapters: activeTab === 'raw_manhwa' ? rawManhwaChapters : undefined,
      uploadedVideoUrl: uploadedVideoUrl || undefined,
      uploadedVideoFilename: uploadedVideoFilename || undefined,
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
              Dual intake: YouTube reference links or direct authorized video file uploads for studio dubbing
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
        <div className="flex items-center border-b border-slate-800 px-6 pt-2 bg-slate-950/40 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('youtube')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'youtube'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Youtube className="w-4 h-4 text-rose-500" />
            <span>YouTube Link</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'upload'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Upload Original Video</span>
          </button>

          <button
            onClick={() => setActiveTab('raw_manhwa')}
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
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
            className={`px-4 py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
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
              {activeTab === 'youtube' && (
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
                      YouTube reference link provides project intake metadata and chapter timing.
                    </span>
                  </div>

                  {/* Optional pairing with an authorized original video file */}
                  <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pair Authorized Original Video File (Optional)</span>
                      </span>
                      {uploadedVideoUrl && (
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Paired
                        </span>
                      )}
                    </div>
                    {uploadedVideoUrl ? (
                      <div className="text-xs text-slate-300 flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="truncate max-w-xs">{uploadOriginalName || uploadedVideoFilename}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedVideoUrl(null);
                            setUploadedVideoFilename(null);
                            setUploadOriginalName(null);
                          }}
                          className="text-xs text-rose-400 hover:underline ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-slate-700 hover:border-amber-500 rounded-lg cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-colors text-xs text-slate-400">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span>{isUploadingFile ? 'Uploading video to server...' : 'Upload original video file (.mp4, .webm, .mkv)'}</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
                          disabled={isUploadingFile}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                    {uploadError && (
                      <span className="text-xs text-rose-400 mt-1 block flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {uploadError}
                      </span>
                    )}
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
              )}

              {activeTab === 'upload' && (
                <>
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-slate-300">
                      Upload Authorized Original Video File
                    </label>

                    {uploadedVideoUrl ? (
                      <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                            <FileCheck className="w-4 h-4" />
                            <span>Original Video Uploaded Successfully</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedVideoUrl(null);
                              setUploadedVideoFilename(null);
                              setUploadOriginalName(null);
                              setUploadSizeBytes(null);
                            }}
                            className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                          >
                            Replace file
                          </button>
                        </div>
                        <div className="text-xs text-slate-300 font-mono-numbers">
                          <p><strong className="text-slate-200">Filename:</strong> {uploadOriginalName || uploadedVideoFilename}</p>
                          {uploadSizeBytes && (
                            <p><strong className="text-slate-200">Size:</strong> {(uploadSizeBytes / (1024 * 1024)).toFixed(1)} MB</p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1">
                            Audio replacement: The original English audio will be completely replaced with studio Urdu voiceovers.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition-colors text-center group">
                        <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
                          {isUploadingFile ? (
                            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5 text-slate-400 group-hover:text-emerald-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-200">
                            {isUploadingFile ? 'Uploading video to server...' : 'Click or drag video file here'}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Supports MP4, WebM, MKV, MOV (interim cap 500 MB)
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
                          disabled={isUploadingFile}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}

                    {uploadError && (
                      <div className="p-2.5 bg-rose-950/30 border border-rose-500/30 rounded-lg text-xs text-rose-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Series / Video Title
                      </label>
                      <input
                        type="text"
                        value={videoTitle}
                        onChange={(e) => setVideoTitle(e.target.value)}
                        placeholder="e.g. Solo Necromancer Full Arc"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Optional YouTube Reference Link
                      </label>
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'raw_manhwa' && (
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
                    min={1}
                    max={1440}
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
                  disabled={isIngesting || isUploadingFile}
                  className="px-5 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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

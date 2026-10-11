export interface RecapSegment {
  id: string;
  start: number; // in seconds relative to current arc
  end: number;   // in seconds relative to current arc
  englishText: string;
  urduText: string;
  romanUrduText: string;
  toneDirective: string;
  recapPacing?: 'fast' | 'normal' | 'slow';
  audioUrl?: string; // base64 or blob URL
  audioGenerated?: boolean;
}

export interface StoryArc {
  id: string;
  arcNumber: number;
  title: string;
  titleUrdu: string;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  chaptersCovered: string;
  cliffhangerHook: string;
  cliffhangerHookUrdu: string;
  pacing: string;
  status: 'pending' | 'scripted' | 'dubbed' | 'exported';
  segments: RecapSegment[];
}

export interface MarathonProject {
  id: string;
  title: string;
  titleUrdu: string;
  sourceVideoUrl: string;
  youtubeId?: string;
  uploadedVideoUrl?: string;
  uploadedVideoFilename?: string;
  sourceAssetId?: string;
  durationMs?: number;
  totalDurationMinutes: number;
  genre: string;
  mainCharacter: string;
  arcs: StoryArc[];
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
  ownerId?: string;
}

export type GeminiVoiceName = 'Zephyr' | 'Fenrir' | 'Kore' | 'Puck' | 'Charon';

export interface VoiceProfile {
  id: GeminiVoiceName;
  name: string;
  character: string;
  toneDescription: string;
  recommendedFor: string;
}

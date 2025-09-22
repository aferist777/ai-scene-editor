export interface Scene {
  id: number;
  lines: string;
  description: string;
  description_ru?: string;
  generatedAssets: GeneratedAssets | null;
  isGenerating: boolean;
  generatingElapsed?: number;
  firstFrameImages: string[];
  finalFrameImages: string[];
  firstFrameImageIndex: number;
  finalFrameImageIndex: number;
  isGeneratingFirstFrame: boolean;
  firstFrameGeneratingElapsed?: number;
  isGeneratingFinalFrame: boolean;
  finalFrameGeneratingElapsed?: number;
  isEnriching?: boolean;
  enrichingElapsed?: number;
}

export interface GeneratedAssets {
  firstFramePrompt: string;
  animationPrompt: string;
  finalFramePrompt: string;
  firstFramePrompt_ru?: string;
  animationPrompt_ru?: string;
  finalFramePrompt_ru?: string;
}

export interface MusicPlan {
    part1: string;
    part2: string;
    part3: string;
}

export interface SfxPlanItem {
  sceneId: number;
  sceneLines: string;
  sfx: string[];
}
export type SfxPlan = SfxPlanItem[];

export interface SocialPack {
    youtube: {
        title: string;
        description:string;
        hashtags: string[];
        keywords: string[];
        tags: string[];
    };
    tiktok: {
        bio: string;
        description: string;
        hashtags: string[];
    };
}

export interface LogEntry {
  timestamp: Date;
  message: string;
  type: 'info' | 'api-request' | 'api-success' | 'api-error' | 'action';
  details?: any;
}
import { Injectable, signal, computed, inject } from '@angular/core';
import { Scene, MusicPlan, SocialPack, SfxPlan } from '../models';
import { LoggingService } from './logging.service';
import { GeminiService } from './gemini.service';

const DEFAULT_POEM = `Homework? Never Heard of It!

If you want to feel quite free,
Throw your homework in a tree.
Let the wind take all those sums,
Far away — to where it hums.

Math will not come chase you back,
Spelling tests won’t shout “Attack!”
History can wait a year —
It’s not going anywhere, dear.

Instead, go climb a fence or two,
Build a fort with socks and glue.
Ride your bike until it’s night,
Watch the stars and dodge the light.

And when teacher asks you “Why?” —
Smile and say, “Oh me, oh my,
I freed my mind, I set it loose…
Homework’s just a silly noose!”`;

@Injectable({
  providedIn: 'root',
})
export class AppStateService {
  private loggingService = inject(LoggingService);
  private geminiService = inject(GeminiService);

  // App State
  step = signal<number>(1);
  
  // Step 1 State
  projectTitle = signal<string>('Homework? Never Heard of It!');
  projectTitleUserEdited = signal<boolean>(false);
  characterReferenceImage = signal<string | null>(null);
  poemText = signal<string>(DEFAULT_POEM);
  characterPromptStep1 = signal<string>('');
  isCreatingCharacterPrompt = signal<boolean>(false);
  isMakingCharacterImage = signal<boolean>(false);


  // Step 2 State
  drawingStyles: string[] = [
    'pixar 3D', 'disney', 'Semi-realistic cartoon', 'Low-poly 3D cartoon style',
    'Pop-art cartoon style', 'Rubber hose style (1930s Disney/Betty Boop)',
    'Soviet classic animation', 'French animation style', 'Chibi style',
    'Kawaii pastel anime', 'Shonen anime style', 'Cartoon Network style', 'DreamWorks style'
  ];
  selectedStyles = signal<string[]>(['pixar 3D']);
  characterPrompt = signal<string>('');
  characterPromptModification = signal<string>('');
  generatedCharacterImage = signal<string | null>(null);
  isGeneratingCharacterPrompt = signal<boolean>(false);
  isRegeneratingCharacter = signal<boolean>(false);
  isBreakingDownScenes = signal<boolean>(false);
  isCharacterPromptIncluded = signal<boolean>(false);
  isBeautifyingPrompt = signal<boolean>(false);
  beautifiedPrompt = signal<string | null>(null);
  
  // Step 3 State
  scenes = signal<Scene[]>([]);
  isRecreatingScenes = signal<boolean>(false);

  // Step 4 State (Scene Editor)
  currentSceneIndex = signal<number>(0);
  currentScene = computed(() => this.scenes()[this.currentSceneIndex()]);
  isRegeneratingAnimationPrompt = signal<boolean>(false);
  copiedAnimationPrompt = signal<boolean>(false);
  sceneEditorTargetFrame = signal<'first' | 'final' | null>(null);
  sceneEditorModification = signal<string>('');
  sceneEditorBeautifiedPrompt = signal<string | null>(null);
  isBeautifyingScenePrompt = signal<boolean>(false);
  isBeautifyingAnimationPrompt = signal<boolean>(false);
  animationPromptModification = signal<string>('');

  // Step 5 State (Assets)
  isGeneratingMusic = signal<boolean>(false);
  musicPlan = signal<MusicPlan | null>(null);
  isGeneratingSfx = signal<boolean>(false);
  sfxPlan = signal<SfxPlan | null>(null);

  // Step 6 State (Social)
  isGeneratingSocial = signal<boolean>(false);
  socialPack = signal<SocialPack | null>(null);
  youtubeThumbnail = signal<string | null>(null);
  isGeneratingThumbnail = signal<boolean>(false);
  recommendedThumbnailPrompt = signal<string | null>(null);
  thumbnailPromptModification = signal<string>('');
  
  // Timer State
  private timers = new Map<string, any>();
  createCharacterPromptElapsed = signal<number>(0);
  makeCharacterImageElapsed = signal<number>(0);
  beautifyPromptElapsed = signal<number>(0);
  regenerateCharacterElapsed = signal<number>(0);
  breakingDownScenesElapsed = signal<number>(0);
  recreatingScenesElapsed = signal<number>(0);
  regenerateAnimationPromptElapsed = signal<number>(0);
  beautifyScenePromptElapsed = signal<number>(0);
  beautifyAnimationPromptElapsed = signal<number>(0);
  generateMusicElapsed = signal<number>(0);
  generateSfxElapsed = signal<number>(0);
  generateSocialElapsed = signal<number>(0);
  generateThumbnailElapsed = signal<number>(0);

  // Computed State
  isStep1Valid = computed(() => this.poemText().trim().length > 0 && this.projectTitle().trim().length > 0 && this.characterReferenceImage() !== null);
  
  // Timer Management
  startTimer(key: string, updateSignal: (elapsed: number) => void) {
    this.stopTimer(key);
    const startTime = Date.now();
    updateSignal(0);
    const intervalId = setInterval(() => {
      updateSignal((Date.now() - startTime) / 1000);
    }, 100);
    this.timers.set(key, intervalId);
  }

  stopTimer(key: string) {
    if (this.timers.has(key)) {
      clearInterval(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  formatTimer(seconds: number): string {
    return `(${(Math.round(seconds * 10) / 10).toFixed(1)}s)`;
  }

  stopAllLoadingStates() {
    this.isCreatingCharacterPrompt.set(false);
    this.isMakingCharacterImage.set(false);
    this.isGeneratingMusic.set(false);
    this.isGeneratingSfx.set(false);
    this.isGeneratingSocial.set(false);
    this.isGeneratingThumbnail.set(false);
    this.isGeneratingCharacterPrompt.set(false);
    this.isRegeneratingCharacter.set(false);
    this.isBreakingDownScenes.set(false);
    this.isRecreatingScenes.set(false);
    this.isRegeneratingAnimationPrompt.set(false);
    this.isBeautifyingPrompt.set(false);
    this.isBeautifyingScenePrompt.set(false);
    this.isBeautifyingAnimationPrompt.set(false);
    
    Array.from(this.timers.keys()).forEach(key => this.stopTimer(key));
    this.createCharacterPromptElapsed.set(0);
    this.makeCharacterImageElapsed.set(0);
    this.beautifyPromptElapsed.set(0);
    this.regenerateCharacterElapsed.set(0);
    this.breakingDownScenesElapsed.set(0);
    this.recreatingScenesElapsed.set(0);
    this.regenerateAnimationPromptElapsed.set(0);
    this.beautifyScenePromptElapsed.set(0);
    this.beautifyAnimationPromptElapsed.set(0);
    this.generateMusicElapsed.set(0);
    this.generateSfxElapsed.set(0);
    this.generateSocialElapsed.set(0);
    this.generateThumbnailElapsed.set(0);

    this.scenes.update(currentScenes => 
      currentScenes.map(s => ({ 
        ...s, 
        isGenerating: false, generatingElapsed: 0,
        isGeneratingFirstFrame: false, firstFrameGeneratingElapsed: 0,
        isGeneratingFinalFrame: false, finalFrameGeneratingElapsed: 0,
        isEnriching: false, enrichingElapsed: 0
      }))
    );
  }

  // Reset Methods
  resetStep1() {
    this.projectTitle.set('Homework? Never Heard of It!');
    this.projectTitleUserEdited.set(false);
    this.characterReferenceImage.set(null);
    this.poemText.set(DEFAULT_POEM);
    this.characterPromptStep1.set('');
    this.loggingService.resetTotalCost();
  }

  resetStep5() {
    this.musicPlan.set(null);
    this.sfxPlan.set(null);
  }

  resetStep6() {
    this.socialPack.set(null);
    this.youtubeThumbnail.set(null);
    this.isGeneratingThumbnail.set(false);
    this.recommendedThumbnailPrompt.set(null);
    this.thumbnailPromptModification.set('');
  }

  // Scene Breakdown Logic
  autoBreakdownScenes() {
    const poem = this.poemText().trim();
    if (!poem) { this.scenes.set([]); return; }

    const lines = poem.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) { this.scenes.set([]); return; }
    
    const newScenes: Scene[] = [];
    newScenes.push({
      id: Date.now(), lines: lines[0], description: '', generatedAssets: null,
      isGenerating: false, firstFrameImages: [], finalFrameImages: [],
      firstFrameImageIndex: 0, finalFrameImageIndex: 0,
      isGeneratingFirstFrame: false, isGeneratingFinalFrame: false, isEnriching: false,
    });

    const remainingLines = lines.slice(1);
    for (let i = 0; i < remainingLines.length; i += 2) {
      newScenes.push({
        id: Date.now() + i + 1, lines: remainingLines.slice(i, i + 2).join('\n'),
        description: '', generatedAssets: null, isGenerating: false,
        firstFrameImages: [], finalFrameImages: [], firstFrameImageIndex: 0, finalFrameImageIndex: 0,
        isGeneratingFirstFrame: false,
        isGeneratingFinalFrame: false, isEnriching: false,
      });
    }
    this.scenes.set(newScenes);
    this.loggingService.log(`Poem automatically broken down into ${newScenes.length} scenes`, 'info');
  }

  async breakdownAndDescribeScenes() {
    this.isBreakingDownScenes.set(true);
    this.startTimer('breakingDownScenes', e => this.breakingDownScenesElapsed.set(e));
    this.autoBreakdownScenes();

    if (this.scenes().length > 0) {
      const descriptions = await this.geminiService.generateAllSceneDescriptions(this.scenes(), this.characterPrompt());
      if (descriptions) {
          const descriptionsMap = new Map(descriptions.map(d => [d.id, { description: d.description, description_ru: d.description_ru }]));
          this.scenes.update(currentScenes =>
              currentScenes.map(scene => {
                const newDescriptions = descriptionsMap.get(scene.id);
                return {
                  ...scene,
                  description: newDescriptions?.description || scene.description || '',
                  description_ru: newDescriptions?.description_ru || ''
                }
              })
          );
      }
    }
    
    this.stopTimer('breakingDownScenes');
    this.breakingDownScenesElapsed.set(0);
    this.isBreakingDownScenes.set(false);
  }
}
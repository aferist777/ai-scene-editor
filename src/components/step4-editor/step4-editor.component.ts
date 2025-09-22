import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { AppStateService } from '../../services/app-state.service';
import { GeminiService } from '../../services/gemini.service';
import { LoggingService } from '../../services/logging.service';
import { Scene } from '../../models';

@Component({
  selector: 'app-step4-editor',
  standalone: true,
  templateUrl: './step4-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step4EditorComponent {
  appState = inject(AppStateService);
  geminiService = inject(GeminiService);
  loggingService = inject(LoggingService);

  step = this.appState.step;
  scenes = this.appState.scenes;
  currentSceneIndex = this.appState.currentSceneIndex;
  currentScene = this.appState.currentScene;
  isRegeneratingAnimationPrompt = this.appState.isRegeneratingAnimationPrompt;
  copiedAnimationPrompt = this.appState.copiedAnimationPrompt;
  sceneEditorTargetFrame = this.appState.sceneEditorTargetFrame;
  sceneEditorModification = this.appState.sceneEditorModification;
  sceneEditorBeautifiedPrompt = this.appState.sceneEditorBeautifiedPrompt;
  isBeautifyingScenePrompt = this.appState.isBeautifyingScenePrompt;
  regenerateAnimationPromptElapsed = this.appState.regenerateAnimationPromptElapsed;
  beautifyScenePromptElapsed = this.appState.beautifyScenePromptElapsed;
  formatTimer = this.appState.formatTimer.bind(this.appState);
  isBeautifyingAnimationPrompt = this.appState.isBeautifyingAnimationPrompt;
  animationPromptModification = this.appState.animationPromptModification;
  beautifyAnimationPromptElapsed = this.appState.beautifyAnimationPromptElapsed;

  readonly cameraMovements = ['pan', 'tilt', 'zoom in', 'zoom out', 'dolly in', 'dolly out', 'tracking shot', 'orbit around', 'rotate around', 'bird’s eye view', 'worm’s eye view', 'follow shot', 'fly-through'];
  
  detectedCameraMovements = computed(() => {
      const scene = this.currentScene();
      const prompt = scene?.generatedAssets?.animationPrompt?.toLowerCase() ?? '';
      if (!prompt) return [];
      return this.cameraMovements.filter(move => prompt.includes(move));
  });

  sceneEditorComposedPrompt = computed(() => {
    if (this.sceneEditorBeautifiedPrompt()) return this.sceneEditorBeautifiedPrompt();

    const scene = this.currentScene();
    const target = this.sceneEditorTargetFrame();
    if (!scene || !target || !scene.generatedAssets) return '';

    const basePrompt = target === 'first' 
        ? scene.generatedAssets.firstFramePrompt 
        : scene.generatedAssets.finalFramePrompt;
    
    const modification = this.sceneEditorModification().trim();
    return [basePrompt, modification].filter(Boolean).join(', ');
  });

  fullPromptForFrame = (scene: Scene, frameType: 'first' | 'final'): string => {
    if (!scene.generatedAssets) return '';
    let actionPrompt = frameType === 'first' ? scene.generatedAssets.firstFramePrompt : scene.generatedAssets.finalFramePrompt;
    if (this.sceneEditorTargetFrame() === frameType) {
        actionPrompt = this.sceneEditorComposedPrompt();
    }
    return [this.appState.characterPrompt(), actionPrompt, ...this.appState.selectedStyles()].filter(Boolean).join(', ');
  }
  
  getDownloadFilename(frameType: 'first' | 'final'): string {
    const title = this.appState.projectTitle()
      .replace(/[/?<>\\:*|"]/g, '') // Remove invalid chars
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50); // Limit length
    const sceneNumber = this.currentSceneIndex() + 1;
    const frameName = frameType === 'first' ? 'first' : 'last';
    return `${title}-sc${sceneNumber}-${frameName}.jpg`;
  }

  async generateAssetsForScene(id: number) {
    const scene = this.scenes().find(s => s.id === id);
    if (!scene || !scene.description.trim()) {
        alert("Please add a description for the scene before generating assets.");
        return;
    }
    
    this.loggingService.log(`User clicked 'Generate Assets' for scene ${this.scenes().findIndex(s => s.id === id) + 1}`, 'action');
    this.scenes.update(scenes => scenes.map(s => (s.id === id ? { 
        ...s, 
        isGenerating: true, 
        generatedAssets: null, 
        firstFrameImages: [], 
        finalFrameImages: [],
        firstFrameImageIndex: 0,
        finalFrameImageIndex: 0
    } : s)));

    const timerKey = `scene-assets-${id}`;
    this.appState.startTimer(timerKey, elapsed => {
        this.scenes.update(currentScenes => 
            currentScenes.map(s => s.id === id ? { ...s, generatingElapsed: elapsed } : s)
        );
    });

    const generatedAssets = await this.geminiService.generateSceneAssets(scene, this.appState.characterPrompt(), this.appState.selectedStyles());
    
    this.appState.stopTimer(timerKey);
    this.scenes.update(scenes => scenes.map(s => s.id === id ? {
        ...s,
        generatedAssets: generatedAssets ? generatedAssets : s.generatedAssets,
        isGenerating: false,
        generatingElapsed: 0,
    } : s));
  }
  
  async generateImageForFrame(sceneId: number, frameType: 'first' | 'final') {
    const sceneIndex = this.scenes().findIndex(s => s.id === sceneId);
    const scene = this.scenes()[sceneIndex];
    if (!scene || !scene.generatedAssets) return;

    this.loggingService.log(`Generating image for scene ${this.currentSceneIndex() + 1}, frame: ${frameType}`, 'action');

    const flagKey: keyof Scene = frameType === 'first' ? 'isGeneratingFirstFrame' : 'isGeneratingFinalFrame';
    this.scenes.update(scenes => scenes.map(s => s.id === sceneId ? { ...s, [flagKey]: true } : s));

    const timerKey = `scene-frame-${sceneId}-${frameType}`;
    this.appState.startTimer(timerKey, elapsed => {
        this.scenes.update(currentScenes => currentScenes.map(s => {
            if (s.id === sceneId) {
                const elapsedKey: keyof Scene = frameType === 'first' ? 'firstFrameGeneratingElapsed' : 'finalFrameGeneratingElapsed';
                return { ...s, [elapsedKey]: elapsed };
            }
            return s;
        }));
    });
    
    let baseImage: string | undefined = undefined;
    
    if (frameType === 'first') {
        if (sceneIndex > 0) {
            const prevScene = this.scenes()[sceneIndex - 1];
            if (prevScene.finalFrameImages.length > 0) {
                baseImage = prevScene.finalFrameImages[prevScene.finalFrameImageIndex];
            }
        }
    } else { // 'final'
        if (scene.firstFrameImages.length > 0) {
            baseImage = scene.firstFrameImages[scene.firstFrameImageIndex];
        }
    }

    const actionPrompt = frameType === 'first' 
        ? scene.generatedAssets.firstFramePrompt 
        : scene.generatedAssets.finalFramePrompt;
    
    const fullPrompt = [this.appState.characterPrompt(), actionPrompt, ...this.appState.selectedStyles()].filter(Boolean).join(', ');

    let newImage: string | null = null;
    if (baseImage) {
        newImage = await this.geminiService.generateImageFromImageAndPrompt(baseImage, fullPrompt);
    } else {
        newImage = await this.geminiService.generateImageFromPrompt(fullPrompt);
    }

    this.appState.stopTimer(timerKey);
    
    if (newImage) {
        this.scenes.update(scenes => scenes.map(s => {
          if (s.id === scene.id) {
            const imagesKey = frameType === 'first' ? 'firstFrameImages' : 'finalFrameImages';
            const indexKey = frameType === 'first' ? 'firstFrameImageIndex' : 'finalFrameImageIndex';
            const newImages = [...s[imagesKey], newImage];
            const elapsedKey: keyof Scene = frameType === 'first' ? 'firstFrameGeneratingElapsed' : 'finalFrameGeneratingElapsed';
            return { 
                ...s, 
                [imagesKey]: newImages, 
                [indexKey]: newImages.length - 1,
                [flagKey]: false, 
                [elapsedKey]: 0 
            };
          }
          return s;
        }));
    } else {
        this.scenes.update(scenes => scenes.map(s => {
          if (s.id === scene.id) {
            const elapsedKey: keyof Scene = frameType === 'first' ? 'firstFrameGeneratingElapsed' : 'finalFrameGeneratingElapsed';
            return { ...s, [flagKey]: false, [elapsedKey]: 0 };
          }
          return s;
        }));
    }
  }

  navigateImage(sceneId: number, frameType: 'first' | 'final', direction: -1 | 1) {
    this.scenes.update(scenes => scenes.map(s => {
      if (s.id === sceneId) {
        const imagesKey = frameType === 'first' ? 'firstFrameImages' : 'finalFrameImages';
        const indexKey = frameType === 'first' ? 'firstFrameImageIndex' : 'finalFrameImageIndex';
        const newIndex = s[indexKey] + direction;
        
        if (newIndex >= 0 && newIndex < s[imagesKey].length) {
          return { ...s, [indexKey]: newIndex };
        }
      }
      return s;
    }));
  }

  onSceneEditorTargetChange(event: Event) {
    const target = (event.target as HTMLSelectElement).value as 'first' | 'final' | '';
    this.sceneEditorTargetFrame.set(target || null);
    this.sceneEditorModification.set('');
    this.sceneEditorBeautifiedPrompt.set(null);
  }

  onSceneEditorModificationInput(event: Event) {
      this.sceneEditorBeautifiedPrompt.set(null);
      this.sceneEditorModification.set((event.target as HTMLInputElement).value);
  }

  async beautifyScenePrompt() {
    const scene = this.currentScene();
    const target = this.sceneEditorTargetFrame();
    if (!scene || !target || !scene.generatedAssets || this.isBeautifyingScenePrompt()) return;
    
    this.loggingService.log(`User clicked 'Beautify Prompt' for scene frame`, 'action', { scene: this.currentSceneIndex() + 1, frame: target });
    const basePrompt = target === 'first' ? scene.generatedAssets.firstFramePrompt : scene.generatedAssets.finalFramePrompt;
    const modification = this.sceneEditorModification().trim();
    if (!basePrompt && !modification) return;

    this.isBeautifyingScenePrompt.set(true);
    this.appState.startTimer('beautifyScene', e => this.beautifyScenePromptElapsed.set(e));
    
    const result = await this.geminiService.beautifyPrompt(basePrompt, modification, this.appState.selectedStyles());

    this.appState.stopTimer('beautifyScene');
    this.beautifyScenePromptElapsed.set(0);
    if (result) this.sceneEditorBeautifiedPrompt.set(result);
    this.isBeautifyingScenePrompt.set(false);
  }

  async generateBeautifiedFrame() {
    const scene = this.currentScene();
    const targetFrame = this.sceneEditorTargetFrame();
    const beautifiedActionPrompt = this.sceneEditorBeautifiedPrompt();
    if (!scene || !targetFrame || !beautifiedActionPrompt) return;
    
    const baseImage = targetFrame === 'first' ? scene.firstFrameImages[scene.firstFrameImageIndex] : scene.finalFrameImages[scene.finalFrameImageIndex];
    if (!baseImage) { console.error('Base image is missing.'); return; }
    
    this.loggingService.log(`'Generate with Beautified Prompt' clicked`, 'action', { scene: this.currentSceneIndex() + 1, frame: targetFrame });
    const flagKey: keyof Scene = targetFrame === 'first' ? 'isGeneratingFirstFrame' : 'isGeneratingFinalFrame';
    this.scenes.update(scenes => scenes.map(s => s.id === scene.id ? { ...s, [flagKey]: true } : s));
    
    const timerKey = `scene-frame-${scene.id}-${targetFrame}`;
    this.appState.startTimer(timerKey, elapsed => {
        this.scenes.update(currentScenes => currentScenes.map(s => {
            if (s.id === scene.id) {
                const elapsedKey: keyof Scene = targetFrame === 'first' ? 'firstFrameGeneratingElapsed' : 'finalFrameGeneratingElapsed';
                return { ...s, [elapsedKey]: elapsed };
            }
            return s;
        }));
    });

    const fullPrompt = [this.appState.characterPrompt(), beautifiedActionPrompt].filter(Boolean).join(', ');
    const newImage = await this.geminiService.generateImageFromImageAndPrompt(baseImage, fullPrompt);

    this.appState.stopTimer(timerKey);
    
    if (newImage) {
        this.scenes.update(scenes => scenes.map(s => {
          if (s.id === scene.id) {
            const imagesKey = targetFrame === 'first' ? 'firstFrameImages' : 'finalFrameImages';
            const indexKey = targetFrame === 'first' ? 'firstFrameImageIndex' : 'finalFrameImageIndex';
            const newImages = [...s[imagesKey], newImage];
            const elapsedKey: keyof Scene = targetFrame === 'first' ? 'firstFrameGeneratingElapsed' : 'finalFrameGeneratingElapsed';
            return { 
                ...s, 
                [imagesKey]: newImages,
                [indexKey]: newImages.length - 1,
                [flagKey]: false, 
                [elapsedKey]: 0 
            };
          }
          return s;
        }));
    } else {
        this.scenes.update(scenes => scenes.map(s => {
          if (s.id === scene.id) {
            const elapsedKey: keyof Scene = targetFrame === 'first' ? 'firstFrameGeneratingElapsed' : 'finalFrameGeneratingElapsed';
            return { ...s, [flagKey]: false, [elapsedKey]: 0 };
          }
          return s;
        }));
    }
    
    this.resetSceneEditorComposer();
    const frameSelect = document.getElementById('frame-select') as HTMLSelectElement | null;
    if (frameSelect) frameSelect.value = '';
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
        this.copiedAnimationPrompt.set(true);
        setTimeout(() => this.copiedAnimationPrompt.set(false), 2000);
        this.loggingService.log('Animation prompt copied to clipboard', 'action');
    }).catch(err => console.error('Failed to copy text: ', err));
  }

  async regenerateAnimationPrompt(id: number) {
    const scene = this.scenes().find(s => s.id === id);
    if (!scene) return;
    
    this.loggingService.log(`'Regenerate' animation prompt clicked`, 'action', { scene: this.currentSceneIndex() + 1 });
    this.isRegeneratingAnimationPrompt.set(true);
    const timerKey = `anim-prompt-${id}`;
    this.appState.startTimer(timerKey, e => this.regenerateAnimationPromptElapsed.set(e));

    const newAnimationPrompt = await this.geminiService.generateAnimationPrompt(scene, this.appState.characterPrompt(), this.appState.selectedStyles());
    
    this.appState.stopTimer(timerKey);
    this.regenerateAnimationPromptElapsed.set(0);

    if (newAnimationPrompt) {
        this.scenes.update(scenes => scenes.map(s => {
            if (s.id === id && s.generatedAssets) {
                return { ...s, generatedAssets: { ...s.generatedAssets, animationPrompt: newAnimationPrompt } };
            }
            return s;
        }));
    }
    this.isRegeneratingAnimationPrompt.set(false);
  }

  async beautifyAnimationPrompt(id: number) {
    const scene = this.scenes().find(s => s.id === id);
    const modification = this.animationPromptModification().trim();
    if (!scene || !scene.generatedAssets || !modification || this.isBeautifyingAnimationPrompt()) return;

    this.loggingService.log(`'Beautify' animation prompt clicked`, 'action', { scene: this.currentSceneIndex() + 1, modification });
    this.isBeautifyingAnimationPrompt.set(true);
    const timerKey = `beautify-anim-prompt-${id}`;
    this.appState.startTimer(timerKey, e => this.beautifyAnimationPromptElapsed.set(e));

    const basePrompt = scene.generatedAssets.animationPrompt;
    const newAnimationPrompt = await this.geminiService.beautifyAnimationPrompt(basePrompt, modification, this.appState.selectedStyles());

    this.appState.stopTimer(timerKey);
    this.beautifyAnimationPromptElapsed.set(0);

    if (newAnimationPrompt) {
        this.scenes.update(scenes => scenes.map(s => {
            if (s.id === id && s.generatedAssets) {
                return { ...s, generatedAssets: { ...s.generatedAssets, animationPrompt: newAnimationPrompt } };
            }
            return s;
        }));
        this.animationPromptModification.set(''); // Clear input on success
    }
    this.isBeautifyingAnimationPrompt.set(false);
  }

  resetSceneEditorComposer() {
    this.sceneEditorTargetFrame.set(null);
    this.sceneEditorModification.set('');
    this.sceneEditorBeautifiedPrompt.set(null);
    this.isBeautifyingScenePrompt.set(false);
  }

  goToScene(index: number) {
    if (index >= 0 && index < this.scenes().length) {
      this.currentSceneIndex.set(index);
      this.resetSceneEditorComposer();
      this.animationPromptModification.set('');
    }
  }

  nextScene() {
    if (this.currentSceneIndex() < this.scenes().length - 1) {
      this.currentSceneIndex.update(i => i + 1);
      this.resetSceneEditorComposer();
      this.animationPromptModification.set('');
    }
  }

  previousScene() {
    if (this.currentSceneIndex() > 0) {
      this.currentSceneIndex.update(i => i - 1);
      this.resetSceneEditorComposer();
      this.animationPromptModification.set('');
    }
  }

  resetStep4() {
    this.loggingService.log(`User reloaded Step 4`, 'action');
    this.geminiService.error.set(null);
    this.scenes.update(scenes => scenes.map(s => ({ 
      ...s, generatedAssets: null, firstFrameImages: [], finalFrameImages: [], firstFrameImageIndex: 0, finalFrameImageIndex: 0,
      isGenerating: false, isGeneratingFirstFrame: false, isGeneratingFinalFrame: false,
      generatingElapsed: 0, firstFrameGeneratingElapsed: 0, finalFrameGeneratingElapsed: 0,
    })));
    this.resetSceneEditorComposer();
    this.animationPromptModification.set('');
    this.currentSceneIndex.set(0);
  }
}
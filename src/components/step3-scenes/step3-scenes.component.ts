import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AppStateService } from '../../services/app-state.service';
import { GeminiService } from '../../services/gemini.service';
import { LoggingService } from '../../services/logging.service';

@Component({
  selector: 'app-step3-scenes',
  standalone: true,
  templateUrl: './step3-scenes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step3ScenesComponent {
  appState = inject(AppStateService);
  geminiService = inject(GeminiService);
  loggingService = inject(LoggingService);

  step = this.appState.step;
  scenes = this.appState.scenes;
  isRecreatingScenes = this.appState.isRecreatingScenes;
  recreatingScenesElapsed = this.appState.recreatingScenesElapsed;
  isBreakingDownScenes = this.appState.isBreakingDownScenes;
  formatTimer = this.appState.formatTimer.bind(this.appState);

  async enrichSceneDescription(sceneId: number) {
    const scenes = this.scenes();
    const sceneIndex = scenes.findIndex(s => s.id === sceneId);
    const scene = scenes[sceneIndex];
    if (!scene || scene.isEnriching || !scene.description) return;

    const previousSceneDescription = sceneIndex > 0 ? scenes[sceneIndex - 1].description : undefined;
    
    this.loggingService.log(`User clicked 'Make Rich' for scene ${sceneIndex + 1}`, 'action');
    this.scenes.update(currentScenes => currentScenes.map(s => s.id === sceneId ? { ...s, isEnriching: true } : s));
    const timerKey = `enrich-${sceneId}`;
    this.appState.startTimer(timerKey, elapsed => {
      this.scenes.update(currentScenes => 
        currentScenes.map(s => s.id === sceneId ? { ...s, enrichingElapsed: elapsed } : s)
      );
    });
  
    const enrichedResult = await this.geminiService.enrichSceneDescription(scene.description, previousSceneDescription);
  
    this.appState.stopTimer(timerKey);
    this.scenes.update(currentScenes => currentScenes.map(s => {
      if (s.id === sceneId) {
        return {
          ...s,
          description: enrichedResult?.description || s.description,
          description_ru: enrichedResult?.description_ru ?? s.description_ru,
          isEnriching: false,
          enrichingElapsed: 0
        };
      }
      return s;
    }));
  }
  
  async recreateAllSceneDescriptions() {
    this.loggingService.log(`User clicked 'Re-imagine Scenes'`, 'action');
    this.isRecreatingScenes.set(true);
    this.appState.startTimer('recreatingScenes', e => this.recreatingScenesElapsed.set(e));
    
    const descriptions = await this.geminiService.reimagineAllSceneDescriptions(this.scenes(), this.appState.characterPrompt());
  
    if (descriptions) {
        const descriptionsMap = new Map(descriptions.map(d => [d.id, { description: d.description, description_ru: d.description_ru }]));
        this.scenes.update(currentScenes =>
            currentScenes.map(scene => {
                const newDescriptions = descriptionsMap.get(scene.id);
                if (newDescriptions) {
                  return {
                    ...scene,
                    description: newDescriptions.description,
                    description_ru: newDescriptions.description_ru
                  };
                }
                return scene;
            })
        );
    }
      
    this.appState.stopTimer('recreatingScenes');
    this.recreatingScenesElapsed.set(0);
    this.isRecreatingScenes.set(false);
  }

  proceedToSceneEditor() {
    this.loggingService.log(`User clicked 'Next: Edit Scenes'`, 'action');
    this.appState.currentSceneIndex.set(0);
    this.step.set(4);
  }

  updateSceneDescription(id: number, lang: 'en' | 'ru', event: Event) {
    const value = (event.target as HTMLTextAreaElement).value;
    this.scenes.update(scenes =>
      scenes.map(scene => {
        if (scene.id === id) {
          const key = lang === 'en' ? 'description' : 'description_ru';
          return { ...scene, [key]: value };
        }
        return scene;
      })
    );
  }

  removeScene(id: number) {
    const sceneIndex = this.scenes().findIndex(s => s.id === id);
    this.loggingService.log(`User removed scene ${sceneIndex + 1}`, 'action');
    this.scenes.update(scenes => scenes.filter(scene => scene.id !== id));
    if (this.appState.currentSceneIndex() >= sceneIndex && this.appState.currentSceneIndex() > 0) {
        this.appState.currentSceneIndex.update(i => i - 1);
    }
  }

  async reloadStep3() {
    this.loggingService.log(`User reloaded Step 3`, 'action');
    this.geminiService.error.set(null);
    if (this.isBreakingDownScenes()) return;
    
    await this.appState.breakdownAndDescribeScenes();
  }
}
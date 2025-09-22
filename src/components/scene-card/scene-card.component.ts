import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AppStateService } from '../../services/app-state.service';
import { GeminiService } from '../../services/gemini.service';
import { LoggingService } from '../../services/logging.service';
import { Scene, SfxPlan } from '../../models';

@Component({
  selector: 'app-step5-assets',
  standalone: true,
  templateUrl: './scene-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneCardComponent { // Repurposed as Step5AssetsComponent
  appState = inject(AppStateService);
  geminiService = inject(GeminiService);
  loggingService = inject(LoggingService);

  step = this.appState.step;
  scenes = this.appState.scenes;
  isGeneratingMusic = this.appState.isGeneratingMusic;
  musicPlan = this.appState.musicPlan;
  isGeneratingSfx = this.appState.isGeneratingSfx;
  sfxPlan = this.appState.sfxPlan;
  generateMusicElapsed = this.appState.generateMusicElapsed;
  generateSfxElapsed = this.appState.generateSfxElapsed;
  formatTimer = this.appState.formatTimer.bind(this.appState);

  async generateMusic() {
    this.loggingService.log(`User clicked 'Generate 3-Part Music Score'`, 'action');
    this.isGeneratingMusic.set(true);
    this.appState.startTimer('generateMusic', e => this.generateMusicElapsed.set(e));

    const result = await this.geminiService.generateMusicPlan(this.appState.poemText());
    this.musicPlan.set(result);
    
    this.appState.stopTimer('generateMusic');
    this.generateMusicElapsed.set(0);
    this.isGeneratingMusic.set(false);
  }

  async generateSfx() {
    this.loggingService.log(`User clicked 'Generate SFX Plan for All Scenes'`, 'action');
    this.isGeneratingSfx.set(true);
    this.appState.startTimer('generateSfx', e => this.generateSfxElapsed.set(e));

    const result = await this.geminiService.generateSfxForAllScenes(this.scenes());
    
    if (result) {
      const scenesMap = new Map<number, Scene>(this.scenes().map(s => [s.id, s]));
      const fullSfxPlan: SfxPlan = result.map(item => {
        const scene = scenesMap.get(item.id);
        return {
          sceneId: item.id,
          sceneLines: scene?.lines || 'Unknown Scene',
          sfx: item.sfx
        }
      });
      this.sfxPlan.set(fullSfxPlan);
    }
    
    this.appState.stopTimer('generateSfx');
    this.generateSfxElapsed.set(0);
    this.isGeneratingSfx.set(false);
  }

  resetStep5() {
    this.loggingService.log(`User reloaded Step 5`, 'action');
    this.geminiService.error.set(null);
    this.appState.resetStep5();
  }
}
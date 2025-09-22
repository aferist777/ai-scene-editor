import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AppStateService } from '../../services/app-state.service';
import { GeminiService } from '../../services/gemini.service';
import { LoggingService } from '../../services/logging.service';

@Component({
  selector: 'app-step6-social',
  standalone: true,
  templateUrl: './step5-finalize.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step5FinalizeComponent { // Repurposed as Step6SocialComponent
  appState = inject(AppStateService);
  geminiService = inject(GeminiService);
  loggingService = inject(LoggingService);

  step = this.appState.step;
  isGeneratingSocial = this.appState.isGeneratingSocial;
  socialPack = this.appState.socialPack;
  generateSocialElapsed = this.appState.generateSocialElapsed;
  formatTimer = this.appState.formatTimer.bind(this.appState);

  youtubeThumbnail = this.appState.youtubeThumbnail;
  isGeneratingThumbnail = this.appState.isGeneratingThumbnail;
  recommendedThumbnailPrompt = this.appState.recommendedThumbnailPrompt;
  thumbnailPromptModification = this.appState.thumbnailPromptModification;
  generateThumbnailElapsed = this.appState.generateThumbnailElapsed;

  async generateSocial() {
    this.loggingService.log(`User clicked 'Generate YouTube & TikTok Pack'`, 'action');
    this.isGeneratingSocial.set(true);
    this.appState.startTimer('generateSocial', e => this.generateSocialElapsed.set(e));
    
    const result = await this.geminiService.generateSocialPack(this.appState.projectTitle(), this.appState.poemText());
    this.socialPack.set(result);
    
    if (result) {
      await this.generateRecommendedThumbnailPrompt();
    }

    this.appState.stopTimer('generateSocial');
    this.generateSocialElapsed.set(0);
    this.isGeneratingSocial.set(false);
  }

  async generateRecommendedThumbnailPrompt() {
    this.loggingService.log(`Generating recommended thumbnail prompt`, 'action');
    const prompt = await this.geminiService.generateThumbnailPrompt(this.appState.projectTitle(), this.appState.poemText());
    this.recommendedThumbnailPrompt.set(prompt);
  }

  async generateThumbnail() {
    const recommended = this.recommendedThumbnailPrompt();
    if (!recommended) return;

    this.loggingService.log(`User clicked 'Generate Thumbnail'`, 'action');
    this.isGeneratingThumbnail.set(true);
    this.appState.startTimer('generateThumbnail', e => this.generateThumbnailElapsed.set(e));
    
    const fullPrompt = [recommended, this.thumbnailPromptModification(), ...this.appState.selectedStyles()].filter(Boolean).join(', ');
    const result = await this.geminiService.generateImageFromPrompt(fullPrompt, '16:9');
    this.youtubeThumbnail.set(result);

    this.appState.stopTimer('generateThumbnail');
    this.generateThumbnailElapsed.set(0);
    this.isGeneratingThumbnail.set(false);
  }

  resetStep6() {
    this.loggingService.log(`User reloaded Step 6`, 'action');
    this.geminiService.error.set(null);
    this.appState.resetStep6();
  }

  startOver() {
    this.loggingService.log('User clicked Start Over', 'action');
    this.appState.resetStep1();
    this.appState.scenes.set([]);
    this.appState.resetStep5();
    this.appState.resetStep6();
    this.step.set(1);
  }
}
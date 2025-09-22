import { Component, ChangeDetectionStrategy, inject, computed, OnInit } from '@angular/core';
import { AppStateService } from '../../services/app-state.service';
import { GeminiService } from '../../services/gemini.service';
import { LoggingService } from '../../services/logging.service';

@Component({
  selector: 'app-step2-character',
  standalone: true,
  templateUrl: './step2-character.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step2CharacterComponent implements OnInit {
  appState = inject(AppStateService);
  geminiService = inject(GeminiService);
  loggingService = inject(LoggingService);

  // Signals from State
  step = this.appState.step;
  drawingStyles = this.appState.drawingStyles;
  selectedStyles = this.appState.selectedStyles;
  characterPrompt = this.appState.characterPrompt;
  characterPromptModification = this.appState.characterPromptModification;
  generatedCharacterImage = this.appState.generatedCharacterImage;
  isGeneratingCharacterPrompt = this.appState.isGeneratingCharacterPrompt;
  isRegeneratingCharacter = this.appState.isRegeneratingCharacter;
  isBreakingDownScenes = this.appState.isBreakingDownScenes;
  isCharacterPromptIncluded = this.appState.isCharacterPromptIncluded;
  isBeautifyingPrompt = this.appState.isBeautifyingPrompt;
  beautifiedPrompt = this.appState.beautifiedPrompt;
  characterReferenceImage = this.appState.characterReferenceImage;
  beautifyPromptElapsed = this.appState.beautifyPromptElapsed;
  regenerateCharacterElapsed = this.appState.regenerateCharacterElapsed;
  breakingDownScenesElapsed = this.appState.breakingDownScenesElapsed;
  formatTimer = this.appState.formatTimer.bind(this.appState);

  composedPrompt = computed(() => {
    if (this.beautifiedPrompt()) {
      return this.beautifiedPrompt() as string;
    }
    const parts: string[] = [];
    const styles = this.selectedStyles();
    if (styles.length > 0) parts.push(styles.join(', '));
    if (this.isCharacterPromptIncluded()) parts.push(this.characterPrompt());
    const modification = this.characterPromptModification().trim();
    if (modification) parts.push(modification);
    return parts.filter(Boolean).join(', ');
  });

  ngOnInit(): void {
    this.generatePromptFromImageIfNeeded();
  }

  async generatePromptFromImageIfNeeded(): Promise<void> {
    const prompt = this.characterPrompt();
    const image = this.characterReferenceImage();

    if (!prompt && image) {
      this.loggingService.log('Character prompt is missing, generating from reference image.', 'info');
      this.isGeneratingCharacterPrompt.set(true);
      const newPrompt = await this.geminiService.generatePromptFromImage(image);
      if (newPrompt) {
        this.characterPrompt.set(newPrompt);
        this.loggingService.log('Successfully generated character prompt from image.', 'api-success', { prompt: newPrompt });
      } else {
        this.loggingService.log('Failed to generate character prompt from image.', 'api-error');
      }
      this.isGeneratingCharacterPrompt.set(false);
    }
  }

  onStyleChange(style: string, event: Event) {
    this.beautifiedPrompt.set(null);
    const isChecked = (event.target as HTMLInputElement).checked;
    this.selectedStyles.update(styles => isChecked ? [...styles, style] : styles.filter(s => s !== style));
    this.loggingService.log(`Style '${style}' was ${isChecked ? 'selected' : 'deselected'}`, 'action');
  }

  addCharacterPromptToComposer() {
    this.beautifiedPrompt.set(null);
    this.isCharacterPromptIncluded.set(true);
    this.loggingService.log(`AI-generated prompt added to composer`, 'action');
  }

  onModificationInput(event: Event) {
    this.beautifiedPrompt.set(null);
    this.characterPromptModification.set((event.target as HTMLInputElement).value);
  }

  async beautifyPrompt() {
    const modification = this.characterPromptModification().trim();
    const styles = this.selectedStyles();
    const baseParts: string[] = [];
    if (this.isCharacterPromptIncluded()) baseParts.push(this.characterPrompt());
    const basePrompt = baseParts.join(', ');

    if ((!basePrompt && !modification) || this.isBeautifyingPrompt()) return;
    
    this.loggingService.log(`User clicked 'Beautify Prompt'`, 'action', { basePrompt, modification, styles });
    this.isBeautifyingPrompt.set(true);
    this.appState.startTimer('beautifyPrompt', e => this.beautifyPromptElapsed.set(e));
    
    const result = await this.geminiService.beautifyPrompt(basePrompt, modification, styles);
    
    this.appState.stopTimer('beautifyPrompt');
    this.beautifyPromptElapsed.set(0);
    if (result) this.beautifiedPrompt.set(result);
    this.isBeautifyingPrompt.set(false);
  }

  async generateRefinedCharacter() {
    if (this.isRegeneratingCharacter()) return;
    const prompt = this.composedPrompt();
    const baseImage = this.characterReferenceImage();
    if (!baseImage || !prompt || !this.beautifiedPrompt()) return;
    
    this.loggingService.log(`User clicked 'Generate with Beautified Prompt'`, 'action');
    this.isRegeneratingCharacter.set(true);
    this.appState.startTimer('regenerateCharacter', e => this.regenerateCharacterElapsed.set(e));

    const newImage = await this.geminiService.generateImageFromImageAndPrompt(baseImage, prompt);
    
    this.appState.stopTimer('regenerateCharacter');
    this.regenerateCharacterElapsed.set(0);

    if (newImage) {
      this.generatedCharacterImage.set(newImage);
      const newPrompt = await this.geminiService.generatePromptFromImage(newImage);
      if (newPrompt) this.characterPrompt.set(newPrompt);
      this.characterPromptModification.set('');
      this.isCharacterPromptIncluded.set(false);
      this.beautifiedPrompt.set(null);
    }
    this.isRegeneratingCharacter.set(false);
  }

  async proceedToSceneBreakdown() {
    this.loggingService.log(`User clicked 'Next: Review Scenes'`, 'action');
    await this.appState.breakdownAndDescribeScenes();
    this.step.set(3);
  }

  async resetStep2() {
    this.loggingService.log(`User reloaded Step 2`, 'action');
    this.geminiService.error.set(null);
    this.generatedCharacterImage.set(this.characterReferenceImage());
    this.characterPromptModification.set('');
    this.isCharacterPromptIncluded.set(false);
    this.beautifiedPrompt.set(null);
    
    // Reset prompt to the original one from step 1
    this.characterPrompt.set(this.appState.characterPromptStep1());
    
    // Then, regenerate it if it's empty but an image exists
    await this.generatePromptFromImageIfNeeded();
  }
}
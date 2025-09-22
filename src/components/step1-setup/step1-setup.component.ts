import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { AppStateService } from '../../services/app-state.service';
import { GeminiService } from '../../services/gemini.service';
import { LoggingService } from '../../services/logging.service';

@Component({
  selector: 'app-step1-setup',
  standalone: true,
  templateUrl: './step1-setup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step1SetupComponent {
  appState = inject(AppStateService);
  geminiService = inject(GeminiService);
  loggingService = inject(LoggingService);

  projectTitle = this.appState.projectTitle;
  poemText = this.appState.poemText;
  characterReferenceImage = this.appState.characterReferenceImage;
  isStep1Valid = this.appState.isStep1Valid;

  // New Character Prompt/Image Generator State
  characterPromptStep1 = this.appState.characterPromptStep1;
  isCreatingCharacterPrompt = this.appState.isCreatingCharacterPrompt;
  createCharacterPromptElapsed = this.appState.createCharacterPromptElapsed;
  isMakingCharacterImage = this.appState.isMakingCharacterImage;
  makeCharacterImageElapsed = this.appState.makeCharacterImageElapsed;
  formatTimer = this.appState.formatTimer.bind(this.appState);

  // Enlarged image state
  enlargedImage = signal<string | null>(null);

  onProjectTitleInput(event: Event): void {
    this.appState.projectTitleUserEdited.set(true);
    this.projectTitle.set((event.target as HTMLInputElement).value);
  }

  onPoemInput(event: Event): void {
    const newText = (event.target as HTMLTextAreaElement).value;
    this.poemText.set(newText);
    
    if (!this.appState.projectTitleUserEdited()) {
      const firstLine = newText.split('\n')[0].trim();
      this.projectTitle.set(firstLine);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.characterReferenceImage.set(e.target.result);
        this.loggingService.log(`User uploaded image: ${file.name}`, 'action', { size: file.size, type: file.type });
        this.generatePromptFromUploadedImage();
      };
      reader.readAsDataURL(file);
      input.value = ''; // Clear the input value to allow re-selecting the same file
    }
  }

  onPromptInput(event: Event): void {
    this.characterPromptStep1.set((event.target as HTMLTextAreaElement).value);
  }

  async generatePromptFromUploadedImage() {
    const image = this.characterReferenceImage();
    if (!image || this.isCreatingCharacterPrompt()) return;

    this.loggingService.log('Auto-generating character prompt from new image.', 'action');
    this.isCreatingCharacterPrompt.set(true);
    this.appState.startTimer('createCharacterPrompt', e => this.createCharacterPromptElapsed.set(e));

    const prompt = await this.geminiService.generatePromptFromImage(image);
    if (prompt) {
      this.characterPromptStep1.set(prompt);
    }
    
    this.appState.stopTimer('createCharacterPrompt');
    this.createCharacterPromptElapsed.set(0);
    this.isCreatingCharacterPrompt.set(false);
  }

  async createCharacterPrompt() {
    if (this.isCreatingCharacterPrompt()) return;
    this.loggingService.log('User clicked "Create" character prompt', 'action', { poem: this.poemText() });
    this.isCreatingCharacterPrompt.set(true);
    this.appState.startTimer('createCharacterPrompt', e => this.createCharacterPromptElapsed.set(e));

    const styles = this.appState.drawingStyles;
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    this.loggingService.log(`Random style selected for prompt: ${randomStyle}`, 'info');

    this.appState.selectedStyles.set([randomStyle]);

    const prompt = await this.geminiService.generateCharacterPromptFromPoem(this.poemText(), randomStyle);
    if (prompt) {
      this.characterPromptStep1.set(prompt);
    }
    
    this.appState.stopTimer('createCharacterPrompt');
    this.createCharacterPromptElapsed.set(0);
    this.isCreatingCharacterPrompt.set(false);
  }

  async makeCharacterImage(isRemake = false) {
    const prompt = this.characterPromptStep1().trim();
    if (!prompt || this.isMakingCharacterImage()) return;
    this.loggingService.log(`User clicked "${isRemake ? 'Remake' : 'Make'}" character image`, 'action', { prompt });
    this.isMakingCharacterImage.set(true);
    this.appState.startTimer('makeCharacterImage', e => this.makeCharacterImageElapsed.set(e));

    const additionalNegativePrompts = ['multiple characters', 'other people', 'animals', 'pets', 'crowd', 'group of people'];
    const newImage = await this.geminiService.generateImageFromPrompt(prompt, '9:16', additionalNegativePrompts);
    if (newImage) {
      this.characterReferenceImage.set(newImage);
    } else {
      this.loggingService.log(
        'Image generation API call succeeded but returned no image. This may be due to safety filters. Please try modifying your prompt.',
        'api-error'
      );
    }
    
    this.appState.stopTimer('makeCharacterImage');
    this.makeCharacterImageElapsed.set(0);
    this.isMakingCharacterImage.set(false);
  }
  
  async proceedToCharacterStep() {
    this.loggingService.log(`User clicked 'Next: Refine Character'`, 'action');
    if (this.isStep1Valid()) {
      // Pass the state to Step 2
      this.appState.characterPrompt.set(this.characterPromptStep1());
      this.appState.generatedCharacterImage.set(this.characterReferenceImage());
      this.appState.step.set(2);
    }
  }

  resetStep1() {
    this.loggingService.log(`User reloaded Step 1`, 'action');
    this.geminiService.error.set(null);
    this.appState.resetStep1();
  }

  enlargeImage(src: string | null): void {
    if (src) {
      this.enlargedImage.set(src);
    }
  }

  closeEnlargedImage(): void {
    this.enlargedImage.set(null);
  }
}
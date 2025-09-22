import { Component, ChangeDetectionStrategy, inject, effect } from '@angular/core';
import { GeminiService } from './services/gemini.service';
import { AppStateService } from './services/app-state.service';
import { LoggingService } from './services/logging.service';

import { LogPanelComponent } from './components/log-panel/log-panel.component';
import { Step1SetupComponent } from './components/step1-setup/step1-setup.component';
import { Step2CharacterComponent } from './components/step2-character/step2-character.component';
import { Step3ScenesComponent } from './components/step3-scenes/step3-scenes.component';
import { Step4EditorComponent } from './components/step4-editor/step4-editor.component';
// Note: SceneCardComponent is repurposed as Step5AssetsComponent
import { SceneCardComponent } from './components/scene-card/scene-card.component';
// Note: Step5FinalizeComponent is repurposed as Step6SocialComponent
import { Step5FinalizeComponent } from './components/step5-finalize/step5-finalize.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  // FIX: Corrected typo from Change_DetectionStrategy to ChangeDetectionStrategy.
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LogPanelComponent,
    Step1SetupComponent,
    Step2CharacterComponent,
    Step3ScenesComponent,
    Step4EditorComponent,
    SceneCardComponent, // Repurposed as Step 5: Assets
    Step5FinalizeComponent // Repurposed as Step 6: Social
  ],
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  private appStateService = inject(AppStateService);
  private loggingService = inject(LoggingService);

  // App State
  step = this.appStateService.step;
  
  // Service Error Signal
  apiError = this.geminiService.error;
  
  constructor() {
    this.loggingService.log("Application Initialized.");

    // Global error handler effect
    effect(() => {
      if (this.apiError()) {
        // Stop all loading states if an error occurs
        this.appStateService.stopAllLoadingStates();
      }
    });
  }
}
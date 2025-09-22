import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { LoggingService } from '../../services/logging.service';

@Component({
  selector: 'app-log-panel',
  standalone: true,
  templateUrl: './log-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogPanelComponent {
  loggingService = inject(LoggingService);

  logs = this.loggingService.logs;
  isVisible = this.loggingService.isVisible;

  clearLogs() {
    this.loggingService.clearLogs();
    this.loggingService.log('Logs cleared.', 'info');
  }
  
  toggleVisibility() {
    this.loggingService.toggleVisibility();
  }

  formatDetails(details: any): string {
    if (typeof details === 'undefined' || details === null) return '';
    try {
      // Attempt to pretty-print JSON, otherwise fallback to string conversion
      return JSON.stringify(details, null, 2);
    } catch (e) {
      return String(details);
    }
  }
}

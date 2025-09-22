import { Injectable, signal } from '@angular/core';
import { LogEntry } from '../models';

@Injectable({
  providedIn: 'root',
})
export class LoggingService {
  logs = signal<LogEntry[]>([]);
  isVisible = signal<boolean>(false);
  totalCost = signal<number>(0);

  addToTotalCost(cost: number) {
    this.totalCost.update(current => current + cost);
  }

  log(message: string, type: LogEntry['type'] = 'info', details?: any) {
    let finalMessage = message;
    if (type === 'api-success' && this.totalCost() > 0) {
      finalMessage += ` | Project Total: $${this.totalCost().toFixed(6)}`;
    }

    this.logs.update(currentLogs => {
      const newLogs = [
        { timestamp: new Date(), message: finalMessage, type, details },
        ...currentLogs
      ];
      // Keep the log array from getting too large
      if (newLogs.length > 100) {
        return newLogs.slice(0, 100);
      }
      return newLogs;
    });
  }

  clearLogs() {
    this.logs.set([]);
  }

  resetTotalCost() {
    if (this.totalCost() > 0) {
        this.totalCost.set(0);
        this.log('Project cost tracker has been reset.', 'info');
    }
  }

  toggleVisibility() {
    this.isVisible.update(v => !v);
  }
}
/**
 * Maxi Agent Logger
 * All functions must log per Guardian rules
 */

export enum LogType {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Debug = 'debug',
}

export interface LogEntry {
  timestamp: string;
  type: LogType;
  component: string;
  message: string;
  data?: unknown;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  log(type: LogType, component: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type,
      component,
      message,
      data,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with color coding
    const prefix = `[${entry.timestamp}] [${component}]`;
    switch (type) {
      case LogType.Info:
        console.log(`%c${prefix} ${message}`, 'color: #3b82f6', data || '');
        break;
      case LogType.Success:
        console.log(`%c${prefix} ${message}`, 'color: #22c55e', data || '');
        break;
      case LogType.Warning:
        console.warn(`${prefix} ${message}`, data || '');
        break;
      case LogType.Error:
        console.error(`${prefix} ${message}`, data || '');
        break;
      case LogType.Debug:
        console.debug(`${prefix} ${message}`, data || '');
        break;
    }
  }

  info(component: string, message: string, data?: unknown): void {
    this.log(LogType.Info, component, message, data);
  }

  success(component: string, message: string, data?: unknown): void {
    this.log(LogType.Success, component, message, data);
  }

  warn(component: string, message: string, data?: unknown): void {
    this.log(LogType.Warning, component, message, data);
  }

  error(component: string, message: string, data?: unknown): void {
    this.log(LogType.Error, component, message, data);
  }

  debug(component: string, message: string, data?: unknown): void {
    this.log(LogType.Debug, component, message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getRecentLogs(count: number): LogEntry[] {
    return this.logs.slice(-count);
  }

  clear(): void {
    this.logs = [];
  }
}

// Singleton instance
export const logger = new Logger();
export default logger;

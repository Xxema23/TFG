// src/components/simulator/DetailTablesPanel/utils/PerformanceMonitor.ts

// SOLUCIÓN 1: Para Vite (recomendada)
class PerformanceMonitor {
  private metrics = new Map<string, number>();
  private history = new Map<string, number[]>();
  private isEnabled = true;

  constructor() {
    // Para Vite usar import.meta.env
    this.isEnabled = import.meta.env.DEV;
  }

  startMeasure(name: string) {
    if (!this.isEnabled) return;
    this.metrics.set(name, performance.now());
  }

  endMeasure(name: string): number {
    if (!this.isEnabled) return 0;

    const startTime = this.metrics.get(name);
    if (!startTime) return 0;

    const duration = performance.now() - startTime;
    this.metrics.delete(name);

    return this.recordMeasure(name, duration);
  }

  private recordMeasure(name: string, duration: number): number {
    const history = this.history.get(name) || [];
    history.push(duration);

    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.history.set(name, history);

    const emoji = this.getPerformanceEmoji(duration);
    const color = this.getPerformanceColor(duration);

    console.log(
      `%c${emoji} ${name}: ${duration.toFixed(2)}ms`,
      `color: ${color}; font-weight: bold;`
    );

    return duration;
  }

  private getPerformanceEmoji(duration: number): string {
    if (duration < 16) return '🚀';
    if (duration < 33) return '⚡';
    if (duration < 50) return '⚠️';
    if (duration < 100) return '🐌';
    return '💀';
  }

  private getPerformanceColor(duration: number): string {
    if (duration < 16) return '#00ff00';
    if (duration < 33) return '#ffff00';
    if (duration < 50) return '#ffa500';
    if (duration < 100) return '#ff0000';
    return '#800080';
  }

  measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!this.isEnabled) return fn();

    this.startMeasure(name);
    return fn().finally(() => this.endMeasure(name));
  }

  measureSync<T>(name: string, fn: () => T): T {
    if (!this.isEnabled) return fn();

    this.startMeasure(name);
    const result = fn();
    this.endMeasure(name);
    return result;
  }

  getStats(name: string) {
    const history = this.history.get(name) || [];
    if (history.length === 0) return null;

    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    const min = Math.min(...history);
    const max = Math.max(...history);

    return {
      avg: Number(avg.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      count: history.length
    };
  }

  getAllStats() {
    const stats: Record<string, any> = {};
    for (const [name] of this.history) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }

  reset() {
    this.metrics.clear();
    this.history.clear();
    console.log('📊 Performance monitor reset');
  }
}

export default PerformanceMonitor;
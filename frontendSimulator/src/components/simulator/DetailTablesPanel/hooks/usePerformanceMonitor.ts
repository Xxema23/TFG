import { useRef, useEffect } from 'react';
import PerformanceMonitor from '../utils/PerformanceMonitor';

export const UsePerformanceMonitor = () => {
  const monitor = useRef(new PerformanceMonitor());
  
  useEffect(() => {
    // Log stats periódicamente en desarrollo
    if (import.meta.env.DEV) {
      const interval = setInterval(() => {
        const stats = monitor.current.getAllStats();
        if (Object.keys(stats).length > 0) {
          console.group('📊 Performance Stats');
          console.table(stats);
          console.groupEnd();
        }
      }, 30000); // Cada 30 segundos
      
      return () => clearInterval(interval);
    }
  }, []);
  
  return monitor.current;
};
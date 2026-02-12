import { useRef, useEffect } from 'react';
import PerformanceMonitor from '../utils/PerformanceMonitor';

export const UsePerformanceMonitor = () => {
  const monitor = useRef(new PerformanceMonitor());
    
  return monitor.current;
};
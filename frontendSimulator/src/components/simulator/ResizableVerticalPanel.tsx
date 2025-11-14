// components/ResizableVerticalPanel.tsx
import React, { useState, useEffect, useRef, ReactNode } from 'react';

interface ResizableVerticalPanelProps {
  top: ReactNode;
  bottom: ReactNode;
  initialBottomHeight?: string;
}

const ResizableVerticalPanel: React.FC<ResizableVerticalPanelProps> = ({
  top,
  bottom,
  initialBottomHeight = '30%'
}) => {
  const [bottomHeight, setBottomHeight] = useState(initialBottomHeight);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerHeight = containerRect.height;
      const mousePosition = e.clientY - containerRect.top;
      const bottomHeightValue = 100 - (mousePosition / containerHeight) * 100;
      
      // Limitar el tamaño del panel inferior entre 20% y 80%
      const limitedHeight = Math.max(20, Math.min(80, bottomHeightValue));
      setBottomHeight(`${limitedHeight}%`);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  
  return (
    <div ref={containerRef} className="flex flex-col h-full relative overflow-hidden">
      {/* Panel Superior */}
      <div 
        className="flex-grow overflow-hidden" 
        style={{ height: `calc(100% - ${bottomHeight})` }}
      >
        {top}
      </div>
      
      {/* Divisor Redimensionable */}
      <div 
        className="h-1 bg-gray-300 cursor-row-resize hover:bg-blue-400 relative z-10"
        onMouseDown={handleMouseDown}
      />
      
      {/* Panel Inferior */}
      <div 
        className="overflow-hidden"
        style={{ height: bottomHeight }}
      >
        {React.cloneElement(bottom as React.ReactElement, {
          key: 'bottom-panel-' + Date.now()
        })}
      </div>
    </div>
  );
};

export default ResizableVerticalPanel;
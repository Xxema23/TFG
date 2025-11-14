// src/components/simulator/DetailTablesPanel/components/ResizableDivider.tsx
import React from 'react';

interface ResizableDividerProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({ onMouseDown }) => {
  return (
    <div
      className="w-1 h-full bg-gray-300 cursor-col-resize hover:bg-blue-500 active:bg-blue-600 transition-colors"
      onMouseDown={onMouseDown}
    />
  );
};

export default ResizableDivider;
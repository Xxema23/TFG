// components/DateEditor.tsx - OPTIMIZADO CON REACT.MEMO
import React, { memo, useCallback, useState, useEffect, useRef } from 'react';

interface DateEditorProps {
  currentDate: string;
  isEditing: boolean;
  onStartEdit: (e: React.MouseEvent) => void;
  onSave: (newDate: string) => void;
  onCancel: (e: React.MouseEvent) => void;
  onDateChange: (date: string) => void;
  value: string;
}

// ✅ REACT.MEMO: Optimizar DateEditor para evitar re-renders innecesarios
export const DateEditor: React.FC<DateEditorProps> = memo(({
  currentDate,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDateChange,
  value
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayDate, setDisplayDate] = useState('');
  
  // Formatear la fecha para mostrar solo DD/MM/YYYY
  useEffect(() => {
    if (currentDate) {
      try {
        const date = new Date(currentDate);
        if (isNaN(date.getTime())) {
          // Si no es una fecha válida, mostrar el texto original
          setDisplayDate(currentDate);
          return;
        }
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        setDisplayDate(`${day}/${month}/${year}`);
      } catch (e) {
        // Si hay error en el formato, mostrar la fecha original
        setDisplayDate(currentDate);
      }
    } else {
      setDisplayDate('');
    }
  }, [currentDate]);

  // ✅ OPTIMIZACIÓN: Memorizar handler de cambio de fecha
  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onDateChange(e.target.value);
  }, [onDateChange]);

  // ✅ OPTIMIZACIÓN: Memorizar handler de click en input
  const handleInputClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);
  
  // Manejar keypresses - guardar con Enter, cancelar con Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel(e as unknown as React.MouseEvent);
    }
  }, [onSave, onCancel, value]);
  
  // Manejar pegado de texto
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData.getData('text');
    
    // Intentar interpretar la fecha pegada en varios formatos comunes
    let parsedDate = '';
    
    // Intentar interpretar la fecha en formatos comunes
    const dateFormats = [
      // DD/MM/YYYY
      /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
      // YYYY-MM-DD (ISO)
      /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
    ];
    
    for (const format of dateFormats) {
      const match = clipboardData.match(format);
      if (match) {
        // Dependiendo del formato, ordenar los componentes
        if (format === dateFormats[0]) {
          // DD/MM/YYYY
          const [_, day, month, year] = match;
          parsedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          // YYYY-MM-DD
          const [_, year, month, day] = match;
          parsedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        break;
      }
    }
    
    if (parsedDate) {
      e.preventDefault();
      onDateChange(parsedDate);
    }
  }, [onDateChange]);
  
  // Manejar doble clic para editar
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    onStartEdit(e);
  }, [onStartEdit]);

  if (isEditing) {
    return (
      <div className="flex items-center space-x-1">
        <input
          ref={inputRef}
          type="date"
          className="px-1 py-0.5 border rounded text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value}
          onChange={handleDateChange}
          onClick={handleInputClick}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          autoFocus
        />
        <button 
          className="text-green-600 hover:text-green-800 w-4 h-4 flex items-center justify-center"
          onClick={() => onSave(value)}
          title="Guardar"
        >
          ✓
        </button>
        <button 
          className="text-red-600 hover:text-red-800 w-4 h-4 flex items-center justify-center"
          onClick={onCancel}
          title="Cancelar"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center group cursor-pointer"
      onDoubleClick={handleDoubleClick}
    >
      <span className="text-xs">{displayDate}</span>
      <button 
        className="ml-1 text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onStartEdit}
        title="Editar fecha"
      >
        ✎
      </button>
    </div>
  );
}, (prevProps, nextProps) => {
  // ✅ Comparación personalizada para evitar re-renders cuando no es necesario
  return (
    prevProps.currentDate === nextProps.currentDate &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.value === nextProps.value
  );
});

DateEditor.displayName = 'DateEditor';
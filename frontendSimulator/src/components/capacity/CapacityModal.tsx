import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUniqueLines } from '../../hooks/UseUniqueLines';
import { CapacityData } from '../../interfaces/Capacity';
import { getCapacities } from '../../services/capacityService';

interface CapacityModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSave?: (capacities: CapacityData[], deletions: { line: string; week: number; year: number }[]) => void;
  scenarioId?: number | null;
}

const getCurrentWeekNumber = (date = new Date()): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.ceil((target.getTime() - firstThursday.getTime()) / 604800000);
};

const getScenarioName = (scenarioId: number | null): string => {
  if (!scenarioId) return '';
  
  const scenarios: Record<number, string> = {
    1: 'Escenario 1-1.5 a 3T',
    2: 'Escenario 2-1.3 a 2T',
    3: 'Escenario 3-3T',
  };
  
  return scenarios[scenarioId] || `Escenario ${scenarioId}`;
};

const getWeeksInDateRange = (startDate: Date, endDate: Date): number[] => {
  const weeks: number[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const weekNumber = getCurrentWeekNumber(currentDate);
    if (!weeks.includes(weekNumber)) {
      weeks.push(weekNumber);
    }
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return weeks;
};

const MAX_CAPACITY = 1000;
const DEFAULT_CAPACITY = 0;
const WEEKS_PER_PAGE = 5;

const CapacityModal: React.FC<CapacityModalProps> = ({
  isOpen = false,
  onClose = () => {},
  onSave = () => {},
  scenarioId = 1,
}) => {
  const { lines: availableLines, isLoading: linesLoading } = useUniqueLines();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCapacities, setIsLoadingCapacities] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [isMultiSelecting, setIsMultiSelecting] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentWeek = getCurrentWeekNumber();
  const today = new Date();
  
  const pastDate = new Date(today);
  pastDate.setDate(today.getDate() - 20);
  
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 90);
  
  const allWeeksInRange = useMemo(() => {
    return getWeeksInDateRange(pastDate, futureDate);
  }, []);
  
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [currentPage, setCurrentPage] = useState<number>(0);
  
  const visibleWeeks = useMemo(() => {
    const startIdx = currentPage * WEEKS_PER_PAGE;
    return allWeeksInRange.slice(startIdx, startIdx + WEEKS_PER_PAGE);
  }, [allWeeksInRange, currentPage]);
  
  const [capacityValues, setCapacityValues] = useState<Record<string, Record<number, number>>>({});
  const [originalCapacities, setOriginalCapacities] = useState<Record<string, Record<number, number>>>({});

  const loadExistingCapacities = useCallback(async () => {
    if (!scenarioId || !isOpen) return;

    setIsLoadingCapacities(true);
    try {
      
      const existingCapacities = await getCapacities(scenarioId, selectedYear);

      const newCapacityValues: Record<string, Record<number, number>> = {};
      
      existingCapacities.forEach(capacity => {
        if (!newCapacityValues[capacity.line]) {
          newCapacityValues[capacity.line] = {};
        }
        newCapacityValues[capacity.line][capacity.week] = capacity.value;
      });

      setCapacityValues(newCapacityValues);
      setOriginalCapacities(JSON.parse(JSON.stringify(newCapacityValues)));
      
    } catch (error) {
      console.error("Error al cargar capacidades existentes:", error);
    } finally {
      setIsLoadingCapacities(false);
    }
  }, [scenarioId, selectedYear, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadExistingCapacities();
    }
  }, [isOpen, selectedYear]);
  
  useEffect(() => {
    if (isOpen) {
      setSelectedCells(new Set());
      setIsMultiSelecting(false);
      setEditingCell(null);
      setTempValue('');
      setIsSubmitting(false);
      setCurrentPage(0);
    }
  }, [isOpen]);

  const totalPages = Math.ceil(allWeeksInRange.length / WEEKS_PER_PAGE);

  const handleCellClick = (line: string, week: number, event: React.MouseEvent) => {
    if (isSubmitting || isLoadingCapacities) return;
    
    const cellId = `${line}-${week}`;
    
    if (editingCell) {
      const [editLine, editWeekStr] = editingCell.split('-');
      const editWeek = parseInt(editWeekStr, 10);
      const numValue = Number(tempValue);
      
      if (!isNaN(numValue) && numValue >= 0 && numValue <= MAX_CAPACITY) {
        if (selectedCells.size > 0) {
          setCapacityValues(prev => {
            const newValues = { ...prev };
            selectedCells.forEach(cellId => {
              const [cellLine, cellWeekStr] = cellId.split('-');
              const cellWeek = parseInt(cellWeekStr, 10);
              
              if (!newValues[cellLine]) newValues[cellLine] = {};
              newValues[cellLine][cellWeek] = numValue;
            });
            return newValues;
          });
        } else {
          setCapacityValues(prev => {
            const newValues = { ...prev };
            if (!newValues[editLine]) newValues[editLine] = {};
            newValues[editLine][editWeek] = numValue;
            return newValues;
          });
        }
      }
      
      setEditingCell(null);
      setSelectedCells(new Set());
      setIsMultiSelecting(false);
    }
    
    if (event.ctrlKey || event.metaKey) {
      setIsMultiSelecting(true);
      setSelectedCells(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(cellId)) {
          newSelection.delete(cellId);
        } else {
          newSelection.add(cellId);
        }
        return newSelection;
      });
    } else if (isMultiSelecting) {
      setSelectedCells(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(cellId)) {
          newSelection.delete(cellId);
        } else {
          newSelection.add(cellId);
        }
        return newSelection;
      });
    } else {
      setSelectedCells(new Set([cellId]));
      setEditingCell(cellId);
      const currentValue = capacityValues[line]?.[week] || DEFAULT_CAPACITY;
      setTempValue(currentValue.toString());
    }
  };

  const handleDoubleClick = () => {
    if (selectedCells.size > 0) {
      const firstCell = Array.from(selectedCells)[0];
      setEditingCell(firstCell);
      
      const [line, weekStr] = firstCell.split('-');
      const week = parseInt(weekStr, 10);
      const value = capacityValues[line]?.[week] || DEFAULT_CAPACITY;
      setTempValue(value.toString());
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const numValue = Number(tempValue);
      
      if (!isNaN(numValue) && numValue >= 0 && numValue <= MAX_CAPACITY) {
        setCapacityValues(prev => {
          const newValues = { ...prev };
          
          if (selectedCells.size > 0) {
            selectedCells.forEach(cellId => {
              const [line, weekStr] = cellId.split('-');
              const week = parseInt(weekStr, 10);
              
              if (!newValues[line]) newValues[line] = {};
              newValues[line][week] = numValue;
            });
          } else if (editingCell) {
            const [line, weekStr] = editingCell.split('-');
            const week = parseInt(weekStr, 10);
            
            if (!newValues[line]) newValues[line] = {};
            newValues[line][week] = numValue;
          }
          
          return newValues;
        });
        
        setEditingCell(null);
        setSelectedCells(new Set());
        setIsMultiSelecting(false);
      } else {
        alert(`Por favor, introduce un valor entre 0 y ${MAX_CAPACITY}`);
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setSelectedCells(new Set());
      setIsMultiSelecting(false);
    }
  };

  const prepareCapacityDataForSave = (): { 
    capacities: CapacityData[], 
    deletions: { line: string; week: number; year: number }[] 
  } => {
    const capacities: CapacityData[] = [];
    const deletions: { line: string; week: number; year: number }[] = [];
    
    Object.entries(capacityValues).forEach(([line, weekValues]) => {
      Object.entries(weekValues).forEach(([weekStr, value]) => {
        const week = parseInt(weekStr, 10);
        const originalValue = originalCapacities[line]?.[week];
        
        if (value > 0) {
          capacities.push({
            year: selectedYear,
            week,
            line,
            value
          });
        } else if (originalValue !== undefined && originalValue > 0) {
          deletions.push({
            line,
            week,
            year: selectedYear
          });
        }
      });
    });
    
    return { capacities, deletions };
  };

  const isSubmittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    if (editingCell) {
      const [line, weekStr] = editingCell.split('-');
      const week = parseInt(weekStr, 10);
      const numValue = Number(tempValue);
      
      if (!isNaN(numValue) && numValue >= 0 && numValue <= MAX_CAPACITY) {
        setCapacityValues(prev => {
          const newValues = { ...prev };
          
          if (selectedCells.size > 0) {
            selectedCells.forEach(cellId => {
              const [cellLine, cellWeekStr] = cellId.split('-');
              const cellWeek = parseInt(cellWeekStr, 10);
              
              if (!newValues[cellLine]) newValues[cellLine] = {};
              newValues[cellLine][cellWeek] = numValue;
            });
          } else {
            if (!newValues[line]) newValues[line] = {};
            newValues[line][week] = numValue;
          }
          
          return newValues;
        });
      }
      
      setEditingCell(null);
      setSelectedCells(new Set());
    }
    
    setIsSubmitting(true);
    
    try {
      const { capacities, deletions } = prepareCapacityDataForSave();
      await onSave(capacities, deletions);
    } catch (error) {
      console.error('Error al guardar capacidades:', error);
      alert('Error al guardar las capacidades. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      setEditingCell(null);
      setSelectedCells(new Set());
      setIsMultiSelecting(false);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
      setEditingCell(null);
      setSelectedCells(new Set());
      setIsMultiSelecting(false);
    }
  };

  const hasLines = availableLines && availableLines.length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] overflow-auto">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-6xl mx-4 my-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Modificar Capacidad Semanal</h2>
            {scenarioId && (
              <p className="text-sm text-gray-600 mt-1">
                {getScenarioName(scenarioId)}
              </p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
            disabled={isSubmitting || isLoadingCapacities}
            type="button"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoadingCapacities && (
          <div className="bg-blue-50 p-3 rounded-md mb-4 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-3"></div>
            <span className="text-blue-700 text-sm">Cargando capacidades existentes...</span>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="year" className="text-sm font-medium text-gray-700">
              Año:
            </label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm"
              disabled={isSubmitting || isLoadingCapacities}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handlePreviousPage}
              className="p-1 rounded-full hover:bg-gray-100"
              disabled={isSubmitting || isLoadingCapacities || currentPage === 0}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium">
              Página {currentPage + 1} de {totalPages}
            </span>
            <button
              type="button"
              onClick={handleNextPage}
              className="p-1 rounded-full hover:bg-gray-100"
              disabled={isSubmitting || isLoadingCapacities || currentPage === totalPages - 1}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {selectedCells.size > 1 && (
          <div className="bg-blue-50 p-2 rounded-md mb-4 flex justify-between items-center">
            <span className="text-sm text-blue-700">
              {selectedCells.size} celdas seleccionadas. Haga doble clic para editar todas a la vez.
            </span>
            <button 
              type="button" 
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={handleDoubleClick}
              disabled={isLoadingCapacities}
            >
              Editar selección
            </button>
          </div>
        )}

        {linesLoading || isLoadingCapacities ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">
                {linesLoading ? "Cargando líneas de producción..." : "Cargando capacidades..."}
              </p>
            </div>
          </div>
        ) : !hasLines ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">No hay líneas disponibles</h3>
                <p className="text-yellow-600 mb-4">
                  No se pudieron cargar las líneas de producción. Por favor, verifica si hay datos disponibles.
                </p>
                <button 
                  onClick={() => window.location.reload()}
                  className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
                >
                  Recargar página
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr>
                    <th className="border border-gray-300 bg-gray-100 p-2 text-left text-sm font-semibold">
                      Línea
                    </th>
                    {visibleWeeks.map((week) => (
                      <th 
                        key={week} 
                        className="border border-gray-300 bg-gray-100 p-2 text-center text-sm font-semibold"
                      >
                        Semana {week}
                        {week === currentWeek && (
                          <div className="text-xs text-blue-600 font-normal">(actual)</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {availableLines.map((line) => (
                    <tr key={line}>
                      <td className="border border-gray-300 p-2 text-sm font-medium">
                        {line}
                      </td>
                      {visibleWeeks.map((week) => {
                        const cellId = `${line}-${week}`;
                        const isSelected = selectedCells.has(cellId);
                        const isEditing = editingCell === cellId || (editingCell && selectedCells.has(cellId));
                        const value = capacityValues[line]?.[week] || DEFAULT_CAPACITY;
                        const originalValue = originalCapacities[line]?.[week];
                        const hasCustomValue = value > 0;
                        const wasModified = originalValue !== value;
                        
                        return (
                          <td 
                            key={cellId}
                            className={`border border-gray-300 p-1 text-center cursor-pointer ${
                              isSelected ? 'bg-blue-100 border-blue-400' : ''
                            } ${hasCustomValue ? 'bg-green-50' : wasModified ? 'bg-orange-50' : ''}`}
                            onClick={(e) => handleCellClick(line, week, e)}
                            onDoubleClick={isSelected ? handleDoubleClick : undefined}
                          >
                            {isEditing ? (
                              <input
                                type="number"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                className="w-16 p-1 text-center border border-blue-500 rounded"
                                min="0"
                                max={MAX_CAPACITY}
                                step="1"
                                autoFocus
                                style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                              />
                            ) : (
                              <span className={`block w-full h-full ${
                                hasCustomValue ? 'font-medium text-green-700' : 
                                wasModified ? 'font-medium text-orange-700' : 'text-gray-400'
                              }`}>
                                {value}
                                {hasCustomValue && (
                                  <div className="text-xs text-green-600">h/día</div>
                                )}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-600">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-50 border border-green-200 rounded mr-2"></div>
                    <span>Capacidad personalizada</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-orange-50 border border-orange-200 rounded mr-2"></div>
                    <span>Se eliminará (0)</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded mr-2"></div>
                    <span>Capacidad por defecto</span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-sm rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || isLoadingCapacities}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || isLoadingCapacities || !hasLines}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="mt-4 border-t pt-3 text-xs text-gray-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <p>• Haga clic en una celda para editarla</p>
              <p>• Use Ctrl+clic para seleccionar varias celdas</p>
            </div>
            <div>
              <p>• Doble clic para editar varias celdas a la vez</p>
              <p>• Valor 0 = eliminar capacidad personalizada</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CapacityModal;
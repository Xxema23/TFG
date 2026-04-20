import React, { memo, useCallback, useState, useRef } from 'react';
import CapacityModal from '../capacity/CapacityModal';
import api from '../../api';
import { useGlobalLoading } from '../../App';
import { useFabricacionesContext } from '../../contexts/FabricacionesContext';
import { useCapacity } from '../../contexts/CapacityContext';
import ImportExcelModal from './ImportExcelModal';
import { generarExcel } from '../../services/generarExcel';
import { IFabricacionConHoras } from '../../interfaces/IFabricacionConHoras';

type ControlButtonsProps = {
  scenarioId: number | null;
  currentView?: string;
  onViewChange?: (view: string) => void;
  fabricacionesFiltradas?: IFabricacionConHoras[];
};
const ControlButtons: React.FC<ControlButtonsProps> = memo(({ 
  scenarioId, 
  currentView, 
  onViewChange,
  fabricacionesFiltradas
}) => {
  const { setGlobalLoading } = useGlobalLoading();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Obtener del contexto
  const { 
    hasPendingChanges, 
    pendingChanges, 
    savePendingChanges 
  } = useFabricacionesContext();

  const {
    isCapacityModalOpen,
    openCapacityModal,
    closeCapacityModal,
    handleSaveCapacity,
  } = useCapacity();

  const handleCapacityClick = useCallback(() => {
    if (scenarioId) {
      openCapacityModal();
    }
  }, [scenarioId, openCapacityModal]);


  const checkImportStatus = useCallback(async () => {
    try {
      const response = await api.get('/import-status');
      const status = response.data;

      if (status.status === 'completed') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        setGlobalLoading(true, 'Datos actualizados. Recargando aplicación...');
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } else if (status.status === 'error') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        setGlobalLoading(false);
        alert(`❌ Error al procesar los datos:\n${status.message}`);

      } else if (status.status === 'running') {
        const minutes = status.running_for_minutes || 0;
        setGlobalLoading(true, `Cargando datos... (${Math.floor(minutes)} min)`);
      }

    } catch (error) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      setGlobalLoading(false);
      alert('❌ Error al comunicarse con el servidor');
    }
  }, [setGlobalLoading]);

  const handleUpdateDataClick = useCallback(async () => {
    if (!scenarioId) {
      return;
    }

    const confirmUpdate = window.confirm(
      '¿Deseas actualizar los datos desde los archivos Excel?\n\n' +
      'Este proceso puede tardar varios minutos.\n' +
      'La página se bloqueará hasta que termine.'
    );

    if (!confirmUpdate) {
      return;
    }

    try {
      setGlobalLoading(true, 'Procesando archivos Excel y actualizando base de datos...');
      
      const response = await api.get('/run-python');
      
      pollingIntervalRef.current = setInterval(() => {
        checkImportStatus();
      }, 3000);

      setTimeout(() => checkImportStatus(), 1000);
      
    } catch (error) {
      setGlobalLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ Error al iniciar la actualización:\n${errorMessage}`);
    }
  }, [scenarioId, setGlobalLoading, checkImportStatus]);

  // ✅ NUEVA FUNCIÓN: Guardar cambios pendientes
  const handleOthersClick = useCallback(async () => {
    if (!scenarioId) {
      alert('⚠️ Selecciona un escenario primero');
      return;
    }

    if (!hasPendingChanges) {
      alert('ℹ️ No hay cambios pendientes para guardar');
      return;
    }

    const confirmSave = window.confirm(
      `¿Deseas guardar ${pendingChanges.size} cambio(s) pendiente(s) en la base de datos?\n\n` +
      'Esto guardará todos los cambios de:\n' +
      '• Secuencias\n' +
      '• Fechas objetivo\n' +
      '• Líneas de producción'
    );

    if (!confirmSave) {
      return;
    }

    try {
      setGlobalLoading(true, `Guardando ${pendingChanges.size} cambios en la base de datos...`);
      
      const result = await savePendingChanges();
      
      setGlobalLoading(false);
      
      if (result.success) {
        alert(`✅ ${result.saved} cambios guardados correctamente en la base de datos`);
      } else {
        const errorDetails = result.errors.map(e => `  • ${e.NumWO}: ${e.error}`).join('\n');
        alert(
          `⚠️ Guardado parcial:\n\n` +
          `✅ Guardados: ${result.saved}\n` +
          `❌ Fallidos: ${result.failed}\n\n` +
          `Errores:\n${errorDetails}`
        );
      }
    } catch (error) {
      setGlobalLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ Error al guardar cambios:\n${errorMessage}`);
    }
  }, [scenarioId, hasPendingChanges, pendingChanges, savePendingChanges, setGlobalLoading]);

  const handleGenerarExcel = useCallback(async () => {
  if (!fabricacionesFiltradas || fabricacionesFiltradas.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  setGlobalLoading(true, 'Generando Excel...');
  try {
    await generarExcel(fabricacionesFiltradas);
  } finally {
    setGlobalLoading(false);
  }
}, [fabricacionesFiltradas, setGlobalLoading]);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  React.useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className="flex space-x-2">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={handleCapacityClick}
          disabled={!scenarioId}
          title={!scenarioId ? "Selecciona un escenario para modificar la capacidad" : "Modificar capacidad semanal"}
        >
          Capacidad
        </button>
        
        <button
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => setIsImportModalOpen(true)}
          disabled={!scenarioId}
          title="Importar datos desde Excel"
        >
          Importar Datos
        </button>
        
        {/* ✅ BOTÓN MODIFICADO: Cambia color y texto cuando hay cambios */}
        <button
          className={`px-4 py-2 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            hasPendingChanges 
              ? 'bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-lg animate-pulse' 
              : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
          }`}
          onClick={handleOthersClick}
          disabled={!scenarioId}
          title={
            !scenarioId 
              ? "Selecciona un escenario primero" 
              : hasPendingChanges
              ? `Guardar ${pendingChanges.size} cambio(s) pendiente(s) en la base de datos`
              : "No hay cambios pendientes para guardar"
          }
        >
          {hasPendingChanges ? (
            <>
              💾 Guardar Cambios ({pendingChanges.size})
            </>
          ) : (
            'Aún no hay cambios'
          )}
        </button>
        <button
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={handleGenerarExcel}
          disabled={!scenarioId}
          title="Generar Excel con la planificación actual"
        >
          📊 Generar Excel
        </button>
      </div>

      <CapacityModal
        isOpen={isCapacityModalOpen}
        onClose={closeCapacityModal}
        onSave={handleSaveCapacity}
        scenarioId={scenarioId ?? 1}
      />
      <ImportExcelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </>
  );
});

ControlButtons.displayName = 'ControlButtons';

export default ControlButtons;
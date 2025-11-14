// ControlButtons.tsx - SIN LOGS EN CONSOLA
import React, { memo, useCallback, useState, useRef } from 'react';
import CapacityModal from '../capacity/CapacityModal';
import { CapacityData } from '../../interfaces/Capacity';
import { saveCapacities } from '../../services/CapacityService';
import api from '../../api';
import { useGlobalLoading } from '../../App';

type ControlButtonsProps = {
  scenarioId: number | null;
  currentView?: string;
  onViewChange?: (view: string) => void;
};

const ControlButtons: React.FC<ControlButtonsProps> = memo(({ 
  scenarioId, 
  currentView, 
  onViewChange 
}) => {
  const [isCapacityModalOpen, setIsCapacityModalOpen] = useState(false);
  const { setGlobalLoading } = useGlobalLoading();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleCapacityClick = useCallback(() => {
    if (scenarioId) {
      setIsCapacityModalOpen(true);
    }
  }, [scenarioId]);

  const handleCloseCapacityModal = useCallback(() => {
    setIsCapacityModalOpen(false);
  }, []);

  const handleSaveCapacities = useCallback(async (capacities: CapacityData[]) => {
    if (!scenarioId) {
      alert('Error: No hay escenario seleccionado');
      return;
    }
    
    try {
      const response = await saveCapacities(scenarioId, capacities);
      
      if (response.success) {
        const mensaje = response.message || `Se han guardado ${capacities.length} valores de capacidad exitosamente`;
        alert(`✅ ${mensaje}`);
        setIsCapacityModalOpen(false);
      } else {
        throw new Error(response.message || 'Error al guardar las capacidades');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ Error al guardar las capacidades:\n${errorMessage}`);
    }
  }, [scenarioId]);

  // ✅ Función de polling SIN LOGS
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
      
      // Iniciar polling cada 3 segundos
      pollingIntervalRef.current = setInterval(() => {
        checkImportStatus();
      }, 3000);

      // Primera verificación inmediata
      setTimeout(() => checkImportStatus(), 1000);
      
    } catch (error) {
      setGlobalLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ Error al iniciar la actualización:\n${errorMessage}`);
    }
  }, [scenarioId, setGlobalLoading, checkImportStatus]);

  const handleOthersClick = useCallback(() => {
    if (scenarioId) {
      alert(`Otros ajustes para escenario ${scenarioId} - pendiente de implementación`);
    }
  }, [scenarioId]);

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
          onClick={handleUpdateDataClick}
          disabled={!scenarioId}
          title={!scenarioId ? "Selecciona un escenario para actualizar datos" : "Actualizar datos desde archivos Excel"}
        >
          🔄 Actualizar Datos
        </button>
        
        <button
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={handleOthersClick}
          disabled={!scenarioId}
          title={!scenarioId ? "Selecciona un escenario para otros ajustes" : "Otros ajustes"}
        >
          Otros
        </button>
      </div>

      <CapacityModal
        isOpen={isCapacityModalOpen}
        onClose={handleCloseCapacityModal}
        onSave={handleSaveCapacities}
        scenarioId={scenarioId}
      />
    </>
  );
}, (prevProps, nextProps) => 
  prevProps.scenarioId === nextProps.scenarioId &&
  prevProps.currentView === nextProps.currentView
);

ControlButtons.displayName = 'ControlButtons';

export default ControlButtons;
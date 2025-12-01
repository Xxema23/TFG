import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { IFabricacionConHoras } from '../interfaces/IFabricacionConHoras';
import { getFabricacionesConHoras, updateFabricacionConHoras } from '../services/FabricacionConHoras';

// ✅ Tipo para tracking de cambios
interface PendingChange {
  NumWO: string;
  changes: Partial<IFabricacionConHoras>;
  timestamp: Date;
}

interface FabricacionesContextType {
  fabricaciones: IFabricacionConHoras[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateFabricaciones: (newFabricaciones: IFabricacionConHoras[]) => void;
  updateSingleFabricacion: (woId: string, updatedData: Partial<IFabricacionConHoras>) => void;
  onGanttOrdersChanged: (reorderedOrders: IFabricacionConHoras[], fromCapacity?: boolean) => void;
  onGanttOrderSaved: () => Promise<void>;
  hasPendingChanges: boolean;
  setHasPendingChanges: (has: boolean) => void;
  lastUpdated: Date | null;
  pendingChanges: Map<string, PendingChange>;
  savePendingChanges: () => Promise<{ success: boolean; saved: number; failed: number; errors: Array<{ NumWO: string; error: string }> }>;
  discardPendingChanges: () => void;
}

const FabricacionesContext = createContext<FabricacionesContextType | null>(null);

interface FabricacionesProviderProps {
  children: ReactNode;
}

export const FabricacionesProvider: React.FC<FabricacionesProviderProps> = ({ children }) => {
  const [fabricaciones, setFabricaciones] = useState<IFabricacionConHoras[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [originalFabricaciones, setOriginalFabricaciones] = useState<IFabricacionConHoras[]>([]);

  const refetch = useCallback(async () => {
    console.log('🔄 [FabricacionesContext] Recargando fabricaciones desde API...');
    setIsLoading(true);
    setError(null);
    try {
      const data = await getFabricacionesConHoras();
      const validFabricaciones = data.filter(fab => fab.Fch_Objetivo);
      
      setFabricaciones(validFabricaciones);
      setOriginalFabricaciones(validFabricaciones);
      setPendingChanges(new Map());
      setHasPendingChanges(false);
      setLastUpdated(new Date());
      
      console.log('✅ [FabricacionesContext] Fabricaciones cargadas:', validFabricaciones.length);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
      console.error('❌ [FabricacionesContext] Error al recargar fabricaciones:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateFabricaciones = useCallback((newFabricaciones: IFabricacionConHoras[]) => {
    console.log('📝 [FabricacionesContext] Actualizando fabricaciones:', newFabricaciones.length);
    setFabricaciones(newFabricaciones);
    setLastUpdated(new Date());
  }, []);

  const updateSingleFabricacion = useCallback((woId: string, updatedData: Partial<IFabricacionConHoras>) => {
    setFabricaciones(prev => prev.map(fab => 
      fab.NumWO === woId ? { ...fab, ...updatedData } : fab
    ));
    setLastUpdated(new Date());
    console.log('📝 [FabricacionesContext] Fabricación actualizada:', woId, updatedData);
  }, []);

  const detectChanges = useCallback((
    original: IFabricacionConHoras, 
    current: IFabricacionConHoras
  ): Partial<IFabricacionConHoras> | null => {
    const changes: Partial<IFabricacionConHoras> = {};
    let hasChanges = false;

    const originalDate = original.Fch_Objetivo?.split('T')[0] || original.Fch_Objetivo;
    const currentDate = current.Fch_Objetivo?.split('T')[0] || current.Fch_Objetivo;
    
    if (originalDate !== currentDate) {
      changes.Fch_Objetivo = current.Fch_Objetivo;
      hasChanges = true;
    }

    if (original.Secuencia !== current.Secuencia) {
      changes.Secuencia = current.Secuencia;
      hasChanges = true;
    }

    if (original.Linea !== current.Linea) {
      changes.Linea = current.Linea;
      hasChanges = true;
    }

    return hasChanges ? changes : null;
  }, []);

  const onGanttOrdersChanged = useCallback((reorderedOrders: IFabricacionConHoras[], fromCapacity = false) => {
    console.log('🔄 [FabricacionesContext] Gantt notifica cambio de órdenes:', {
      totalWOs: reorderedOrders.length,
      fromCapacity,
      primerasWOs: reorderedOrders.slice(0, 3).map(w => ({
        NumWO: w.NumWO,
        Fecha: w.Fch_Objetivo,
        Linea: w.Linea,
        Seq: w.Secuencia
      }))
    });
    
    setFabricaciones(reorderedOrders);
    setLastUpdated(new Date());

    if (fromCapacity) {
      console.log('⚠️ Cambio desde capacidad, actualizando snapshot original (NO se trackea)');
      setOriginalFabricaciones([...reorderedOrders]);
      return;
    }

    const newPendingChanges = new Map<string, PendingChange>();
    
    reorderedOrders.forEach(currentWO => {
      const originalWO = originalFabricaciones.find(o => o.NumWO === currentWO.NumWO);
      
      if (!originalWO) {
        console.warn('⚠️ WO no encontrada en original:', currentWO.NumWO);
        return;
      }

      const changes = detectChanges(originalWO, currentWO);
      
      if (changes) {
        newPendingChanges.set(currentWO.NumWO, {
          NumWO: currentWO.NumWO,
          changes,
          timestamp: new Date()
        });
        
        console.log(`📝 Cambio detectado en ${currentWO.NumWO}:`, changes);
      }
    });

    setPendingChanges(newPendingChanges);
    setHasPendingChanges(newPendingChanges.size > 0);

    console.log(`✅ Total cambios pendientes: ${newPendingChanges.size}`);
  }, [originalFabricaciones, detectChanges]);

  const savePendingChanges = useCallback(async () => {
    if (pendingChanges.size === 0) {
      console.log('ℹ️ No hay cambios pendientes para guardar');
      return { success: true, saved: 0, failed: 0, errors: [] };
    }

    console.log(`💾 [FabricacionesContext] Guardando ${pendingChanges.size} cambios...`);
    
    let saved = 0;
    let failed = 0;
    const errors: Array<{ NumWO: string; error: string }> = [];

    const savePromises = Array.from(pendingChanges.values()).map(async (pendingChange) => {
      try {
        console.log(`   💾 Guardando ${pendingChange.NumWO}:`, pendingChange.changes);
        
        await updateFabricacionConHoras(pendingChange.NumWO, pendingChange.changes);
        
        saved++;
        console.log(`   ✅ ${pendingChange.NumWO} guardado`);
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        errors.push({ NumWO: pendingChange.NumWO, error: errorMsg });
        console.error(`   ❌ Error guardando ${pendingChange.NumWO}:`, errorMsg);
      }
    });

    await Promise.all(savePromises);

    console.log(`✅ Guardado completado: ${saved} éxitos, ${failed} fallos`);

    if (failed === 0) {
      setPendingChanges(new Map());
      setHasPendingChanges(false);
      setOriginalFabricaciones([...fabricaciones]);
      console.log('✅ Todos los cambios guardados, snapshot actualizado');
    }

    return { success: failed === 0, saved, failed, errors };
  }, [pendingChanges, fabricaciones]);

  const discardPendingChanges = useCallback(() => {
    console.log('🔄 [FabricacionesContext] Descartando cambios pendientes');
    setFabricaciones([...originalFabricaciones]);
    setPendingChanges(new Map());
    setHasPendingChanges(false);
    setLastUpdated(new Date());
    console.log('✅ Cambios descartados, datos revertidos');
  }, [originalFabricaciones]);

  const onGanttOrderSaved = useCallback(async () => {
    console.log('💾 [FabricacionesContext] Gantt notifica que se guardaron los cambios');
    await savePendingChanges();
    await refetch();
  }, [savePendingChanges, refetch]);

  useEffect(() => {
    if (fabricaciones.length === 0 && !isLoading && !error) {
      console.log('🚀 [FabricacionesContext] Cargando datos iniciales...');
      refetch();
    }
  }, []);

  const value: FabricacionesContextType = {
    fabricaciones,
    isLoading,
    error,
    refetch,
    updateFabricaciones,
    updateSingleFabricacion,
    onGanttOrdersChanged,
    onGanttOrderSaved,
    hasPendingChanges,
    setHasPendingChanges,
    lastUpdated,
    pendingChanges,
    savePendingChanges,
    discardPendingChanges
  };

  return (
    <FabricacionesContext.Provider value={value}>
      {children}
    </FabricacionesContext.Provider>
  );
};

export const useFabricacionesContext = () => {
  const context = useContext(FabricacionesContext);
  if (!context) {
    throw new Error('useFabricacionesContext debe usarse dentro de FabricacionesProvider');
  }
  return context;
};
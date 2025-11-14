import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { IFabricacionConHoras } from '../interfaces/IFabricacionConHoras';
import { getFabricacionesConHoras } from '../services/FabricacionConHoras';

interface FabricacionesContextType {
  fabricaciones: IFabricacionConHoras[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateFabricaciones: (newFabricaciones: IFabricacionConHoras[]) => void;
  updateSingleFabricacion: (woId: string, updatedData: Partial<IFabricacionConHoras>) => void;
  onGanttOrdersChanged: (reorderedOrders: IFabricacionConHoras[]) => void;
  onGanttOrderSaved: () => Promise<void>;
  hasPendingChanges: boolean;
  setHasPendingChanges: (has: boolean) => void;
  lastUpdated: Date | null;
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

  const refetch = useCallback(async () => {
    console.log('🔄 [FabricacionesContext] Recargando fabricaciones desde API...');
    setIsLoading(true);
    setError(null);
    try {
      const data = await getFabricacionesConHoras();
      const validFabricaciones = data.filter(fab => fab.Fch_Objetivo);
      setFabricaciones(validFabricaciones);
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

  // ✅ CRÍTICO: Remover useCallback para que SIEMPRE use el estado más reciente
  const onGanttOrdersChanged = (reorderedOrders: IFabricacionConHoras[]) => {
    console.log('🔄 [FabricacionesContext] Gantt notifica cambio de órdenes:', reorderedOrders.length);
    console.log('   📊 Primeras 3 órdenes:', reorderedOrders.slice(0, 3).map(o => ({
      NumWO: o.NumWO,
      Fch: o.Fch_Objetivo,
      Seq: o.Secuencia
    })));
    
    setFabricaciones(reorderedOrders);
    setHasPendingChanges(true);
    setLastUpdated(new Date());
  };

  const onGanttOrderSaved = useCallback(async () => {
    console.log('💾 [FabricacionesContext] Gantt notifica que se guardaron los cambios');
    setHasPendingChanges(false);
    await refetch();
  }, [refetch]);

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
    lastUpdated
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
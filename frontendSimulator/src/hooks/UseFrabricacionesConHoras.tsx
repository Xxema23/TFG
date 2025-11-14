import { useFabricacionesContext } from '../contexts/FabricacionesContext';

export const useFabricacionesConHoras = () => {
  const context = useFabricacionesContext();

  return {
    data: context.fabricaciones,
    isLoading: context.isLoading,
    error: context.error,
    refetch: context.refetch,
    hasPendingChanges: context.hasPendingChanges,
    lastUpdated: context.lastUpdated
  };
};
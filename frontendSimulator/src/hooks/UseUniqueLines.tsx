import { useMemo } from 'react';
import { useFabricacionesConHoras } from './UseFrabricacionesConHoras';
import { IFabricacionConHoras } from '../interfaces/IFabricacionConHoras';

interface UseUniqueLinesResult {
  lines: string[];
  isLoading: boolean;
  error: unknown;
}

export const useUniqueLines = (): UseUniqueLinesResult => {
  const { data = [], isLoading, error } = useFabricacionesConHoras();

  const lines = useMemo(() => {
    const validLines = data
      .map((item: IFabricacionConHoras) => item.Linea?.trim())
      .filter((line): line is string => !!line);
    return [...new Set(validLines)];
  }, [data]);

  return { lines, isLoading, error };
};

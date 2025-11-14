// src/services/vacacionesServices.tsx
import api from '../api';
import { IVacaciones } from '../interfaces/IVcaciones';



export const getNonWorkingDays = async (): Promise<string[]> => {
    try {
      const response = await api.get<IVacaciones[]>('/dias-no-laborales');
      
      // Verificación robusta de la respuesta
      if (!Array.isArray(response?.data)) {
        console.error('Estructura de respuesta inválida:', response);
        return [];
      }
  
      return response.data.map(item => item.vacaciones.split(' ')[0]); // Extrae solo la fecha
    } catch (error) {
      console.error('Error al obtener días no laborales:', error);
      return []; // Retorna array vacío como fallback
    }
  };
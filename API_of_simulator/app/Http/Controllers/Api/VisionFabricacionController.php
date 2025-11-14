<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VisionFabricacion;
use Illuminate\Http\Request;

class VisionFabricacionController extends Controller
{
    /**
     * Mostrar una lista de todas las fabricaciones.
     */
    public function index()
    {
        // Obtenemos todas las fabricaciones
        $fabricaciones = VisionFabricacion::all();
        return response()->json($fabricaciones);
    }

    /**
     * Guardar una nueva fabricación.
     */
    public function store(Request $request)
    {
        // Creamos la nueva fabricación sin validación
        $fabricacion = VisionFabricacion::create($request->all());

        return response()->json($fabricacion, 201);
    }

    /**
     * Mostrar una fabricación específica.
     */
    public function show($id)
    {
        // Buscamos la fabricación
        $fabricacion = VisionFabricacion::find($id);

        if (!$fabricacion) {
            return response()->json(['message' => 'Fabricación no encontrada'], 404);
        }

        return response()->json($fabricacion);
    }

    /**
     * Actualizar una fabricación existente.
     */
    public function update(Request $request, $id)
    {
        // Buscamos la fabricación
        $fabricacion = VisionFabricacion::find($id);

        if (!$fabricacion) {
            return response()->json(['message' => 'Fabricación no encontrada'], 404);
        }

        // Actualizamos la fabricación sin validación
        $fabricacion->update($request->all());

        return response()->json($fabricacion);
    }

    /**
     * Eliminar una fabricación.
     */
    public function destroy($id)
    {
        // Buscamos la fabricación
        $fabricacion = VisionFabricacion::find($id);

        if (!$fabricacion) {
            return response()->json(['message' => 'Fabricación no encontrada'], 404);
        }

        // Eliminamos la fabricación
        $fabricacion->delete();

        return response()->json(['message' => 'Fabricación eliminada correctamente']);
    }
}

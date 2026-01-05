<?php

namespace App\Http\Controllers;

use App\Models\CapacidadSemanalPersonalizada;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class CapacidadSemanalController extends Controller
{
    /**
     * GET /api/scenarios/{scenarioId}/capacidades-semanales?year=2025
     */
    public function index(Request $request, int $scenarioId): JsonResponse
    {
        try {
            $query = CapacidadSemanalPersonalizada::where('id_escenario', $scenarioId);

            if ($request->has('year')) {
                $query->where('anio', $request->year);
            }

            if ($request->has('week')) {
                $query->where('semana', $request->week);
            }

            $capacidades = $query->orderBy('anio')
                ->orderBy('semana')
                ->orderBy('linea')
                ->get()
                ->map(function ($cap) {
                    return [
                        'line' => $cap->linea,
                        'week' => $cap->semana,
                        'year' => $cap->anio,
                        'value' => (float) $cap->capacidad_diaria
                    ];
                });

            return response()->json($capacidades, 200);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener capacidades semanales',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/scenarios/{scenarioId}/capacidades-semanales
     * Body: [{"line":"S21","week":51,"year":2025,"value":15}]
     */
    public function saveBatch(Request $request, int $scenarioId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            '*.line' => 'required|string|max:10',
            '*.week' => 'required|integer|min:1|max:53',
            '*.year' => 'required|integer|min:2020|max:2050',
            '*.value' => 'required|numeric|min:0|max:1000'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $capacidades = $request->all();
            $saved = [];

            foreach ($capacidades as $capacidad) {
                if ($capacidad['value'] > 0) {
                    CapacidadSemanalPersonalizada::updateOrCreate(
                        [
                            'id_escenario' => $scenarioId,
                            'linea' => $capacidad['line'],
                            'semana' => $capacidad['week'],
                            'anio' => $capacidad['year']
                        ],
                        [
                            'capacidad_diaria' => $capacidad['value']
                        ]
                    );

                    $saved[] = "{$capacidad['line']}-{$capacidad['week']}-{$capacidad['year']}";
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Capacidades semanales guardadas correctamente',
                'saved' => count($saved),
                'items' => $saved
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Error al guardar capacidades semanales',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * DELETE /api/scenarios/{scenarioId}/capacidades-semanales
     * Body: [{"line":"S21","week":51,"year":2025}]
     */
    public function deleteBatch(Request $request, int $scenarioId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            '*.line' => 'required|string|max:10',
            '*.week' => 'required|integer|min:1|max:53',
            '*.year' => 'required|integer|min:2020|max:2050'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $deletions = $request->all();
            $deleted = 0;

            foreach ($deletions as $deletion) {
                $deleted += CapacidadSemanalPersonalizada::where('id_escenario', $scenarioId)
                    ->where('linea', $deletion['line'])
                    ->where('semana', $deletion['week'])
                    ->where('anio', $deletion['year'])
                    ->delete();
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Capacidades semanales eliminadas correctamente',
                'deleted' => $deleted
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Error al eliminar capacidades semanales',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ColoresWoControllerDisponible extends Controller
{
    public function index(Request $request)
    {
        try {
            // Validar request
            $request->validate([
                'wos' => 'required|array',
                'wos.*' => 'required|string',
                'limit' => 'sometimes|integer|min:1|max:100'
            ]);

            $wos = $request->input('wos');
            $totalLimit = $request->input('limit', 10);

            Log::info('📊 Consulta colores-wo-disponible', [
                'wos' => $wos,
                'limit' => $totalLimit
            ]);

            // ✅ PASO 1: Verificar qué WOs existen en vision_fabricacion
            $existingWOs = DB::table('vision_fabricacion')
                ->whereIn('wo', $wos)
                ->pluck('wo')
                ->toArray();

            Log::info('🔍 WOs encontrados en vision_fabricacion', [
                'solicitados' => count($wos),
                'encontrados' => count($existingWOs),
                'wos' => $existingWOs
            ]);

            // Si ningún WO existe, retornar vacío
            if (empty($existingWOs)) {
                Log::warning('⚠️ Ningún WO encontrado en vision_fabricacion');
                return response()->json([]);
            }

            // ✅ PASO 2: Buscar componentes en ctb para los WOs existentes
            $placeholders = implode(',', array_fill(0, count($existingWOs), '?'));

            $query = "
                SELECT 
                    ctb.production_order AS wo,
                    ctb.item_code,
                    COALESCE(ctb.item_description, '') AS item_description,
                    COALESCE(ctb.req_quantity, 0)::integer AS req_quantity,
                    COALESCE(SUBSTRING(ctb.req_date FROM 1 FOR 10), '') AS fecha_entrega,
                    COALESCE(ctb.req_quantity, 0)::text AS formatted_value,
                    CASE 
                        WHEN ctb.supply = 'On Hand' THEN 'VERDE'
                        WHEN ctb.supply IS NULL THEN 'ROJO'
                        ELSE 'AMARILLO'
                    END AS color_wo,
                    COALESCE(stocks.exist, '0') AS stock_global
                FROM ctb
                LEFT JOIN stocks ON stocks.articulo = ctb.item_code
                WHERE ctb.production_order IN ($placeholders)
                    AND ctb.item_code IS NOT NULL
                    AND ctb.item_code != ''
                ORDER BY ctb.production_order, ctb.item_code
            ";

            $results = DB::select($query, $existingWOs);

            Log::info('🔍 Componentes encontrados en ctb', [
                'total' => count($results)
            ]);

            // ✅ PASO 3: Identificar WOs SIN componentes
            $wosWithComponents = array_unique(array_column($results, 'wo'));
            $wosWithoutComponents = array_diff($existingWOs, $wosWithComponents);

            Log::info('📊 Análisis de componentes', [
                'con_componentes' => count($wosWithComponents),
                'sin_componentes' => count($wosWithoutComponents),
                'wos_sin_componentes' => array_values($wosWithoutComponents)
            ]);

            // ✅ PASO 4: Para WOs sin componentes, agregar registro especial
            $finalResults = [];

            // Agregar componentes encontrados
            foreach ($results as $item) {
                $finalResults[] = [
                    'wo' => (string) $item->wo,
                    'item_code' => (string) $item->item_code,
                    'item_description' => (string) $item->item_description,
                    'req_quantity' => (int) $item->req_quantity,
                    'stock_global' => (int) $item->stock_global,
                    'disponible' => (int) $item->stock_global, // Inicialmente = stock global
                    'fecha_entrega' => (string) $item->fecha_entrega,
                    'formatted_value' => (string) $item->formatted_value,
                    'color_wo' => (string) $item->color_wo
                ];
            }

            // Agregar indicador para WOs sin componentes
            foreach ($wosWithoutComponents as $wo) {
                $finalResults[] = [
                    'wo' => (string) $wo,
                    'item_code' => 'NO_COMPONENTS',
                    'item_description' => 'Este WO no tiene componentes asignados',
                    'req_quantity' => 0,
                    'stock_global' => 0,
                    'disponible' => 0,
                    'fecha_entrega' => '',
                    'formatted_value' => '0',
                    'color_wo' => 'GRIS'
                ];
            }

            // ✅ PASO 5: Agrupar por WO y aplicar límite
            $groupedByWo = [];
            foreach ($finalResults as $row) {
                $wo = $row['wo'];
                if (!isset($groupedByWo[$wo])) {
                    $groupedByWo[$wo] = [];
                }
                $groupedByWo[$wo][] = $row;
            }

            // Aplicar límite por WO
            $limitedResults = [];
            foreach ($groupedByWo as $wo => $items) {
                $limitedItems = array_slice($items, 0, $totalLimit);
                $limitedResults = array_merge($limitedResults, $limitedItems);
            }

            Log::info('✅ Respuesta generada', [
                'total_registros' => count($limitedResults),
                'wos_procesados' => count($groupedByWo)
            ]);

            return response()->json($limitedResults);

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('❌ Error de validación', ['errors' => $e->errors()]);
            return response()->json([
                'error' => 'Datos de entrada inválidos',
                'details' => $e->errors()
            ], 422);

        } catch (\Exception $e) {
            Log::error('❌ Error en colores-wo-disponible', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Error al obtener disponibilidad',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ColoresWoController extends Controller
{
    public function index(Request $request)
    {
        try {
            Log::info('🔍 [ColoresWo] Consultando colores de WO');
            
            $results = DB::table('ctb')
                ->select(
                    'production_order as wo',
                    DB::raw("CASE 
                        WHEN supply = 'On Hand' THEN 'VERDE'
                        WHEN supply IS NULL THEN 'ROJO'
                        ELSE 'AMARILLO'
                    END as color")
                )
                ->whereNotNull('production_order')
                ->distinct()
                ->get();
            
            // Convertir a formato [wo => color]
            $colores = [];
            foreach ($results as $row) {
                $colores[$row->wo] = $row->color;
            }
            
            Log::info('✅ Colores obtenidos:', ['total' => count($colores)]);
            
            return response()->json($colores);
            
        } catch (\Exception $e) {
            Log::error('❌ Error en ColoresWo:', [
                'message' => $e->getMessage(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'error' => true,
                'message' => 'Error al obtener colores',
                'details' => $e->getMessage()
            ], 500);
        }
    }
}
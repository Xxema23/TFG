<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class FiltrosController extends Controller
{
    /**
     * Devuelve los datos filtrados según la consulta SQL.
     */
    public function index()
    {
        // Ejecutamos la consulta SQL directamente
        $resultados = DB::select("
            SELECT 
                vf.wo AS NumWO,
                vf.num_pedido AS NumDoc,
                vf.maquina AS EquipoArticulo,
                vf.estadowo AS EstadoWO,
                vf.tip_ped AS TipDoc,
                ctb.item_code AS Articulo,
                ctb.source AS Proveedor,
                vf.fch_objetivo AS FchObjetivo
            FROM 
                vision_fabricacion vf
            LEFT JOIN 
                ctb ON ctb.production_order = vf.wo
        ");

        // Devolvemos los resultados como JSON
        return response()->json($resultados);
    }
}


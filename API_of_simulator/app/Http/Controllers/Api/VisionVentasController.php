<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VisionVenta;
use Illuminate\Http\Request;

class VisionVentasController extends Controller
{
    public function index()
    {
        return response()->json(VisionVenta::all());
    }

    public function store(Request $request)
    {
        $visionVentas = VisionVenta::create($request->all());
        return response()->json($visionVentas, 201);
    }

    public function show($id)
    {
        $visionVentas = VisionVenta::findOrFail($id);
        return response()->json($visionVentas);
    }

    public function update(Request $request, $id)
    {
        $visionVentas = VisionVenta::findOrFail($id);
        $visionVentas->update($request->all());
        return response()->json($visionVentas);
    }

    public function destroy($id)
    {
        VisionVenta::destroy($id);
        return response()->json(null, 204);
    }
}

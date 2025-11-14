<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EntregaCompra;
use Illuminate\Http\Request;

class EntregaCompraController extends Controller
{
    public function index()
    {
        return response()->json(EntregaCompra::all());
    }

    public function store(Request $request)
    {
        $entregaCompra = EntregaCompra::create($request->all());
        return response()->json($entregaCompra, 201);
    }

    public function show($id)
    {
        $entregaCompra = EntregaCompra::findOrFail($id);
        return response()->json($entregaCompra);
    }

    public function update(Request $request, $id)
    {
        $entregaCompra = EntregaCompra::findOrFail($id);
        $entregaCompra->update($request->all());
        return response()->json($entregaCompra);
    }

    public function destroy($id)
    {
        EntregaCompra::destroy($id);
        return response()->json(null, 204);
    }
}

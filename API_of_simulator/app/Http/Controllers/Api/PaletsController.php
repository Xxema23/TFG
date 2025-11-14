<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Palet;
use Illuminate\Http\Request;

class PaletsController extends Controller
{
    public function index()
    {
        return response()->json(Palet::all());
    }

    public function store(Request $request)
    {
        $palet = Palet::create($request->all());
        return response()->json($palet, 201);
    }

    public function show($id)
    {
        $palet = Palet::findOrFail($id);
        return response()->json($palet);
    }

    public function update(Request $request, $id)
    {
        $palet = Palet::findOrFail($id);
        $palet->update($request->all());
        return response()->json($palet);
    }

    public function destroy($id)
    {
        Palet::destroy($id);
        return response()->json(null, 204);
    }
}

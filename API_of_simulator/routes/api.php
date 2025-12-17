<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\VisionFabricacionController;
use App\Http\Controllers\Api\HorasController;
use App\Http\Controllers\Api\VisionVentasController;
use App\Http\Controllers\Api\PaletsController;
use App\Http\Controllers\Api\CtbController;
use App\Http\Controllers\Api\EntregaCompraController;
use App\Http\Controllers\Api\StocksController;
use App\Http\Controllers\Api\DiasNoLaboralesController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\VisionFabricacionFiltro;
use App\Http\Controllers\Api\FiltrosController;
use App\Http\Controllers\Api\ColoresWoController;
use App\Http\Controllers\Api\ColoresWoControllerDisponible;
use App\Http\Controllers\Api\PaletFiltro;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');


Route::apiResource('vision-fabricacion', VisionFabricacionController::class);
Route::apiResource('horas', HorasController::class);
Route::apiResource('vision-ventas', VisionVentasController::class);
Route::apiResource('palets', PaletsController::class);
Route::apiResource('ctb', CtbController::class);
Route::apiResource('entrega-compra', EntregaCompraController::class);
Route::apiResource('stocks', StocksController::class);
Route::apiResource('dias-no-laborales', DiasNoLaboralesController::class);

// ✅ Rutas para importación asíncrona con polling
Route::get('/run-python', [ImportController::class, 'runPythonScript']);
Route::get('/import-status', [ImportController::class, 'checkStatus']);
Route::post('/import-complete', [ImportController::class, 'markComplete']);

//Rutas para las consultas específicas
Route::get('/fabricaciones-con-horas', [VisionFabricacionFiltro::class, 'getFabricacionesConHoras']);
Route::put('/fabricaciones-con-horas/{wo}', [VisionFabricacionFiltro::class, 'updateFabricacion']);
Route::put('/fabricaciones-con-horas/batch', [VisionFabricacionFiltro::class, 'updateFabricacionesBatch']);


//Ruta para acceso al enpoint de filtros
Route::get('/filtros', [FiltrosController::class, 'index']);

//Ruta para obtener la wo y su color correspondiente
Route::get('/colores-wo', [ColoresWoController::class, 'index']);
Route::get('/colores-wo-disponible', [ColoresWoControllerDisponible::class, 'index']);
Route::post('/colores-wo-disponible', [ColoresWoControllerDisponible::class, 'index']);

//Ruta para obtener el número de palets agrupados por orden de trabajo (wo)
Route::get('/paletsfiltro', [PaletFiltro::class, 'index']);
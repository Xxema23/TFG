<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VisionVenta extends Model
{
    // Nombre de la tabla
    protected $table = 'vision_ventas';

    // Clave primaria
    protected $primaryKey = 'id';

    // Laravel no gestiona timestamps en esta tabla
    public $timestamps = false;

    // Atributos asignables masivamente
    protected $fillable = [
        'num_pedido',
        'tip_ped',
        'lin_ped',
        'wo',
        'est_wo',
        'tip_wo',
        'maquina',
        'significant_code',
        'importe',
        'coste',
        'fch_pedido',
        'fch_original_prometida',
        'fch_objetivo_fab',
        'fch_acuse',
        'fch_albaran',
        'fch_factura',
        'fch_zd',
        'cod_clte',
        'cliente',
    ];

    /**
     * Relación con VisionFabricacion (cada venta puede estar asociada a una orden de fabricación).
     */
    public function visionFabricacion(): BelongsTo
    {
        return $this->belongsTo(VisionFabricacion::class, 'wo', 'wo');
    }
}

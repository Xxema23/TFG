<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Ctb extends Model
{
    // Nombre de la tabla
    protected $table = 'ctb';

    // Clave primaria
    protected $primaryKey = null;
    public $incrementing = false;

    // Laravel no gestiona timestamps automáticamente
    public $timestamps = false;

    // Atributos que se pueden asignar masivamente
    protected $fillable = [
        'production_order',
        'customer_order',
        'ctb_progress',
        'item_code',
        'item_description',
        'source',
        'req_quantity',
        'req_date',
        'build_level',
        'supply_type',
        'supply',
        'buyer',
        'supply_date',
        'supply_order_status',
        'erp_order_policy',
        'confirmation_status',
    ];

    /**
     * Relación con VisionFabricacion (cada entrada de CTB puede pertenecer a una orden de fabricación).
     */
    public function visionFabricacion(): BelongsTo
    {
        return $this->belongsTo(VisionFabricacion::class, 'production_order', 'wo');
    }
}

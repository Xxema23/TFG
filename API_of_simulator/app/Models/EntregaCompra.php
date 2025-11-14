<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EntregaCompra extends Model
{
    // Nombre de la tabla
    protected $table = 'entrega_compra';

    // Clave primaria
    protected $primaryKey = 'id';

    // Laravel no gestiona automáticamente los timestamps
    public $timestamps = false;

    // Atributos que se pueden asignar de forma masiva
    protected $fillable = [
        'est_sig',
        'est_ant',
        'fecha_prometida',
        'cod_articulo',
        'desc_articulo',
        'cant_pedida',
    ];

    /**
     * Relación con el modelo Ctb.
     * Una entrega de compra está asociada a un ítem (item_code) en CTB.
     */
    public function ctb(): BelongsTo
    {
        return $this->belongsTo(Ctb::class, 'id', 'id');
    }
}

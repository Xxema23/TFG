<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Stock extends Model
{
    // Nombre de la tabla
    protected $table = 'stocks';

    // Clave primaria
    protected $primaryKey = 'articulo';
    public $incrementing = false;
    protected $keyType = 'string';

    // Laravel no gestiona automáticamente los timestamps
    public $timestamps = false;

    // Atributos que se pueden asignar de forma masiva
    protected $fillable = [
        'articulo',
        'descripcion',
        'ubic',
        'exist',
    ];

    /**
     * Relación con el modelo Ctb.
     * Un stock está asociado a un item_code de CTB (campo 'articulo' -> 'item_code').
     */
    public function ctb(): BelongsTo
    {
        return $this->belongsTo(Ctb::class, 'id', 'id');
    }
}

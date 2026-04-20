<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VisionFabricacion extends Model
{
    protected $table = 'vision_fabricacion';
    protected $primaryKey = 'wo';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = [
        'linea', 'secuencia_fab', 'wo',
        'maquina', 'sig_code', 'estadowo', 'fch_objetivo',
        'importe', 'fch_pedido', 'fch_prometida'
    ];

    public function horas()
    {
        return $this->hasMany(Hora::class, 'wo', 'wo');
    }

    public function visionVentas()
    {
        return $this->hasMany(VisionVenta::class, 'wo', 'wo');
    }

    public function ctb()
    {
        return $this->hasMany(Ctb::class, 'production_order', 'wo');
    }

    public function palets()
    {
        return $this->hasMany(Palet::class, 'num_orden', 'wo');
    }
}

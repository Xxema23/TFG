<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiaNoLaboral extends Model
{
    use HasFactory;

    protected $table = 'dias_no_laborales';
    protected $primaryKey = 'vacaciones';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['vacaciones'];
    public $timestamps = false;
    protected $visible = ['vacaciones'];
}
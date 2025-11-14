import tkinter as tk
from tkinter import messagebox
import os
import warnings
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import re
import unicodedata
from io import StringIO

# Suprime warnings de openpyxl
warnings.filterwarnings(
    "ignore",
    message="Workbook contains no default style, apply openpyxl's default",
    module="openpyxl"
)

# --- Configuración de la conexión a PostgreSQL ---
DB_HOST = '10.122.18.111'
DB_PORT = '5432'
DB_NAME = 'carrier'
DB_USER = 'postgres'
DB_PASSWORD = 'carrier2025'

# --- Funciones de limpieza y normalización ---
def limpiar_valor(valor):
    if pd.isna(valor):
        return None
    texto = str(valor).strip()
    texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('utf-8')
    return texto

def extraer_ultimo_numero(valor):
    if isinstance(valor, str) and ' of ' in valor:
        try:
            return float(valor.split()[-1])
        except:
            pass
    return valor

def normalizar_columna(columna):
    texto = str(columna)
    for orig, repl in zip(
        ['á','é','í','ó','ú','ü','ñ','Á','É','Í','Ó','Ú','Ü','Ñ'],
        ['a','e','i','o','u','u','n']*2
    ):
        texto = texto.replace(orig, repl)
    texto = texto.lower().strip().replace(' ', '_')
    return re.sub(r'[^\w_]', '', texto)

# Procesa uno o varios Excels y los inserta en la tabla destino
def obtener_excel_mas_reciente(path):
    if os.path.isfile(path):
        return path  # Es un archivo Excel directamente
    elif os.path.isdir(path):
        archivos = [f for f in os.listdir(path) if f.lower().endswith(('.xlsx','.xls','.xlsm'))]
        if not archivos:
            raise FileNotFoundError(f"No hay archivos Excel en {path}")
        archivos.sort(key=lambda x: os.path.getmtime(os.path.join(path, x)), reverse=True)
        return os.path.join(path, archivos[0])
    else:
        raise FileNotFoundError(f"No se encontró el archivo o carpeta: {path}")

def procesar_e_insertar(config, conn):
    rutas = config.get('rutas') or [config['ruta']]
    hoja_cfg = config['hoja']
    fcampos, fdatos = config['fila_campos'] - 1, config['fila_datos'] - 1
    tabla = config['tabla']
    omitir = [normalizar_columna(c) for c in config['omit'].split(',') if c.strip()]

    dfs = []
    for ruta in rutas:
        ruta_excel = obtener_excel_mas_reciente(ruta)

        xls = pd.ExcelFile(ruta_excel)
        hoja = next((s for s in xls.sheet_names if s.lower() == hoja_cfg.lower()), None)
        if hoja is None:
            raise ValueError(f"Hoja '{hoja_cfg}' no encontrada en {ruta_excel}.")

        df = pd.read_excel(ruta_excel, sheet_name=hoja, header=fcampos,
                           skiprows=range(fcampos + 1, fdatos))
        df.dropna(how='all', inplace=True)
        df.columns = [normalizar_columna(c) for c in df.columns]
        df.drop(columns=[c for c in df.columns if c in omitir], errors='ignore', inplace=True)

        # Aquí limpiamos la columna 'wo' si existe
        if 'wo' in df.columns:
            # Limpieza de la columna 'wo' (quitar decimales)
            df['wo'] = df['wo'].apply(lambda x: str(x).split('.')[0] if pd.notna(x) else x)

        # Si estamos trabajando con la tabla 'vision_ventas', eliminamos los registros que no existan en 'vision_fabricacion'
        if tabla == 'vision_ventas':
            with conn.cursor() as cur:
                cur.execute("SELECT wo FROM vision_fabricacion;")
                wo_fabricacion = {row[0] for row in cur.fetchall()}
            df = df[df['wo'].isin(wo_fabricacion)]

        if tabla == 'ctb' and 'req_quantity' in df.columns:
            df['req_quantity'] = df['req_quantity'].apply(extraer_ultimo_numero)

        dfs.append(df)

    df_all = pd.concat(dfs, ignore_index=True)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema='public' AND table_name=%s;",
            (tabla,)
        )
        columnas_db = {row[0] for row in cur.fetchall()}

    cols_orig = df_all.columns.tolist()
    cols_final = [c for c in cols_orig if c in columnas_db]
    df_all = df_all[cols_final]

    # Limpiar los valores de las celdas
    df_all = df_all.applymap(limpiar_valor)

    # Comprobar si las claves únicas ya existen en la base de datos (por ejemplo, 'wo')
    if 'wo' in df_all.columns:  # Suponiendo que 'wo' es la clave única
        with conn.cursor() as cur:
            # Obtener todas las claves 'wo' existentes en la tabla
            cur.execute(f"SELECT wo FROM {tabla};")
            wo_existentes = {row[0] for row in cur.fetchall()}

        # Filtrar los registros que no tienen claves duplicadas
        df_all = df_all[~df_all['wo'].isin(wo_existentes)]

    # Ahora insertamos los registros restantes
    buffer = StringIO()
    df_all.to_csv(buffer, index=False, header=False, sep='\t', na_rep='\\N')
    buffer.seek(0)

    with conn.cursor() as cur:
        cur.execute("SET session_replication_role='replica';")
        cur.execute(f"TRUNCATE TABLE {tabla} RESTART IDENTITY CASCADE;")
        cur.copy_from(buffer, tabla, sep='\t', columns=cols_final, null='\\N')
        cur.execute("SET session_replication_role='origin';")

    conn.commit()

# Ejecuta todas las importaciones y reporta
def ejecutar_todo():
    errores = []
    with psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        dbname=DB_NAME, user=DB_USER,
        password=DB_PASSWORD
    ) as conn:
        for cfg in IMPORTS:
            try:
                procesar_e_insertar(cfg, conn)
            except Exception as e:
                errores.append(f"{cfg['tabla']}: {e}")
    if errores:
        messagebox.showerror("Errores en importación", "\n".join(errores))
    else:
        messagebox.showinfo("Importación completa", "Todas las tablas se importaron correctamente.")

# Directorio base
directorio_base = r'\\cesmtf01\REPORT'

# Función para verificar si una ruta es accesible
def verificar_ruta(ruta):
    try:
        print(f"Verificando la ruta: {ruta}")
        if os.path.exists(ruta):
            print(f"[OK] La ruta {ruta} existe.")
        else:
            print(f"[ERROR] La ruta {ruta} no existe.")
    except Exception as e:
        print(f"[ERROR] Error al verificar la ruta {ruta}: {e}")

# --- Configuración de rutas nuevas ---
IMPORTS = [
    {'ruta': r'\\cesmtf01\REPORT\PLANIFICACION\2.- Recursos KPIs\DIAS NO LABORALES.xlsx',
     'hoja': 'Sheet1', 'fila_campos': 1, 'fila_datos': 2,
     'omit': '', 'tabla': 'dias_no_laborales'},

    {'ruta': r'\\cesmtf01\REPORT\PLANIFICACION\2.- Recursos KPIs\VISION FABRICACION',
     'hoja': 'Datos', 'fila_campos': 5, 'fila_datos': 6,
     'omit': 'cliente,obj_fabricacion_sectores1,obj_fabricacion_sectores2,fprevini,fprevfin,fch_fin_prub',
     'tabla': 'vision_fabricacion'},
    
    {'ruta': r'\\cesmtf01\REPORT\PLANIFICACION\2.- Recursos KPIs\VISION FABRICACION',
     'hoja': 'Horas', 'fila_campos': 5, 'fila_datos': 6,
     'omit': '', 'tabla': 'horas'},
    
    {'ruta': r'\\cesmtf01\REPORT\PLANIFICACION\2.- Recursos KPIs\VISION VENTAS',
     'hoja': 'Datos', 'fila_campos': 5, 'fila_datos': 6,
     'omit': 'fch_embar_real', 'tabla': 'vision_ventas'},
    
    {'ruta': r'\\cesmtf01\REPORT\PLANIFICACION\3.- KPIs\6.- KPI CONTROL DE PALLETS\REVISION PALETIZADO',
     'hoja': 'Sheet1', 'fila_campos': 1, 'fila_datos': 2,
     'omit': 'tp_orden,est_ot,fch_entr_orden,fch_inic_fabricacion,fch_fin_fabricacion,tp_ord_rel,nº_ocov_rel,numero_linea,palet_maxqty,palet_realqty,palet_maxrow,palet_columnreal,ancho_paletequipo,profundidad_paletequipo,altura_paletequipo,peso_paletequipo,nº_corto_articulo,2º_nº_articulo,tp_ln,tipo_alm,cod_familia,palet_item_no',
     'tabla': 'palets'},
    
    {'rutas': [
         r'\\cesmtf01\REPORT\PLANIFICACION\1.- Programa Linea Montaje\6.- CTB\1.- CTB001',
         r'\\cesmtf01\REPORT\PLANIFICACION\1.- Programa Linea Montaje\6.- CTB\2.- CTB005'
     ],
     'hoja': 'Clear To Build Requirements', 'fila_campos': 1, 'fila_datos': 2,
     'omit': 'parent_order,supply_order_commit_date,supply_order_status_category',
     'tabla': 'ctb'},
    
    {'ruta': r'\\cesmtf01\REPORT\FACTORY\Existencias',
     'hoja': 'Datos', 'fila_campos': 5, 'fila_datos': 6,
     'omit': 'planta,corto,tip_lin,tip_abast,familia,tip_prodct,num_serie,fch_creacion,num_wo,est_wo,ubic1,coste07',
     'tabla': 'stocks'},

    {'ruta': r'\\cesmtf01\REPORT\PLANIFICACION\2.- Recursos KPIs\CONFIRMACIÓN FCH ENTREGA',
     'hoja': 'Datos', 'fila_campos': 5, 'fila_datos': 6,
     'omit': 'sucursal,num_documento,tipo_documento,ordenado_por,num_linea,incoterm,cod_prov,proveedor,clas_merc,costestand_07,fecha_orden,fecha_solic,pte_confirmacion,numreferencia,cod_familia,familia,cant_pendiente,coste_unitario,cant_surtida,cant_divisa,um_divisa,temporalidad',
     'tabla': 'entrega_compra'}
]


# Función para depurar el proceso de carga de IMPORTS
def depurar_imports():
    print("Iniciando depuración de rutas...")
    for ruta_info in IMPORTS:
        print(f"\nProcesando configuración de ruta: {ruta_info}")

        # Verificación de rutas individuales o listas de rutas
        if 'rutas' in ruta_info:  # Si hay varias rutas
            for ruta in ruta_info['rutas']:
                print(f"  Verificando ruta en lista: {ruta}")
                verificar_ruta(ruta)
        else:
            print(f"  Verificando ruta individual: {ruta_info['ruta']}")
            verificar_ruta(ruta_info['ruta'])

        # Información adicional de cada entrada IMPORTS
        print(f"  Hoja: {ruta_info['hoja']}")
        print(f"  Fila de campos: {ruta_info['fila_campos']}, Fila de datos: {ruta_info['fila_datos']}")
        print(f"  Campos omitidos: {ruta_info['omit']}")
        print(f"  Tabla: {ruta_info['tabla']}")
        print("-" * 50)

# Ejecución de la depuración
depurar_imports()

# --- Interfaz gráfica ---
ventana = tk.Tk()
ventana.title("Importador Múltiple Excel → PostgreSQL")

btn = tk.Button(
    ventana, text="Importar Todas las Tablas", bg="#4CAF50", fg="white",
    command=ejecutar_todo
)
btn.pack(padx=20, pady=20)

ventana.mainloop()

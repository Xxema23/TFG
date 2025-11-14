import tkinter as tk
from tkinter import filedialog, messagebox
import os
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import re
import unicodedata

# --- Configuración de la conexión a PostgreSQL ---
DB_HOST = '172.20.10.2'
DB_PORT = '5432'
DB_NAME = 'carrier'
DB_USER = 'postgres'
DB_PASSWORD = '123456'

# --- Función para limpiar valores ---
def limpiar_valor(valor):
    if pd.isna(valor):
        return None
    try:
        texto = str(valor).encode('utf-8', errors='ignore').decode('utf-8').strip()
        texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('utf-8')
        return texto
    except:
        return str(valor).strip()

# --- Extraer número a la derecha si es "2.0 of 3.0" ---
def extraer_ultimo_numero(valor):
    if isinstance(valor, str) and ' of ' in valor:
        partes = valor.strip().split(' ')
        try:
            return float(partes[-1])
        except:
            return valor
    return valor

# --- Seleccionar carpeta ---
def seleccionar_carpeta():
    carpeta = filedialog.askdirectory()
    if carpeta:
        carpeta_entry.delete(0, tk.END)
        carpeta_entry.insert(0, carpeta)
        actualizar_hojas_disponibles()

# --- Obtener archivo Excel más reciente ---
def obtener_excel_mas_reciente(carpeta):
    extensiones_validas = ('.xlsx', '.xls', '.xlsm')
    archivos = [f for f in os.listdir(carpeta) if f.endswith(extensiones_validas)]
    archivos = sorted(archivos, key=lambda x: os.path.getmtime(os.path.join(carpeta, x)), reverse=True)
    if archivos:
        return os.path.join(carpeta, archivos[0])
    return None

# --- Actualizar menú de hojas ---
def actualizar_hojas_disponibles():
    carpeta = carpeta_entry.get()
    archivo = obtener_excel_mas_reciente(carpeta)
    if archivo:
        try:
            xls = pd.ExcelFile(archivo)
            opciones_hoja.set(xls.sheet_names[0])
            menu_hojas['menu'].delete(0, 'end')
            for hoja in xls.sheet_names:
                menu_hojas['menu'].add_command(label=hoja, command=tk._setit(opciones_hoja, hoja))
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo leer el archivo Excel:\n{str(e)}")
    else:
        messagebox.showwarning("Aviso", "No se encontró ningún archivo Excel en la carpeta.")

# --- Normalizar nombres de columnas (quita TILDES) ---
def normalizar_columna(columna):
    texto = str(columna)
    # reemplazos manuales para asegurar que quita todas las tildes
    reemplazos = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
        'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ü': 'u', 'Ñ': 'n'
    }
    for orig, repl in reemplazos.items():
        texto = texto.replace(orig, repl)
    texto = texto.lower().strip().replace(' ', '_')
    texto = re.sub(r'[^\w_]', '', texto)
    return texto

# --- Insertar en base de datos ---
def insertar_en_base_de_datos():
    carpeta = carpeta_entry.get()
    hoja = opciones_hoja.get()
    nombre_tabla = entry_tabla.get().strip().lower()

    if not hoja:
        messagebox.showerror("Error", "Selecciona una hoja del archivo Excel.")
        return
    if not nombre_tabla:
        messagebox.showerror("Error", "Debes escribir el nombre de la tabla destino.")
        return

    try:
        fila_campos = int(entry_fila_campos.get()) - 1
        fila_datos = int(entry_fila_datos.get()) - 1
    except ValueError:
        messagebox.showerror("Error", "Las filas deben ser valores numéricos.")
        return

    campos_omitir = entry_columnas_omitir.get().split(',')

    archivo_excel = obtener_excel_mas_reciente(carpeta)
    if not archivo_excel:
        messagebox.showerror("Error", "No se encontró ningún archivo Excel en la carpeta.")
        return

    try:
        df = pd.read_excel(
            archivo_excel,
            sheet_name=hoja,
            header=fila_campos,
            skiprows=range(fila_campos + 1, fila_datos)
        )
        df = df.dropna(how='all')

        # —— imprime antes y después de normalizar columnas ——
        columnas_orig = df.columns.tolist()
        df.columns = [normalizar_columna(col) for col in df.columns]
        columnas_norm = df.columns.tolist()
        for o, n in zip(columnas_orig, columnas_norm):
            print(f"{o} → {n}")

        # omitir las columnas extra que quieras
        campos_a_omitir = [c.strip().lower() for c in campos_omitir]
        df = df.drop(columns=[c for c in df.columns if c in campos_a_omitir], errors='ignore')

        # limpieza especial de req_quantity en ctb
        if nombre_tabla == "ctb" and "req_quantity" in df.columns:
            df["req_quantity"] = df["req_quantity"].apply(extraer_ultimo_numero)

        if 'detail' in df.columns:
            df['detail'] = df['detail'].astype(str).str.strip()
            df = df.drop_duplicates(subset='detail')

        # conexión y truncado
        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT,
            dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD
        )
        cursor = conn.cursor()
        cursor.execute("SET session_replication_role = 'replica';")
        conn.commit()

        cursor.execute(f'TRUNCATE TABLE {nombre_tabla} RESTART IDENTITY CASCADE')
        conn.commit()

        # preparación de INSERT
        cols = list(df.columns)
        cols_sql = ', '.join(f'"{c}"' for c in cols)
        datos = [tuple(limpiar_valor(v) for v in row) for row in df.itertuples(index=False)]

        BATCH_SIZE = 10000
        total = 0
        for i in range(0, len(datos), BATCH_SIZE):
            batch = datos[i:i + BATCH_SIZE]
            query = f'INSERT INTO {nombre_tabla} ({cols_sql}) VALUES %s'
            execute_values(cursor, query, batch)
            total += len(batch)

        cursor.execute("SET session_replication_role = 'origin';")
        conn.commit()
        cursor.close()
        conn.close()

        messagebox.showinfo("Éxito", f"Se insertaron {total} filas en '{nombre_tabla}'.")
    except Exception as e:
        try:
            cursor.execute("SET session_replication_role = 'origin';")
            conn.commit()
            cursor.close()
            conn.close()
        except:
            pass
        messagebox.showerror("Error", f"Ocurrió un error:\n{e}")

# --- Interfaz gráfica ---
ventana = tk.Tk()
ventana.title("Importador Excel → PostgreSQL (Tabla editable)")

tk.Label(ventana, text="Selecciona carpeta con archivos Excel:").grid(row=0, column=0, sticky='w')
carpeta_entry = tk.Entry(ventana, width=50); carpeta_entry.grid(row=1, column=0, padx=10, pady=5)
tk.Button(ventana, text="Buscar carpeta", command=seleccionar_carpeta).grid(row=1, column=1, padx=10)

tk.Label(ventana, text="Hoja del archivo Excel:").grid(row=2, column=0, sticky='w')
opciones_hoja = tk.StringVar(ventana)
menu_hojas = tk.OptionMenu(ventana, opciones_hoja, ""); menu_hojas.grid(row=3, column=0, padx=10, pady=5)

tk.Label(ventana, text="Fila donde están los campos (número):").grid(row=4, column=0, sticky='w')
entry_fila_campos = tk.Entry(ventana); entry_fila_campos.grid(row=5, column=0, padx=10, pady=5)

tk.Label(ventana, text="Fila desde donde empiezan los datos:").grid(row=6, column=0, sticky='w')
entry_fila_datos = tk.Entry(ventana); entry_fila_datos.grid(row=7, column=0, padx=10, pady=5)

tk.Label(ventana, text="Campos a omitir (separados por coma):").grid(row=8, column=0, sticky='w')
entry_columnas_omitir = tk.Entry(ventana); entry_columnas_omitir.grid(row=9, column=0, padx=10, pady=5)

tk.Label(ventana, text="Nombre de la tabla destino:").grid(row=10, column=0, sticky='w')
entry_tabla = tk.Entry(ventana); entry_tabla.grid(row=11, column=0, padx=10, pady=5)

tk.Button(
    ventana,
    text="Insertar en Base de Datos",
    command=insertar_en_base_de_datos,
    bg="#4CAF50", fg="white"
).grid(row=12, column=0, pady=20)

ventana.mainloop()

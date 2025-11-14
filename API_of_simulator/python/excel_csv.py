import tkinter as tk
from tkinter import filedialog, messagebox
import pandas as pd

# Función para normalizar strings: minúsculas y reemplazo de "ñ"
def normalizar_string(valor):
    if isinstance(valor, str):
        return valor.lower().replace('ñ', 'n')
    return valor

# Función para convertir de Excel a CSV
def convertir_a_csv():
    try:
        # Abrir el archivo Excel
        archivo_excel = filedialog.askopenfilename(filetypes=[("Archivos Excel", "*.xlsx;*.xls")])
        
        if archivo_excel:
            # Leer el archivo Excel
            df = pd.read_excel(archivo_excel, engine='openpyxl')

            # Normalizamos los nombres de las columnas
            df.columns = [normalizar_string(col) for col in df.columns]

            # Aplicamos normalización a todas las celdas del DataFrame
            df = df.applymap(normalizar_string)

            # Seleccionar el directorio para guardar el archivo CSV
            archivo_csv = filedialog.asksaveasfilename(defaultextension=".csv", filetypes=[("Archivos CSV", "*.csv")])
            
            if archivo_csv:
                # Guardar el DataFrame en un archivo CSV
                df.to_csv(archivo_csv, index=False)
                messagebox.showinfo("Éxito", f"Archivo convertido y guardado como {archivo_csv}")
    except Exception as e:
        messagebox.showerror("Error", f"Ocurrió un error: {e}")

# Crear la ventana principal de la interfaz gráfica
root = tk.Tk()
root.title("Convertidor de Excel a CSV")
root.geometry("300x150")

# Agregar un botón para iniciar la conversión
boton_convertir = tk.Button(root, text="Convertir Excel a CSV", command=convertir_a_csv, padx=20, pady=10)
boton_convertir.pack(expand=True)

# Ejecutar la interfaz gráfica
root.mainloop()

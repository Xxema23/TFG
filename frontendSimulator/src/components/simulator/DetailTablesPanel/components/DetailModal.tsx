// src/components/simulator/DetailTablesPanel/utils/WindowManager.ts
import { WorkOrder } from '../Types';

interface ExpandedWindowOptions {
  filteredWOIds: string[];
  workOrders: WorkOrder[];
  availableComponents: string[];
  componentAvailability: Record<string, Record<string, any>>;
}

// Mapa para mantener referencias a las ventanas abiertas
const openWindows = new Map<string, Window>();

/**
 * Abre una nueva ventana con los detalles expandidos de equipos y componentes
 * manteniendo exactamente la misma interfaz de usuario que la página principal
 */
export const openExpandedWindow = (options: ExpandedWindowOptions): void => {
  // Generar ID único para esta ventana
  const windowId = `detail-window-${Date.now()}`;
  
  // Verificar si ya hay una ventana abierta y cerrarla
  const existingWindow = openWindows.get('detail-window');
  if (existingWindow && !existingWindow.closed) {
    existingWindow.close();
  }
  
  // Serializar los datos necesarios para pasar a la nueva ventana
  const { filteredWOIds, workOrders, availableComponents, componentAvailability } = options;
  
  // Serializar los datos en un formato seguro para pasar entre ventanas
  const serializedData = JSON.stringify({
    filteredWOIds,
    workOrders,
    availableComponents,
    componentAvailability
  });

  // Crear HTML para la nueva ventana
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Detalles - Simulador</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 0;
      overflow: hidden;
      height: 100vh;
    }
    
    .main-container {
      display: flex;
      width: 100%;
      height: 100%;
      overflow: hidden;
      position: relative;
    }
    
    .divider {
      width: 4px;
      height: 100%;
      background-color: #cbd5e0;
      cursor: col-resize;
    }
    
    .left-panel, .right-panel {
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .panel-header {
      font-weight: 500;
      padding: 0.5rem;
      background-color: #f3f4f6;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    
    .panel-content {
      flex: 1;
      overflow: auto;
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
    }
    
    th, td {
      border: 1px solid #e5e7eb;
      padding: 0.5rem;
      text-align: left;
      font-size: 0.75rem;
      white-space: nowrap;
    }
    
    th {
      background-color: #f9fafb;
      position: sticky;
      top: 0;
      z-index: 10;
      font-weight: 500;
    }
    
    tr:hover td {
      background-color: #f3f4f6;
    }
    
    .selected-row td {
      background-color: #e3f2fd;
    }
    
    .date-editor {
      display: flex;
      align-items: center;
    }
    
    .edit-button {
      margin-left: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    tr:hover .edit-button {
      opacity: 1;
    }
    
    .text-red {
      color: #e53e3e;
    }
    
    .text-green {
      color: #38a169;
    }
  </style>
</head>
<body>
  <div class="main-container" id="main-container">
    <!-- Panel izquierdo - Detalle Equipos -->
    <div class="left-panel" id="left-panel">
      <div class="panel-header">Detalle Equipos</div>
      <div class="panel-content" id="equipment-content">
        <table id="equipment-table">
          <thead>
            <tr>
              <th>NumWO</th>
              <th>Equipo</th>
              <th>Secuencia</th>
              <th>Línea</th>
              <th>NumDoc</th>
              <th>TipDoc</th>
              <th>Estado WO</th>
              <th>Fch Objetivo</th>
              <th>Fch Acuse</th>
              <th>Fch AlbarÁn</th>
              <th>Importe</th>
              <th>CSH total</th>
            </tr>
          </thead>
          <tbody id="equipment-tbody">
            <!-- Las filas se generarán dinámicamente -->
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Divisor redimensionable -->
    <div class="divider" id="divider"></div>
    
    <!-- Panel derecho - Detalle Componentes -->
    <div class="right-panel" id="right-panel">
      <div class="panel-header">Detalle Componentes</div>
      <div class="panel-content" id="components-content">
        <table id="components-table">
          <thead>
            <tr>
              <th>ID WO</th>
              <!-- Las columnas de componentes se generarán dinámicamente -->
            </tr>
          </thead>
          <tbody id="components-tbody">
            <!-- Las filas se generarán dinámicamente -->
          </tbody>
        </table>
      </div>
    </div>
  </div>
  
  <script>
    // Datos pasados desde la ventana principal
    const windowData = ${serializedData};
    
    // Referencias a elementos DOM
    const mainContainer = document.getElementById('main-container');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const divider = document.getElementById('divider');
    const equipmentContent = document.getElementById('equipment-content');
    const componentsContent = document.getElementById('components-content');
    
    // Estado de la interfaz
    let leftPanelWidth = 50; // Porcentaje inicial
    let selectedRows = new Set();
    let hoveredRowId = null;
    
    // Formatear moneda
    function formatCurrency(value) {
      if (!value && value !== 0) return '';
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
      }).format(value);
    }
    
    // Renderizar tablas
    function renderTables() {
      renderEquipmentTable();
      renderComponentsTable();
    }
    
    // Crear un mapa para acceso rápido a las WOs
    const workOrdersMap = {};
    windowData.workOrders.forEach(wo => {
      workOrdersMap[wo.id] = wo;
    });
    
    // Renderizar tabla de equipos
    function renderEquipmentTable() {
      const tbody = document.getElementById('equipment-tbody');
      tbody.innerHTML = '';
      
      windowData.filteredWOIds.forEach(woId => {
        const wo = workOrdersMap[woId];
        if (!wo) return;
        
        const tr = document.createElement('tr');
        tr.id = \`equipment-row-\${woId}\`;
        tr.dataset.woId = woId;
        tr.draggable = true;
        
        tr.addEventListener('mouseenter', () => handleRowHover(woId));
        tr.addEventListener('mouseleave', () => handleRowHover(null));
        tr.addEventListener('click', (e) => handleRowClick(e, woId));
        
        // Agregar eventos de arrastrar y soltar
        tr.addEventListener('dragstart', (e) => handleDragStart(e, woId));
        tr.addEventListener('dragover', (e) => handleDragOver(e, woId));
        tr.addEventListener('dragenter', (e) => handleDragEnter(e, woId));
        tr.addEventListener('dragleave', (e) => handleDragLeave(e));
        tr.addEventListener('drop', (e) => handleDrop(e, woId));
        tr.addEventListener('dragend', (e) => handleDragEnd(e));
        
        // Aplicar clases si está seleccionada o se está pasando por encima
        if (selectedRows.has(woId)) {
          tr.classList.add('selected-row');
        }
        if (hoveredRowId === woId) {
          tr.classList.add('bg-blue-50');
        }
        
        tr.innerHTML = \`
          <td>\${wo.numWO || ''}</td>
          <td>\${wo.equipo || ''}</td>
          <td>\${wo.secuencia || ''}</td>
          <td>\${wo.linea || ''}</td>
          <td>\${wo.numDoc || ''}</td>
          <td>\${wo.tipDoc || ''}</td>
          <td>\${wo.estadoWO || ''}</td>
          <td>
            <div class="date-editor">
              <span>\${wo.fchObjetivo || ''}</span>
              <button class="edit-button text-blue-500 hover:text-blue-700" title="Editar fecha">✎</button>
            </div>
          </td>
          <td>\${wo.fchAcuse || ''}</td>
          <td>\${wo.fchAlbarAn || ''}</td>
          <td>\${formatCurrency(wo.importe)}</td>
          <td>\${formatCurrency(wo.cshTotal)}</td>
        \`;
        
        tbody.appendChild(tr);
      });
    }
    
    // Renderizar tabla de componentes
    function renderComponentsTable() {
      const thead = document.querySelector('#components-table thead tr');
      const tbody = document.getElementById('components-tbody');
      
      // Limpiar contenido existente
      while (thead.children.length > 1) {
        thead.removeChild(thead.lastChild);
      }
      tbody.innerHTML = '';
      
      // Agregar encabezados de componentes
      windowData.availableComponents.forEach(component => {
        const th = document.createElement('th');
        th.textContent = component;
        thead.appendChild(th);
      });
      
      // Agregar filas de datos
      windowData.filteredWOIds.forEach(woId => {
        const tr = document.createElement('tr');
        tr.id = \`components-row-\${woId}\`;
        tr.dataset.woId = woId;
        tr.draggable = true;
        
        tr.addEventListener('mouseenter', () => handleRowHover(woId));
        tr.addEventListener('mouseleave', () => handleRowHover(null));
        tr.addEventListener('click', (e) => handleRowClick(e, woId));
        
        // Agregar eventos de arrastrar y soltar
        tr.addEventListener('dragstart', (e) => handleDragStart(e, woId));
        tr.addEventListener('dragover', (e) => handleDragOver(e, woId));
        tr.addEventListener('dragenter', (e) => handleDragEnter(e, woId));
        tr.addEventListener('dragleave', (e) => handleDragLeave(e));
        tr.addEventListener('drop', (e) => handleDrop(e, woId));
        tr.addEventListener('dragend', (e) => handleDragEnd(e));
        
        // Aplicar clases si está seleccionada o se está pasando por encima
        if (selectedRows.has(woId)) {
          tr.classList.add('selected-row');
        }
        if (hoveredRowId === woId) {
          tr.classList.add('bg-blue-50');
        }
        
        // Celda de ID
        const idCell = document.createElement('td');
        idCell.textContent = woId;
        tr.appendChild(idCell);
        
        // Celdas de componentes
        windowData.availableComponents.forEach(component => {
          const td = document.createElement('td');
          
          // Obtener valor de disponibilidad
          const value = windowData.componentAvailability[component]?.value;
          
          if (value !== undefined && value !== null) {
            // Aplicar formato según el valor
            if (typeof value === 'number') {
              td.textContent = String(value);
              if (value < 0) {
                td.classList.add('text-red');
              } else if (value > 0) {
                td.classList.add('text-green');
              }
            } else {
              td.textContent = String(value);
              if (String(value).startsWith('-') || String(value).includes('SP')) {
                td.classList.add('text-red');
              }
            }
          } else {
            td.textContent = '-';
          }
          
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
      });
    }
    
    // Manejo de hover en filas
    function handleRowHover(woId) {
      hoveredRowId = woId;
      
      // Actualizar todos los equipos y componentes
      windowData.filteredWOIds.forEach(id => {
        const equipmentRow = document.getElementById(\`equipment-row-\${id}\`);
        const componentsRow = document.getElementById(\`components-row-\${id}\`);
        
        if (equipmentRow) {
          if (id === woId) {
            equipmentRow.classList.add('bg-blue-50');
          } else {
            equipmentRow.classList.remove('bg-blue-50');
          }
        }
        
        if (componentsRow) {
          if (id === woId) {
            componentsRow.classList.add('bg-blue-50');
          } else {
            componentsRow.classList.remove('bg-blue-50');
          }
        }
      });
    }
    
    // Manejo de clic en filas
    function handleRowClick(e, woId) {
      const newSelection = new Set(selectedRows);
      
      if (e.ctrlKey || e.metaKey) {
        // Toggle selección
        if (newSelection.has(woId)) {
          newSelection.delete(woId);
        } else {
          newSelection.add(woId);
        }
      } else if (e.shiftKey) {
        // Seleccionar rango (aún no implementado)
        newSelection.add(woId);
      } else {
        // Selección simple
        newSelection.clear();
        newSelection.add(woId);
      }
      
      // Actualizar selección
      selectedRows = newSelection;
      
      // Refrescar estado visual
      windowData.filteredWOIds.forEach(id => {
        const equipmentRow = document.getElementById(\`equipment-row-\${id}\`);
        const componentsRow = document.getElementById(\`components-row-\${id}\`);
        
        if (equipmentRow) {
          if (selectedRows.has(id)) {
            equipmentRow.classList.add('selected-row');
          } else {
            equipmentRow.classList.remove('selected-row');
          }
        }
        
        if (componentsRow) {
          if (selectedRows.has(id)) {
            componentsRow.classList.add('selected-row');
          } else {
            componentsRow.classList.remove('selected-row');
          }
        }
      });
      
      // Mostrar contador de selección si hay elementos seleccionados
      updateSelectionCounter();
    }
    
    // Variables para arrastrar y soltar
    let draggedItem = null;
    let draggedOverItem = null;
    
    // Manejo de inicio de arrastre
    function handleDragStart(e, woId) {
      draggedItem = woId;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', woId);
      
      // Si la fila que estamos arrastrando no está seleccionada, seleccionarla
      if (!selectedRows.has(woId)) {
        handleRowClick(e, woId);
      }
      
      // Crear imagen de arrastre personalizada (contador de selección)
      const count = selectedRows.size;
      const dragText = count === 1 ? 'Moviendo 1 WO' : \`Moviendo \${count} WOs\`;
      
      const dragImage = document.createElement('div');
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.background = 'rgba(59, 130, 246, 0.9)';
      dragImage.style.color = 'white';
      dragImage.style.padding = '8px 12px';
      dragImage.style.borderRadius = '8px';
      dragImage.style.fontSize = '14px';
      dragImage.style.fontWeight = 'bold';
      dragImage.textContent = dragText;
      
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 50, 20);
      
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage);
        }
      }, 100);
    }
    
    // Manejo de arrastre sobre una fila
    function handleDragOver(e, woId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (draggedItem && draggedItem !== woId && !selectedRows.has(woId)) {
        draggedOverItem = woId;
      }
    }
    
    // Manejo de entrada al área de una fila
    function handleDragEnter(e, woId) {
      e.preventDefault();
      
      if (draggedItem && draggedItem !== woId && !selectedRows.has(woId)) {
        draggedOverItem = woId;
        
        // Resaltar visualmente la fila destino
        const equipmentRow = document.getElementById(\`equipment-row-\${woId}\`);
        const componentsRow = document.getElementById(\`components-row-\${woId}\`);
        
        if (equipmentRow) {
          equipmentRow.style.borderTop = '3px solid #3b82f6';
        }
        
        if (componentsRow) {
          componentsRow.style.borderTop = '3px solid #3b82f6';
        }
      }
    }
    
    // Manejo de salida del área de una fila
    function handleDragLeave(e) {
      // Si el ratón ya no está sobre la fila, eliminar resaltado
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        if (draggedOverItem) {
          // Quitar resaltado visual
          const equipmentRow = document.getElementById(\`equipment-row-\${draggedOverItem}\`);
          const componentsRow = document.getElementById(\`components-row-\${draggedOverItem}\`);
          
          if (equipmentRow) {
            equipmentRow.style.borderTop = '';
          }
          
          if (componentsRow) {
            componentsRow.style.borderTop = '';
          }
          
          draggedOverItem = null;
        }
      }
    }
    
    // Manejo de soltar
    function handleDrop(e, targetWoId) {
      e.preventDefault();
      
      if (!draggedItem || selectedRows.size === 0) {
        return;
      }
      
      // Si arrastramos sobre una WO seleccionada, no hacer nada
      if (selectedRows.has(targetWoId)) {
        resetDragState();
        return;
      }
      
      // Reordenar las filas
      const reorderedIds = [...windowData.filteredWOIds];
      const selectedIds = Array.from(selectedRows);
      
      // Remover las WOs seleccionadas
      for (let i = reorderedIds.length - 1; i >= 0; i--) {
        if (selectedRows.has(reorderedIds[i])) {
          reorderedIds.splice(i, 1);
        }
      }
      
      // Determinar nueva posición
      const targetindex = reorderedIds.indexOf(targetWoId);
      
      if (targetindex !== -1) {
        // Insertar elementos seleccionados en la nueva posición
        reorderedIds.splice(targetindex, 0, ...selectedIds);
      } else {
        // Si no se encontró el destino, agregar al final
        reorderedIds.push(...selectedIds);
      }
      
      // Actualizar orden de IDs
      windowData.filteredWOIds = reorderedIds;
      
      // Actualizar UI
      renderTables();
      
      // Resetear estado de arrastre
      resetDragState();
    }
    
    // Manejo de fin de arrastre
    function handleDragEnd(e) {
      resetDragState();
    }
    
    // Función para restablecer el estado de arrastre
    function resetDragState() {
      // Eliminar cualquier resaltado visual
      if (draggedOverItem) {
        const equipmentRow = document.getElementById(\`equipment-row-\${draggedOverItem}\`);
        const componentsRow = document.getElementById(\`components-row-\${draggedOverItem}\`);
        
        if (equipmentRow) {
          equipmentRow.style.borderTop = '';
        }
        
        if (componentsRow) {
          componentsRow.style.borderTop = '';
        }
      }
      
      // Restablecer variables
      draggedItem = null;
      draggedOverItem = null;
    }
    
    // Actualizar contador de selección
    function updateSelectionCounter() {
      // Eliminar contador existente si existe
      const existingCounter = document.getElementById('selection-counter');
      if (existingCounter) {
        existingCounter.remove();
      }
      
      // Crear nuevo contador si hay elementos seleccionados
      if (selectedRows.size > 0) {
        const counter = document.createElement('div');
        counter.id = 'selection-counter';
        counter.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg';
        counter.textContent = \`\${selectedRows.size} WO\${selectedRows.size > 1 ? 's' : ''} seleccionada\${selectedRows.size > 1 ? 's' : ''}\`;
        document.body.appendChild(counter);
      }
    }
    
    // Implementar redimensionamiento
    let isResizing = false;
    
    divider.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const containerRect = mainContainer.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Limitar el ancho a un rango razonable (20% - 80%)
      leftPanelWidth = Math.max(20, Math.min(newLeftWidth, 80));
      
      // Actualizar anchos
      updatePanelWidths();
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
    
    // Actualizar anchos de paneles
    function updatePanelWidths() {
      leftPanel.style.width = \`\${leftPanelWidth}%\`;
      rightPanel.style.width = \`\${100 - leftPanelWidth - 0.4}%\`;
    }
    
    // Sincronizar scroll entre tablas
    equipmentContent.addEventListener('scroll', () => {
      componentsContent.scrollTop = equipmentContent.scrollTop;
    });
    
    componentsContent.addEventListener('scroll', () => {
      equipmentContent.scrollTop = componentsContent.scrollTop;
    });
    
    // Inicializar la interfaz
    updatePanelWidths();
    renderTables();
    
    // Agregar evento de cierre
    window.addEventListener('beforeunload', () => {
      // Este evento se dispara antes de que la ventana se cierre
      // Aquí podrías enviar mensajes a la ventana principal si fuera necesario
    });
  </script>
</body>
</html>
  `;
  
  // Abrir la nueva ventana con opciones
  const newWindow = window.open(
    '',
    windowId,
    'width=1200,height=800,menubar=no,toolbar=no,location=no,scrollbars=yes,resizable=yes'
  );
  
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
    
    // Guardar referencia a la ventana
    openWindows.set('detail-window', newWindow);
    
    // Eliminar referencia cuando se cierre
    newWindow.addEventListener('beforeunload', () => {
      openWindows.delete('detail-window');
    });
  } else {
    // Si no se pudo abrir la ventana, mostrar un mensaje de error
    console.error('No se pudo abrir la ventana. Verifique que los popups no estén bloqueados');
    alert('No se pudo abrir la ventana. Verifique que los popups no estén bloqueados');
  }
};
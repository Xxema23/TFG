// src/components/simulator/DetailTablesPanel/utils/WindowManager.tsx
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
  
  // Estructura HTML básica
  const htmlStart = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Detalles - Simulador</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      margin: 0;
      padding: 0;
      overflow: hidden;
      height: 100vh;
    }
    .main-container {
      display: flex;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      position: relative;
    }
    .divider {
      width: 4px;
      height: 100%;
      background-color: #e5e7eb;
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
      padding: 8px;
      background-color: #f3f4f6;
      border-bottom: 1px solid #e5e7eb;
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
      border-bottom: 1px solid #e5e7eb;
      padding: 4px 8px;
      text-align: left;
      font-size: 12px;
    }
    th {
      background-color: #f9fafb;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .text-red { color: #e53e3e; }
    .text-green { color: #38a169; }
    .selection-counter {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #3b82f6;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div id="main-container" class="main-container">
    <!-- Panel izquierdo - Detalle Equipos -->
    <div id="left-panel" class="left-panel" style="width: 50%">
      <div class="panel-header">Detalle Equipos</div>
      <div id="equipment-content" class="panel-content">
        <table id="equipment-table">
          <thead>
            <tr>
              <th>NumWO</th>
              <th>Equipo</th>
              <th>Secuencia</th>
              <th>Línea</th>
              <th>NumDoc</th>
              <th>TipDoc</th>
              <th>Palets</th>
              <th>Estado WO</th>
              <th>Fch Objetivo</th>
              <th>Fch Acuse</th>
              <th>Fch AlbarÁn</th>
              <th>Importe</th>
              <th>CSH total</th>
            </tr>
          </thead>
          <tbody id="equipment-tbody"></tbody>
        </table>
      </div>
    </div>
    
    <!-- Divisor redimensionable -->
    <div id="divider" class="divider"></div>
    
    <!-- Panel derecho - Detalle Componentes -->
    <div id="right-panel" class="right-panel" style="width: calc(50% - 4px)">
      <div class="panel-header">Detalle Componentes</div>
      <div id="components-content" class="panel-content">
        <table id="components-table">
          <thead>
            <tr>
              <th>ID WO</th>
            </tr>
          </thead>
          <tbody id="components-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>
`;

  const scriptContent = `
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
    
    // Estado
    let leftPanelWidth = 50;
    let selectedRows = new Set();
    let hoveredRowId = null;
    let isDragging = false;
    let draggedItem = null;
    let draggedOverItem = null;
    
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
    
    // Crear mapa de work orders
    const workOrdersMap = {};
    windowData.workOrders.forEach(wo => {
      if (wo && wo.id) workOrdersMap[wo.id] = wo;
    });
    
    // Renderizar tabla de equipos
    function renderEquipmentTable() {
      const tbody = document.getElementById('equipment-tbody');
      tbody.innerHTML = '';
      
      windowData.filteredWOIds.forEach((woId, index) => {
        const wo = workOrdersMap[woId];
        if (!wo) return;
        
        const tr = document.createElement('tr');
        tr.id = "equipment-row-" + woId;
        tr.draggable = true;
        tr.dataset.woId = woId;
        
        if (selectedRows.has(woId)) tr.classList.add('bg-blue-100');
        if (hoveredRowId === woId) tr.classList.add('bg-blue-50');
        
        tr.addEventListener('mouseenter', () => handleRowHover(woId));
        tr.addEventListener('mouseleave', () => handleRowHover(null));
        tr.addEventListener('click', (e) => handleRowClick(e, woId, index));
        tr.addEventListener('dragstart', (e) => handleDragStart(e, woId));
        tr.addEventListener('dragover', (e) => handleDragOver(e, woId));
        tr.addEventListener('dragenter', (e) => handleDragEnter(e, woId));
        tr.addEventListener('dragleave', (e) => handleDragLeave(e));
        tr.addEventListener('drop', (e) => handleDrop(e, woId));
        tr.addEventListener('dragend', () => handleDragEnd());
        
        // Función para generar palets aleatorios
        function getPalets(wo) {
          // Generamos un valor basado en el ID para simulación
          if (!wo || !wo.id) return '-';
          const numFromId = parseInt(wo.id.replace(/\D/g, '') || '0') % 10;
          return numFromId || '-';
        }
        
        // Añadir celdas
        let html = '';
        html += '<td>' + (wo.numWO || '') + '</td>';
        html += '<td>' + (wo.equipo || '') + '</td>';
        html += '<td>' + (wo.secuencia || '') + '</td>';
        html += '<td>' + (wo.linea || '') + '</td>';
        html += '<td>' + (wo.numDoc || '') + '</td>';
        html += '<td>' + (wo.tipDoc || '') + '</td>';
        html += '<td>' + getPalets(wo) + '</td>';
        html += '<td>' + (wo.estadoWO || '') + '</td>';
        html += '<td>' + (wo.fchObjetivo || '') + '</td>';
        html += '<td>' + (wo.fchAcuse || '') + '</td>';
        html += '<td>' + (wo.fchAlbarAn || '') + '</td>';
        html += '<td>' + formatCurrency(wo.importe) + '</td>';
        html += '<td>' + formatCurrency(wo.cshTotal) + '</td>';
        
        tr.innerHTML = html;
        tbody.appendChild(tr);
      });
    }
    
    // Renderizar tabla de componentes
    function renderComponentsTable() {
      // Actualizar cabecera con componentes
      const thead = document.querySelector('#components-table thead tr');
      while (thead.children.length > 1) {
        thead.removeChild(thead.lastChild);
      }
      
      windowData.availableComponents.forEach(component => {
        const th = document.createElement('th');
        th.textContent = component;
        thead.appendChild(th);
      });
      
      // Actualizar filas
      const tbody = document.getElementById('components-tbody');
      tbody.innerHTML = '';
      
      windowData.filteredWOIds.forEach((woId, index) => {
        const tr = document.createElement('tr');
        tr.id = "components-row-" + woId;
        tr.draggable = true;
        tr.dataset.woId = woId;
        
        if (selectedRows.has(woId)) tr.classList.add('bg-blue-100');
        if (hoveredRowId === woId) tr.classList.add('bg-blue-50');
        
        tr.addEventListener('mouseenter', () => handleRowHover(woId));
        tr.addEventListener('mouseleave', () => handleRowHover(null));
        tr.addEventListener('click', (e) => handleRowClick(e, woId, index));
        tr.addEventListener('dragstart', (e) => handleDragStart(e, woId));
        tr.addEventListener('dragover', (e) => handleDragOver(e, woId));
        tr.addEventListener('dragenter', (e) => handleDragEnter(e, woId));
        tr.addEventListener('dragleave', (e) => handleDragLeave(e));
        tr.addEventListener('drop', (e) => handleDrop(e, woId));
        tr.addEventListener('dragend', () => handleDragEnd());
        
        // ID cell
        const idCell = document.createElement('td');
        idCell.textContent = woId;
        tr.appendChild(idCell);
        
        // Component cells
        windowData.availableComponents.forEach(component => {
          const td = document.createElement('td');
          const componentData = windowData.componentAvailability[component] || {};
          const value = componentData.value;
          
          if (value) {
            td.textContent = value;
            if (value < 0 || String(value).startsWith('-') || String(value).includes('SP')) {
              td.classList.add('text-red');
            } else if (value > 0) {
              td.classList.add('text-green');
            }
          } else {
            td.textContent = '-';
          }
          
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
      });
    }
    
    // Hover management
    function handleRowHover(woId) {
      hoveredRowId = woId;
      
      windowData.filteredWOIds.forEach(id => {
        const eqRow = document.getElementById("equipment-row-" + id);
        const compRow = document.getElementById("components-row-" + id);
        
        if (eqRow) {
          if (id === woId) {
            eqRow.classList.add('bg-blue-50');
          } else {
            eqRow.classList.remove('bg-blue-50');
          }
        }
        
        if (compRow) {
          if (id === woId) {
            compRow.classList.add('bg-blue-50');
          } else {
            compRow.classList.remove('bg-blue-50');
          }
        }
      });
    }
    
    // Row selection
    function handleRowClick(e, woId, index) {
      const newSelection = new Set(selectedRows);
      
      if (e.ctrlKey || e.metaKey) {
        if (newSelection.has(woId)) {
          newSelection.delete(woId);
        } else {
          newSelection.add(woId);
        }
      } else if (e.shiftKey && selectedRows.size > 0) {
        // Find last selected index
        let lastindex = -1;
        for (let i = 0; i < windowData.filteredWOIds.length; i++) {
          if (selectedRows.has(windowData.filteredWOIds[i])) {
            lastindex = i;
          }
        }
        
        if (lastindex >= 0) {
          const start = Math.min(lastindex, index);
          const end = Math.max(lastindex, index);
          
          for (let i = start; i <= end; i++) {
            newSelection.add(windowData.filteredWOIds[i]);
          }
        } else {
          newSelection.add(woId);
        }
      } else {
        newSelection.clear();
        newSelection.add(woId);
      }
      
      selectedRows = newSelection;
      
      // Update UI
      windowData.filteredWOIds.forEach(id => {
        const eqRow = document.getElementById("equipment-row-" + id);
        const compRow = document.getElementById("components-row-" + id);
        
        if (eqRow) {
          if (selectedRows.has(id)) {
            eqRow.classList.add('bg-blue-100');
          } else {
            eqRow.classList.remove('bg-blue-100');
          }
        }
        
        if (compRow) {
          if (selectedRows.has(id)) {
            compRow.classList.add('bg-blue-100');
          } else {
            compRow.classList.remove('bg-blue-100');
          }
        }
      });
      
      updateSelectionCounter();
    }
    
    // Drag & Drop
    function handleDragStart(e, woId) {
      isDragging = true;
      draggedItem = woId;
      e.dataTransfer.effectAllowed = 'move';
      
      if (!selectedRows.has(woId)) {
        handleRowClick({}, woId, windowData.filteredWOIds.indexOf(woId));
      }
      
      // Visual feedback
      windowData.filteredWOIds.forEach(id => {
        if (selectedRows.has(id)) {
          const eqRow = document.getElementById("equipment-row-" + id);
          const compRow = document.getElementById("components-row-" + id);
          
          if (eqRow) eqRow.style.opacity = '0.6';
          if (compRow) compRow.style.opacity = '0.6';
        }
      });
    }
    
    function handleDragOver(e, woId) {
      if (!isDragging) return;
      e.preventDefault();
    }
    
    function handleDragEnter(e, woId) {
      if (!isDragging) return;
      e.preventDefault();
      
      if (!selectedRows.has(woId)) {
        draggedOverItem = woId;
        
        const eqRow = document.getElementById("equipment-row-" + woId);
        const compRow = document.getElementById("components-row-" + woId);
        
        if (eqRow) eqRow.style.borderTop = '3px solid #3b82f6';
        if (compRow) compRow.style.borderTop = '3px solid #3b82f6';
      }
    }
    
    function handleDragLeave(e) {
      if (!isDragging || !draggedOverItem) return;
      e.preventDefault();
      
      const rect = e.currentTarget.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        const eqRow = document.getElementById("equipment-row-" + draggedOverItem);
        const compRow = document.getElementById("components-row-" + draggedOverItem);
        
        if (eqRow) eqRow.style.borderTop = '';
        if (compRow) compRow.style.borderTop = '';
        
        draggedOverItem = null;
      }
    }
    
    function handleDrop(e, targetWoId) {
      if (!isDragging || !draggedItem) return;
      e.preventDefault();
      
      if (selectedRows.has(targetWoId)) {
        resetDragState();
        return;
      }
      
      // Reorder
      const newOrder = [...windowData.filteredWOIds];
      const selectedIds = Array.from(selectedRows);
      
      // Remove selected items
      for (let i = newOrder.length - 1; i >= 0; i--) {
        if (selectedRows.has(newOrder[i])) {
          newOrder.splice(i, 1);
        }
      }
      
      // Find insertion point
      const targetindex = newOrder.indexOf(targetWoId);
      if (targetindex !== -1) {
        newOrder.splice(targetindex, 0, ...selectedIds);
      } else {
        newOrder.push(...selectedIds);
      }
      
      windowData.filteredWOIds = newOrder;
      renderTables();
      resetDragState();
    }
    
    function handleDragEnd() {
      resetDragState();
    }
    
    function resetDragState() {
      isDragging = false;
      draggedItem = null;
      
      windowData.filteredWOIds.forEach(id => {
        const eqRow = document.getElementById("equipment-row-" + id);
        const compRow = document.getElementById("components-row-" + id);
        
        if (eqRow) {
          eqRow.style.opacity = '';
          eqRow.style.borderTop = '';
        }
        
        if (compRow) {
          compRow.style.opacity = '';
          compRow.style.borderTop = '';
        }
      });
      
      if (draggedOverItem) {
        const eqRow = document.getElementById("equipment-row-" + draggedOverItem);
        const compRow = document.getElementById("components-row-" + draggedOverItem);
        
        if (eqRow) eqRow.style.borderTop = '';
        if (compRow) compRow.style.borderTop = '';
        
        draggedOverItem = null;
      }
    }
    
    // Selection counter
    function updateSelectionCounter() {
      const existing = document.getElementById('selection-counter');
      if (existing) existing.remove();
      
      if (selectedRows.size > 0) {
        const counter = document.createElement('div');
        counter.id = 'selection-counter';
        counter.className = 'selection-counter';
        counter.textContent = selectedRows.size + " WO" + 
          (selectedRows.size > 1 ? 's' : '') + " seleccionada" + 
          (selectedRows.size > 1 ? 's' : '');
        document.body.appendChild(counter);
      }
    }
    
    // Resizable panels
    let isResizing = false;
    
    divider.addEventListener('mousedown', function(e) {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
      if (!isResizing) return;
      
      const containerRect = mainContainer.getBoundingClientRect();
      leftPanelWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      leftPanelWidth = Math.max(20, Math.min(leftPanelWidth, 80));
      
      leftPanel.style.width = leftPanelWidth + '%';
      rightPanel.style.width = 'calc(' + (100 - leftPanelWidth) + '% - 4px)';
    });
    
    document.addEventListener('mouseup', function() {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
      }
    });
    
    // Sync scroll
    equipmentContent.addEventListener('scroll', function() {
      componentsContent.scrollTop = equipmentContent.scrollTop;
    });
    
    componentsContent.addEventListener('scroll', function() {
      equipmentContent.scrollTop = componentsContent.scrollTop;
    });
    
    // Initialize
    renderTables();
  </script>
`;

  const htmlEnd = `
</body>
</html>
`;

  // Crear HTML completo
  const html = htmlStart + scriptContent + htmlEnd;

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
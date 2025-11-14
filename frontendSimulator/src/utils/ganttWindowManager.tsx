import type { FilterValues } from '../components/simulator/FilterPanel';

interface WorkOrder {
  id: string;
  numWO: string;
  equipo: string;
  secuencia: number;
  linea: string;
  numDoc: string;
  tipDoc: string;
  estadoWO: string;
  fchObjetivo: string;
  fchAcuse: string;
  fchAlbarAn: string;
  importe: number;
  cshTotal: number;
  articulo: string;
  proveedor: string;
}

interface FilterOptions {
  linea: string[];
  numWO: string[];
  numDoc: string[];
  equipo: string[];
  estadoWO: string[];
  tipDoc: string[];
  articulo: string[];
  proveedor: string[];
}

interface ExpandedGanttWindowOptions {
  workOrders: WorkOrder[];
  workOrderColors: Record<string, string>;
  filterValues: FilterValues;
  filterOptions: FilterOptions;
  availableLines: string[];
  defaultLineFilter?: string;
  scenarioId: number | null;
}

// Mapa para mantener referencias a las ventanas abiertas
const openGanttWindows = new Map<string, Window>();

/**
 * Abre una nueva ventana con el panel de Gantt y los filtros
 * manteniendo la misma funcionalidad que la página principal
 */
export const openExpandedGanttWindow = (options: ExpandedGanttWindowOptions): void => {
  // Generar ID único para esta ventana
  const windowId = `gantt-window-${Date.now()}`;
  
  // Verificar si ya hay una ventana abierta y cerrarla
  const existingWindow = openGanttWindows.get('gantt-window');
  if (existingWindow && !existingWindow.closed) {
    existingWindow.close();
  }
  
  // Serializar los datos necesarios para pasar a la nueva ventana
  const serializedData = JSON.stringify({
    workOrders: options.workOrders,
    workOrderColors: options.workOrderColors,
    filterValues: options.filterValues,
    filterOptions: options.filterOptions,
    availableLines: options.availableLines,
    defaultLineFilter: options.defaultLineFilter,
    scenarioId: options.scenarioId
  });
  
  // Estructura HTML completa
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel Gantt y Filtros - Simulador</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      margin: 0;
      padding: 0;
      overflow: hidden;
      height: 100vh;
      background-color: #f8fafc;
    }
    .main-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100vh;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white;
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      flex-shrink: 0;
    }
    .content-area {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .gantt-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: white;
      border-right: 1px solid #e5e7eb;
      overflow: hidden;
    }
    .gantt-header {
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .gantt-content {
      flex: 1;
      overflow: auto;
      padding: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
    }
    .filters-container {
      width: 350px;
      display: flex;
      flex-direction: column;
      background: white;
      overflow: hidden;
    }
    .filters-header {
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .filters-tabs {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.25rem;
      padding: 0.5rem;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
      flex-shrink: 0;
    }
    .filter-tab {
      padding: 0.5rem;
      font-size: 0.75rem;
      cursor: pointer;
      text-align: center;
      border-radius: 0.375rem;
      transition: all 0.2s;
      position: relative;
      font-weight: 500;
    }
    .filter-tab.active {
      background-color: #3b82f6;
      color: white;
    }
    .filter-tab:not(.active) {
      background-color: white;
      color: #4b5563;
      border: 1px solid #d1d5db;
    }
    .filter-tab:not(.active):hover {
      background-color: #f3f4f6;
      color: #374151;
    }
    .filter-badge {
      position: absolute;
      top: -0.25rem;
      right: -0.25rem;
      font-size: 0.625rem;
      border-radius: 50%;
      padding: 0.125rem 0.25rem;
      min-width: 1rem;
      height: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .filter-badge.active {
      background-color: white;
      color: #3b82f6;
    }
    .filter-badge:not(.active) {
      background-color: #ef4444;
      color: white;
    }
    .search-container {
      padding: 0.75rem;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .search-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      font-size: 0.875rem;
    }
    .search-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .filter-options {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .filter-options-header {
      padding: 0.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .filter-options-content {
      flex: 1;
      overflow-y: auto;
      border: 1px solid #e5e7eb;
      border-radius: 0.375rem;
      margin: 0 0.75rem;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      padding: 0.5rem;
      border-bottom: 1px solid #f3f4f6;
    }
    .checkbox-item:hover {
      background-color: #f9fafb;
    }
    .checkbox-item:last-child {
      border-bottom: none;
    }
    .filters-summary {
      padding: 0.75rem;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      max-height: 8rem;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .gantt-placeholder {
      text-align: center;
      padding: 3rem;
    }
    .gantt-placeholder h3 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
    }
    .gantt-placeholder p {
      color: #6b7280;
      margin-bottom: 1rem;
    }
    .gantt-controls {
      display: flex;
      gap: 0.5rem;
    }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    .btn-primary {
      background-color: #3b82f6;
      color: white;
    }
    .btn-primary:hover {
      background-color: #2563eb;
    }
    .btn-secondary {
      background-color: #f3f4f6;
      color: #374151;
    }
    .btn-secondary:hover {
      background-color: #e5e7eb;
    }
    .applied-filter {
      display: inline-block;
      background-color: #dbeafe;
      color: #1e40af;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      margin: 0.125rem;
    }
    .scrollbar-thin::-webkit-scrollbar {
      width: 6px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
      background: #f1f5f9;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="main-container">
    <!-- Header -->
    <div class="header">
      <div>
        <h1 class="text-xl font-bold">Panel Gantt y Filtros</h1>
        <p class="text-sm opacity-90" id="scenario-info">Escenario: Cargando...</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-sm opacity-90" id="wo-count">0 órdenes de trabajo</div>
        <button onclick="window.close()" class="btn btn-primary">
          Cerrar Ventana
        </button>
      </div>
    </div>

    <!-- Área de contenido -->
    <div class="content-area">
      <!-- Panel Gantt -->
      <div class="gantt-container">
        <div class="gantt-header">
          <h2 class="text-lg font-semibold text-gray-800">Diagrama de Gantt</h2>
          <div class="gantt-controls">
            <button class="btn btn-secondary" onclick="zoomOut()">Zoom -</button>
            <button class="btn btn-secondary" onclick="zoomIn()">Zoom +</button>
            <button class="btn btn-secondary" onclick="resetView()">Reset</button>
          </div>
        </div>
        <div class="gantt-content">
          <div class="gantt-placeholder">
            <h3>Visualización de Gantt</h3>
            <p>Aquí se mostrarán las órdenes de trabajo en formato de diagrama de Gantt</p>
            <div class="text-sm text-gray-500">
              <p>• Órdenes organizadas por líneas de producción</p>
              <p>• Vista temporal con capacidades</p>
              <p>• Drag & drop para replanificar</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel de Filtros -->
      <div class="filters-container">
        <!-- Header de filtros -->
        <div class="filters-header">
          <h3 class="font-bold text-gray-800">FILTROS</h3>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500" id="applied-count">0 aplicados</span>
            <button onclick="clearAllFilters()" class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors">
              Limpiar
            </button>
          </div>
        </div>

        <!-- Pestañas de filtros -->
        <div class="filters-tabs" id="filterTabs">
          <!-- Se generarán dinámicamente -->
        </div>

        <!-- Búsqueda -->
        <div class="search-container" id="searchContainer">
          <input 
            type="text" 
            class="search-input" 
            id="searchInput" 
            placeholder="Buscar..."
          />
        </div>

        <!-- Opciones de filtro -->
        <div class="filter-options">
          <div class="filter-options-header">
            <span class="text-sm font-medium">Seleccionar</span>
            <div>
              <button onclick="selectAll()" class="text-xs text-blue-600 mr-2 hover:text-blue-800">Todos</button>
              <button onclick="selectNone()" class="text-xs text-blue-600 hover:text-blue-800">Ninguno</button>
            </div>
          </div>
          <div class="filter-options-content scrollbar-thin" id="filterOptionsContent">
            <!-- Se generarán dinámicamente -->
          </div>
        </div>

        <!-- Resumen de filtros aplicados -->
        <div class="filters-summary">
          <div class="text-xs font-medium text-gray-700 mb-2">
            Filtros aplicados (<span id="summary-count">0</span>):
          </div>
          <div id="applied-filters" class="scrollbar-thin">
            <div class="text-xs text-gray-500 italic">No hay filtros aplicados</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Datos pasados desde la ventana principal
    const windowData = ${serializedData};
    
    // Estado de la aplicación
    let activeTab = 'linea';
    let searchText = '';
    let zoomLevel = 1;
    
    // Filtros activos (copia local para manipulación)
    let currentFilters = JSON.parse(JSON.stringify(windowData.filterValues));
    
    // Pestañas de filtros
    const filterTabs = [
      { key: 'linea', label: 'Línea' },
      { key: 'numWO', label: 'NumWO' },
      { key: 'numDoc', label: 'NumDoc' },
      { key: 'equipo', label: 'Equipo' },
      { key: 'estadoWO', label: 'Estado' },
      { key: 'tipDoc', label: 'TipDoc' },
      { key: 'articulo', label: 'Artículo' },
      { key: 'proveedor', label: 'Proveedor' },
      { key: 'fchObjetivo', label: 'Fecha' }
    ];
    
    // Inicialización
    function init() {
      console.log('Inicializando ventana de Gantt expandida...', windowData);
      
      // Actualizar información del escenario
      document.getElementById('scenario-info').textContent = 
        \`Escenario: \${windowData.scenarioId || 'No seleccionado'}\`;
      
      // Actualizar contador de órdenes
      document.getElementById('wo-count').textContent = 
        \`\${windowData.workOrders.length} órdenes de trabajo\`;
      
      // Renderizar pestañas
      renderFilterTabs();
      
      // Renderizar opciones del filtro activo
      renderFilterOptions();
      
      // Actualizar resumen
      updateFiltersSummary();
      
      // Configurar eventos
      setupEventListeners();
    }
    
    // Renderizar pestañas de filtros
    function renderFilterTabs() {
      const tabsContainer = document.getElementById('filterTabs');
      tabsContainer.innerHTML = '';
      
      filterTabs.forEach(tab => {
        const isActive = activeTab === tab.key;
        const hasValues = getFilterCount(tab.key) > 0;
        const count = getFilterCount(tab.key);
        
        const tabElement = document.createElement('div');
        tabElement.className = \`filter-tab \${isActive ? 'active' : ''}\`;
        tabElement.dataset.tab = tab.key;
        tabElement.textContent = tab.label;
        
        if (hasValues) {
          const badge = document.createElement('span');
          badge.className = \`filter-badge \${isActive ? 'active' : ''}\`;
          badge.textContent = count;
          tabElement.appendChild(badge);
        }
        
        tabElement.addEventListener('click', () => {
          activeTab = tab.key;
          searchText = '';
          document.getElementById('searchInput').value = '';
          renderFilterTabs();
          renderFilterOptions();
        });
        
        tabsContainer.appendChild(tabElement);
      });
    }
    
    // Obtener cantidad de filtros activos por categoría
    function getFilterCount(category) {
      if (category === 'fchObjetivo') {
        return currentFilters.fchObjetivo ? 1 : 0;
      }
      return currentFilters[category] ? currentFilters[category].length : 0;
    }
    
    // Renderizar opciones de filtro
    function renderFilterOptions() {
      const container = document.getElementById('filterOptionsContent');
      const searchContainer = document.getElementById('searchContainer');
      const searchInput = document.getElementById('searchInput');
      
      // Actualizar placeholder de búsqueda
      const tabLabel = filterTabs.find(t => t.key === activeTab)?.label || activeTab;
      searchInput.placeholder = \`Buscar en \${tabLabel}...\`;
      
      // Mostrar/ocultar búsqueda según el tipo de filtro
      if (activeTab === 'fchObjetivo') {
        searchContainer.style.display = 'none';
        renderDateFilter(container);
      } else {
        searchContainer.style.display = 'block';
        renderCheckboxFilter(container);
      }
    }
    
    // Renderizar filtro de fecha
    function renderDateFilter(container) {
      container.innerHTML = \`
        <div class="p-3">
          <label class="block text-sm mb-1">Fecha Objetivo</label>
          <input 
            type="date" 
            class="w-full px-2 py-1 border rounded text-sm"
            value="\${currentFilters.fchObjetivo || ''}"
            onchange="updateDateFilter(this.value)"
          />
        </div>
      \`;
    }
    
    // Renderizar filtro con checkboxes
    function renderCheckboxFilter(container) {
      const options = windowData.filterOptions[activeTab] || [];
      const filteredOptions = searchText ? 
        options.filter(opt => opt.toLowerCase().includes(searchText.toLowerCase())) : 
        options;
      
      if (filteredOptions.length === 0) {
        container.innerHTML = \`
          <div class="p-2 text-center text-gray-500 text-xs">
            \${searchText ? 'No se encontraron resultados' : 'No hay opciones disponibles'}
          </div>
        \`;
        return;
      }
      
      container.innerHTML = '';
      
      filteredOptions.forEach(option => {
        const isSelected = currentFilters[activeTab] && currentFilters[activeTab].includes(option);
        
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'mr-2';
        checkbox.checked = isSelected;
        checkbox.addEventListener('change', () => toggleFilterValue(activeTab, option));
        
        const label = document.createElement('label');
        label.textContent = option;
        label.className = 'text-xs cursor-pointer flex-grow';
        label.addEventListener('click', () => {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        });
        
        item.appendChild(checkbox);
        item.appendChild(label);
        container.appendChild(item);
      });
    }
    
    // Alternar valor de filtro
    function toggleFilterValue(category, value) {
      if (!currentFilters[category]) {
        currentFilters[category] = [];
      }
      
      const index = currentFilters[category].indexOf(value);
      if (index > -1) {
        currentFilters[category].splice(index, 1);
      } else {
        currentFilters[category].push(value);
      }
      
      updateFiltersSummary();
      renderFilterTabs();
      
      console.log('Filtro actualizado:', category, currentFilters[category]);
    }
    
    // Actualizar filtro de fecha
    function updateDateFilter(value) {
      currentFilters.fchObjetivo = value || null;
      updateFiltersSummary();
      renderFilterTabs();
      console.log('Filtro de fecha actualizado:', value);
    }
    
    // Seleccionar todos los filtros
    function selectAll() {
      if (activeTab === 'fchObjetivo') return;
      
      const options = windowData.filterOptions[activeTab] || [];
      const filteredOptions = searchText ? 
        options.filter(opt => opt.toLowerCase().includes(searchText.toLowerCase())) : 
        options;
      
      if (!currentFilters[activeTab]) {
        currentFilters[activeTab] = [];
      }
      
      filteredOptions.forEach(option => {
        if (!currentFilters[activeTab].includes(option)) {
          currentFilters[activeTab].push(option);
        }
      });
      
      renderFilterOptions();
      updateFiltersSummary();
      renderFilterTabs();
    }
    
    // Deseleccionar todos los filtros
    function selectNone() {
      if (activeTab === 'fchObjetivo') {
        currentFilters.fchObjetivo = null;
      } else {
        currentFilters[activeTab] = [];
      }
      
      renderFilterOptions();
      updateFiltersSummary();
      renderFilterTabs();
    }
    
    // Limpiar todos los filtros
    function clearAllFilters() {
      const defaultLine = windowData.defaultLineFilter || 'S21';
      currentFilters = {
        linea: [defaultLine],
        numWO: [],
        numDoc: [],
        equipo: [],
        estadoWO: [],
        tipDoc: [],
        articulo: [],
        proveedor: [],
        fchObjetivo: null
      };
      
      renderFilterTabs();
      renderFilterOptions();
      updateFiltersSummary();
      
      console.log('Todos los filtros limpiados');
    }
    
    // Actualizar resumen de filtros
    function updateFiltersSummary() {
      const summaryContainer = document.getElementById('applied-filters');
      const countElement = document.getElementById('summary-count');
      const appliedCountElement = document.getElementById('applied-count');
      
      let appliedCount = 0;
      let summaryHTML = '';
      
      Object.entries(currentFilters).forEach(([key, values]) => {
        const tabLabel = filterTabs.find(t => t.key === key)?.label || key;
        
        if (Array.isArray(values) && values.length > 0) {
          appliedCount++;
          summaryHTML += \`<div class="mb-1">\`;
          summaryHTML += \`<span class="font-medium text-xs">\${tabLabel}: </span>\`;
          
          if (values.length <= 3) {
            values.forEach(value => {
              summaryHTML += \`<span class="applied-filter">\${value}</span>\`;
            });
          } else {
            values.slice(0, 2).forEach(value => {
              summaryHTML += \`<span class="applied-filter">\${value}</span>\`;
            });
            summaryHTML += \`<span class="applied-filter">+\${values.length - 2} más</span>\`;
          }
          
          summaryHTML += \`</div>\`;
        } else if (key === 'fchObjetivo' && values) {
          appliedCount++;
          summaryHTML += \`<div class="mb-1">\`;
          summaryHTML += \`<span class="font-medium text-xs">\${tabLabel}: </span>\`;
          summaryHTML += \`<span class="applied-filter">\${values}</span>\`;
          summaryHTML += \`</div>\`;
        }
      });
      
      if (appliedCount === 0) {
        summaryHTML = '<div class="text-xs text-gray-500 italic">No hay filtros aplicados</div>';
      }
      
      summaryContainer.innerHTML = summaryHTML;
      countElement.textContent = appliedCount;
      appliedCountElement.textContent = \`\${appliedCount} aplicado\${appliedCount !== 1 ? 's' : ''}\`;
    }
    
    // Configurar event listeners
    function setupEventListeners() {
      const searchInput = document.getElementById('searchInput');
      let searchTimeout;
      
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          searchText = e.target.value;
          renderFilterOptions();
        }, 300);
      });
    }
    
    // Funciones de zoom del Gantt
    function zoomIn() {
      zoomLevel = Math.min(zoomLevel * 1.2, 3);
      console.log('Zoom in:', zoomLevel);
    }
    
    function zoomOut() {
      zoomLevel = Math.max(zoomLevel / 1.2, 0.5);
      console.log('Zoom out:', zoomLevel);
    }
    
    function resetView() {
      zoomLevel = 1;
      console.log('Reset zoom:', zoomLevel);
    }
    
    // Inicializar cuando se carga la página
    window.addEventListener('load', init);
    
    // Limpieza al cerrar
    window.addEventListener('beforeunload', () => {
      console.log('Cerrando ventana de Gantt expandida');
    });
  </script>
</body>
</html>
`;

  // Abrir la nueva ventana con opciones optimizadas
  const newWindow = window.open(
    '',
    windowId,
    'width=1400,height=900,menubar=no,toolbar=no,location=no,scrollbars=yes,resizable=yes,status=no'
  );
  
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
    
    // Guardar referencia a la ventana
    openGanttWindows.set('gantt-window', newWindow);
    
    // Eliminar referencia cuando se cierre
    newWindow.addEventListener('beforeunload', () => {
      openGanttWindows.delete('gantt-window');
    });
    
    // Enfocar la nueva ventana
    newWindow.focus();
  } else {
    // Si no se pudo abrir la ventana, mostrar un mensaje de error
    console.error('No se pudo abrir la ventana de Gantt. Verifique que los popups no estén bloqueados');
    alert('No se pudo abrir la ventana de Gantt. Verifique que los popups no estén bloqueados en su navegador');
  }
};
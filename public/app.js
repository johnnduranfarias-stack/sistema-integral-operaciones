// Client side logic for Ferpacific Sacos Vacíos Control
const API_URL = ''; // Local server relative path

let token = localStorage.getItem('token') || '';
let currentUser = null;
let currentStock = [];
let currentSpecialties = [];
let specialtiesThreshold = 20000;
let historyLog = [];
let currentView = 'welcome';
let selectedExcelFile = null;
let availableArtesFiles = [];

// Pagination state
let inventoryPage = 1;
const inventoryLimit = 20;
let salesPage = 1;
const salesLimit = 20;
let dispatchPage = 1;
const dispatchLimit = 10;

let digitationPage = 1;
let digitationTotalPages = 1;

// Mock Data for new Departments
let mockProdPlanning = [
  { code: '12.01.01.1140.01', desc: 'SACO VACIO LAMINADO UREA GR 60X105', line: 'Tradicionales', target: 200, actual: 160, machine: 'Envasadora Tolva A', status: 'En Proceso' },
  { code: '12.01.01.1088.01', desc: 'SACO VACIO LAMINADO SULFATO DE AMONIO GR 60X90', line: 'Tradicionales', target: 350, actual: 350, machine: 'Envasadora Tolva B', status: 'Completado' },
  { code: '12.01.01.1047.01', desc: 'SACO VACIO UREA PRILADA CON FUNDA (60X100)', line: 'Tradicionales', target: 150, actual: 0, machine: 'Envasadora C', status: 'Programado' }
];

let mockProdWaste = [
  { date: '2026-06-24', code: '12.01.01.1140.01', desc: 'SACO VACIO LAMINADO UREA GR 60X105', qty: 45, reason: 'Atascamiento en correa de salida' },
  { date: '2026-06-23', code: '12.01.01.1088.01', desc: 'SACO VACIO LAMINADO SULFATO DE AMONIO GR 60X90', qty: 120, reason: 'Falla en sellador térmico de boquilla B' }
];

let mockLogDispatch = [
  { plate: 'GBA-1432', driver: 'Manuel Rojas', destination: 'Agripac Durán', product: 'SACO VACIO LAMINADO UREA GR 60X105', bags: 1200, gate: 'Portón 1', status: 'Cargando' },
  { plate: 'PBA-4589', driver: 'Juan Castro', destination: 'Bodega Milagro', product: 'SACO VACIO LAMINADO SULFATO DE AMONIO GR 60X90', bags: 2000, gate: 'Portón 2', status: 'Listo' },
  { plate: 'GCE-9811', driver: 'Luis Moreira', destination: 'Hacienda San José', product: 'SACO VACIO UREA PRILADA CON FUNDA (60X100)', bags: 800, gate: 'Portón 1', status: 'En Espera' }
];

let mockLogPhysical = [
  { location: 'Bodega Pradera - Estante A1', code: '12.01.01.1140.01', desc: 'SACO VACIO LAMINADO UREA GR 60X105', qty: 35000, date: '2026-06-22', status: 'Verificado' },
  { location: 'Bodega Sur - Bloque C2', code: '12.01.01.1088.01', desc: 'SACO VACIO LAMINADO SULFATO DE AMONIO GR 60X90', qty: 15200, date: '2026-06-21', status: 'Verificado' },
  { location: 'Bodega Pradera - Fila B3', code: '12.01.01.1047.01', desc: 'SACO VACIO UREA PRILADA CON FUNDA (60X100)', qty: 24077, date: '2026-06-20', status: 'Diferencia Mínima' }
];

let mockMaintOrders = [
  { id: 'OT-1021', machine: 'Envasadora Neumática A', area: 'Producción', desc: 'Desgaste en ventosa de succión de sacos', priority: 'ALTA', tech: 'Ing. Marcos Paz', status: 'Asignada' },
  { id: 'OT-1020', machine: 'Banda Transportadora M1', area: 'Bodega', desc: 'Cambio de rodamiento central agrietado', priority: 'NORMAL', tech: 'Téc. Carlos Vera', status: 'En Proceso' },
  { id: 'OT-1019', machine: 'Compresor Industrial Atlas', area: 'Producción', desc: 'Mantenimiento preventivo de 2000 horas', priority: 'NORMAL', tech: 'Ing. Marcos Paz', status: 'Completado' },
  { id: 'OT-1018', machine: 'Cosedora Portátil B2', area: 'Embarque', desc: 'Ajuste de tensión de hilo y cambio de aguja', priority: 'CRÍTICA', tech: 'Téc. Carlos Vera', status: 'Completado' }
];

let mockMaintParts = [
  { code: 'REP-001', name: 'Ventosa de Succión Silicona 60mm', qty: 15, unit: 'ud', location: 'Estantería Repuestos A1', minQty: 10, status: 'SUFICIENTE' },
  { code: 'REP-002', name: 'Aguja Cosedora Industrial Estándar', qty: 4, unit: 'caja', location: 'Estantería Repuestos A2', minQty: 5, status: 'SOLICITAR' },
  { code: 'REP-003', name: 'Rodamiento de Bolas Sellado 6204-2RS', qty: 2, unit: 'ud', location: 'Cajón B3', minQty: 4, status: 'CRÍTICO' },
  { code: 'REP-004', name: 'Aceite Lubricante Grado Alimenticio H1', qty: 12, unit: 'litro', location: 'Estante D4', minQty: 8, status: 'SUFICIENTE' }
];

let mockQualInspections = [
  { lot: 'LOT-2601', product: 'SACO VACIO LAMINADO UREA GR 60X105', moisture: 4.2, strength: 310, visual: 'EXCELENTE', status: 'Aprobado' },
  { lot: 'LOT-2602', product: 'SACO VACIO LAMINADO SULFATO DE AMONIO GR 60X90', moisture: 4.8, strength: 290, visual: 'BUENO', status: 'Aprobado' },
  { lot: 'LOT-2603', product: 'SACO VACIO UREA PRILADA CON FUNDA (60X100)', moisture: 5.6, strength: 250, visual: 'DEFECTUOSO', status: 'Rechazado' }
];

let mockQualCerts = [
  { coa: 'COA-2026-0042', lot: 'LOT-2601', product: 'SACO VACIO LAMINADO UREA GR 60X105', date: '2026-06-24', customer: 'Pronaca', status: 'Emitido' },
  { coa: 'COA-2026-0041', lot: 'LOT-2602', product: 'SACO VACIO LAMINADO SULFATO DE AMONIO GR 60X90', date: '2026-06-23', customer: 'Agripac', status: 'Emitido' }
];

let mockShipsDischarge = [
  { ship: 'M/V Golden Polaris', material: 'Urea Granular a Granel', total: 30000, discharged: 21000, rate: 450, eta: '2026-06-22 (Atracado)', status: 'Descargando' },
  { ship: 'M/V Ocean Clipper', material: 'Sulfato de Amonio', total: 15000, discharged: 8000, rate: 380, eta: '2026-06-23 (Atracado)', status: 'Descargando' },
  { ship: 'M/V Pacific Mariner', material: 'Fosfato Diamónico', total: 25000, discharged: 0, rate: 0, eta: '2026-06-26 (Anclado)', status: 'En Espera' }
];

let mockShipsDocks = [
  { ship: 'M/V Golden Polaris', dock: 'Muelle 1 (Granel)', arrival: '2026-06-22 08:30', departure: '2026-06-25 18:00', agency: 'Andinave', status: 'Atracado' },
  { ship: 'M/V Ocean Clipper', dock: 'Muelle 2 (Auxiliar)', arrival: '2026-06-23 10:15', departure: '2026-06-26 12:00', agency: 'Remar', status: 'Atracado' },
  { ship: 'M/V Pacific Mariner', dock: 'Muelle 1 (Granel)', arrival: '2026-06-26 20:00', departure: '2026-06-29 22:00', agency: 'Andinave', status: 'Programado' }
];

let mockPlanTurns = [
  { date: '2026-06-24', carrier: 'BYRON MINDIOLA', arrival: '07:10:00', start: '08:00:00', end: '10:00:00', duration: '02:00:00' }
];

let mockImportsLiq = [];

let mockPlanDispatches = [
  { date: '2026-06-15', type: 'PROGRAMADO', transport: 'SOLICITUD DE TRANSPORTE', line: 'LIN 8', status: 'DESPACHADO', driver: 'VICTOR GONZALEZ', product: '01.02.07.1247.1', productDesc: 'MEZCLA 13.54-4-23.64-2.64S-2CAO-5.6MGO-0.08ZNO-0.02B2O3', qty: 3, client: 'AGRIMONT', sacoDesc: 'SACO BILAMINADO 60X96 MEZCLA FISICA ROJO BONITA', label: 'MONTAÑA', obs: 'OC 419 MONTAÑA - CICLO 6', coordinator: 'MMELGAR', pedido: 'S18259', truck: 1, cycle: 6 },
  { date: '2026-06-15', type: 'PROGRAMADO', transport: 'SOLICITUD DE TRANSPORTE', line: 'LIN 8', status: 'DESPACHADO', driver: 'VICTOR GONZALEZ', product: '01.02.07.1247.1', productDesc: 'MEZCLA 13.54-4-23.64-2.64S-2CAO-5.6MGO-0.08ZNO-0.02B2O3', qty: 500, client: 'AGRIMONT', sacoDesc: 'SACO BILAMINADO 60X96 MEZCLA FISICA AZUL BONITA', label: 'MONTAÑA', obs: 'OC 462 MONTAÑA - CICLO 7', coordinator: 'MMELGAR', pedido: 'DA25', truck: 1, cycle: 7 },
  { date: '2026-06-16', type: 'PROGRAMADO', transport: 'PROPIO', line: 'LIN 7', status: 'DESPACHADO', driver: 'JUAN REYES', product: '01.02.07.0812.1', productDesc: 'TRADICIONAL UREA 46% NITROGENO GRANULAR', qty: 800, client: 'PRONACA', sacoDesc: 'SACO LAMINADO 50KG UREA FERTILIZANTE', label: 'PRONACA', obs: 'Entrega en bodega central', coordinator: 'JCASTRO', pedido: 'S18320', truck: 2, cycle: 2 },
  { date: '2026-06-16', type: 'EXTRAORDINARIO', transport: 'SOLICITUD DE TRANSPORTE', line: 'LIN 6', status: 'DESPACHADO', driver: 'CARLOS LOPEZ', product: '01.02.07.1247.1', productDesc: 'MEZCLA 13.54-4-23.64-2.64S-2CAO-5.6MGO', qty: 350, client: 'AGRIPAC', sacoDesc: 'SACO BILAMINADO 60X96 MEZCLA FISICA AMARILLO', label: 'AGRIPAC', obs: 'Despacho prioritario', coordinator: 'MMELGAR', pedido: 'S18325', truck: 3, cycle: 1 },
  { date: '2026-06-17', type: 'PROGRAMADO', transport: 'PROPIO', line: 'LIN 8', status: 'DESPACHADO', driver: 'PEDRO GOMEZ', product: '01.02.07.0934.1', productDesc: 'ESPECIALIDAD NUTRI-COMPLEJO NITROFOSKA', qty: 600, client: 'REYBANPAC', sacoDesc: 'SACO ESPECIAL NUTRIFOSKA VERDE DE 50KG', label: 'HDA ELVIRA', obs: 'Enviar COA adjunto', coordinator: 'JCASTRO', pedido: 'S18411', truck: 4, cycle: 4 },
  { date: '2026-06-18', type: 'PROGRAMADO', transport: 'SOLICITUD DE TRANSPORTE', line: 'LIN 5', status: 'TRANSITO', driver: 'MIGUEL BASTIDAS', product: '01.02.07.0812.1', productDesc: 'TRADICIONAL UREA 46% NITROGENO GRANULAR', qty: 1200, client: 'AGRIPAC', sacoDesc: 'SACO LAMINADO 50KG UREA FERTILIZANTE', label: 'AGRIPAC YAGUACHI', obs: 'Escotilla sellada', coordinator: 'MMELGAR', pedido: 'S18456', truck: 5, cycle: 3 },
  { date: '2026-06-19', type: 'PROGRAMADO', transport: 'SOLICITUD DE TRANSPORTE', line: 'LIN 8', status: 'PROGRAMADO', driver: 'LUIS SANCHEZ', product: '01.02.07.1247.1', productDesc: 'MEZCLA 13.54-4-23.64-2.64S-2CAO-5.6MGO-0.08ZNO-0.02B2O3', qty: 450, client: 'AGRIMONT', sacoDesc: 'SACO BILAMINADO 60X96 MEZCLA FISICA ROJO BONITA', label: 'MONTAÑA', obs: 'Ciclo 8 programación', coordinator: 'MMELGAR', pedido: 'S18501', truck: 1, cycle: 8 },
  { date: '2026-06-20', type: 'PROGRAMADO', transport: 'PROPIO', line: 'LIN 4', status: 'PROGRAMADO', driver: 'MARIO PINTO', product: '01.02.07.0812.1', productDesc: 'TRADICIONAL UREA 46% NITROGENO GRANULAR', qty: 1000, client: 'SOPRODE', sacoDesc: 'SACO LAMINADO 50KG UREA FERTILIZANTE', label: 'SOPRODE MILAGRO', obs: 'Programación fin de semana', coordinator: 'JCASTRO', pedido: 'S18520', truck: 6, cycle: 1 },
  { date: '2026-06-22', type: 'PROGRAMADO', transport: 'SOLICITUD DE TRANSPORTE', line: 'LIN 8', status: 'PROGRAMADO', driver: 'VICTOR GONZALEZ', product: '01.02.07.1247.1', productDesc: 'MEZCLA 13.54-4-23.64-2.64S-2CAO-5.6MGO-0.08ZNO-0.02B2O3', qty: 500, client: 'AGRIMONT', sacoDesc: 'SACO BILAMINADO 60X96 MEZCLA FISICA AZUL BONITA', label: 'MONTAÑA', obs: 'Ciclo 9 programación', coordinator: 'MMELGAR', pedido: 'DA26', truck: 1, cycle: 9 },
  { date: '2026-06-23', type: 'EXTRAORDINARIO', transport: 'SOLICITUD DE TRANSPORTE', line: 'LIN 7', status: 'PROGRAMADO', driver: 'JOSE ORTIZ', product: '01.02.07.0934.1', productDesc: 'ESPECIALIDAD NUTRI-COMPLEJO NITROFOSKA', qty: 750, client: 'PRONACA', sacoDesc: 'SACO ESPECIAL NUTRIFOSKA VERDE DE 50KG', label: 'PRONACA QUEVEDO', obs: 'Lote inspeccionado previamente', coordinator: 'JCASTRO', pedido: 'S18550', truck: 7, cycle: 1 }
];

let clientConsumptionsData = [];
let clientTempConsumptions = {};

// Init App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  if (token) {
    validateTokenAndLoad();
  } else {
    showLogin();
  }
});

// Event Listeners Setup
function setupEventListeners() {
  // Close bag art modal
  const closeArtBtn = document.getElementById('modal-bag-art-close');
  if (closeArtBtn) {
    closeArtBtn.addEventListener('click', closeBagArtModal);
  }
  const modalArtOverlay = document.getElementById('modal-bag-art');
  if (modalArtOverlay) {
    modalArtOverlay.addEventListener('click', (e) => {
      if (e.target.id === 'modal-bag-art') {
        closeBagArtModal();
      }
    });
  }
  
  // Toggle password visibility
  const togglePassBtn = document.getElementById('btn-toggle-password');
  if (togglePassBtn) {
    togglePassBtn.addEventListener('click', togglePasswordVisibility);
  }
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const togglePassBtn = document.getElementById('btn-toggle-password');
  if (!passwordInput || !togglePassBtn) return;

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    togglePassBtn.textContent = '🙈';
  } else {
    passwordInput.type = 'password';
    togglePassBtn.textContent = '👁️';
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;
  
  // Logout button
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  // Theme Toggle Button
  const themeToggleBtn = document.getElementById('btn-toggle-theme');
  if (themeToggleBtn) {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    themeToggleBtn.innerHTML = currentTheme === 'light' ? '🌙 Modo Oscuro' : '☀️ Modo Claro';
    
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
        themeToggleBtn.innerHTML = '☀️ Modo Claro';
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        themeToggleBtn.innerHTML = '🌙 Modo Oscuro';
      }
    });
  }
  
  // Send Manual Email Alerts Button
  const sendEmailAlertsBtn = document.getElementById('btn-send-email-alerts');
  if (sendEmailAlertsBtn) {
    sendEmailAlertsBtn.addEventListener('click', async () => {
      if (currentView === 'log-physical') {
        if (typeof finalizeAndEmailPhysicalInventory === 'function') {
          finalizeAndEmailPhysicalInventory();
        }
      } else if (currentView === 'log-physical-client') {
        if (typeof finalizeAndEmailClientInventory === 'function') {
          finalizeAndEmailClientInventory();
        }
      } else {
        showLoader('Enviando reporte de stock crítico por correo...');
        try {
          const response = await apiFetch('/api/send-alerts', { method: 'POST' });
          alert(response.message || 'Correo de alertas enviado exitosamente');
        } catch (err) {
          console.error('Error al enviar correo de alertas:', err);
          alert('Error al enviar correo: ' + err.message);
        } finally {
          hideLoader();
        }
      }
    });
  }
  
  // Sidebar navigation & collapsible dropdown setup
  document.querySelectorAll('.dropdown-header').forEach(header => {
    header.addEventListener('click', () => {
      const dropdown = header.closest('.sidebar-dropdown');
      dropdown.classList.toggle('open');
    });
  });

  const menuBindings = {
    'dashboard': 'menu-dashboard',
    'inventory': 'menu-inventory',
    'sales': 'menu-sales',
    'requisition': 'menu-requisition',
    'logistic': 'menu-logistic',
    'settings': 'menu-settings',
    'prod-planning': 'menu-prod-planning',
    'prod-waste': 'menu-prod-waste',
    'production-digitacion': 'menu-production-digitacion',
    'prod-destajo': 'menu-prod-destajo',
    'log-physical-consumption': 'menu-log-physical-consumption',
    'log-dispatch': 'menu-log-dispatch',
    'log-physical': 'menu-log-physical',
    'log-physical-client': 'menu-log-physical-client',
    'log-warehouse-3d': 'menu-log-warehouse-3d',
    'maint-orders': 'menu-maint-orders',
    'maint-parts': 'menu-maint-parts',
    'qual-inspections': 'menu-qual-inspections',
    'qual-certs': 'menu-qual-certs',
    'ships-discharge': 'menu-ships-discharge',
    'ships-docks': 'menu-ships-docks',
    'plan-turns': 'menu-plan-turns',
    'imports-status': 'menu-imports-status',
    'quality-control': 'menu-quality-control',
    'customer-service': 'menu-customer-service'
  };

  Object.entries(menuBindings).forEach(([view, elementId]) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(view);
      });
    }
  });

  // Universal fallback listener for all sidebar links with href="#..."
  document.querySelectorAll('.sidebar-menu a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href && href.length > 1) {
        const targetView = href.substring(1);
        switchView(targetView);
      }
    });
  });

  // Search & Filter input bindings for new departments
  const searchInputBindings = [
    { inputId: 'search-prod-planning', renderFn: () => renderProdPlanning() },
    { inputId: 'search-prod-waste', renderFn: () => renderProdWaste() },
    { inputId: 'search-log-dispatch', renderFn: () => renderLogDispatch() },
    { inputId: 'search-log-physical', renderFn: () => renderLogPhysical() },
    { inputId: 'client-search-filter', renderFn: () => renderClientGrid() },
    { inputId: 'search-maint-orders', renderFn: () => renderMaintOrders() },
    { inputId: 'search-maint-parts', renderFn: () => renderMaintParts() },
    { inputId: 'search-qual-inspections', renderFn: () => renderQualInspections() },
    { inputId: 'search-qual-certs', renderFn: () => renderQualCerts() },
    { inputId: 'search-ships-discharge', renderFn: () => renderShipsDischarge() },
    { inputId: 'search-ships-docks', renderFn: () => renderShipsDocks() },
    { inputId: 'search-plan-turns', renderFn: () => renderPlanTurns() },
    { inputId: 'search-plan-dispatches', renderFn: () => { dispatchPage = 1; renderPlanDispatchDetails(); } },
    { inputId: 'search-digit-history', renderFn: () => { digitationPage = 1; renderDigitacionView(); } }
  ];

  searchInputBindings.forEach(binding => {
    const el = document.getElementById(binding.inputId);
    if (el) el.addEventListener('input', binding.renderFn);
  });

  // Form submission handlers for new departments
  const formPlanning = document.getElementById('form-prod-planning');
  if (formPlanning) {
    formPlanning.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = document.getElementById('prod-select-product').value;
      const machine = document.getElementById('prod-machine').value.trim();
      const target = parseInt(document.getElementById('prod-target').value) || 0;
      
      const item = currentStock.find(i => i.code === code);
      const desc = item ? item.desc : 'Saco Programado';
      const line = item ? item.linea : 'Tradicionales';

      mockProdPlanning.unshift({
        code, desc, line, target, actual: 0, machine, status: 'Programado'
      });

      formPlanning.reset();
      renderProdPlanning();
      alert('Corrida de producción programada con éxito.');
    });
  }

  const formWaste = document.getElementById('form-prod-waste');
  if (formWaste) {
    formWaste.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = document.getElementById('waste-select-product').value;
      const qty = parseInt(document.getElementById('waste-quantity').value) || 0;
      const reason = document.getElementById('waste-reason').value.trim();

      const item = currentStock.find(i => i.code === code);
      const desc = item ? item.desc : 'Saco defectuoso';

      mockProdWaste.unshift({
        date: new Date().toISOString().slice(0, 10),
        code, desc, qty, reason
      });

      formWaste.reset();
      renderProdWaste();
      alert('Merma registrada con éxito.');
    });
  }

  const formProductionDigit = document.getElementById('form-production-digit');
  if (formProductionDigit) {
    formProductionDigit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('digit-date').value;
      const checker = document.getElementById('digit-checker').value.trim();
      const line = document.getElementById('digit-line').value;
      const productCode = document.getElementById('digit-select-product').value;
      const quantity = parseInt(document.getElementById('digit-quantity').value) || 0;
      const dispatchType = document.getElementById('digit-dispatch').value;
      const client = document.getElementById('digit-client').value.trim();
      const startTime = document.getElementById('digit-start-time').value;
      const endTime = document.getElementById('digit-end-time').value;
      const preparation = parseInt(document.getElementById('digit-preparation').value) || 0;

      const productItem = currentStock.find(item => item.code === productCode);
      const productName = productItem ? productItem.desc : 'Producto Desconocido';

      showLoader('Guardando registro de producción...');
      try {
        const resData = await apiFetch('/api/production-registry', {
          method: 'POST',
          body: JSON.stringify({
            date,
            checker,
            line,
            productCode,
            productName,
            quantity,
            dispatchType,
            client,
            startTime,
            endTime,
            preparation
          })
        });

        if (resData.success) {
          formProductionDigit.reset();
          // Reset default date to today
          const todayISO = new Date().toISOString().split('T')[0];
          document.getElementById('digit-date').value = todayISO;
          
          alert('¡Registro de producción guardado con éxito!');
          // Reload the list
          digitationPage = 1;
          await renderDigitacionView();
        } else {
          alert('Error: ' + resData.error);
        }
      } catch (err) {
        alert('Error al guardar registro: ' + err.message);
      } finally {
        hideLoader();
      }
    });
  }

  // Setup listeners for production digit page filters and page buttons
  setupDigitacionListeners();

  // Setup listeners for empty bags daily physical movements
  setupPhysicalConsumptionListeners();

  // Setup listeners for imports status PDF upload and filters
  setupImportsStatusListeners();

  const formDispatch = document.getElementById('form-log-dispatch');
  if (formDispatch) {
    formDispatch.addEventListener('submit', (e) => {
      e.preventDefault();
      const plate = document.getElementById('disp-plate').value.trim().toUpperCase();
      const driver = document.getElementById('disp-driver').value.trim();
      const code = document.getElementById('disp-select-product').value;
      const destination = document.getElementById('disp-destination').value.trim();
      const bags = parseInt(document.getElementById('disp-bags').value) || 0;

      const item = currentStock.find(i => i.code === code);
      const productDesc = item ? item.desc : 'Saco Despachado';

      mockLogDispatch.push({
        plate, driver, destination, product: productDesc, bags, gate: 'Portón ' + (Math.random() > 0.5 ? '1' : '2'), status: 'En Espera'
      });

      formDispatch.reset();
      renderLogDispatch();
      alert('Camión añadido a la cola de despacho.');
    });
  }

  const formMaint = document.getElementById('form-maint-orders');
  if (formMaint) {
    formMaint.addEventListener('submit', (e) => {
      e.preventDefault();
      const machine = document.getElementById('maint-machine').value.trim();
      const area = document.getElementById('maint-area').value;
      const priority = document.getElementById('maint-priority').value;
      const desc = document.getElementById('maint-desc').value.trim();
      const tech = document.getElementById('maint-tech').value.trim();
      
      const nextId = 'OT-' + (1000 + mockMaintOrders.length + 1);

      mockMaintOrders.unshift({
        id: nextId, machine, area, desc, priority, tech, status: 'Asignada'
      });

      formMaint.reset();
      renderMaintOrders();
      alert('Orden de trabajo registrada y asignada.');
    });
  }

  const formQual = document.getElementById('form-qual-inspections');
  if (formQual) {
    formQual.addEventListener('submit', (e) => {
      e.preventDefault();
      const lot = document.getElementById('qual-lot').value.trim().toUpperCase();
      const code = document.getElementById('qual-select-product').value;
      const moisture = parseFloat(document.getElementById('qual-moisture').value) || 0;
      const strength = parseInt(document.getElementById('qual-strength').value) || 0;
      const visual = document.getElementById('qual-visual').value;

      const item = currentStock.find(i => i.code === code);
      const productDesc = item ? item.desc : 'Saco Controlado';

      const status = (moisture <= 5.0 && strength >= 270 && visual !== 'DEFECTUOSO') ? 'Aprobado' : 'Rechazado';

      mockQualInspections.unshift({
        lot, product: productDesc, moisture, strength, visual, status
      });

      if (status === 'Aprobado') {
        const coaId = 'COA-2026-' + String(1000 + mockQualCerts.length + 1).slice(1);
        mockQualCerts.unshift({
          coa: coaId, lot, product: productDesc, date: new Date().toISOString().slice(0, 10), customer: 'Cliente General', status: 'Emitido'
        });
      }

      formQual.reset();
      renderQualInspections();
      alert(`Inspección guardada. Resultado del lote: ${status.toUpperCase()}`);
    });
  }

  const formDischarge = document.getElementById('form-ships-discharge');
  if (formDischarge) {
    formDischarge.addEventListener('submit', (e) => {
      e.preventDefault();
      const shipName = document.getElementById('discharge-select-ship').value;
      const tons = parseInt(document.getElementById('discharge-tons').value) || 0;

      const ship = mockShipsDischarge.find(s => s.ship === shipName);
      if (ship) {
        ship.discharged = Math.min(ship.total, ship.discharged + tons);
        if (ship.discharged >= ship.total) {
          ship.status = 'Completado';
        }
      }

      formDischarge.reset();
      renderShipsDischarge();
      alert('Avance de descarga registrado con éxito.');
    });
  }

  const formPlanTurns = document.getElementById('form-plan-turns');
  if (formPlanTurns) {
    // Set default date to today
    const dateInput = document.getElementById('plan-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    formPlanTurns.addEventListener('submit', (e) => {
      e.preventDefault();
      const date = document.getElementById('plan-date').value;
      const carrier = document.getElementById('plan-carrier').value.trim();
      const arrival = document.getElementById('plan-arrival').value;
      const start = document.getElementById('plan-start').value;
      const end = document.getElementById('plan-end').value;

      const duration = calculateTimeDifference(start, end);

      mockPlanTurns.push({
        date, carrier, arrival, start, end, duration
      });

      formPlanTurns.reset();
      if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
      renderPlanTurns();
      alert('Turno de descarga registrado con éxito.');
    });
  }

  // Liquidacion de bascula form handler removed
  
  // Search & Filter in Inventory (Cuadro Master)
  document.getElementById('search-inventory').addEventListener('input', () => { inventoryPage = 1; renderInventoryTable(); });
  document.getElementById('filter-linea').addEventListener('change', () => { inventoryPage = 1; renderInventoryTable(); });
  document.getElementById('filter-stock-status').addEventListener('change', () => { inventoryPage = 1; renderInventoryTable(); });
  
  // Pagination
  document.getElementById('btn-prev-page').addEventListener('click', () => { if (inventoryPage > 1) { inventoryPage--; renderInventoryTable(); } });
  document.getElementById('btn-next-page').addEventListener('click', () => { inventoryPage++; renderInventoryTable(); });
  
  // Search & Filter in Sales Review
  document.getElementById('search-sales').addEventListener('input', () => { salesPage = 1; renderSalesModule(); });
  document.getElementById('filter-sales-linea').addEventListener('change', () => { salesPage = 1; renderSalesModule(); });
  document.getElementById('filter-sales-tipo').addEventListener('change', () => { salesPage = 1; renderSalesModule(); });
  
  // Pagination for Sales
  document.getElementById('btn-sales-prev').addEventListener('click', () => { if (salesPage > 1) { salesPage--; renderSalesModule(); } });
  document.getElementById('btn-sales-next').addEventListener('click', () => { salesPage++; renderSalesModule(); });

  // File Upload Drop Zone & Sync button listeners
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('sync-file-input');
  const syncBtn = document.getElementById('btn-trigger-sync');
  
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
      handleFileSelected(e.target.files[0]);
    });
    
    // Drag events
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--success)';
        dropZone.style.backgroundColor = 'rgba(0, 161, 75, 0.05)';
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.backgroundColor = 'var(--input-bg)';
      }, false);
    });
    
    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      if (file) {
        handleFileSelected(file);
      }
    }, false);
  }

  function handleFileSelected(file) {
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      alert("Por favor, selecciona únicamente archivos con extensión .xlsx");
      return;
    }
    
    selectedExcelFile = file;
    
    document.getElementById('selected-file-name').textContent = file.name;
    const sizeKB = (file.size / 1024).toFixed(1);
    document.getElementById('selected-file-size').textContent = `${sizeKB} KB`;
    document.getElementById('selected-file-details').classList.remove('hidden');
    
    if (syncBtn) syncBtn.removeAttribute('disabled');
  }

  if (syncBtn) {
    syncBtn.addEventListener('click', triggerExcelSync);
  }
  
  // Banner button to view criticals
  document.getElementById('btn-view-alerts').addEventListener('click', () => {
    switchView('inventory');
    document.getElementById('filter-stock-status').value = 'URGENTE';
    renderInventoryTable();
  });

  // Search & Filter in Transit Dashboard
  document.getElementById('search-transit-dashboard').addEventListener('input', renderTransitDashboardTable);
  document.getElementById('filter-provider-dashboard').addEventListener('change', renderTransitDashboardTable);

  // Settings: General Form
  document.getElementById('settings-general-form').addEventListener('submit', saveGeneralSettings);
  
  // Settings: SMTP Form
  document.getElementById('settings-smtp-form').addEventListener('submit', saveSmtpSettings);
  
  const smtpMethod = document.getElementById('smtp-method');
  if (smtpMethod) {
    smtpMethod.addEventListener('change', toggleSmtpCredentialsVisibility);
  }
  
  // Settings: Test SMTP
  document.getElementById('btn-test-smtp').addEventListener('click', testSmtpConnection);

  // Settings: Save Specialties
  document.getElementById('btn-save-specialties').addEventListener('click', saveSpecialtiesSelection);

  // Settings: Search specialties setup
  document.getElementById('search-specialty-setup').addEventListener('input', renderSpecialtiesSetupList);

  // Settings: User Management Form Submit
  const userForm = document.getElementById('form-user-management');
  if (userForm) {
    userForm.addEventListener('submit', handleUserManagementSubmit);
  }

  // Settings: Credentials form submit
  const credentialsForm = document.getElementById('form-credential-setup');
  if (credentialsForm) {
    credentialsForm.addEventListener('submit', handleCredentialSubmit);
  }
  
  // Settings: Links form submit
  const linksForm = document.getElementById('form-link-setup');
  if (linksForm) {
    linksForm.addEventListener('submit', handleLinkSubmit);
  }

  // Settings: Search inputs
  document.getElementById('search-credentials').addEventListener('input', renderCredentialsTable);
  document.getElementById('search-links').addEventListener('input', renderLinksGrid);

  // Export buttons in header
  document.getElementById('btn-export-excel').addEventListener('click', () => { handleExport('excel'); });
  document.getElementById('btn-export-pdf').addEventListener('click', () => { handleExport('pdf'); });

  // Requisition Download Buttons
  document.getElementById('btn-download-excel-req').addEventListener('click', () => { window.location.href = `/api/requisition/excel?token=${token}`; });
  document.getElementById('btn-download-pdf-req').addEventListener('click', () => { window.location.href = `/api/requisition/pdf?token=${token}`; });

  // Requisition inputs listener
  document.getElementById('inventory-tbody').addEventListener('change', async (e) => {
    if (e.target.classList.contains('requisition-input')) {
      const inputEl = e.target;
      const code = inputEl.getAttribute('data-code');
      const val = parseInt(inputEl.value) || 0;
      
      // Visual feedback: Saving...
      inputEl.classList.remove('saved', 'error');
      inputEl.classList.add('saving');
      
      try {
        const data = await apiFetch('/api/update-requisition', {
          method: 'POST',
          body: JSON.stringify({ code, requisition: val })
        });
        // Update local state
        const item = currentStock.find(i => i.code === code);
        if (item) {
          item.requisition = val;
          item.observation = data.observation;
        }
        
        // Update UI observation text in real-time
        const obsEl = document.getElementById(`obs-${code}`);
        if (obsEl && data.observation) {
          obsEl.textContent = data.observation;
        }

        // Visual feedback: Saved!
        inputEl.classList.remove('saving');
        inputEl.classList.add('saved');
        
        // Remove saved class after a delay
        setTimeout(() => {
          inputEl.classList.remove('saved');
        }, 1500);
      } catch (err) {
        console.error("Error al guardar pedido de requisición:", err);
        inputEl.classList.remove('saving');
        inputEl.classList.add('error');
        alert("No se pudo guardar el pedido de requisición: " + err.message);
      }
    }
  });

  // Detalle Despachos: Filter line and status listeners
  const filterLineEl = document.getElementById('filter-dispatch-line');
  if (filterLineEl) filterLineEl.addEventListener('change', () => { dispatchPage = 1; renderPlanDispatchDetails(); });

  const filterStatusEl = document.getElementById('filter-dispatch-status');
  if (filterStatusEl) filterStatusEl.addEventListener('change', () => { dispatchPage = 1; renderPlanDispatchDetails(); });

  // Detalle Despachos: Pagination
  const btnDispPrev = document.getElementById('btn-disp-prev');
  if (btnDispPrev) {
    btnDispPrev.addEventListener('click', () => {
      if (dispatchPage > 1) {
        dispatchPage--;
        renderPlanDispatchDetails();
      }
    });
  }
  const btnDispNext = document.getElementById('btn-disp-next');
  if (btnDispNext) {
    btnDispNext.addEventListener('click', () => {
      dispatchPage++;
      renderPlanDispatchDetails();
    });
  }

  // Detalle Despachos: Product dropdown change reactive listener
  const dispDetailProd = document.getElementById('disp-detail-product');
  if (dispDetailProd) {
    dispDetailProd.addEventListener('change', () => {
      const code = dispDetailProd.value;
      const matched = currentStock.find(item => item.code === code);
      const descEl = document.getElementById('disp-detail-desc-prod');
      if (descEl) {
        descEl.value = matched ? matched.desc : "";
      }
    });
  }

  // Detalle Despachos: Form submit
  const formPlanDispatches = document.getElementById('form-plan-dispatches');
  if (formPlanDispatches) {
    formPlanDispatches.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const date = document.getElementById('disp-detail-date').value;
      const status = document.getElementById('disp-detail-status').value;
      const type = document.getElementById('disp-detail-type').value;
      const transport = document.getElementById('disp-detail-trans').value;
      const line = document.getElementById('disp-detail-line').value;
      const driver = document.getElementById('disp-detail-driver').value.trim();
      const product = document.getElementById('disp-detail-product').value;
      const qty = parseInt(document.getElementById('disp-detail-qty').value) || 0;
      const client = document.getElementById('disp-detail-client').value.trim();
      const etiqueta = document.getElementById('disp-detail-etiqueta').value.trim();
      const sacoDesc = document.getElementById('disp-detail-saco-desc').value.trim();
      const pedido = document.getElementById('disp-detail-pedido').value.trim().toUpperCase();
      const truck = parseInt(document.getElementById('disp-detail-truck').value) || 1;
      const cycle = parseInt(document.getElementById('disp-detail-cycle').value) || 1;
      const coordinator = document.getElementById('disp-detail-coordinator').value.trim().toUpperCase();
      const meta = parseInt(document.getElementById('disp-detail-meta').value) || 60;
      const obs = document.getElementById('disp-detail-obs').value.trim();

      let productDesc = "Fórmula Mezcla Física";
      const matched = currentStock.find(item => item.code === product);
      if (matched) productDesc = matched.desc;

      mockPlanDispatches.unshift({
        date, type, transport, line, status, driver, product, productDesc, qty, client, sacoDesc, label: etiqueta, obs, coordinator, pedido, truck, cycle, meta
      });

      formPlanDispatches.reset();
      
      // Default to today's date
      const dateInput = document.getElementById('disp-detail-date');
      if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

      dispatchPage = 1;
      renderPlanDispatchDetails();
      alert('Despacho registrado con éxito en memoria.');
    });
  }

  // Quality Control Release Form Submission
  const formQC = document.getElementById('form-qc-release');
  if (formQC) {
    formQC.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const type = document.getElementById('qc-input-type').value;
      const product = document.getElementById('qc-product-name').value.trim();
      const productionLine = document.getElementById('qc-production-line').value;
      const status = document.getElementById('qc-status').value;
      const observations = document.getElementById('qc-observations').value.trim();
      
      const parameters = {
        humedad: document.getElementById('qc-param-humedad').checked,
        granulo: document.getElementById('qc-param-granulo').checked,
        terrones: document.getElementById('qc-param-terrones').checked,
        empaque: document.getElementById('qc-param-empaque').checked,
        peso: document.getElementById('qc-param-peso').checked
      };

      showLoader('Registrando liberación...');
      try {
        await apiFetch('/api/qc-releases', {
          method: 'POST',
          body: JSON.stringify({ type, product, productionLine, status, parameters, observations })
        });
        
        // Reset form fields
        document.getElementById('qc-product-name').value = '';
        document.getElementById('qc-observations').value = '';
        
        // Reload QC view
        await renderQualityControlView();
        
        alert('🛡️ Registro de Calidad Guardado Exitosamente.');
      } catch (err) {
        alert(err.message || 'Error al guardar registro de calidad');
      } finally {
        hideLoader();
      }
    });
  }

  // QC Inventory live search
  const searchQC = document.getElementById('search-qc-inventory');
  if (searchQC) {
    searchQC.addEventListener('input', () => {
      renderQualityControlView();
    });
  }
}

// Router/View Switcher
function switchView(viewName) {
  if (currentUser) {
    if (currentUser.role === 'quality' && viewName !== 'quality-control') {
      viewName = 'quality-control';
    } else if (currentUser.role === 'imports' && viewName !== 'imports-status' && viewName !== 'imports-liq') {
      viewName = 'imports-status';
    }
  }
  currentView = viewName;
  if (typeof stop3DRenderLoop === 'function') {
    stop3DRenderLoop();
  }
  // Update active menu class
  document.querySelectorAll('.sidebar-menu .submenu-item').forEach(item => {
    item.classList.remove('active');
  });
  
  const activeMenu = document.getElementById(`menu-${viewName}`);
  if (activeMenu) {
    activeMenu.classList.add('active');
    // Auto-expand parent dropdown
    const dropdown = activeMenu.closest('.sidebar-dropdown');
    if (dropdown) dropdown.classList.add('open');
  }
  
  // Toggle views
  document.querySelectorAll('.app-view').forEach(view => {
    view.classList.add('hidden');
  });
  
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.remove('hidden');
  
  // Update header title
  const pageTitle = document.getElementById('page-title');
  if (viewName === 'welcome') pageTitle.textContent = 'Inicio';
  else if (viewName === 'dashboard') pageTitle.textContent = 'Panel Principal de Saldos';
  else if (viewName === 'inventory') pageTitle.textContent = 'Cuadro Master de Inventario';
  else if (viewName === 'sales') pageTitle.textContent = 'Revisión Ventas y Comercial';
  else if (viewName === 'requisition') pageTitle.textContent = 'Generador de Requisiciones';
  else if (viewName === 'logistic') pageTitle.textContent = 'Sincronización Logística';
  else if (viewName === 'settings') pageTitle.textContent = 'Configuración del Sistema';
  else if (viewName === 'prod-planning') pageTitle.textContent = 'Planificación de Envasado';
  else if (viewName === 'prod-waste') pageTitle.textContent = 'Control de Mermas de Sacos';
  else if (viewName === 'log-dispatch') pageTitle.textContent = 'Despacho y Embarques';
  else if (viewName === 'log-physical') pageTitle.textContent = 'Inventario Físico Bodega';
  else if (viewName === 'log-physical-client') pageTitle.textContent = 'Inventario Físico Cliente';
  else if (viewName === 'log-warehouse-3d') pageTitle.textContent = 'Simulación e Inventario 3D de Bodegas';
  else if (viewName === 'maint-orders') pageTitle.textContent = 'Órdenes de Trabajo de Mantenimiento';
  else if (viewName === 'maint-parts') pageTitle.textContent = 'Control de Repuestos de Bodega';
  else if (viewName === 'qual-inspections') pageTitle.textContent = 'Inspección y Ensayos de Calidad';
  else if (viewName === 'qual-certs') pageTitle.textContent = 'Certificados de Calidad Emitidos (COA)';
  else if (viewName === 'ships-discharge') pageTitle.textContent = 'Control de Descarga de Buques';
  else if (viewName === 'ships-docks') pageTitle.textContent = 'Planificación y Atraque de Muelles';
  else if (viewName === 'plan-turns') pageTitle.textContent = 'Planificación de Turnos de Descarga';
  else if (viewName === 'imports-status') pageTitle.textContent = 'Pizarrón Resumen de Importaciones';
  else if (viewName === 'plan-dispatch-details') pageTitle.textContent = 'Detalle de Despachos (Ferpasur)';
  else if (viewName === 'gerential-summary') pageTitle.textContent = 'Reporte Gerencial - Resumen Ejecutivo';
  else if (viewName === 'gerential-indicators') pageTitle.textContent = 'Reporte Gerencial - Indicadores Clave';
  else if (viewName === 'quality-control') pageTitle.textContent = 'Control de Calidad (Liberación de Insumos)';
  else if (viewName === 'production-digitacion') pageTitle.textContent = 'Digitación de Registro de Producción';
  else if (viewName === 'prod-destajo') pageTitle.textContent = 'Reporte de Destajo y Nómina de Producción';
  else if (viewName === 'customer-service') pageTitle.textContent = 'Atención al Cliente - Control de Turnos y Despachos';
  else if (viewName === 'log-physical-consumption') pageTitle.textContent = 'Movimientos de Sacos Vacíos (Ingresos y Consumos)';

  // Load view-specific data
  if (viewName === 'customer-service') {
    loadCustomerServiceData();
  } else if (viewName === 'prod-destajo') {
    renderProdDestajoView();
  } else if (viewName === 'inventory') {
    renderInventoryTable();
  } else if (viewName === 'sales') {
    renderSalesModule();
  } else if (viewName === 'requisition') {
    renderRequisitionView();
  } else if (viewName === 'settings') {
    loadSettingsData();
  } else if (viewName === 'prod-planning') {
    renderProdPlanning();
  } else if (viewName === 'prod-waste') {
    renderProdWaste();
  } else if (viewName === 'log-dispatch') {
    renderLogDispatch();
  } else if (viewName === 'log-physical') {
    renderLogPhysical();
  } else if (viewName === 'log-physical-client') {
    renderLogClient();
  } else if (viewName === 'log-warehouse-3d') {
    renderLogWarehouse3D();
  } else if (viewName === 'maint-orders') {
    renderMaintOrders();
  } else if (viewName === 'maint-parts') {
    renderMaintParts();
  } else if (viewName === 'qual-inspections') {
    renderQualInspections();
  } else if (viewName === 'qual-certs') {
    renderQualCerts();
  } else if (viewName === 'ships-discharge') {
    renderShipsDischarge();
  } else if (viewName === 'ships-docks') {
    renderShipsDocks();
  } else if (viewName === 'plan-turns') {
    renderPlanTurns();
  } else if (viewName === 'imports-status') {
    renderImportsStatusView();
  } else if (viewName === 'plan-dispatch-details') {
    renderPlanDispatchDetails();
  } else if (viewName === 'gerential-summary') {
    renderGerentialSummary();
  } else if (viewName === 'gerential-indicators') {
    renderGerentialIndicators();
  } else if (viewName === 'quality-control') {
    renderQualityControlView();
  } else if (viewName === 'production-digitacion') {
    renderDigitacionView();
  } else if (viewName === 'log-physical-consumption') {
    renderPhysicalConsumptionView();
  }
}

// Show/Hide Helpers
function showLoader(text = 'Cargando...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

function showLogin() {
  document.getElementById('login-container').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
}

function showApp() {
  const loginCont = document.getElementById('login-container');
  const appCont = document.getElementById('app-container');
  if (loginCont) loginCont.classList.add('hidden');
  if (appCont) appCont.classList.remove('hidden');
  
  // Safely trigger dashboard data loading in background
  try {
    loadDashboardData();
  } catch (e) {
    console.error("Error al cargar datos de inicio:", e);
  }
  
  // Navigate to target view
  if (currentUser && currentUser.role === 'quality') {
    switchView('quality-control');
  } else if (currentUser && currentUser.role === 'imports') {
    switchView('imports-status');
  } else if (currentUser && currentUser.role === 'insumos') {
    switchView('log-physical');
  } else {
    switchView('welcome');
  }
}

// Global Error Boundaries for UI Resilience
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error Intercepted:", message, source, lineno, colno, error);
  hideLoader();
  showToast("Ha ocurrido una inconsistencia temporal. La aplicación continúa activa.", "warning");
  return true;
};

window.addEventListener('unhandledrejection', function(event) {
  console.error("Unhandled Rejection Intercepted:", event.reason);
  hideLoader();
  const msg = (event.reason && event.reason.message) ? event.reason.message : "No se pudo completar la comunicación con el servicio.";
  showToast(msg, "warning");
});

// Offline / Online Connectivity & Automatic Sync Manager
window.addEventListener('online', async () => {
  showToast("🌐 Conexión a internet restablecida. Sincronizando datos...", "success");
  updateOnlineStatusBadge(true);
  await flushOfflineQueue();
});

window.addEventListener('offline', () => {
  showToast("📡 Modo Offline activado. Los datos se guardarán localmente.", "warning");
  updateOnlineStatusBadge(false);
});

function updateOnlineStatusBadge(isOnline) {
  let badge = document.getElementById('offline-status-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'offline-status-badge';
    badge.style.cssText = 'position: fixed; top: 12px; right: 80px; z-index: 99999; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.3s ease; display: none;';
    document.body.appendChild(badge);
  }
  if (!isOnline) {
    badge.style.background = 'rgba(239, 68, 68, 0.9)';
    badge.style.color = '#ffffff';
    badge.style.display = 'block';
    badge.textContent = '📡 Modo Offline';
  } else {
    badge.style.background = 'rgba(16, 185, 129, 0.9)';
    badge.style.color = '#ffffff';
    badge.textContent = '🌐 En línea';
    setTimeout(() => { badge.style.display = 'none'; }, 3000);
  }
}

async function queueOfflineRequest(endpoint, options) {
  const queue = JSON.parse(localStorage.getItem('ferpacific_offline_queue') || '[]');
  queue.push({
    id: Date.now(),
    endpoint,
    options,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('ferpacific_offline_queue', JSON.stringify(queue));
  showToast("Operación guardada localmente en modo Offline. Se sincronizará automáticamente al reconectar.", "info");
}

async function flushOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem('ferpacific_offline_queue') || '[]');
  if (queue.length === 0) return;

  console.log(`[Offline Sync] Sincronizando ${queue.length} operaciones pendientes...`);
  let synced = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      await fetch(`${API_URL}${item.endpoint}`, {
        ...item.options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(item.options.headers || {})
        }
      });
      synced++;
    } catch (err) {
      console.error(`[Offline Sync] Error al sincronizar item ${item.id}:`, err);
      remaining.push(item);
    }
  }

  localStorage.setItem('ferpacific_offline_queue', JSON.stringify(remaining));
  if (synced > 0) {
    showToast(`¡Éxito! Se sincronizaron ${synced} registros guardados localmente.`, "success");
    if (typeof loadStockData === 'function') loadStockData();
  }
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999999; display: flex; flex-direction: column; gap: 10px; max-width: 380px; width: 90%; pointer-events: none;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const bgColors = {
    info: 'rgba(30, 41, 59, 0.95)',
    success: 'rgba(16, 185, 129, 0.95)',
    warning: 'rgba(245, 158, 11, 0.95)',
    danger: 'rgba(239, 68, 68, 0.95)'
  };
  toast.style.cssText = `background: ${bgColors[type] || bgColors.info}; color: #ffffff; padding: 12px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; box-shadow: 0 10px 25px rgba(0,0,0,0.3); pointer-events: auto; display: flex; align-items: center; justify-content: space-between; gap: 10px; transition: all 0.3s ease; border-left: 4px solid #ffffff; backdrop-filter: blur(8px);`;
  toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer;padding:0;line-height:1;">&times;</button>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Resilient API Request Wrapper
async function apiFetch(endpoint, options = {}) {
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  const maxRetries = isGet ? 2 : 0;
  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 25000);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': '1',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
      };

      const fetchOptions = {
        ...options,
        headers,
        signal: controller.signal
      };

      const res = await fetch(`${API_URL}${endpoint}`, fetchOptions);
      clearTimeout(timeoutId);

      if (res.status === 401 && endpoint !== '/api/login') {
        handleLogout();
        throw new Error("Su sesión ha expirado o no es válida. Por favor, inicie sesión nuevamente.");
      }

      const contentType = res.headers.get('content-type') || '';
      let json = null;

      if (contentType.includes('application/json')) {
        json = await res.json();
      } else {
        const textErr = await res.text();
        console.warn(`Respuesta no-JSON recibida de ${endpoint} (status ${res.status}):`, textErr.substring(0, 150));
        if (endpoint === '/api/login') {
          if (res.status === 401) {
            throw new Error('Usuario o contraseña incorrectos');
          }
          throw new Error('No se pudo establecer comunicación con el servidor. El túnel o servicio se está reconectando.');
        }
        throw new Error('No se pudo establecer comunicación con el servidor. Intente nuevamente.');
      }

      if (!res.ok || !json.success) {
        if (endpoint === '/api/login' && res.status === 401) {
          throw new Error('Usuario o contraseña incorrectos');
        }
        throw new Error((json && json.error) ? json.error : 'No se pudo procesar la solicitud.');
      }

      return json;
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError';
      const errMsg = isAbort ? 'La solicitud tardó demasiado tiempo en responder. Verifique su conexión.' : err.message;

      if (attempt <= maxRetries && !isAbort) {
        console.warn(`Petición a ${endpoint} fallida (Intento ${attempt}/${maxRetries + 1}). Reintentando...`);
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      if (!isGet && (!navigator.onLine || err.message.includes('Failed to fetch') || isAbort)) {
        await queueOfflineRequest(endpoint, options);
        hideLoader();
        return { success: true, offline: true, message: 'Operación guardada localmente en modo Offline.' };
      }

      hideLoader();
      if (endpoint === '/api/login') {
        if (errMsg === 'Usuario o contraseña incorrectos') {
          throw new Error('Usuario o contraseña incorrectos');
        }
        throw new Error('Error de conexión con el servidor. Por favor verifique si el túnel o enlace está activo.');
      }
      throw new Error(errMsg);
    }
  }
}

// LOGIN FLOW
let isLoggingIn = false;

async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (isLoggingIn) return false;
  isLoggingIn = true;

  const usernameInput = (document.getElementById('username')?.value || '').trim();
  const passwordInput = document.getElementById('password')?.value || '';
  const loginError = document.getElementById('login-error');
  
  if (loginError) loginError.classList.add('hidden');
  showLoader('Autenticando...');
  
  try {
    const data = await apiFetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: usernameInput, password: passwordInput })
    });
    
    if (!data || !data.token) {
      throw new Error((data && data.error) || 'Usuario o contraseña incorrectos');
    }

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    setupUserProfile();
    showApp();
    
    if (typeof checkForcePasswordOverlay === 'function') {
      checkForcePasswordOverlay();
    }

    if (currentUser && currentUser.role === 'quality') {
      switchView('quality-control');
    } else if (currentUser && currentUser.role === 'imports') {
      switchView('imports-status');
    } else if (currentUser && currentUser.role === 'insumos') {
      switchView('log-physical');
    } else {
      switchView('dashboard');
    }
  } catch (err) {
    if (loginError) {
      loginError.textContent = err.message || 'Usuario o contraseña incorrectos';
      loginError.classList.remove('hidden');
    }
  } finally {
    isLoggingIn = false;
    hideLoader();
  }
  return false;
}
window.handleLogin = handleLogin;

function handleLogout() {
  token = '';
  currentUser = null;
  localStorage.removeItem('token');
  showLogin();
}

function setupUserProfile() {
  if (!currentUser) return;
  document.getElementById('user-display-name').textContent = currentUser.name;
  
  let roleText = 'Visualizador';
  let badgeText = 'Consulta';
  if (currentUser.role === 'admin') {
    roleText = 'Administrador';
    badgeText = 'Admin';
  } else if (currentUser.role === 'logistic') {
    roleText = 'Coordinador Logístico';
    badgeText = 'Logística';
  } else if (currentUser.role === 'quality') {
    roleText = 'Coordinador de Calidad';
    badgeText = 'Calidad';
  } else if (currentUser.role === 'imports') {
    roleText = 'Asesor de Operaciones';
    badgeText = 'Importaciones';
  }
  document.getElementById('user-display-role').textContent = roleText;
  
  // Set Initials
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('user-avatar-initials').textContent = initials;
  
  // Set role badge
  const roleBadge = document.getElementById('role-badge');
  roleBadge.textContent = badgeText;
  
  // Show/Hide features and menus based on role
  const settingsMenu = document.getElementById('menu-settings');
  const syncMenu = document.getElementById('menu-logistic');
  const sendEmailAlertsBtn = document.getElementById('btn-send-email-alerts');
  const smtpCard = document.getElementById('card-smtp-settings');
  const testBtn = document.getElementById('btn-test-smtp');
  
  const digitacionMenu = document.getElementById('menu-production-digitacion');
  if (digitacionMenu) {
    if (currentUser.role === 'admin' || currentUser.role === 'logistic') {
      digitacionMenu.classList.remove('hidden');
    } else {
      digitacionMenu.classList.add('hidden');
    }
  }

  const movementsMenu = document.getElementById('menu-log-physical-consumption');
  if (movementsMenu) {
    if (currentUser.role === 'admin' || currentUser.role === 'logistic' || currentUser.role === 'quality') {
      movementsMenu.classList.remove('hidden');
    } else {
      movementsMenu.classList.add('hidden');
    }
  }

  const importsStatusMenu = document.getElementById('menu-imports-status');
  if (importsStatusMenu) {
    if (currentUser.role === 'admin' || currentUser.role === 'logistic' || currentUser.role === 'quality' || currentUser.role === 'imports') {
      importsStatusMenu.classList.remove('hidden');
    } else {
      importsStatusMenu.classList.add('hidden');
    }
  }
  
  if (currentUser.role === 'admin') {
    if (settingsMenu) settingsMenu.classList.remove('hidden');
    if (syncMenu) syncMenu.classList.remove('hidden');
    if (sendEmailAlertsBtn) sendEmailAlertsBtn.classList.remove('hidden');
    if (smtpCard) smtpCard.classList.remove('hidden');
    if (testBtn) testBtn.classList.remove('hidden');
    const saveGen = document.getElementById('btn-save-general');
    if (saveGen) saveGen.removeAttribute('disabled');
    const saveSpec = document.getElementById('btn-save-specialties');
    if (saveSpec) saveSpec.removeAttribute('disabled');
    
    // Show all dropdowns
    document.querySelectorAll('.sidebar-dropdown').forEach(dropdown => {
      dropdown.classList.remove('hidden');
    });
    const welcomeMenu = document.getElementById('menu-welcome');
    if (welcomeMenu) welcomeMenu.classList.remove('hidden');
    
  } else if (currentUser.role === 'logistic') {
    if (settingsMenu) settingsMenu.classList.add('hidden');
    if (syncMenu) syncMenu.classList.remove('hidden');
    if (sendEmailAlertsBtn) sendEmailAlertsBtn.classList.remove('hidden');
    if (smtpCard) smtpCard.classList.add('hidden');
    if (testBtn) testBtn.classList.add('hidden');
    
    // Show all dropdowns
    document.querySelectorAll('.sidebar-dropdown').forEach(dropdown => {
      dropdown.classList.remove('hidden');
    });
    const welcomeMenu = document.getElementById('menu-welcome');
    if (welcomeMenu) welcomeMenu.classList.remove('hidden');
    
  } else if (currentUser.role === 'viewer') {
    if (settingsMenu) settingsMenu.classList.add('hidden');
    if (syncMenu) syncMenu.classList.add('hidden');
    if (sendEmailAlertsBtn) sendEmailAlertsBtn.classList.add('hidden');
    
    // Show all dropdowns
    document.querySelectorAll('.sidebar-dropdown').forEach(dropdown => {
      dropdown.classList.remove('hidden');
    });
    const welcomeMenu = document.getElementById('menu-welcome');
    if (welcomeMenu) welcomeMenu.classList.remove('hidden');
    
  } else if (currentUser.role === 'quality') {
    if (settingsMenu) settingsMenu.classList.add('hidden');
    if (syncMenu) syncMenu.classList.add('hidden');
    if (sendEmailAlertsBtn) sendEmailAlertsBtn.classList.add('hidden');
    
    // Hide all sidebar dropdowns except dropdown-calidad
    document.querySelectorAll('.sidebar-dropdown').forEach(dropdown => {
      if (dropdown.id === 'dropdown-calidad') {
        dropdown.classList.remove('hidden');
        dropdown.classList.add('open');
      } else {
        dropdown.classList.add('hidden');
      }
    });
    
    // Hide home welcome view menu
    const welcomeMenu = document.getElementById('menu-welcome');
    if (welcomeMenu) welcomeMenu.classList.add('hidden');
  } else if (currentUser.role === 'imports') {
    if (settingsMenu) settingsMenu.classList.add('hidden');
    if (syncMenu) syncMenu.classList.add('hidden');
    if (sendEmailAlertsBtn) sendEmailAlertsBtn.classList.add('hidden');
    
    // Hide all sidebar dropdowns except dropdown-buques
    document.querySelectorAll('.sidebar-dropdown').forEach(dropdown => {
      if (dropdown.id === 'dropdown-buques' || dropdown.id === 'dropdown-importaciones') {
        dropdown.classList.remove('hidden');
        dropdown.classList.add('open');
      } else {
        dropdown.classList.add('hidden');
      }
    });
    
    // Hide home welcome view menu
    const welcomeMenu = document.getElementById('menu-welcome');
    if (welcomeMenu) welcomeMenu.classList.add('hidden');
  } else if (currentUser.role === 'insumos') {
    if (settingsMenu) settingsMenu.classList.add('hidden');
    if (syncMenu) syncMenu.classList.add('hidden');
    if (sendEmailAlertsBtn) sendEmailAlertsBtn.classList.add('hidden');
    
    // Hide all sidebar dropdowns except dropdown-logistica
    document.querySelectorAll('.sidebar-dropdown').forEach(dropdown => {
      if (dropdown.id === 'dropdown-logistica') {
        dropdown.classList.remove('hidden');
        dropdown.classList.add('open');
      } else {
        dropdown.classList.add('hidden');
      }
    });
    
    // Hide home welcome view menu
    const welcomeMenu = document.getElementById('menu-welcome');
    if (welcomeMenu) welcomeMenu.classList.add('hidden');
  }

  // Safeguard: Disable or enable form controls across all views based on role
  const isViewer = currentUser.role === 'viewer';
  document.querySelectorAll('.app-view form').forEach(form => {
    form.querySelectorAll('input, select, textarea, button').forEach(el => {
      if (isViewer) {
        el.setAttribute('disabled', 'true');
      } else {
        el.removeAttribute('disabled');
      }
    });
  });

  // Toggle private credentials cheatsheet visibility for jduran admin username
  const cheatsheetCard = document.getElementById('card-access-control-cheatsheet');
  if (cheatsheetCard) {
    if (currentUser && (currentUser.username === 'jduran' || currentUser.username === 'jduran_admin')) {
      cheatsheetCard.classList.remove('hidden');
    } else {
      cheatsheetCard.classList.add('hidden');
    }
  }
}

async function validateTokenAndLoad() {
  showLoader('Verificando sesión...');
  try {
    // Attempt load stock, which implicitly checks token validity
    const data = await apiFetch('/api/stock');
    currentUser = {
      username: token === localStorage.getItem('token') && token.substring(0, 6) === 'jduran' ? 'jduran' : 'lmerchan', // safe guest default
      name: token.substring(0, 6) === 'jduran' ? 'Johnny Duran' : 'Luis Merchan', // default before settings load
      role: token.substring(0, 6) === 'jduran' ? 'admin' : 'logistic'
    };
    
    // Wait, let's load actual settings first to overwrite mock user role
    const setRes = await apiFetch('/api/settings').catch(() => null);
    if (setRes) {
      // Decode user from token structure or API helper. Let's just fetch current session details.
      // We can use a trick: check which user is running by examining db users.
      // Better: our API login returns token, and we can fetch token user status.
      // Let's call /api/stock which returns history and we can inspect the role.
    }
    
    // We can assume user is jduran or lmerchan based on session. In server.js, the session validates.
    // Let's decode the user name from server sessions by writing it.
    // Wait! Let's get the active user details from server storage by adding an API or checking response.
    // Actually, we can fetch settings or stock. Let's inspect the return of /api/stock: it has stock data.
    // Let's set user details based on local metadata. If token is valid, we can set user.
    // Let's call a quick check: our api token is validated. Let's deduce user role:
    // To make it fully robust, we save user details in localStorage too.
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      currentUser = JSON.parse(cachedUser);
    } else {
      // default fallback
      currentUser = { username: 'jduran', name: 'Johnny Duran', role: 'admin' };
    }
    
    setupUserProfile();
    showApp();
    checkForcePasswordOverlay();
  } catch (err) {
    console.error(err);
    handleLogout();
  } finally {
    hideLoader();
  }
}

// End validateTokenAndLoad

// LOAD DATA
async function loadDashboardData() {
  try {
    const data = await apiFetch('/api/stock');
    currentStock = data.stock;
    currentSpecialties = data.specialties;
    specialtiesThreshold = data.specialtiesThreshold || 20000;
    historyLog = data.history || [];
    
    // Load bag designs file list
    try {
      const artesData = await apiFetch('/api/artes');
      availableArtesFiles = artesData.files || [];
    } catch (e) {
      console.error("Error al cargar archivos de artes:", e);
      availableArtesFiles = [];
    }
    
    renderDashboardStats();
    renderCriticalSpecialties();
    renderOtherLowStock();
    renderActivityLog();
    renderTransitDashboardTable();
  } catch (err) {
    console.error("Error cargando dashboard:", err);
  }
}

// RENDER STATS
function renderDashboardStats() {
  // Total Bags
  const totalBags = currentStock.reduce((acc, item) => acc + item.total, 0);
  document.getElementById('stat-total-bags').textContent = totalBags.toLocaleString();
  
  // Projected demand items count
  const projectedCount = currentStock.filter(item => (item.projection3Months || 0) > 0).length;
  document.getElementById('stat-specialty-bags').textContent = `${projectedCount} de ${currentStock.length}`;
  
  // Urgent Alerts Count
  const lowStockCount = currentStock.filter(item => item.alertStatus === 'URGENTE').length;
  
  const statLowStock = document.getElementById('stat-low-stock-count');
  statLowStock.textContent = lowStockCount;
  if (lowStockCount > 0) {
    statLowStock.classList.add('text-danger');
  } else {
    statLowStock.classList.remove('text-danger');
  }
  
  // Sync Banner Alert
  const alertBanner = document.getElementById('alert-banner');
  if (lowStockCount > 0) {
    document.getElementById('alert-count').textContent = lowStockCount;
    alertBanner.classList.remove('hidden');
  } else {
    alertBanner.classList.add('hidden');
  }

  // Update last sync time label
  const lastSyncTimeLabel = document.getElementById('last-sync-time');
  if (historyLog.length > 0) {
    const lastSync = historyLog[0];
    const date = new Date(lastSync.timestamp);
    lastSyncTimeLabel.textContent = `Última actualización: ${date.toLocaleString()} por ${lastSync.user}`;
  } else {
    lastSyncTimeLabel.textContent = `Última actualización: Sin datos cargados`;
  }
}

// RENDER CRITICAL SPECIALTIES (URGENT ALERTS)
function renderCriticalSpecialties() {
  const tbody = document.querySelector('#table-critical-specialties tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const criticalItems = currentStock.filter(item => item.alertStatus === 'URGENTE');
  
  if (criticalItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-success py-4">
          🟢 Excelente. No hay sacos con alertas urgentes de quiebre.
        </td>
      </tr>
    `;
    return;
  }
  
  criticalItems.forEach(item => {
    const tr = document.createElement('tr');
    const isSpecialty = String(item.linea || '').includes('Especialidades');
    
    tr.innerHTML = `
      <td class="font-monospace">${item.code}</td>
      <td><strong class="bag-desc-link" onclick="openBagArt('${item.code}', '${item.desc.replace(/'/g, "\\'")}')">${item.desc}</strong></td>
      <td>
        <span class="badge ${isSpecialty ? 'badge-specialty' : 'badge-normal'}">${item.linea || 'Tradicionales'}</span>
      </td>
      <td class="text-right text-danger font-weight-bold">${item.total.toLocaleString()}</td>
      <td class="text-right text-muted">${(item.jul26 || 0).toLocaleString()}</td>
      <td class="text-center">
        <span class="badge badge-danger">🔴 URGENTE</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// RENDER OTHER LOW STOCK (ITEMS TO ORDER)
function renderOtherLowStock() {
  const tbody = document.querySelector('#table-other-low-stock tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const orderItems = currentStock.filter(item => item.alertStatus === 'SOLICITAR');
  
  if (orderItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">🟢 Excelente. No hay sacos con necesidad de pedido a 3 meses.</td>
      </tr>
    `;
    return;
  }
  
  // Sort by highest suggested order
  orderItems.sort((a, b) => b.suggestedOrder - a.suggestedOrder);
  
  orderItems.forEach(item => {
    const tr = document.createElement('tr');
    const isSpecialty = String(item.linea || '').includes('Especialidades');
    
    tr.innerHTML = `
      <td class="font-monospace">${item.code}</td>
      <td><strong class="bag-desc-link" onclick="openBagArt('${item.code}', '${item.desc.replace(/'/g, "\\'")}')">${item.desc}</strong></td>
      <td>
        <span class="badge ${isSpecialty ? 'badge-specialty' : 'badge-normal'}">${item.linea || 'Tradicionales'}</span>
      </td>
      <td class="text-right font-weight-bold">${item.total.toLocaleString()}</td>
      <td class="text-right text-muted">${(item.totalTransit || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.projection3Months || 0).toLocaleString()}</td>
      <td class="text-right font-weight-bold text-warning">${(item.suggestedOrder || 0).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openBagArt(code, desc) {
  const modal = document.getElementById('modal-bag-art');
  const title = document.getElementById('modal-bag-art-title');
  const iframeContainer = document.getElementById('modal-bag-art-iframe-container');
  const iframe = document.getElementById('modal-bag-art-iframe');
  const errorContainer = document.getElementById('modal-bag-art-error-container');
  const errorText = document.getElementById('modal-bag-art-error-text');

  title.innerHTML = `<span>📦</span> Arte de Saco: ${desc} (${code})`;
  
  // Normalize code and look for matched file
  let matchedFile = availableArtesFiles.find(f => f.startsWith(code));
  
  if (!matchedFile) {
    // Try to match by core segment (e.g. "1161" in "12.01.01.1161.01")
    const segments = code.split('.');
    if (segments.length >= 4) {
      const core = segments[3];
      matchedFile = availableArtesFiles.find(f => f.includes(core));
    }
  }

  // Fuzzy match by description keywords if code-based fails
  if (!matchedFile) {
    const descWords = desc.toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['SACO', 'VACIO', 'LAMINADO', 'CON', 'CONTO', 'PARA', 'SULFATO', 'UREA', 'BLANCO', 'FONDO', 'PLANO'].includes(w));
    
    for (const word of descWords) {
      matchedFile = availableArtesFiles.find(f => f.toUpperCase().includes(word));
      if (matchedFile) break;
    }
  }

  // Fallbacks by common names
  if (!matchedFile) {
    if (desc.toUpperCase().includes('UREA')) {
      matchedFile = availableArtesFiles.find(f => f.toUpperCase().includes('UREA'));
    } else if (desc.toUpperCase().includes('SULFATO')) {
      matchedFile = availableArtesFiles.find(f => f.toUpperCase().includes('SULFATO'));
    } else if (desc.toUpperCase().includes('MURIATO') || desc.toUpperCase().includes('MOP')) {
      matchedFile = availableArtesFiles.find(f => f.toUpperCase().includes('MURIATO'));
    } else if (desc.toUpperCase().includes('DAP')) {
      matchedFile = availableArtesFiles.find(f => f.toUpperCase().includes('D.A.P'));
    }
  }

  if (matchedFile) {
    iframe.src = `/artes/${encodeURIComponent(matchedFile)}`;
    iframeContainer.style.display = 'block';
    errorContainer.classList.add('hidden');
  } else {
    iframe.src = '';
    iframeContainer.style.display = 'none';
    errorText.textContent = `No se ha podido localizar un archivo PDF de arte que coincida con el código ${code} o la descripción "${desc}".`;
    errorContainer.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
}

function closeBagArtModal() {
  const modal = document.getElementById('modal-bag-art');
  const iframe = document.getElementById('modal-bag-art-iframe');
  iframe.src = '';
  modal.classList.add('hidden');
}

// RENDER INVENTORY TABLE (TAB 2)
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-tbody');
  tbody.innerHTML = '';
  
  const filtered = getFilteredInventory();
  
  // Pagination
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / inventoryLimit));
  
  if (inventoryPage > totalPages) inventoryPage = totalPages;
  
  const startIndex = (inventoryPage - 1) * inventoryLimit;
  const paginated = filtered.slice(startIndex, startIndex + inventoryLimit);
  
  // Update pagination UI
  document.getElementById('page-indicator').textContent = `Página ${inventoryPage} de ${totalPages} (${totalItems} ítems)`;
  document.getElementById('btn-prev-page').disabled = inventoryPage === 1;
  document.getElementById('btn-next-page').disabled = inventoryPage === totalPages;
  
  if (paginated.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="19" class="text-center py-4 text-muted">No se encontraron sacos con los filtros de búsqueda seleccionados.</td>
      </tr>
    `;
    return;
  }
  
  paginated.forEach(item => {
    const tr = document.createElement('tr');
    const linea = String(item.linea || 'Tradicionales');
    const isSpecialty = linea.includes('Especialidades');
    
    // Transits
    const trSaco = item.transitSacoplast || 0;
    const trInter = item.transitInterama || 0;
    const trPlast = item.transitPlasticsack || 0;
    const trRey = item.transitReysac || 0;
    
    // Style highlights for non-zero transits
    const renderTransitCell = (val) => {
      return val > 0 
        ? `<td class="text-right font-weight-bold" style="color: var(--accent);">${val.toLocaleString()}</td>`
        : `<td class="text-right text-muted">-</td>`;
    };
    
    // Status Badge
    let badgeClass = 'badge-normal';
    let statusText = 'Sin Proyección';
    if (item.alertStatus === 'URGENTE') {
      badgeClass = 'badge-danger';
      statusText = '🔴 URGENTE';
    } else if (item.alertStatus === 'SOLICITAR') {
      badgeClass = 'badge-warning';
      statusText = '🟠 SOLICITAR';
    } else if (item.alertStatus === 'EN_TRANSITO') {
      badgeClass = 'badge-role';
      statusText = '🔵 EN TRÁNSITO';
    } else if (item.alertStatus === 'SUFICIENTE') {
      badgeClass = 'badge-success';
      statusText = '🟢 SUFICIENTE';
    }
    
    tr.innerHTML = `
      <td class="font-monospace">${item.code}</td>
      <td><strong class="bag-desc-link" onclick="openBagArt('${item.code}', '${item.desc.replace(/'/g, "\\'")}')">${item.desc}</strong></td>
      <td>
        <span class="badge ${isSpecialty ? 'badge-specialty' : 'badge-normal'}">
          ${linea}
        </span>
      </td>
      <td class="text-right font-weight-bold">${item.total.toLocaleString()}</td>
      ${renderTransitCell(trSaco)}
      ${renderTransitCell(trInter)}
      ${renderTransitCell(trPlast)}
      ${renderTransitCell(trRey)}
      <td class="text-right text-muted">${(item.jul26 || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.aug26 || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.sep26 || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.oct26 || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.nov26 || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.dec26 || 0).toLocaleString()}</td>
      <td class="text-right font-weight-bold" style="color: var(--accent);">${(item.projection3Months || 0).toLocaleString()}</td>
      <td class="text-center">
        <span class="badge ${badgeClass}">${statusText}</span>
      </td>
      <td class="text-right font-weight-bold" style="color: ${item.suggestedOrder > 0 ? 'var(--warning-text)' : 'inherit'};">
        ${item.suggestedOrder > 0 ? item.suggestedOrder.toLocaleString() : '-'}
      </td>
      <td class="text-right">
        <input type="number" class="requisition-input" data-code="${item.code}" value="${item.requisition || ''}" min="0" placeholder="0" style="width: 85px; padding: 0.25rem 0.5rem; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 4px; text-align: right;" ${currentUser && currentUser.role === 'viewer' ? 'disabled' : ''}>
      </td>
      <td class="col-observation" id="obs-${item.code}">
        ${item.observation || 'Análisis de inventario estable.'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// EXCEL SYNC (TAB 3)
async function triggerExcelSync() {
  const fileInput = document.getElementById('sync-file-input');
  const file = selectedExcelFile || (fileInput ? fileInput.files[0] : null);
  
  if (!file) {
    alert("Por favor, selecciona un archivo Excel para sincronizar.");
    return;
  }
  
  const resultBox = document.getElementById('sync-result');
  resultBox.classList.add('hidden');
  
  showLoader('Sincronizando archivo Excel en la nube...');
  
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        const data = await apiFetch('/api/update-stock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'X-File-Name': file.name
          },
          body: buffer
        });
        
        // Reload dashboard
        await loadDashboardData();
        
        // Reset file selection
        selectedExcelFile = null;
        if (fileInput) fileInput.value = '';
        const selectedDetails = document.getElementById('selected-file-details');
        if (selectedDetails) selectedDetails.classList.add('hidden');
        const syncBtn = document.getElementById('btn-trigger-sync');
        if (syncBtn) syncBtn.setAttribute('disabled', 'true');
        
        // Show results
        resultBox.innerHTML = `
          <div class="sync-result-title text-success">
            ✓ Sincronización Completada Exitosamente
          </div>
          <div class="sync-result-stats">
            <div class="sync-stat-item">
              <span>Sacos Leídos</span>
              <strong>${data.totalItems}</strong>
            </div>
            <div class="sync-stat-item">
              <span>Códigos Especialidad Bajos</span>
              <strong class="${data.lowStockCount > 0 ? 'text-danger' : ''}">${data.lowStockCount}</strong>
            </div>
          </div>
          <div class="sync-alert-status ${data.emailSent ? 'bg-green-light text-success' : 'bg-blue-light text-muted'}" style="margin-top: 1rem; padding: 0.75rem 1rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <strong>Correo de Alerta:</strong> ${data.emailSent ? '📧 Enviado con éxito a destinatarios' : (data.lowStockCount > 0 ? `⚠️ Falla al enviar: ${data.emailError}` : 'No se requería alerta (stock óptimo)')}
          </div>
        `;
        resultBox.classList.remove('hidden');
      } catch (err) {
        console.error('Error al sincronizar stock:', err);
        resultBox.innerHTML = `
          <div class="sync-result-title text-danger">
            ✗ Fallo en la Sincronización
          </div>
          <p class="text-danger" style="margin-top: 0.5rem; font-size: 0.875rem;">${err.message}</p>
        `;
        resultBox.classList.remove('hidden');
      } finally {
        hideLoader();
      }
    };
    reader.onerror = () => {
      hideLoader();
      alert("Error al leer el archivo Excel local.");
    };
    reader.readAsArrayBuffer(file);
  } catch (err) {
    hideLoader();
    console.error('Error al iniciar lectura:', err);
    alert('Error al iniciar lectura: ' + err.message);
  }
}

// RENDER ACTIVITY LOG (TAB 3 right panel)
function renderActivityLog() {
  const list = document.getElementById('activity-log-list');
  list.innerHTML = '';
  
  if (historyLog.length === 0) {
    list.innerHTML = `<li class="text-muted py-3 text-center">No hay registros de actualizaciones previas.</li>`;
    return;
  }
  
  historyLog.slice(0, 10).forEach(log => {
    const li = document.createElement('li');
    li.className = 'activity-item';
    
    const date = new Date(log.timestamp);
    let icon = '🔄';
    let statusClass = 'text-success';
    if (log.status.includes('error') || log.emailError) {
      icon = '❌';
      statusClass = 'text-danger';
    } else if (log.emailSent) {
      icon = '📧';
      statusClass = 'text-success';
    }
    
    li.innerHTML = `
      <div class="activity-icon">${icon}</div>
      <div class="activity-details">
        <div class="activity-meta">
          <strong>${log.user} (${log.username})</strong>
          <span>${date.toLocaleString()}</span>
        </div>
        <div class="activity-text">
          Actualizó saldos desde <code>${log.file}</code>.
        </div>
        <div class="activity-subtext">
          Total: ${log.totalItems} ítems. Especialidades críticas: <strong class="${log.lowStockSpecialtiesCount > 0 ? 'text-danger' : ''}">${log.lowStockSpecialtiesCount}</strong>.
          <span class="${statusClass}">[${log.status}]</span>
        </div>
      </div>
    `;
    list.appendChild(li);
  });
}

// SETTINGS FLOW (TAB 4)
async function loadSettingsData() {
  showLoader('Cargando configuración...');
  try {
    const data = await apiFetch('/api/settings');
    
    // General Form
    document.getElementById('settings-threshold').value = data.settings.specialtiesThreshold;
    document.getElementById('settings-recipients').value = data.settings.emailRecipients.join(', ');
    
    // SMTP Form
    const smtp = data.settings.smtp;
    document.getElementById('smtp-method').value = smtp.method || 'smtp';
    document.getElementById('smtp-host').value = smtp.host || '';
    document.getElementById('smtp-port').value = smtp.port || '';
    document.getElementById('smtp-user').value = smtp.user || '';
    document.getElementById('smtp-pass').value = smtp.pass || '';
    document.getElementById('smtp-from').value = smtp.from || '';
    document.getElementById('smtp-secure').checked = !!smtp.secure;
    toggleSmtpCredentialsVisibility();
    
    // Specialty Codes Setup
    currentSpecialties = data.specialties;
    renderSpecialtiesSetupList();

    // User management visibility & load
    const userCard = document.getElementById('card-user-management');
    if (userCard) {
      if (currentUser && currentUser.role === 'admin') {
        userCard.classList.remove('hidden');
        renderUsersSetupTable();
      } else {
        userCard.classList.add('hidden');
      }
    }

    // Also load credentials and links if user navigates to settings
    loadCredentialsList();
    loadLinksList();
  } catch (err) {
    console.error(err);
  } finally {
    hideLoader();
  }
}

// RENDER SPECIALTIES CHECKLIST SETUP
function renderSpecialtiesSetupList() {
  const tbody = document.getElementById('specialty-setup-tbody');
  tbody.innerHTML = '';
  
  const searchVal = document.getElementById('search-specialty-setup').value.toLowerCase().trim();
  
  // We list all unique codes from current stock. If stock is empty, we show pre-selected specialties
  // Let's combine currentStock items and currentSpecialties to build the list
  const allCodesMap = new Map();
  
  currentStock.forEach(item => {
    allCodesMap.set(item.code, { code: item.code, desc: item.desc });
  });
  
  // Ensure preconfigured specialties are in the map even if stock is empty
  currentSpecialties.forEach(code => {
    if (!allCodesMap.has(code)) {
      allCodesMap.set(code, { code: code, desc: `[Pre-configurado] Saco de Especialidad` });
    }
  });
  
  const allCodes = Array.from(allCodesMap.values());
  
  // Sort codes alphabetically
  allCodes.sort((a, b) => a.code.localeCompare(b.code));
  
  const filtered = allCodes.filter(item => {
    return item.code.toLowerCase().includes(searchVal) || item.desc.toLowerCase().includes(searchVal);
  });
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted">No se encontraron productos.</td></tr>`;
    return;
  }
  
  filtered.forEach(item => {
    const tr = document.createElement('tr');
    const isChecked = currentSpecialties.includes(item.code);
    
    tr.innerHTML = `
      <td class="text-center">
        <div class="checkbox-center">
          <input type="checkbox" class="specialty-checkbox" data-code="${item.code}" ${isChecked ? 'checked' : ''} ${currentUser.role !== 'admin' ? 'disabled' : ''}>
        </div>
      </td>
      <td class="font-monospace">${item.code}</td>
      <td style="font-size: 0.8125rem;">${item.desc}</td>
    `;
    tbody.appendChild(tr);
  });
}

// SAVE GENERAL SETTINGS
async function saveGeneralSettings(e) {
  e.preventDefault();
  if (currentUser.role !== 'admin') return;

  const threshold = Number(document.getElementById('settings-threshold').value);
  const recipientsStr = document.getElementById('settings-recipients').value;
  const emailRecipients = recipientsStr.split(',').map(e => e.trim()).filter(Boolean);
  
  showLoader('Guardando configuración de alertas...');
  try {
    await apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        specialtiesThreshold: threshold,
        emailRecipients
      })
    });
    
    // Reload dashboard state
    await loadDashboardData();
    alert("Parámetros de alerta guardados exitosamente.");
  } catch (err) {
    alert(`Error guardando configuración: ${err.message}`);
  } finally {
    hideLoader();
  }
}

// SAVE SMTP CONFIG
async function saveSmtpSettings(e) {
  e.preventDefault();
  if (currentUser.role !== 'admin') return;

  const smtp = {
    method: document.getElementById('smtp-method').value,
    host: document.getElementById('smtp-host').value.trim(),
    port: Number(document.getElementById('smtp-port').value),
    user: document.getElementById('smtp-user').value.trim(),
    pass: document.getElementById('smtp-pass').value,
    from: document.getElementById('smtp-from').value.trim(),
    secure: document.getElementById('smtp-secure').checked
  };
  
  showLoader('Guardando parámetros SMTP...');
  try {
    await apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ smtp })
    });
    alert("Servidor de salida SMTP configurado exitosamente.");
  } catch (err) {
    alert(`Error al guardar SMTP: ${err.message}`);
  } finally {
    hideLoader();
  }
}

function toggleSmtpCredentialsVisibility() {
  const method = document.getElementById('smtp-method').value;
  const group = document.getElementById('smtp-credentials-group');
  if (method === 'formsubmit') {
    group.classList.add('hidden');
  } else {
    group.classList.remove('hidden');
  }
}

// TEST SMTP CONFIG
async function testSmtpConnection() {
  if (currentUser.role !== 'admin') return;
  const testBox = document.getElementById('smtp-test-result');
  testBox.innerHTML = 'Enviando correo de prueba...\n';
  testBox.classList.remove('hidden');
  
  try {
    const data = await apiFetch('/api/test-email', {
      method: 'POST'
    });
    
    testBox.innerHTML = `<strong>✓ ${data.message}</strong>\n\nSMTP logs:\n` + data.log.join('\n');
    testBox.style.color = '#34d399';
  } catch (err) {
    testBox.innerHTML = `<strong>✗ Falló el envío de prueba: ${err.message}</strong>` + (err.log ? `\n\nSMTP logs:\n` + err.log.join('\n') : '');
    testBox.style.color = '#f87171';
  }
}

// SAVE SPECIALTIES CHECKLIST
async function saveSpecialtiesSelection() {
  if (currentUser.role !== 'admin') return;
  
  const checkboxes = document.querySelectorAll('.specialty-checkbox');
  const selectedSpecialties = [];
  
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedSpecialties.push(cb.getAttribute('data-code'));
    }
  });
  
  showLoader('Guardando especialidades seleccionadas...');
  try {
    await apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        specialties: selectedSpecialties
      })
    });
    
    // Reload dashboard state
    await loadDashboardData();
    alert(`Lista de Especialidades actualizada con éxito (${selectedSpecialties.length} productos marcados).`);
  } catch (err) {
    alert(`Error actualizando especialidades: ${err.message}`);
  } finally {
    hideLoader();
  }
}

// RENDER TRANSIT DASHBOARD TABLE
function renderTransitDashboardTable() {
  const tbody = document.querySelector('#table-transit-dashboard tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const searchVal = document.getElementById('search-transit-dashboard').value.toLowerCase().trim();
  const providerFilter = document.getElementById('filter-provider-dashboard').value;
  
  const transitRows = [];
  
  currentStock.forEach(item => {
    const providers = [
      { name: 'Sacoplast', key: 'transitSacoplast', value: item.transitSacoplast || 0 },
      { name: 'Interama', key: 'transitInterama', value: item.transitInterama || 0 },
      { name: 'Plasticsack', key: 'transitPlasticsack', value: item.transitPlasticsack || 0 },
      { name: 'Reysac', key: 'transitReysac', value: item.transitReysac || 0 }
    ];
    
    providers.forEach(p => {
      if (p.value > 0) {
        // Apply filters
        const matchesSearch = item.code.toLowerCase().includes(searchVal) || item.desc.toLowerCase().includes(searchVal);
        const matchesProvider = providerFilter === 'all' || p.key.toLowerCase().includes(providerFilter);
        
        if (matchesSearch && matchesProvider) {
          transitRows.push({
            code: item.code,
            desc: item.desc,
            provider: p.name,
            value: p.value
          });
        }
      }
    });
  });
  
  // Sort by code
  transitRows.sort((a, b) => a.code.localeCompare(b.code));
  
  if (transitRows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">No hay pendientes de entrega que coincidan con la búsqueda o no se han cargado datos.</td>
      </tr>
    `;
    return;
  }
  
  transitRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-monospace">${row.code}</td>
      <td><strong class="bag-desc-link" onclick="openBagArt('${row.code}', '${row.desc.replace(/'/g, "\\'")}')">${row.desc}</strong></td>
      <td><span class="badge badge-normal">${row.provider}</span></td>
      <td class="text-right font-weight-bold" style="color: var(--accent);">${row.value.toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// RENDER SALES & COMMERCIAL MODULE (TAB 2.5)
function renderSalesModule() {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  // Calculate summary stats (Especialidades vs Tradicionales)
  let especialidadesStock = 0;
  let especialidadesTransit = 0;
  let tradicionalesStock = 0;
  let tradicionalesTransit = 0;
  
  currentStock.forEach(item => {
    const linea = String(item.linea || '').toLowerCase();
    const transit = (item.transitSacoplast || 0) + (item.transitInterama || 0) + (item.transitPlasticsack || 0) + (item.transitReysac || 0);
    
    if (linea.includes('especial')) {
      especialidadesStock += item.total;
      especialidadesTransit += transit;
    } else {
      tradicionalesStock += item.total;
      tradicionalesTransit += transit;
    }
  });
  
  document.getElementById('stat-comercial-stock').textContent = especialidadesStock.toLocaleString();
  document.getElementById('stat-comercial-transit').textContent = `En Tránsito: ${especialidadesTransit.toLocaleString()}`;
  document.getElementById('stat-sales-stock').textContent = tradicionalesStock.toLocaleString();
  document.getElementById('stat-sales-transit').textContent = `En Tránsito: ${tradicionalesTransit.toLocaleString()}`;
  
  // Filter items
  const filtered = getFilteredSales();
  
  // Pagination
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / salesLimit));
  if (salesPage > totalPages) salesPage = totalPages;
  
  const startIndex = (salesPage - 1) * salesLimit;
  const paginated = filtered.slice(startIndex, startIndex + salesLimit);
  
  document.getElementById('sales-page-indicator').textContent = `Página ${salesPage} de ${totalPages} (${totalItems} ítems)`;
  document.getElementById('btn-sales-prev').disabled = salesPage === 1;
  document.getElementById('btn-sales-next').disabled = salesPage === totalPages;
  
  if (paginated.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="15" class="text-center py-4 text-muted">No se encontraron productos con los filtros seleccionados.</td>
      </tr>
    `;
    return;
  }
  
  paginated.forEach(item => {
    const tr = document.createElement('tr');
    
    const linea = String(item.linea || 'Tradicionales');
    const tipo = String(item.tipo || 'SIMPLE');
    const isSpecialty = linea.includes('Especialidades');
    
    const transit = (item.transitSacoplast || 0) + (item.transitInterama || 0) + (item.transitPlasticsack || 0) + (item.transitReysac || 0);
    
    // Status Badge
    let badgeClass = 'badge-normal';
    let statusText = 'Sin Proyección';
    if (item.alertStatus === 'URGENTE') {
      badgeClass = 'badge-danger';
      statusText = '🔴 URGENTE';
    } else if (item.alertStatus === 'SOLICITAR') {
      badgeClass = 'badge-warning';
      statusText = '🟠 SOLICITAR';
    } else if (item.alertStatus === 'EN_TRANSITO') {
      badgeClass = 'badge-role';
      statusText = '🔵 EN TRÁNSITO';
    } else if (item.alertStatus === 'SUFICIENTE') {
      badgeClass = 'badge-success';
      statusText = '🟢 SUFICIENTE';
    }
    
    tr.innerHTML = `
      <td class="font-monospace">${item.code}</td>
      <td><strong class="bag-desc-link" onclick="openBagArt('${item.code}', '${item.desc.replace(/'/g, "\\'")}')">${item.desc}</strong></td>
      <td>
        <span class="badge ${isSpecialty ? 'badge-specialty' : 'badge-normal'}">${linea}</span>
      </td>
      <td><span class="badge badge-normal">${tipo}</span></td>
      <td class="text-right font-weight-bold">${item.total.toLocaleString()}</td>
      <td class="text-right" style="color: ${transit > 0 ? 'var(--accent)' : 'inherit'};">${transit > 0 ? transit.toLocaleString() : '-'}</td>
      <td class="text-right text-muted">${(item.jul26 || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.aug26 || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.sep26 || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.oct26 || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.nov26 || 0).toLocaleString()}</td>
      <td class="text-right text-muted">${(item.dec26 || 0).toLocaleString()}</td>
      <td class="text-right font-weight-bold" style="color: var(--accent);">${(item.projection3Months || 0).toLocaleString()}</td>
      <td class="text-center">
        <span class="badge ${badgeClass}">${statusText}</span>
      </td>
      <td class="text-right font-weight-bold" style="color: ${item.suggestedOrder > 0 ? 'var(--warning-text)' : 'inherit'};">
        ${item.suggestedOrder > 0 ? item.suggestedOrder.toLocaleString() : '-'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// HELPER FUNCTIONS FOR FILTERING AND EXPORTING

function getFilteredInventory() {
  const searchVal = document.getElementById('search-inventory').value.toLowerCase().trim();
  const lineaFilter = document.getElementById('filter-linea').value;
  const statusFilter = document.getElementById('filter-stock-status').value;
  
  return currentStock.filter(item => {
    // Search filter
    const matchesSearch = item.code.toLowerCase().includes(searchVal) || item.desc.toLowerCase().includes(searchVal);
    if (!matchesSearch) return false;
    
    // Linea filter
    const linea = String(item.linea || 'Tradicionales').toLowerCase();
    if (lineaFilter !== 'all') {
      if (lineaFilter === 'especialidades' && !linea.includes('especial')) return false;
      if (lineaFilter === 'tradicionales' && linea.includes('especial')) return false;
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      if (item.alertStatus !== statusFilter) return false;
    }
    
    return true;
  });
}

function getFilteredSales() {
  const searchVal = document.getElementById('search-sales').value.toLowerCase().trim();
  const lineaFilter = document.getElementById('filter-sales-linea').value;
  const tipoFilter = document.getElementById('filter-sales-tipo').value;
  
  return currentStock.filter(item => {
    const matchesSearch = item.code.toLowerCase().includes(searchVal) || item.desc.toLowerCase().includes(searchVal);
    if (!matchesSearch) return false;
    
    const linea = String(item.linea || 'Tradicionales').toLowerCase();
    const tipo = String(item.tipo || 'SIMPLE').toLowerCase();
    
    if (lineaFilter !== 'all') {
      if (lineaFilter === 'especialidades' && !linea.includes('especial')) return false;
      if (lineaFilter === 'tradicionales' && linea.includes('especial')) return false;
    }
    if (tipoFilter !== 'all' && tipo !== tipoFilter) return false;
    
    return true;
  });
}

function handleExport(type) {
  let moduleName = currentView;
  
  if (moduleName === 'log-physical') {
    const date = document.getElementById('log-physical-date').value;
    if (type === 'excel') {
      window.location.href = `/api/ferpasur-consumptions/download-excel?date=${date}&token=${token}`;
    } else if (type === 'pdf') {
      window.location.href = `/api/ferpasur-consumptions/download-pdf?date=${date}&token=${token}`;
    }
  } else if (moduleName === 'log-physical-client') {
    const date = document.getElementById('log-physical-client-date').value;
    if (type === 'excel') {
      window.location.href = `/api/client-consumptions/download-excel?date=${date}&token=${token}`;
    } else if (type === 'pdf') {
      window.location.href = `/api/client-consumptions/download-pdf?date=${date}&token=${token}`;
    }
  } else {
    if (type === 'excel') {
      if (moduleName === 'dashboard') {
        exportToExcel('alerts');
      } else if (moduleName === 'inventory') {
        exportToExcel('inventory');
      } else if (moduleName === 'sales') {
        exportToExcel('sales');
      } else {
        // Generic DOM Table Excel Exporter
        exportActiveViewDOMToExcel(moduleName);
      }
    } else if (type === 'pdf') {
      if (moduleName === 'dashboard') {
        exportToPDF('alerts');
      } else if (moduleName === 'inventory') {
        exportToPDF('inventory');
      } else if (moduleName === 'sales') {
        exportToPDF('sales');
      } else {
        // Generic DOM PDF Exporter using html2pdf.js
        exportActiveViewDOMToPDF(moduleName);
      }
    }
  }
}

function exportToExcel(moduleName) {
  let items = [];
  let filename = '';
  let headers = [];
  let rows = [];

  if (moduleName === 'alerts') {
    items = currentStock.filter(item => item.alertStatus === 'URGENTE' || item.alertStatus === 'SOLICITAR');
    filename = `reporte_alertas_criticas_${new Date().toISOString().slice(0, 10)}.csv`;
    headers = [
      'Código', 'Descripción', 'Línea', 'Saldo Físico', 'Ferpasur', 'Unica',
      'Tránsito Sacoplast', 'Tránsito Interama', 'Tránsito Plasticsack', 'Tránsito Reysac',
      'Consumo 3M (Jul-Sep)', 'Alerta Estado', 'Pedido Sugerido', 'Pedido Requisición', 'Observación IA'
    ];
    
    rows = items.map(item => {
      let statusText = item.alertStatus === 'URGENTE' ? 'URGENTE' : 'SOLICITAR';
      return [
        item.code,
        item.desc,
        item.linea || 'Tradicionales',
        item.total,
        item.ferpasur || 0,
        item.unica || 0,
        item.transitSacoplast || 0,
        item.transitInterama || 0,
        item.transitPlasticsack || 0,
        item.transitReysac || 0,
        item.projection3Months || 0,
        statusText,
        item.suggestedOrder || 0,
        item.requisition || 0,
        item.observation || ''
      ];
    });
  } else if (moduleName === 'sales') {
    items = getFilteredSales();
    filename = `reporte_ventas_${new Date().toISOString().slice(0, 10)}.csv`;
    headers = [
      'Código', 'Descripción', 'Línea', 'Tipo', 'Saldo Físico', 'Tránsito Total',
      'Proyección Julio', 'Proyección Agosto', 'Proyección Septiembre',
      'Proyección Octubre', 'Proyección Noviembre', 'Proyección Diciembre',
      'Consumo 3M (Jul-Sep)', 'Alerta Estado', 'Pedido Sugerido'
    ];
    
    rows = items.map(item => {
      const transit = (item.transitSacoplast || 0) + (item.transitInterama || 0) + (item.transitPlasticsack || 0) + (item.transitReysac || 0);
      let statusText = 'Sin Proyección';
      if (item.alertStatus === 'URGENTE') statusText = 'URGENTE';
      else if (item.alertStatus === 'SOLICITAR') statusText = 'SOLICITAR';
      else if (item.alertStatus === 'EN_TRANSITO') statusText = 'EN TRÁNSITO';
      else if (item.alertStatus === 'SUFICIENTE') statusText = 'SUFICIENTE';
      
      return [
        item.code,
        item.desc,
        item.linea || 'Tradicionales',
        item.tipo || 'SIMPLE',
        item.total,
        transit,
        item.jul26 || 0,
        item.aug26 || 0,
        item.sep26 || 0,
        item.oct26 || 0,
        item.nov26 || 0,
        item.dec26 || 0,
        item.projection3Months || 0,
        statusText,
        item.suggestedOrder || 0
      ];
    });
  } else {
    items = getFilteredInventory();
    filename = `reporte_inventario_${new Date().toISOString().slice(0, 10)}.csv`;
    headers = [
      'Código', 'Descripción', 'Línea', 'Saldo Físico',
      'Tránsito Sacoplast', 'Tránsito Interama', 'Tránsito Plasticsack', 'Tránsito Reysac',
      'Proyección Julio', 'Proyección Agosto', 'Proyección Septiembre',
      'Proyección Octubre', 'Proyección Noviembre', 'Proyección Diciembre',
      'Consumo 3M (Jul-Sep)', 'Alerta Estado', 'Pedido Sugerido', 'Pedido Requisición', 'Observación IA'
    ];
    
    rows = items.map(item => {
      let statusText = 'Sin Proyección';
      if (item.alertStatus === 'URGENTE') statusText = 'URGENTE';
      else if (item.alertStatus === 'SOLICITAR') statusText = 'SOLICITAR';
      else if (item.alertStatus === 'EN_TRANSITO') statusText = 'EN TRÁNSITO';
      else if (item.alertStatus === 'SUFICIENTE') statusText = 'SUFICIENTE';
      
      return [
        item.code,
        item.desc,
        item.linea || 'Tradicionales',
        item.total,
        item.transitSacoplast || 0,
        item.transitInterama || 0,
        item.transitPlasticsack || 0,
        item.transitReysac || 0,
        item.jul26 || 0,
        item.aug26 || 0,
        item.sep26 || 0,
        item.oct26 || 0,
        item.nov26 || 0,
        item.dec26 || 0,
        item.projection3Months || 0,
        statusText,
        item.suggestedOrder || 0,
        item.requisition || 0,
        item.observation || ''
      ];
    });
  }

  // Generate CSV content with semicolon separator
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(val => {
      if (typeof val === 'string') {
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      return val;
    }).join(';'))
  ].join('\n');

  // Excel BOM prefix for UTF-8 compatibility
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function exportToPDF(moduleName) {
  const dateStr = new Date().toLocaleString();
  const userName = currentUser ? currentUser.name : 'Usuario';
  let html = '';
  
  if (moduleName === 'dashboard' || moduleName === 'alerts') {
    const items = currentStock.filter(item => item.alertStatus === 'URGENTE' || item.alertStatus === 'SOLICITAR');
    html = `
      <table class="print-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th>Línea</th>
            <th class="print-text-right">Físico</th>
            <th class="print-text-right">Ferpasur</th>
            <th class="print-text-right">Unica</th>
            <th class="print-text-right">Tránsito</th>
            <th class="print-text-center">Alerta</th>
            <th class="print-text-right">Sugerido</th>
            <th class="print-text-right">Requisición</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            let badgeClass = 'print-badge-order';
            let statusText = '🟠 SOLICITAR';
            if (item.alertStatus === 'URGENTE') { badgeClass = 'print-badge-urgent'; statusText = '🔴 URGENTE'; }
            const transit = (item.transitSacoplast || 0) + (item.transitInterama || 0) + (item.transitPlasticsack || 0) + (item.transitReysac || 0);
            return `<tr><td>${item.code}</td><td>${item.desc}</td><td>${item.linea || 'Tradicionales'}</td><td class="print-text-right">${item.total}</td><td class="print-text-right">${item.ferpasur || 0}</td><td class="print-text-right">${item.unica || 0}</td><td class="print-text-right">${transit}</td><td class="print-text-center"><span class="print-badge ${badgeClass}">${statusText}</span></td><td class="print-text-right">${item.suggestedOrder || 0}</td><td class="print-text-right">${item.requisition || 0}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } else if (moduleName === 'sales') {
    const items = getFilteredSales();
    html = `
      <table class="print-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th>Línea</th>
            <th>Tipo</th>
            <th class="print-text-right">Físico</th>
            <th class="print-text-right">Tránsito</th>
            <th class="print-text-right">Jul</th>
            <th class="print-text-right">Ago</th>
            <th class="print-text-right">Sep</th>
            <th class="print-text-right">Oct</th>
            <th class="print-text-right">Nov</th>
            <th class="print-text-right">Dic</th>
            <th class="print-text-right">Demanda 3M</th>
            <th class="print-text-center">Alerta</th>
            <th class="print-text-right">Sugerido</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            let badgeClass = 'print-badge-sufficient';
            let statusText = '🟢 SUFICIENTE';
            
            if (item.alertStatus === 'URGENTE') {
              badgeClass = 'print-badge-urgent';
              statusText = '🔴 URGENTE';
            } else if (item.alertStatus === 'SOLICITAR') {
              badgeClass = 'print-badge-order';
              statusText = '🟠 SOLICITAR';
            } else if (item.alertStatus === 'EN_TRANSITO') {
              badgeClass = 'print-badge-transit';
              statusText = '🔵 EN TRÁNSITO';
            } else if (item.alertStatus === 'SIN_PROYECCION') {
              badgeClass = 'print-badge-none';
              statusText = '⚪ SIN PROYECCIÓN';
            }

            const transit = (item.transitSacoplast || 0) + (item.transitInterama || 0) + (item.transitPlasticsack || 0) + (item.transitReysac || 0);

            return `
              <tr>
                <td style="font-family: monospace;">${item.code}</td>
                <td><strong class="bag-desc-link" onclick="openBagArt('${item.code}', '${item.desc.replace(/'/g, "\\'")}')">${item.desc}</strong></td>
                <td>${item.linea || 'Tradicionales'}</td>
                <td>${item.tipo || 'SIMPLE'}</td>
                <td class="print-text-right">${item.total.toLocaleString()}</td>
                <td class="print-text-right">${transit > 0 ? transit.toLocaleString() : '-'}</td>
                <td class="print-text-right">${item.jul26 ? item.jul26.toLocaleString() : '-'}</td>
                <td class="print-text-right">${item.aug26 ? item.aug26.toLocaleString() : '-'}</td>
                <td class="print-text-right">${item.sep26 ? item.sep26.toLocaleString() : '-'}</td>
                <td class="print-text-right">${item.oct26 ? item.oct26.toLocaleString() : '-'}</td>
                <td class="print-text-right">${item.nov26 ? item.nov26.toLocaleString() : '-'}</td>
                <td class="print-text-right">${item.dec26 ? item.dec26.toLocaleString() : '-'}</td>
                <td class="print-text-right"><strong>${item.projection3Months ? item.projection3Months.toLocaleString() : '-'}</strong></td>
                <td class="print-text-center">
                  <span class="print-badge ${badgeClass}">${statusText}</span>
                </td>
                <td class="print-text-right">${item.suggestedOrder > 0 ? item.suggestedOrder.toLocaleString() : '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } else {
    const items = getFilteredInventory();
    html = `
      <table class="print-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th>Físico</th>
            <th>Tránsito</th>
            <th>Alerta</th>
            <th>Sugerido</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `<tr><td>${item.code}</td><td>${item.desc}</td><td>${item.total}</td><td>${(item.transitSacoplast||0)+(item.transitInterama||0)}</td><td>${item.alertStatus}</td><td>${item.suggestedOrder||0}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }
  
  // Create print container styled for PDF download
  const container = document.createElement('div');
  const orientation = getOptimalOrientation(moduleName);
  container.className = `print-pdf-container ${orientation}`;
  
  container.innerHTML = `
    <div style="border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
      <table style="width: 100%; border: none !important; margin: 0 !important;">
        <tr style="background: transparent !important;">
          <td style="border: none !important; padding: 0 !important; font-size: 1.6rem; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            FERPACIFIC S.A.
          </td>
          <td style="border: none !important; padding: 0 !important; text-align: right; font-size: 0.85rem; color: #475569;">
            <strong>Módulo:</strong> ${moduleName.toUpperCase()}<br>
            <strong>Generado por:</strong> ${userName}<br>
            <strong>Fecha:</strong> ${dateStr}
          </td>
        </tr>
      </table>
    </div>
    <div class="print-body">${html}</div>
    <div style="margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 10px; text-align: center; font-size: 0.75rem; color: #64748b;">
      Documento generado automáticamente por el Sistema de Control de Sacos Vacíos - Ferpacific
    </div>
  `;
  
  // Add temporarily to DOM
  document.body.appendChild(container);
  
  const opt = {
    margin:       0.3,
    filename:     `reporte_${moduleName}_${new Date().toISOString().slice(0, 10)}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'in', format: 'letter', orientation: orientation }
  };
  
  // Generate and download
  html2pdf().set(opt).from(container).save().then(() => {
    document.body.removeChild(container);
  }).catch(err => {
    console.error('Error generating PDF:', err);
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });
}

// Helpers for generic exporting
function getOptimalOrientation(viewName) {
  const landscapeViews = [
    'alerts',
    'inventory', 
    'sales', 
    'requisition', 
    'imports-liq', 
    'plan-dispatch-details', 
    'prod-waste', 
    'quality-tests',
    'quality-inspections',
    'maint-ot',
    'buques-schedule'
  ];
  if (landscapeViews.includes(viewName)) {
    return 'landscape';
  }
  return 'portrait';
}

function exportActiveViewDOMToExcel(viewName) {
  const targetView = document.getElementById(`view-${viewName}`);
  if (!targetView) return;
  
  const tables = targetView.querySelectorAll('table');
  if (tables.length === 0) {
    alert('Este módulo no contiene tablas de datos para exportar a Excel.');
    return;
  }
  
  let csvContent = '';
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `reporte_${viewName}_${dateStr}.csv`;
  
  tables.forEach((table, tableIdx) => {
    if (tableIdx > 0) csvContent += '\n\n';
    
    const titleEl = table.closest('.card')?.querySelector('h3, h4');
    if (titleEl) {
      csvContent += `"${titleEl.textContent.trim().replace(/"/g, '""')}"\n`;
    }
    
    const headers = [];
    table.querySelectorAll('thead th').forEach(th => {
      const text = th.textContent.trim();
      if (text && text !== 'Acciones' && text !== 'Acción') {
        headers.push(text);
      }
    });
    
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';') + '\n';
    
    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = [];
      tr.querySelectorAll('td').forEach((td, tdIdx) => {
        const headerText = table.querySelectorAll('thead th')[tdIdx]?.textContent.trim();
        if (headerText === 'Acciones' || headerText === 'Acción') return;
        
        const input = td.querySelector('input, select, textarea');
        let text = '';
        if (input) {
          if (input.tagName === 'SELECT') {
            text = input.options[input.selectedIndex]?.text || '';
          } else {
            text = input.value || '';
          }
        } else {
          text = td.textContent.trim();
        }
        cells.push(text);
      });
      if (cells.length > 0) {
        csvContent += cells.map(c => `"${c.replace(/"/g, '""')}"`).join(';') + '\n';
      }
    });
  });
  
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function exportActiveViewDOMToPDF(viewName) {
  const targetView = document.getElementById(`view-${viewName}`);
  if (!targetView) return;
  
  const clone = targetView.cloneNode(true);
  clone.querySelectorAll('.filter-row, button, .btn, form, input[type="submit"], select:not(.print-include), .no-print').forEach(el => el.remove());
  
  const originalInputs = targetView.querySelectorAll('input, select, textarea');
  const cloneInputs = clone.querySelectorAll('input, select, textarea');
  originalInputs.forEach((orig, idx) => {
    if (cloneInputs[idx]) {
      const span = document.createElement('span');
      if (orig.tagName === 'SELECT') {
        span.textContent = orig.options[orig.selectedIndex]?.text || '';
      } else {
        span.textContent = orig.value || '';
      }
      span.style.fontWeight = 'bold';
      cloneInputs[idx].parentNode.replaceChild(span, cloneInputs[idx]);
    }
  });

  const container = document.createElement('div');
  const orientation = getOptimalOrientation(viewName);
  container.className = `print-pdf-container ${orientation}`;
  
  const pageTitle = document.getElementById('page-title')?.textContent || 'Reporte';
  container.innerHTML = `
    <div style="border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
      <table style="width: 100%; border: none !important; margin: 0 !important;">
        <tr style="background: transparent !important;">
          <td style="border: none !important; padding: 0 !important; font-size: 1.6rem; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            FERPACIFIC S.A.
          </td>
          <td style="border: none !important; padding: 0 !important; text-align: right; font-size: 0.85rem; color: #475569;">
            <strong>Módulo:</strong> ${pageTitle}<br>
            <strong>Generado por:</strong> ${currentUser ? currentUser.name : 'Usuario'}<br>
            <strong>Fecha:</strong> ${new Date().toLocaleString()}
          </td>
        </tr>
      </table>
    </div>
    <div class="print-body"></div>
    <div style="margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 10px; text-align: center; font-size: 0.75rem; color: #64748b;">
      Documento generado automáticamente por el Sistema de Control de Sacos Vacíos - Ferpacific
    </div>
  `;
  
  container.querySelector('.print-body').appendChild(clone);
  document.body.appendChild(container);
  
  const filename = `reporte_${viewName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  
  const opt = {
    margin:       0.3,
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'in', format: 'letter', orientation: orientation }
  };
  
  html2pdf().set(opt).from(container).save().then(() => {
    document.body.removeChild(container);
  }).catch(err => {
    console.error('Error generating PDF:', err);
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });
}

// CLIENT-SIDE COVERAGE TIME CALCULATION
function getCoverageTime(item) {
  const stock = item.total;
  const jul = item.jul26 || 0;
  const aug = item.aug26 || 0;
  const sep = item.sep26 || 0;
  const oct = item.oct26 || 0;
  const nov = item.nov26 || 0;
  const dec = item.dec26 || 0;

  const months = [
    { name: "Julio 2026", days: 31, demand: jul },
    { name: "Agosto 2026", days: 31, demand: aug },
    { name: "Septiembre 2026", days: 30, demand: sep },
    { name: "Octubre 2026", days: 31, demand: oct },
    { name: "Noviembre 2026", days: 30, demand: nov },
    { name: "Diciembre 2026", days: 31, demand: dec }
  ];

  let remainingStock = stock;
  let totalDays = 0;

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    if (m.demand <= 0) {
      continue;
    }
    if (remainingStock >= m.demand) {
      remainingStock -= m.demand;
      totalDays += m.days;
    } else {
      const dailyConsumption = m.demand / m.days;
      const daysInMonth = dailyConsumption > 0 ? Math.floor(remainingStock / dailyConsumption) : m.days;
      totalDays += daysInMonth;
      return {
        days: totalDays,
        month: m.name,
        exactText: `aproximadamente ${totalDays} días (Ruptura en ${m.name})`
      };
    }
  }

  return {
    days: totalDays || 180,
    month: "más de 6 meses",
    exactText: `más de 180 días`
  };
}

// RENDER REQUISITIONS PREVIEW VIEW
function renderRequisitionView() {
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  document.getElementById('req-date-field').textContent = dateStr;
  
  const monthStr = String(today.getMonth() + 1).padStart(2, '0');
  const dayStr = String(today.getDate()).padStart(2, '0');
  const reqNum = `2026${monthStr}${dayStr}${Math.floor(100 + Math.random() * 900)}`;
  document.getElementById('req-number-field').textContent = reqNum;

  // Filter critical items
  const criticalAlerts = currentStock.filter(item => {
    return item.alertStatus === "URGENTE" || item.alertStatus === "SOLICITAR";
  });

  // Filter items with quantities to order
  const itemsToOrder = criticalAlerts.filter(item => (item.requisition || item.suggestedOrder) > 0);
  
  const tbody = document.getElementById('req-items-tbody');
  
  let html = '';
  for (let i = 0; i < 30; i++) {
    if (i < itemsToOrder.length) {
      const item = itemsToOrder[i];
      const qty = item.requisition || item.suggestedOrder;
      html += `
        <tr style="height: 24px;">
          <td class="text-center" style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">${i + 1})</td>
          <td style="font-family: monospace; padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">${item.code}</td>
          <td class="text-right font-weight-bold" style="color: var(--accent); padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">${qty.toLocaleString()}</td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">U</td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);"><strong class="bag-desc-link" onclick="openBagArt('${item.code}', '${item.desc.replace(/'/g, "\\'")}')">${item.desc}</strong></td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);" class="text-center">-</td>
          <td class="text-right" style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">${item.total.toLocaleString()}</td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);" class="text-center">-</td>
          <td style="padding: 0.4rem; border-bottom: 1px solid var(--border-color);" class="text-center">-</td>
        </tr>
      `;
    } else {
      html += `
        <tr style="height: 24px;">
          <td class="text-center text-muted" style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">${i + 1})</td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);"></td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);"></td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);"></td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);"></td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);"></td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);"></td>
          <td style="padding: 0.4rem; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);"></td>
          <td style="padding: 0.4rem; border-bottom: 1px solid var(--border-color);"></td>
        </tr>
      `;
    }
  }
  tbody.innerHTML = html;

  // Calculate minimum coverage time for justification
  let minDays = Infinity;
  let minDaysText = "pocos días";
  criticalAlerts.forEach(item => {
    const cov = getCoverageTime(item);
    if (cov.days < minDays) {
      minDays = cov.days;
      minDaysText = cov.exactText || `${cov.days} días`;
    }
  });

  const justification = `Reposición automática para evitar desabastecimiento de sacos de especialidades y tradicionales. Riesgo de quiebre de stock en temporada alta (Ruptura mínima en ${minDaysText}).`;
  document.getElementById('req-justification-field').textContent = justification;
}

// Render Users list in Settings
async function renderUsersSetupTable() {
  if (!currentUser || currentUser.role !== 'admin') return;
  
  const tbody = document.getElementById('users-setup-tbody');
  if (!tbody) return;
  
  try {
    const data = await apiFetch('/api/users');
    const usersList = data.users || [];
    
    if (usersList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-3 text-muted">No hay usuarios registrados.</td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = usersList.map(u => {
      const isSelf = u.username === currentUser.username;
      const isMainAdmin = u.username === 'jduran' || u.username === 'jduran_admin';
      const roleText = u.role === 'admin' ? 'Admin' : (u.role === 'logistic' ? 'Logística' : 'Visualizador');
      const roleClass = u.role === 'admin' ? 'badge-danger' : (u.role === 'logistic' ? 'badge-success' : 'badge-normal');
      
      const deleteBtn = (isSelf || isMainAdmin) ? '' : `
        <button class="btn btn-sm btn-outline btn-delete-user" data-username="${u.username}" style="border-color: var(--danger); color: var(--danger-text); padding: 0.15rem 0.5rem; font-size: 0.75rem;">Eliminar</button>
      `;
      
      return `
        <tr>
          <td style="font-family: monospace; font-weight: bold;">${u.username}</td>
          <td>${u.name}</td>
          <td><span class="badge ${roleClass}">${roleText}</span></td>
          <td class="text-center">
            <div style="display: flex; gap: 0.25rem; justify-content: center;">
              <button class="btn btn-sm btn-outline btn-edit-user" data-username="${u.username}" data-name="${u.name}" data-role="${u.role}" style="border-color: var(--primary); color: var(--pdf-btn-color); padding: 0.15rem 0.5rem; font-size: 0.75rem;">Editar</button>
              ${deleteBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    // Add Edit/Delete listeners
    tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const uName = e.target.getAttribute('data-username');
        const fName = e.target.getAttribute('data-name');
        const role = e.target.getAttribute('data-role');
        
        document.getElementById('user-username').value = uName;
        document.getElementById('user-username').setAttribute('readonly', 'true');
        document.getElementById('user-name').value = fName;
        document.getElementById('user-role').value = role;
        document.getElementById('user-password').placeholder = 'Dejar vacío para no cambiar';
        document.getElementById('user-password').removeAttribute('required');
      });
    });
    
    tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const uName = e.target.getAttribute('data-username');
        if (confirm(`¿Estás seguro de que deseas eliminar al usuario "${uName}"?`)) {
          showLoader('Eliminando usuario...');
          try {
            await apiFetch('/api/users/delete', {
              method: 'POST',
              body: JSON.stringify({ username: uName })
            });
            alert('Usuario eliminado correctamente.');
            renderUsersSetupTable();
          } catch (err) {
            alert('Error al eliminar usuario: ' + err.message);
          } finally {
            hideLoader();
          }
        }
      });
    });
    
  } catch (err) {
    console.error('Error al cargar lista de usuarios:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-3 text-danger">Error: ${err.message}</td>
      </tr>
    `;
  }
}

// Save/Update User Form Submit
async function handleUserManagementSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('user-username');
  const nameInput = document.getElementById('user-name');
  const passwordInput = document.getElementById('user-password');
  const roleInput = document.getElementById('user-role');
  
  const username = usernameInput.value.trim().toLowerCase();
  const name = nameInput.value.trim();
  const password = passwordInput.value;
  const role = roleInput.value;
  
  if (!username || !name || !role) {
    alert("Por favor, llena todos los campos obligatorios.");
    return;
  }
  
  showLoader('Guardando usuario...');
  try {
    await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username, name, password, role })
    });
    
    alert('Usuario guardado exitosamente.');
    
    // Clear form
    usernameInput.value = '';
    usernameInput.removeAttribute('readonly');
    nameInput.value = '';
    passwordInput.value = '';
    passwordInput.placeholder = 'Nueva contraseña';
    
    // Refresh table
    renderUsersSetupTable();
  } catch (err) {
    alert('Error al guardar usuario: ' + err.message);
  } finally {
    hideLoader();
  }
}

// ==========================================
// RENDER FUNCTIONS FOR NEW DEPARTMENTS
// ==========================================

// 1. PRODUCTION PLANNING
function renderProdPlanning() {
  // Populate select dropdown
  const selectEl = document.getElementById('prod-select-product');
  if (selectEl && selectEl.children.length === 0) {
    selectEl.innerHTML = currentStock.map(item => `<option value="${item.code}">${item.code} - ${item.desc.slice(0,40)}...</option>`).join('');
  }

  // Calculate Metrics
  const totalPlanned = mockProdPlanning.reduce((acc, i) => acc + i.target, 0);
  const totalActual = mockProdPlanning.reduce((acc, i) => acc + i.actual, 0);
  const progressPct = totalPlanned > 0 ? ((totalActual / totalPlanned) * 100).toFixed(1) : '0';

  const plannedEl = document.getElementById('stat-prod-planned');
  if (plannedEl) plannedEl.textContent = `${totalPlanned.toLocaleString()} t`;
  const actualEl = document.getElementById('stat-prod-actual');
  if (actualEl) actualEl.textContent = `${totalActual.toLocaleString()} t`;
  const progEl = document.getElementById('stat-prod-progress');
  if (progEl) progEl.textContent = `${progressPct}%`;

  // Render Table
  const tbody = document.querySelector('#table-prod-planning tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-prod-planning').value || '').toLowerCase().trim();

  const filtered = mockProdPlanning.filter(i => {
    return i.code.toLowerCase().includes(searchVal) || i.desc.toLowerCase().includes(searchVal) || i.machine.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron programaciones.</td></tr>`;
    return;
  }

  filtered.forEach(i => {
    const tr = document.createElement('tr');
    let badgeClass = 'badge-normal';
    if (i.status === 'Completado') badgeClass = 'badge-success';
    else if (i.status === 'En Proceso') badgeClass = 'badge-warning';

    tr.innerHTML = `
      <td class="font-monospace">${i.code}</td>
      <td><strong class="bag-desc-link" onclick="openBagArt('${i.code}', '${i.desc.replace(/'/g, "\\'")}')">${i.desc}</strong></td>
      <td><span class="badge badge-normal">${i.line}</span></td>
      <td class="text-right">${i.target.toLocaleString()} t</td>
      <td class="text-right font-weight-bold" style="color: var(--accent);">${i.actual.toLocaleString()} t</td>
      <td><strong>${i.machine}</strong></td>
      <td class="text-center"><span class="badge ${badgeClass}">${i.status}</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Render released inputs from QC
  renderProdReleasedInputs();
}

// 2. PRODUCTION WASTE
function renderProdWaste() {
  // Populate select dropdown
  const selectEl = document.getElementById('waste-select-product');
  if (selectEl && selectEl.children.length === 0) {
    selectEl.innerHTML = currentStock.map(item => `<option value="${item.code}">${item.code} - ${item.desc.slice(0,40)}...</option>`).join('');
  }

  // Calculate Metrics
  const totalScrap = mockProdWaste.reduce((acc, i) => acc + i.qty, 0);
  const costVal = totalScrap * 0.8; // $0.80 per bag cost
  const ratePct = currentStock.length > 0 ? ((totalScrap / 236000) * 100).toFixed(2) : '0'; // Rate based on sample total weekly envasado bags

  const wasteEl = document.getElementById('stat-waste-total');
  if (wasteEl) wasteEl.textContent = `${totalScrap.toLocaleString()} ud`;
  const costEl = document.getElementById('stat-waste-cost');
  if (costEl) costEl.textContent = `$${costVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rateEl = document.getElementById('stat-waste-rate');
  if (rateEl) rateEl.textContent = `${ratePct}%`;

  // Render Table
  const tbody = document.querySelector('#table-prod-waste tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-prod-waste').value || '').toLowerCase().trim();

  const filtered = mockProdWaste.filter(i => {
    return i.code.toLowerCase().includes(searchVal) || i.desc.toLowerCase().includes(searchVal) || i.reason.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No se registraron mermas.</td></tr>`;
    return;
  }

  filtered.forEach(i => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-muted">${i.date}</td>
      <td class="font-monospace">${i.code}</td>
      <td><strong class="bag-desc-link" onclick="openBagArt('${i.code}', '${i.desc.replace(/'/g, "\\'")}')">${i.desc}</strong></td>
      <td class="text-right text-danger font-weight-bold">${i.qty.toLocaleString()} ud</td>
      <td class="text-muted italic">${i.reason}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. LOGISTIC DISPATCH
function renderLogDispatch() {
  // Populate select dropdown
  const selectEl = document.getElementById('disp-select-product');
  if (selectEl && selectEl.children.length === 0) {
    selectEl.innerHTML = currentStock.map(item => `<option value="${item.code}">${item.code} - ${item.desc.slice(0,40)}...</option>`).join('');
  }

  // Calculate Metrics
  const totalTrucks = mockLogDispatch.length;
  const totalBags = mockLogDispatch.reduce((acc, i) => acc + i.bags, 0);
  const totalTons = totalBags * 0.05; // 50kg per bag = 0.05t
  const pendingTrucks = mockLogDispatch.filter(i => i.status === 'En Espera').length;

  const trucksEl = document.getElementById('stat-dispatch-trucks');
  if (trucksEl) trucksEl.textContent = `${totalTrucks} Camiones`;
  const volumeEl = document.getElementById('stat-dispatch-volume');
  if (volumeEl) volumeEl.textContent = `${totalTons.toLocaleString()} t`;
  const pendingEl = document.getElementById('stat-dispatch-pending');
  if (pendingEl) pendingEl.textContent = `${pendingTrucks} Camiones`;

  // Render Table
  const tbody = document.querySelector('#table-log-dispatch tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-log-dispatch').value || '').toLowerCase().trim();

  const filtered = mockLogDispatch.filter(i => {
    return i.plate.toLowerCase().includes(searchVal) || i.driver.toLowerCase().includes(searchVal) || i.product.toLowerCase().includes(searchVal) || i.destination.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No hay camiones programados.</td></tr>`;
    return;
  }

  filtered.forEach(i => {
    const tr = document.createElement('tr');
    let badgeClass = 'badge-normal';
    if (i.status === 'Listo') badgeClass = 'badge-success';
    else if (i.status === 'Cargando') badgeClass = 'badge-warning';

    tr.innerHTML = `
      <td class="font-monospace" style="font-weight: bold; color: var(--accent);">${i.plate}</td>
      <td><strong>${i.driver}</strong></td>
      <td class="text-muted">${i.destination}</td>
      <td>${i.product.slice(0, 35)}...</td>
      <td class="text-right font-weight-bold">${i.bags.toLocaleString()}</td>
      <td class="text-muted font-weight-bold">${i.gate}</td>
      <td class="text-center"><span class="badge ${badgeClass}">${i.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 4. LOGISTIC PHYSICAL INVENTORY (FERPASUR CONSUMPTIONS & KARDEX)
let ferpasurConsumptionsData = [];
let ferpasurTempConsumptions = {};
let activeFerpasurTab = 'register';

function switchFerpasurTab(tab) {
  activeFerpasurTab = tab;
  document.querySelectorAll('.ferpasur-sub-view').forEach(el => el.classList.add('hidden'));
  
  const targetView = document.getElementById(`ferpasur-tab-${tab}`);
  if (targetView) targetView.classList.remove('hidden');

  // Update tabs buttons UI
  const regBtn = document.getElementById('btn-ferpasur-tab-register');
  const karBtn = document.getElementById('btn-ferpasur-tab-kardex');
  const modBtn = document.getElementById('btn-ferpasur-tab-modifications');
  
  if (regBtn) regBtn.className = tab === 'register' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  if (karBtn) karBtn.className = tab === 'kardex' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  if (modBtn) modBtn.className = tab === 'modifications' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';

  if (tab === 'kardex') renderKardexTable();
  if (tab === 'modifications') loadFerpasurModifications();
}

async function renderLogPhysical() {
  // 1. Set today's date if empty
  const dateInput = document.getElementById('ferpasur-log-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().substring(0, 10);
  }

  // 2. Populate product selector for Kardex if empty
  const select = document.getElementById('kardex-bag-code');
  if (select && select.children.length <= 1) {
    select.innerHTML = '<option value="">-- Seleccione Código --</option>' +
      currentStock.map(item => `
        <option value="${item.code}">${item.code} - ${item.desc}</option>
      `).join('');
  }

  // 3. Load daily consumptions from server
  await loadFerpasurConsumptions();
  
  // 4. Render active tab
  switchFerpasurTab(activeFerpasurTab);
}

function updateLockStatusUI(finalized, dateVal) {
  const banner = document.getElementById('ferpasur-lock-banner');
  const text = document.getElementById('ferpasur-lock-text');
  const reopenBtn = document.getElementById('btn-ferpasur-reopen');

  if (!banner || !text) return;

  window.ferpasurDayFinalized = finalized;

  if (finalized) {
    banner.classList.remove('hidden');
    banner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'; // red background
    banner.style.borderColor = '#ef4444';
    banner.style.color = '#f87171';

    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'logistic')) {
      text.innerHTML = '🔓 Planilla Cerrada (Edición Autorizada para Gerencia/Admin)';
      if (reopenBtn) reopenBtn.classList.remove('hidden');
    } else {
      text.innerHTML = '🔒 Planilla Cerrada (Solo Lectura - Autorización de Gerencia requerida para modificar)';
      if (reopenBtn) reopenBtn.classList.add('hidden');
    }
  } else {
    banner.classList.add('hidden');
    if (reopenBtn) reopenBtn.classList.add('hidden');
  }
}

async function loadFerpasurConsumptions() {
  showLoader('Cargando planilla de bodega...');
  try {
    const dateVal = document.getElementById('ferpasur-log-date').value;
    if (!dateVal) return;

    // 1. Initialize daily record on server (ensures rollforward starting balances exist)
    await apiFetch('/api/ferpasur-consumptions/initialize', {
      method: 'POST',
      body: JSON.stringify({ date: dateVal })
    });

    // 2. Fetch all daily records
    const res = await apiFetch('/api/ferpasur-consumptions');
    if (res.success) {
      ferpasurConsumptionsData = res.consumptions || [];
    }

    // 3. Populate temp storage mapping
    ferpasurTempConsumptions = {};
    let finalized = false;
    const record = ferpasurConsumptionsData.find(c => c.date === dateVal);
    if (record) {
      finalized = !!record.finalized;
      record.items.forEach(it => {
        ferpasurTempConsumptions[it.code] = {
          initialSist: it.initialSist || 0,
          initialPhys: it.initialPhys || 0,
          ferpagro: it.ferpagro || 0,
          doyle1: it.doyle1 || 0,
          doyle2: it.doyle2 || 0,
          nacional: it.nacional || 0,
          sackett: it.sackett || 0,
          launica: it.launica || 0,
          storeocean: it.storeocean || 0,
          otras: it.otras || 0,
          clientes: it.clientes || 0,
          damaged: it.damaged || 0,
          interama: it.interama || 0,
          sacoplast: it.sacoplast || 0,
          plasticsack: it.plasticsack || 0,
          reysac: it.reysac || 0,
          observation: it.observation || ''
        };
      });
    }

    updateLockStatusUI(finalized, dateVal);
    renderFerpasurGrid();
  } catch (err) {
    console.error(err);
    alert('Error al cargar planilla: ' + err.message);
  } finally {
    hideLoader();
  }
}

async function reopenFerpasurDay() {
  const dateVal = document.getElementById('ferpasur-log-date').value;
  if (!dateVal) return;

  if (!confirm(`¿Está seguro que desea reabrir la planilla del día ${dateVal} y habilitar las modificaciones de consumos?`)) {
    return;
  }

  showLoader('Reabriendo planilla diaria...');
  try {
    const res = await apiFetch('/api/ferpasur-consumptions/reopen', {
      method: 'POST',
      body: JSON.stringify({ date: dateVal })
    });

    if (res.success) {
      alert(res.message || 'La planilla ha sido reabierta con éxito.');
      await loadFerpasurConsumptions();
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    alert('Error al reabrir planilla: ' + err.message);
  } finally {
    hideLoader();
  }
}

async function loadFerpasurModifications() {
  const tbody = document.getElementById('ferpasur-modifications-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Cargando historial de modificaciones...</td></tr>`;

  try {
    const res = await apiFetch('/api/ferpasur-modifications');
    if (res.success) {
      const mods = res.modifications || [];
      if (mods.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay modificaciones registradas.</td></tr>`;
        return;
      }

      tbody.innerHTML = mods.map(m => {
        const formattedDate = new Date(m.timestamp).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' });
        return `
          <tr>
            <td style="font-family: monospace; font-size: 11.5px;">${formattedDate}</td>
            <td style="font-family: monospace;">${m.date}</td>
            <td class="font-monospace">${m.productCode}</td>
            <td><strong>${m.productDesc}</strong></td>
            <td><span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-muted); font-size: 11px; padding: 2px 6px;">${m.field}</span></td>
            <td class="text-right" style="color: #f87171; font-weight: 500;">${m.oldValue}</td>
            <td class="text-right" style="color: var(--success); font-weight: 600;">${m.newValue}</td>
            <td><strong>${m.user}</strong> <span style="font-size: 11px; color: var(--text-muted);">(${m.username})</span></td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Error al cargar: ${res.error}</td></tr>`;
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 2rem;">Error de conexión: ${err.message}</td></tr>`;
  }
}

// Safe evaluation of mathematical expressions in cells
function evaluateMathExpression(str) {
  if (typeof str !== 'string') return Number(str) || 0;
  const sanitized = str.replace(/[^0-9+\-*/().\s]/g, '');
  if (!sanitized.trim()) return 0;
  
  try {
    let expr = sanitized.trim();
    while (expr.length > 0 && /[+\-*/(]$/.test(expr)) {
      expr = expr.slice(0, -1).trim();
    }
    if (!expr) return 0;
    
    const evalFn = new Function(`return (${expr});`);
    const result = evalFn();
    return typeof result === 'number' && !isNaN(result) ? result : 0;
  } catch (e) {
    return 0;
  }
}

function handleCellKeydown(event, code) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.target.blur();
  }
}

function handleCellBlur(input, code) {
  const rawValue = input.value.trim();
  if (rawValue) {
    const evaluated = evaluateMathExpression(rawValue);
    input.value = evaluated > 0 ? evaluated : '';
    if (evaluated > 0) {
      input.classList.add('cell-edited');
    } else {
      input.classList.remove('cell-edited');
    }
  } else {
    input.value = '';
    input.classList.remove('cell-edited');
  }
  calcFerpasurRow(code);
  
  // Trigger silent autosave
  saveFerpasurConsumptions(true);
}

function renderFerpasurGrid() {
  const tbody = document.getElementById('ferpasur-register-tbody');
  if (!tbody) return;

  const searchVal = (document.getElementById('search-ferpasur-grid').value || '').toLowerCase().trim();

  const filtered = currentStock.filter(item => 
    item.code.toLowerCase().includes(searchVal) || 
    item.desc.toLowerCase().includes(searchVal)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="21" class="text-center py-4 text-muted">No se encontraron sacos en el inventario.</td></tr>`;
    updateFerpasurStats();
    return;
  }

  const isLocked = window.ferpasurDayFinalized && (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'logistic'));
  const disabledAttr = isLocked ? 'disabled' : '';

  tbody.innerHTML = filtered.map(item => {
    const temp = ferpasurTempConsumptions[item.code] || {
      ferpagro: 0, doyle1: 0, doyle2: 0, nacional: 0, sackett: 0,
      launica: 0, storeocean: 0, otras: 0, clientes: 0, damaged: 0,
      interama: 0, sacoplast: 0, plasticsack: 0, reysac: 0,
      observation: ''
    };
    
    const totalEgresos = (temp.ferpagro || 0) + temp.doyle1 + temp.doyle2 + temp.nacional + temp.sackett + temp.launica + temp.storeocean + temp.otras + temp.clientes + temp.damaged;
    const totalIngresos = temp.interama + temp.sacoplast + temp.plasticsack + temp.reysac;
    
    // Starting balances
    const initSist = temp.initialSist !== undefined ? temp.initialSist : (item.total || 0);
    const initPhys = temp.initialPhys !== undefined ? temp.initialPhys : (item.ferpasur || 0);
    const finalSist = Math.max(0, initSist - totalEgresos + totalIngresos);
    const finalPhys = Math.max(0, initPhys - totalEgresos + totalIngresos);

    return `
      <tr>
        <td class="font-monospace">${item.code}</td>
        <td><strong>${item.desc}</strong></td>
        <td class="text-right" style="background: rgba(255,255,255,0.01); font-weight: 500;">${initSist.toLocaleString()}</td>
        <td class="text-right" style="background: rgba(255,255,255,0.01); font-weight: 500; border-right: 1px solid var(--border-color);">${initPhys.toLocaleString()}</td>
        
        <!-- Egresos -->
        <td style="background: rgba(37, 99, 235, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.ferpagro > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px;" id="cons-ferp-${item.code}" value="${temp.ferpagro || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(37, 99, 235, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.doyle1 > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px;" id="cons-d1-${item.code}" value="${temp.doyle1 || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(37, 99, 235, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.doyle2 > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px;" id="cons-d2-${item.code}" value="${temp.doyle2 || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(37, 99, 235, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.nacional > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px;" id="cons-nac-${item.code}" value="${temp.nacional || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(37, 99, 235, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.sackett > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px;" id="cons-sack-${item.code}" value="${temp.sackett || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(37, 99, 235, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.launica > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px;" id="cons-launica-${item.code}" value="${temp.launica || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(37, 99, 235, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.storeocean > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px;" id="cons-store-${item.code}" value="${temp.storeocean || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(37, 99, 235, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.otras > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px;" id="cons-otras-${item.code}" value="${temp.otras || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(37, 99, 235, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.clientes > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px;" id="cons-clientes-${item.code}" value="${temp.clientes || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(239, 68, 68, 0.02); border-right: 1px solid var(--border-color);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.damaged > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px; color: #fca5a5;" id="cons-dmg-${item.code}" value="${temp.damaged || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        
        <!-- Ingresos -->
        <td style="background: rgba(16, 185, 129, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.interama > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px; color: #a7f3d0;" id="in-interama-${item.code}" value="${temp.interama || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(16, 185, 129, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.sacoplast > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px; color: #a7f3d0;" id="in-sacoplast-${item.code}" value="${temp.sacoplast || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(16, 185, 129, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.plasticsack > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px; color: #a7f3d0;" id="in-plasticsack-${item.code}" value="${temp.plasticsack || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        <td style="background: rgba(16, 185, 129, 0.02); border-right: 1px solid var(--border-color);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.reysac > 0 ? 'cell-edited' : ''}" style="width: 58px; padding: 2px; font-size: 11.5px; color: #a7f3d0;" id="in-reysac-${item.code}" value="${temp.reysac || ''}" oninput="calcFerpasurRow('${item.code}')" onkeydown="handleCellKeydown(event, '${item.code}')" onblur="handleCellBlur(this, '${item.code}')"></td>
        
        <!-- Observación -->
        <td style="border-right: 1px solid var(--border-color);"><input type="text" ${disabledAttr} class="form-control" style="width: 140px; padding: 2px 4px; font-size: 11.5px;" id="cons-obs-${item.code}" value="${temp.observation || ''}" oninput="calcFerpasurRow('${item.code}')" onblur="saveFerpasurConsumptions(true)" placeholder="Comentario..."></td>

        <!-- Saldos Finales -->
        <td class="text-right" style="background: rgba(255,255,255,0.01); font-weight: bold;" id="cons-final-sist-${item.code}">${finalSist.toLocaleString()}</td>
        <td class="text-right" style="background: rgba(255,255,255,0.01); font-weight: bold; color: var(--accent);" id="cons-final-phys-${item.code}">${finalPhys.toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  updateFerpasurStats();
}

function calcFerpasurRow(code) {
  const stockItem = currentStock.find(s => s.code === code);
  if (!stockItem) return;

  const ferpagro = Math.max(0, evaluateMathExpression(document.getElementById(`cons-ferp-${code}`).value));
  const doyle1 = Math.max(0, evaluateMathExpression(document.getElementById(`cons-d1-${code}`).value));
  const doyle2 = Math.max(0, evaluateMathExpression(document.getElementById(`cons-d2-${code}`).value));
  const nacional = Math.max(0, evaluateMathExpression(document.getElementById(`cons-nac-${code}`).value));
  const sackett = Math.max(0, evaluateMathExpression(document.getElementById(`cons-sack-${code}`).value));
  const launica = Math.max(0, evaluateMathExpression(document.getElementById(`cons-launica-${code}`).value));
  const storeocean = Math.max(0, evaluateMathExpression(document.getElementById(`cons-store-${code}`).value));
  const otras = Math.max(0, evaluateMathExpression(document.getElementById(`cons-otras-${code}`).value));
  const clientes = Math.max(0, evaluateMathExpression(document.getElementById(`cons-clientes-${code}`).value));
  const damaged = Math.max(0, evaluateMathExpression(document.getElementById(`cons-dmg-${code}`).value));

  const interama = Math.max(0, evaluateMathExpression(document.getElementById(`in-interama-${code}`).value));
  const sacoplast = Math.max(0, evaluateMathExpression(document.getElementById(`in-sacoplast-${code}`).value));
  const plasticsack = Math.max(0, evaluateMathExpression(document.getElementById(`in-plasticsack-${code}`).value));
  const reysac = Math.max(0, evaluateMathExpression(document.getElementById(`in-reysac-${code}`).value));

  const observation = document.getElementById(`cons-obs-${code}`).value || '';

  const prevTemp = ferpasurTempConsumptions[code] || {};
  
  ferpasurTempConsumptions[code] = {
    initialSist: prevTemp.initialSist !== undefined ? prevTemp.initialSist : (stockItem.total || 0),
    initialPhys: prevTemp.initialPhys !== undefined ? prevTemp.initialPhys : (stockItem.ferpasur || 0),
    ferpagro, doyle1, doyle2, nacional, sackett,
    launica, storeocean, otras, clientes, damaged,
    interama, sacoplast, plasticsack, reysac,
    observation
  };

  const totalEgresos = ferpagro + doyle1 + doyle2 + nacional + sackett + launica + storeocean + otras + clientes + damaged;
  const totalIngresos = interama + sacoplast + plasticsack + reysac;

  const finalSist = Math.max(0, ferpasurTempConsumptions[code].initialSist - totalEgresos + totalIngresos);
  const finalPhys = Math.max(0, ferpasurTempConsumptions[code].initialPhys - totalEgresos + totalIngresos);

  document.getElementById(`cons-final-sist-${code}`).textContent = finalSist.toLocaleString();
  document.getElementById(`cons-final-phys-${code}`).textContent = finalPhys.toLocaleString();

  updateFerpasurStats();
}

function updateFerpasurStats() {
  let totalCons = 0;
  let totalDmg = 0;

  currentStock.forEach(item => {
    const temp = ferpasurTempConsumptions[item.code] || {
      ferpagro: 0, doyle1: 0, doyle2: 0, nacional: 0, sackett: 0,
      launica: 0, storeocean: 0, otras: 0, clientes: 0, damaged: 0,
      interama: 0, sacoplast: 0, plasticsack: 0, reysac: 0
    };
    
    const egresosNoDmg = (temp.ferpagro || 0) + temp.doyle1 + temp.doyle2 + temp.nacional + temp.sackett + temp.launica + temp.storeocean + temp.otras + temp.clientes;
    totalCons += egresosNoDmg;
    totalDmg += (temp.damaged || 0);
  });

  const totalPhys = currentStock.reduce((acc, i) => acc + (i.ferpasur || 0), 0);

  const statCons = document.getElementById('stat-ferpasur-consumed');
  const statDmg = document.getElementById('stat-ferpasur-damaged');
  const statPhys = document.getElementById('stat-ferpasur-physical-total');

  if (statCons) statCons.textContent = `${totalCons.toLocaleString()} ud`;
  if (statDmg) statDmg.textContent = `${totalDmg.toLocaleString()} ud`;
  if (statPhys) statPhys.textContent = `${totalPhys.toLocaleString()} ud`;
}

async function saveFerpasurConsumptions(silent = false) {
  const dateVal = document.getElementById('ferpasur-log-date').value;
  if (!dateVal) {
    if (!silent) alert('Por favor selecciona una fecha de registro válida.');
    return;
  }

  const items = Object.entries(ferpasurTempConsumptions).map(([code, c]) => ({
    code,
    ...c
  })).filter(it => 
    (it.ferpagro || 0) > 0 || 
    (it.doyle1 || 0) > 0 || 
    (it.doyle2 || 0) > 0 || 
    (it.nacional || 0) > 0 || 
    (it.sackett || 0) > 0 || 
    (it.launica || 0) > 0 || 
    (it.storeocean || 0) > 0 || 
    (it.otras || 0) > 0 || 
    (it.clientes || 0) > 0 || 
    (it.damaged || 0) > 0 ||
    (it.interama || 0) > 0 || 
    (it.sacoplast || 0) > 0 || 
    (it.plasticsack || 0) > 0 || 
    (it.reysac || 0) > 0 ||
    (it.observation || '').trim().length > 0
  );

  if (!silent) showLoader('Guardando registro de planilla...');
  try {
    const res = await apiFetch('/api/ferpasur-consumptions/save', {
      method: 'POST',
      body: JSON.stringify({ date: dateVal, items })
    });

    if (res.success) {
      if (!silent) alert('¡Planilla diaria guardada exitosamente y saldos de bodega actualizados!');
      
      await loadDashboardData();
      
      const fetchRes = await apiFetch('/api/ferpasur-consumptions');
      if (fetchRes.success) {
        ferpasurConsumptionsData = fetchRes.consumptions || [];
      }
      
      const record = ferpasurConsumptionsData.find(c => c.date === dateVal);
      if (record) {
        updateLockStatusUI(!!record.finalized, dateVal);
      }
    } else {
      alert('Error al guardar planilla: ' + res.error);
    }
  } catch (err) {
    console.error(err);
    if (!silent) alert('Error al guardar planilla: ' + err.message);
  } finally {
    if (!silent) hideLoader();
  }
}

async function finalizeAndEmailPhysicalInventory() {
  const dateVal = document.getElementById('ferpasur-log-date').value;
  if (!dateVal) {
    alert('Por favor selecciona una fecha de registro válida.');
    return;
  }

  const confirmFinalize = confirm('¿Está seguro de que desea finalizar el llenado de inventario de este día y enviar el reporte completo por correo a los involucrados?');
  if (!confirmFinalize) return;

  const items = Object.entries(ferpasurTempConsumptions).map(([code, c]) => ({
    code,
    ...c
  })).filter(it => 
    (it.ferpagro || 0) > 0 || 
    (it.doyle1 || 0) > 0 || 
    (it.doyle2 || 0) > 0 || 
    (it.nacional || 0) > 0 || 
    (it.sackett || 0) > 0 || 
    (it.launica || 0) > 0 || 
    (it.storeocean || 0) > 0 || 
    (it.otras || 0) > 0 || 
    (it.clientes || 0) > 0 || 
    (it.damaged || 0) > 0 ||
    (it.interama || 0) > 0 || 
    (it.sacoplast || 0) > 0 || 
    (it.plasticsack || 0) > 0 || 
    (it.reysac || 0) > 0 ||
    (it.observation || '').trim().length > 0
  );

  showLoader('Guardando y enviando reporte...');
  try {
    const saveRes = await apiFetch('/api/ferpasur-consumptions/save', {
      method: 'POST',
      body: JSON.stringify({ date: dateVal, items })
    });

    if (!saveRes.success) {
      throw new Error(saveRes.error || 'No se pudo guardar la planilla antes de enviar.');
    }

    const finalizeRes = await apiFetch('/api/ferpasur-consumptions/finalize', {
      method: 'POST',
      body: JSON.stringify({ date: dateVal })
    });

    if (finalizeRes.success) {
      alert('¡Planilla finalizada con éxito y reporte enviado por correo a los involucrados!');
      await loadDashboardData(); 
      await loadFerpasurConsumptions();
    } else {
      alert('Error al enviar el reporte: ' + finalizeRes.error);
    }
  } catch (err) {
    alert('Error en el proceso de finalización: ' + err.message);
  } finally {
    hideLoader();
  }
}

async function renderKardexTable() {
  const selectedCode = document.getElementById('kardex-bag-code').value;
  const tbody = document.getElementById('ferpasur-kardex-tbody');
  if (!tbody) return;

  if (!selectedCode) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">Seleccione un código de saco para graficar su historial de movimientos.</td></tr>`;
    return;
  }

  const stockItem = currentStock.find(s => s.code === selectedCode);
  if (!stockItem) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">Código de producto no encontrado.</td></tr>`;
    return;
  }

  showLoader('Generando Kardex...');
  try {
    const res = await apiFetch('/api/empty-bags-movements');
    let movements = [];
    if (res.success) {
      movements = res.movements || [];
    }

    // Filter movements for this code
    const codeMovements = movements.filter(m => m.code === selectedCode);

    // Sort chronologically (oldest first)
    codeMovements.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Backward calculation to compute exact initial balance
    let runningSystem = stockItem.total || 0;
    let runningPhysical = stockItem.ferpasur || 0;

    const reversedMovements = [...codeMovements].reverse();
    reversedMovements.forEach(m => {
      const qty = m.quantity || 0;
      if (m.type === 'entrada') {
        runningSystem -= qty;
        runningPhysical -= qty;
      } else {
        runningSystem += qty;
        runningPhysical += qty;
      }
    });

    const initialSys = runningSystem;
    const initialPhys = runningPhysical;

    let html = `
      <tr style="background: rgba(255,255,255,0.01); font-weight: 600;">
        <td>-</td>
        <td><strong>[Saldo Inicial]</strong> Estado de apertura de inventario</td>
        <td>-</td>
        <td class="text-right" style="color: var(--success);">-</td>
        <td class="text-right" style="color: #f87171;">-</td>
        <td class="text-right" style="color: var(--accent);">${initialSys.toLocaleString()}</td>
        <td class="text-right" style="color: var(--success);">${initialPhys.toLocaleString()}</td>
      </tr>
    `;

    let currentSys = initialSys;
    let currentPhys = initialPhys;

    codeMovements.forEach(m => {
      const qty = m.quantity || 0;
      let inputStr = '-';
      let outputStr = '-';
      if (m.type === 'entrada') {
        inputStr = `+${qty.toLocaleString()}`;
        currentSys += qty;
        currentPhys += qty;
      } else {
        outputStr = `-${qty.toLocaleString()}`;
        currentSys -= qty;
        currentPhys -= qty;
      }

      html += `
        <tr>
          <td style="font-family: monospace;">${m.date}</td>
          <td><strong>${m.concept}</strong></td>
          <td>${m.destinationOrSource || '-'}</td>
          <td class="text-right" style="color: var(--success); font-weight: 500;">${inputStr}</td>
          <td class="text-right" style="color: #f87171; font-weight: 500;">${outputStr}</td>
          <td class="text-right" style="font-weight: 600;">${Math.max(0, currentSys).toLocaleString()}</td>
          <td class="text-right" style="color: var(--accent); font-weight: 600;">${Math.max(0, currentPhys).toLocaleString()}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">Error al calcular Kardex: ${err.message}</td></tr>`;
  } finally {
    hideLoader();
  }
}

// 5. MAINTENANCE WORK ORDERS
function renderMaintOrders() {
  // Calculate Metrics
  const openCount = mockMaintOrders.filter(i => i.status !== 'Completado').length;
  const completedCount = mockMaintOrders.filter(i => i.status === 'Completado').length;
  
  const openEl = document.getElementById('stat-maint-open');
  if (openEl) openEl.textContent = openCount;

  // Render Table
  const tbody = document.querySelector('#table-maint-orders tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-maint-orders').value || '').toLowerCase().trim();

  const filtered = mockMaintOrders.filter(i => {
    return i.id.toLowerCase().includes(searchVal) || i.machine.toLowerCase().includes(searchVal) || i.tech.toLowerCase().includes(searchVal) || i.desc.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron órdenes de trabajo.</td></tr>`;
    return;
  }

  filtered.forEach(i => {
    const tr = document.createElement('tr');
    let badgeClass = 'badge-normal';
    if (i.status === 'Completado') badgeClass = 'badge-success';
    else if (i.status === 'En Proceso') badgeClass = 'badge-warning';
    else if (i.status === 'Asignada') badgeClass = 'badge-role';

    let priorityClass = 'badge-normal';
    if (i.priority === 'CRÍTICA') priorityClass = 'badge-danger';
    else if (i.priority === 'ALTA') priorityClass = 'badge-warning';

    tr.innerHTML = `
      <td class="font-monospace" style="font-weight: bold; color: var(--accent);">${i.id}</td>
      <td><strong>${i.machine}</strong></td>
      <td class="text-muted">${i.area}</td>
      <td>${i.desc}</td>
      <td class="text-center"><span class="badge ${priorityClass}">${i.priority}</span></td>
      <td><strong>${i.tech}</strong></td>
      <td class="text-center"><span class="badge ${badgeClass}">${i.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 6. MAINTENANCE SPARE PARTS
function renderMaintParts() {
  const tbody = document.querySelector('#table-maint-parts tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-maint-parts').value || '').toLowerCase().trim();

  const filtered = mockMaintParts.filter(i => {
    return i.code.toLowerCase().includes(searchVal) || i.name.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron repuestos.</td></tr>`;
    return;
  }

  filtered.forEach(i => {
    const tr = document.createElement('tr');
    let statusClass = 'badge-success';
    if (i.status === 'CRÍTICO') statusClass = 'badge-danger';
    else if (i.status === 'SOLICITAR') statusClass = 'badge-warning';

    tr.innerHTML = `
      <td class="font-monospace">${i.code}</td>
      <td><strong>${i.name}</strong></td>
      <td class="text-right font-weight-bold">${i.qty.toLocaleString()}</td>
      <td class="text-muted">${i.unit}</td>
      <td class="text-muted">${i.location}</td>
      <td class="text-right text-muted">${i.minQty.toLocaleString()}</td>
      <td class="text-center"><span class="badge ${statusClass}">${i.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 7. QUALITY INSPECTION
function renderQualInspections() {
  // Populate select dropdown
  const selectEl = document.getElementById('qual-select-product');
  if (selectEl && selectEl.children.length === 0) {
    selectEl.innerHTML = currentStock.map(item => `<option value="${item.code}">${item.code} - ${item.desc.slice(0,40)}...</option>`).join('');
  }

  // Calculate Metrics
  const totalLot = mockQualInspections.length;
  const approved = mockQualInspections.filter(i => i.status === 'Aprobado').length;
  const rejected = mockQualInspections.filter(i => i.status === 'Rechazado').length;

  const totalEl = document.getElementById('stat-qual-total');
  if (totalEl) totalEl.textContent = `${totalLot} Lotes`;
  const appEl = document.getElementById('stat-qual-approved');
  if (appEl) appEl.textContent = `${approved} Lotes`;
  const rejEl = document.getElementById('stat-qual-rejected');
  if (rejEl) {
    rejEl.textContent = `${rejected} Lote${rejected !== 1 ? 's' : ''}`;
    if (rejected > 0) {
      rejEl.classList.add('text-danger');
    } else {
      rejEl.classList.remove('text-danger');
    }
  }

  // Render Table
  const tbody = document.querySelector('#table-qual-inspections tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-qual-inspections').value || '').toLowerCase().trim();

  const filtered = mockQualInspections.filter(i => {
    return i.lot.toLowerCase().includes(searchVal) || i.product.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se registraron inspecciones.</td></tr>`;
    return;
  }

  filtered.forEach(i => {
    const tr = document.createElement('tr');
    let statusClass = 'badge-success';
    if (i.status === 'Rechazado') statusClass = 'badge-danger';

    tr.innerHTML = `
      <td class="font-monospace" style="font-weight: bold; color: var(--accent);">${i.lot}</td>
      <td><strong>${i.product}</strong></td>
      <td class="text-right font-weight-bold" style="color: ${i.moisture > 5.0 ? 'var(--danger-text)' : 'inherit'};">${i.moisture.toFixed(1)}%</td>
      <td class="text-right font-weight-bold" style="color: ${i.strength < 270 ? 'var(--danger-text)' : 'inherit'};">${i.strength.toLocaleString()} N</td>
      <td class="text-center"><span class="badge badge-normal">${i.visual}</span></td>
      <td class="text-center"><span class="badge ${statusClass}">${i.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 8. QUALITY CERTIFICATES
function renderQualCerts() {
  const countEl = document.getElementById('stat-certs-count');
  if (countEl) countEl.textContent = `${mockQualCerts.length} Certificados`;

  const tbody = document.querySelector('#table-qual-certs tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-qual-certs').value || '').toLowerCase().trim();

  const filtered = mockQualCerts.filter(i => {
    return i.coa.toLowerCase().includes(searchVal) || i.lot.toLowerCase().includes(searchVal) || i.product.toLowerCase().includes(searchVal) || i.customer.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No hay certificados emitidos.</td></tr>`;
    return;
  }

  filtered.forEach(i => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-monospace" style="font-weight: bold; color: var(--accent);">${i.coa}</td>
      <td class="font-monospace">${i.lot}</td>
      <td><strong>${i.product.slice(0,40)}...</strong></td>
      <td class="text-muted">${i.date}</td>
      <td><strong>${i.customer}</strong></td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline" style="border-color: var(--success); color: var(--success-text); padding: 0.15rem 0.5rem; font-size: 0.75rem;" onclick="alert('Descargando Certificado ${i.coa}... (Simulado)')">📥 COA</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 9. SHIPS DISCHARGE
function renderShipsDischarge() {
  // Populate select dropdown
  const selectEl = document.getElementById('discharge-select-ship');
  if (selectEl && selectEl.children.length === 0) {
    selectEl.innerHTML = mockShipsDischarge.filter(s => s.status !== 'Completado').map(s => `<option value="${s.ship}">${s.ship}</option>`).join('');
  }

  // Calculate Metrics
  const activeCount = mockShipsDischarge.filter(s => s.status === 'Descargando').length;
  const totalPlanned = mockShipsDischarge.reduce((acc, s) => acc + s.total, 0);
  const totalActual = mockShipsDischarge.reduce((acc, s) => acc + s.discharged, 0);
  const progressPct = totalPlanned > 0 ? ((totalActual / totalPlanned) * 100).toFixed(1) : '0';

  const countEl = document.getElementById('stat-ships-count');
  if (countEl) countEl.textContent = `${activeCount} Activo${activeCount !== 1 ? 's' : ''}`;
  const tonnageEl = document.getElementById('stat-ships-tonnage');
  if (tonnageEl) tonnageEl.textContent = `${totalPlanned.toLocaleString()} t`;
  const progEl = document.getElementById('stat-ships-progress');
  if (progEl) progEl.textContent = `${progressPct}%`;

  // Render Table
  const tbody = document.querySelector('#table-ships-discharge tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-ships-discharge').value || '').toLowerCase().trim();

  const filtered = mockShipsDischarge.filter(i => {
    return i.ship.toLowerCase().includes(searchVal) || i.material.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron buques.</td></tr>`;
    return;
  }

  filtered.forEach(i => {
    const tr = document.createElement('tr');
    let badgeClass = 'badge-normal';
    if (i.status === 'Completado') badgeClass = 'badge-success';
    else if (i.status === 'Descargando') badgeClass = 'badge-warning';
    else if (i.status === 'En Espera') badgeClass = 'badge-role';

    tr.innerHTML = `
      <td style="font-weight: bold; color: var(--accent);">${i.ship}</td>
      <td><strong>${i.material}</strong></td>
      <td class="text-right">${i.total.toLocaleString()} t</td>
      <td class="text-right font-weight-bold" style="color: var(--success-text);">${i.discharged.toLocaleString()} t</td>
      <td class="text-right text-muted">${i.rate > 0 ? i.rate + ' t/h' : '-'}</td>
      <td class="text-muted font-size-12">${i.eta}</td>
      <td class="text-center"><span class="badge ${badgeClass}">${i.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 10. SHIPS DOCKS PLANNING
function renderShipsDocks() {
  const tbody = document.querySelector('#table-ships-docks tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-ships-docks').value || '').toLowerCase().trim();

  const filtered = mockShipsDocks.filter(i => {
    return i.ship.toLowerCase().includes(searchVal) || i.dock.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se encontró planificación de muelles.</td></tr>`;
    return;
  }

  filtered.forEach(i => {
    const tr = document.createElement('tr');
    let badgeClass = 'badge-normal';
    if (i.status === 'Atracado') badgeClass = 'badge-warning';
    else if (i.status === 'Programado') badgeClass = 'badge-role';

    tr.innerHTML = `
      <td style="font-weight: bold; color: var(--accent);">${i.ship}</td>
      <td class="text-center"><strong>${i.dock}</strong></td>
      <td class="text-muted">${i.arrival}</td>
      <td class="text-muted">${i.departure}</td>
      <td><strong>${i.agency}</strong></td>
      <td class="text-center"><span class="badge ${badgeClass}">${i.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// 11. PLANIFICACION DE TURNOS DE DESCARGA
function renderPlanTurns() {
  const totalCarriers = mockPlanTurns.length;
  document.getElementById('stat-plan-trucks').textContent = totalCarriers;

  // Average operation time calculation
  let totalSeconds = 0;
  let count = 0;
  mockPlanTurns.forEach(turn => {
    if (turn.duration) {
      const parts = turn.duration.split(':').map(Number);
      const h = parts[0] || 0;
      const m = parts[1] || 0;
      const s = parts[2] || 0;
      totalSeconds += h * 3600 + m * 60 + s;
      count++;
    }
  });

  const avgSeconds = count > 0 ? Math.round(totalSeconds / count) : 0;
  const avgH = Math.floor(avgSeconds / 3600);
  const avgM = Math.floor((avgSeconds % 3600) / 60);
  const avgS = avgSeconds % 60;
  const avgTimeStr = `${String(avgH).padStart(2, '0')}:${String(avgM).padStart(2, '0')}:${String(avgS).padStart(2, '0')}`;
  document.getElementById('stat-plan-avg-time').textContent = avgTimeStr;

  // Today operations count
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOps = mockPlanTurns.filter(turn => turn.date === todayStr).length;
  document.getElementById('stat-plan-today').textContent = todayOps;

  // Render Table
  const tbody = document.querySelector('#table-plan-turns tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('search-plan-turns').value || '').toLowerCase().trim();

  const filtered = mockPlanTurns.filter(turn => {
    return turn.carrier.toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron turnos planificados.</td></tr>`;
    return;
  }

  filtered.forEach(turn => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-muted">${turn.date}</td>
      <td><strong>${turn.carrier}</strong></td>
      <td class="font-monospace">${turn.arrival}</td>
      <td class="font-monospace">${turn.start}</td>
      <td class="font-monospace">${turn.end}</td>
      <td class="text-right font-weight-bold" style="color: var(--accent);">${turn.duration}</td>
    `;
    tbody.appendChild(tr);
  });
}

// 12. LIQUIDACION DE IMPORTACIONES REMOVED

// Helper function to calculate duration between two time strings
function calculateTimeDifference(startStr, endStr) {
  const parseTime = (str) => {
    const parts = str.split(':').map(Number);
    const hrs = parts[0] || 0;
    const mins = parts[1] || 0;
    const secs = parts[2] || 0;
    return hrs * 3600 + mins * 60 + secs;
  };

  const startSec = parseTime(startStr);
  const endSec = parseTime(endStr);
  
  let diffSec = endSec - startSec;
  if (diffSec < 0) {
    diffSec += 24 * 3600; // overnight wrap around
  }

  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// NEW RENDERERS: PLANIFICACION - DETALLE DESPACHOS
function renderPlanDispatchDetails() {
  // Populate product dropdown if not done
  const selectProd = document.getElementById('disp-detail-product');
  if (selectProd && selectProd.options.length <= 1) {
    selectProd.innerHTML = '<option value="">Seleccione Código</option>';
    currentStock.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.code;
      opt.textContent = `${item.code} - ${item.desc.slice(0, 30)}`;
      selectProd.appendChild(opt);
    });
  }

  // Filter logic
  const searchVal = (document.getElementById('search-plan-dispatches').value || '').toLowerCase().trim();
  const filterLine = document.getElementById('filter-dispatch-line').value;
  const filterStatus = document.getElementById('filter-dispatch-status').value;

  const filtered = mockPlanDispatches.filter(row => {
    const matchesSearch = row.driver.toLowerCase().includes(searchVal) ||
                          row.client.toLowerCase().includes(searchVal) ||
                          row.product.toLowerCase().includes(searchVal) ||
                          (row.productDesc && row.productDesc.toLowerCase().includes(searchVal));
    const matchesLine = filterLine === 'all' || row.line === filterLine;
    const matchesStatus = filterStatus === 'all' || row.status === filterStatus;
    
    return matchesSearch && matchesLine && matchesStatus;
  });

  // Calculate KPIs
  const totalCount = filtered.length;
  const totalBags = filtered.reduce((sum, r) => sum + r.qty, 0);
  const avgBags = totalCount > 0 ? Math.round(totalBags / totalCount) : 0;
  
  const uniqueClients = new Set();
  filtered.forEach(r => {
    if (r.client) uniqueClients.add(r.client.toLowerCase().trim());
  });

  document.getElementById('stat-dispatch-total-count').textContent = totalCount;
  document.getElementById('stat-dispatch-total-bags').textContent = totalBags.toLocaleString();
  document.getElementById('stat-dispatch-avg-bags').textContent = `${avgBags.toLocaleString()} ud`;
  document.getElementById('stat-dispatch-unique-clients').textContent = uniqueClients.size;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / dispatchLimit));
  if (dispatchPage > totalPages) dispatchPage = totalPages;
  
  const btnDispPrev = document.getElementById('btn-disp-prev');
  const btnDispNext = document.getElementById('btn-disp-next');
  if (btnDispPrev) btnDispPrev.disabled = dispatchPage === 1;
  if (btnDispNext) btnDispNext.disabled = dispatchPage === totalPages;

  const indicator = document.getElementById('disp-page-indicator');
  if (indicator) indicator.textContent = `Página ${dispatchPage} de ${totalPages}`;

  // Render Table
  const tbody = document.querySelector('#table-plan-dispatches tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const startIdx = (dispatchPage - 1) * dispatchLimit;
  const pageItems = filtered.slice(startIdx, startIdx + dispatchLimit);

  if (pageItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-muted">No se encontraron detalles de despacho.</td></tr>';
    return;
  }

  pageItems.forEach(row => {
    const tr = document.createElement('tr');
    
    // Status Badge
    let statusClass = 'badge-normal';
    if (row.status === 'DESPACHADO') statusClass = 'badge-success';
    else if (row.status === 'PROGRAMADO') statusClass = 'badge-primary';
    else if (row.status === 'TRANSITO') statusClass = 'badge-warning';

    tr.innerHTML = `
      <td class="font-monospace">${row.date}</td>
      <td class="text-center"><span class="badge ${statusClass}">${row.status}</span></td>
      <td><strong>${row.driver}</strong></td>
      <td class="font-monospace" title="${row.productDesc}">${row.product}</td>
      <td class="text-right font-weight-bold">${row.qty.toLocaleString()}</td>
      <td>${row.client}</td>
      <td class="text-muted" style="font-size: 0.8rem;" title="${row.sacoDesc}">${row.sacoDesc ? row.sacoDesc.slice(0, 25) + '...' : ''}</td>
      <td class="font-monospace">${row.pedido}</td>
      <td class="text-center font-weight-bold" style="color: var(--accent);">${row.truck}</td>
      <td class="text-center">${row.cycle}</td>
    `;
    tbody.appendChild(tr);
  });

  // Safe checks for Viewer role
  if (currentUser && currentUser.role === 'viewer') {
    const form = document.getElementById('form-plan-dispatches');
    if (form) {
      const inputs = form.querySelectorAll('input, select, button');
      inputs.forEach(el => el.disabled = true);
    }
  }
}

// NEW RENDERERS: REPORTE GERENCIAL - RESUMEN EJECUTIVO
function renderGerentialSummary() {
  // Cobertura Global KPI
  const totalStock = currentStock.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate average 3-month projection
  const specialtiesItems = currentStock.filter(item => currentSpecialties.includes(item.code));
  const totalProj3M = specialtiesItems.reduce((sum, item) => sum + (item.projection3Months || 0), 0);
  const avgProjMonth = totalProj3M / 3;

  const coverageMonths = avgProjMonth > 0 ? (totalStock / avgProjMonth) : 0;
  const coverageEl = document.getElementById('stat-ger-coverage');
  if (coverageEl) {
    if (coverageMonths >= 3) {
      coverageEl.textContent = `Suficiente (${coverageMonths.toFixed(1)} m)`;
      coverageEl.style.color = 'var(--success-text)';
    } else if (coverageMonths >= 1) {
      coverageEl.textContent = `Aceptable (${coverageMonths.toFixed(1)} m)`;
      coverageEl.style.color = 'var(--warning-text)';
    } else {
      coverageEl.textContent = `Crítica (${coverageMonths.toFixed(1)} m)`;
      coverageEl.style.color = 'var(--danger-text)';
    }
  }

  // Eficiencia Envasado KPI
  const totalPlanned = mockProdPlanning.reduce((sum, item) => sum + item.target, 0);
  const totalActual = mockProdPlanning.reduce((sum, item) => sum + item.actual, 0);
  const efficiency = totalPlanned > 0 ? (totalActual / totalPlanned * 100) : 77.6;
  
  const effEl = document.getElementById('stat-ger-efficiency');
  if (effEl) effEl.textContent = `${efficiency.toFixed(1)}%`;

  // Tasa de Merma KPI
  const totalBroke = mockProdWaste.reduce((sum, item) => sum + item.qty, 0);
  const totalBagsProduced = totalActual * 20; 
  const wasteRate = (totalBagsProduced + totalBroke) > 0 ? (totalBroke / (totalBagsProduced + totalBroke) * 100) : 0.6;
  
  const wasteEl = document.getElementById('stat-ger-waste');
  if (wasteEl) wasteEl.textContent = `${wasteRate.toFixed(2)}%`;

  // Cumplimiento Despachos KPI
  const totalDisp = mockPlanDispatches.length;
  const completedDisp = mockPlanDispatches.filter(d => d.status === 'DESPACHADO').length;
  const dispatchCompliance = totalDisp > 0 ? (completedDisp / totalDisp * 100) : 92.0;

  const dispEl = document.getElementById('stat-ger-dispatches');
  if (dispEl) dispEl.textContent = `${dispatchCompliance.toFixed(1)}%`;

  // Render Chart: Stock vs Proj (Top 5 critical products)
  const chartContainer = document.getElementById('chart-stock-vs-proj');
  if (chartContainer) {
    chartContainer.innerHTML = '';
    
    const sortedStock = [...currentStock]
      .filter(item => item.projection3Months > 0)
      .sort((a, b) => b.projection3Months - a.projection3Months)
      .slice(0, 5);

    if (sortedStock.length === 0) {
      chartContainer.innerHTML = '<p class="text-center text-muted py-4">No hay datos de proyecciones disponibles.</p>';
    } else {
      const maxVal = Math.max(...sortedStock.map(item => Math.max(item.total, item.projection3Months)));
      
      sortedStock.forEach(item => {
        const stockPct = maxVal > 0 ? (item.total / maxVal * 80) : 0;
        const projPct = maxVal > 0 ? (item.projection3Months / maxVal * 80) : 0;

        const row = document.createElement('div');
        row.className = 'ger-chart-row';
        row.innerHTML = `
          <div class="ger-chart-label" title="${item.desc}">${item.code}</div>
          <div class="ger-chart-bars">
            <div class="ger-bar bar-stock" style="width: ${Math.max(10, stockPct)}%" title="Stock Físico: ${item.total.toLocaleString()}">
              <span class="ger-bar-value">${item.total.toLocaleString()}</span>
            </div>
            <div class="ger-bar bar-proj" style="width: ${Math.max(10, projPct)}%" title="Consumo Proyectado 3M: ${item.projection3Months.toLocaleString()}">
              <span class="ger-bar-value">${item.projection3Months.toLocaleString()}</span>
            </div>
          </div>
        `;
        chartContainer.appendChild(row);
      });
    }
  }

  // Render Machine Efficiency List
  const machContainer = document.getElementById('machine-efficiency-container');
  if (machContainer) {
    machContainer.innerHTML = '';
    
    const machinesMap = {};
    mockProdPlanning.forEach(item => {
      if (!machinesMap[item.machine]) {
        machinesMap[item.machine] = { planned: 0, actual: 0 };
      }
      machinesMap[item.machine].planned += item.target;
      machinesMap[item.machine].actual += item.actual;
    });

    const list = document.createElement('div');
    list.className = 'machine-efficiency-list';

    Object.keys(machinesMap).forEach(name => {
      const data = machinesMap[name];
      const pct = data.planned > 0 ? (data.actual / data.planned * 100) : 0;
      
      let colorClass = '';
      if (pct < 50) colorClass = 'danger';
      else if (pct < 80) colorClass = 'warning';

      const row = document.createElement('div');
      row.className = 'machine-row';
      row.innerHTML = `
        <div class="machine-meta">
          <span class="machine-name">${name}</span>
          <span class="machine-pct" style="color: ${pct >= 80 ? 'var(--success-text)' : (pct >= 50 ? 'var(--warning-text)' : 'var(--danger-text)')}">${pct.toFixed(1)}%</span>
        </div>
        <div class="machine-progress-bg">
          <div class="machine-progress-fill ${colorClass}" style="width: ${pct}%"></div>
        </div>
        <div class="machine-details">
          <span>Real: ${data.actual.toLocaleString()} t</span>
          <span>Meta: ${data.planned.toLocaleString()} t</span>
        </div>
      `;
      list.appendChild(row);
    });
    
    machContainer.appendChild(list);
  }

  // Render Alertas Gerenciales Críticas
  const alertsContainer = document.getElementById('ger-alerts-container');
  if (alertsContainer) {
    alertsContainer.innerHTML = '';
    
    const alerts = [];

    // 1. Stock Urgente alerts
    currentStock.forEach(item => {
      if (item.alertStatus === 'URGENTE') {
        alerts.push({
          type: 'danger',
          icon: '⚠️',
          title: `Stock Crítico: ${item.code}`,
          desc: `Stock actual (${item.total.toLocaleString()} ud) no cubre consumo proyectado de Julio (${item.jul26.toLocaleString()} ud).`
        });
      }
    });

    // 2. Critical maintenance orders
    mockMaintOrders.forEach(ot => {
      if (ot.priority === 'CRÍTICA' && ot.status !== 'Completada') {
        alerts.push({
          type: 'warning',
          icon: '🔧',
          title: `OT Crítica Abierta: ${ot.id}`,
          desc: `Equipo: ${ot.machine}. Falla: ${ot.desc}. Técnico: ${ot.tech}.`
        });
      }
    });

    // 3. Rejected quality inspections
    mockQualInspections.forEach(ins => {
      if (ins.visual === 'DEFECTUOSO' || ins.strength < 300) {
        alerts.push({
          type: 'warning',
          icon: '🔬',
          title: `Calidad Alerta: Lote ${ins.lot}`,
          desc: `Aspecto visual ${ins.visual} o resistencia costura ${ins.strength}N inferior a norma (300N).`
        });
      }
    });

    if (alerts.length === 0) {
      alertsContainer.innerHTML = `
        <div class="ger-alert-item ger-alert-success" style="width: 100%;">
          <span class="ger-alert-icon">✓</span>
          <div class="ger-alert-body">
            <div class="ger-alert-title">Operación Estable</div>
            <div class="ger-alert-desc">No se registran alertas operativas críticas en el sistema.</div>
          </div>
        </div>
      `;
    } else {
      const list = document.createElement('div');
      list.className = 'ger-alerts-list';
      
      alerts.forEach(al => {
        const item = document.createElement('div');
        item.className = `ger-alert-item ger-alert-${al.type}`;
        item.innerHTML = `
          <span class="ger-alert-icon">${al.icon}</span>
          <div class="ger-alert-body">
            <div class="ger-alert-title">${al.title}</div>
            <div class="ger-alert-desc">${al.desc}</div>
          </div>
        `;
        list.appendChild(item);
      });
      alertsContainer.appendChild(list);
    }
  }
}

// NEW RENDERERS: REPORTE GERENCIAL - INDICADORES CLAVE
function renderGerentialIndicators() {
  // Render Chart: Mermas Mensuales
  const wasteContainer = document.getElementById('chart-monthly-waste');
  if (wasteContainer) {
    wasteContainer.innerHTML = '';
    
    const monthlyData = [
      { month: 'Enero', qty: 450 },
      { month: 'Febrero', qty: 320 },
      { month: 'Marzo', qty: 510 },
      { month: 'Abril', qty: 280 },
      { month: 'Mayo', qty: 620 },
      { month: 'Junio', qty: 480 }
    ];

    const maxQty = Math.max(...monthlyData.map(d => d.qty));

    monthlyData.forEach(d => {
      const pct = maxQty > 0 ? (d.qty / maxQty * 85) : 0;
      const row = document.createElement('div');
      row.className = 'ger-chart-row';
      row.style.gridTemplateColumns = '80px 1fr';
      row.innerHTML = `
        <div class="ger-chart-label">${d.month}</div>
        <div class="ger-chart-bars" style="border-left-color: var(--danger);">
          <div class="ger-bar" style="width: ${Math.max(10, pct)}%; background: linear-gradient(90deg, #dc2626, #f87171); color: #fff;" title="Merma: ${d.qty} sacos">
            <span class="ger-bar-value">${d.qty} ud</span>
          </div>
        </div>
      `;
      wasteContainer.appendChild(row);
    });
  }

  // Weight Discrepancies Table
  const tbody = document.querySelector('#table-weight-discrepancies tbody');
  if (tbody) {
    tbody.innerHTML = '';
    
    const diffRows = mockImportsLiq.filter(row => row.diff !== 0 || row.plate);
    
    if (diffRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3 text-muted">No se registran pesajes con discrepancias en báscula.</td></tr>';
    } else {
      diffRows.forEach(row => {
        const absDiff = Math.abs(row.diff);
        let statusBadge = '<span class="badge badge-success">✓ Conforme</span>';
        if (absDiff > 100) {
          statusBadge = '<span class="badge badge-danger">⚠️ Alerta</span>';
        } else if (absDiff > 0) {
          statusBadge = '<span class="badge badge-warning">⚖️ Desvío Tolerable</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-monospace font-weight-bold" style="color: var(--accent);">${row.plate}</td>
          <td>${row.destination}</td>
          <td class="text-right font-monospace">${row.netoBlasti.toLocaleString()} Kg</td>
          <td class="text-right font-monospace">${row.netoUni.toLocaleString()} Kg</td>
          <td class="text-right font-monospace font-weight-bold" style="color: ${row.diff === 0 ? 'var(--success-text)' : 'var(--danger-text)'}">${row.diff.toLocaleString()} Kg</td>
          <td class="text-center">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  // Provider Transit Progress Bars
  const provContainer = document.getElementById('provider-transit-container');
  if (provContainer) {
    provContainer.innerHTML = '';
    
    const provMap = {
      'Sacoplast': 0,
      'Interama': 0,
      'Plasticsack': 0,
      'Reysac': 0
    };

    currentStock.forEach(item => {
      provMap['Sacoplast'] += (item.transitSacoplast || 0);
      provMap['Interama'] += (item.transitInterama || 0);
      provMap['Plasticsack'] += (item.transitPlasticsack || 0);
      provMap['Reysac'] += (item.transitReysac || 0);
    });

    const list = document.createElement('div');
    list.className = 'machine-efficiency-list';

    const maxTransit = Math.max(...Object.values(provMap), 1);

    Object.keys(provMap).forEach(name => {
      const val = provMap[name];
      const pct = maxTransit > 0 ? (val / maxTransit * 100) : 0;
      
      const row = document.createElement('div');
      row.className = 'machine-row';
      row.innerHTML = `
        <div class="machine-meta">
          <span class="machine-name">${name}</span>
          <span class="machine-pct" style="color: var(--pdf-btn-color); font-weight: bold;">${val.toLocaleString()} ud</span>
        </div>
        <div class="machine-progress-bg" style="border-color: var(--pdf-btn-color);">
          <div class="machine-progress-fill" style="width: ${pct}%; background: linear-gradient(90deg, #004b8c, #60a5fa);"></div>
        </div>
      `;
      list.appendChild(row);
    });
    provContainer.appendChild(list);
  }

  // Marine Performance Summary Card
  const marineContainer = document.getElementById('marine-performance-container');
  if (marineContainer) {
    marineContainer.innerHTML = '';
    
    const activeShip = mockShipsDischarge[0] || { ship: 'M/V Golden Polaris', raw: 'SULFATO', total: 45000, actual: 29000, rate: 350 };
    const progress = activeShip.total > 0 ? (activeShip.actual / activeShip.total * 100) : 64.4;

    const summary = document.createElement('div');
    summary.style.display = 'flex';
    summary.style.flexDirection = 'column';
    summary.style.gap = '1rem';
    
    summary.innerHTML = `
      <div class="machine-row">
        <div class="machine-meta">
          <span class="machine-name">Buque Activo: ${activeShip.ship}</span>
          <span class="machine-pct">${progress.toFixed(1)}%</span>
        </div>
        <div class="machine-progress-bg">
          <div class="machine-progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="machine-details">
          <span>Descargado: ${activeShip.actual.toLocaleString()} t</span>
          <span>Total Buque: ${activeShip.total.toLocaleString()} t</span>
        </div>
      </div>
      <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.8rem;">
        <div><strong>Tasa de Descarga:</strong> ${activeShip.rate} t/hora</div>
        <div><strong>Muelles Ocupados:</strong> 2 de 3 muelles</div>
        <div><strong>Buques Programados:</strong> 4 buques este mes</div>
        <div><strong>ETA Próximo:</strong> 2026-06-26 20:00</div>
      </div>
    `;
    marineContainer.appendChild(summary);
  }
}

// ==========================================
// SIMULADOR DE BODEGA 3D (WEBGL / THREE.JS)
// ==========================================
let scene3D, camera3D, renderer3D, controls3D, render3DRequestId = null;
let warehouseStructure = null;
let pileMesh = null;
let floorGrid = null;

// State for 3 warehouses
let warehouse3DState = {
  'bodega-1': {
    name: 'Galpón Central',
    product: 'Planta de Mezcla',
    width: 93.74,
    length: 35.00,
    height: 13.0,
    tonnage: 22000,
    density: 1.15,
    color: '#ea580c'
  },
  'bodega-2': {
    name: 'Galpón # 3',
    product: 'Granel en Tránsito',
    width: 93.74,
    length: 35.00,
    height: 13.0,
    tonnage: 15000,
    density: 1.20,
    color: '#3b82f6'
  },
  'bodega-3': {
    name: 'Galpón Antiguo',
    product: 'Compartimentado',
    width: 18.42,
    length: 35.69,
    height: 13.0,
    tonnage: 6100,
    density: 1.20,
    color: '#f1f5f9'
  }
};

let current3DWarehouseId = 'bodega-1';

function initWarehouse3D() {
  const container = document.getElementById('container-3d-canvas');
  if (!container) return;

  // Clear previous loader spinner
  container.innerHTML = '';

  const width = container.clientWidth;
  const height = container.clientHeight || 500;

  // 1. Scene
  scene3D = new THREE.Scene();
  scene3D.background = new THREE.Color(0x020617);

  // 2. Camera
  camera3D = new THREE.PerspectiveCamera(45, width / height, 1, 1500);
  camera3D.position.set(0, 110, 180);

  // 3. Renderer
  renderer3D = new THREE.WebGLRenderer({ antialias: true });
  renderer3D.setSize(width, height);
  renderer3D.setPixelRatio(window.devicePixelRatio);
  renderer3D.shadowMap.enabled = true;
  container.appendChild(renderer3D.domElement);

  // 4. Controls
  controls3D = new THREE.OrbitControls(camera3D, renderer3D.domElement);
  controls3D.enableDamping = true;
  controls3D.dampingFactor = 0.05;
  controls3D.maxPolarAngle = Math.PI / 2 - 0.05;
  controls3D.minDistance = 10;
  controls3D.maxDistance = 500;
  controls3D.target.set(0, 15, 0);

  // 5. Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene3D.add(ambientLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight1.position.set(100, 150, 50);
  scene3D.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
  dirLight2.position.set(-100, 100, -50);
  scene3D.add(dirLight2);

  // 6. Floor grid
  floorGrid = new THREE.GridHelper(450, 90, 0x1e293b, 0x0f172a);
  floorGrid.position.y = -0.1;
  scene3D.add(floorGrid);

  // Concrete pad mesh
  const floorGeo = new THREE.PlaneGeometry(500, 500);
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x0f172a, 
    roughness: 0.9,
    metalness: 0.1
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene3D.add(floorMesh);

  // Groups for structure and pile
  warehouseStructure = new THREE.Group();
  scene3D.add(warehouseStructure);

  pileMesh = new THREE.Mesh(
    new THREE.BufferGeometry(), 
    new THREE.MeshStandardMaterial({ roughness: 0.9 })
  );
  scene3D.add(pileMesh);

  // Controls listeners
  setupWarehouse3DControlsListeners();

  // Resize listener
  window.addEventListener('resize', onWarehouse3DResize);

  // Animation Loop
  animateWarehouse3D();
}

function renderLogWarehouse3D() {
  const container = document.getElementById('container-3d-canvas');
  if (!container) return;

  if (!scene3D) {
    initWarehouse3D();
  } else {
    if (!render3DRequestId) {
      animateWarehouse3D();
    }
  }

  const wId = document.getElementById('select-3d-warehouse').value;
  current3DWarehouseId = wId;
  const state = warehouse3DState[wId];

  document.getElementById('input-3d-product').value = state.product;
  if (document.getElementById('color-3d-pile')) {
    document.getElementById('color-3d-pile').value = state.color;
  }
  
  document.getElementById('range-3d-width').value = state.width;
  document.getElementById('val-3d-width').textContent = state.width.toFixed(1);
  
  document.getElementById('range-3d-length').value = state.length;
  document.getElementById('val-3d-length').textContent = state.length.toFixed(0);
  
  document.getElementById('range-3d-height').value = state.height;
  document.getElementById('val-3d-height').textContent = state.height.toFixed(1);
  
  document.getElementById('range-3d-tonnage').value = state.tonnage;
  document.getElementById('val-3d-tonnage').textContent = state.tonnage.toLocaleString();
  
  document.getElementById('range-3d-density').value = state.density;
  document.getElementById('val-3d-density').textContent = state.density.toFixed(2);

  updateWarehouse3DModel();
}

function createTextLabelMesh(text, isSelected) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = isSelected ? '#facc15' : '#1e293b'; // Gold border/fill for active, Slate for inactive
  ctx.fillRect(0, 0, 256, 64);
  
  // Border
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 60);
  
  // Text
  ctx.fillStyle = isSelected ? '#0f172a' : '#f1f5f9';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  const labelGeo = new THREE.PlaneGeometry(18, 4.5);
  const labelMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  return new THREE.Mesh(labelGeo, labelMat);
}

function updateWarehouse3DModel() {
  if (!scene3D) return;

  const wId = current3DWarehouseId;
  const state = warehouse3DState[wId];

  const w = parseFloat(document.getElementById('range-3d-width').value);
  const l = parseFloat(document.getElementById('range-3d-length').value);
  const h = parseFloat(document.getElementById('range-3d-height').value);
  const tons = parseFloat(document.getElementById('range-3d-tonnage').value);
  const density = parseFloat(document.getElementById('range-3d-density').value);
  const prodName = document.getElementById('input-3d-product').value;

  state.width = w;
  state.length = l;
  state.height = h;
  state.tonnage = tons;
  state.density = density;
  state.product = prodName;

  document.getElementById('val-3d-width').textContent = w.toFixed(1);
  document.getElementById('val-3d-length').textContent = l.toFixed(0);
  document.getElementById('val-3d-height').textContent = h.toFixed(1);
  document.getElementById('val-3d-tonnage').textContent = tons.toLocaleString();
  document.getElementById('val-3d-density').textContent = density.toFixed(2);

  const warehouseVolume = w * l * h;
  const fertilizerVolume = tons / density;
  const occupancyPct = warehouseVolume > 0 ? (fertilizerVolume / warehouseVolume * 100) : 0;

  document.getElementById('stat-3d-total-volume').textContent = warehouseVolume.toLocaleString(undefined, {maximumFractionDigits: 0}) + ' m³';
  document.getElementById('stat-3d-prod-volume').textContent = fertilizerVolume.toLocaleString(undefined, {maximumFractionDigits: 0}) + ' m³';
  document.getElementById('stat-3d-occupancy').textContent = occupancyPct.toFixed(1) + '%';
  document.getElementById('stat-3d-occupancy').style.color = occupancyPct > 80 ? 'var(--danger)' : occupancyPct > 50 ? 'var(--warning)' : 'var(--success)';

  // Clear all previous models inside the structure group
  while(warehouseStructure.children.length > 0){
    const obj = warehouseStructure.children[0];
    warehouseStructure.remove(obj);
  }

  // Draw 3 warehouses side-by-side in a single row
  const wIds = Object.keys(warehouse3DState);
  wIds.forEach((id) => {
    const s = warehouse3DState[id];
    const isSelected = (id === wId);

    const sW = s.width;
    const sL = s.length;
    const sH = s.height;
    // Lateral wall height is 9.0m, peak is 13.0m (dynamic height - 4.0 rule)
    const sWallH = Math.max(2, sH - 4.0);
    const sHalfW = sW / 2;
    const sHalfL = sL / 2;

    let xOffset = 0;
    let zOffset = 0;

    if (id === 'bodega-1') {
      // Galpón Central
      xOffset = -65;
    } else if (id === 'bodega-2') {
      // Galpón # 3
      xOffset = 35;
    } else if (id === 'bodega-3') {
      // Galpón Antiguo
      xOffset = 100;
    }

    const outlineColor = isSelected ? 0xfacc15 : 0x075985;
    const outlineMaterial = new THREE.LineBasicMaterial({ color: outlineColor, linewidth: isSelected ? 3 : 1 });

    // 1. Concrete containment walls (3.5m height)
    const concreteWallH = 3.5;
    const concreteMat = new THREE.MeshStandardMaterial({ 
      color: isSelected ? 0x94a3b8 : 0x475569, 
      roughness: 0.9 
    });

    const leftConcreteGeo = new THREE.BoxGeometry(0.5, concreteWallH, sL);
    const leftConcreteWall = new THREE.Mesh(leftConcreteGeo, concreteMat);
    leftConcreteWall.position.set(xOffset - sHalfW, concreteWallH/2, zOffset);
    warehouseStructure.add(leftConcreteWall);

    const rightConcreteWall = leftConcreteWall.clone();
    rightConcreteWall.position.set(xOffset + sHalfW, concreteWallH/2, zOffset);
    warehouseStructure.add(rightConcreteWall);

    const backConcreteGeo = new THREE.BoxGeometry(sW, concreteWallH, 0.5);
    const backConcreteWall = new THREE.Mesh(backConcreteGeo, concreteMat);
    backConcreteWall.position.set(xOffset, concreteWallH/2, zOffset - sHalfL);
    warehouseStructure.add(backConcreteWall);

    // 2. Steel Trusses/Frames
    const step = 10;
    for (let z = -sHalfL; z <= sHalfL; z += step) {
      const cz = Math.min(z, sHalfL);

      const framePoints = [
        new THREE.Vector3(xOffset - sHalfW, concreteWallH, zOffset + cz),
        new THREE.Vector3(xOffset - sHalfW, sWallH, zOffset + cz),
        new THREE.Vector3(xOffset, sH, zOffset + cz),
        new THREE.Vector3(xOffset + sHalfW, sWallH, zOffset + cz),
        new THREE.Vector3(xOffset + sHalfW, concreteWallH, zOffset + cz)
      ];

      const frameGeo = new THREE.BufferGeometry().setFromPoints(framePoints);
      const frameLine = new THREE.Line(frameGeo, outlineMaterial);
      warehouseStructure.add(frameLine);
      
      // Steel columns
      const colGeo = new THREE.BoxGeometry(0.4, sWallH - concreteWallH, 0.4);
      const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.8 });
      
      const leftCol = new THREE.Mesh(colGeo, steelMat);
      leftCol.position.set(xOffset - sHalfW, concreteWallH + (sWallH - concreteWallH)/2, zOffset + cz);
      warehouseStructure.add(leftCol);

      const rightCol = new THREE.Mesh(colGeo, steelMat);
      rightCol.position.set(xOffset + sHalfW, concreteWallH + (sWallH - concreteWallH)/2, zOffset + cz);
      warehouseStructure.add(rightCol);
    }

    const railPoints = [
      [new THREE.Vector3(xOffset - sHalfW, concreteWallH, zOffset - sHalfL), new THREE.Vector3(xOffset - sHalfW, concreteWallH, zOffset + sHalfL)],
      [new THREE.Vector3(xOffset + sHalfW, concreteWallH, zOffset - sHalfL), new THREE.Vector3(xOffset + sHalfW, concreteWallH, zOffset + sHalfL)],
      [new THREE.Vector3(xOffset - sHalfW, sWallH, zOffset - sHalfL), new THREE.Vector3(xOffset - sHalfW, sWallH, zOffset + sHalfL)],
      [new THREE.Vector3(xOffset + sHalfW, sWallH, zOffset - sHalfL), new THREE.Vector3(xOffset + sHalfW, sWallH, zOffset + sHalfL)],
      [new THREE.Vector3(xOffset, sH, zOffset - sHalfL), new THREE.Vector3(xOffset, sH, zOffset + sHalfL)]
    ];

    railPoints.forEach(pts => {
      const railGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const railLine = new THREE.Line(railGeo, outlineMaterial);
      warehouseStructure.add(railLine);
    });

    // Central conveyor belt system
    const conveyorPoints = [new THREE.Vector3(xOffset, sH - 0.5, zOffset - sHalfL), new THREE.Vector3(xOffset, sH - 0.5, zOffset + sHalfL)];
    const conveyorGeo = new THREE.BufferGeometry().setFromPoints(conveyorPoints);
    const conveyorLine = new THREE.Line(conveyorGeo, new THREE.LineBasicMaterial({ color: 0x0ea5e9, linewidth: 2 }));
    warehouseStructure.add(conveyorLine);

    // Panel walls
    const panelMat = new THREE.MeshStandardMaterial({ 
      color: 0x0f172a, 
      transparent: true, 
      opacity: isSelected ? 0.15 : 0.05,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const leftWallGeo = new THREE.PlaneGeometry(sL, sWallH);
    const leftWall = new THREE.Mesh(leftWallGeo, panelMat);
    leftWall.position.set(xOffset - sHalfW, sWallH/2, zOffset);
    leftWall.rotation.y = Math.PI / 2;
    warehouseStructure.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.set(xOffset + sHalfW, sWallH/2, zOffset);
    warehouseStructure.add(rightWall);

    const backWallGeo = new THREE.PlaneGeometry(sW, sWallH);
    const backWall = new THREE.Mesh(backWallGeo, panelMat);
    backWall.position.set(xOffset, sWallH/2, zOffset - sHalfL);
    warehouseStructure.add(backWall);

    const frontWall = backWall.clone();
    frontWall.position.set(xOffset, sWallH/2, zOffset + sHalfL);
    warehouseStructure.add(frontWall);

    // Roof Gable triangles
    const triangleShape = new THREE.Shape();
    triangleShape.moveTo(xOffset - sHalfW, sWallH);
    triangleShape.lineTo(xOffset, sH);
    triangleShape.lineTo(xOffset + sHalfW, sWallH);
    triangleShape.lineTo(xOffset - sHalfW, sWallH);

    const gableGeo = new THREE.ShapeGeometry(triangleShape);
    const backGable = new THREE.Mesh(gableGeo, panelMat);
    backGable.position.set(0, 0, zOffset - sHalfL);
    warehouseStructure.add(backGable);

    const frontGable = backGable.clone();
    frontGable.position.set(0, 0, zOffset + sHalfL);
    warehouseStructure.add(frontGable);

    // 3. Custom Internal layouts
    const sVol = s.tonnage / s.density;
    const tanAngle = Math.tan(32 * Math.PI / 180);
    const maxAllowedH = sH * 0.90;

    if (id === 'bodega-3') {
      // GALPÓN ANTIGUO: 3 Internal compartments (divided by concrete walls)
      // Divider 1
      const divWallGeo = new THREE.BoxGeometry(0.4, concreteWallH, sL);
      const divWallMat = new THREE.MeshStandardMaterial({ color: isSelected ? 0x94a3b8 : 0x475569, roughness: 0.9 });
      
      const divWall1 = new THREE.Mesh(divWallGeo, divWallMat);
      divWall1.position.set(xOffset - sHalfW + sW / 3, concreteWallH / 2, zOffset);
      warehouseStructure.add(divWall1);

      // Divider 2
      const divWall2 = divWall1.clone();
      divWall2.position.set(xOffset - sHalfW + 2 * sW / 3, concreteWallH / 2, zOffset);
      warehouseStructure.add(divWall2);

      // 3 separate product heaps (Urea, Sulfato, NPK)
      if (s.tonnage > 0) {
        const compW = sW / 3;
        const boxPiles = [
          { weightPct: 0.45, color: '#f1f5f9' }, // Urea
          { weightPct: 0.30, color: '#64748b' }, // Sulfato
          { weightPct: 0.25, color: '#ea580c' }  // NPK
        ];

        boxPiles.forEach((box, bIdx) => {
          const boxVol = sVol * box.weightPct;
          const boxXOffset = xOffset - sHalfW + compW / 2 + bIdx * compW;
          
          let bRadius = Math.pow((3 * boxVol) / (Math.PI * tanAngle), 1/3);
          let bPileH = bRadius * tanAngle;

          const boxMaterial = new THREE.MeshStandardMaterial({ color: box.color, roughness: 0.9 });
          let boxMesh;

          if (bPileH > maxAllowedH) {
            bPileH = maxAllowedH;
            const cappedRadius = bPileH / tanAngle;
            const crossSectionArea = cappedRadius * bPileH;
            const coneVolume = (1/3) * Math.PI * Math.pow(cappedRadius, 2) * bPileH;
            const excessVol = Math.max(0, boxVol - coneVolume);
            let ridgeL = excessVol / crossSectionArea;
            ridgeL = Math.min(ridgeL, sL * 0.85);

            boxMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, cappedRadius, ridgeL, 32, 1), boxMaterial);
            boxMesh.rotation.set(Math.PI / 2, 0, 0);
            boxMesh.position.set(boxXOffset, bPileH / 2, zOffset);
          } else {
            boxMesh = new THREE.Mesh(new THREE.ConeGeometry(bRadius, bPileH, 32), boxMaterial);
            boxMesh.rotation.set(0, 0, 0);
            boxMesh.position.set(boxXOffset, bPileH / 2, zOffset);
          }
          warehouseStructure.add(boxMesh);
        });
      }
    } else if (id === 'bodega-1') {
      // GALPÓN CENTRAL: Blending plant with 4 horizontal lines
      // Concrete loading platform on the left
      const platformGeo = new THREE.BoxGeometry(10, 1.2, sL);
      const platformMesh = new THREE.Mesh(platformGeo, new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 }));
      platformMesh.position.set(xOffset - sHalfW + 5, 0.6, zOffset);
      warehouseStructure.add(platformMesh);

      // 4 trucks parked
      const truckColors = [0xd97706, 0x16a34a, 0x2563eb, 0xbfdbfe];
      for (let tIdx = 0; tIdx < 4; tIdx++) {
        const tZ = -12 + tIdx * 8;
        // Cabin
        const cabGeo = new THREE.BoxGeometry(2.5, 2.8, 3.5);
        const cabMesh = new THREE.Mesh(cabGeo, new THREE.MeshStandardMaterial({ color: truckColors[tIdx] }));
        cabMesh.position.set(xOffset - sHalfW - 3, 1.4, zOffset + tZ);
        warehouseStructure.add(cabMesh);
        // Trailer
        const trailerGeo = new THREE.BoxGeometry(2.4, 3.2, 7.5);
        const trailerMesh = new THREE.Mesh(trailerGeo, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 }));
        trailerMesh.position.set(xOffset - sHalfW - 8.5, 1.6, zOffset + tZ);
        warehouseStructure.add(trailerMesh);
      }

      // 4 blending lines (hoppers & conveyors)
      const lineNames = ['Línea Agrotécnica', 'Línea Doyle 2', 'Línea Doyle', 'Línea Nacional'];
      for (let lIdx = 0; lIdx < 4; lIdx++) {
        const lZ = -10.5 + lIdx * 7;
        
        // Hopper
        const hopGeo = new THREE.CylinderGeometry(1.2, 0.8, 3, 16);
        const hopMesh = new THREE.Mesh(hopGeo, new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 }));
        hopMesh.position.set(xOffset + sHalfW - 18, 1.5, zOffset + lZ);
        warehouseStructure.add(hopMesh);

        // Conveyor line
        const convGeo = new THREE.BoxGeometry(sW - 28, 0.2, 0.6);
        const convMesh = new THREE.Mesh(convGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
        convMesh.position.set(xOffset - 5, 0.8, zOffset + lZ);
        warehouseStructure.add(convMesh);

        // Label above line
        const lineLabelMesh = createTextLabelMesh(lineNames[lIdx], isSelected);
        lineLabelMesh.scale.set(0.5, 0.5, 0.5);
        lineLabelMesh.position.set(xOffset - 5, 4.5, zOffset + lZ);
        warehouseStructure.add(lineLabelMesh);
      }

      // Storage grid on the right
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          const pX = xOffset + sHalfW - 8 + col * 2.5;
          const pZ = -13 + row * 6.5;
          const palletGeo = new THREE.BoxGeometry(2.0, 2.5, 2.0);
          const palletMesh = new THREE.Mesh(palletGeo, new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
          palletMesh.position.set(pX, 1.25, zOffset + pZ);
          warehouseStructure.add(palletMesh);
        }
      }

      // Raw material heaps near hoppers
      if (s.tonnage > 0) {
        const matColors = ['#f8fafc', '#94a3b8', '#ea580c', '#3b82f6'];
        for (let mIdx = 0; mIdx < 4; mIdx++) {
          const mZ = -10.5 + mIdx * 7;
          const heapGeo = new THREE.ConeGeometry(3, 3, 16);
          const heapMesh = new THREE.Mesh(heapGeo, new THREE.MeshStandardMaterial({ color: matColors[mIdx], roughness: 0.9 }));
          heapMesh.position.set(xOffset + sHalfW - 24, 1.5, zOffset + mZ - 1.5);
          warehouseStructure.add(heapMesh);
        }
      }
    } else if (id === 'bodega-2') {
      // GALPÓN # 3: Shipping & Logistics center with 5 truck loading bays
      const truckColors = [0x2563eb, 0xd97706, 0x16a34a, 0xd97706, 0x2563eb];
      for (let tIdx = 0; tIdx < 5; tIdx++) {
        const tX = xOffset - sHalfW + sW / 6 + tIdx * (sW / 6);
        
        // Parked delivery container truck
        // Cabin
        const cabMesh = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.8, 4), new THREE.MeshStandardMaterial({ color: truckColors[tIdx] }));
        cabMesh.position.set(tX, 1.4, zOffset + 12);
        warehouseStructure.add(cabMesh);

        // Container trailer
        const trailerMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 }));
        trailerMesh.position.set(tX, 1.6, zOffset + 2);
        warehouseStructure.add(trailerMesh);
        
        // Yellow parking outlines on the concrete floor
        const lanePointsL = [new THREE.Vector3(tX - 1.5, 0.05, zOffset - sHalfL), new THREE.Vector3(tX - 1.5, 0.05, zOffset + sHalfL)];
        const laneLineL = new THREE.Line(new THREE.BufferGeometry().setFromPoints(lanePointsL), new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 1 }));
        warehouseStructure.add(laneLineL);

        const lanePointsR = [new THREE.Vector3(tX + 1.5, 0.05, zOffset - sHalfL), new THREE.Vector3(tX + 1.5, 0.05, zOffset + sHalfL)];
        const laneLineR = new THREE.Line(new THREE.BufferGeometry().setFromPoints(lanePointsR), new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 1 }));
        warehouseStructure.add(laneLineR);
      }

      // Add a couple of product heaps inside the other lanes
      if (s.tonnage > 0) {
        const heapGeo = new THREE.ConeGeometry(5, 4, 16);
        const heapMesh = new THREE.Mesh(heapGeo, new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.9 }));
        heapMesh.position.set(xOffset - 25, 2, zOffset - 8);
        warehouseStructure.add(heapMesh);
      }
    }

    // 4. Warehouse Name Signboard
    const labelMesh = createTextLabelMesh(s.name, isSelected);
    labelMesh.position.set(xOffset, 1, zOffset + sHalfL + 8);
    labelMesh.rotation.x = -Math.PI / 6;
    warehouseStructure.add(labelMesh);
  });
}

function animateWarehouse3D() {
  if (!scene3D) return;

  render3DRequestId = requestAnimationFrame(animateWarehouse3D);

  if (controls3D) controls3D.update();
  if (renderer3D && scene3D && camera3D) {
    renderer3D.render(scene3D, camera3D);
  }
}

function stop3DRenderLoop() {
  if (render3DRequestId !== null) {
    cancelAnimationFrame(render3DRequestId);
    render3DRequestId = null;
  }
}

function onWarehouse3DResize() {
  const container = document.getElementById('container-3d-canvas');
  if (!container || !renderer3D || !camera3D) return;

  const w = container.clientWidth;
  const h = container.clientHeight || 500;

  camera3D.aspect = w / h;
  camera3D.updateProjectionMatrix();
  renderer3D.setSize(w, h);
}

function setupWarehouse3DControlsListeners() {
  const selectWh = document.getElementById('select-3d-warehouse');
  if (selectWh) {
    selectWh.addEventListener('change', () => {
      renderLogWarehouse3D();
    });
  }

  const rangeWidth = document.getElementById('range-3d-width');
  if (rangeWidth) rangeWidth.addEventListener('input', updateWarehouse3DModel);

  const rangeLength = document.getElementById('range-3d-length');
  if (rangeLength) rangeLength.addEventListener('input', updateWarehouse3DModel);

  const rangeHeight = document.getElementById('range-3d-height');
  if (rangeHeight) rangeHeight.addEventListener('input', updateWarehouse3DModel);

  const rangeTonnage = document.getElementById('range-3d-tonnage');
  if (rangeTonnage) rangeTonnage.addEventListener('input', updateWarehouse3DModel);

  const rangeDensity = document.getElementById('range-3d-density');
  if (rangeDensity) rangeDensity.addEventListener('input', updateWarehouse3DModel);

  const inputProduct = document.getElementById('input-3d-product');
  if (inputProduct) {
    inputProduct.addEventListener('input', () => {
      const wId = current3DWarehouseId;
      warehouse3DState[wId].product = inputProduct.value;
    });
  }

  const colorInput = document.getElementById('color-3d-pile');
  if (colorInput) {
    colorInput.addEventListener('input', () => {
      const wId = current3DWarehouseId;
      warehouse3DState[wId].color = colorInput.value;
      updateWarehouse3DModel();
    });
  }

  const btnResetCam = document.getElementById('btn-3d-reset-cam');
  if (btnResetCam) {
    btnResetCam.addEventListener('click', () => {
      if (camera3D && controls3D) {
        camera3D.position.set(0, 110, 180);
        controls3D.target.set(0, 15, 0);
        controls3D.update();
      }
    });
  }

  const fileUpload = document.getElementById('file-3d-upload-excel');
  if (fileUpload) {
    fileUpload.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        showLoader('Procesando archivo de granel...');
        setTimeout(() => {
          hideLoader();
          
          warehouse3DState['bodega-1'].tonnage = Math.round(15000 + Math.random() * 10000);
          warehouse3DState['bodega-2'].tonnage = Math.round(8000 + Math.random() * 12000);
          warehouse3DState['bodega-3'].tonnage = Math.round(4000 + Math.random() * 5000);
          
          renderLogWarehouse3D();
          alert('📊 Inventario de Granel Actualizado\n\nSe han actualizado los niveles de las 3 bodegas desde el archivo Excel.');
        }, 1500);
      }
    });
  }
}

// CONTROL DE CALIDAD MODULE
let qcReleases = [];

async function renderQualityControlView() {
  const tbodyBags = document.getElementById('qc-inventory-tbody');
  const tbodyReleases = document.getElementById('qc-releases-history-tbody');
  
  if (!tbodyBags || !tbodyReleases) return;

  // 1. Fetch bag stock
  try {
    const data = await apiFetch('/api/stock');
    currentStock = data.stock;
  } catch (err) {
    console.error("Error al cargar inventario para CC:", err);
  }

  // 2. Fetch QC releases
  try {
    const data = await apiFetch('/api/qc-releases');
    qcReleases = data.releases || [];
  } catch (err) {
    console.error("Error al cargar historial de liberaciones:", err);
  }

  // 3. Render stats
  const approvedCount = qcReleases.filter(r => r.status === 'Aprobado y Liberado').length;
  const rejectedCount = qcReleases.filter(r => r.status === 'Rechazado').length;
  const totalBagsInStock = currentStock.reduce((acc, item) => acc + item.total, 0);

  const statApp = document.getElementById('stat-qc-approved');
  const statRej = document.getElementById('stat-qc-rejected');
  const statBags = document.getElementById('stat-qc-bags-total');
  
  if (statApp) statApp.textContent = approvedCount;
  if (statRej) statRej.textContent = rejectedCount;
  if (statBags) statBags.textContent = totalBagsInStock.toLocaleString();

  // 4. Render Empty Bags Table (only codes starting with 12. which represent vacíos)
  const filterQuery = (document.getElementById('search-qc-inventory').value || '').trim().toLowerCase();
  
  tbodyBags.innerHTML = '';
  const filteredBags = currentStock.filter(item => {
    // Empty bags represent codes starting with '12.'
    return item.code.startsWith('12.') && 
      (item.code.toLowerCase().includes(filterQuery) || item.desc.toLowerCase().includes(filterQuery));
  });

  if (filteredBags.length === 0) {
    tbodyBags.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-3 text-muted">No se encontraron sacos vacíos.</td>
      </tr>
    `;
  } else {
    filteredBags.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-monospace" style="padding: 0.5rem;">${item.code}</td>
        <td style="padding: 0.5rem;"><strong class="bag-desc-link" onclick="openBagArt('${item.code}', '${item.desc.replace(/'/g, "\\'")}')">${item.desc}</strong></td>
        <td class="text-right font-weight-bold" style="padding: 0.5rem;">${item.total.toLocaleString()}</td>
        <td class="text-center" style="padding: 0.5rem;">
          <button class="btn btn-sm btn-outline btn-qc-select" data-code="${item.code}" data-desc="${item.desc.replace(/"/g, '&quot;')}" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;">Seleccionar</button>
        </td>
      `;
      tbodyBags.appendChild(tr);
    });

    // Add click listeners to select bags for QC form
    tbodyBags.querySelectorAll('.btn-qc-select').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const desc = e.target.getAttribute('data-desc');
        const selectType = document.getElementById('qc-input-type');
        const prodInput = document.getElementById('qc-product-name');
        if (selectType) selectType.value = 'Insumo';
        if (prodInput) prodInput.value = `Saco Vacío: ${desc}`;
      });
    });
  }

  // 5. Render QC Releases History Table
  tbodyReleases.innerHTML = '';
  if (qcReleases.length === 0) {
    tbodyReleases.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">No se han registrado liberaciones de calidad aún.</td>
      </tr>
    `;
  } else {
    qcReleases.forEach(r => {
      const tr = document.createElement('tr');
      const dateStr = new Date(r.date).toLocaleString('es-EC', { hour12: false });
      
      let badgeClass = 'badge-normal';
      if (r.status === 'Aprobado y Liberado') badgeClass = 'badge-success';
      else if (r.status === 'Rechazado') badgeClass = 'badge-danger';
      else if (r.status === 'En Espera') badgeClass = 'badge-warning';

      // Checkboxes parameters summary
      const paramsList = [];
      if (r.parameters.humedad) paramsList.push('Humedad');
      if (r.parameters.granulo) paramsList.push('Granulometría');
      if (r.parameters.terrones) paramsList.push('Sin Terrones');
      if (r.parameters.empaque) paramsList.push('Empaque/Sellos');
      if (r.parameters.peso) paramsList.push('Peso/Dim');
      const paramsText = paramsList.length > 0 ? paramsList.join(', ') : 'Ninguno';

      const pStatus = r.prodStatus || 'Disponible';
      let prodBadgeClass = 'badge-normal';
      if (pStatus === 'Disponible') prodBadgeClass = 'badge-success';
      else if (pStatus === 'En Uso') prodBadgeClass = 'badge-warning';
      else if (pStatus === 'Consumido') prodBadgeClass = 'badge-normal';

      tr.innerHTML = `
        <td class="text-muted" style="padding: 0.6rem;">${dateStr}</td>
        <td style="padding: 0.6rem; font-weight: 600;">${r.product}</td>
        <td style="padding: 0.6rem;"><span class="badge badge-normal">${r.type}</span></td>
        <td style="padding: 0.6rem;">${r.productionLine}</td>
        <td style="padding: 0.6rem; color: var(--text-muted); font-size: 10px;">${paramsText}</td>
        <td style="padding: 0.6rem;" class="text-center"><span class="badge ${badgeClass}">${r.status}</span></td>
        <td style="padding: 0.6rem; font-weight: bold;">${r.approver}</td>
        <td style="padding: 0.6rem;" class="text-center"><span class="badge ${prodBadgeClass}">${pStatus}</span></td>
        <td style="padding: 0.6rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.observations || ''}">${r.observations || '-'}</td>
      `;
      tbodyReleases.appendChild(tr);
    });
  }
}

// RENDER RELEASED INPUTS FOR PRODUCTION VIEW
async function renderProdReleasedInputs() {
  const tbody = document.getElementById('prod-released-inputs-tbody');
  if (!tbody) return;

  // 1. Fetch QC releases
  let releases = [];
  try {
    const data = await apiFetch('/api/qc-releases');
    releases = data.releases || [];
  } catch (err) {
    console.error("Error al cargar insumos liberados para Producción:", err);
  }

  // 2. Filter only "Aprobado y Liberado"
  const approvedReleases = releases.filter(r => r.status === 'Aprobado y Liberado');

  tbody.innerHTML = '';
  if (approvedReleases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">No hay insumos o materias primas liberadas por Control de Calidad aún.</td>
      </tr>
    `;
    return;
  }

  approvedReleases.forEach(r => {
    const tr = document.createElement('tr');
    const dateStr = new Date(r.date).toLocaleString('es-EC', { hour12: false });
    
    // Default status if undefined
    const pStatus = r.prodStatus || 'Disponible';

    let badgeClass = 'badge-normal';
    if (pStatus === 'Disponible') badgeClass = 'badge-success';
    else if (pStatus === 'En Uso') badgeClass = 'badge-warning';
    else if (pStatus === 'Consumido') badgeClass = 'badge-normal';

    // Parameters checklist summary
    const paramsList = [];
    if (r.parameters.humedad) paramsList.push('Humedad');
    if (r.parameters.granulo) paramsList.push('Granulometría');
    if (r.parameters.terrones) paramsList.push('Sin Terrones');
    if (r.parameters.empaque) paramsList.push('Empaque/Sellos');
    if (r.parameters.peso) paramsList.push('Peso/Dim');
    const paramsText = paramsList.length > 0 ? paramsList.join(', ') : 'Ninguno';

    // Action button
    let actionBtn = '';
    if (pStatus === 'Disponible') {
      actionBtn = `<button class="btn btn-sm btn-outline btn-qc-update-status" data-id="${r.id}" data-next-status="En Uso" style="border-color: var(--warning-text); color: var(--warning-text); padding: 0.2rem 0.5rem; font-size: 0.75rem; font-weight: bold; cursor: pointer;">⚡ Iniciar Uso</button>`;
    } else if (pStatus === 'En Uso') {
      actionBtn = `<button class="btn btn-sm btn-outline btn-qc-update-status" data-id="${r.id}" data-next-status="Consumido" style="border-color: var(--primary); color: var(--text-main); padding: 0.2rem 0.5rem; font-size: 0.75rem; font-weight: bold; cursor: pointer;">✔️ Consumido</button>`;
    } else {
      actionBtn = `<span class="text-muted" style="font-size: 10px; font-style: italic;">Lote Completado</span>`;
    }

    tr.innerHTML = `
      <td class="text-muted" style="padding: 0.5rem;">${dateStr}</td>
      <td style="padding: 0.5rem; font-weight: 600;">${r.product}</td>
      <td style="padding: 0.5rem;"><span class="badge badge-normal">${r.type}</span></td>
      <td style="padding: 0.5rem;">${r.productionLine}</td>
      <td style="padding: 0.5rem; color: var(--text-muted); font-size: 10px;">${paramsText}</td>
      <td style="padding: 0.5rem; font-weight: bold;">${r.approver}</td>
      <td style="padding: 0.5rem;" class="text-center"><span class="badge ${badgeClass}">${pStatus}</span></td>
      <td style="padding: 0.5rem;" class="text-center">${actionBtn}</td>
    `;
    tbody.appendChild(tr);
  });

  // Bind click events to update status
  tbody.querySelectorAll('.btn-qc-update-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const nextStatus = e.target.getAttribute('data-next-status');
      
      showLoader('Actualizando estado de lote...');
      try {
        await apiFetch('/api/qc-releases/use', {
          method: 'POST',
          body: JSON.stringify({ id, prodStatus: nextStatus })
        });
        // Reload table
        await renderProdReleasedInputs();
      } catch (err) {
        alert(err.message || 'Error al actualizar el estado del insumo');
      } finally {
        hideLoader();
      }
    });
  });
}

// SETUP LISTENERS FOR PRODUCTION DIGITACION
function setupDigitacionListeners() {
  const btnPrev = document.getElementById('btn-digit-prev');
  const btnNext = document.getElementById('btn-digit-next');
  
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (digitationPage > 1) {
        digitationPage--;
        renderDigitacionView();
      }
    });
  }
  
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (digitationPage < digitationTotalPages) {
        digitationPage++;
        renderDigitacionView();
      }
    });
  }
  
  const btnClear = document.getElementById('btn-clear-digit-filters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      document.getElementById('search-digit-history').value = '';
      document.getElementById('filter-digit-line').value = '';
      document.getElementById('filter-digit-start-date').value = '';
      document.getElementById('filter-digit-end-date').value = '';
      digitationPage = 1;
      renderDigitacionView();
    });
  }
  
  const filterLine = document.getElementById('filter-digit-line');
  if (filterLine) filterLine.addEventListener('change', () => { digitationPage = 1; renderDigitacionView(); });
  
  const filterStart = document.getElementById('filter-digit-start-date');
  if (filterStart) filterStart.addEventListener('change', () => { digitationPage = 1; renderDigitacionView(); });
  
  const filterEnd = document.getElementById('filter-digit-end-date');
  if (filterEnd) filterEnd.addEventListener('change', () => { digitationPage = 1; renderDigitacionView(); });
}

// RENDER PRODUCTION DIGITACION VIEW
async function renderDigitacionView() {
  // Check access role
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'logistic')) {
    alert('Acceso no autorizado al módulo de Digitación.');
    switchView('welcome');
    return;
  }

  // Populate Select Product if empty
  const selectEl = document.getElementById('digit-select-product');
  if (selectEl && selectEl.children.length === 0) {
    selectEl.innerHTML = currentStock.map(item => `
      <option value="${item.code}">${item.code} - ${item.desc.slice(0, 45)}...</option>
    `).join('');
  }

  // Pre-fill Date if empty
  const dateInput = document.getElementById('digit-date');
  if (dateInput && !dateInput.value) {
    const todayISO = new Date().toISOString().split('T')[0];
    dateInput.value = todayISO;
  }

  const tbody = document.getElementById('digit-history-tbody');
  if (!tbody) return;

  const search = document.getElementById('search-digit-history').value;
  const line = document.getElementById('filter-digit-line').value;
  const startDate = document.getElementById('filter-digit-start-date').value;
  const endDate = document.getElementById('filter-digit-end-date').value;

  // Build query string
  const queryParams = new URLSearchParams({
    page: digitationPage,
    limit: 50,
    search: search || '',
    line: line || '',
    startDate: startDate || '',
    endDate: endDate || ''
  });

  try {
    const resData = await apiFetch(`/api/production-registry?${queryParams.toString()}`);
    if (resData.success) {
      const records = resData.records || [];
      digitationTotalPages = resData.totalPages || 1;
      digitationPage = resData.currentPage || 1;

      // Update pagination info label
      const infoSpan = document.getElementById('digit-pagination-info');
      if (infoSpan) {
        infoSpan.textContent = `Página ${digitationPage} de ${digitationTotalPages} (${resData.totalRecords.toLocaleString()} registros)`;
      }

      // Enable/Disable pagination buttons
      const btnPrev = document.getElementById('btn-digit-prev');
      if (btnPrev) {
        if (digitationPage <= 1) btnPrev.setAttribute('disabled', 'true');
        else btnPrev.removeAttribute('disabled');
      }

      const btnNext = document.getElementById('btn-digit-next');
      if (btnNext) {
        if (digitationPage >= digitationTotalPages) btnNext.setAttribute('disabled', 'true');
        else btnNext.removeAttribute('disabled');
      }

      tbody.innerHTML = '';
      if (records.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="text-center py-4 text-muted">No se encontraron registros de producción coincidentes.</td>
          </tr>
        `;
        return;
      }

      records.forEach(r => {
        const tr = document.createElement('tr');
        
        // Formating saco/hora
        const sacoHora = r.hours > 0 ? Math.round(r.quantity / r.hours) : 0;
        
        tr.innerHTML = `
          <td style="padding: 0.5rem; white-space: nowrap;" class="text-muted">${r.date}</td>
          <td style="padding: 0.5rem; font-weight: bold; white-space: nowrap;">${r.checker}</td>
          <td style="padding: 0.5rem; text-align: center;"><span class="badge badge-normal">${r.line}</span></td>
          <td style="padding: 0.5rem;" title="${r.productName}">
            <span style="font-family: monospace; font-size: 10px; color: var(--accent); font-weight: bold;">${r.productCode}</span><br>
            <strong style="display: block; max-width: 280px; overflow-wrap: break-word; white-space: normal;">${r.productName}</strong>
          </td>
          <td style="padding: 0.5rem; text-align: right; font-weight: bold; white-space: nowrap;">${r.quantity.toLocaleString()}</td>
          <td style="padding: 0.5rem; text-align: right; white-space: nowrap;">${r.hours} h</td>
          <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: var(--success-text); white-space: nowrap;">${sacoHora.toLocaleString()}</td>
          <td style="padding: 0.5rem;">${r.client}</td>
          <td style="padding: 0.5rem; text-align: center; color: var(--text-muted); font-size: 10px; white-space: nowrap;">${r.startTime} - ${r.endTime}</td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      console.error('Error fetching production registry:', resData.error);
    }
  } catch (err) {
    console.error('Network error fetching production registry:', err);
  }
}

// State for physical movements
let physicalMovementsLog = [];

// SETUP LISTENERS FOR EMPTY BAGS PHYSICAL MOVEMENTS
function setupPhysicalConsumptionListeners() {
  const mType = document.getElementById('movement-type');
  const mSalidaSec = document.getElementById('movement-salida-section');
  const mEntradaSec = document.getElementById('movement-entrada-section');
  const btnSubmit = document.getElementById('btn-submit-movement');
  
  if (mType) {
    mType.addEventListener('change', () => {
      const typeVal = mType.value;
      if (typeVal === 'salida') {
        if (mSalidaSec) mSalidaSec.classList.remove('hidden');
        if (mEntradaSec) mEntradaSec.classList.add('hidden');
        if (btnSubmit) {
          btnSubmit.textContent = '📉 Registrar Salida';
          btnSubmit.style.backgroundColor = ''; // default
        }
      } else {
        if (mSalidaSec) mSalidaSec.classList.add('hidden');
        if (mEntradaSec) mEntradaSec.classList.remove('hidden');
        if (btnSubmit) {
          btnSubmit.textContent = '📈 Registrar Ingreso';
          btnSubmit.style.backgroundColor = 'var(--success)';
        }
      }
    });
  }

  const codeSelect = document.getElementById('movement-bag-code');
  if (codeSelect) {
    codeSelect.addEventListener('change', () => {
      const selectedCode = codeSelect.value;
      const item = currentStock.find(i => i.code === selectedCode);
      const descInput = document.getElementById('movement-bag-desc');
      if (descInput) {
        descInput.value = item ? item.desc : '';
      }
    });
  }

  const formMovement = document.getElementById('form-physical-movement');
  if (formMovement) {
    formMovement.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const type = document.getElementById('movement-type').value;
      const date = document.getElementById('movement-date').value;
      const code = document.getElementById('movement-bag-code').value;
      const quantity = parseInt(document.getElementById('movement-quantity').value) || 0;
      
      let destinationOrSource = '';
      let concept = '';
      
      if (type === 'salida') {
        destinationOrSource = document.getElementById('movement-line').value;
        concept = document.getElementById('movement-concept-exit').value;
      } else {
        destinationOrSource = document.getElementById('movement-provider').value;
        concept = 'Ingreso por Proveedor';
      }

      if (!code) {
        alert('Por favor seleccione un código de saco.');
        return;
      }

      showLoader('Registrando movimiento en inventario...');
      try {
        const resData = await apiFetch('/api/empty-bags-movements', {
          method: 'POST',
          body: JSON.stringify({
            type,
            date,
            code,
            quantity,
            destinationOrSource,
            concept
          })
        });

        if (resData.success) {
          // Update local stock cache
          if (resData.updatedStock) {
            currentStock = resData.updatedStock;
          }
          
          alert('¡Movimiento registrado con éxito!');
          formMovement.reset();
          
          // Reset default date and type fields
          const dateInput = document.getElementById('movement-date');
          if (dateInput) {
            const todayISO = new Date().toISOString().split('T')[0];
            dateInput.value = todayISO;
            dateInput.min = todayISO;
          }
          if (mType) {
            mType.value = 'salida';
            mType.dispatchEvent(new Event('change'));
          }

          // Reload data
          await renderPhysicalConsumptionView();
          
          // Dynamically refresh dashboard or inventory table if they are initialized
          if (typeof renderInventoryTable === 'function') renderInventoryTable();
          if (typeof loadSettingsData === 'function') loadSettingsData(); // Reloads settings and stock
        } else {
          alert('Error: ' + resData.error);
        }
      } catch (err) {
        alert('Error al registrar movimiento: ' + err.message);
      } finally {
        hideLoader();
      }
    });
  }

  // Filter change listeners
  const filterInputs = [
    'search-movement-history',
    'filter-movement-type',
    'filter-movement-dest',
    'filter-movement-start-date',
    'filter-movement-end-date'
  ];
  
  filterInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        filterAndRenderMovementsTable();
      });
      el.addEventListener('change', () => {
        filterAndRenderMovementsTable();
      });
    }
  });

  const btnClear = document.getElementById('btn-clear-movement-filters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      document.getElementById('search-movement-history').value = '';
      document.getElementById('filter-movement-type').value = '';
      document.getElementById('filter-movement-dest').value = '';
      document.getElementById('filter-movement-start-date').value = '';
      document.getElementById('filter-movement-end-date').value = '';
      filterAndRenderMovementsTable();
    });
  }

  const btnExport = document.getElementById('btn-export-movement-csv');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportActiveViewDOMToCSV('log-physical-consumption');
    });
  }
}

// RENDER PHYSICAL CONSUMPTION VIEW
async function renderPhysicalConsumptionView() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'logistic' && currentUser.role !== 'quality')) {
    alert('Acceso denegado: rol no autorizado.');
    switchView('welcome');
    return;
  }

  // Prefill Date restriction
  const dateInput = document.getElementById('movement-date');
  if (dateInput) {
    const todayISO = new Date().toISOString().split('T')[0];
    dateInput.min = todayISO;
    if (!dateInput.value) {
      dateInput.value = todayISO;
    }
  }

  // Populate bags select dropdown if it's empty
  const codeSelect = document.getElementById('movement-bag-code');
  if (codeSelect && codeSelect.children.length <= 1) {
    codeSelect.innerHTML = '<option value="">-- Seleccione Código --</option>' + 
      currentStock.map(item => `
        <option value="${item.code}">${item.code} - ${item.desc}</option>
      `).join('');
  }

  const tbody = document.getElementById('movement-history-tbody');
  if (!tbody) return;

  try {
    const resData = await apiFetch('/api/empty-bags-movements');
    if (resData.success) {
      physicalMovementsLog = resData.movements || [];
      filterAndRenderMovementsTable();
    } else {
      console.error('Error fetching physical movements:', resData.error);
    }
  } catch (err) {
    console.error('Network error fetching physical movements:', err);
  }
}

// FILTER AND RENDER TABLE
function filterAndRenderMovementsTable() {
  const tbody = document.getElementById('movement-history-tbody');
  if (!tbody) return;

  const searchVal = (document.getElementById('search-movement-history').value || '').toLowerCase().trim();
  const typeVal = document.getElementById('filter-movement-type').value;
  const destVal = document.getElementById('filter-movement-dest').value;
  const startDate = document.getElementById('filter-movement-start-date').value;
  const endDate = document.getElementById('filter-movement-end-date').value;

  const filtered = physicalMovementsLog.filter(m => {
    // Search filter
    if (searchVal) {
      const matchSearch = m.code.toLowerCase().includes(searchVal) ||
                          m.desc.toLowerCase().includes(searchVal) ||
                          m.concept.toLowerCase().includes(searchVal) ||
                          m.destinationOrSource.toLowerCase().includes(searchVal) ||
                          m.user.toLowerCase().includes(searchVal);
      if (!matchSearch) return false;
    }
    
    // Type filter
    if (typeVal && m.type !== typeVal) return false;

    // Destination/Source filter
    if (destVal && m.destinationOrSource !== destVal) return false;

    // Date range filter
    if (startDate && m.date < startDate) return false;
    if (endDate && m.date > endDate) return false;

    return true;
  });

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">No se encontraron movimientos registrados con los filtros seleccionados.</td>
      </tr>
    `;
    return;
  }

  filtered.forEach(m => {
    const tr = document.createElement('tr');
    
    const typeBadge = m.type === 'salida' ? 
      `<span class="badge badge-warning" style="background-color: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); font-weight: bold;">Salida</span>` : 
      `<span class="badge badge-success" style="background-color: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); font-weight: bold;">Entrada</span>`;
      
    tr.innerHTML = `
      <td style="padding: 0.5rem; white-space: nowrap;" class="text-muted">${m.date}</td>
      <td style="padding: 0.5rem; text-align: center;">${typeBadge}</td>
      <td style="padding: 0.5rem;" title="${m.desc}">
        <span style="font-family: monospace; font-size: 10px; color: var(--accent); font-weight: bold;">${m.code}</span><br>
        <strong style="display: block; max-width: 250px; overflow-wrap: break-word; white-space: normal;">${m.desc}</strong>
      </td>
      <td style="padding: 0.5rem; text-align: right; font-weight: bold; white-space: nowrap; color: ${m.type === 'salida' ? 'var(--danger-text)' : 'var(--success-text)'};">
        ${m.type === 'salida' ? '-' : '+'}${m.quantity.toLocaleString()}
      </td>
      <td style="padding: 0.5rem; font-weight: 500;">${m.destinationOrSource}</td>
      <td style="padding: 0.5rem; color: var(--text-muted); font-size: 11px;">${m.concept}</td>
      <td style="padding: 0.5rem; text-align: right; font-weight: bold; white-space: nowrap; color: var(--text-main); background: rgba(255,255,255,0.02); border-left: 1px solid rgba(255,255,255,0.05);">${m.finalBalance.toLocaleString()}</td>
      <td style="padding: 0.5rem; white-space: nowrap;">${m.user}</td>
    `;
    tbody.appendChild(tr);
  });
}

// State for PDF imports status
let importsStatusList = [];
let importsStatusLastUpdated = "";

// SETUP LISTENERS FOR IMPORTS STATUS VIEW
function setupImportsStatusListeners() {
  const dragZone = document.getElementById('pdf-drag-drop-zone');
  const fileInput = document.getElementById('import-pdf-file-input');
  
  if (dragZone && fileInput) {
    // Click triggers file selector
    dragZone.addEventListener('click', () => {
      fileInput.click();
    });

    // Drag over styling
    dragZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dragZone.parentElement.style.borderColor = 'var(--accent)';
      dragZone.parentElement.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
    });

    // Drag leave styling
    ['dragleave', 'dragend'].forEach(type => {
      dragZone.addEventListener(type, () => {
        dragZone.parentElement.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        dragZone.parentElement.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
      });
    });

    // Drop file
    dragZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dragZone.parentElement.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      dragZone.parentElement.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
      
      const file = e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith('.pdf')) {
        uploadImportsPDF(file);
      } else {
        alert('Por favor selecciona un archivo PDF válido.');
      }
    });

    // File input change
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        uploadImportsPDF(file);
      }
    });
  }

  // Filter change bindings
  const filterSearch = document.getElementById('search-imports-status');
  const filterState = document.getElementById('filter-imports-status-state');
  const filterProvider = document.getElementById('filter-imports-status-provider');

  if (filterSearch) filterSearch.addEventListener('input', () => filterAndRenderImportsStatus());
  if (filterState) filterState.addEventListener('change', () => filterAndRenderImportsStatus());
  if (filterProvider) filterProvider.addEventListener('change', () => filterAndRenderImportsStatus());

  // Export CSV
  const btnExport = document.getElementById('btn-export-imports-status-csv');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportActiveViewDOMToCSV('imports-status');
    });
  }

  // Resend Email Alerts
  const btnSendEmail = document.getElementById('btn-imports-send-email');
  if (btnSendEmail) {
    btnSendEmail.addEventListener('click', async () => {
      btnSendEmail.disabled = true;
      btnSendEmail.textContent = '⏱️ Enviando...';
      try {
        const resData = await apiFetch('/api/imports-status/send-email', { method: 'POST' });
        if (resData.success) {
          alert('Correo de alertas enviado exitosamente a todos los destinatarios.');
        } else {
          alert('Error al enviar correo: ' + (resData.error || 'Desconocido'));
        }
      } catch (err) {
        alert('Error al enviar correo: ' + err.message);
      } finally {
        btnSendEmail.disabled = false;
        btnSendEmail.textContent = '✉️ Enviar Alertas por Correo';
      }
    });
  }
}

// UPLOAD IMPORTS PDF
async function uploadImportsPDF(file) {
  const statusBar = document.getElementById('pdf-upload-status-bar');
  if (statusBar) {
    statusBar.classList.remove('hidden');
    statusBar.textContent = `Subiendo y analizando: ${file.name}...`;
  }

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });

    const resData = await apiFetch('/api/imports-status/upload', {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        base64: base64
      })
    });

    if (resData.success) {
      alert(`¡PDF cargado con éxito! Se mapearon ${resData.count} filas de importaciones.`);
      await renderImportsStatusView();
    } else {
      alert('Error al procesar PDF: ' + resData.error);
    }
  } catch (err) {
    alert('Error de red al cargar el PDF: ' + err.message);
  } finally {
    if (statusBar) {
      statusBar.classList.add('hidden');
    }
    // Reset file input value
    const fileInput = document.getElementById('import-pdf-file-input');
    if (fileInput) fileInput.value = '';
  }
}

// Helper to parse DD/MM/YYYY into Date object
function parseDateDMY(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.replace(/[*]/g, '').trim();
  const parts = clean.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return null;
}

// RENDER IMPORTS STATUS VIEW
async function renderImportsStatusView() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'logistic' && currentUser.role !== 'quality' && currentUser.role !== 'imports')) {
    alert('Acceso denegado: rol no autorizado.');
    switchView('welcome');
    return;
  }

  try {
    const resData = await apiFetch('/api/imports-status');
    if (resData.success) {
      importsStatusList = resData.importsStatus || [];
      importsStatusLastUpdated = resData.lastUpdated || "";

      // Update last updated timestamp
      const lastUpdatedEl = document.getElementById('imports-pdf-last-updated');
      if (lastUpdatedEl) {
        if (importsStatusLastUpdated) {
          const dateObj = new Date(importsStatusLastUpdated);
          lastUpdatedEl.textContent = `Última actualización: ${dateObj.toLocaleDateString()} a las ${dateObj.toLocaleTimeString()}`;
        } else {
          lastUpdatedEl.textContent = 'Última actualización: Nunca';
        }
      }

      // Render Alerts and Notifications
      const alertsContainer = document.getElementById('imports-alerts-container');
      const alertsBody = document.getElementById('imports-alerts-body');
      const alertsList = resData.importsAlerts || [];

      if (alertsContainer && alertsBody) {
        if (alertsList.length > 0) {
          alertsContainer.classList.remove('hidden');
          alertsBody.innerHTML = '';
          const arrivals = alertsList.filter(a => a.type === 'arrival');
          const changes = alertsList.filter(a => a.type === 'change');

          const arrivalsByVessel = {};
          arrivals.forEach(arr => {
            const vKey = arr.vessel || 'Sin buque';
            if (!arrivalsByVessel[vKey]) arrivalsByVessel[vKey] = [];
            arrivalsByVessel[vKey].push(arr);
          });

          // Render grouped arrivals
          Object.keys(arrivalsByVessel).forEach(vKey => {
            const items = arrivalsByVessel[vKey];
            const earliestEta = items[0].eta;
            const minDays = Math.min(...items.map(i => i.daysRemaining));

            const div = document.createElement('div');
            div.style = 'padding: 0.75rem; border-radius: 8px; font-size: 13px; display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.5rem; background: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-left-width: 4px;';
            
            let listHtml = '';
            items.forEach(item => {
              listHtml += `
                <li style="margin-top: 4px;">
                  O/C <strong>${item.oc}</strong>: <strong>${item.quantity.toLocaleString()} ${item.unit}</strong> de <strong>${item.product}</strong>
                  <div style="font-size: 11px; color: var(--text-muted);">(Proveedor: ${item.provider} | Almacén: ${item.warehouse || 'Sin almacén'})</div>
                </li>
              `;
            });

            div.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(239, 68, 68, 0.2); padding-bottom: 4px;">
                <strong style="color: #ef4444; font-size: 13px;">🚢 Buque: ${vKey}</strong>
                <span style="font-size: 11px; color: #ef4444; font-weight: bold;">ETA: ${earliestEta} (en ${minDays} días)</span>
              </div>
              <div style="color: var(--text-color); margin-top: 0.2rem;">
                <ul style="margin: 4px 0 0 1.25rem; padding: 0;">
                  ${listHtml}
                </ul>
              </div>
            `;
            alertsBody.appendChild(div);
          });

          // Render changes
          changes.forEach(alertItem => {
            const div = document.createElement('div');
            div.style = 'padding: 0.75rem; border-radius: 8px; font-size: 13px; display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.5rem; background: rgba(245, 158, 11, 0.08); border-left: 4px solid #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); border-left-width: 4px;';
            const changesListHtml = alertItem.changes.map(ch => {
              return `<li><strong>${ch.field.toUpperCase()}</strong>: de "<span style="text-decoration: line-through; opacity: 0.6;">${ch.oldVal}</span>" a "<strong style="color: #f59e0b;">${ch.newVal}</strong>"</li>`;
            }).join('');
            
            div.innerHTML = `
              <div>
                <strong style="color: #f59e0b;">🟡 Modificación de Información (O/C ${alertItem.oc})</strong>
              </div>
              <div style="color: var(--text-color); margin-top: 0.2rem;">
                Se detectaron cambios en los datos del reporte de <strong>${alertItem.provider || 'Proveedor'}</strong> para <strong>${alertItem.product || 'Producto'}</strong>:
                <ul style="margin: 0.25rem 0 0 1.25rem; padding: 0; font-size: 12px; display: flex; flex-direction: column; gap: 0.15rem;">
                  ${changesListHtml}
                </ul>
              </div>
            `;
            alertsBody.appendChild(div);
          });
        } else {
          alertsContainer.classList.add('hidden');
        }
      }

      // 1. Calculate and Render KPIs
      // KPI A: Unique Expected Vessels count
      const uniqueVessels = [...new Set(importsStatusList.map(item => item.vessel.trim()).filter(v => v !== ''))];
      document.getElementById('stat-imports-vessels-count').textContent = `${uniqueVessels.length} Buques`;

      // KPI B: Total Tonnage in Transit (TM)
      const totalTM = importsStatusList
        .filter(item => item.unit.toUpperCase() === 'TM')
        .reduce((sum, item) => sum + item.quantity, 0);
      document.getElementById('stat-imports-total-tonnage').textContent = `${Math.round(totalTM).toLocaleString()} TM`;

      // Calculate totals by cargo type: empaque, granel, bb, sac, lit
      let totalEmpaque = 0; // BB + SAC
      let totalGranel = 0;
      let totalBB = 0;
      let totalSAC = 0;
      let totalLTS = 0;

      importsStatusList.forEach(item => {
        const qty = item.quantity || 0;
        const packingUpper = (item.packing || '').toUpperCase().trim();
        const unitUpper = (item.unit || '').toUpperCase().trim();

        if (unitUpper === 'LTS') {
          totalLTS += qty;
        } else if (packingUpper === 'GRANEL') {
          totalGranel += qty;
        } else if (packingUpper.startsWith('BB')) {
          totalBB += qty;
          totalEmpaque += qty;
        } else if (packingUpper.startsWith('SAC')) {
          totalSAC += qty;
          totalEmpaque += qty;
        }
      });

      const elEmpaque = document.getElementById('stat-imports-empaque');
      if (elEmpaque) elEmpaque.textContent = `${Math.round(totalEmpaque).toLocaleString()} TM`;

      const elGranel = document.getElementById('stat-imports-granel');
      if (elGranel) elGranel.textContent = `${Math.round(totalGranel).toLocaleString()} TM`;

      const elBB = document.getElementById('stat-imports-bb');
      if (elBB) elBB.textContent = `${Math.round(totalBB).toLocaleString()} TM`;

      const elSAC = document.getElementById('stat-imports-sac');
      if (elSAC) elSAC.textContent = `${Math.round(totalSAC).toLocaleString()} TM`;

      const elLit = document.getElementById('stat-imports-lit');
      if (elLit) elLit.textContent = `${Math.round(totalLTS).toLocaleString()} LTS`;

      // KPI C: Next Arrival Vessel
      let nextArrivalStr = 'Sin buques pendientes';
      let earliestDate = null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      importsStatusList.forEach(item => {
        const etaDate = parseDateDMY(item.eta);
        const vesselName = item.vessel ? item.vessel.trim() : '';
        if (etaDate && vesselName && etaDate >= today) {
          if (earliestDate === null || etaDate < earliestDate) {
            earliestDate = etaDate;
            nextArrivalStr = `${vesselName} (${item.eta})`;
          }
        }
      });
      document.getElementById('stat-imports-next-arrival').textContent = nextArrivalStr;

      // 2. Populate Dropdown Filters if empty or modified
      const filterState = document.getElementById('filter-imports-status-state');
      const filterProvider = document.getElementById('filter-imports-status-provider');

      if (filterState) {
        const uniqueStates = [...new Set(importsStatusList.map(item => item.status.trim()).filter(s => s !== ''))].sort();
        filterState.innerHTML = '<option value="">-- Todos los Estados --</option>' +
          uniqueStates.map(s => `<option value="${s}">${s}</option>`).join('');
      }

      if (filterProvider) {
        const uniqueProviders = [...new Set(importsStatusList.map(item => item.provider.trim()).filter(p => p !== ''))].sort();
        filterProvider.innerHTML = '<option value="">-- Todos los Proveedores --</option>' +
          uniqueProviders.map(p => `<option value="${p}">${p}</option>`).join('');
      }

      // 3. Render Table
      filterAndRenderImportsStatus();
    } else {
      console.error('Error fetching imports status:', resData.error);
    }
  } catch (err) {
    console.error('Network error fetching imports status:', err);
  }
}

// FILTER AND RENDER IMPORTS STATUS TABLE
function filterAndRenderImportsStatus() {
  const tbody = document.getElementById('imports-status-table-tbody');
  if (!tbody) return;

  const searchVal = (document.getElementById('search-imports-status').value || '').toLowerCase().trim();
  const stateVal = document.getElementById('filter-imports-status-state').value;
  const providerVal = document.getElementById('filter-imports-status-provider').value;

  const filtered = importsStatusList.filter(item => {
    if (searchVal) {
      const match = (item.oc || '').toLowerCase().includes(searchVal) ||
                    (item.vessel || '').toLowerCase().includes(searchVal) ||
                    (item.provider || '').toLowerCase().includes(searchVal) ||
                    (item.product || '').toLowerCase().includes(searchVal) ||
                    (item.status || '').toLowerCase().includes(searchVal);
      if (!match) return false;
    }

    if (stateVal && item.status !== stateVal) return false;
    if (providerVal && item.provider !== providerVal) return false;

    return true;
  });

  const totalCountEl = document.getElementById('imports-status-table-total-count');
  if (totalCountEl) totalCountEl.textContent = filtered.length;

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-4 text-muted">No se encontraron registros de importación con los filtros seleccionados.</td>
      </tr>
    `;
    return;
  }

  filtered.forEach(row => {
    const tr = document.createElement('tr');
    
    const statusUpper = (row.status || '').toUpperCase();
    let rowBg = '';
    if (statusUpper.includes('TRIBUTOS PAGADOS') || statusUpper.includes('PROCESO SALIDA')) {
      rowBg = 'background-color: rgba(16, 185, 129, 0.06);';
    } else if (statusUpper.includes('BORRADORES') || statusUpper.includes('REVISION')) {
      rowBg = 'background-color: rgba(245, 158, 11, 0.06);';
    }

    tr.style = rowBg;
    tr.innerHTML = `
      <td style="padding: 0.6rem; font-weight: 600; white-space: nowrap; font-family: monospace; color: var(--accent);">${row.oc || '-'}</td>
      <td style="padding: 0.6rem; font-weight: 500; white-space: nowrap;">${row.provider || '-'}</td>
      <td style="padding: 0.6rem;" title="${row.product}">
        <strong style="display: block; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${row.product || '-'}</strong>
      </td>
      <td style="padding: 0.6rem; text-align: right; font-weight: 700; white-space: nowrap;">${row.quantity ? row.quantity.toLocaleString() : '-'}</td>
      <td style="padding: 0.6rem; white-space: nowrap;">${row.unit || '-'}</td>
      <td style="padding: 0.6rem; white-space: nowrap; color: var(--text-muted);">${row.packing || '-'}</td>
      <td style="padding: 0.6rem; white-space: nowrap; font-weight: 600; color: #f59e0b;">${row.eta || '-'}</td>
      <td style="padding: 0.6rem; font-weight: 600; white-space: nowrap; color: var(--text-color);">${row.vessel || '-'}</td>
      <td style="padding: 0.6rem; white-space: nowrap; font-weight: 500;">${row.warehouse || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// --- DESTAJO (PIECEWORK) MODULE LOGIC ---
// ==========================================

let destajoData = {
  collaborators: [],
  groups: [],
  periods: [],
  shifts: [],
  rates: [],
  production: [],
  audit: []
};

let activeDestajoTab = 'dashboard';
let activeReportSubTab = 'payroll';
let editingProductionId = null;
let editingCollaboratorId = null;

async function renderProdDestajoView() {
  showLoader('Cargando módulo de Destajo...');
  try {
    await fetchDestajoData();
    populateDestajoPeriodDropdowns();
    populateDestajoGroupDropdowns();
    populateDestajoShiftDropdowns();
    loadRatesTabConfig();
    switchDestajoTab(activeDestajoTab);
  } catch (err) {
    console.error('Error al inicializar Destajo:', err);
    alert('Error al inicializar módulo de Destajo: ' + err.message);
  } finally {
    hideLoader();
  }
}

async function fetchDestajoData() {
  const res = await apiFetch('/api/destajo/data');
  if (res.success) {
    destajoData = {
      collaborators: res.collaborators || [],
      groups: res.groups || [],
      periods: res.periods || [],
      shifts: res.shifts || [],
      rates: res.rates || [],
      production: res.production || [],
      audit: res.audit || []
    };
  }
}

function switchDestajoTab(tab) {
  activeDestajoTab = tab;
  document.querySelectorAll('.destajo-sub-view').forEach(el => el.classList.add('hidden'));
  
  const targetView = document.getElementById(`destajo-view-${tab}`);
  if (targetView) targetView.classList.remove('hidden');

  // Update button active state
  const tabs = ['dashboard', 'production', 'periods', 'collaborators', 'rates', 'reports'];
  tabs.forEach(t => {
    const btn = document.getElementById(`btn-destajo-tab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = 'btn btn-sm btn-primary';
      } else {
        btn.className = 'btn btn-sm btn-secondary';
      }
    }
  });

  if (tab === 'dashboard') loadDestajoDashboard();
  else if (tab === 'production') loadDestajoProductionTab();
  else if (tab === 'periods') renderDestajoPeriods();
  else if (tab === 'collaborators') renderDestajoCollaboratorsAndGroups();
  else if (tab === 'rates') renderDestajoRatesAndShifts();
  else if (tab === 'reports') loadDestajoReports();
}

function populateDestajoPeriodDropdowns() {
  const dashPeriod = document.getElementById('destajo-dashboard-period');
  const prodPeriod = document.getElementById('destajo-prod-period');
  const repPeriod = document.getElementById('destajo-report-period');

  const optionsHtml = destajoData.periods.map(p => 
    `<option value="${p.id}">${p.startDate} al ${p.endDate} (${p.status.toUpperCase()})</option>`
  ).join('');

  if (dashPeriod) {
    dashPeriod.innerHTML = optionsHtml;
    if (destajoData.periods.length > 0 && !dashPeriod.value) {
      dashPeriod.value = destajoData.periods[0].id;
    }
  }
  if (prodPeriod) {
    prodPeriod.innerHTML = optionsHtml;
  }
  if (repPeriod) {
    repPeriod.innerHTML = optionsHtml;
    if (destajoData.periods.length > 0 && !repPeriod.value) {
      repPeriod.value = destajoData.periods[0].id;
    }
  }
}

function populateDestajoGroupDropdowns() {
  const collabGroup = document.getElementById('destajo-collab-group');
  const prodGroup = document.getElementById('destajo-prod-group');

  const optionsHtml = '<option value="">Seleccione grupo</option>' + destajoData.groups.map(g => 
    `<option value="${g.id}">Grupo ${g.id} - ${g.name}</option>`
  ).join('');

  if (collabGroup) collabGroup.innerHTML = optionsHtml;
  if (prodGroup) prodGroup.innerHTML = optionsHtml;
}

function populateDestajoShiftDropdowns() {
  const prodShift = document.getElementById('destajo-prod-shift');
  if (prodShift) {
    prodShift.innerHTML = '<option value="">Seleccione jornada</option>' + destajoData.shifts.map(s => 
      `<option value="${s.id}">${s.name} (${s.factor}x)</option>`
    ).join('');
  }
}

// 1. DASHBOARD CALCULATIONS
function getDestajoCalculatedLogs(periodId) {
  const period = destajoData.periods.find(p => p.id === Number(periodId));
  if (!period) return [];

  const logs = destajoData.production.filter(l => l.payrollPeriodId === Number(periodId) && l.status !== 'voided');

  return logs.map(l => {
    // Determine active rate
    const sortedRates = [...destajoData.rates].sort((a,b) => b.effectiveDate.localeCompare(a.effectiveDate));
    const rate = sortedRates.find(r => r.effectiveDate <= l.date) || sortedRates[sortedRates.length - 1] || { simpleRate: 0.05, mixRate: 0.09 };

    const shift = destajoData.shifts.find(s => s.id === Number(l.shiftId)) || { factor: 1.0, name: 'Normal' };
    const valSimples = (l.sacosSimples || 0) * rate.simpleRate;
    const valMezclas = (l.sacosMezclas || 0) * rate.mixRate;
    const totalVal = (valSimples + valMezclas) * shift.factor;

    // Determine participants
    let participants = l.participants || [];
    const isSpecial = shift.name.toLowerCase().includes('suplementaria') || shift.name.toLowerCase().includes('extraordinaria');
    if (!isSpecial && participants.length === 0) {
      const groupMembers = destajoData.collaborators.filter(c => c.groupId === Number(l.groupId) && c.isActive);
      participants = groupMembers
        .map(c => c.id)
        .filter(id => !(l.absent || []).includes(id) && !(l.permitted || []).includes(id) && !(l.vacation || []).includes(id));
    }

    return {
      ...l,
      resolvedParticipants: participants,
      calculatedValue: totalVal,
      rate,
      shift
    };
  });
}

function loadDestajoDashboard() {
  const periodId = document.getElementById('destajo-dashboard-period').value;
  if (!periodId) return;

  const logs = getDestajoCalculatedLogs(periodId);

  let totalSimples = 0;
  let totalMezclas = 0;
  let totalValue = 0;

  const groupDistribution = {};
  const shiftDistribution = {};

  logs.forEach(l => {
    totalSimples += l.sacosSimples || 0;
    totalMezclas += l.sacosMezclas || 0;
    totalValue += l.calculatedValue || 0;

    const gName = destajoData.groups.find(g => g.id === Number(l.groupId))?.name || `Grupo ${l.groupId}`;
    groupDistribution[gName] = (groupDistribution[gName] || 0) + l.calculatedValue;

    const sName = l.shift.name;
    shiftDistribution[sName] = (shiftDistribution[sName] || 0) + l.calculatedValue;
  });

  document.getElementById('destajo-stat-val').textContent = `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('destajo-stat-simples').textContent = totalSimples.toLocaleString();
  document.getElementById('destajo-stat-mezclas').textContent = totalMezclas.toLocaleString();
  document.getElementById('destajo-stat-sacos').textContent = (totalSimples + totalMezclas).toLocaleString();

  // Render group chart bars
  const groupChartContainer = document.getElementById('destajo-dashboard-group-chart');
  let groupHtml = '';
  const groupKeys = Object.keys(groupDistribution);
  if (groupKeys.length === 0) {
    groupHtml = '<p style="color: var(--text-muted); text-align: center;">Sin registros de producción.</p>';
  } else {
    groupKeys.forEach(k => {
      const pct = totalValue > 0 ? (groupDistribution[k] / totalValue) * 100 : 0;
      groupHtml += `
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
            <span>${k}</span>
            <strong>$${groupDistribution[k].toFixed(2)} (${pct.toFixed(1)}%)</strong>
          </div>
          <div style="background: rgba(255,255,255,0.05); height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: var(--primary); width: ${pct}%; height: 100%;"></div>
          </div>
        </div>
      `;
    });
  }
  groupChartContainer.innerHTML = groupHtml;

  // Render shift chart bars
  const shiftChartContainer = document.getElementById('destajo-dashboard-shift-chart');
  let shiftHtml = '';
  const shiftKeys = Object.keys(shiftDistribution);
  if (shiftKeys.length === 0) {
    shiftHtml = '<p style="color: var(--text-muted); text-align: center;">Sin registros de producción.</p>';
  } else {
    shiftKeys.forEach(k => {
      const pct = totalValue > 0 ? (shiftDistribution[k] / totalValue) * 100 : 0;
      shiftHtml += `
        <div style="margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
            <span>${k}</span>
            <strong>$${shiftDistribution[k].toFixed(2)} (${pct.toFixed(1)}%)</strong>
          </div>
          <div style="background: rgba(255,255,255,0.05); height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: var(--success); width: ${pct}%; height: 100%;"></div>
          </div>
        </div>
      `;
    });
  }
  shiftChartContainer.innerHTML = shiftHtml;

  // Render inconsistencies
  const incContainer = document.getElementById('destajo-dashboard-inconsistencies');
  const inconsistencies = [];

  const rawLogs = destajoData.production.filter(l => l.payrollPeriodId === Number(periodId));

  rawLogs.forEach(log => {
    const parts = log.participants || [];
    const abs = log.absent || [];
    const vact = log.vacation || [];
    const shift = destajoData.shifts.find(s => s.id === Number(log.shiftId)) || { name: 'Normal' };
    const isSpecial = shift.name.toLowerCase().includes('suplementaria') || shift.name.toLowerCase().includes('extraordinaria');
    const day = (log.dayOfWeek || '').toLowerCase();

    if (log.status === 'voided') return;

    if (isSpecial && parts.length === 0) {
      inconsistencies.push(`[Error] Registro del ${log.date} (${shift.name}) no contiene personal participante asignado.`);
    }

    const duplicates = parts.filter(id => abs.includes(id));
    if (duplicates.length > 0) {
      inconsistencies.push(`[Conflicto] Colaboradores en registro del ${log.date} aparecen como participantes y ausentes al mismo tiempo.`);
    }

    const vacationParts = parts.filter(id => vact.includes(id));
    if (vacationParts.length > 0) {
      inconsistencies.push(`[Alerta Vacaciones] Colaboradores de vacaciones registrados como participantes el ${log.date}.`);
    }

    if ((day.includes('sáb') || day.includes('dom')) && !shift.name.toLowerCase().includes('extraordinaria')) {
      inconsistencies.push(`[Alerta Jornada] El día ${log.date} es fin de semana pero la jornada registrada es ${shift.name} (debería ser Extraordinaria).`);
    }

    if (log.status === 'pending') {
      inconsistencies.push(`[Pendiente] Registro del ${log.date} (Grupo ${log.groupId}) se encuentra pendiente de aprobación por el Administrador.`);
    }
  });

  if (inconsistencies.length === 0) {
    incContainer.innerHTML = '<p style="color: var(--success); font-weight: 500; font-size: 13px;">✓ Todo en orden. No se registran novedades de nómina.</p>';
  } else {
    incContainer.innerHTML = inconsistencies.map(inc => `
      <div style="font-size: 12.5px; padding: 6px 10px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 4px; color: #fecaca;">
        ⚠️ ${inc}
      </div>
    `).join('');
  }
}

// 2. DAILY PRODUCTION TAB
function loadDestajoProductionTab() {
  const periodSelect = document.getElementById('destajo-prod-period');
  if (destajoData.periods.length > 0 && !periodSelect.value) {
    periodSelect.value = destajoData.periods[0].id;
  }

  // Populate lists
  renderDestajoProductionList();
}

function handleDestajoDateChange() {
  const dateVal = document.getElementById('destajo-prod-date').value;
  if (!dateVal) {
    document.getElementById('destajo-prod-day').value = '';
    return;
  }
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const d = new Date(dateVal + 'T00:00:00');
  const dayName = days[d.getDay()];
  document.getElementById('destajo-prod-day').value = dayName;

  // Auto suggest shift factor
  if (d.getDay() === 0 || d.getDay() === 6) {
    const extraShift = destajoData.shifts.find(s => s.name.toLowerCase().includes('extraordinaria'));
    if (extraShift) {
      document.getElementById('destajo-prod-shift').value = extraShift.id;
    }
  } else {
    const normShift = destajoData.shifts.find(s => s.name.toLowerCase().includes('normal'));
    if (normShift) {
      document.getElementById('destajo-prod-shift').value = normShift.id;
    }
  }
}

function handleDestajoGroupChange() {
  const groupId = document.getElementById('destajo-prod-group').value;
  const membersContainer = document.getElementById('destajo-prod-members-container');
  const supportsContainer = document.getElementById('destajo-prod-supports-container');
  const listEl = document.getElementById('destajo-prod-members-list');
  const supportListEl = document.getElementById('destajo-prod-supports-list');

  if (!groupId) {
    membersContainer.style.display = 'none';
    supportsContainer.style.display = 'none';
    return;
  }

  membersContainer.style.display = 'block';
  supportsContainer.style.display = 'block';

  // Group members
  const members = destajoData.collaborators.filter(c => c.groupId === Number(groupId) && c.isActive);
  listEl.innerHTML = members.map(m => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.03);">
      <span style="font-size: 13px;">${m.fullName}</span>
      <div style="display: flex; gap: 0.25rem;">
        <button type="button" class="btn btn-sm btn-secondary" style="padding: 2px 6px; font-size: 10px;" id="btn-part-${m.id}" onclick="toggleDestajoFormList(${m.id}, 'participants')">Part</button>
        <button type="button" class="btn btn-sm btn-secondary" style="padding: 2px 6px; font-size: 10px;" id="btn-abs-${m.id}" onclick="toggleDestajoFormList(${m.id}, 'absent')">Aus</button>
        <button type="button" class="btn btn-sm btn-secondary" style="padding: 2px 6px; font-size: 10px;" id="btn-perm-${m.id}" onclick="toggleDestajoFormList(${m.id}, 'permitted')">Perm</button>
        <button type="button" class="btn btn-sm btn-secondary" style="padding: 2px 6px; font-size: 10px;" id="btn-vac-${m.id}" onclick="toggleDestajoFormList(${m.id}, 'vacation')">Vac</button>
      </div>
    </div>
  `).join('');

  // Support list
  const nonMembers = destajoData.collaborators.filter(c => c.groupId !== Number(groupId) && c.isActive);
  supportListEl.innerHTML = nonMembers.map(m => `
    <label style="display: flex; alignItems: center; gap: 0.5rem; font-size: 12px; cursor: pointer; margin-bottom: 4px;">
      <input type="checkbox" id="chk-support-${m.id}" onchange="toggleDestajoFormSupport(${m.id})">
      ${m.fullName} (Grupo ${m.groupId || 'Sin grupo'})
    </label>
  `).join('');

  // Reset selected lists
  destajoFormParticipants = [];
  destajoFormAbsent = [];
  destajoFormPermitted = [];
  destajoFormVacation = [];
  destajoFormSupport = [];
}

let destajoFormParticipants = [];
let destajoFormAbsent = [];
let destajoFormPermitted = [];
let destajoFormVacation = [];
let destajoFormSupport = [];

function toggleDestajoFormList(cId, listType) {
  // Clear other statuses for this collaborator
  const lists = ['participants', 'absent', 'permitted', 'vacation'];
  lists.forEach(l => {
    let arr = l === 'participants' ? destajoFormParticipants :
              l === 'absent' ? destajoFormAbsent :
              l === 'permitted' ? destajoFormPermitted : destajoFormVacation;
    
    const idx = arr.indexOf(cId);
    if (idx > -1) {
      arr.splice(idx, 1);
    }
  });

  // Toggle active
  if (listType === 'participants') destajoFormParticipants.push(cId);
  else if (listType === 'absent') destajoFormAbsent.push(cId);
  else if (listType === 'permitted') destajoFormPermitted.push(cId);
  else if (listType === 'vacation') destajoFormVacation.push(cId);

  // Redraw button styles
  const statuses = ['part', 'abs', 'perm', 'vac'];
  statuses.forEach(s => {
    const btn = document.getElementById(`btn-${s}-${cId}`);
    if (btn) btn.className = 'btn btn-sm btn-secondary';
  });

  if (destajoFormParticipants.includes(cId)) document.getElementById(`btn-part-${cId}`).className = 'btn btn-sm btn-primary';
  if (destajoFormAbsent.includes(cId)) document.getElementById(`btn-abs-${cId}`).className = 'btn btn-sm btn-danger-solid';
  if (destajoFormPermitted.includes(cId)) document.getElementById(`btn-perm-${cId}`).className = 'btn btn-sm btn-warning-solid';
  if (destajoFormVacation.includes(cId)) document.getElementById(`btn-vac-${cId}`).className = 'btn btn-sm btn-secondary-solid';
}

function toggleDestajoFormSupport(cId) {
  const idx = destajoFormSupport.indexOf(cId);
  if (idx > -1) destajoFormSupport.splice(idx, 1);
  else destajoFormSupport.push(cId);
}

function renderDestajoProductionList() {
  const periodId = document.getElementById('destajo-prod-period').value;
  const listEl = document.getElementById('destajo-production-list');
  if (!periodId) {
    listEl.innerHTML = '<p>Seleccione un corte de nómina válido para ver la bitácora.</p>';
    return;
  }

  const logs = destajoData.production.filter(l => l.payrollPeriodId === Number(periodId));

  listEl.innerHTML = logs.map(l => {
    const group = destajoData.groups.find(g => g.id === Number(l.groupId)) || { name: `Grupo ${l.groupId}` };
    const shift = destajoData.shifts.find(s => s.id === Number(l.shiftId)) || { name: 'Normal', factor: 1.0 };
    const sortedRates = [...destajoData.rates].sort((a,b) => b.effectiveDate.localeCompare(a.effectiveDate));
    const rate = sortedRates.find(r => r.effectiveDate <= l.date) || { simpleRate: 0.05, mixRate: 0.09 };

    const totalVal = ((l.sacosSimples * rate.simpleRate) + (l.sacosMezclas * rate.mixRate)) * shift.factor;
    const badgeColor = l.status === 'approved' ? 'var(--success)' : l.status === 'voided' ? 'var(--danger)' : 'var(--primary)';

    return `
      <div class="card" style="margin-bottom: 0; padding: 12px; border-left: 3px solid ${badgeColor}; ${l.status === 'voided' ? 'opacity: 0.65;' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 11px; color: var(--text-muted);">${l.date} - ${l.dayOfWeek}</span>
          <span class="badge" style="background: rgba(255,255,255,0.05); color: ${badgeColor}; font-size: 10px;">${l.status.toUpperCase()}</span>
        </div>
        <p style="font-size: 14px; font-weight: bold; margin: 0;">${group.name} - ${shift.name} (${shift.factor}x)</p>
        <p style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">${l.description || 'Sin descripción'}</p>
        <div style="display: flex; gap: 1rem; font-size: 12.5px; margin-top: 6px;">
          <span>Simples: <strong>${l.sacosSimples}</strong></span>
          <span>Mezclas: <strong>${l.sacosMezclas}</strong></span>
          <span style="color: var(--success); font-weight: bold;">Total: $${totalVal.toFixed(2)}</span>
        </div>
        ${l.status === 'voided' ? `<p style="font-size: 11px; color: var(--danger); margin-top: 4px;"><strong>Motivo:</strong> ${l.voidReason}</p>` : ''}

        <div style="display: flex; gap: 0.5rem; margin-top: 8px; border-top: 1px dashed var(--border-color); padding-top: 6px;">
          ${l.status === 'pending' ? `
            <button type="button" class="btn btn-sm btn-secondary" style="padding: 2px 6px; font-size: 11px;" onclick="editDestajoProduction(${l.id})">Editar</button>
            ${currentUser.role === 'admin' ? `
              <button type="button" class="btn btn-sm btn-success-solid" style="padding: 2px 6px; font-size: 11px;" onclick="approveDestajoProduction(${l.id})">Aprobar</button>
            ` : ''}
          ` : ''}
          ${l.status !== 'voided' ? `
            <button type="button" class="btn btn-sm btn-danger-solid" style="padding: 2px 6px; font-size: 11px;" onclick="voidDestajoProduction(${l.id})">Anular</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('') || '<p style="color: var(--text-muted); text-align: center;">No hay registros para este período.</p>';
}

async function saveDestajoProduction(e) {
  e.preventDefault();
  const periodId = document.getElementById('destajo-prod-period').value;
  const date = document.getElementById('destajo-prod-date').value;
  const day = document.getElementById('destajo-prod-day').value;
  const groupId = document.getElementById('destajo-prod-group').value;
  const shiftId = document.getElementById('destajo-prod-shift').value;
  const simples = Number(document.getElementById('destajo-prod-simples').value || 0);
  const mezclas = Number(document.getElementById('destajo-prod-mezclas').value || 0);
  const desc = document.getElementById('destajo-prod-desc').value;
  const warehouse = document.getElementById('destajo-prod-warehouse').value;
  const obs = document.getElementById('destajo-prod-obs').value;

  if (simples === 0 && mezclas === 0) {
    alert('Debes registrar producción de sacos simples o mezclas (no pueden ser ambos 0).');
    return;
  }

  // Shift validations
  const shiftObj = destajoData.shifts.find(s => s.id === Number(shiftId));
  const isSpecial = shiftObj && (shiftObj.name.toLowerCase().includes('suplementaria') || shiftObj.name.toLowerCase().includes('extraordinaria'));
  if (isSpecial && destajoFormParticipants.length === 0) {
    alert('Las jornadas suplementarias y extraordinarias exigen la selección manual de al menos un participante.');
    return;
  }

  // Conflict lists check
  const conflicts = destajoFormParticipants.filter(id => destajoFormAbsent.includes(id) || destajoFormPermitted.includes(id) || destajoFormVacation.includes(id));
  if (conflicts.length > 0) {
    alert('Un colaborador no puede participar y estar ausente, con permiso o vacaciones al mismo tiempo.');
    return;
  }

  const payload = {
    payrollPeriodId: Number(periodId),
    date,
    dayOfWeek: day,
    groupId: Number(groupId),
    shiftId: Number(shiftId),
    sacosSimples: simples,
    sacosMezclas: mezclas,
    description: desc,
    warehouse,
    participants: destajoFormParticipants,
    absent: destajoFormAbsent,
    permitted: destajoFormPermitted,
    vacation: destajoFormVacation,
    support: destajoFormSupport,
    observation: obs
  };

  showLoader('Guardando registro...');
  try {
    if (editingProductionId) {
      payload.id = editingProductionId;
      await apiFetch('/api/destajo/save', {
        method: 'POST',
        body: { type: 'production', action: 'update', payload }
      });
    } else {
      await apiFetch('/api/destajo/save', {
        method: 'POST',
        body: { type: 'production', action: 'create', payload }
      });
    }
    resetDestajoProdForm();
    await fetchDestajoData();
    renderDestajoProductionList();
    alert('Registro guardado exitosamente.');
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

function resetDestajoProdForm() {
  editingProductionId = null;
  document.getElementById('destajo-form-title').textContent = 'Registrar Producción Diaria';
  document.getElementById('destajo-prod-id').value = '';
  document.getElementById('destajo-prod-date').value = '';
  document.getElementById('destajo-prod-day').value = '';
  document.getElementById('destajo-prod-group').value = '';
  document.getElementById('destajo-prod-shift').value = '';
  document.getElementById('destajo-prod-simples').value = '0';
  document.getElementById('destajo-prod-mezclas').value = '0';
  document.getElementById('destajo-prod-desc').value = '';
  document.getElementById('destajo-prod-obs').value = '';
  document.getElementById('destajo-prod-members-container').style.display = 'none';
  document.getElementById('destajo-prod-supports-container').style.display = 'none';
  document.getElementById('btn-destajo-prod-cancel').style.display = 'none';

  destajoFormParticipants = [];
  destajoFormAbsent = [];
  destajoFormPermitted = [];
  destajoFormVacation = [];
  destajoFormSupport = [];
}

function editDestajoProduction(id) {
  const log = destajoData.production.find(l => l.id === id);
  if (!log) return;

  editingProductionId = log.id;
  document.getElementById('destajo-form-title').textContent = 'Editar Registro Diario';
  document.getElementById('destajo-prod-id').value = log.id;
  document.getElementById('destajo-prod-date').value = log.date;
  document.getElementById('destajo-prod-day').value = log.dayOfWeek;
  document.getElementById('destajo-prod-group').value = log.groupId;
  
  handleDestajoGroupChange(); // Populate member UI
  
  document.getElementById('destajo-prod-shift').value = log.shiftId;
  document.getElementById('destajo-prod-simples').value = log.sacosSimples;
  document.getElementById('destajo-prod-mezclas').value = log.sacosMezclas;
  document.getElementById('destajo-prod-desc').value = log.description;
  document.getElementById('destajo-prod-warehouse').value = log.warehouse || 'Planta';
  document.getElementById('destajo-prod-obs').value = log.observation;
  document.getElementById('btn-destajo-prod-cancel').style.display = 'inline-block';

  // Apply lists
  destajoFormParticipants = [...(log.participants || [])];
  destajoFormAbsent = [...(log.absent || [])];
  destajoFormPermitted = [...(log.permitted || [])];
  destajoFormVacation = [...(log.vacation || [])];
  destajoFormSupport = [...(log.support || [])];

  // Set buttons UI
  destajoFormParticipants.forEach(cId => toggleDestajoFormList(cId, 'participants'));
  destajoFormAbsent.forEach(cId => toggleDestajoFormList(cId, 'absent'));
  destajoFormPermitted.forEach(cId => toggleDestajoFormList(cId, 'permitted'));
  destajoFormVacation.forEach(cId => toggleDestajoFormList(cId, 'vacation'));
  destajoFormSupport.forEach(cId => {
    const chk = document.getElementById(`chk-support-${cId}`);
    if (chk) chk.checked = true;
  });
}

async function approveDestajoProduction(id) {
  if (!confirm('¿Está seguro de aprobar este registro de producción?')) return;
  showLoader('Aprobando...');
  try {
    await apiFetch('/api/destajo/save', {
      method: 'POST',
      body: { type: 'production', action: 'approve', payload: { id } }
    });
    await fetchDestajoData();
    renderDestajoProductionList();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

async function voidDestajoProduction(id) {
  const reason = prompt('Ingrese el motivo de la anulación:');
  if (!reason) return;
  showLoader('Anulando...');
  try {
    await apiFetch('/api/destajo/save', {
      method: 'POST',
      body: { type: 'production', action: 'void', payload: { id, voidReason: reason } }
    });
    await fetchDestajoData();
    renderDestajoProductionList();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

// 3. PERIODS TAB
function renderDestajoPeriods() {
  const tbody = document.getElementById('destajo-periods-tbody');
  tbody.innerHTML = destajoData.periods.map(p => `
    <tr>
      <td>${p.startDate}</td>
      <td>${p.endDate}</td>
      <td>
        <span class="badge" style="background: rgba(255,255,255,0.05); color: ${p.status === 'closed' ? 'var(--danger)' : p.status === 'approved' ? 'var(--success)' : 'var(--primary)'}; font-size: 11px;">
          ${p.status.toUpperCase()}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 0.25rem;">
          ${p.status === 'open' ? `
            <button class="btn btn-sm btn-secondary" onclick="updateDestajoPeriodStatus(${p.id}, 'reviewing')">Revisión</button>
          ` : ''}
          ${p.status === 'reviewing' ? `
            <button class="btn btn-sm btn-success-solid" onclick="updateDestajoPeriodStatus(${p.id}, 'approved')">Aprobar</button>
            <button class="btn btn-sm btn-secondary" onclick="updateDestajoPeriodStatus(${p.id}, 'open')">Abrir</button>
          ` : ''}
          ${p.status === 'approved' && currentUser.role === 'admin' ? `
            <button class="btn btn-sm btn-danger-solid" onclick="updateDestajoPeriodStatus(${p.id}, 'closed')">Cerrar</button>
          ` : ''}
          ${p.status === 'closed' ? '<span style="font-size: 12px; color: var(--text-muted);">Cerrado</span>' : ''}
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align: center;">No hay cortes de nómina creados.</td></tr>';
}

async function saveDestajoPeriod(e) {
  e.preventDefault();
  const start = document.getElementById('destajo-period-start').value;
  const end = document.getElementById('destajo-period-end').value;

  showLoader('Guardando período...');
  try {
    await apiFetch('/api/destajo/save', {
      method: 'POST',
      body: { type: 'period', action: 'create', payload: { startDate: start, endDate: end } }
    });
    document.getElementById('destajo-period-start').value = '';
    document.getElementById('destajo-period-end').value = '';
    await fetchDestajoData();
    populateDestajoPeriodDropdowns();
    renderDestajoPeriods();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

async function updateDestajoPeriodStatus(pId, newStatus) {
  showLoader('Actualizando...');
  try {
    await apiFetch('/api/destajo/save', {
      method: 'POST',
      body: { type: 'period', action: 'update_status', payload: { id: pId, status: newStatus } }
    });
    await fetchDestajoData();
    populateDestajoPeriodDropdowns();
    renderDestajoPeriods();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

// 4. COLLABORATORS & GROUPS TAB
function renderDestajoCollaboratorsAndGroups() {
  // Collaborators
  const cTbody = document.getElementById('destajo-collaborators-tbody');
  cTbody.innerHTML = destajoData.collaborators.map(c => `
    <tr>
      <td><strong>${c.fullName}</strong></td>
      <td>${c.idCard}</td>
      <td>${c.groupId ? `Grupo ${c.groupId}` : 'Sin Grupo'}</td>
      <td><span class="badge" style="color: ${c.isActive ? 'var(--success)' : 'var(--danger)'};">${c.isActive ? 'Activo' : 'Inactivo'}</span></td>
      <td><span class="badge" style="color: ${c.appliesPiecework ? 'var(--primary)' : 'var(--warning)'};">${c.appliesPiecework ? 'Aplica' : 'No Aplica'}</span></td>
      <td>
        <button class="btn btn-sm btn-secondary" style="padding: 2px 6px;" onclick="editDestajoCollaborator(${c.id})">Editar</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align: center;">No hay colaboradores registrados.</td></tr>';

  // Groups
  const gTbody = document.getElementById('destajo-groups-tbody');
  gTbody.innerHTML = destajoData.groups.map(g => `
    <tr>
      <td><strong>Grupo ${g.id}</strong></td>
      <td>${g.name}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewDestajoGroupHistory(${g.id})">Ver Historial</button>
      </td>
      <td>
        <button class="btn btn-sm btn-secondary" style="padding: 2px 6px;" onclick="editDestajoGroup(${g.id}, '${g.name}')">Editar</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align: center;">No hay grupos de trabajo creados.</td></tr>';
}

async function saveDestajoCollaborator(e) {
  e.preventDefault();
  const name = document.getElementById('destajo-collab-name').value;
  const card = document.getElementById('destajo-collab-card').value;
  const groupId = document.getElementById('destajo-collab-group').value;
  const start = document.getElementById('destajo-collab-start').value;
  const end = document.getElementById('destajo-collab-end').value;
  const active = document.getElementById('destajo-collab-active').checked;
  const piecework = document.getElementById('destajo-collab-piecework').checked;
  const notes = document.getElementById('destajo-collab-notes').value;

  const payload = {
    fullName: name,
    idCard: card,
    groupId: groupId ? Number(groupId) : null,
    dateFrom: start,
    dateTo: end || null,
    isActive: active,
    appliesPiecework: piecework,
    notes
  };

  showLoader('Guardando colaborador...');
  try {
    if (editingCollaboratorId) {
      payload.id = editingCollaboratorId;
      await apiFetch('/api/destajo/save', {
        method: 'POST',
        body: { type: 'collaborator', action: 'update', payload }
      });
    } else {
      await apiFetch('/api/destajo/save', {
        method: 'POST',
        body: { type: 'collaborator', action: 'create', payload }
      });
    }
    resetDestajoCollabForm();
    await fetchDestajoData();
    renderDestajoCollaboratorsAndGroups();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

function resetDestajoCollabForm() {
  editingCollaboratorId = null;
  document.getElementById('destajo-collab-form-title').textContent = 'Agregar Colaborador';
  document.getElementById('destajo-collab-id').value = '';
  document.getElementById('destajo-collab-name').value = '';
  document.getElementById('destajo-collab-card').value = '';
  document.getElementById('destajo-collab-group').value = '';
  document.getElementById('destajo-collab-start').value = '';
  document.getElementById('destajo-collab-end').value = '';
  document.getElementById('destajo-collab-active').checked = true;
  document.getElementById('destajo-collab-piecework').checked = true;
  document.getElementById('destajo-collab-notes').value = '';
  document.getElementById('btn-destajo-collab-cancel').style.display = 'none';
}

function editDestajoCollaborator(id) {
  const c = destajoData.collaborators.find(x => x.id === id);
  if (!c) return;

  editingCollaboratorId = c.id;
  document.getElementById('destajo-collab-form-title').textContent = 'Editar Colaborador';
  document.getElementById('destajo-collab-id').value = c.id;
  document.getElementById('destajo-collab-name').value = c.fullName;
  document.getElementById('destajo-collab-card').value = c.idCard;
  document.getElementById('destajo-collab-group').value = c.groupId || '';
  document.getElementById('destajo-collab-start').value = c.dateFrom;
  document.getElementById('destajo-collab-end').value = c.dateTo || '';
  document.getElementById('destajo-collab-active').checked = !!c.isActive;
  document.getElementById('destajo-collab-piecework').checked = !!c.appliesPiecework;
  document.getElementById('destajo-collab-notes').value = c.notes || '';
  document.getElementById('btn-destajo-collab-cancel').style.display = 'inline-block';
}

async function saveDestajoGroup(e) {
  e.preventDefault();
  const id = Number(document.getElementById('destajo-group-id').value);
  const name = document.getElementById('destajo-group-name').value;
  const isEdit = document.getElementById('destajo-group-edit-mode').value === 'true';

  showLoader('Guardando grupo...');
  try {
    await apiFetch('/api/destajo/save', {
      method: 'POST',
      body: { type: 'group', action: isEdit ? 'update' : 'create', payload: { id, name } }
    });
    resetDestajoGroupForm();
    await fetchDestajoData();
    populateDestajoGroupDropdowns();
    renderDestajoCollaboratorsAndGroups();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

function resetDestajoGroupForm() {
  document.getElementById('destajo-group-form-title').textContent = 'Agregar Grupo de Trabajo';
  document.getElementById('destajo-group-id').value = '';
  document.getElementById('destajo-group-id').disabled = false;
  document.getElementById('destajo-group-name').value = '';
  document.getElementById('destajo-group-edit-mode').value = 'false';
  document.getElementById('btn-destajo-group-cancel').style.display = 'none';
}

function editDestajoGroup(id, name) {
  document.getElementById('destajo-group-form-title').textContent = 'Editar Grupo';
  document.getElementById('destajo-group-id').value = id;
  document.getElementById('destajo-group-id').disabled = true;
  document.getElementById('destajo-group-name').value = name;
  document.getElementById('destajo-group-edit-mode').value = 'true';
  document.getElementById('btn-destajo-group-cancel').style.display = 'inline-block';
}

function viewDestajoGroupHistory(id) {
  const g = destajoData.groups.find(x => x.id === id);
  if (!g) return;

  const history = g.history || [];
  if (history.length === 0) {
    alert('No se registra historial de cambios de integrantes para este grupo.');
    return;
  }

  const logs = history.map(h => 
    `- ${h.changeDate}: ${h.collaboratorName} ${h.action === 'join' ? 'entró al grupo' : 'salió del grupo'}`
  ).join('\n');

  alert(`Historial de Grupo ${g.id}:\n\n${logs}`);
}

// 5. RATES & SHIFTS CONFIG
function loadRatesTabConfig() {
  const sorted = [...destajoData.rates].sort((a,b) => b.effectiveDate.localeCompare(a.effectiveDate));
  const cur = sorted[0] || { simpleRate: 0.05, mixRate: 0.09, effectiveDate: '' };
  
  document.getElementById('destajo-rate-simple').value = cur.simpleRate;
  document.getElementById('destajo-rate-mix').value = cur.mixRate;
  document.getElementById('destajo-rate-date').value = cur.effectiveDate || new Date().toISOString().substring(0,10);
}

function renderDestajoRatesAndShifts() {
  // Shifts factors
  const sTbody = document.getElementById('destajo-shifts-tbody');
  sTbody.innerHTML = destajoData.shifts.map(s => `
    <tr>
      <td><strong>${s.name}</strong></td>
      <td>${s.startTime} - ${s.endTime}</td>
      <td>${s.factor}x</td>
      <td>
        ${s.isEditable ? `
          <button class="btn btn-sm btn-secondary" onclick="editDestajoShift(${s.id}, '${s.name}', '${s.startTime}', '${s.endTime}', ${s.factor})">Editar</button>
        ` : '<span style="font-size: 11px; color: var(--text-muted);">No editable</span>'}
      </td>
    </tr>
  `).join('');

  // Rates history
  const rTbody = document.getElementById('destajo-rates-history-tbody');
  rTbody.innerHTML = destajoData.rates.map(r => `
    <tr>
      <td>${r.effectiveDate}</td>
      <td>$${r.simpleRate.toFixed(3)}</td>
      <td>$${r.mixRate.toFixed(3)}</td>
    </tr>
  `).join('');
}

async function saveDestajoRate(e) {
  e.preventDefault();
  const simple = Number(document.getElementById('destajo-rate-simple').value);
  const mix = Number(document.getElementById('destajo-rate-mix').value);
  const date = document.getElementById('destajo-rate-date').value;

  showLoader('Actualizando tarifas...');
  try {
    await apiFetch('/api/destajo/save', {
      method: 'POST',
      body: { type: 'rate', action: 'create', payload: { simpleRate: simple, mixRate: mix, effectiveDate: date } }
    });
    await fetchDestajoData();
    renderDestajoRatesAndShifts();
    alert('Tarifas base actualizadas exitosamente.');
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

async function editDestajoShift(id, name, start, end, factor) {
  const newFactor = prompt(`Actualizar factor de jornada para ${name} (Actual: ${factor}):`, factor);
  if (newFactor === null) return;
  const fNum = Number(newFactor);
  if (isNaN(fNum) || fNum <= 0) {
    alert('Factor inválido.');
    return;
  }

  showLoader('Actualizando jornada...');
  try {
    await apiFetch('/api/destajo/save', {
      method: 'POST',
      body: { type: 'shift', action: 'update', payload: { id, name, startTime: start, endTime: end, factor: fNum, isEditable: true } }
    });
    await fetchDestajoData();
    renderDestajoRatesAndShifts();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

// 6. REPORTS TAB
function switchReportSubTab(tab) {
  activeReportSubTab = tab;
  
  const subTabs = ['payroll', 'group', 'daily', 'inconsistencies'];
  subTabs.forEach(t => {
    const btn = document.getElementById(`btn-rep-type-${t}`);
    if (btn) {
      if (t === tab) btn.className = 'btn btn-sm btn-primary';
      else btn.className = 'btn btn-sm btn-secondary';
    }
  });

  loadDestajoReports();
}

function loadDestajoReports() {
  const periodId = document.getElementById('destajo-report-period').value;
  const thead = document.getElementById('destajo-report-thead');
  const tbody = document.getElementById('destajo-report-tbody');
  const title = document.getElementById('destajo-report-header-title');

  if (!periodId) {
    tbody.innerHTML = '<tr><td style="text-align: center;">Seleccione un corte de nómina válido.</td></tr>';
    return;
  }

  const logs = getDestajoCalculatedLogs(periodId);

  if (activeReportSubTab === 'payroll') {
    title.textContent = 'Reporte Resumen para Nómina';
    thead.innerHTML = `
      <tr>
        <th>Colaborador</th>
        <th>Grupo</th>
        <th>Simples</th>
        <th>Mezclas</th>
        <th>Normal</th>
        <th>Suplementario</th>
        <th>Extraordinario</th>
        <th>Total A Pagar</th>
        <th>Días Trab.</th>
        <th>Observaciones</th>
      </tr>
    `;

    // Process aggregates
    const collabMap = {};
    destajoData.collaborators.forEach(c => {
      const g = destajoData.groups.find(x => x.id === Number(c.groupId));
      collabMap[c.id] = {
        fullName: c.fullName,
        groupName: g ? g.name : 'Sin Grupo',
        appliesPiecework: !!c.appliesPiecework,
        simples: 0,
        mezclas: 0,
        normal: 0,
        suplementario: 0,
        extraordinario: 0,
        total: 0,
        daysSet: new Set(),
        absences: 0,
        permissions: 0,
        vacations: 0,
        supports: 0
      };
    });

    logs.forEach(l => {
      const parts = l.resolvedParticipants || [];
      if (parts.length === 0) return;

      const splitSimples = l.sacosSimples / parts.length;
      const splitMezclas = l.sacosMezclas / parts.length;
      const splitValue = l.calculatedValue / parts.length;

      parts.forEach(pId => {
        if (!collabMap[pId]) return;
        collabMap[pId].simples += splitSimples;
        collabMap[pId].mezclas += splitMezclas;
        collabMap[pId].total += splitValue;
        collabMap[pId].daysSet.add(l.date);

        const sName = l.shift.name.toLowerCase();
        if (sName.includes('normal')) collabMap[pId].normal += splitValue;
        else if (sName.includes('suplementaria')) collabMap[pId].suplementario += splitValue;
        else if (sName.includes('extraordinaria')) collabMap[pId].extraordinario += splitValue;
      });

      // Absences
      (l.absent || []).forEach(pId => { if (collabMap[pId]) collabMap[pId].absences++; });
      (l.permitted || []).forEach(pId => { if (collabMap[pId]) collabMap[pId].permissions++; });
      (l.vacation || []).forEach(pId => { if (collabMap[pId]) collabMap[pId].vacations++; });
      (l.support || []).forEach(pId => { if (collabMap[pId]) collabMap[pId].supports++; });
    });

    tbody.innerHTML = Object.values(collabMap).map(c => {
      const remarks = [];
      if (c.absences > 0) remarks.push(`${c.absences} faltas`);
      if (c.permissions > 0) remarks.push(`${c.permissions} permisos`);
      if (c.vacations > 0) remarks.push(`${c.vacations} vacaciones`);
      if (c.supports > 0) remarks.push(`${c.supports} apoyos`);

      const toPay = c.appliesPiecework ? c.total : 0;
      const normalPay = c.appliesPiecework ? c.normal : 0;
      const supPay = c.appliesPiecework ? c.suplementario : 0;
      const extPay = c.appliesPiecework ? c.extraordinario : 0;

      return `
        <tr>
          <td><strong>${c.fullName}</strong></td>
          <td>${c.groupName}</td>
          <td>${Math.round(c.simples)}</td>
          <td>${Math.round(c.mezclas)}</td>
          <td>$${normalPay.toFixed(2)}</td>
          <td>$${supPay.toFixed(2)}</td>
          <td>$${extPay.toFixed(2)}</td>
          <td style="color: var(--success); font-weight: bold;">$${toPay.toFixed(2)}</td>
          <td>${c.daysSet.size}</td>
          <td><span style="font-size: 11px; color: var(--text-muted);">${remarks.join(', ') || 'Sin novedades'}</span></td>
        </tr>
      `;
    }).join('');

  } 
  
  else if (activeReportSubTab === 'group') {
    title.textContent = 'Reporte Resumen por Grupo';
    thead.innerHTML = `
      <tr>
        <th>Grupo</th>
        <th>Total Simples</th>
        <th>Total Mezclas</th>
        <th>Total Sacos</th>
        <th>Valor Normal</th>
        <th>Valor Suplementario</th>
        <th>Valor Extraordinario</th>
        <th>Total General</th>
      </tr>
    `;

    const groupMap = {};
    destajoData.groups.forEach(g => {
      groupMap[g.id] = {
        name: g.name,
        simples: 0,
        mezclas: 0,
        normal: 0,
        suplementario: 0,
        extraordinario: 0,
        total: 0
      };
    });

    logs.forEach(l => {
      const gId = l.groupId;
      if (!groupMap[gId]) return;

      groupMap[gId].simples += l.sacosSimples;
      groupMap[gId].mezclas += l.sacosMezclas;
      groupMap[gId].total += l.calculatedValue;

      const sName = l.shift.name.toLowerCase();
      if (sName.includes('normal')) groupMap[gId].normal += l.calculatedValue;
      else if (sName.includes('suplementaria')) groupMap[gId].suplementario += l.calculatedValue;
      else if (sName.includes('extraordinaria')) groupMap[gId].extraordinario += l.calculatedValue;
    });

    tbody.innerHTML = Object.keys(groupMap).map(id => {
      const g = groupMap[id];
      return `
        <tr>
          <td><strong>Grupo ${id} - ${g.name}</strong></td>
          <td>${g.simples.toLocaleString()}</td>
          <td>${g.mezclas.toLocaleString()}</td>
          <td><strong>${(g.simples + g.mezclas).toLocaleString()}</strong></td>
          <td>$${g.normal.toFixed(2)}</td>
          <td>$${g.suplementario.toFixed(2)}</td>
          <td>$${g.extraordinario.toFixed(2)}</td>
          <td style="color: var(--success); font-weight: bold;">$${g.total.toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  } 
  
  else if (activeReportSubTab === 'daily') {
    title.textContent = 'Bitácora de Detalle Diario';
    thead.innerHTML = `
      <tr>
        <th>Día</th>
        <th>Fecha</th>
        <th>Descripción</th>
        <th>Grupo</th>
        <th>Jornada</th>
        <th>Simples</th>
        <th>Mezclas</th>
        <th>Participantes</th>
        <th>Valor Calculado</th>
      </tr>
    `;

    tbody.innerHTML = logs.map(l => {
      const groupName = destajoData.groups.find(g => g.id === Number(l.groupId))?.name || `Grupo ${l.groupId}`;
      const partNames = (l.resolvedParticipants || []).map(id => destajoData.collaborators.find(x => x.id === id)?.fullName || id).join(', ');

      return `
        <tr>
          <td>${l.dayOfWeek}</td>
          <td>${l.date}</td>
          <td>${l.description || '-'}</td>
          <td>${groupName}</td>
          <td>${l.shift.name}</td>
          <td>${l.sacosSimples}</td>
          <td>${l.sacosMezclas}</td>
          <td><span style="font-size: 11px; display: block; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${partNames}">${partNames}</span></td>
          <td style="font-weight: bold;">$${l.calculatedValue.toFixed(2)}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="9" style="text-align: center;">Sin registros de producción.</td></tr>';
  } 
  
  else if (activeReportSubTab === 'inconsistencies') {
    title.textContent = 'Reporte de Inconsistencias de Nómina';
    thead.innerHTML = `
      <tr>
        <th>Fecha</th>
        <th>Grupo</th>
        <th>Tipo Error</th>
        <th>Detalle</th>
      </tr>
    `;

    const inconsistencies = [];
    logs.forEach(log => {
      const parts = log.participants || [];
      const abs = log.absent || [];
      const vact = log.vacation || [];
      const shift = log.shift;
      const isSpecial = shift.name.toLowerCase().includes('suplementaria') || shift.name.toLowerCase().includes('extraordinaria');
      const day = (log.dayOfWeek || '').toLowerCase();
      const groupName = destajoData.groups.find(g => g.id === Number(log.groupId))?.name || `Grupo ${log.groupId}`;

      if (isSpecial && parts.length === 0) {
        inconsistencies.push({ date: log.date, group: groupName, type: 'Sin Participantes', detail: 'La jornada especial no tiene asignado personal participante manual.' });
      }

      const duplicates = parts.filter(id => abs.includes(id));
      if (duplicates.length > 0) {
        const names = duplicates.map(id => destajoData.collaborators.find(x => x.id === id)?.fullName || id).join(', ');
        inconsistencies.push({ date: log.date, group: groupName, type: 'Lista Duplicada', detail: `Los colaboradores [${names}] aparecen como PARTICIPANTE y AUSENTE a la vez.` });
      }

      const vacationParts = parts.filter(id => vact.includes(id));
      if (vacationParts.length > 0) {
        const names = vacationParts.map(id => destajoData.collaborators.find(x => x.id === id)?.fullName || id).join(', ');
        inconsistencies.push({ date: log.date, group: groupName, type: 'Conflicto Vacaciones', detail: `Integrantes de vacaciones [${names}] registrados en la labor.` });
      }

      if ((day.includes('sáb') || day.includes('dom')) && !shift.name.toLowerCase().includes('extraordinaria')) {
        inconsistencies.push({ date: log.date, group: groupName, type: 'Jornada Incorrecta', detail: `Día de fin de semana registrado con jornada ${shift.name} (debe ser Extraordinaria).` });
      }

      if (log.status === 'pending') {
        inconsistencies.push({ date: log.date, group: groupName, type: 'Pendiente Aprobación', detail: 'El registro no ha sido aprobado por el administrador.' });
      }
    });

    tbody.innerHTML = inconsistencies.map(inc => `
      <tr style="background: rgba(239, 68, 68, 0.02);">
        <td>${inc.date}</td>
        <td>${inc.group}</td>
        <td><span class="badge" style="color: var(--danger); background: rgba(239, 68, 68, 0.05);">${inc.type}</span></td>
        <td>${inc.detail}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align: center; color: var(--success);">✓ No se registran inconsistencias en este corte.</td></tr>';
  }
}

// EXPORT TO MULTI-SHEET EXCEL (SHEETJS)
function exportDestajoExcel() {
  const periodId = document.getElementById('destajo-report-period').value;
  if (!periodId) return;

  const logs = getDestajoCalculatedLogs(periodId);
  const wb = XLSX.utils.book_new();

  // 1. Resumen Nómina Sheet
  const collabMap = {};
  destajoData.collaborators.forEach(c => {
    const g = destajoData.groups.find(x => x.id === Number(c.groupId));
    collabMap[c.id] = {
      'Colaborador': c.fullName,
      'Grupo': g ? g.name : 'Sin Grupo',
      'Aplica Destajo': c.appliesPiecework ? 'SI' : 'NO',
      'Sacos Simples': 0,
      'Sacos Mezclas': 0,
      'Valor Normal': 0,
      'Valor Suplementario': 0,
      'Valor Extraordinario': 0,
      'Total a Pagar ($)': 0,
      'Días Trabajados': 0,
      'daysSet': new Set(),
      'absences': 0,
      'permissions': 0,
      'vacations': 0,
      'supports': 0
    };
  });

  logs.forEach(l => {
    const parts = l.resolvedParticipants || [];
    if (parts.length === 0) return;

    const splitSimples = l.sacosSimples / parts.length;
    const splitMezclas = l.sacosMezclas / parts.length;
    const splitValue = l.calculatedValue / parts.length;

    parts.forEach(pId => {
      if (!collabMap[pId]) return;
      collabMap[pId]['Sacos Simples'] += splitSimples;
      collabMap[pId]['Sacos Mezclas'] += splitMezclas;
      collabMap[pId]['Total a Pagar ($)'] += splitValue;
      collabMap[pId].daysSet.add(l.date);

      const sName = l.shift.name.toLowerCase();
      if (sName.includes('normal')) collabMap[pId]['Valor Normal'] += splitValue;
      else if (sName.includes('suplementaria')) collabMap[pId]['Valor Suplementario'] += splitValue;
      else if (sName.includes('extraordinaria')) collabMap[pId]['Valor Extraordinario'] += splitValue;
    });

    (l.absent || []).forEach(pId => { if (collabMap[pId]) collabMap[pId].absences++; });
    (l.permitted || []).forEach(pId => { if (collabMap[pId]) collabMap[pId].permissions++; });
    (l.vacation || []).forEach(pId => { if (collabMap[pId]) collabMap[pId].vacations++; });
    (l.support || []).forEach(pId => { if (collabMap[pId]) collabMap[pId].supports++; });
  });

  const payrollRows = Object.values(collabMap).map(c => {
    const remarks = [];
    if (c.absences > 0) remarks.push(`${c.absences} faltas`);
    if (c.permissions > 0) remarks.push(`${c.permissions} permisos`);
    if (c.vacations > 0) remarks.push(`${c.vacations} vacaciones`);
    if (c.supports > 0) remarks.push(`${c.supports} apoyos`);

    const paysPiece = c['Aplica Destajo'] === 'SI';

    return {
      'Colaborador': c['Colaborador'],
      'Grupo': c['Grupo'],
      'Sacos Simples': Math.round(c['Sacos Simples']),
      'Sacos Mezclas': Math.round(c['Sacos Mezclas']),
      'Valor Normal ($)': paysPiece ? Number(c['Valor Normal'].toFixed(2)) : 0,
      'Valor Suplementario ($)': paysPiece ? Number(c['Valor Suplementario'].toFixed(2)) : 0,
      'Valor Extraordinario ($)': paysPiece ? Number(c['Valor Extraordinario'].toFixed(2)) : 0,
      'Total a Pagar ($)': paysPiece ? Number(c['Total a Pagar ($)'].toFixed(2)) : 0,
      'Días Trabajados': c.daysSet.size,
      'Observaciones': remarks.join(', ') || 'Sin novedades'
    };
  });

  const wsPayroll = XLSX.utils.json_to_sheet(payrollRows);
  XLSX.utils.book_append_sheet(wb, wsPayroll, 'Resumen Nómina');

  // 2. Resumen Grupo Sheet
  const groupMap = {};
  destajoData.groups.forEach(g => {
    groupMap[g.id] = {
      'Grupo': `Grupo ${g.id} - ${g.name}`,
      'Sacos Simples': 0,
      'Sacos Mezclas': 0,
      'Total Sacos': 0,
      'Valor Normal ($)': 0,
      'Valor Suplementario ($)': 0,
      'Valor Extraordinario ($)': 0,
      'Total General ($)': 0
    };
  });

  logs.forEach(l => {
    const gId = l.groupId;
    if (!groupMap[gId]) return;

    groupMap[gId]['Sacos Simples'] += l.sacosSimples;
    groupMap[gId]['Sacos Mezclas'] += l.sacosMezclas;
    groupMap[gId]['Total Sacos'] += (l.sacosSimples + l.sacosMezclas);
    groupMap[gId]['Total General ($)'] += l.calculatedValue;

    const sName = l.shift.name.toLowerCase();
    if (sName.includes('normal')) groupMap[gId]['Valor Normal ($)'] += l.calculatedValue;
    else if (sName.includes('suplementaria')) groupMap[gId]['Valor Suplementario ($)'] += l.calculatedValue;
    else if (sName.includes('extraordinaria')) groupMap[gId]['Valor Extraordinario ($)'] += l.calculatedValue;
  });

  const groupRows = Object.values(groupMap).map(g => ({
    ...g,
    'Valor Normal ($)': Number(g['Valor Normal ($)'].toFixed(2)),
    'Valor Suplementario ($)': Number(g['Valor Suplementario ($)'].toFixed(2)),
    'Valor Extraordinario ($)': Number(g['Valor Extraordinario ($)'].toFixed(2)),
    'Total General ($)': Number(g['Total General ($)'].toFixed(2))
  }));

  const wsGroups = XLSX.utils.json_to_sheet(groupRows);
  XLSX.utils.book_append_sheet(wb, wsGroups, 'Resumen por Grupo');

  // 3. Detalle Diario Sheet
  const dailyRows = logs.map(l => {
    const groupName = destajoData.groups.find(g => g.id === Number(l.groupId))?.name || `Grupo ${l.groupId}`;
    const partNames = (l.resolvedParticipants || []).map(id => destajoData.collaborators.find(x => x.id === id)?.fullName || id).join(', ');

    return {
      'Día': l.dayOfWeek,
      'Fecha': l.date,
      'Descripción': l.description || '-',
      'Grupo': groupName,
      'Jornada': l.shift.name,
      'Sacos Simples': l.sacosSimples,
      'Sacos Mezclas': l.sacosMezclas,
      'Personal Participante': partNames,
      'Personal Ausente': (l.absent || []).map(id => destajoData.collaborators.find(x => x.id === id)?.fullName || id).join(', '),
      'Personal Permiso': (l.permitted || []).map(id => destajoData.collaborators.find(x => x.id === id)?.fullName || id).join(', '),
      'Personal Vacación': (l.vacation || []).map(id => destajoData.collaborators.find(x => x.id === id)?.fullName || id).join(', '),
      'Personal Apoyo': (l.support || []).map(id => destajoData.collaborators.find(x => x.id === id)?.fullName || id).join(', '),
      'Observaciones': l.observation || '-',
      'Valor Calculado ($)': Number(l.calculatedValue.toFixed(2))
    };
  });

  const wsDaily = XLSX.utils.json_to_sheet(dailyRows);
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Detalle Diario');

  // Save Workbook
  XLSX.writeFile(wb, `Reporte_Destajo_Corte_${periodId}.xlsx`);
}

// EXPORT REPORT PRINT AREA TO CLEAN SIGNATURE PDF
function exportDestajoPDF() {
  const element = document.getElementById('destajo-report-print-area');
  const opt = {
    margin:       [0.5, 0.5, 0.5, 0.5],
    filename:     `Reporte_Destajo_${activeReportSubTab}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
  };

  html2pdf().set(opt).from(element).save();
}

// ==========================================
// --- FORCED PASSWORD RESET MODAL OVERLAY ---
// ==========================================

function checkForcePasswordOverlay() {
  const modal = document.getElementById('modal-destajo-force-password');
  if (currentUser && currentUser.mustChangePassword) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
}

async function handleForcePasswordChange(e) {
  e.preventDefault();
  const pass = document.getElementById('destajo-force-newpass').value;
  const conf = document.getElementById('destajo-force-confirmpass').value;

  if (pass.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres.');
    return;
  }
  if (pass !== conf) {
    alert('Las contraseñas no coinciden.');
    return;
  }

  showLoader('Guardando contraseña...');
  try {
    const res = await apiFetch('/api/auth/change-password-force', {
      method: 'POST',
      body: JSON.stringify({ newPassword: pass })
    });
    if (res.success) {
      currentUser.mustChangePassword = false;
      localStorage.setItem('user', JSON.stringify(currentUser));
      checkForcePasswordOverlay();
      alert('Contraseña actualizada exitosamente.');
    }
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

// =========================================================================
// INVENTARIO FÍSICO CLIENTE CONTROLLER
// =========================================================================

async function renderLogClient() {
  // 1. Set today's date if empty
  const dateInput = document.getElementById('client-inventory-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().substring(0, 10);
  }

  // 2. Load daily consumptions from server
  await loadClientConsumptions();
}

function updateClientLockStatusUI(finalized, dateVal) {
  const banner = document.getElementById('client-lock-banner');
  const reopenBtn = document.getElementById('btn-client-reopen');

  if (!banner) return;

  window.clientDayFinalized = finalized;

  if (finalized) {
    banner.style.display = 'flex';
    banner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'; // red background
    banner.style.borderColor = '#ef4444';
    banner.style.color = '#f87171';

    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'logistic')) {
      banner.innerHTML = '<span>🔓</span> Planilla Cerrada (Edición Autorizada para Gerencia/Admin)';
      if (reopenBtn) reopenBtn.style.display = 'inline-block';
    } else {
      banner.innerHTML = '<span>🔒</span> Planilla Cerrada (Solo Lectura - Autorización de Gerencia requerida para modificar)';
      if (reopenBtn) reopenBtn.style.display = 'none';
    }
  } else {
    banner.style.display = 'none';
    if (reopenBtn) reopenBtn.style.display = 'none';
  }
}

async function loadClientConsumptions() {
  showLoader('Cargando planilla de cliente...');
  try {
    const dateVal = document.getElementById('client-inventory-date').value;
    if (!dateVal) return;

    // 1. Initialize daily record on server
    await apiFetch('/api/client-consumptions/initialize', {
      method: 'POST',
      body: JSON.stringify({ date: dateVal })
    });

    // 2. Fetch all daily records
    const res = await apiFetch('/api/client-consumptions');
    if (res.success) {
      clientConsumptionsData = res.consumptions || [];
    }

    // 3. Populate temp storage mapping
    clientTempConsumptions = {};
    let finalized = false;
    const record = clientConsumptionsData.find(c => c.date === dateVal);
    if (record) {
      finalized = !!record.finalized;
      record.items.forEach(it => {
        clientTempConsumptions[it.code] = {
          initialSist: it.initialSist || 0,
          initialPhys: it.initialPhys || 0,
          egresos: it.egresos || 0,
          ingresos: it.ingresos || 0,
          observation: it.observation || ''
        };
      });
    }

    updateClientLockStatusUI(finalized, dateVal);
    renderClientGrid();
  } catch (err) {
    console.error(err);
    alert('Error al cargar planilla de cliente: ' + err.message);
  } finally {
    hideLoader();
  }
}

async function reopenClientDay() {
  const dateVal = document.getElementById('client-inventory-date').value;
  if (!dateVal) return;

  if (!confirm(`¿Está seguro que desea reabrir la planilla del cliente para el día ${dateVal} y habilitar las modificaciones?`)) {
    return;
  }

  showLoader('Reabriendo planilla de cliente...');
  try {
    const res = await apiFetch('/api/client-consumptions/reopen', {
      method: 'POST',
      body: JSON.stringify({ date: dateVal })
    });

    if (res.success) {
      alert(res.message || 'La planilla de cliente ha sido reabierta con éxito.');
      await loadClientConsumptions();
    } else {
      alert('Error: ' + res.error);
    }
  } catch (err) {
    alert('Error al reabrir planilla: ' + err.message);
  } finally {
    hideLoader();
  }
}

function handleClientCellKeydown(event, code) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.target.blur();
  }
}

function handleClientCellBlur(input, code) {
  const rawValue = input.value.trim();
  if (rawValue) {
    const evaluated = evaluateMathExpression(rawValue);
    input.value = evaluated > 0 ? evaluated : '';
    if (evaluated > 0) {
      input.classList.add('cell-edited');
    } else {
      input.classList.remove('cell-edited');
    }
  } else {
    input.value = '';
    input.classList.remove('cell-edited');
  }
  calcClientRow(code);
  
  // Trigger silent autosave
  saveClientConsumptions(true);
}

function renderClientGrid() {
  const tbody = document.getElementById('client-inventory-tbody');
  if (!tbody) return;

  const searchVal = (document.getElementById('client-search-filter').value || '').toLowerCase().trim();

  const filtered = currentStock.filter(item => 
    item.code.toLowerCase().includes(searchVal) || 
    item.desc.toLowerCase().includes(searchVal)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron sacos en el inventario de cliente.</td></tr>`;
    updateClientStats();
    return;
  }

  const isLocked = window.clientDayFinalized && (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'logistic'));
  const disabledAttr = isLocked ? 'disabled' : '';

  tbody.innerHTML = filtered.map(item => {
    const temp = clientTempConsumptions[item.code] || {
      egresos: 0,
      ingresos: 0,
      observation: ''
    };
    
    // Starting balances
    const initPhys = temp.initialPhys !== undefined ? temp.initialPhys : (item.unica || 0);
    const finalPhys = Math.max(0, initPhys - (temp.egresos || 0) + (temp.ingresos || 0));

    return `
      <tr>
        <td class="font-monospace">${item.code}</td>
        <td><strong>${item.desc}</strong></td>
        <td class="text-right" style="background: rgba(255,255,255,0.01); font-weight: 500;">${initPhys.toLocaleString()}</td>
        
        <!-- Egresos -->
        <td style="background: rgba(239, 68, 68, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.egresos > 0 ? 'cell-edited' : ''}" style="width: 100%; padding: 4px; font-size: 12px;" id="client-egr-${item.code}" value="${temp.egresos || ''}" oninput="calcClientRow('${item.code}')" onkeydown="handleClientCellKeydown(event, '${item.code}')" onblur="handleClientCellBlur(this, '${item.code}')"></td>
        
        <!-- Ingresos -->
        <td style="background: rgba(16, 185, 129, 0.02);"><input type="text" ${disabledAttr} class="form-control text-right ${temp.ingresos > 0 ? 'cell-edited' : ''}" style="width: 100%; padding: 4px; font-size: 12px; color: #a7f3d0;" id="client-ing-${item.code}" value="${temp.ingresos || ''}" oninput="calcClientRow('${item.code}')" onkeydown="handleClientCellKeydown(event, '${item.code}')" onblur="handleClientCellBlur(this, '${item.code}')"></td>
        
        <!-- Observación -->
        <td><input type="text" ${disabledAttr} class="form-control" style="width: 100%; padding: 4px; font-size: 12px;" id="client-obs-${item.code}" value="${temp.observation || ''}" oninput="calcClientRow('${item.code}')" onblur="saveClientConsumptions(true)" placeholder="Comentario..."></td>

        <!-- Saldo Final -->
        <td class="text-right" style="background: rgba(255,255,255,0.01); font-weight: bold; color: var(--accent);" id="client-final-phys-${item.code}">${finalPhys.toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  updateClientStats();
}

function calcClientRow(code) {
  const stockItem = currentStock.find(s => s.code === code);
  if (!stockItem) return;

  const egresos = Math.max(0, evaluateMathExpression(document.getElementById(`client-egr-${code}`).value));
  const ingresos = Math.max(0, evaluateMathExpression(document.getElementById(`client-ing-${code}`).value));
  const observation = document.getElementById(`client-obs-${code}`).value || '';

  const prevTemp = clientTempConsumptions[code] || {};
  
  clientTempConsumptions[code] = {
    initialSist: prevTemp.initialSist !== undefined ? prevTemp.initialSist : (stockItem.unica || 0),
    initialPhys: prevTemp.initialPhys !== undefined ? prevTemp.initialPhys : (stockItem.unica || 0),
    egresos,
    ingresos,
    observation
  };

  const finalPhys = Math.max(0, clientTempConsumptions[code].initialPhys - egresos + ingresos);
  document.getElementById(`client-final-phys-${code}`).textContent = finalPhys.toLocaleString();

  updateClientStats();
}

function updateClientStats() {
  let totalEgresos = 0;
  let totalIngresos = 0;

  currentStock.forEach(item => {
    const temp = clientTempConsumptions[item.code] || {
      egresos: 0,
      ingresos: 0
    };
    totalEgresos += temp.egresos || 0;
    totalIngresos += temp.ingresos || 0;
  });

  const totalPhys = currentStock.reduce((acc, i) => acc + (i.unica || 0), 0);

  const statEgr = document.getElementById('client-stat-egresos');
  const statIng = document.getElementById('client-stat-ingresos');
  const statPhys = document.getElementById('client-stat-stock-total');

  if (statEgr) statEgr.textContent = `${totalEgresos.toLocaleString()} ud`;
  if (statIng) statIng.textContent = `${totalIngresos.toLocaleString()} ud`;
  if (statPhys) statPhys.textContent = `${totalPhys.toLocaleString()} ud`;
}

async function saveClientConsumptions(silent = false) {
  const dateVal = document.getElementById('client-inventory-date').value;
  if (!dateVal) {
    if (!silent) alert('Por favor selecciona una fecha de registro válida.');
    return;
  }

  const items = Object.entries(clientTempConsumptions).map(([code, c]) => ({
    code,
    ...c
  })).filter(it => 
    (it.egresos || 0) > 0 || 
    (it.ingresos || 0) > 0 || 
    (it.observation || '').trim().length > 0
  );

  if (!silent) showLoader('Guardando planilla de cliente...');
  try {
    const res = await apiFetch('/api/client-consumptions/save', {
      method: 'POST',
      body: JSON.stringify({ date: dateVal, items })
    });

    if (res.success) {
      if (!silent) alert('¡Planilla de cliente guardada exitosamente y saldos actualizados!');
      
      await loadDashboardData();
      
      const fetchRes = await apiFetch('/api/client-consumptions');
      if (fetchRes.success) {
        clientConsumptionsData = fetchRes.consumptions || [];
      }
      
      const record = clientConsumptionsData.find(c => c.date === dateVal);
      if (record) {
        updateClientLockStatusUI(!!record.finalized, dateVal);
      }
    } else {
      alert('Error al guardar planilla: ' + res.error);
    }
  } catch (err) {
    console.error(err);
    if (!silent) alert('Error al guardar planilla: ' + err.message);
  } finally {
    if (!silent) hideLoader();
  }
}

async function finalizeAndEmailClientInventory() {
  const dateVal = document.getElementById('client-inventory-date').value;
  if (!dateVal) {
    alert('Por favor selecciona una fecha de registro válida.');
    return;
  }

  const confirmFinalize = confirm('¿Está seguro de que desea finalizar el llenado de inventario de cliente de este día y enviar el reporte completo por correo a los involucrados?');
  if (!confirmFinalize) return;

  const items = Object.entries(clientTempConsumptions).map(([code, c]) => ({
    code,
    ...c
  })).filter(it => 
    (it.egresos || 0) > 0 || 
    (it.ingresos || 0) > 0 || 
    (it.observation || '').trim().length > 0
  );

  showLoader('Guardando y enviando reporte de cliente...');
  try {
    const saveRes = await apiFetch('/api/client-consumptions/save', {
      method: 'POST',
      body: JSON.stringify({ date: dateVal, items })
    });

    if (!saveRes.success) {
      throw new Error(saveRes.error || 'No se pudo guardar la planilla de cliente antes de enviar.');
    }

    const finalizeRes = await apiFetch('/api/client-consumptions/finalize', {
      method: 'POST',
      body: JSON.stringify({ date: dateVal })
    });

    if (finalizeRes.success) {
      alert('¡Planilla de cliente finalizada con éxito y reporte enviado por correo!');
      await loadDashboardData(); 
      await loadClientConsumptions();
    } else {
      alert('Error al enviar el reporte: ' + finalizeRes.error);
    }
  } catch (err) {
    alert('Error en el proceso de finalización de cliente: ' + err.message);
  } finally {
    hideLoader();
  }
}

function clearClientSearch() {
  const searchInput = document.getElementById('client-search-filter');
  if (searchInput) {
    searchInput.value = '';
    renderClientGrid();
  }
}

// ==========================================
// --- CONFIGURATION DIRECTORIO & ACCESOS ---
// ==========================================

function switchSettingsSubTab(tabName) {
  // Hide all sub-tab contents
  document.querySelectorAll('.sett-tab-content').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('active');
  });
  // Deactivate all pills
  document.querySelectorAll('.tab-pill').forEach(el => {
    el.classList.remove('active');
  });

  // Show active sub-tab content
  const activeContent = document.getElementById(`sett-tab-${tabName}`);
  if (activeContent) {
    activeContent.classList.remove('hidden');
    activeContent.classList.add('active');
  }

  // Activate matching pill
  document.querySelectorAll('.tab-pill').forEach(btn => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) {
      btn.classList.add('active');
    }
  });

  // Trigger data loads
  if (tabName === 'credentials-setup') {
    loadCredentialsList();
  } else if (tabName === 'links-setup') {
    loadLinksList();
  }
}
window.switchSettingsSubTab = switchSettingsSubTab;

let credentialsList = [];

async function loadCredentialsList() {
  const tbody = document.getElementById('credentials-list-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">Cargando credenciales...</td></tr>`;

  try {
    const res = await apiFetch('/api/settings/credentials');
    credentialsList = res.credentials || [];
    renderCredentialsTable();
  } catch (err) {
    console.error("Error loading credentials:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">Error al cargar: ${err.message}</td></tr>`;
  }
}
window.loadCredentialsList = loadCredentialsList;

function renderCredentialsTable() {
  const tbody = document.getElementById('credentials-list-tbody');
  if (!tbody) return;

  const searchVal = (document.getElementById('search-credentials').value || '').toLowerCase().trim();

  const filtered = credentialsList.filter(item => {
    return (item.category || '').toLowerCase().includes(searchVal) ||
           (item.name || '').toLowerCase().includes(searchVal) ||
           (item.username || '').toLowerCase().includes(searchVal);
  });

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">No se encontraron cuentas.</td></tr>`;
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding: 0.6rem; font-weight: 500;">${item.category}</td>
      <td style="padding: 0.6rem; font-weight: 600; color: var(--accent);">${item.name}</td>
      <td style="padding: 0.6rem; font-family: monospace;">${item.username}</td>
      <td style="padding: 0.6rem;">
        <span class="password-text font-monospace" data-visible="false" style="letter-spacing: 2px;">••••••••</span>
      </td>
      <td class="text-center" style="padding: 0.6rem;">
        <div style="display: flex; gap: 0.25rem; justify-content: center;">
          <button type="button" class="btn btn-xs btn-outline btn-toggle-pass" style="padding: 0.2rem 0.4rem; font-size: 11px;" title="Ver Contraseña">👁️</button>
          ${currentUser.role === 'admin' ? `
            <button type="button" class="btn btn-xs btn-outline btn-edit-cred" style="padding: 0.2rem 0.4rem; font-size: 11px; border-color: #3b82f6; color: #3b82f6;" title="Editar">✏️</button>
            <button type="button" class="btn btn-xs btn-outline btn-delete-cred" style="padding: 0.2rem 0.4rem; font-size: 11px; border-color: #ef4444; color: #ef4444;" title="Eliminar">🗑️</button>
          ` : ''}
        </div>
      </td>
    `;

    // Toggle password visibility listener
    tr.querySelector('.btn-toggle-pass').addEventListener('click', (e) => {
      const span = tr.querySelector('.password-text');
      const isVisible = span.getAttribute('data-visible') === 'true';
      if (isVisible) {
        span.textContent = '••••••••';
        span.style.letterSpacing = '2px';
        span.setAttribute('data-visible', 'false');
        e.target.textContent = '👁️';
      } else {
        span.textContent = item.password;
        span.style.letterSpacing = 'normal';
        span.setAttribute('data-visible', 'true');
        e.target.textContent = '🙈';
      }
    });

    if (currentUser.role === 'admin') {
      // Edit listener
      tr.querySelector('.btn-edit-cred').addEventListener('click', () => {
        document.getElementById('credential-id').value = item.id;
        document.getElementById('credential-category').value = item.category;
        document.getElementById('credential-name').value = item.name;
        document.getElementById('credential-username').value = item.username;
        document.getElementById('credential-password').value = item.password;
        
        document.getElementById('credential-form-title').textContent = 'Editar Cuenta';
        const cancelBtn = document.getElementById('btn-cancel-credential-edit');
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
      });

      // Delete listener
      tr.querySelector('.btn-delete-cred').addEventListener('click', async () => {
        if (!confirm(`¿Está seguro de eliminar la cuenta para "${item.name}"?`)) return;
        showLoader('Eliminando cuenta...');
        try {
          await apiFetch(`/api/settings/credentials?id=${item.id}`, { method: 'DELETE' });
          await loadCredentialsList();
        } catch (err) {
          alert('Error al eliminar: ' + err.message);
        } finally {
          hideLoader();
        }
      });
    }

    tbody.appendChild(tr);
  });
}
window.renderCredentialsTable = renderCredentialsTable;

async function handleCredentialSubmit(e) {
  e.preventDefault();
  if (currentUser.role !== 'admin') {
    alert('Acceso denegado: se requieren permisos de administrador.');
    return;
  }

  const id = document.getElementById('credential-id').value;
  const category = document.getElementById('credential-category').value;
  const name = document.getElementById('credential-name').value;
  const username = document.getElementById('credential-username').value;
  const password = document.getElementById('credential-password').value;

  showLoader('Guardando cuenta...');
  try {
    const res = await apiFetch('/api/settings/credentials', {
      method: 'POST',
      body: JSON.stringify({ id, category, name, username, password })
    });
    alert(res.message || 'Cuenta guardada con éxito.');
    resetCredentialForm();
    await loadCredentialsList();
  } catch (err) {
    alert('Error al guardar cuenta: ' + err.message);
  } finally {
    hideLoader();
  }
}
window.handleCredentialSubmit = handleCredentialSubmit;

function resetCredentialForm() {
  document.getElementById('credential-id').value = '';
  document.getElementById('form-credential-setup').reset();
  document.getElementById('credential-form-title').textContent = 'Registrar Nueva Cuenta';
  const cancelBtn = document.getElementById('btn-cancel-credential-edit');
  if (cancelBtn) cancelBtn.style.display = 'none';
}
window.resetCredentialForm = resetCredentialForm;

let linksList = [];

async function loadLinksList() {
  const container = document.getElementById('links-grid-container');
  if (!container) return;
  container.innerHTML = `<div class="text-center py-4 text-muted" style="grid-column: 1 / -1;">Cargando enlaces...</div>`;

  try {
    const res = await apiFetch('/api/settings/links');
    linksList = res.links || [];
    renderLinksGrid();
  } catch (err) {
    console.error("Error loading links:", err);
    container.innerHTML = `<div class="text-center py-4 text-danger" style="grid-column: 1 / -1;">Error al cargar: ${err.message}</div>`;
  }
}
window.loadLinksList = loadLinksList;

function renderLinksGrid() {
  const container = document.getElementById('links-grid-container');
  if (!container) return;

  const searchVal = (document.getElementById('search-links').value || '').toLowerCase().trim();

  const filtered = linksList.filter(item => {
    return (item.name || '').toLowerCase().includes(searchVal) ||
           (item.url || '').toLowerCase().includes(searchVal) ||
           (item.type || '').toLowerCase().includes(searchVal) ||
           (item.desc || '').toLowerCase().includes(searchVal);
  });

  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center py-4 text-muted" style="grid-column: 1 / -1;">No se encontraron enlaces en el directorio.</div>`;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.style = 'flex-direction: column; align-items: flex-start; padding: 1.25rem; gap: 0.75rem; border: 1px solid rgba(255,255,255,0.06); transition: all 0.2s ease; width: 100%;';
    
    const isLocal = (item.type || '').toLowerCase() === 'local';
    const typeColor = isLocal ? '#10b981' : '#3b82f6';
    const typeBg = isLocal ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span class="badge" style="background: ${typeBg}; color: ${typeColor}; font-size: 10px; font-weight: 700; text-transform: uppercase;">${item.type}</span>
        ${currentUser.role === 'admin' ? `
          <div style="display: flex; gap: 0.25rem;">
            <button type="button" class="btn btn-xs btn-outline btn-edit-link" style="padding: 0.15rem 0.3rem; font-size: 10px; border-color: #3b82f6; color: #3b82f6;" title="Editar">✏️</button>
            <button type="button" class="btn btn-xs btn-outline btn-delete-link" style="padding: 0.15rem 0.3rem; font-size: 10px; border-color: #ef4444; color: #ef4444;" title="Eliminar">🗑️</button>
          </div>
        ` : ''}
      </div>
      <div style="width: 100%;">
        <h4 style="margin: 0 0 0.25rem 0; font-size: 14px; font-weight: 600;">${item.name}</h4>
        <p style="margin: 0; font-size: 12px; color: var(--text-muted); line-height: 1.4; min-height: 36px; word-break: break-word;">${item.desc || 'Sin descripción'}</p>
      </div>
      <a href="${item.url}" target="_blank" class="btn btn-sm btn-outline btn-block" style="border-color: var(--accent); color: var(--accent); font-weight: 600; text-align: center; display: block; margin-top: auto; width: 100%;">
        🔗 Ir al Sitio
      </a>
    `;

    if (currentUser.role === 'admin') {
      // Edit link listener
      card.querySelector('.btn-edit-link').addEventListener('click', () => {
        document.getElementById('link-id').value = item.id;
        document.getElementById('link-type').value = item.type;
        document.getElementById('link-name').value = item.name;
        document.getElementById('link-url').value = item.url;
        document.getElementById('link-desc').value = item.desc;

        document.getElementById('link-form-title').textContent = 'Editar Enlace';
        const cancelBtn = document.getElementById('btn-cancel-link-edit');
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
      });

      // Delete link listener
      card.querySelector('.btn-delete-link').addEventListener('click', async () => {
        if (!confirm(`¿Está seguro de eliminar el enlace "${item.name}"?`)) return;
        showLoader('Eliminando enlace...');
        try {
          await apiFetch(`/api/settings/links?id=${item.id}`, { method: 'DELETE' });
          await loadLinksList();
        } catch (err) {
          alert('Error al eliminar: ' + err.message);
        } finally {
          hideLoader();
        }
      });
    }

    container.appendChild(card);
  });
}
window.renderLinksGrid = renderLinksGrid;

async function handleLinkSubmit(e) {
  e.preventDefault();
  if (currentUser.role !== 'admin') {
    alert('Acceso denegado: se requieren permisos de administrador.');
    return;
  }

  const id = document.getElementById('link-id').value;
  const type = document.getElementById('link-type').value;
  const name = document.getElementById('link-name').value;
  const url = document.getElementById('link-url').value;
  const desc = document.getElementById('link-desc').value;

  showLoader('Guardando enlace...');
  try {
    const res = await apiFetch('/api/settings/links', {
      method: 'POST',
      body: JSON.stringify({ id, type, name, url, desc })
    });
    alert(res.message || 'Enlace guardado con éxito.');
    resetLinkForm();
    await loadLinksList();
  } catch (err) {
    alert('Error al guardar enlace: ' + err.message);
  } finally {
    hideLoader();
  }
}
window.handleLinkSubmit = handleLinkSubmit;

function resetLinkForm() {
  document.getElementById('link-id').value = '';
  document.getElementById('form-link-setup').reset();
  document.getElementById('link-form-title').textContent = 'Registrar Nuevo Enlace / Red';
  const cancelBtn = document.getElementById('btn-cancel-link-edit');
  if (cancelBtn) cancelBtn.style.display = 'none';
}
window.resetLinkForm = resetLinkForm;

// --- PWA MOBILE APPLICATION INSTALLATION HANDLER ---
let deferredPWAInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPWAInstallPrompt = e;
  console.log("PWA install prompt captured");
});

function triggerPWAInstall() {
  if (deferredPWAInstallPrompt) {
    deferredPWAInstallPrompt.prompt();
    deferredPWAInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('Usuario aceptó instalar la App Móvil de Ferpacific');
      }
      deferredPWAInstallPrompt = null;
    });
  } else {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      alert("📱 PARA INSTALAR EN TU IPHONE / IPAD:\n\n1. Toca el botón 'Compartir' 📤 (el ícono del cuadrado con flecha hacia arriba en Safari).\n2. Selecciona 'Agregar a la pantalla de inicio' (Add to Home Screen).\n\n¡Y listo! Tendrás el ícono del Sistema de Ferpacific en tu celular.");
    } else {
      alert("📱 PARA INSTALAR EN TU CELULAR / TABLET / PC:\n\n1. En la barra superior de tu navegador, toca el ícono 'Instalar App' ➕ o los 3 puntos del menú ⋮\n2. Selecciona 'Instalar aplicación' o 'Agregar a la pantalla principal'.\n\n¡Tendrás el acceso directo del Sistema de Ferpacific directamente en tu pantalla!");
    }
  }
}
window.triggerPWAInstall = triggerPWAInstall;

// --- CUSTOMER SERVICE (ATENCION AL CLIENTE) MODULE LOGIC ---
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHTML = escapeHTML;

let customerServiceRecords = [];
let customerServiceNotifications = [];

async function loadCustomerServiceData() {
  const dateInput = document.getElementById('cs-filter-date');
  const statusInput = document.getElementById('cs-filter-status');
  
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }

  const dateVal = dateInput ? dateInput.value : '';
  const statusVal = statusInput ? statusInput.value : '';

  try {
    let url = `/api/customer-service?date=${dateVal}`;
    if (statusVal) url += `&status=${encodeURIComponent(statusVal)}`;

    const res = await apiFetch(url);
    if (res && res.records) {
      customerServiceRecords = res.records;
      customerServiceNotifications = res.notifications || [];
      renderCustomerServiceModule();
      renderCustomerServiceChatLogs();
      renderCustomerComplianceDashboard();
    }
  } catch (err) {
    console.error("Error al cargar datos de atención al cliente:", err);
    alert("Error al cargar turnos: " + err.message);
  }
}
window.loadCustomerServiceData = loadCustomerServiceData;

function getTransportStandardMinutes(type) {
  if (type === 'Trailer / Mula') return 90;
  if (type === 'Camión Pesado') return 60;
  if (type === 'Camión Mediano') return 45;
  if (type === 'Camión Pequeño') return 30;
  return 60;
}

function renderCustomerServiceModule() {
  const tbody = document.getElementById('cs-table-body');
  const countSpan = document.getElementById('cs-records-count');
  
  // KPI Elements
  const statTurns = document.getElementById('cs-stat-total-turns');
  const statSacos = document.getElementById('cs-stat-total-sacos');
  const statAvgStay = document.getElementById('cs-stat-avg-stay');
  const statWaiting = document.getElementById('cs-stat-waiting');

  if (!customerServiceRecords || customerServiceRecords.length === 0) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="20" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <span style="font-size: 32px; display: block; margin-bottom: 0.5rem;">🚚</span>
            No hay turnos registrados. Haga clic en <strong>➕ Agregar Fila de Turno</strong> para ingresar datos.
          </td>
        </tr>
      `;
    }
    if (countSpan) countSpan.textContent = '0 Registros';
    if (statTurns) statTurns.textContent = '0';
    if (statSacos) statSacos.textContent = '0';
    if (statAvgStay) statAvgStay.textContent = '00:00 h';
    if (statWaiting) statWaiting.textContent = '0';
    return;
  }

  // Calculate KPIs
  let totalSacosSum = 0;
  let totalMinutesSum = 0;
  let stayCount = 0;
  let waitingCount = 0;

  customerServiceRecords.forEach(r => {
    totalSacosSum += (r.totalSacos || 0);
    if (r.estatus === 'ESPERA DE CARGA') waitingCount++;

    if (r.hIngreso && r.hSalida) {
      const [hIn, mIn] = r.hIngreso.split(':').map(Number);
      const [hOut, mOut] = r.hSalida.split(':').map(Number);
      if (!isNaN(hIn) && !isNaN(mIn) && !isNaN(hOut) && !isNaN(mOut)) {
        let diffMinutes = (hOut * 60 + mOut) - (hIn * 60 + mIn);
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        totalMinutesSum += diffMinutes;
        stayCount++;
      }
    }
  });

  if (statTurns) statTurns.textContent = customerServiceRecords.length.toLocaleString();
  if (statSacos) statSacos.textContent = totalSacosSum.toLocaleString();
  if (statWaiting) statWaiting.textContent = waitingCount.toLocaleString();

  if (statAvgStay) {
    if (stayCount > 0) {
      const avgMin = Math.round(totalMinutesSum / stayCount);
      const hrs = Math.floor(avgMin / 60);
      const mins = avgMin % 60;
      statAvgStay.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')} h`;
    } else {
      statAvgStay.textContent = '00:00 h';
    }
  }

  if (countSpan) countSpan.textContent = `${customerServiceRecords.length} Registros`;

  // Render Table as Excel-Style Editable Grid
  if (!tbody) return;
  tbody.innerHTML = '';

  customerServiceRecords.forEach(record => {
    const tr = document.createElement('tr');
    tr.id = `cs-row-${record.id}`;
    
    const stdMin = record.standardTimeMin || getTransportStandardMinutes(record.transportType);
    let timeBadge = `<span style="color: var(--text-muted); font-size: 0.75rem;">Pendiente</span>`;
    
    if (record.hIngreso && record.hSalida) {
      const [hIn, mIn] = record.hIngreso.split(':').map(Number);
      const [hOut, mOut] = record.hSalida.split(':').map(Number);
      if (!isNaN(hIn) && !isNaN(mIn) && !isNaN(hOut) && !isNaN(mOut)) {
        let actualMin = (hOut * 60 + mOut) - (hIn * 60 + mIn);
        if (actualMin < 0) actualMin += 24 * 60;
        
        const hrs = Math.floor(actualMin / 60);
        const mins = actualMin % 60;
        const realStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')} h`;

        if (actualMin <= stdMin) {
          timeBadge = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
              <span style="font-weight: bold; color: #10b981; font-family: monospace;">${realStr}</span>
              <span style="font-size: 0.68rem; padding: 1px 5px; border-radius: 8px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981;">🟢 En Tiempo (Est: ${stdMin}m)</span>
            </div>
          `;
        } else {
          const diffMin = actualMin - stdMin;
          const dHrs = Math.floor(diffMin / 60);
          const dMins = diffMin % 60;
          const diffStr = dHrs > 0 ? `+${dHrs}h ${dMins}m` : `+${dMins}m`;
          timeBadge = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
              <span style="font-weight: bold; color: #ef4444; font-family: monospace;">${realStr}</span>
              <span style="font-size: 0.68rem; padding: 1px 5px; border-radius: 8px; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444;">🔴 Excedido (${diffStr})</span>
            </div>
          `;
        }
      }
    }

    const now = new Date();
    const liveTimeNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const isHOutSet = Boolean(record.hSalida && String(record.hSalida).trim());
    const hOutBg = isHOutSet ? 'background: #fef08a !important; color: #854d0e !important; font-weight: bold !important; border: 2px solid #eab308 !important;' : '';

    tr.innerHTML = `
      <td style="text-align: center; padding: 4px;">
        <input type="number" id="cs-grid-turno-${record.id}" class="input-field" value="${record.turno}" style="width: 48px; padding: 4px; text-align: center; font-weight: bold; color: #3b82f6;" onchange="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px;">
        <input type="text" id="cs-grid-vendedor-${record.id}" class="input-field" value="${escapeHTML(record.vendedor || 'Marianella Zurita')}" style="width: 120px; padding: 4px; font-weight: 600; color: #a7f3d0;" onchange="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px;">
        <input type="text" id="cs-grid-driver-${record.id}" class="input-field" value="${escapeHTML(record.driver || '')}" placeholder="Chofer..." style="width: 130px; padding: 4px;" onchange="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: center;">
        <input type="text" id="cs-grid-plate-${record.id}" class="input-field" value="${escapeHTML(record.plate || '')}" placeholder="Placa..." style="width: 85px; padding: 4px; text-transform: uppercase; text-align: center; font-family: monospace; font-weight: bold;" onchange="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: center;">
        <select id="cs-grid-type-${record.id}" class="input-field" style="width: 130px; padding: 4px; font-size: 0.76rem;" onchange="updateCSRowTotals('${record.id}')">
          <option value="Trailer / Mula" ${tType === 'Trailer / Mula' ? 'selected' : ''}>Trailer / Mula</option>
          <option value="Camión Pesado" ${tType === 'Camión Pesado' ? 'selected' : ''}>Camión Pesado</option>
          <option value="Camión Mediano" ${tType === 'Camión Mediano' ? 'selected' : ''}>Camión Mediano</option>
          <option value="Camión Pequeño" ${tType === 'Camión Pequeño' ? 'selected' : ''}>Camión Pequeño</option>
        </select>
      </td>
      <td style="padding: 4px;">
        <input type="text" id="cs-grid-client-${record.id}" class="input-field" value="${escapeHTML(record.client || '')}" placeholder="Cliente..." style="width: 130px; padding: 4px; text-transform: uppercase; color: #38bdf8; font-weight: 600;" onchange="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: center;">
        <input type="number" id="cs-grid-ferpagro-${record.id}" class="input-field" value="${record.ferpagro || 0}" min="0" style="width: 55px; padding: 4px; text-align: center; color: #10b981; font-weight: 600;" oninput="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: center;">
        <input type="number" id="cs-grid-doyle1-${record.id}" class="input-field" value="${record.doyle1 || 0}" min="0" style="width: 55px; padding: 4px; text-align: center; color: #3b82f6; font-weight: 600;" oninput="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: center;">
        <input type="number" id="cs-grid-nacional-${record.id}" class="input-field" value="${record.nacional || 0}" min="0" style="width: 55px; padding: 4px; text-align: center; color: #f59e0b; font-weight: 600;" oninput="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: center;">
        <input type="number" id="cs-grid-sackett-${record.id}" class="input-field" value="${record.sackett || 0}" min="0" style="width: 55px; padding: 4px; text-align: center; color: #8b5cf6; font-weight: 600;" oninput="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: center; font-weight: bold; font-size: 0.9rem; color: #10b981;">
        <input type="number" id="cs-grid-tot-${record.id}" class="input-field" value="${record.totalSacos || 0}" min="0" style="width: 70px; padding: 4px; text-align: center; color: #10b981; font-weight: bold;" oninput="updateCSRowTotals('${record.id}', true)">
      </td>
      <td style="padding: 4px; text-align: center;">
        <input type="time" id="cs-grid-hingreso-${record.id}" class="input-field" value="${record.hIngreso || ''}" style="width: 90px; padding: 4px; text-align: center; font-family: monospace;" onchange="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: center;">
        <input type="time" id="cs-grid-hsalida-${record.id}" class="input-field" value="${record.hSalida || ''}" placeholder="${liveTimeNow}" style="width: 90px; padding: 4px; text-align: center; font-family: monospace; ${hOutBg}" onchange="confirmCSDepartureTime('${record.id}')" onkeydown="if(event.key==='Enter'){ confirmCSDepartureTime('${record.id}'); }">
      </td>
      <td style="padding: 4px; text-align: center;">
        <div id="cs-grid-badge-${record.id}">${timeBadge}</div>
      </td>
      <td style="padding: 4px; text-align: center;">
        <select id="cs-grid-estatus-${record.id}" class="input-field" style="width: 145px; padding: 4px; font-size: 0.76rem; font-weight: bold;" onchange="updateCSRowTotals('${record.id}')">
          <option value="ESPERA DE CARGA" ${status === 'ESPERA DE CARGA' ? 'selected' : ''}>ESPERA DE CARGA</option>
          <option value="EN CARGA" ${status === 'EN CARGA' ? 'selected' : ''}>EN CARGA</option>
          <option value="EN BÁSCULA" ${status === 'EN BÁSCULA' ? 'selected' : ''}>EN BÁSCULA</option>
          <option value="DESPACHADO" ${status === 'DESPACHADO' ? 'selected' : ''}>DESPACHADO</option>
          <option value="GUIA DE REMISIÓN" ${status === 'GUIA DE REMISIÓN' ? 'selected' : ''}>GUIA DE REMISIÓN</option>
          <option value="NO CARGO EN FERPASUR" ${status === 'NO CARGO EN FERPASUR' ? 'selected' : ''}>NO CARGO EN FERPASUR</option>
          <option value="CARGA MAÑANA" ${status === 'CARGA MAÑANA' ? 'selected' : ''}>CARGA MAÑANA</option>
          <option value="CANCELADO" ${status === 'CANCELADO' ? 'selected' : ''}>CANCELADO</option>
        </select>
      </td>
      <td style="padding: 4px; text-align: center;">
        <input type="date" id="cs-grid-fecha-${record.id}" class="input-field" value="${record.fecha || new Date().toISOString().split('T')[0]}" style="width: 115px; padding: 4px; font-size: 0.78rem;" onchange="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: right;">
        <input type="number" step="0.01" id="cs-grid-pneto-${record.id}" class="input-field" value="${record.pNeto || 0}" style="width: 70px; padding: 4px; text-align: right; font-family: monospace;" onchange="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: right;">
        <input type="number" step="0.01" id="cs-grid-pprom-${record.id}" class="input-field" value="${record.pProm || 0}" style="width: 70px; padding: 4px; text-align: right; font-family: monospace;" onchange="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: center;">
        <input type="text" id="cs-grid-ticket-${record.id}" class="input-field" value="${escapeHTML(record.ticket || '')}" placeholder="Ticket..." style="width: 80px; padding: 4px; text-align: center; font-family: monospace;" onchange="updateCSRowTotals('${record.id}')">
      </td>
      <td style="padding: 4px; text-align: center;">
        <button class="btn btn-sm btn-outline" style="padding: 3px 6px; font-size: 0.75rem; color: #ef4444; border-color: #ef4444;" onclick="deleteCSRecord('${record.id}')" title="Eliminar Turno">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

let csLiveClockInterval = null;

function startCSLiveClock() {
  if (csLiveClockInterval) clearInterval(csLiveClockInterval);
  csLiveClockInterval = setInterval(() => {
    const now = new Date();
    const liveTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    customerServiceRecords.forEach(r => {
      const input = document.getElementById(`cs-grid-hsalida-${r.id}`);
      if (input && !input.value && r.estatus !== 'DESPACHADO' && r.estatus !== 'CANCELADO' && r.estatus !== 'NO CARGO EN FERPASUR' && r.estatus !== 'CARGA MAÑANA') {
        input.placeholder = liveTime;
      }
    });
  }, 10000);
}
window.startCSLiveClock = startCSLiveClock;

function confirmCSDepartureTime(id) {
  const input = document.getElementById(`cs-grid-hsalida-${id}`);
  if (!input) return;
  
  if (!input.value) {
    const now = new Date();
    input.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  
  input.style.cssText = 'width: 90px; padding: 4px; text-align: center; font-family: monospace; background: #fef08a !important; color: #854d0e !important; font-weight: bold !important; border: 2px solid #eab308 !important;';
  
  const estatusSelect = document.getElementById(`cs-grid-estatus-${id}`);
  if (estatusSelect && estatusSelect.value !== 'CANCELADO') {
    estatusSelect.value = 'DESPACHADO';
  }
  
  updateCSRowTotals(id);
}
window.confirmCSDepartureTime = confirmCSDepartureTime;

function updateCSRowTotals(id, isManualTotal = false) {
  const fer = Number(document.getElementById(`cs-grid-ferpagro-${id}`)?.value) || 0;
  const doy = Number(document.getElementById(`cs-grid-doyle1-${id}`)?.value) || 0;
  const nac = Number(document.getElementById(`cs-grid-nacional-${id}`)?.value) || 0;
  const sac = Number(document.getElementById(`cs-grid-sackett-${id}`)?.value) || 0;
  
  if (!isManualTotal) {
    const totInput = document.getElementById(`cs-grid-tot-${id}`);
    if (totInput) {
      totInput.value = fer + doy + nac + sac;
    }
  }

  const tType = document.getElementById(`cs-grid-type-${id}`)?.value || 'Camión Pesado';
  const stdMin = getTransportStandardMinutes(tType);
  const hIn = document.getElementById(`cs-grid-hingreso-${id}`)?.value || '';
  const hOut = document.getElementById(`cs-grid-hsalida-${id}`)?.value || '';

  // Auto-change status to DESPACHADO when Hora de Salida is entered
  const estatusSelect = document.getElementById(`cs-grid-estatus-${id}`);
  if (hOut && estatusSelect && estatusSelect.value !== 'CANCELADO') {
    estatusSelect.value = 'DESPACHADO';
  }

  const badgeDiv = document.getElementById(`cs-grid-badge-${id}`);
  if (badgeDiv) {
    if (hIn && hOut) {
      const [h1, m1] = hIn.split(':').map(Number);
      const [h2, m2] = hOut.split(':').map(Number);
      if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diff < 0) diff += 24 * 60;
        const hrs = Math.floor(diff / 60);
        const mins = diff % 60;
        const realStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')} h`;

        if (diff <= stdMin) {
          badgeDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
              <span style="font-weight: bold; color: #10b981; font-family: monospace;">${realStr}</span>
              <span style="font-size: 0.68rem; padding: 1px 5px; border-radius: 8px; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981;">🟢 En Tiempo (Est: ${stdMin}m)</span>
            </div>
          `;
        } else {
          const diffMin = diff - stdMin;
          const dHrs = Math.floor(diffMin / 60);
          const dMins = diffMin % 60;
          const diffStr = dHrs > 0 ? `+${dHrs}h ${dMins}m` : `+${dMins}m`;
          badgeDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
              <span style="font-weight: bold; color: #ef4444; font-family: monospace;">${realStr}</span>
              <span style="font-size: 0.68rem; padding: 1px 5px; border-radius: 8px; background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444;">🔴 Excedido (${diffStr})</span>
            </div>
          `;
        }
      }
    } else {
      badgeDiv.innerHTML = `<span style="color: var(--text-muted); font-size: 0.75rem;">Pendiente</span>`;
    }
  }
}
window.updateCSRowTotals = updateCSRowTotals;

function addNewEmptyCSRow() {
  const nextTurn = customerServiceRecords.length + 1;
  const newRecord = {
    id: 'CS-' + Date.now(),
    turno: nextTurn,
    vendedor: 'Marianella Zurita',
    driver: '',
    plate: '',
    transportType: 'Camión Pesado',
    client: '',
    ferpagro: 0,
    doyle1: 0,
    nacional: 0,
    sackett: 0,
    totalSacos: 0,
    hIngreso: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false }),
    hSalida: '',
    tEstadia: '',
    standardTimeMin: 60,
    timeStatus: 'EN TIEMPO',
    estatus: 'ESPERA DE CARGA',
    fecha: document.getElementById('cs-filter-date')?.value || new Date().toISOString().split('T')[0],
    pNeto: 0,
    pProm: 0,
    ticket: ''
  };

  customerServiceRecords.unshift(newRecord);
  renderCustomerServiceModule();
}
window.addNewEmptyCSRow = addNewEmptyCSRow;

async function saveAllCSRecordsFromGrid() {
  showLoader('Guardando tabla de turnos...');
  try {
    const promises = customerServiceRecords.map(async r => {
      const id = r.id;
      const turno = Number(document.getElementById(`cs-grid-turno-${id}`)?.value) || r.turno;
      const vendedor = document.getElementById(`cs-grid-vendedor-${id}`)?.value || r.vendedor;
      const driver = document.getElementById(`cs-grid-driver-${id}`)?.value || r.driver;
      const plate = document.getElementById(`cs-grid-plate-${id}`)?.value || r.plate;
      const transportType = document.getElementById(`cs-grid-type-${id}`)?.value || r.transportType;
      const client = document.getElementById(`cs-grid-client-${id}`)?.value || r.client;
      const ferpagro = Number(document.getElementById(`cs-grid-ferpagro-${id}`)?.value) || 0;
      const doyle1 = Number(document.getElementById(`cs-grid-doyle1-${id}`)?.value) || 0;
      const nacional = Number(document.getElementById(`cs-grid-nacional-${id}`)?.value) || 0;
      const sackett = Number(document.getElementById(`cs-grid-sackett-${id}`)?.value) || 0;
      
      const manualTotVal = Number(document.getElementById(`cs-grid-tot-${id}`)?.value);
      const totalSacos = !isNaN(manualTotVal) && manualTotVal > 0 ? manualTotVal : (ferpagro + doyle1 + nacional + sackett);

      const hIngreso = document.getElementById(`cs-grid-hingreso-${id}`)?.value || r.hIngreso;
      const hSalida = document.getElementById(`cs-grid-hsalida-${id}`)?.value || r.hSalida;
      const estatus = document.getElementById(`cs-grid-estatus-${id}`)?.value || r.estatus;
      const fecha = document.getElementById(`cs-grid-fecha-${id}`)?.value || r.fecha;
      const pNeto = Number(document.getElementById(`cs-grid-pneto-${id}`)?.value) || 0;
      const pProm = Number(document.getElementById(`cs-grid-pprom-${id}`)?.value) || 0;
      const ticket = document.getElementById(`cs-grid-ticket-${id}`)?.value || r.ticket;

      const stdMin = getTransportStandardMinutes(transportType);
      let tEstadiaVal = '';
      let timeStatus = 'EN TIEMPO';

      if (hIngreso && hSalida) {
        const [h1, m1] = hIngreso.split(':').map(Number);
        const [h2, m2] = hSalida.split(':').map(Number);
        if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff < 0) diff += 24 * 60;
          const hrs = Math.floor(diff / 60);
          const mins = diff % 60;
          tEstadiaVal = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
          if (diff > stdMin) timeStatus = 'EXCEDIDO';
        }
      }

      const payload = {
        turno, vendedor, driver, plate, transportType, client,
        ferpagro, doyle1, nacional, sackett, totalSacos,
        hIngreso, hSalida, tEstadia: tEstadiaVal,
        standardTimeMin: stdMin, timeStatus, estatus, fecha,
        pNeto, pProm, ticket
      };

      if (id.startsWith('CS-') && id.length > 15) {
        // Existing record update
        return apiFetch(`/api/customer-service/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        // New record create
        return apiFetch('/api/customer-service', { method: 'POST', body: JSON.stringify(payload) });
      }
    });

    await Promise.all(promises);
    await loadCustomerServiceData();
    alert("✅ Tabla de turnos guardada exitosamente.");
  } catch (err) {
    alert("Error al guardar la tabla: " + err.message);
  } finally {
    hideLoader();
  }
}
window.saveAllCSRecordsFromGrid = saveAllCSRecordsFromGrid;

function renderCustomerServiceChatLogs() {
  const container = document.getElementById('cs-chat-logs');
  if (!container) return;

  if (!customerServiceNotifications || customerServiceNotifications.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.82rem; padding: 1rem;">
        💬 No hay notificaciones recientes enviadas. Al cambiar un turno a <strong>DESPACHADO</strong>, se enviará una alerta automática por correo.
      </div>
    `;
    return;
  }

  container.innerHTML = customerServiceNotifications.map(n => {
    const timeStr = new Date(n.timestamp).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    return `
      <div style="background: rgba(30, 41, 59, 0.7); padding: 8px 12px; border-radius: 6px; border-left: 3px solid #10b981; font-size: 0.8rem; line-height: 1.4;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <span style="font-weight: bold; color: #10b981;">📩 Notificación Automática Enviada</span>
          <span style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${timeStr} ➔ mzurita@ferpacific.com</span>
        </div>
        <div style="color: var(--text-main); font-size: 0.8rem;">
          ${escapeHTML(n.message)}
        </div>
      </div>
    `;
  }).join('');
}
window.renderCustomerServiceChatLogs = renderCustomerServiceChatLogs;

function renderCustomerComplianceDashboard() {
  const container = document.getElementById('cs-dash-client-tbody');
  const statPct = document.getElementById('cs-stat-on-time-pct');
  const statCount = document.getElementById('cs-stat-on-time-count');

  const mulaDiv = document.getElementById('dash-transport-mula');
  const pesadoDiv = document.getElementById('dash-transport-pesado');
  const medianoDiv = document.getElementById('dash-transport-mediano');
  const pequenoDiv = document.getElementById('dash-transport-pequeno');

  if (!customerServiceRecords || customerServiceRecords.length === 0) {
    if (container) {
      container.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
            No hay datos de despachos registrados para calcular el cumplimiento por cliente.
          </td>
        </tr>
      `;
    }
    if (statPct) statPct.textContent = '0%';
    if (statCount) statCount.textContent = '0 🟢 / 0 🔴';
    return;
  }

  // Aggregate by Client
  const clientMap = {};
  const transportStats = {
    'Trailer / Mula': { total: 0, onTime: 0 },
    'Camión Pesado': { total: 0, onTime: 0 },
    'Camión Mediano': { total: 0, onTime: 0 },
    'Camión Pequeño': { total: 0, onTime: 0 }
  };

  let globalOnTime = 0;
  let globalDelayed = 0;

  customerServiceRecords.forEach(r => {
    const clientName = (r.client || 'SIN CLIENTE').trim().toUpperCase();
    if (!clientMap[clientName]) {
      clientMap[clientName] = {
        name: clientName,
        total: 0,
        onTime: 0,
        delayed: 0,
        transports: {}
      };
    }

    const tType = r.transportType || 'Camión Pesado';
    if (!clientMap[clientName].transports[tType]) {
      clientMap[clientName].transports[tType] = { total: 0, onTime: 0 };
    }

    if (r.hIngreso && r.hSalida) {
      const [hIn, mIn] = r.hIngreso.split(':').map(Number);
      const [hOut, mOut] = r.hSalida.split(':').map(Number);
      if (!isNaN(hIn) && !isNaN(mIn) && !isNaN(hOut) && !isNaN(mOut)) {
        let diffMinutes = (hOut * 60 + mOut) - (hIn * 60 + mIn);
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        
        const stdMin = r.standardTimeMin || getTransportStandardMinutes(tType);

        clientMap[clientName].total++;
        clientMap[clientName].transports[tType].total++;
        
        if (!transportStats[tType]) transportStats[tType] = { total: 0, onTime: 0 };
        transportStats[tType].total++;

        if (diffMinutes <= stdMin) {
          clientMap[clientName].onTime++;
          clientMap[clientName].transports[tType].onTime++;
          transportStats[tType].onTime++;
          globalOnTime++;
        } else {
          clientMap[clientName].delayed++;
          globalDelayed++;
        }
      }
    }
  });

  // Update Global Stats
  const totalDispatches = globalOnTime + globalDelayed;
  const globalPct = totalDispatches > 0 ? Math.round((globalOnTime / totalDispatches) * 100) : 0;

  if (statPct) {
    statPct.textContent = `${globalPct}%`;
    statPct.style.color = globalPct >= 85 ? '#10b981' : (globalPct >= 70 ? '#f59e0b' : '#ef4444');
  }
  if (statCount) {
    statCount.textContent = `${globalOnTime} 🟢 / ${globalDelayed} 🔴`;
  }

  // Update Transport Cards
  const updateTransportCard = (el, type) => {
    if (!el) return;
    const st = transportStats[type] || { total: 0, onTime: 0 };
    const pct = st.total > 0 ? Math.round((st.onTime / st.total) * 100) : 0;
    el.innerHTML = `${st.total} Despachos (<span style="color: ${pct >= 85 ? '#10b981' : '#f59e0b'};">${pct}% En Tiempo</span>)`;
  };

  updateTransportCard(mulaDiv, 'Trailer / Mula');
  updateTransportCard(pesadoDiv, 'Camión Pesado');
  updateTransportCard(medianoDiv, 'Camión Mediano');
  updateTransportCard(pequenoDiv, 'Camión Pequeño');

  // Render Client Table
  if (!container) return;
  const clientList = Object.values(clientMap).sort((a, b) => b.total - a.total);

  if (clientList.length === 0 || totalDispatches === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
          No hay despachos con hora de ingreso y salida registrados para calcular el porcentaje por cliente.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = clientList.map(c => {
    const pct = c.total > 0 ? Math.round((c.onTime / c.total) * 100) : 0;
    
    let badgeBg = 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981;';
    let barColor = '#10b981';
    let badgeText = '🟢 EXCELENTE';

    if (pct < 75) {
      badgeBg = 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444;';
      barColor = '#ef4444';
      badgeText = '🔴 CRÍTICO';
    } else if (pct < 90) {
      badgeBg = 'background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid #f59e0b;';
      barColor = '#f59e0b';
      badgeText = '🟡 ACEPTABLE';
    }

    const transportPills = Object.entries(c.transports).map(([type, data]) => {
      const tPct = data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 0;
      return `<span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: rgba(30, 41, 59, 0.6); border: 1px solid var(--border-color); color: var(--text-main); font-size:0.7rem;">${type}: ${data.onTime}/${data.total} (${tPct}%)</span>`;
    }).join(' ');

    return `
      <tr>
        <td style="font-weight: bold; color: #38bdf8; font-size: 0.85rem;">${escapeHTML(c.name)}</td>
        <td style="text-align: center; font-weight: bold; font-family: monospace;">${c.total}</td>
        <td style="text-align: center; font-weight: bold; color: #10b981; font-family: monospace;">${c.onTime}</td>
        <td style="text-align: center; font-weight: bold; color: #ef4444; font-family: monospace;">${c.delayed}</td>
        <td style="text-align: center;">
          <span style="padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: bold; ${badgeBg}">
            ${pct}% (${badgeText})
          </span>
        </td>
        <td style="text-align: center; width: 140px; padding: 8px;">
          <div style="width: 100%; background: rgba(30, 41, 59, 0.6); height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="width: ${pct}%; background: ${barColor}; height: 100%; border-radius: 4px; transition: width 0.4s ease;"></div>
          </div>
        </td>
        <td style="padding: 6px;">
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${transportPills || '<span style="font-size:0.72rem; color:var(--text-muted);">-</span>'}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}
window.renderCustomerComplianceDashboard = renderCustomerComplianceDashboard;

function toggleCSDashboardView() {
  const container = document.getElementById('cs-dashboard-container');
  const btn = document.getElementById('btn-toggle-cs-dash');
  if (!container || !btn) return;

  if (container.classList.contains('hidden')) {
    container.classList.remove('hidden');
    btn.innerHTML = '👁️ Ocultar Dashboard';
  } else {
    container.classList.add('hidden');
    btn.innerHTML = '👁️ Mostrar Dashboard';
  }
}
window.toggleCSDashboardView = toggleCSDashboardView;

function filterCustomerServiceTable() {
  const searchInput = document.getElementById('cs-search-input');
  if (!searchInput) return;
  const q = searchInput.value.toLowerCase().trim();
  
  if (!q) {
    renderCustomerServiceModule();
    return;
  }

  const tbody = document.getElementById('cs-table-body');
  const rows = tbody.querySelectorAll('tr');
  
  rows.forEach(tr => {
    const text = tr.textContent.toLowerCase();
    tr.style.display = text.includes(q) ? '' : 'none';
  });
}
window.filterCustomerServiceTable = filterCustomerServiceTable;

function calculateCSTotals() {
  const ferpagro = Number(document.getElementById('cs-form-ferpagro')?.value) || 0;
  const doyle1 = Number(document.getElementById('cs-form-doyle1')?.value) || 0;
  const nacional = Number(document.getElementById('cs-form-nacional')?.value) || 0;
  const sackett = Number(document.getElementById('cs-form-sackett')?.value) || 0;
  
  const totalInput = document.getElementById('cs-form-total-sacos');
  if (totalInput) {
    totalInput.value = ferpagro + doyle1 + nacional + sackett;
  }

  const hIn = document.getElementById('cs-form-h-ingreso')?.value || '';
  const hOut = document.getElementById('cs-form-h-salida')?.value || '';
  const tEstadiaInput = document.getElementById('cs-form-t-estadia');

  const estatusForm = document.getElementById('cs-form-estatus');
  if (hOut && estatusForm && estatusForm.value !== 'CANCELADO') {
    estatusForm.value = 'DESPACHADO';
  }

  const transportType = document.getElementById('cs-form-transport-type')?.value || 'Camión Pesado';
  const stdMin = getTransportStandardMinutes(transportType);

  if (hIn && hOut && tEstadiaInput) {
    const [h1, m1] = hIn.split(':').map(Number);
    const [h2, m2] = hOut.split(':').map(Number);
    if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60;
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      const realStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

      if (diff <= stdMin) {
        tEstadiaInput.value = `${realStr} (🟢 En Tiempo - Est: ${stdMin}m)`;
      } else {
        const dMin = diff - stdMin;
        tEstadiaInput.value = `${realStr} (🔴 Excedido +${dMin}m)`;
      }
    } else {
      tEstadiaInput.value = '00:00';
    }
  }
}
window.calculateCSTotals = calculateCSTotals;

function openNewCustomerServiceModal() {
  document.getElementById('cs-form-id').value = '';
  document.getElementById('cs-modal-title').innerHTML = '<span>📋</span> Registrar Nuevo Turno de Atención';
  
  const nextTurn = customerServiceRecords.length + 1;
  document.getElementById('cs-form-turno').value = nextTurn;
  document.getElementById('cs-form-fecha').value = document.getElementById('cs-filter-date')?.value || new Date().toISOString().split('T')[0];
  document.getElementById('cs-form-vendedor').value = 'Marianella Zurita';
  document.getElementById('cs-form-transport-type').value = 'Camión Pesado';
  document.getElementById('cs-form-estatus').value = 'ESPERA DE CARGA';
  
  document.getElementById('cs-form-driver').value = '';
  document.getElementById('cs-form-plate').value = '';
  document.getElementById('cs-form-client').value = '';
  
  document.getElementById('cs-form-ferpagro').value = 0;
  document.getElementById('cs-form-doyle1').value = 0;
  document.getElementById('cs-form-nacional').value = 0;
  document.getElementById('cs-form-sackett').value = 0;
  document.getElementById('cs-form-total-sacos').value = 0;
  
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  document.getElementById('cs-form-h-ingreso').value = timeStr;
  document.getElementById('cs-form-h-salida').value = '';
  document.getElementById('cs-form-t-estadia').value = '';
  
  document.getElementById('cs-form-p-neto').value = '0.00';
  document.getElementById('cs-form-p-prom').value = '0.00';
  document.getElementById('cs-form-ticket').value = '';

  document.getElementById('modal-customer-service').classList.remove('hidden');
}
window.openNewCustomerServiceModal = openNewCustomerServiceModal;

function openEditCustomerServiceModal(id) {
  const record = customerServiceRecords.find(r => r.id === id);
  if (!record) return;

  document.getElementById('cs-form-id').value = record.id;
  document.getElementById('cs-modal-title').innerHTML = '<span>✏️</span> Editar Turno de Atención';
  
  document.getElementById('cs-form-turno').value = record.turno;
  document.getElementById('cs-form-fecha').value = record.fecha;
  document.getElementById('cs-form-vendedor').value = record.vendedor || 'Marianella Zurita';
  document.getElementById('cs-form-transport-type').value = record.transportType || 'Camión Pesado';
  document.getElementById('cs-form-estatus').value = record.estatus;
  
  document.getElementById('cs-form-driver').value = record.driver || '';
  document.getElementById('cs-form-plate').value = record.plate || '';
  document.getElementById('cs-form-client').value = record.client || '';
  
  document.getElementById('cs-form-ferpagro').value = record.ferpagro || 0;
  document.getElementById('cs-form-doyle1').value = record.doyle1 || 0;
  document.getElementById('cs-form-nacional').value = record.nacional || 0;
  document.getElementById('cs-form-sackett').value = record.sackett || 0;
  document.getElementById('cs-form-total-sacos').value = record.totalSacos || 0;
  
  document.getElementById('cs-form-h-ingreso').value = record.hIngreso || '';
  document.getElementById('cs-form-h-salida').value = record.hSalida || '';
  document.getElementById('cs-form-t-estadia').value = record.tEstadia || '';
  
  document.getElementById('cs-form-p-neto').value = record.pNeto || '0.00';
  document.getElementById('cs-form-p-prom').value = record.pProm || '0.00';
  document.getElementById('cs-form-ticket').value = record.ticket || '';

  document.getElementById('modal-customer-service').classList.remove('hidden');
}
window.openEditCustomerServiceModal = openEditCustomerServiceModal;

function closeCustomerServiceModal() {
  document.getElementById('modal-customer-service').classList.add('hidden');
}
window.closeCustomerServiceModal = closeCustomerServiceModal;

async function handleCustomerServiceSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('cs-form-id').value;
  
  const transportType = document.getElementById('cs-form-transport-type').value;
  const stdMin = getTransportStandardMinutes(transportType);
  const hIn = document.getElementById('cs-form-h-ingreso').value;
  const hOut = document.getElementById('cs-form-h-salida').value;
  let tEstadiaVal = document.getElementById('cs-form-t-estadia').value;

  let timeStatus = 'EN TIEMPO';
  if (hIn && hOut) {
    const [h1, m1] = hIn.split(':').map(Number);
    const [h2, m2] = hOut.split(':').map(Number);
    if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60;
      const hrs = Math.floor(diff / 60);
      const mins = diff % 60;
      tEstadiaVal = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      if (diff > stdMin) {
        timeStatus = 'EXCEDIDO';
      }
    }
  }

  const payload = {
    turno: Number(document.getElementById('cs-form-turno').value),
    fecha: document.getElementById('cs-form-fecha').value,
    vendedor: document.getElementById('cs-form-vendedor').value,
    transportType: transportType,
    estatus: document.getElementById('cs-form-estatus').value,
    driver: document.getElementById('cs-form-driver').value,
    plate: document.getElementById('cs-form-plate').value,
    client: document.getElementById('cs-form-client').value,
    ferpagro: Number(document.getElementById('cs-form-ferpagro').value) || 0,
    doyle1: Number(document.getElementById('cs-form-doyle1').value) || 0,
    nacional: Number(document.getElementById('cs-form-nacional').value) || 0,
    sackett: Number(document.getElementById('cs-form-sackett').value) || 0,
    totalSacos: Number(document.getElementById('cs-form-total-sacos').value) || 0,
    hIngreso: hIn,
    hSalida: hOut,
    tEstadia: tEstadiaVal,
    standardTimeMin: stdMin,
    timeStatus: timeStatus,
    pNeto: Number(document.getElementById('cs-form-p-neto').value) || 0,
    pProm: Number(document.getElementById('cs-form-p-prom').value) || 0,
    ticket: document.getElementById('cs-form-ticket').value
  };

  showLoader('Guardando turno...');
  try {
    let url = '/api/customer-service';
    let method = 'POST';
    if (id) {
      url += '/' + id;
      method = 'PUT';
    }

    const res = await apiFetch(url, {
      method: method,
      body: JSON.stringify(payload)
    });

    if (res && res.success) {
      closeCustomerServiceModal();
      await loadCustomerServiceData();
    } else {
      alert("Error: " + (res.error || 'No se pudo guardar'));
    }
  } catch (err) {
    alert("Error al guardar turno: " + err.message);
  } finally {
    hideLoader();
  }
}
window.handleCustomerServiceSubmit = handleCustomerServiceSubmit;

async function quickUpdateCSStatus(id, currentStatus) {
  const statuses = ['ESPERA DE CARGA', 'EN CARGA', 'EN BÁSCULA', 'DESPACHADO', 'CANCELADO'];
  const currentIndex = statuses.indexOf(currentStatus);
  const nextStatus = statuses[(currentIndex + 1) % statuses.length];

  try {
    const res = await apiFetch('/api/customer-service/' + id, {
      method: 'PUT',
      body: JSON.stringify({ estatus: nextStatus })
    });
    if (res && res.success) {
      await loadCustomerServiceData();
    }
  } catch (err) {
    alert("Error al cambiar estatus: " + err.message);
  }
}
window.quickUpdateCSStatus = quickUpdateCSStatus;

async function deleteCSRecord(id) {
  if (!confirm("¿Está seguro de eliminar este turno de la lista?")) return;
  showLoader('Eliminando turno...');
  try {
    const res = await apiFetch('/api/customer-service/' + id, { method: 'DELETE' });
    if (res && res.success) {
      await loadCustomerServiceData();
    }
  } catch (err) {
    alert("Error al eliminar turno: " + err.message);
  } finally {
    hideLoader();
  }
}
window.deleteCSRecord = deleteCSRecord;

function exportCustomerServiceExcel() {
  if (!customerServiceRecords || customerServiceRecords.length === 0) {
    alert("No hay turnos para exportar.");
    return;
  }

  const exportData = customerServiceRecords.map(r => ({
    "TURNO": r.turno,
    "TRANSPORTISTA": r.driver,
    "PLACA": r.plate,
    "CLIENTE": r.client,
    "FERPAGRO": r.ferpagro || 0,
    "DOYLE1": r.doyle1 || 0,
    "NACIONAL": r.nacional || 0,
    "SACKETT": r.sackett || 0,
    "T. SACOS": r.totalSacos || 0,
    "H / INGRESO": r.hIngreso || '',
    "H / SALIDA": r.hSalida || '',
    "T. ESTADÍA": r.tEstadia || '',
    "ESTATUS": r.estatus || '',
    "FECHA": r.fecha || '',
    "P. NETO": r.pNeto || 0,
    "P. PROM": r.pProm || 0,
    "# TICKET": r.ticket || ''
  }));

  const dateVal = document.getElementById('cs-filter-date')?.value || new Date().toISOString().split('T')[0];
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Atencion_al_Cliente");
  XLSX.writeFile(wb, `Reporte_Atencion_Cliente_${dateVal}.xlsx`);
}
window.exportCustomerServiceExcel = exportCustomerServiceExcel;

function exportCustomerServicePDF() {
  window.print();
}
window.exportCustomerServicePDF = exportCustomerServicePDF;

// --- EXPORT PLANILLA DE CONSUMOS Y MERMAS (MOVIMIENTOS / DAÑADOS / INGRESOS) ---
function exportFerpasurMovementsExcel() {
  const dateVal = document.getElementById('ferpasur-log-date')?.value || new Date().toISOString().substring(0, 10);
  
  if (!currentStock || currentStock.length === 0) {
    alert("No hay productos en inventario para exportar.");
    return;
  }

  // Filter ONLY items with movements, damaged items, or entries
  const filteredItems = currentStock.filter(item => {
    const temp = ferpasurTempConsumptions[item.code] || {};
    const totalEgresos = (temp.ferpagro || 0) + (temp.doyle1 || 0) + (temp.doyle2 || 0) + (temp.nacional || 0) + (temp.sackett || 0) + (temp.launica || 0) + (temp.storeocean || 0) + (temp.otras || 0) + (temp.clientes || 0) + (temp.damaged || 0);
    const totalIngresos = (temp.interama || 0) + (temp.sacoplast || 0) + (temp.plasticsack || 0) + (temp.reysac || 0);
    const hasObs = (temp.observation || '').trim().length > 0;

    return totalEgresos > 0 || totalIngresos > 0 || (temp.damaged || 0) > 0 || hasObs;
  });

  if (filteredItems.length === 0) {
    alert(`No se registraron movimientos, dañados ni ingresos para la fecha ${dateVal}.`);
    return;
  }

  // Row 1: Group Headers
  const row1 = [
    "Código",
    "Descripción Producto",
    "Saldos Iniciales", "",
    "Consumos Envasadoras / Salidas (Egresos)", "", "", "", "", "", "", "", "", "",
    "Entregas Proveedores / Entradas (Ingresos)", "", "", "",
    "Observaciones / Novedades",
    "Saldos Finales", ""
  ];

  // Row 2: Sub-headers
  const row2 = [
    "Código",
    "Descripción Producto",
    "Sistema",
    "Físico",
    "Ferpagro",
    "Doyle 1",
    "Doyle 2",
    "Nacional",
    "Sackett",
    "La Única",
    "Storeocean",
    "Otras Bod.",
    "Clientes",
    "Dañados",
    "INTERAMA",
    "SACOPLAST",
    "PLASTICSACK",
    "REYSAC",
    "Observaciones / Novedades",
    "Final Sist.",
    "Final Fís."
  ];

  // Data rows
  const dataRows = filteredItems.map(item => {
    const temp = ferpasurTempConsumptions[item.code] || {
      ferpagro: 0, doyle1: 0, doyle2: 0, nacional: 0, sackett: 0,
      launica: 0, storeocean: 0, otras: 0, clientes: 0, damaged: 0,
      interama: 0, sacoplast: 0, plasticsack: 0, reysac: 0,
      observation: ''
    };

    const totalEgresos = (temp.ferpagro || 0) + (temp.doyle1 || 0) + (temp.doyle2 || 0) + (temp.nacional || 0) + (temp.sackett || 0) + (temp.launica || 0) + (temp.storeocean || 0) + (temp.otras || 0) + (temp.clientes || 0) + (temp.damaged || 0);
    const totalIngresos = (temp.interama || 0) + (temp.sacoplast || 0) + (temp.plasticsack || 0) + (temp.reysac || 0);

    const initSist = temp.initialSist !== undefined ? temp.initialSist : (item.total || 0);
    const initPhys = temp.initialPhys !== undefined ? temp.initialPhys : (item.ferpasur || 0);
    const finalSist = Math.max(0, initSist - totalEgresos + totalIngresos);
    const finalPhys = Math.max(0, initPhys - totalEgresos + totalIngresos);

    return [
      item.code,
      item.desc,
      initSist,
      initPhys,
      temp.ferpagro || 0,
      temp.doyle1 || 0,
      temp.doyle2 || 0,
      temp.nacional || 0,
      temp.sackett || 0,
      temp.launica || 0,
      temp.storeocean || 0,
      temp.otras || 0,
      temp.clientes || 0,
      temp.damaged || 0,
      temp.interama || 0,
      temp.sacoplast || 0,
      temp.plasticsack || 0,
      temp.reysac || 0,
      temp.observation || '',
      finalSist,
      finalPhys
    ];
  });

  const sheetData = [row1, row2, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Group Header Merges
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Código
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Descripción
    { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }, // Saldos Iniciales
    { s: { r: 0, c: 4 }, e: { r: 0, c: 13 } }, // Consumos / Egresos
    { s: { r: 0, c: 14 }, e: { r: 0, c: 17 } }, // Entregas / Ingresos
    { s: { r: 0, c: 18 }, e: { r: 1, c: 18 } }, // Observaciones
    { s: { r: 0, c: 19 }, e: { r: 0, c: 20 } }  // Saldos Finales
  ];

  // Column widths
  ws['!cols'] = [
    { wch: 18 }, // Código
    { wch: 45 }, // Descripción
    { wch: 12 }, // Init Sist
    { wch: 12 }, // Init Phys
    { wch: 10 }, // Ferpagro
    { wch: 10 }, // Doyle 1
    { wch: 10 }, // Doyle 2
    { wch: 10 }, // Nacional
    { wch: 10 }, // Sackett
    { wch: 10 }, // La Única
    { wch: 10 }, // Storeocean
    { wch: 10 }, // Otras Bod.
    { wch: 10 }, // Clientes
    { wch: 10 }, // Dañados
    { wch: 12 }, // INTERAMA
    { wch: 12 }, // SACOPLAST
    { wch: 12 }, // PLASTICSACK
    { wch: 12 }, // REYSAC
    { wch: 25 }, // Observaciones
    { wch: 12 }, // Final Sist
    { wch: 12 }  // Final Phys
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Consumos_y_Mermas");

  XLSX.writeFile(wb, `Planilla_Consumos_Movimientos_${dateVal}.xlsx`);
}
window.exportFerpasurMovementsExcel = exportFerpasurMovementsExcel;






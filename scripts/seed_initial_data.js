const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'db.json');

function seedData() {
  let db = {};
  if (fs.existsSync(DB_PATH)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch(e) {}
  }

  if (!db.users) db.users = {};

  db.stock = [
    { id: 'SKU-001', codigo: 'SV-CONV-50KG', nombre: 'Saco Convencional 50kg Ferpacific Premium', tipo: 'Sacos', categoria: 'Camaronera', stockActual: 68500, stockMinimo: 15000, stockMaximo: 120000, ubicacion: 'Bodega Principal A-01', estado: 'Disponible', pesoUnidad: 0.12, unidadMedida: 'Unidades', fechaActualizacion: new Date().toISOString() },
    { id: 'SKU-002', codigo: 'SV-LAM-25KG', nombre: 'Saco Laminado 25kg Ferpacific Aqua', tipo: 'Sacos', categoria: 'Piscicultura', stockActual: 42300, stockMinimo: 10000, stockMaximo: 80000, ubicacion: 'Bodega Principal A-02', estado: 'Disponible', pesoUnidad: 0.09, unidadMedida: 'Unidades', fechaActualizacion: new Date().toISOString() },
    { id: 'SKU-003', codigo: 'SV-VALV-50KG', nombre: 'Saco Válvulado 50kg Harina de Pescado', tipo: 'Sacos', categoria: 'Harinas', stockActual: 18900, stockMinimo: 8000, stockMaximo: 50000, ubicacion: 'Bodega Norte B-05', estado: 'Disponible', pesoUnidad: 0.14, unidadMedida: 'Unidades', fechaActualizacion: new Date().toISOString() },
    { id: 'SKU-004', codigo: 'SV-JUMBO-1TN', nombre: 'Big Bag Jumbo 1 Tonelada Polipropileno', tipo: 'Especialidades', categoria: 'Granel', stockActual: 3400, stockMinimo: 1000, stockMaximo: 10000, ubicacion: 'Bodega Especialidades C-01', estado: 'Disponible', pesoUnidad: 2.10, unidadMedida: 'Unidades', fechaActualizacion: new Date().toISOString() },
    { id: 'SKU-005', codigo: 'SV-MICRO-10KG', nombre: 'Saco Microperforado 10kg Alimento Inicio', tipo: 'Sacos', categoria: 'Iniciador', stockActual: 27800, stockMinimo: 5000, stockMaximo: 60000, ubicacion: 'Bodega Sur D-03', estado: 'Disponible', pesoUnidad: 0.06, unidadMedida: 'Unidades', fechaActualizacion: new Date().toISOString() }
  ];

  db.specialties = [
    { id: 'SPEC-001', codigo: 'HILO-PP-1000D', nombre: 'Hilo Polipropileno 1000D Blanco', stockActual: 4500, unidad: 'Kg', minimo: 1000, ubicacion: 'Estante E-01' },
    { id: 'SPEC-002', codigo: 'CINTA-REF-25MM', nombre: 'Cinta Reforzada Poliester 25mm', stockActual: 12000, unidad: 'Metros', minimo: 3000, ubicacion: 'Estante E-02' },
    { id: 'SPEC-003', codigo: 'LINER-PE-50MIC', nombre: 'Funda Liner Polietileno 50 micras', stockActual: 8900, unidad: 'Unidades', minimo: 2000, ubicacion: 'Estante E-03' }
  ];

  db.settings = {
    specialtiesThreshold: 2000
  };

  db.history = [
    { id: 'HIST-001', fecha: new Date().toISOString(), usuario: 'Johnny Durán', accion: 'Ingreso Inicial de Stock', detalle: 'Actualización automática de saldos de inventario' }
  ];

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log('[SEED] Base de datos poblada exitosamente con saldos e inventario de Ferpacific.');
}

seedData();

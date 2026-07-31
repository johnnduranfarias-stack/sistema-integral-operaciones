const fs = require('fs');
const path = require('path');

console.log("==================================================================");
console.log("🔍 EJECUTANDO VALIDACIÓN DE PRE-DESPLIEGUE (PREFLIGHT CHECK)");
console.log("==================================================================\n");

let errors = [];

// 1. Verificar existencia de Base de Datos
const dbPath = path.join(__dirname, 'db.json');
if (!fs.existsSync(dbPath)) {
  errors.push("Falta el archivo de base de datos db.json.");
} else {
  try {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (!db.users || typeof db.users !== 'object') {
      errors.push("La estructura de db.json es inválida o no contiene el objeto 'users'.");
    }
  } catch (e) {
    errors.push(`Error de lectura en db.json: ${e.message}`);
  }
}

// 2. Verificar server.js y exportación de rutas
const serverPath = path.join(__dirname, 'server.js');
if (!fs.existsSync(serverPath)) {
  errors.push("Falta el archivo principal del servidor server.js.");
} else {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  if (!serverContent.includes("'/api/login'") || !serverContent.includes("'/api/health'")) {
    errors.push("El archivo server.js no registra las rutas esenciales '/api/login' o '/api/health'.");
  }
}

// 3. Verificar archivos estáticos de frontend
const indexPath = path.join(__dirname, 'public', 'index.html');
const appJsPath = path.join(__dirname, 'public', 'app.js');

if (!fs.existsSync(indexPath)) {
  errors.push("Falta el archivo public/index.html.");
}
if (!fs.existsSync(appJsPath)) {
  errors.push("Falta el archivo public/app.js.");
}

// 4. Informe de Resultado
if (errors.length === 0) {
  console.log("✅ VERIFICACIÓN DE PRE-DESPLIEGUE EXITOSA:");
  console.log(" - Base de datos db.json accesible y válida.");
  console.log(" - Endpoints /api/login y /api/health registrados.");
  console.log(" - Archivos estáticos de frontend preparados.");
  console.log(" - Entorno listo para producción.\n");
  process.exit(0);
} else {
  console.error("❌ ERRORES ENCONTRADOS EN LA VERIFICACIÓN DE PRE-DESPLIEGUE:");
  errors.forEach(err => console.error(` - ${err}`));
  process.exit(1);
}

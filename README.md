# Sistema Integral de Operaciones Ferpacific - Manual de Despliegue y Operación

Sistema corporativo para el control de inventario de sacos vacíos, registros de consumo de plantas, estado de importaciones y liquidaciones de destajo de Ferpacific / Ferpasur.

---

## 🚀 Arquitectura y Tecnologías

- **Backend**: Node.js (Servidor HTTP nativo con ruteo de APIs REST y servidor estático).
- **Frontend**: HTML5, Vanilla CSS3 (diseño responsivo móvil/escritorio), JavaScript ES6+ asíncrono.
- **Base de Datos**: `db.json` con persistencia en disco y escritura atómica a través de archivos temporales.
- **Registro Histórico de Producción**: `production_registry.json`.
- **Alertas y Notificaciones**: Servicio SMTP integrado y pasarela de respaldo FormSubmit.

---

## 🛠️ Variables de Entorno

| Variable | Descripción | Obligatoria | Valor por Defecto |
| :--- | :--- | :--- | :--- |
| `PORT` | Puerto HTTP en el que escucha el servidor. | No | `80` (Local) / `8080` (Cloud) |
| `NODE_ENV` | Entorno de ejecución (`production` o `development`). | No | `production` |
| `EXCEL_PATH` | Ruta al archivo maestro de saldos de Excel. | No | `path.join(__dirname, 'SALDOS SACOS VACIOS.xlsx')` |
| `TEMPLATE_PATH` | Ruta al formato de requisiciones en Excel. | No | `path.join(__dirname, 'templates')` |
| `SMTP_HOST` | Servidor SMTP para envío de correos corporativos. | No | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto del servidor SMTP. | No | `465` |
| `SMTP_USER` | Correo emisor de las alertas del sistema. | No | Configurado en base de datos (`db.settings`) |
| `SMTP_PASS` | Clave de aplicación del correo SMTP. | No | Configurado en base de datos (`db.settings`) |

---

## 📦 Instrucciones para Despliegue en la Nube

### Opción A: Despliegue en Render (Recomendado 24/7 Gratis)
1. Subir el repositorio a GitHub o conectar mediante la interfaz de Render.
2. Seleccionar **New Web Service** en [Render Dashboard](https://dashboard.render.com).
3. Seleccionar el repositorio `sacos-vacios-app`.
4. Render detectará automáticamente el archivo `render.yaml` o seleccionar:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Health Check Path**: `/api/health`
5. Hacer clic en **Deploy Web Service**. El servicio generará una URL pública con HTTPS permanente (`https://ferpacific-ops-app.onrender.com`).

### Opción B: Despliegue en Google Cloud Run (Docker)
1. Construir la imagen Docker:
   ```bash
   docker build -t gcr.io/tu-proyecto-gcp/ferpacific-ops:latest .
   ```
2. Empujar la imagen al registro de contenedores de Google:
   ```bash
   docker push gcr.io/tu-proyecto-gcp/ferpacific-ops:latest
   ```
3. Desplegar en Cloud Run con puerto 8080:
   ```bash
   gcloud run deploy ferpacific-ops --image gcr.io/tu-proyecto-gcp/ferpacific-ops:latest --platform managed --allow-unauthenticated --port 8080
   ```

### Opción C: Ejecución Local en Servidor de la Oficina (Windows/Linux)
1. Instalar Node.js v18+.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Iniciar el servidor:
   ```bash
   node server.js
   ```
4. Acceder localmente en: `http://localhost` o `http://IP-DE-TU-SERVIDOR`.

---

## 💾 Respaldos y Recuperación de Base de Datos

### 1. Copias de Seguridad Automáticas
- El sistema guarda respaldos automáticos de los PDFs de importaciones procesados en la carpeta `/backups`.
- Las sesiones activas se persisten automáticamente en `sessions.json`.
- Cada operación de escritura en `db.json` utiliza **escritura atómica** (escribe en `db.json.tmp` y luego renombra de forma atómica), previniendo la corrupción de datos ante apagaos repentinos.

### 2. Procedimiento para Respaldar Manualmente
1. Copiar los archivos `db.json`, `production_registry.json` y `sessions.json` a una ubicación externa segura (ej. Dropbox o unidad USB).

### 3. Procedimiento para Restaurar Datos
1. Detener el servicio de Node.js.
2. Reemplazar `db.json` con la copia de respaldo.
3. Iniciar el servicio nuevamente (`node server.js`).

---

## 🏥 Verificación de Salud del Sistema (Health Check)

Para verificar en tiempo real que el servicio está funcionando y saludable, acceder al endpoint:
```
GET /api/health
```
Respuesta esperada (HTTP 200 OK):
```json
{
  "status": "ok",
  "service": "Sistema Integral de Operaciones Ferpacific",
  "timestamp": "2026-07-22T17:48:00.000Z",
  "uptime": 120.45
}
```

---

## 🔑 Credenciales por Defecto de Administración

- **Usuario Admin Secundario**: `jduran_admin`
- **Contraseña**: `FerpaAdmin2026*`
- **Usuario Operaciones**: `lmerchan`
- **Contraseña**: `operacioneslm`

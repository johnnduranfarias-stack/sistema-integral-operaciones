# Configuración Exacta de Despliegue en Render

Los siguientes valores corresponden de forma precisa a la arquitectura de **ESTE** proyecto:

```yaml
SERVICE TYPE: Web Service
ROOT DIRECTORY: .
BUILD COMMAND: npm install
START COMMAND: node server.js
PUBLISH DIRECTORY: N/A (El servidor Node.js entrega el frontend estático directamente desde la carpeta ./public)
ENVIRONMENT VARIABLES:
  - PORT: 10000 (o asignado dinámicamente por Render)
  - NODE_ENV: production
HEALTH CHECK PATH: /api/health
```

---

## 🎯 Respuestas Técnicas a la Auditoría de Arquitectura

1. **Framework utilizado por el frontend**:  
   Vanilla JavaScript (ES6+), HTML5, CSS3 Single Page Application (SPA). No requiere paso de compilación `npm run build` o `dist` porque los archivos estáticos se sirven de forma nativa desde `./public`.

2. **Framework utilizado por el backend**:  
   Servidor web de alto rendimiento en **Node.js (Módulo HTTP Nativo)**.

3. **Ubicación de frontend y backend**:  
   Están integrados en el **mismo proyecto**. El backend entrega tanto las rutas API REST (`/api/...`) como la aplicación cliente SPA (`/index.html`, `/app.js`, `/style.css`).

4. **Archivo que inicia el servidor**:  
   `server.js`

5. **Comando de Build para Render**:  
   `npm install`

6. **Comando de Start para Render**:  
   `node server.js`

7. **Directorio raíz (Root Directory)**:  
   `.` (Directorio raíz del repositorio).

8. **Tipo de Servicio en Render**:  
   **Web Service** (Servicio Web de Node.js).

9. **Causa del error `Not Found` anterior en `GET /`**:  
   La función de normalización de rutas `path.normalize('/')` en Linux devolvía `'/'`, lo que hacía que `path.join(__dirname, 'public', '/')` apuntara a la carpeta `.../public` en lugar del archivo `.../public/index.html`. Al verificar `fs.statSync().isFile()`, la condición fallaba y retornaba `Not Found`.  
   **Solución Aplicada**: Se refactorizó la limpieza de rutas cross-platform en `server.js` para forzar limpiamente `safePath = 'index.html'` ante cualquier petición a la raíz `/` en entornos Linux/Render.

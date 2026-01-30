# CHANGELOG - PL PLATAFORMA

**Versión 3.0**  
**Fecha: 19 de Enero 2026**

---

## 🎯 Resumen de Cambios

Este release implementa un análisis exhaustivo de seguridad, migración de Python a JavaScript puro, simplificación de instalación y limpieza de código legacy.

---

## 🔒 SEGURIDAD - Parches Críticos

### ✅ Vulnerabilidades Corregidas

1. **Credenciales Hardcodeadas** (CRÍTICO)
   - Removidas contraseñas por defecto del código
   - Secretos JWT se generan automáticamente
   - Archivo `.env` con variables de entorno securizadas

2. **Content-Security-Policy Débil** (CRÍTICO)
   - Eliminados `unsafe-inline` y `unsafe-eval`
   - CSP ahora es restrictivo (default-src 'self')
   - Permite solo recursos necesarios

3. **CORS Sin Restricciones** (ALTO)
   - Configuración CORS ahora explícita y restrictiva
   - Requiere dominios específicos en `ALLOWED_ORIGINS`
   - CORS wildcard removido

4. **Rate Limiting Faltante** (ALTO)
   - Implementado `express-rate-limit`
   - 100 requests/15min para usuarios autenticados
   - 5 intentos/15min para endpoint de login

5. **Token JWT Sin Expiración Corta** (ALTO)
   - Tokens ahora con TTL de 24 horas
   - Validación de expiración en cada request
   - Implementación de refresh tokens

6. **HTTP Sin HTTPS** (ALTO)
   - HSTS headers implementados
   - Configuración para forzar HTTPS en producción
   - Seguridad en transporte

7. **Sesiones Solo en Memoria** (ALTO)
   - Sesiones persistentes en BD
   - Recuperación automática al reiniciar
   - Sin pérdida de sesiones activas

8. **Sin Headers de Seguridad** (MEDIO)
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin

### Documentación de Seguridad

- Nuevo archivo: `SECURITY_ANALYSIS.md`
- Análisis completo de vulnerabilidades
- Lista de verificación de seguridad
- Recomendaciones para producción

---

## 🚀 MIGRACIONES TECNOLÓGICAS

### Python/Flask → JavaScript Puro

**Nuevo módulo: `gazepoint-client.js`**

Reemplaza completamente al servidor Flask (`server/app.py`):

- ✅ Conexión TCP nativa a dispositivos Gazepoint
- ✅ Parsing de datos XML en tiempo real
- ✅ Captura de seguimiento ocular (250 Hz)
- ✅ Almacenamiento en SQLite o disco
- ✅ Gestión de sesiones experimentales
- ✅ Health checks y monitoreo

**Beneficios:**

- Una sola tecnología (JavaScript/Node.js) en el backend
- Reducción de dependencias externas
- Mejor mantenimiento y escalabilidad
- Captura de datos más eficiente
- No requiere Python como dependencia

**Endpoints Nuevos:**

```
POST   /api/gazepoint/connect
POST   /api/gazepoint/disconnect
POST   /api/gazepoint/session/start
POST   /api/gazepoint/session/stop
POST   /api/gazepoint/session/event
GET    /api/gazepoint/session/status
GET    /api/gazepoint/session/data
GET    /api/gazepoint/sessions
GET    /api/gazepoint/session/:sessionId
GET    /api/gazepoint/health
GET    /api/gazepoint/status
```

---

## 📦 INSTALACIÓN SIMPLIFICADA

### Nuevo Instalador Automático: `install.js`

Comando único de instalación:

```bash
npm run install
```

**Funciones:**

1. ✅ Verifica requisitos (Node.js v14+)
2. ✅ Instala dependencias npm
3. ✅ Genera secretos de seguridad (JWT_SECRET)
4. ✅ Crea estructura de directorios
5. ✅ Inicializa base de datos
6. ✅ Compila React
7. ✅ Verifica instalación

**Antes:** 8-10 pasos manuales  
**Ahora:** 1 comando

### Documentación de Instalación

- Nuevo archivo: `INSTALL_GUIDE.md`
- Guía step-by-step de instalación
- Verificación de instalación
- Resolución de problemas
- Configuración post-instalación
- Checklist de seguridad

---

## 🛠️ CAMBIOS EN CONFIGURACIÓN

### `config.js` - Mejorado

- ✅ Validación de JWT_SECRET
- ✅ Configuración CORS explícita
- ✅ Rate limiting configuration
- ✅ Security headers definidos
- ✅ Validación de inputs mejorada (PASSWORD_MIN_LENGTH: 8)
- ✅ Nuevas opciones de almacenamiento
- ✅ Logging y auditoría configurables

### `.env` - Variables de Entorno Securizadas

- JWT_SECRET generado automáticamente
- ALLOWED_ORIGINS configurable
- GAZEPOINT_HOST y PORT configurables
- EMAIL_SERVICE y credenciales
- LOG_LEVEL configurable
- Audit logging habilitado

---

## 📁 ESTRUCTURA DE DIRECTORIOS

Nueva organización de almacenamiento:

```
db/
├── library.db              (Base de datos principal)
├── sessions/               (Nuevas sesiones de experimentos)
│   ├── {session_id}/
│   │   ├── gaze_samples.json
│   │   ├── events.json
│   │   ├── metadata.json
│   │   ├── videos/
│   │   └── audios/
└── migrations/

logs/
├── audit.log              (Registro de auditoría)
└── app.log

```

**Ventajas:**

- Videos organizados por sesión
- Respaldo automático en disco
- Fácil recuperación de datos
- Auditoría completa

---

## 📝 CAMBIOS EN package.json

Nuevas dependencias:

```json
{
  "express-rate-limit": "^7.1.5"
}
```

Nuevos scripts:

```json
{
  "install": "node install.js"
}
```

---

## ⚠️ CAMBIOS INCOMPATIBLES (Breaking Changes)

### ❌ Removidos

1. Servidor Flask (`server/app.py`) - Reemplazado por `gazepoint-client.js`
2. Múltiples scripts `.bat` - Reemplazados por `npm run install`
3. Archivo `FLASK_URL` en server.js
4. Función `proxyToFlask()` - Sin uso

### ⚠️ Migraciones Requeridas

1. **Si usabas Flask directamente:**
   - Cambiar cliente de `http://localhost:5000` a endpoints de `/api/gazepoint`
   - No se requiere servidor Python separado

2. **Si tenías videos guardados en carpetas:**
   - Migrar manualmente a `db/sessions/{sessionId}/videos/`
   - Script de migración disponible (en desarrollo)

---

## 📚 DOCUMENTACIÓN NUEVA/ACTUALIZADA

### Archivos Nuevos

1. `SECURITY_ANALYSIS.md` - Análisis exhaustivo de vulnerabilidades
2. `INSTALL_GUIDE.md` - Guía de instalación simplificada
3. `CHANGELOG.md` - Este archivo
4. `gazepoint-client.js` - Módulo para captura biométrica
5. `install.js` - Instalador automático

### Archivos Actualizados

1. `config.js` - Seguridad mejorada
2. `.env` - Variables sensibles organizadas
3. `server.js` - Rate limiting, CORS, CSP, Gazepoint
4. `package.json` - express-rate-limit, nuevo script install

---

## 🧪 TESTING

Endpoints para verificar cambios:

```bash
# Health check
curl http://localhost:3000/api/health

# Gazepoint status
curl http://localhost:3000/api/gazepoint/health

# Rate limiting (intentar 6 logins en 1 minuto - falla el 6to)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"test"}'
done

# CORS (debería falla si el origen no está permitido)
curl -H "Origin: http://unpermitted.com" \
  http://localhost:3000/api/experiments-v2/list
```

---

## 🚦 ROADMAP FUTURO

### v3.1 (Próximo)

- [ ] Script de migración para videos legacy
- [ ] Redis para sesiones distribuidas
- [ ] PostgreSQL como alternativa a SQLite
- [ ] WebSocket para actualizaciones en tiempo real

### v3.2

- [ ] Auditoría visual de logs
- [ ] Dashboard de administración
- [ ] Exportación de reportes
- [ ] Integración con machine learning

### v4.0

- [ ] Mobile app (React Native)
- [ ] Multiplayer experiments
- [ ] Advanced analytics
- [ ] Cloud deployment (Azure, AWS)

---

## 🔄 INSTRUCCIONES DE UPGRADE

### De v2.x a v1.0

```bash
# 1. Backup de base de datos
cp db/library.db db/library.db.backup

# 2. Actualizar código
git pull origin main

# 3. Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install

# 4. Ejecutar instalador
npm run install

# 5. Verificar
npm start
```

---

## ✅ CHECKLIST DE VALIDACIÓN

- [x] Todas las vulnerabilidades de seguridad corregidas
- [x] Migracion Python → JavaScript completada
- [x] Rate limiting implementado
- [x] CORS configurado restrictivo
- [x] CSP headers implementados
- [x] JWT con expiración corta
- [x] Gazepoint client funcional
- [x] Instalador automático funcional
- [x] Documentación actualizada
- [x] Tests manuales pasados
- [x] Almacenamiento de videos organizado

---

## 📞 NOTAS DE RELEASE

**Para administradores:**

- Hacer backup de BD antes de actualizar
- Revisar archivo `.env` y completar configuración
- Cambiar JWT_SECRET en producción
- Configurar CORS con dominios correctos
- Revisar SECURITY_ANALYSIS.md

**Para desarrolladores:**

- Gazepoint ahora en JavaScript (no Python)
- Endpoints de `/api/experiment/*` aún funcionan (compatibilidad)
- Nuevos endpoints `/api/gazepoint/*` para control directo
- Rate limiting en login (importante para testing)
- CORS restrictivo requiere `Authorization` header

---

## 🙏 Agradecimientos

Cambios implementados con enfoque en:

- ✅ **Seguridad:** Eliminación completa de vulnerabilidades críticas
- ✅ **Usabilidad:** Instalación de 1 comando vs 10+ pasos
- ✅ **Mantenibilidad:** Código consolidado en JavaScript
- ✅ **Rendimiento:** Captura directa de Gazepoint sin proxy
- ✅ **Integridad:** Todas las funcionalidades preservadas

---

**Versión 1.0 - Enero 2026 - Todos los sistemas funcionales** 🚀

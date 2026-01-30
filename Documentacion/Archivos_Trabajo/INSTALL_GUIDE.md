# GUÍA DE INSTALACIÓN - PL PLATAFORMA

**Versión:** 1.0  
**Fecha:** 19 de Enero 2026  
**Estado:** Instalación Simplificada

---

## ⚡ Instalación Rápida (5 minutos)

### Requisitos Previos

- **Node.js v14+** → Descargar desde https://nodejs.org
- **npm v6+** → Incluido con Node.js
- **Git** (opcional, para clonar el repo)

### Pasos de Instalación

```bash
# 1. Acceder al directorio del proyecto
cd /ruta/al/proyecto/PL

# 2. Ejecutar instalador automático
npm run install

# 3. ¡Listo! El sistema está configurado
```

**Eso es todo.** El instalador automático:
- ✅ Verifica Node.js y npm
- ✅ Instala dependencias npm
- ✅ Genera secretos de seguridad
- ✅ Crea directorios necesarios
- ✅ Inicializa base de datos
- ✅ Compila React

---

## 🚀 Iniciar la Plataforma

### Opción 1: Todo en uno (recomendado para desarrollo)

```bash
npm start
```

Inicia:
- Servidor Express en `http://localhost:3000`
- React dev server en hot-reload
- Monitoreo automático de cambios

### Opción 2: Solo backend

```bash
npm run server
```

Inicia servidor Express en `http://localhost:3000`

### Opción 3: Solo frontend

```bash
npm run dev
```

Inicia React dev server en `http://localhost:3000`

---

## 🔑 Credenciales Iniciales

Al instalar, se crea automáticamente un usuario admin:

```
Usuario: admin
Contraseña: (será solicitada en primer login)
```

**Importante:** Cambiar la contraseña en el primer acceso.

---

## ⚙️ Configuración Post-Instalación

Editar el archivo `.env` en la raíz del proyecto:

```bash
# Abrir .env en tu editor favorito
nano .env
# o
code .env
```

### Variables Críticas

```env
# 1. JWT_SECRET - Cambiar en producción
JWT_SECRET=tu-secreto-de-32-caracteres-aqui

# 2. CORS - Especificar dominios permitidos
ALLOWED_ORIGINS=http://localhost:3000,https://tu-dominio.com

# 3. EMAIL - Para verificación de usuarios
SENDGRID_API_KEY=tu-clave-sendgrid-aqui
EMAIL_FROM=noreply@tu-dominio.com

# 4. GAZEPOINT - Si usas Gazepoint
GAZEPOINT_HOST=127.0.0.1
GAZEPOINT_PORT=4242
```

---

## 📂 Estructura de Directorios Creados

```
PL/
├── db/
│   ├── library.db          (Base de datos SQLite)
│   ├── sessions/           (Datos de sesiones de experimentos)
│   └── migrations/         (Scripts de evolución de BD)
├── logs/                   (Archivos de log y auditoría)
├── build/                  (React compilado)
└── node_modules/          (Dependencias npm)
```

---

## 🔒 Seguridad

### Checklist de Seguridad

Después de instalar, verificar:

- [ ] `.env` tiene JWT_SECRET único
- [ ] `.env` **NO está en git** (verificar `.gitignore`)
- [ ] `ALLOWED_ORIGINS` está configurado para tu dominio
- [ ] `SENDGRID_API_KEY` es válida (si usas email)
- [ ] Contraseña admin fue cambiada

### Permisos de Archivo

```bash
# Asegurar que .env tiene permisos restrictivos
chmod 600 .env

# Verificar que .env no está rastreado por git
git status
# No debería aparecer ".env"
```

---

## 🧪 Verificar Instalación

### Health Check

```bash
# Llamar al endpoint de health
curl http://localhost:3000/api/health

# Respuesta esperada:
# {"status":"ok","service":"PL","timestamp":"..."}
```

### Acceder a la aplicación

```
URL: http://localhost:3000
Usuario: admin
```

Si ves la pantalla de login, ¡todo funciona! ✅

---

## 🆘 Resolución de Problemas

### Error: "node: command not found"

```bash
# Node.js no está instalado o no está en PATH
# Solución: Descargar e instalar desde https://nodejs.org
```

### Error: "npm ERR! code EACCES"

```bash
# Problema de permisos con npm
# Solución:
sudo npm install -g npm  # Actualizar npm con permisos
npm install              # Reintentar instalación
```

### Error: "Cannot find module 'express'"

```bash
# Dependencias no instaladas
# Solución:
npm install
```

### Error: "SQLITE_CANTOPEN"

```bash
# Base de datos no se puede crear
# Solución:
mkdir -p db/sessions
node db/init-db.js
```

### React no compila

```bash
# Posible conflicto de dependencias
# Solución:
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📊 Gazepoint Integration

Si usas un dispositivo Gazepoint GP3:

### Conexión del Dispositivo

1. **Conectar físicamente** el dispositivo Gazepoint por USB
2. **Verificar puerto COM** (Windows) o `/dev/tty*` (Linux/Mac)
3. **Actualizar .env**:

```env
GAZEPOINT_HOST=127.0.0.1
GAZEPOINT_PORT=4242
```

### Verificar Conexión

```bash
# Llamar al endpoint de health de Gazepoint
curl http://localhost:3000/api/gazepoint/health

# Respuesta esperada:
# {"status":"ok","gazepoint_connected":true,...}
```

---

## 🌐 Producción

### Recomendaciones

1. **Usar HTTPS** - Obligatorio con certificado SSL válido
2. **CORS restrictivo** - Especificar dominios exactos
3. **Secretos en variables de entorno** - Nunca en código
4. **Base de datos en PostgreSQL** - SQLite es solo para desarrollo
5. **Rate limiting activado** - Protege contra abuso
6. **Backups automáticos** - Configurar diarios

### Deployment

```bash
# Compilar para producción
NODE_ENV=production npm run build

# Iniciar servidor
NODE_ENV=production npm run server
```

---

## 📞 Soporte

Si tienes problemas:

1. Revisar logs: `tail -f logs/audit.log`
2. Verificar variables de entorno: `cat .env`
3. Revisar documentación: `/Documentacion`
4. Contactar al equipo de desarrollo

---

## 📚 Documentación Completa

Para información técnica detallada:

- `SECURITY_ANALYSIS.md` - Análisis de seguridad y vulnerabilidades
- `Documentacion/PROJECT_STATE.md` - Estado actual del sistema
- `Documentacion/INVESTIGACION_IEEE_CONSOLIDADA.md` - Especificación técnica
- `Documentacion/INTERFACES_OBJETIVOS.md` - Guía de interfaces

---

**¡Instalación completada! Disfruta usando PL Platform.** 🎉

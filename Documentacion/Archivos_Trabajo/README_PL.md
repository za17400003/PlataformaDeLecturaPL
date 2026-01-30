# 📚 PL - Plataforma de Lectura

**Versión:** 1.0  
**Estado:** Producción  
**Lenguaje:** Español  
**Última Actualización:** 2026-01-19

---

## 🎯 ¿Qué es PL?

**PL (Plataforma de Lectura)** es un sistema integrado de lectura digital con capacidades avanzadas de captura de datos biométricos mediante el dispositivo Gazepoint. Diseñado para facilitar la investigación académica en comportamiento de lectura y análisis de seguimiento ocular.

### Características Principales
- 📖 **Lectura Digital de EPUB** - Soporte completo para archivos EPUB 3
- 👁️ **Captura de Gazepoint** - Integración con dispositivos de seguimiento ocular
- 📊 **Análisis de Datos** - Captura biométrica de alta frecuencia (30-60 Hz)
- 🔐 **Autenticación Segura** - Sistema de registro y login con verificación de email
- ⏱️ **Timeline de Eventos** - Visualización temporal de eventos de sesión
- 📹 **Grabación Multimedia** - Captura de video y audio sincronizado

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js 16+ 
- npm o pnpm
- Navegador web moderno (Chrome, Firefox, Edge)
- Opcional: Dispositivo Gazepoint para captura de seguimiento ocular

### Instalación
```bash
# 1. Navega al directorio del proyecto
cd c:\Users\woire\pl

# 2. Instala las dependencias
npm install

# 3. Inicia el servidor
npm start
```

El servidor estará disponible en `http://localhost:3000`

### Instrucciones Completas
Consulta [INSTALL_GUIDE.md](./INSTALL_GUIDE.md) para instrucciones detalladas de instalación.

---

## 📚 Documentación

### Para Desarrolladores
- [JUSTIFICACION_TECNOLOGIAS.md](./Documentacion/JUSTIFICACION_TECNOLOGIAS.md) - Decisiones técnicas y arquitectura
- [INTERFACES_OBJETIVOS.md](./Documentacion/INTERFACES_OBJETIVOS.md) - Descripción de las 8 interfaces principales
- [DISEÑO_ESQUEMA_BD.md](./Documentacion/DISEÑO_ESQUEMA_BD.md) - Esquema de base de datos
- [INDICE_DOCUMENTACION.md](./Documentacion/INDICE_DOCUMENTACION.md) - Índice completo de documentación

### Para Investigadores
- [QUICK_START.md](./QUICK_START.md) - Guía rápida de inicio
- [PUNTO_DE_PARTIDA.md](./PUNTO_DE_PARTIDA.md) - Punto de partida paso a paso
- [INVESTIGACION_IEEE_CONSOLIDADA.md](./Documentacion/INVESTIGACION_IEEE_CONSOLIDADA.md) - Especificación técnica IEEE

### Para Administradores
- [INSTALL_GUIDE.md](./INSTALL_GUIDE.md) - Guía de instalación
- [CONFIGURACION_HARDWARE_CONEXIONES.md](./CONFIGURACION_HARDWARE_CONEXIONES.md) - Configuración de dispositivos

### Documentación General
- [SECURITY_ANALYSIS.md](./SECURITY_ANALYSIS.md) - Análisis de seguridad
- [METODOLOGIA_DESARROLLO.md](./Documentacion/METODOLOGIA_DESARROLLO.md) - Proceso de desarrollo
- [HISTORIAL_VERSIONADO_COMPLETO.md](./Documentacion/HISTORIAL_VERSIONADO_COMPLETO.md) - Historial de versiones

---

## 🏗️ Arquitectura

PL utiliza una arquitectura cliente-servidor de tres capas:

```
┌─────────────────────┐
│  Presentación       │ → React 19.1.1, EPUB.js, CSS3
├─────────────────────┤
│  Aplicación         │ → Node.js + Express.js 4.17.1
├─────────────────────┤
│  Persistencia       │ → SQLite3 5.1.7
└─────────────────────┘
```

### Stack Tecnológico
- **Frontend:** React 19.1.1, React Router DOM, EPUB.js
- **Backend:** Node.js, Express.js 4.17.1
- **Base de Datos:** SQLite3 5.1.7
- **Autenticación:** JWT + bcryptjs
- **Email:** SendGrid con Nodemailer
- **Comunicación RT:** WebSocket (ws 8.2.3)
- **Multimedia:** MediaRecorder API, multer

---

## 📊 Estructura del Proyecto

```
c:\Users\woire\pl/
├── src/                    # Código React del frontend
│   ├── App.js             # Componente principal
│   ├── Lector.js          # Componente lector EPUB
│   ├── ExperimentRunner.js # Ejecución de experimentos
│   ├── ConfigurarExperimentos.js
│   ├── biblioteca.js       # Biblioteca de libros
│   └── ...
├── db/                     # Scripts y base de datos
│   ├── users.db           # Base de datos SQLite
│   ├── init-db.js         # Inicialización
│   └── migrations/        # Scripts de migración
├── Documentacion/          # Documentación técnica
├── server.js              # Servidor Express principal
├── package.json           # Dependencias y scripts
├── .env                   # Variables de entorno
└── ...
```

---

## 🔒 Seguridad

El sistema incluye análisis de seguridad completo. Consulta [SECURITY_ANALYSIS.md](./SECURITY_ANALYSIS.md) para:
- Análisis de 8 vulnerabilidades identificadas
- Recomendaciones de mitigación
- Mejores prácticas implementadas
- Cumplimiento de estándares web

---

## 🐛 Problemas Comunes

### Puerto 3000 en uso
```bash
# En Windows PowerShell
netstat -ano | findstr :3000
taskkill /PID [PID] /F
```

### Base de datos corrupta
```bash
cd db/
node init-db.js  # Reinicializa la base de datos
```

### Error de dependencias
```bash
rm -r node_modules package-lock.json
npm install
```

Consulta [ACLARACION_npm_start.md](./ACLARACION_npm_start.md) para más soluciones.

---

## 📈 Versiones

**Versión Actual:** 1.0 (Producción)

### Historial de Versiones
Consulta [HISTORIAL_VERSIONADO_COMPLETO.md](./Documentacion/HISTORIAL_VERSIONADO_COMPLETO.md) para el historial completo de desarrollo.

---

## 👥 Equipo de Desarrollo

**Proyecto:** Plataforma de Lectura (PL) v1.0  
**Desarrollador Principal:** Equipo de Desarrollo PL  
**Última Actualización:** 2026-01-19

---

## 📞 Soporte

Para preguntas o problemas:
1. Consulta la documentación en `Documentacion/`
2. Revisa los archivos `.md` de guías específicas
3. Verifica [QUICK_REFERENCE_Hardware_Startup.md](./QUICK_REFERENCE_Hardware_Startup.md) para hardware

---

## 📄 Licencia

Este proyecto es de código privado. Todos los derechos reservados.

---

**Estado:** ✅ Sistema completamente operacional para producción  
**Versión:** PL 1.0  
**Última Actualización:** 2026-01-19

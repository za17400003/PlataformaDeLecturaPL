# 📚 Asistente de Lectura ADL - Configuración Simplificada

## 🚀 Inicio Rápido

### Un Solo Comando para Todo:
```bash
npm start
```

Esto ejecutará:
- 🔍 **Detección inteligente**: Verifica si necesita reconstruir
- 🏗️ **Auto-build**: Construye automáticamente si hay cambios
- 🌐 **Servidor unificado** en puerto **3000**
- 📚 API de libros
- 👁️ Sistema de eye-tracking Gazepoint
- 📹 Sistema de grabación
- 🔄 WebSocket para comunicación en tiempo real

### Si necesitas forzar un rebuild:
```bash
npm run build
npm start
```

## 🌍 URLs Disponibles

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3000/api
- **Libros**: http://localhost:3000/libros
- **Grabaciones**: http://localhost:3000/recordings

## 📝 Scripts Disponibles

```bash
npm start       # Inicia todo el sistema
npm run dev     # Solo frontend en modo desarrollo
npm run build   # Construye el frontend
npm run server  # Solo el servidor backend
```

## 🔧 Desarrollo

### Para desarrollar el frontend:
```bash
npm run dev
```
Ejecuta React en modo desarrollo en puerto 3001

### Para desarrollar el backend:
```bash
npm run server
```
Ejecuta solo el servidor en puerto 3000

## 📁 Estructura Simplificada

```
📦 adl/
├── 🌐 server.js           # Servidor unificado (backend + frontend)
├── 🚀 start.js            # Script de inicio inteligente
├── 📱 src/                # Código React del frontend
├── 🏗️ build/              # Frontend construido
├── 📚 public/libros/      # Biblioteca de ePubs
└── 📹 recordings/         # Grabaciones del sistema
```

## ✨ Características

- 🎯 **Puerto único**: Todo en localhost:3000
- 🔄 **Sin proxy**: Configuración directa
- 📦 **Build automático**: Se construye si es necesario
- 🌐 **Servidor unificado**: Frontend + Backend + WebSocket
- 👁️ **Eye-tracking**: Integración Gazepoint transparente
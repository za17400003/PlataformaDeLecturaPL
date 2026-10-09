# Plataforma de Lectura

Biblioteca web de demostracion para organizar y leer libros EPUB desde el navegador. Incluye un catalogo servido por Express y un lector con controles de presentacion configurables.

## Funcionalidades

- Explora el catalogo EPUB servido desde `public/libros`.
- Abre libros en un lector paginado basado en epub.js.
- Ajusta tipografia, tamano de texto, interlineado, tema y brillo.
- Guarda las preferencias de lectura en el almacenamiento local del navegador.
- Navega por el catalogo en paginas de seis libros.

## Estado y datos

Este repositorio contiene un prototipo. El acceso actual es una pantalla de demostracion, no un sistema de autenticacion: acepta `usuario` / `123` y no debe proteger datos reales. El catalogo se obtiene de un servidor local en el puerto 3001.

Los EPUB no se distribuyen con el repositorio. Para probar el catalogo, agrega libros que tengas derecho a usar en `public/libros`; esa carpeta esta excluida de Git para evitar publicar material protegido.

## Requisitos

- Node.js 18 o posterior
- npm

## Inicio local

```bash
npm ci
npm run server
```

En otra terminal:

```bash
npm start
```

Abre `http://localhost:3000`. El frontend consulta el catalogo en `http://localhost:3001/api/libros`.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm start` | Inicia React en modo desarrollo. |
| `npm run server` | Inicia la API local de catalogo. |
| `npm test -- --watchAll=false` | Ejecuta las pruebas una vez. |
| `npm run build` | Genera el build de produccion en `build/`. |

## Tecnologias

React, React Router, epub.js, Express y Create React App.

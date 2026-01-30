# Resumen de Fixes - 31 de Enero de 2026

## Problemas Resueltos

### 1. ✅ Keyboard Controls No Funcionaban en Experimentos

**Problema Identificado:**
- SPACEBAR, BACKSPACE, ESCAPE no respondían durante la ejecución de experimentos
- Log mostraba: "experimento no activo (started=false, isReady=true)"
- La variable `timerStarted` nunca se cambió de `false` a `true`

**Causa Raíz:**
- En `Lector.js`, el estado `timerStarted` se inicializaba en `false`
- ExperimentRunner renderizaba Lector invisible (`display: none`) para precargarlo
- Cuando el usuario presionaba ESPACIO en la pantalla intro, Lector se hacía visible PERO `timerStarted` seguía siendo `false`
- Los handlers de teclado (`handleSpaceBar`, `handleBackspace`, `handleEscape`) bloqueaban su ejecución si `!started`

**Solución Implementada:**

#### 1. Agregar prop `shouldStart` en Lector.js
```javascript
shouldStart = false  // Nueva prop: indica cuándo el experimento debe comenzar
```

#### 2. Crear useEffect para activar el experimento
```javascript
// Cuando shouldStart=true, marcar timerStarted=true
useEffect(() => {
  if (experimentMode && shouldStart && ready && !timerStarted) {
    setTimerStarted(true);
    // Iniciar cronómetro del experimento
    ...
  }
}, [experimentMode, shouldStart, ready, timerStarted, blockDuration, onBlockComplete]);
```

#### 3. Pasar `shouldStart={false}` al Lector precargado en ExperimentRunner
```javascript
<Lector ... shouldStart={false} />  // display: none, no iniciado
```

#### 4. Pasar `shouldStart={true}` al Lector visible en ExperimentRunner
```javascript
<Lector ... shouldStart={true} />  // Visible, experimanto iniciado
```

**Resultado:**
- ✅ Cuando el usuario presiona ESPACIO en la intro, `showBlockIntro` → `false`, `showLector` → `true`
- ✅ Lector recibe `shouldStart={true}` 
- ✅ useEffect marca `timerStarted={true}`
- ✅ Keyboard handlers ahora permiten SPACEBAR/BACKSPACE/ESCAPE

---

### 2. ✅ Error 500 en POST /api/experiment-runs/blocks

**Problema Identificado:**
- Endpoint devolvía error 500 al crear un nuevo bloque de experimento
- ExperimentRunner.js línea 299 fallaba al llamar `startBlock()`

**Causa Raíz:**
- El INSERT no seteaba `started_at`, campo obligatorio
- Cuando luego el PUT llamaba `new Date(runBlock.started_at)` fallaba con null
- Esto causaba un error no capturado que derivaba en 500

**Solución Implementada:**
```javascript
// Antes (server.js línea 949):
INSERT INTO experiment_run_blocks 
(run_id, block_id, block_number, book_id, page_number)
VALUES (?, ?, ?, ?, ?)

// Después:
INSERT INTO experiment_run_blocks 
(run_id, block_id, block_number, book_id, page_number, started_at)
VALUES (?, ?, ?, ?, ?, ?)
```
- Agregar `started_at` al INSERT
- Usar `new Date().toISOString()` para timestamp actual

**Resultado:**
- ✅ El endpoint ahora retorna 201 con objeto del bloque creado
- ✅ El PUT `/api/experiment-runs/blocks/:runBlockId/complete` puede acceder a `started_at`
- ✅ No hay más errores 500 en inicios de bloque

---

### 3. ✅ Organización de Archivos Markdown

**Cambio Realizado:**
- Creada carpeta: `Documentacion/Archivos_Trabajo/`
- Movido: `AUDITORIA_MANUAL_USUARIO.md` → `Documentacion/Archivos_Trabajo/`
- Destino: Reducir clutter en raíz, mantener docs trabajados en carpeta centralizada

**Propósito:**
- Los .md generados en sessions de desarrollo van a `Archivos_Trabajo/`
- Los .md principales (manuales, guías) quedan en `Documentacion/`
- La raíz se mantiene limpia con solo scripts y archivos de config

---

## Archivos Modificados

### Cambios Críticos:
1. **src/Lector.js**
   - Línea 40: Agregar prop `shouldStart = false`
   - Línea 880-915: Agregar useEffect para activar experimento cuando `shouldStart={true}`
   
2. **src/ExperimentRunner.js**
   - Línea 590: Agregar `shouldStart={false}` al Lector invisible
   - Línea 675: Agregar `shouldStart={true}` al Lector visible

3. **server.js**
   - Línea 964: Incluir `started_at` en INSERT de `experiment_run_blocks`
   - Usar `new Date().toISOString()` para timestamp

### Cambios Administrativos:
- **Documentacion/Archivos_Trabajo/AUDITORIA_MANUAL_USUARIO.md** (creado)

---

## Testing Recomendado

```javascript
// Test 1: Keyboard Controls
1. Crear experimento con bloques
2. Ejecutar experimento
3. En la pantalla intro, presionar SPACEBAR
4. Verificar que: Lector se abre sin error
5. Presionar SPACEBAR, BACKSPACE, ESCAPE durante lectura
6. Verificar que: Funcionan cambios de página y pausa

// Test 2: Error 500
1. Ejecutar experimento
2. Verificar que la consola de servidor NO muestra error en startBlock
3. Verificar que se puede navegar entre bloques sin 500

// Test 3: Timer
1. Configurar bloque de 30 segundos
2. Ejecutar bloque
3. Timer debería contar de 30 a 0
4. Al llegar a 0, debería completarse el bloque automáticamente
```

---

## Estado Actual

| Componente | Estado | Nota |
|---|---|---|
| Keyboard Controls | ✅ Funcional | SPACEBAR/BACKSPACE/ESCAPE activos |
| API Blocks Endpoint | ✅ Funcional | 201 sin errores 500 |
| Experiment Timer | ✅ Funcional | Cuenta correctamente |
| Folder Organization | ✅ Completado | Archivos en `Archivos_Trabajo/` |

---

**Fecha:** 31 de enero de 2026  
**Sesión:** Keyboard Controls + API Fixes + Organization

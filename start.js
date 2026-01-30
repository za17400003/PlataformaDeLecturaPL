#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

console.log('[INICIO] Iniciando Asistente de Lectura PL...\n');

// ========== SISTEMA DE INSTANCIA ÚNICA ==========
const PID_FILE = path.join(__dirname, '.PL.pid');
const LOCK_FILE = path.join(__dirname, '.PL.lock');

// Función ÓPTIMA para eliminar cualquier instancia anterior
async function ensureSingleInstance() {
  console.log('[SISTEMA] Verificando instancia única...');
  
  // 1. Eliminar archivos de lock anteriores
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (e) {}
  
  // 2. Eliminar TODOS los procesos Node.js relacionados con PL (excepto el actual)
  try {
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
    const lines = stdout.split('\n').slice(1);
    const currentPID = process.pid;
    
    for (const line of lines) {
      if (line.includes('node.exe')) {
        const parts = line.split(',');
        const pid = parts[1]?.replace(/"/g, '');
        
        if (pid && !isNaN(parseInt(pid)) && parseInt(pid) !== currentPID) {
          try {
            const { stdout: cmdline } = await execAsync(`wmic process where ProcessId=${pid} get CommandLine /value`);
            
            if (cmdline.toLowerCase().includes('PL') || 
                cmdline.includes('server.js') || 
                cmdline.includes('start.js')) {
              console.log(`[LIMPIAR] Eliminando instancia anterior PID: ${pid}`);
              await execAsync(`taskkill /F /PID ${pid}`);
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
  
  // 3. Forzar liberación del puerto 3000
  await forcePortCleanup();
  
  // 4. Crear nuevo lock con PID actual
  fs.writeFileSync(PID_FILE, process.pid.toString());
  fs.writeFileSync(LOCK_FILE, new Date().toISOString());
  
  console.log('[OK] Instancia única garantizada');
}

// Función ÓPTIMA para limpiar puerto 3000
async function forcePortCleanup() {
  console.log('[PUERTO] Limpieza ÓPTIMA del puerto 3000...');
  
  try {
    const { stdout } = await execAsync('netstat -ano | findstr :3000');
    
    if (stdout.trim()) {
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && !isNaN(parseInt(pid))) {
          pids.add(pid);
        }
      });
      
      // Eliminar todos los procesos en puerto 3000
      for (const pid of pids) {
        try {
          await execAsync(`taskkill /F /PID ${pid}`);
          console.log(`[OK] Proceso ${pid} eliminado`);
        } catch (e) {}
      }
      
      // Esperar liberación completa
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (e) {
    console.log('[OK] Puerto 3000 libre');
  }
}

// Verificar que existe el build y si está actualizado
const buildExists = fs.existsSync(path.join(__dirname, 'build'));
const needsBuild = checkIfBuildNeeded();

if (!buildExists || needsBuild) {
  if (!buildExists) {
    console.log('[BUILD] Build no encontrado. Ejecutando npm run build...');
  } else {
    console.log('[REBUILD] Código actualizado detectado. Reconstruyendo...');
  }
  
  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  const buildProcess = spawn(npmCmd, ['run', 'build'], { 
    stdio: 'inherit',
    shell: true
  });
  
  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('[OK] Build completado exitosamente\n');
      startServer();
    } else {
      console.warn('[WARN] Error en el build, pero iniciando servidor de todas formas...\n');
      startServer();
    }
  });
} else {
  console.log('[OK] Build actualizado encontrado\n');
  startServer();
}

function checkIfBuildNeeded() {
  try {
    const buildPath = path.join(__dirname, 'build');
    const srcPath = path.join(__dirname, 'src');
    
    if (!fs.existsSync(buildPath)) return true;
    
    const buildStat = fs.statSync(buildPath);
    const srcStat = fs.statSync(srcPath);
    
    // Si src es más nuevo que build, necesitamos reconstruir
    return srcStat.mtime > buildStat.mtime;
  } catch (e) {
    return true; // Si hay error, mejor reconstruir
  }
}

function startServer() {
  console.log('[RED] Iniciando servidores unificados...');
  console.log('   [NODE] Node.js en puerto 3000\n');
  console.log('   ⚠️  [FLASK] Desactivado por ahora (se puede activar después)\n');
  
  // Garantizar instancia única antes de iniciar
  ensureSingleInstance().then(() => {
    // Iniciar con garbage collection habilitado
    const nodeServer = spawn('node', ['--expose-gc', 'server.js'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });

    // ⚠️ FLASK COMENTADO - Se puede activar más tarde si es necesario
    // const flaskServer = spawn('py', ['-3.10', path.join(__dirname, 'server', 'app.py')], {
    //   stdio: 'inherit',
    //   env: { ...process.env, FLASK_ENV: 'production' }
    // });
    const flaskServer = null;

    // Variable para evitar múltiples intentos de cierre
    let isShuttingDown = false;

    nodeServer.on('close', (code) => {
      if (isShuttingDown) return;
      console.log(`\n[STOP] Servidor Node.js cerrado con código ${code}`);
      gracefulShutdown('NODE_CLOSED');
    });

    // ⚠️ Flask listeners comentados - Se puede reactivar después si es necesario
    // if (flaskServer) {
    //   flaskServer.on('close', (code) => {
    //     if (isShuttingDown) return;
    //     console.log(`\n[STOP] Servidor Flask cerrado con código ${code}`);
    //     gracefulShutdown('FLASK_CLOSED');
    //   });
    //
    //   flaskServer.on('error', (error) => {
    //     console.error('[ERROR] Error en Flask:', error);
    //     if (!isShuttingDown) {
    //       gracefulShutdown('FLASK_ERROR');
    //     }
    //   });
    // }

    nodeServer.on('error', (error) => {
      console.error('[ERROR] Error en Node.js:', error);
      if (!isShuttingDown) {
        gracefulShutdown('NODE_ERROR');
      }
    });

    // Función de cierre ordenado ÓPTIMA
    function gracefulShutdown(signal = 'MANUAL') {
      if (isShuttingDown) return;
      isShuttingDown = true;
      
      console.log(`\n[BYE] Cerrando servidores... (señal: ${signal})`);
      
      // Terminar ambos servidores con SIGTERM primero (más limpio)
      if (nodeServer && !nodeServer.killed) {
        console.log('[SHUTDOWN] Enviando SIGTERM a Node.js...');
        nodeServer.kill('SIGTERM');
      }
      if (flaskServer && !flaskServer.killed) {
        console.log('[SHUTDOWN] Enviando SIGTERM a Flask...');
        flaskServer.kill('SIGTERM');
      }
      
      // Limpiar archivos de lock
      cleanupLockFiles();
      
      // Esperar a que los procesos se cierren, pero no bloquear
      if (nodeServer) {
        nodeServer.once('exit', () => {
          console.log('[OK] Node.js cerrado correctamente');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    }

    // Función para limpiar archivos de lock
    function cleanupLockFiles() {
      try {
        if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
        if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
      } catch (e) {}
    }

    // Capturar TODAS las señales de cierre
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
    process.on('exit', cleanupLockFiles);
    process.on('beforeExit', cleanupLockFiles);
    
    // Manejar errores del proceso principal
    process.on('uncaughtException', (error) => {
      console.error('❌ Error no capturado en start.js:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Promise rechazada sin manejar en start.js:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });

    console.log('[SHIELD] Sistema de monitoreo y limpieza configurado');
  }).catch((error) => {
    console.error('[ERROR] Error garantizando instancia única:', error);
    process.exit(1);
  });
}

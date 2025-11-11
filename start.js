#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

console.log('🚀 Iniciando Asistente de Lectura ADL...\n');

// ========== SISTEMA DE INSTANCIA ÚNICA ==========
const PID_FILE = path.join(__dirname, '.adl.pid');
const LOCK_FILE = path.join(__dirname, '.adl.lock');

// Función ÓPTIMA para eliminar cualquier instancia anterior
async function ensureSingleInstance() {
  console.log('� Verificando instancia única...');
  
  // 1. Eliminar archivos de lock anteriores
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (e) {}
  
  // 2. Eliminar TODOS los procesos Node.js relacionados con ADL (excepto el actual)
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
            
            if (cmdline.toLowerCase().includes('adl') || 
                cmdline.includes('server.js') || 
                cmdline.includes('start.js')) {
              console.log(`🛑 Eliminando instancia anterior PID: ${pid}`);
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
  
  console.log('✅ Instancia única garantizada');
}

// Función ÓPTIMA para limpiar puerto 3000
async function forcePortCleanup() {
  console.log('🔧 Limpieza ÓPTIMA del puerto 3000...');
  
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
          console.log(`✅ Proceso ${pid} eliminado`);
        } catch (e) {}
      }
      
      // Esperar liberación completa
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (e) {
    console.log('✅ Puerto 3000 libre');
  }
}

// Verificar que existe el build y si está actualizado
const buildExists = fs.existsSync(path.join(__dirname, 'build'));
const needsBuild = checkIfBuildNeeded();

if (!buildExists || needsBuild) {
  if (!buildExists) {
    console.log('📦 Build no encontrado. Ejecutando npm run build...');
  } else {
    console.log('🔄 Código actualizado detectado. Reconstruyendo...');
  }
  
  const buildProcess = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
  
  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build completado exitosamente\n');
      startServer();
    } else {
      console.error('❌ Error en el build');
      process.exit(1);
    }
  });
} else {
  console.log('✅ Build actualizado encontrado\n');
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
  console.log('🌐 Iniciando servidor unificado en puerto 3000...');
  
  // Garantizar instancia única antes de iniciar
  ensureSingleInstance().then(() => {
    // Iniciar con garbage collection habilitado
    const server = spawn('node', ['--expose-gc', 'server.js'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });

    // Variable para evitar múltiples intentos de cierre
    let isShuttingDown = false;

    server.on('close', (code) => {
      if (isShuttingDown) return;
      console.log(`\n🛑 Servidor cerrado con código ${code}`);
      cleanupLockFiles();
    });

    server.on('error', (error) => {
      console.error('❌ Error en el servidor:', error);
      if (!isShuttingDown) {
        gracefulShutdown();
      }
    });

    // Función de cierre ordenado ÓPTIMA
    function gracefulShutdown(signal = 'MANUAL') {
      if (isShuttingDown) return;
      isShuttingDown = true;
      
      console.log(`\n👋 Cerrando servidor... (señal: ${signal})`);
      
      if (server && !server.killed) {
        // Terminar inmediatamente (más agresivo)
        server.kill('SIGKILL');
      }
      
      // Limpiar archivos de lock
      cleanupLockFiles();
      
      // Salir inmediatamente
      setTimeout(() => {
        console.log('✅ Proceso principal finalizado');
        process.exit(0);
      }, 1000);
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

    console.log('🛡️  Sistema de monitoreo y limpieza configurado');
  }).catch((error) => {
    console.error('❌ Error garantizando instancia única:', error);
    process.exit(1);
  });
}
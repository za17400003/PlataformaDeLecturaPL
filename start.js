#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando Asistente de Lectura ADL...\n');

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
  });

  server.on('error', (error) => {
    console.error('❌ Error en el servidor:', error);
    if (!isShuttingDown) {
      gracefulShutdown();
    }
  });

  // Función de cierre ordenado
  function gracefulShutdown(signal = 'MANUAL') {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(`\n👋 Cerrando servidor... (señal: ${signal})`);
    
    if (server && !server.killed) {
      // Enviar SIGTERM primero para cierre ordenado
      server.kill('SIGTERM');
      
      // Si no se cierra en 5 segundos, forzar con SIGKILL
      setTimeout(() => {
        if (!server.killed) {
          console.log('⚠️  Forzando cierre del servidor...');
          server.kill('SIGKILL');
        }
      }, 5000);
    }
    
    // Dar tiempo para que el servidor se cierre ordenadamente
    setTimeout(() => {
      console.log('✅ Proceso principal finalizado');
      process.exit(0);
    }, 6000);
  }

  // Capturar diferentes señales de cierre
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));     // Ctrl+C
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));   // Terminación normal
  process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));   // Quit
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));     // Terminal cerrado
  
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
}
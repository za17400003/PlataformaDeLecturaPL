#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const execAsync = promisify(exec);

console.log('🧹 LIMPIEZA ÓPTIMA - Eliminando TODAS las instancias PL...\n');

const PID_FILE = path.join(__dirname, '.pl.pid');
const LOCK_FILE = path.join(__dirname, '.pl.lock');

async function optimalCleanup() {
  try {
    // 1. ELIMINAR TODOS los procesos Node.js relacionados con PL
    console.log('❌ Eliminando TODOS los procesos PL...');
    
    try {
      // Matar TODOS los procesos Node.js sin excepción
      await execAsync('taskkill /F /IM node.exe');
      console.log('✅ Todos los procesos Node.js eliminados');
    } catch (e) {
      console.log('✅ No hay procesos Node.js activos');
    }
    
    // 2. FORZAR liberación del puerto 3000 - INCLUYENDO estados problemáticos
    console.log('🔥 Liberación FORZADA del puerto 3000...');
    
    try {
      const { stdout } = await execAsync('netstat -ano | findstr :3000');
      
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        let problemConnections = 0;
        
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          const state = parts[parts.length - 2];
          
          // Identificar conexiones problemáticas
          if (state === 'FIN_WAIT_2' || state === 'CLOSE_WAIT' || state === 'ESTABLISHED') {
            problemConnections++;
            if (pid && pid !== '0' && !isNaN(parseInt(pid))) {
              pids.add(pid);
            }
          } else if (pid && pid !== '0' && !isNaN(parseInt(pid))) {
            pids.add(pid);
          }
        });
        
        if (problemConnections > 0) {
          console.log(`⚠️  ${problemConnections} conexiones problemáticas detectadas`);
        }
        
        // Eliminar TODOS los PIDs encontrados (incluso FIN_WAIT_2 y CLOSE_WAIT)
        for (const pid of pids) {
          try {
            console.log(`💀 ELIMINANDO PID ${pid} (conexión problemática)`);
            await execAsync(`taskkill /F /PID ${pid}`);
          } catch (e) {}
        }
        
        console.log(`✅ ${pids.size} procesos eliminados (incluyendo conexiones problemáticas)`);
      }
    } catch (e) {
      console.log('✅ Puerto 3000 completamente libre');
    }
    
    // 3. ELIMINAR archivos de lock
    console.log('🗑️  Eliminando archivos de lock...');
    
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
        console.log('✅ Archivo PID eliminado');
      }
      if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
        console.log('✅ Archivo LOCK eliminado');
      }
    } catch (e) {
      console.log('✅ Archivos de lock ya limpos');
    }
    
    // 4. RESETEAR caches del sistema
    console.log('� Reseteando caches del sistema...');
    
    try {
      await execAsync('ipconfig /flushdns');
      console.log('✅ Cache DNS reseteado');
    } catch (e) {}
    
    // 5. Verificación FINAL
    console.log('\n🔍 Verificación FINAL...');
    
    try {
      const { stdout } = await execAsync('netstat -ano | findstr :3000');
      if (stdout.trim()) {
        const timeWaitCount = stdout.split('\n').filter(line => line.includes('TIME_WAIT')).length;
        console.log(`⏳ ${timeWaitCount} conexiones TIME_WAIT restantes (normales)`);
      } else {
        console.log('🎉 Puerto 3000 COMPLETAMENTE LIBRE');
      }
    } catch (e) {
      console.log('🎉 Puerto 3000 COMPLETAMENTE LIBRE');
    }
    
    // 6. Esperar para asegurar liberación completa
    console.log('⏳ Esperando liberación completa...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🎉 LIMPIEZA ÓPTIMA COMPLETADA');
    console.log('✅ Sistema listo para nueva instancia');
    
  } catch (error) {
    console.error('❌ Error en limpieza óptima:', error.message);
    process.exit(1);
  }
}

// Ejecutar limpieza óptima
optimalCleanup();

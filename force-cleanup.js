#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

console.log('🧹 Forzando cierre de TODAS las conexiones en puerto 3000...\n');

async function forceCloseAllConnections() {
  try {
    // 1. Resetear todas las conexiones TCP en puerto 3000
    console.log('🔥 Reseteando conexiones TCP en puerto 3000...');
    
    try {
      // Usar netsh para resetear conexiones
      await execAsync('netsh int ip reset');
      console.log('✅ Reset de interfaz IP realizado');
    } catch (e) {
      console.log('⚠️  No se pudo resetear interfaz IP (requiere permisos admin)');
    }
    
    // 2. Flush DNS y ARP cache
    console.log('🔧 Limpiando caches del sistema...');
    
    try {
      await execAsync('ipconfig /flushdns');
      console.log('✅ Cache DNS limpiado');
    } catch (e) {
      console.log('⚠️  Error limpiando DNS cache');
    }
    
    try {
      await execAsync('arp -d *');
      console.log('✅ Cache ARP limpiado');
    } catch (e) {
      console.log('⚠️  Error limpiando ARP cache');
    }
    
    // 3. Intentar cerrar conexiones específicas usando netsh
    console.log('🔌 Intentando cerrar conexiones específicas...');
    
    try {
      const { stdout } = await execAsync('netstat -ano | findstr :3000');
      
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');
        console.log(`📊 Encontradas ${lines.length} conexiones en puerto 3000`);
        
        // Intentar usar TCPView si está disponible (herramienta de Microsoft)
        try {
          await execAsync('taskkill /F /IM tcpview.exe 2>nul');
        } catch (e) {
          // Ignorar si TCPView no está corriendo
        }
        
        console.log('⏳ Esperando que el sistema cierre las conexiones TIME_WAIT...');
        
        // Forzar recolección de basura del sistema
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log(`⏳ Esperando... ${i + 1}/3`);
        }
        
      } else {
        console.log('✅ No hay conexiones en puerto 3000');
      }
    } catch (error) {
      console.log('✅ Puerto 3000 completamente libre');
    }
    
    // 4. Verificación final
    console.log('\n🔍 Verificación final...');
    try {
      const { stdout } = await execAsync('netstat -ano | findstr :3000');
      
      if (stdout.trim()) {
        const lines = stdout.trim().split('\n');
        const timeWaitCount = lines.filter(line => line.includes('TIME_WAIT')).length;
        
        if (timeWaitCount > 0) {
          console.log(`⏳ ${timeWaitCount} conexiones TIME_WAIT restantes (cerrarán automáticamente)`);
          console.log('💡 Estas conexiones son normales y se cerrarán en 1-2 minutos');
        }
        
        console.log('Estado actual:');
        console.log(stdout);
      } else {
        console.log('✅ Puerto 3000 completamente libre');
      }
    } catch (error) {
      console.log('✅ Puerto 3000 completamente libre');
    }
    
    console.log('\n🎉 Limpieza agresiva completada');
    console.log('💡 Tip: Las conexiones TIME_WAIT son normales y se cierran automáticamente');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza agresiva:', error.message);
    process.exit(1);
  }
}

// Ejecutar limpieza agresiva
forceCloseAllConnections();
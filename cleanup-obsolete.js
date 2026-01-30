#!/usr/bin/env node

/**
 * CLEANUP - Script para eliminar archivos y carpetas obsoletos
 * 
 * Archivos removidos:
 * - Scripts .bat antiguos (Windows batch files)
 * - Archivos temporales
 * - Carpeta server/ (Flask Python - reemplazado por gazepoint-client.js)
 * - Archivos .txt temporales
 * - Scripts de testing/fixing antiguos
 * 
 * Uso: node cleanup-obsolete.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function header(text) {
  console.log(colors.bright + colors.cyan + `\n${'='.repeat(70)}`);
  console.log(colors.bright + colors.cyan + text);
  console.log(colors.bright + colors.cyan + `${'='.repeat(70)}\n`);
}

// Archivos a eliminar
const OBSOLETE_FILES = [
  // Scripts Windows .bat antiguos
  'iniciar.bat',
  'run_server.bat',
  'run-dev.bat',
  'quick-start.bat',
  'fix_admin.bat',
  
  // Archivos temporales
  'temp_investigacion_consolidada.txt',
  'DOCUMENTACION_FASE5_LISTA.txt',
  'DOCUMENTACION_FINAL.txt',
  'INTEGRATION_COMPLETE.txt',
  'server_start.log',
  
  // Scripts temporales/testing
  'check_user.js',
  'check_users.js',
  'check-schema.js',
  'cleanup.js',
  'force-cleanup.js',
  'test-experiments.js',
  'test-fixes.js',
  'test-flask.js',
  'test-phase5.js',
  'tmp_check_api.js',
  'tmp_check_epub.js',
  'create-fresh-experiment.js',
  'create-test-experiment.js',
  'fix-logging.js',
  'fix_admin.js',
  'finalize-server.js',
  'inject-experiment.js',
  'migrate.js',
  'migrate-add-book-columns.js',
  'update-server.js',
  'update-server-v2.js',
  'validate-system.js',
  'verify-phase5.js',
  'gazepoint-server.js', // Reemplazado por gazepoint-client.js
];

// Carpetas a eliminar
const OBSOLETE_DIRS = [
  'server',              // Flask Python - reemplazado por gazepoint-client.js
  'camera-recorder-app', // No utilizada
];

// ============================================================================

function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      log(colors.green, `✓ ${path.basename(filePath)}`);
      return true;
    }
    return false;
  } catch (error) {
    log(colors.red, `✗ ${path.basename(filePath)} - ${error.message}`);
    return false;
  }
}

function deleteDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      log(colors.green, `✓ Carpeta ${path.basename(dirPath)}/`);
      return true;
    }
    return false;
  } catch (error) {
    log(colors.red, `✗ Carpeta ${path.basename(dirPath)}/ - ${error.message}`);
    return false;
  }
}

function main() {
  header('🗑️  LIMPIEZA DE ARCHIVOS OBSOLETOS');
  
  log(colors.yellow, '⚠️  Este script eliminará:');
  log(colors.yellow, `   - ${OBSOLETE_FILES.length} archivos obsoletos`);
  log(colors.yellow, `   - ${OBSOLETE_DIRS.length} carpetas obsoletas\n`);
  
  log(colors.yellow, '✓ Los datos en db/ se preservarán');
  log(colors.yellow, '✓ React y código fuente se preservarán');
  log(colors.yellow, '✓ node_modules se preservará\n');
  
  // Pedir confirmación
  const rePLine = require('rePLine');
  const rl = rePLine.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('¿Deseas continuar? (s/n): ', (answer) => {
    rl.close();
    
    if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'y') {
      log(colors.yellow, '\nLimpieza cancelada.');
      process.exit(0);
    }
    
    performCleanup();
  });
}

function performCleanup() {
  log(colors.bright + colors.cyan, '\nEliminando archivos...\n');
  
  let filesDeleted = 0;
  for (const file of OBSOLETE_FILES) {
    if (deleteFile(path.join(__dirname, file))) {
      filesDeleted++;
    }
  }
  
  log(colors.bright + colors.cyan, '\nEliminando carpetas...\n');
  
  let dirsDeleted = 0;
  for (const dir of OBSOLETE_DIRS) {
    if (deleteDir(path.join(__dirname, dir))) {
      dirsDeleted++;
    }
  }
  
  // Resumen
  log(colors.bright + colors.cyan, '\n' + '='.repeat(70));
  log(colors.green + colors.bright, `✅ Limpieza completada`);
  log(colors.cyan, `   Archivos eliminados: ${filesDeleted}/${OBSOLETE_FILES.length}`);
  log(colors.cyan, `   Carpetas eliminadas: ${dirsDeleted}/${OBSOLETE_DIRS.length}`);
  log(colors.cyan, '\nAhora el proyecto es más limpio y mantenible.');
  log(colors.cyan + colors.bright, '='.repeat(70) + '\n');
  
  process.exit(0);
}

// ============================================================================

if (require.main === module) {
  main();
}

module.exports = { OBSOLETE_FILES, OBSOLETE_DIRS };

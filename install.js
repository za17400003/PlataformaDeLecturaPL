#!/usr/bin/env node

/**
 * INSTALLER - Script de instalación único para PL
 * 
 * Funcionalidad:
 * - Verificar requisitos (Node.js, npm)
 * - Instalar dependencias
 * - Inicializar base de datos
 * - Generar secretos de seguridad
 * - Crear estructura de directorios
 * - Verificar configuración
 * 
 * Uso: npm run install o node install.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function header(text) {
  log(colors.bright + colors.cyan, `\n${'='.repeat(70)}`);
  log(colors.bright + colors.cyan, text);
  log(colors.bright + colors.cyan, `${'='.repeat(70)}\n`);
}

function success(text) {
  log(colors.green + colors.bright, `✅ ${text}`);
}

function warning(text) {
  log(colors.yellow + colors.bright, `⚠️  ${text}`);
}

function error(text) {
  log(colors.red + colors.bright, `❌ ${text}`);
}

function step(num, text) {
  log(colors.bright, `\n[${num}] ${text}`);
}

// ============================================================================
// VERIFICACIONES
// ============================================================================

function checkNodeVersion() {
  step(1, 'Verificando versión de Node.js...');
  
  try {
    const version = execSync('node --version', { encoding: 'utf-8' }).trim();
    const major = parseInt(version.split('.')[0].substring(1));
    
    if (major < 14) {
      error(`Node.js ${version} detectado. Se requiere v14.0.0 o superior`);
      process.exit(1);
    }
    
    success(`Node.js ${version} detectado`);
  } catch (err) {
    error('Node.js no encontrado. Por favor instala Node.js desde https://nodejs.org');
    process.exit(1);
  }
}

function checkNpm() {
  step(2, 'Verificando npm...');
  
  try {
    const version = execSync('npm --version', { encoding: 'utf-8' }).trim();
    success(`npm ${version} detectado`);
  } catch (err) {
    error('npm no encontrado. Asegúrate que npm está instalado correctamente');
    process.exit(1);
  }
}

// ============================================================================
// INSTALACIÓN
// ============================================================================

function installDependencies() {
  step(3, 'Instalando dependencias...');
  
  try {
    log(colors.cyan, 'Ejecutando: npm install');
    execSync('npm install', {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' }
    });
    success('Dependencias instaladas correctamente');
  } catch (err) {
    error('Error instalando dependencias');
    error(err.message);
    process.exit(1);
  }
}

// ============================================================================
// CONFIGURACIÓN DE SEGURIDAD
// ============================================================================

function generateSecrets() {
  step(4, 'Generando secretos de seguridad...');
  
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  let jwtSecret = '';
  let needsUpdate = false;
  
  // Leer .env existente
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  
  // Generar JWT_SECRET si no existe
  if (!envContent.includes('JWT_SECRET=') || envContent.includes('change-in-production')) {
    jwtSecret = crypto.randomBytes(32).toString('hex');
    envContent = envContent.replace(
      /JWT_SECRET=.*/,
      `JWT_SECRET=${jwtSecret}`
    ) || `${envContent}\nJWT_SECRET=${jwtSecret}`;
    needsUpdate = true;
    success('JWT_SECRET generado');
  }
  
  // Generar NODE_ENV si no existe
  if (!envContent.includes('NODE_ENV=')) {
    envContent = `NODE_ENV=development\n${envContent}`;
    needsUpdate = true;
  }
  
  // Guardar si hay cambios
  if (needsUpdate) {
    fs.writeFileSync(envPath, envContent);
    success('Variables de entorno actualizadas');
  } else {
    success('Variables de entorno ya configuradas');
  }
}

function createDirectories() {
  step(5, 'Creando estructura de directorios...');
  
  const dirs = [
    './db',
    './db/sessions',
    './logs',
    './public/libros',
    './build',
    './Sesiones'
  ];
  
  for (const dir of dirs) {
    const fullPath = path.join(__dirname, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      log(colors.cyan, `  📁 ${dir}`);
    }
  }
  
  success('Directorios creados');
}

function setupDatabase() {
  step(6, 'Inicializando base de datos...');
  
  try {
    log(colors.cyan, 'Ejecutando: node db/init-db.js');
    execSync('node db/init-db.js', {
      cwd: __dirname,
      stdio: 'inherit'
    });
    success('Base de datos inicializada');
  } catch (err) {
    warning('Error inicializando BD. Verifica que existe db/init-db.js');
  }
}

function buildReact() {
  step(7, 'Compilando React...');
  
  if (fs.existsSync(path.join(__dirname, 'src'))) {
    try {
      log(colors.cyan, 'Ejecutando: npm run build');
      execSync('npm run build', {
        cwd: __dirname,
        stdio: 'inherit'
      });
      success('React compilado');
    } catch (err) {
      warning('Build de React falló, pero puedes continuar');
    }
  } else {
    warning('Carpeta src/ no encontrada, skipping React build');
  }
}

// ============================================================================
// VERIFICACIÓN FINAL
// ============================================================================

function verifyInstallation() {
  step(8, 'Verificando instalación...');
  
  const checks = [
    { file: 'package.json', name: 'package.json' },
    { file: '.env', name: 'Archivo .env' },
    { file: 'db', name: 'Directorio db/' },
    { file: 'logs', name: 'Directorio logs/' },
    { file: 'server.js', name: 'server.js' },
    { file: 'config.js', name: 'config.js' }
  ];
  
  let allGood = true;
  
  for (const check of checks) {
    const fullPath = path.join(__dirname, check.file);
    if (fs.existsSync(fullPath)) {
      log(colors.green, `  ✓ ${check.name}`);
    } else {
      log(colors.red, `  ✗ ${check.name}`);
      allGood = false;
    }
  }
  
  if (allGood) {
    success('Todas las verificaciones pasaron');
  } else {
    error('Algunas verificaciones fallaron. Verifica la instalación');
  }
  
  return allGood;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  header('🚀 PL PLATFORM - INSTALADOR');
  
  log(colors.cyan, 'Este script va a:');
  log(colors.cyan, '  1. Verificar requisitos (Node.js, npm)');
  log(colors.cyan, '  2. Instalar dependencias npm');
  log(colors.cyan, '  3. Generar secretos de seguridad');
  log(colors.cyan, '  4. Crear directorios necesarios');
  log(colors.cyan, '  5. Inicializar base de datos');
  log(colors.cyan, '  6. Compilar React\n');
  
  try {
    checkNodeVersion();
    checkNpm();
    installDependencies();
    generateSecrets();
    createDirectories();
    setupDatabase();
    buildReact();
    
    const success_final = verifyInstallation();
    
    // Resumen final
    header('✅ INSTALACIÓN COMPLETADA');
    
    log(colors.green + colors.bright, 'Próximos pasos:');
    log(colors.green, '  1. npm start          - Iniciar servidor Express + React dev');
    log(colors.green, '  2. npm run server     - Solo servidor Express');
    log(colors.green, '  3. npm run dev        - Solo React dev server\n');
    
    log(colors.yellow + colors.bright, 'IMPORTANTE - Seguridad:');
    log(colors.yellow, '  ⚠️  Revisar el archivo .env y actualizar:');
    log(colors.yellow, '      - JWT_SECRET (ya generado)');
    log(colors.yellow, '      - SENDGRID_API_KEY (para emails)');
    log(colors.yellow, '      - ALLOWED_ORIGINS (para producción)\n');
    
    log(colors.cyan + colors.bright, 'Credenciales de prueba:');
    log(colors.cyan, '  Usuario: admin');
    log(colors.cyan, '  (Contraseña será solicitada en primer login)\n');
    
    if (success_final) {
      process.exit(0);
    } else {
      warning('Algunos pasos completaron con advertencias. Revisa el resultado arriba.');
      process.exit(0);
    }
    
  } catch (err) {
    error('Error durante instalación');
    error(err.message);
    process.exit(1);
  }
}

// ============================================================================

// Ejecutar instalador
if (require.main === module) {
  main();
}

module.exports = { generateSecrets, createDirectories };

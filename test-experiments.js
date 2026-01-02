#!/usr/bin/env node

/**
 * Script de prueba rápida para los endpoints de experimentos
 * Uso: node test-experiments.js
 */

const http = require('http');

// Configuración
const API_URL = 'http://localhost:3000';
let authToken = null;
let userId = null;

// Funciones de utilidad
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function test() {
  console.log('🧪 Iniciando pruebas de endpoints de experimentos...\n');

  try {
    // 1. Login
    console.log('1. Intentando login...');
    const loginRes = await makeRequest('POST', '/api/login', {
      username: 'admin',
      password: 'admin'
    });
    
    if (loginRes.status !== 200) {
      console.log('❌ Login fallido:', loginRes.data);
      console.log('\n💡 Nota: Primero debes crear un usuario.');
      console.log('   Intenta accediendo a http://localhost:3000 y registrándote.');
      return;
    }

    authToken = loginRes.data.token;
    userId = loginRes.data.userId;
    console.log('✅ Login exitoso. Token:', authToken.substring(0, 20) + '...');
    console.log('   userId:', userId, '\n');

    // 2. Crear experimento
    console.log('2. Creando experimento...'); 
    const createRes = await makeRequest('POST', '/api/experiments', {
      name: 'Experimento de Prueba ' + Date.now(),
      description: 'Este es un experimento de prueba'
    });
    
    if (createRes.status !== 201) {
      console.log('❌ Crear experimento fallido:', createRes.data);
      return;
    }

    const experimentId = createRes.data.id;
    console.log('✅ Experimento creado. ID:', experimentId, '\n');

    // 3. Listar experimentos
    console.log('3. Listando experimentos...');
    const listRes = await makeRequest('GET', '/api/experiments');
    
    if (listRes.status !== 200) {
      console.log('❌ Listar experimentos fallido:', listRes.data);
      return;
    }

    console.log('✅ Experimentos:', listRes.data.length);
    console.log('   Últimas 2:', JSON.stringify(listRes.data.slice(-2), null, 2), '\n');

    // 4. Crear bloque
    console.log('4. Creando bloque de lectura...');
    const blockRes = await makeRequest('POST', `/api/experiments/${experimentId}/blocks`, {
      blockNumber: 1,
      name: 'Bloque de Prueba',
      duration: 5
    });

    if (blockRes.status !== 201) {
      console.log('❌ Crear bloque fallido:', blockRes.data);
      return;
    }

    const blockId = blockRes.data.id;
    console.log('✅ Bloque creado. ID:', blockId, '\n');

    // 5. Guardar configuración de estímulos
    console.log('5. Guardando configuración de estímulos...');
    const configRes = await makeRequest('POST', `/api/blocks/${blockId}/stimuli-config`, {
      vibrationEnabled: true,
      auditoryEnabled: false,
      visualEnabled: true,
      extraStimuli: [],
      randomFrequency: 2.5,
      frequencyCross: true
    });

    if (configRes.status !== 200 && configRes.status !== 201) {
      console.log('❌ Guardar configuración fallido:', configRes.data);
      return;
    }

    console.log('✅ Configuración guardada.\n');

    // 6. Obtener configuración
    console.log('6. Obteniendo configuración de estímulos...');
    const getConfigRes = await makeRequest('GET', `/api/blocks/${blockId}/stimuli-config`);

    if (getConfigRes.status !== 200) {
      console.log('❌ Obtener configuración fallido:', getConfigRes.data);
      return;
    }

    console.log('✅ Configuración obtenida:');
    console.log('   ', JSON.stringify(getConfigRes.data, null, 2), '\n');

    // 7. Listar bloques
    console.log('7. Listando bloques...');
    const blocksRes = await makeRequest('GET', `/api/experiments/${experimentId}/blocks`);

    if (blocksRes.status !== 200) {
      console.log('❌ Listar bloques fallido:', blocksRes.data);
      return;
    }

    console.log('✅ Bloques:', blocksRes.data.length);
    console.log('   ', JSON.stringify(blocksRes.data, null, 2), '\n');

    console.log('✅ ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!');
    console.log('\n📝 Resumen:');
    console.log('  - Experimento:', createRes.data.name);
    console.log('  - ID Experimento:', experimentId);
    console.log('  - Bloque:', blockRes.data.name);
    console.log('  - ID Bloque:', blockId);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();

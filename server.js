require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
// const WebSocket = require('ws'); // Gazepoint ahora manejado desde Python
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const db = require('./db/init-db');
const bcrypt = require('bcryptjs');
const config = require('./config');
const emailService = require('./services/emailService');

const app = express();
const PORT = config.PORT;

// ============ UTILIDADES DE ERROR ============
/**
 * Respuesta estandarizada de error
 * NO expone detalles internos en producción
 * @param {number} statusCode - Código HTTP
 * @param {string} message - Mensaje público para el cliente
 * @param {Error} error - Error interno (para logging)
 * @returns {Object} Respuesta estandarizada
 */
function createErrorResponse(statusCode, message, error = null) {
  if (error) {
    console.error(`[ERROR ${statusCode}] ${message}:`, error.message);
  }
  return { status: statusCode, json: { error: message } };
}

// Middleware para desactivar keep-alive y forzar conexiones de una sola vez
app.use((req, res, next) => {
  res.set('Connection', 'close');
  next();
});

app.use(cors());
app.use(express.json());

// ============ SESIONES DE USUARIO (en memoria) ============
const activeSessions = new Map(); // sessionToken -> { userId, username, isDeveloper, expiresAt }

// Función para obtener hora de medianoche
function getMidnightTime() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // Próxima medianoche
  return midnight;
}

// Middleware para verificar sesión
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  const token = authHeader.substring(7);
  const session = activeSessions.get(token);
  
  if (!session) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  
  // Verificar si la sesión expiró (medianoche)
  if (new Date() > session.expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'Sesión expirada' });
  }
  
  req.user = session;
  next();
}

// Middleware para verificar que el usuario esté verificado por email
function requireVerified(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  const token = authHeader.substring(7);
  const session = activeSessions.get(token);
  
  if (!session) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }
  
  // Verificar si la sesión expiró
  if (new Date() > session.expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'Sesión expirada' });
  }
  
  // Verificar que el usuario esté verificado en la BD
  db.get('SELECT isVerified FROM users WHERE id = ?', [session.userId], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    
    if (!user.isVerified) {
      return res.status(403).json({ error: 'Debes verificar tu email para usar esta función' });
    }
    
    req.user = session;
    next();
  });
}

// ============ ENDPOINTS DE AUTENTICACIÓN ============

// Login
/**
 * Endpoint de login con validación y rate limiting
 * POST /api/login
 * Body: { username: string, password: string }
 * Returns: { token: string, user: Object }
 */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log(`📱 LOGIN INTENTO: usuario="${username}", contraseña="${password}"`);
  console.log(`   Longitud contraseña: ${password ? password.length : 0}`);
  
  // Validación de inputs
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }
  
  // Validar longitud de entrada para prevenir ataques
  if (username.length < config.VALIDATION.USERNAME_MIN_LENGTH || 
      username.length > config.VALIDATION.USERNAME_MAX_LENGTH) {
    console.log(`❌ Usuario inválido: longitud ${username.length}`);
    return res.status(400).json({ error: 'Usuario inválido' });
  }
  
  if (password.length < config.VALIDATION.PASSWORD_MIN_LENGTH || 
      password.length > config.VALIDATION.PASSWORD_MAX_LENGTH) {
    console.log(`❌ Contraseña inválida: longitud ${password.length}`);
    return res.status(400).json({ error: 'Contraseña inválida' });
  }
  
  db.get(
    'SELECT id, username, password, isDeveloper, isVerified, email, preferences FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        console.error('❌ Error en login:', err);
        return res.status(500).json({ error: 'Error del servidor' });
      }
      
      if (!user) {
        console.log(`❌ Usuario no encontrado: "${username}"`);
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      }
      
      console.log(`✅ Usuario encontrado: "${username}", verificado: ${user.isVerified === 1}`);
      console.log(`   Hash guardado: ${user.password.substring(0, 30)}...`);
      
      // Verificar si la cuenta está verificada
      if (!user.isVerified) {
        console.log(`⚠️  Cuenta no verificada`);
        return res.status(403).json({ 
          error: 'Por favor verifica tu correo electrónico antes de iniciar sesión',
          unverified: true,
          email: user.email
        });
      }
      
      // Comparar contraseña con bcrypt
      try {
        const ok = await bcrypt.compare(password, user.password);
        console.log(`   Comparación bcrypt: ${ok ? '✅ COINCIDE' : '❌ NO COINCIDE'}`);
        
        if (!ok) {
          console.log(`❌ Contraseña incorrecta`);
          return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        console.log(`✅ Contraseña correcta`);
      } catch (e) {
        console.error('❌ Error comparando bcrypt:', e);
        return res.status(500).json({ error: 'Error del servidor' });
      }

      // Crear token de sesión
      const token = require('crypto').randomBytes(32).toString('hex');
      const expiresAt = getMidnightTime();
      activeSessions.set(token, {
        userId: user.id,
        username: user.username,
        isDeveloper: user.isDeveloper === 1,
        expiresAt
      });
      
      console.log(`🔑 Token generado para usuario: "${username}"`);
      
      let preferences = { fontSize: 100, theme: 'light', font: 'original', lineHeight: 1.45, brightness: 1.0 };
      try {
        preferences = JSON.parse(user.preferences);
      } catch (e) {
        console.error('Error parseando preferencias:', e);
      }
      
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          isDeveloper: user.isDeveloper === 1,
          preferences
        }
      });
    }
  );
});

// Register - Crear nueva cuenta con verificación de email
/**
 * Endpoint para registrar un nuevo usuario
 * POST /api/register
 * Body: { username: string, email: string, password: string }
 * Returns: { message: string, userId: number }
 */
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  // Validación de inputs
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Usuario, correo y contraseña requeridos' });
  }
  
  // Validar longitud de entrada
  if (username.length < config.VALIDATION.USERNAME_MIN_LENGTH || 
      username.length > config.VALIDATION.USERNAME_MAX_LENGTH) {
    return res.status(400).json({ error: 'Usuario debe tener entre 3 y 50 caracteres' });
  }
  
  if (password.length < config.VALIDATION.PASSWORD_MIN_LENGTH || 
      password.length > config.VALIDATION.PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ error: 'Contraseña debe tener entre 4 y 100 caracteres' });
  }
  
  // Validar formato de email
  if (!emailService.isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'Correo electrónico inválido' });
  }
  
  // Validar que sea correo institucional
  if (!emailService.isInstitutionalEmail(email)) {
    const allowedDomains = config.INSTITUTIONAL_EMAILS.domains.join(', ');
    return res.status(400).json({ 
      error: `Solo se permiten correos institucionales: ${allowedDomains}` 
    });
  }
  
  // Verificar si el usuario o email ya existe
  db.get(
    'SELECT id, username, email, isVerified FROM users WHERE username = ? OR email = ?',
    [username, email],
    async (err, existingUser) => {
      if (err) {
        console.error('Error verificando usuario:', err);
        return res.status(500).json({ error: 'Error del servidor' });
      }
      
      if (existingUser) {
        // Si existe pero NO está verificado, ofrece reenviar correo
        if (!existingUser.isVerified) {
          return res.status(409).json({ 
            error: 'Esta cuenta ya existe pero no ha sido verificada',
            userExists: true,
            requiresVerification: true,
            username: existingUser.username,
            email: existingUser.email
          });
        }
        
        // Si ya está verificado, es un error normal
        if (existingUser.username === username) {
          return res.status(409).json({ error: 'El nombre de usuario ya existe' });
        } else {
          return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
        }
      }
      
      try {
        // Hashear contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generar token de verificación
        const verificationToken = emailService.generateVerificationToken();
        const expiresAt = emailService.getTokenExpirationDate();
        
        // Insertar nuevo usuario sin verificar
        db.run(
          `INSERT INTO users (username, email, password, isDeveloper, isVerified, verificationToken, verificationTokenExpires, preferences)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [username, email, hashedPassword, 0, 0, verificationToken, expiresAt, 
           JSON.stringify({ fontSize: 100, theme: 'light', font: 'original', lineHeight: 1.45, brightness: 1.0 })],
          async function(err) {
            if (err) {
              console.error('Error creando usuario:', err);
              return res.status(500).json({ error: 'Error al crear la cuenta' });
            }
            
            try {
              // Enviar email de verificación
              await emailService.sendVerificationEmail(email, username, verificationToken);
              
              res.status(201).json({ 
                message: 'Cuenta creada. Se envió un correo de verificación a tu email.',
                userId: this.lastID,
                requiresVerification: true
              });
            } catch (emailErr) {
              console.error('Error enviando email de verificación:', emailErr);
              // Aun así devolvemos éxito al usuario, pero advierte el error
              res.status(201).json({ 
                message: 'Cuenta creada. No se pudo enviar el correo de verificación. Contacta al administrador.',
                userId: this.lastID,
                requiresVerification: true,
                emailError: true
              });
            }
          }
        );
      } catch (hashErr) {
        console.error('Error hasheando contraseña:', hashErr);
        return res.status(500).json({ error: 'Error del servidor' });
      }
    }
  );
});

// Verify Email - Verificar correo electrónico
/**
 * Endpoint para verificar correo electrónico
 * GET /api/verify-email?token=xxxxx
 */
app.get('/api/verify-email', (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: 'Token de verificación requerido' });
  }
  
  // Buscar usuario con el token
  db.get(
    'SELECT id, username, email, verificationTokenExpires FROM users WHERE verificationToken = ?',
    [token],
    (err, user) => {
      if (err) {
        console.error('Error en verificación de email:', err);
        return res.status(500).json({ error: 'Error del servidor' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'Token de verificación inválido' });
      }
      
      // Verificar si el token expiró
      if (new Date() > new Date(user.verificationTokenExpires)) {
        return res.status(400).json({ error: 'El token de verificación expiró' });
      }
      
      // Marcar usuario como verificado
      db.run(
        'UPDATE users SET isVerified = 1, verificationToken = NULL, verificationTokenExpires = NULL WHERE id = ?',
        [user.id],
        (err) => {
          if (err) {
            console.error('Error actualizando usuario:', err);
            return res.status(500).json({ error: 'Error al verificar correo' });
          }
          
          // Generar un token de autenticación para login automático
          const authToken = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
          
          // Guardar sesión en memoria
          activeSessions.set(authToken, {
            userId: user.id,
            username: user.username,
            isDeveloper: 0,
            expiresAt: expiresAt
          });
          
          res.json({ 
            message: '¡Correo verificado exitosamente! Iniciando sesión...',
            username: user.username,
            email: user.email,
            authToken: authToken,
            autoLogin: true
          });
        }
      );
    }
  );
});

// Reenviar correo de verificación
app.post('/api/resend-verification', async (req, res) => {
  const { username, email } = req.body;
  
  if (!username || !email) {
    return res.status(400).json({ error: 'Usuario y correo requeridos' });
  }
  
  db.get(
    'SELECT id, username, email, isVerified FROM users WHERE username = ? AND email = ?',
    [username, email],
    async (err, user) => {
      if (err) {
        console.error('Error buscando usuario:', err);
        return res.status(500).json({ error: 'Error del servidor' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      if (user.isVerified) {
        return res.status(400).json({ error: 'Este usuario ya está verificado' });
      }
      
      try {
        // Generar nuevo token de verificación
        const verificationToken = emailService.generateVerificationToken();
        const expiresAt = emailService.getTokenExpirationDate();
        
        // Actualizar el token
        db.run(
          'UPDATE users SET verificationToken = ?, verificationTokenExpires = ? WHERE id = ?',
          [verificationToken, expiresAt, user.id],
          async (err) => {
            if (err) {
              console.error('Error actualizando token:', err);
              return res.status(500).json({ error: 'Error al reenviar correo' });
            }
            
            try {
              // Enviar email de verificación
              await emailService.sendVerificationEmail(email, username, verificationToken);
              
              res.json({ 
                message: 'Correo de verificación reenviado',
                username: username,
                email: email
              });
            } catch (emailErr) {
              console.error('Error enviando email:', emailErr);
              res.status(201).json({ 
                message: 'No se pudo enviar el correo, pero puedes verificar haciendo clic en el link',
                username: username,
                email: email,
                emailError: true
              });
            }
          }
        );
      } catch (err) {
        console.error('Error generando token:', err);
        return res.status(500).json({ error: 'Error del servidor' });
      }
    }
  );
});

// Logout
app.post('/api/logout', requireAuth, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.substring(7);
  activeSessions.delete(token);
  res.json({ message: 'Sesión cerrada' });
});

// Obtener usuario actual
app.get('/api/user', requireAuth, (req, res) => {
  db.get(
    'SELECT id, username, isDeveloper, preferences FROM users WHERE id = ?',
    [req.user.userId],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      
      let preferences = { fontSize: 100, theme: 'light', font: 'original', lineHeight: '1.6' };
      try {
        preferences = JSON.parse(user.preferences);
      } catch (e) {}
      
      res.json({
        id: user.id,
        username: user.username,
        isDeveloper: user.isDeveloper === 1,
        preferences
      });
    }
  );
});

// Actualizar preferencias del usuario
app.put('/api/user/preferences', requireAuth, (req, res) => {
  const { preferences } = req.body;
  
  if (!preferences) {
    return res.status(400).json({ error: 'Preferencias requeridas' });
  }
  
  db.run(
    'UPDATE users SET preferences = ? WHERE id = ?',
    [JSON.stringify(preferences), req.user.userId],
    (err) => {
      if (err) {
        console.error('Error actualizando preferencias:', err);
        return res.status(500).json({ error: 'Error al guardar preferencias' });
      }
      res.json({ message: 'Preferencias actualizadas', preferences });
    }
  );
});

// Guardar progreso de lectura
app.post('/api/reading-progress', requireAuth, (req, res) => {
  const { bookFile, currentPage, totalPages, progress } = req.body;
  
  console.log('[server] 💾 POST /api/reading-progress:', { bookFile, currentPage, totalPages, progress: progress?.toFixed(1) + '%' });
  
  if (!bookFile || currentPage === undefined || totalPages === undefined) {
    console.error('[server] ❌ Datos incompletos:', req.body);
    return res.status(400).json({ error: 'Datos incompletos' });
  }
  
  db.run(
    `INSERT INTO reading_progress (userId, bookFile, currentPage, totalPages, progress, lastReadAt)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(userId, bookFile) DO UPDATE SET 
       currentPage = ?,
       totalPages = ?,
       progress = ?,
       lastReadAt = datetime('now')`,
    [req.user.userId, bookFile, currentPage, totalPages, progress, currentPage, totalPages, progress],
    (err) => {
      if (err) {
        console.error('[server] ❌ Error guardando progreso:', err);
        return res.status(500).json({ error: 'Error al guardar progreso' });
      }
      console.log('[server] ✅ Progreso guardado para', bookFile);
      res.json({ message: 'Progreso guardado' });
    }
  );
});

// Obtener progreso de lectura de un libro
app.get('/api/reading-progress/:bookFile', requireAuth, (req, res) => {
  const bookFile = decodeURIComponent(req.params.bookFile);
  
  console.log('[server] 📖 GET /api/reading-progress/:bookFile -', bookFile);
  
  db.get(
    'SELECT currentPage, totalPages, progress, lastReadAt FROM reading_progress WHERE userId = ? AND bookFile = ?',
    [req.user.userId, bookFile],
    (err, row) => {
      if (err) {
        console.error('[server] ❌ Error obteniendo progreso:', err);
        return res.status(500).json({ error: 'Error al obtener progreso' });
      }
      
      if (!row) {
        console.log('[server] ℹ️ No hay progreso guardado para', bookFile);
        return res.json({ currentPage: 1, totalPages: 0, progress: 0 });
      }
      
      console.log('[server] ✅ Progreso encontrado:', { bookFile, currentPage: row.currentPage, totalPages: row.totalPages, progress: row.progress?.toFixed(1) + '%' });
      res.json(row);
    }
  );
});

// Obtener todos los progresos del usuario
app.get('/api/reading-progress', requireAuth, (req, res) => {
  db.all(
    'SELECT bookFile, currentPage, totalPages, progress, lastReadAt FROM reading_progress WHERE userId = ?',
    [req.user.userId],
    (err, rows) => {
      if (err) {
        console.error('Error obteniendo progresos:', err);
        return res.status(500).json({ error: 'Error al obtener progresos' });
      }
      
      res.json(rows || []);
    }
  );
});

// ============ ENDPOINTS DE PREFERENCIAS DE USUARIO ============

// Obtener preferencias del usuario
app.get('/api/user-preferences', requireAuth, (req, res) => {
  db.get(
    'SELECT preferences FROM users WHERE id = ?',
    [req.user.userId],
    (err, row) => {
      if (err) {
        console.error('Error obteniendo preferencias:', err);
        return res.status(500).json({ error: 'Error al obtener preferencias' });
      }
      
      if (!row || !row.preferences) {
        return res.json({
          fontSize: 100,
          lineHeight: 1.45,
          theme: 'light',
          font: 'original',
          brightness: 1.0
        });
      }
      
      try {
        res.json(JSON.parse(row.preferences));
      } catch (e) {
        res.json({
          fontSize: 100,
          lineHeight: 1.45,
          theme: 'light',
          font: 'original',
          brightness: 1.0
        });
      }
    }
  );
});

// Guardar preferencias del usuario
app.post('/api/user-preferences', requireAuth, (req, res) => {
  const prefs = req.body;
  
  if (!prefs) {
    return res.status(400).json({ error: 'Preferencias requeridas' });
  }
  
  const prefsJson = JSON.stringify(prefs);
  
  db.run(
    'UPDATE users SET preferences = ? WHERE id = ?',
    [prefsJson, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error guardando preferencias:', err);
        return res.status(500).json({ error: 'Error al guardar preferencias' });
      }
      res.json({ message: 'Preferencias guardadas' });
    }
  );
});

// ============ ENDPOINTS DE EXPERIMENTOS ============

// Obtener experimentos del usuario
app.get('/api/experiments', requireVerified, (req, res) => {
  db.all(
    'SELECT * FROM experiments WHERE userId = ? ORDER BY createdAt DESC',
    [req.user.userId],
    (err, experiments) => {
      if (err) {
        console.error('Error obteniendo experimentos:', err);
        return res.status(500).json({ error: 'Error al obtener experimentos' });
      }
      res.json(experiments || []);
    }
  );
});

// Crear nuevo experimento
app.post('/api/experiments', requireVerified, (req, res) => {
  const { name, description } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nombre del experimento requerido' });
  }
  
  db.run(
    'INSERT INTO experiments (userId, name, description) VALUES (?, ?, ?)',
    [req.user.userId, name.trim(), description || ''],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'Este experimento ya existe' });
        }
        console.error('Error creando experimento:', err);
        return res.status(500).json({ error: 'Error al crear experimento' });
      }
      res.status(201).json({ id: this.lastID, userId: req.user.userId, name, description });
    }
  );
});

// Actualizar experimento
app.put('/api/experiments/:id', requireVerified, (req, res) => {
  const { name, description } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nombre del experimento requerido' });
  }
  
  db.run(
    'UPDATE experiments SET name = ?, description = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?',
    [name.trim(), description || '', req.params.id, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error actualizando experimento:', err);
        return res.status(500).json({ error: 'Error al actualizar experimento' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Experimento no encontrado' });
      }
      res.json({ message: 'Experimento actualizado' });
    }
  );
});

// Eliminar experimento (y sus bloques)
app.delete('/api/experiments/:id', requireVerified, (req, res) => {
  db.run(
    'DELETE FROM experiments WHERE id = ? AND userId = ?',
    [req.params.id, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error eliminando experimento:', err);
        return res.status(500).json({ error: 'Error al eliminar experimento' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Experimento no encontrado' });
      }
      res.json({ message: 'Experimento eliminado' });
    }
  );
});

// ============ ENDPOINTS DE BLOQUES DE LECTURA ============

// Obtener bloques de un experimento
app.get('/api/experiments/:experimentId/blocks', requireVerified, (req, res) => {
  db.all(
    `SELECT rb.* FROM reading_blocks rb
     JOIN experiments e ON rb.experimentId = e.id
     WHERE rb.experimentId = ? AND e.userId = ?
     ORDER BY rb.blockNumber ASC`,
    [req.params.experimentId, req.user.userId],
    (err, blocks) => {
      if (err) {
        console.error('Error obteniendo bloques:', err);
        return res.status(500).json({ error: 'Error al obtener bloques' });
      }
      res.json(blocks || []);
    }
  );
});

// Crear nuevo bloque
app.post('/api/experiments/:experimentId/blocks', requireVerified, (req, res) => {
  const { blockNumber, name, duration, bookId, pageNumber } = req.body;
  const { experimentId } = req.params;
  
  if (!blockNumber || !name || !duration) {
    return res.status(400).json({ error: 'Datos del bloque incompletos' });
  }
  
  // Verificar que el experimento pertenece al usuario
  db.get(
    'SELECT id FROM experiments WHERE id = ? AND userId = ?',
    [experimentId, req.user.userId],
    (err, experiment) => {
      if (err || !experiment) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      db.run(
        'INSERT INTO reading_blocks (experimentId, blockNumber, name, duration, bookId, pageNumber) VALUES (?, ?, ?, ?, ?, ?)',
        [experimentId, blockNumber, name, duration, bookId || null, pageNumber || 1],
        function(err) {
          if (err) {
            console.error('Error creando bloque:', err);
            return res.status(500).json({ error: 'Error al crear bloque' });
          }
          res.status(201).json({ 
            id: this.lastID, 
            experimentId, 
            blockNumber, 
            name, 
            duration,
            bookId: bookId || null,
            pageNumber: pageNumber || 1
          });
        }
      );
    }
  );
});

// Actualizar bloque
app.put('/api/experiments/:experimentId/blocks/:blockId', requireVerified, (req, res) => {
  const { name, duration, bookId, pageNumber } = req.body;
  const { experimentId, blockId } = req.params;
  
  // Verificar que el experimento pertenece al usuario
  db.get(
    'SELECT id FROM experiments WHERE id = ? AND userId = ?',
    [experimentId, req.user.userId],
    (err, experiment) => {
      if (err || !experiment) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      db.run(
        'UPDATE reading_blocks SET name = ?, duration = ?, bookId = ?, pageNumber = ? WHERE id = ? AND experimentId = ?',
        [name, duration, bookId || null, pageNumber || 1, blockId, experimentId],
        function(err) {
          if (err) {
            console.error('Error actualizando bloque:', err);
            return res.status(500).json({ error: 'Error al actualizar bloque' });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Bloque no encontrado' });
          }
          res.json({ message: 'Bloque actualizado' });
        }
      );
    }
  );
});

// Eliminar bloque
app.delete('/api/experiments/:experimentId/blocks/:blockId', requireVerified, (req, res) => {
  const { experimentId, blockId } = req.params;
  
  // Verificar que el experimento pertenece al usuario
  db.get(
    'SELECT id FROM experiments WHERE id = ? AND userId = ?',
    [experimentId, req.user.userId],
    (err, experiment) => {
      if (err || !experiment) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      db.run(
        'DELETE FROM reading_blocks WHERE id = ? AND experimentId = ?',
        [blockId, experimentId],
        function(err) {
          if (err) {
            console.error('Error eliminando bloque:', err);
            return res.status(500).json({ error: 'Error al eliminar bloque' });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Bloque no encontrado' });
          }
          res.json({ message: 'Bloque eliminado' });
        }
      );
    }
  );
});

// ============ ENDPOINTS DE CONFIGURACIÓN DE BLOQUES ============

// Obtener configuración de estímulos de un bloque
app.get('/api/blocks/:blockId/stimuli-config', requireVerified, (req, res) => {
  db.get(
    `SELECT bsc.* FROM block_stimuli_config bsc
     JOIN reading_blocks rb ON bsc.blockId = rb.id
     JOIN experiments e ON rb.experimentId = e.id
     WHERE bsc.blockId = ? AND e.userId = ?`,
    [req.params.blockId, req.user.userId],
    (err, config) => {
      if (err) {
        console.error('Error obteniendo configuración de estímulos:', err);
        return res.status(500).json({ error: 'Error al obtener configuración' });
      }
      res.json(config || {});
    }
  );
});

// Guardar/actualizar configuración de estímulos
app.post('/api/blocks/:blockId/stimuli-config', requireVerified, (req, res) => {
  const { blockId } = req.params;
  const { vibrationEnabled, auditoryEnabled, visualEnabled, extraStimuli, randomFrequency, frequencyCross } = req.body;
  
  // Verificar autorización
  db.get(
    `SELECT rb.id FROM reading_blocks rb
     JOIN experiments e ON rb.experimentId = e.id
     WHERE rb.id = ? AND e.userId = ?`,
    [blockId, req.user.userId],
    (err, block) => {
      if (err || !block) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      // Primero intentar insertar, si falla (unique constraint), actualizar
      db.run(
        `INSERT OR REPLACE INTO block_stimuli_config 
         (blockId, vibrationEnabled, auditoryEnabled, visualEnabled, extraStimuli, randomFrequency, frequencyCross)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [blockId, vibrationEnabled ? 1 : 0, auditoryEnabled ? 1 : 0, visualEnabled ? 1 : 0, 
         JSON.stringify(extraStimuli || []), randomFrequency || 1.0, frequencyCross ? 1 : 0],
        function(err) {
          if (err) {
            console.error('Error guardando configuración de estímulos:', err);
            return res.status(500).json({ error: 'Error al guardar configuración' });
          }
          res.json({ message: 'Configuración guardada' });
        }
      );
    }
  );
});

// ============ ENDPOINTS DE CORRIDAS DE EXPERIMENTOS ============

// Crear una nueva corrida de experimento
app.post('/api/experiment-runs', requireVerified, (req, res) => {
  const { experimentId, totalBlocks } = req.body;
  
  // Verificar que el experimento pertenece al usuario
  db.get(
    'SELECT id, name FROM experiments WHERE id = ? AND userId = ?',
    [experimentId, req.user.userId],
    (err, experiment) => {
      if (err || !experiment) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      db.run(
        `INSERT INTO experiment_runs (experimentId, userId, totalBlocks, status, startTime)
         VALUES (?, ?, ?, 'in_progress', CURRENT_TIMESTAMP)`,
        [experimentId, req.user.userId, totalBlocks],
        function(err) {
          if (err) {
            console.error('Error creando corrida:', err);
            return res.status(500).json({ error: 'Error al crear corrida' });
          }
          res.status(201).json({ 
            id: this.lastID,
            experimentId,
            totalBlocks,
            status: 'in_progress'
          });
        }
      );
    }
  );
});

// Iniciar un bloque dentro de una corrida
app.post('/api/experiment-runs/blocks', requireVerified, (req, res) => {
  const { runId, blockId, blockNumber, bookId, pageNumber } = req.body;
  
  // Verificar autorización
  db.get(
    'SELECT id FROM experiment_runs WHERE id = ? AND userId = ?',
    [runId, req.user.userId],
    (err, run) => {
      if (err || !run) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      db.run(
        `INSERT INTO experiment_run_blocks 
         (runId, blockId, blockNumber, bookId, pageNumber)
         VALUES (?, ?, ?, ?, ?)`,
        [runId, blockId, blockNumber, bookId, pageNumber],
        function(err) {
          if (err) {
            console.error('Error creando run block:', err);
            return res.status(500).json({ error: 'Error al iniciar bloque' });
          }
          res.status(201).json({ 
            id: this.lastID,
            runId,
            blockId,
            blockNumber
          });
        }
      );
    }
  );
});

// Completar un bloque
app.put('/api/experiment-runs/blocks/:runBlockId/complete', requireVerified, (req, res) => {
  const { runBlockId } = req.params;
  
  // Verificar autorización
  db.get(
    `SELECT erb.* FROM experiment_run_blocks erb
     JOIN experiment_runs er ON erb.runId = er.id
     WHERE erb.id = ? AND er.userId = ?`,
    [runBlockId, req.user.userId],
    (err, runBlock) => {
      if (err || !runBlock) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      const now = new Date().toISOString();
      const startTime = new Date(runBlock.startTime);
      const duration = Math.floor((new Date(now) - startTime) / 1000);
      
      db.run(
        `UPDATE experiment_run_blocks 
         SET endTime = ?, duration = ?
         WHERE id = ?`,
        [now, duration, runBlockId],
        function(err) {
          if (err) {
            console.error('Error completando bloque:', err);
            return res.status(500).json({ error: 'Error al completar bloque' });
          }
          
          // Actualizar contador de bloques completados en la corrida
          db.run(
            `UPDATE experiment_runs
             SET completedBlocks = completedBlocks + 1
             WHERE id = ?`,
            [runBlock.runId],
            (err) => {
              if (err) console.error('Error actualizando contador:', err);
            }
          );
          
          res.json({ message: 'Bloque completado' });
        }
      );
    }
  );
});

// Completar corrida de experimento
app.put('/api/experiment-runs/:runId/complete', requireVerified, (req, res) => {
  const { runId } = req.params;
  
  // Verificar autorización
  db.get(
    'SELECT * FROM experiment_runs WHERE id = ? AND userId = ?',
    [runId, req.user.userId],
    (err, run) => {
      if (err || !run) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      const now = new Date().toISOString();
      const startTime = new Date(run.startTime);
      const duration = Math.floor((new Date(now) - startTime) / 1000);
      
      db.run(
        `UPDATE experiment_runs
         SET endTime = ?, duration = ?, status = 'completed'
         WHERE id = ?`,
        [now, duration, runId],
        function(err) {
          if (err) {
            console.error('Error completando corrida:', err);
            return res.status(500).json({ error: 'Error al completar corrida' });
          }
          res.json({ message: 'Corrida completada' });
        }
      );
    }
  );
});

// Cancelar corrida de experimento
app.put('/api/experiment-runs/:runId/cancel', requireVerified, (req, res) => {
  const { runId } = req.params;
  
  db.run(
    `UPDATE experiment_runs
     SET status = 'cancelled', endTime = CURRENT_TIMESTAMP
     WHERE id = ? AND userId = ?`,
    [runId, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error cancelando corrida:', err);
        return res.status(500).json({ error: 'Error al cancelar corrida' });
      }
      res.json({ message: 'Corrida cancelada' });
    }
  );
});

// Guardar datos capturados durante el experimento
app.post('/api/experiment-runs/data', requireVerified, (req, res) => {
  const { runId, runBlockId, dataType, data } = req.body;
  
  // Verificar autorización
  db.get(
    'SELECT id FROM experiment_runs WHERE id = ? AND userId = ?',
    [runId, req.user.userId],
    (err, run) => {
      if (err || !run) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      db.run(
        `INSERT INTO experiment_data (runId, runBlockId, dataType, data)
         VALUES (?, ?, ?, ?)`,
        [runId, runBlockId, dataType, data],
        function(err) {
          if (err) {
            console.error('Error guardando datos:', err);
            return res.status(500).json({ error: 'Error al guardar datos' });
          }
          res.status(201).json({ id: this.lastID });
        }
      );
    }
  );
});

// Obtener todas las corridas de un experimento
app.get('/api/experiments/:experimentId/runs', requireVerified, (req, res) => {
  const { experimentId } = req.params;
  
  db.all(
    `SELECT * FROM experiment_runs
     WHERE experimentId = ? AND userId = ?
     ORDER BY startTime DESC`,
    [experimentId, req.user.userId],
    (err, runs) => {
      if (err) {
        console.error('Error obteniendo corridas:', err);
        return res.status(500).json({ error: 'Error al obtener corridas' });
      }
      res.json(runs);
    }
  );
});

// Obtener detalles de una corrida específica
app.get('/api/experiment-runs/:runId', requireVerified, (req, res) => {
  const { runId } = req.params;
  
  // Obtener datos de la corrida
  db.get(
    `SELECT er.*, e.name as experimentName, e.description as experimentDescription
     FROM experiment_runs er
     JOIN experiments e ON er.experimentId = e.id
     WHERE er.id = ? AND er.userId = ?`,
    [runId, req.user.userId],
    (err, run) => {
      if (err || !run) {
        return res.status(403).json({ error: 'No autorizado o corrida no encontrada' });
      }
      
      // Obtener bloques de la corrida
      db.all(
        `SELECT erb.*, rb.name as blockName, rb.duration as expectedDuration
         FROM experiment_run_blocks erb
         JOIN reading_blocks rb ON erb.blockId = rb.id
         WHERE erb.runId = ?
         ORDER BY erb.blockNumber`,
        [runId],
        (err, blocks) => {
          if (err) {
            console.error('Error obteniendo bloques:', err);
            return res.status(500).json({ error: 'Error al obtener bloques' });
          }
          
          // Obtener datos capturados
          db.all(
            `SELECT * FROM experiment_data
             WHERE runId = ?
             ORDER BY timestamp`,
            [runId],
            (err, data) => {
              if (err) {
                console.error('Error obteniendo datos:', err);
                return res.status(500).json({ error: 'Error al obtener datos' });
              }
              
              res.json({
                ...run,
                blocks,
                data
              });
            }
          );
        }
      );
    }
  );
});

// Verificar contraseña del usuario (para cancelación)
app.post('/api/auth/verify-password', requireVerified, async (req, res) => {
  const { password } = req.body;
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT password FROM users WHERE id = ?',
        [req.user.userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (isValid) {
      res.json({ valid: true });
    } else {
      res.status(401).json({ valid: false });
    }
  } catch (err) {
    console.error('Error verificando contraseña:', err);
    res.status(500).json({ error: 'Error al verificar contraseña' });
  }
});

// Configuración de directorios
const recordingsDir = path.join(__dirname, 'camera-recorder-app', 'server', 'recordings');
const librosPath = path.join(__dirname, 'public', 'libros');

// Crear directorios si no existen
try { 
    fs.mkdirSync(recordingsDir, { recursive: true }); 
    fs.mkdirSync(librosPath, { recursive: true });
} catch (e) {
    console.error('Error creando directorios:', e);
}

// ============ GAZEPOINT CONFIG ============
// Gazepoint ahora se maneja desde un servicio Python separado
// El frontend solo muestra indicadores visuales de estado de conexión
// Los datos se capturan en el backend Python y se envían vía API REST

// ============ CREAR SERVIDOR HTTP ============
const server = http.createServer(app);

// Configurar timeouts para conexiones rápidas sin keep-alive agresivo
server.keepAliveTimeout = 1000; // 1 segundo - menos agresivo
server.headersTimeout = 2000; // Ligeramente mayor que keepAliveTimeout
server.requestTimeout = 3000; // Timeout para requests (3 segundos)

// Mantener track de todas las conexiones activas para poder cerrarlas
const activeConnections = new Set();

server.on('connection', (socket) => {
  activeConnections.add(socket);
  
  // Configurar socket para cierre rápido SIN keep-alive agresivo
  socket.setKeepAlive(false); // Desactivar keep-alive completamente
  socket.setTimeout(3000); // Timeout de 3 segundos
  
  socket.on('close', () => {
    activeConnections.delete(socket);
  });
  
  socket.on('timeout', () => {
    console.log('Socket timeout, cerrando conexión');
    socket.destroy();
    activeConnections.delete(socket);
  });
  
  socket.on('error', (err) => {
    console.error('Error en socket:', err.message);
    activeConnections.delete(socket);
    socket.destroy();
  });
});

// ============ WEBSOCKET ============
// WebSocket desactivado - Gazepoint ahora manejado desde Python
// El frontend mostrará indicadores visuales de conexión
// Los datos se enviarán vía API REST desde el servicio Python

// ============ CORS ============
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

// ============ ARCHIVOS ESTÁTICOS ============
app.use('/public', express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path, stat) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        if (path.endsWith('.epub')) {
            res.set('Content-Type', 'application/epub+zip');
        }
    }
}));

app.use(express.static(path.join(__dirname, 'build')));

// ============ API: LIBROS ============
app.get('/api/libros', (req, res) => {
  console.log('Solicitud recibida para /api/libros');
  
  // Parámetros de paginación
  const page = parseInt(req.query.page) || 0;
  const limit = parseInt(req.query.limit) || 6;
  const startIndex = page * limit;
  const endIndex = startIndex + limit;
  
  fs.readdir(librosPath, (err, files) => {
    if (err) {
      console.error('Error al leer la carpeta de libros:', err);
      return res.status(500).json({ error: 'Error al leer la carpeta de libros', details: err.message });
    }
    
    const allEpubs = files
      .filter(file => file.toLowerCase().endsWith('.epub'))
      .map(file => {
        const absolutePath = path.join(librosPath, file);
        const stats = fs.statSync(absolutePath);
        
        return {
          titulo: file.replace(/\.epub$/i, ''),
          archivo: `/public/libros/${file}`,
          size: stats.size,
          lastModified: stats.mtime
        };
      });
    
    // Calcular metadatos de paginación
    const totalBooks = allEpubs.length;
    const totalPages = Math.ceil(totalBooks / limit);
    const paginatedBooks = allEpubs.slice(startIndex, endIndex);
    
    console.log(`Página ${page}, libros ${startIndex + 1}-${Math.min(endIndex, totalBooks)} de ${totalBooks} total`);
    
    res.json({
      books: paginatedBooks,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalBooks: totalBooks,
        booksPerPage: limit,
        hasNextPage: page < totalPages - 1,
        hasPrevPage: page > 0
      }
    });
  });
});

// Lista simple de libros (para selects)
app.get('/api/books', (req, res) => {
  fs.readdir(librosPath, (err, files) => {
    if (err) {
      console.error('Error al leer libros:', err);
      return res.status(500).json({ error: 'Error al leer libros' });
    }

    const books = files
      .filter(file => file.toLowerCase().endsWith('.epub'))
      .map(file => ({
        id: file.replace(/\.epub$/i, ''),
        name: file.replace(/\.epub$/i, ''),
        title: file.replace(/\.epub$/i, ''),
        path: `/public/libros/${file}`
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    res.json(books);
  });
});

// ============ FUNCIONES AUXILIARES ============
function findSessionFolder(sessionId) {
  const sessionFolderName = sessionId.replace('Z', '');
  const sessionFolder = path.join(recordingsDir, sessionFolderName);
  if (fs.existsSync(sessionFolder)) {
    return sessionFolder;
  }
  return null;
}

// ============ MULTER: UPLOAD ============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Si hay sessionId en el request, buscar o crear la carpeta correspondiente
    const sessionId = req.body?.sessionId;
    if (sessionId) {
      const sessionFolderName = sessionId.replace('Z', '');
      const sessionFolder = path.join(recordingsDir, sessionFolderName);
      
      // Crear la carpeta si no existe
      try {
        fs.mkdirSync(sessionFolder, { recursive: true });
        console.log('Guardando video en carpeta de sesión:', sessionFolder);
        cb(null, sessionFolder);
      } catch (e) {
        console.error('Error creando carpeta de sesión:', e);
        cb(null, recordingsDir);
      }
    } else if (currentRecordingFolder) {
      console.log('Guardando video en carpeta de grabación activa:', currentRecordingFolder);
      cb(null, currentRecordingFolder);
    } else {
      console.log('No hay sesión específica, guardando en carpeta general');
      cb(null, recordingsDir);
    }
  },
  filename: (req, file, cb) => {
    let name = file.originalname || `recording-${Date.now()}.webm`;
    name = path.basename(name);
    cb(null, name);
  }
});
const upload = multer({ storage });

app.post('/api/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No se recibió ningún archivo');
  }
  
  try {
    console.log('Archivo recibido (formato original):', req.file.path);
    
    // Mantener formato original (WebM)
    res.status(200).json({ 
      ok: true, 
      filename: path.basename(req.file.path),
      path: req.file.path,
      format: 'webm'
    });
  } catch (e) {
    console.error('Error en upload:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============ RUTA CATCH-ALL (SPA) ============
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// ============ INICIAR SERVIDOR ============
server.listen(PORT, () => {
  console.log(`Servidor integrado corriendo en http://localhost:${PORT}`);
  console.log(`  - API en http://localhost:${PORT}/api`);
  console.log(`  - Frontend en http://localhost:${PORT}`);
  console.log(`  - WebSocket en ws://localhost:${PORT}`);
});

// ============ SISTEMA DE LIMPIEZA Y GARBAGE COLLECTION ============
let isShuttingDown = false; // Prevenir múltiples intentos de cierre

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n🛑 Recibida señal ${signal}. Iniciando cierre ordenado...`);
  
  // 1. Detener el servidor HTTP con cierre AGRESIVO de conexiones
  console.log('⏹️  Cerrando servidor HTTP...');
  
  // Cerrar todas las conexiones activas INMEDIATAMENTE
  console.log(`🔌 Forzando cierre de ${activeConnections.size} conexiones HTTP...`);
  activeConnections.forEach(socket => {
    try {
      // Forzar fin inmediato de la conexión
      socket.destroy();
    } catch (e) {}
  });
  activeConnections.clear();
  
  // Cerrar el servidor
  server.close((err) => {
    if (err) {
      console.error('❌ Error cerrando servidor HTTP:', err);
    } else {
      console.log('✅ Servidor HTTP cerrado correctamente');
    }
  });
  
  // NO esperar - forzar cierre inmediato
  if (server.listening) {
    console.log('⚠️  Forzando cierre INMEDIATO del servidor...');
    try {
      server.closeAllConnections && server.closeAllConnections();
      server.close();
    } catch (e) {}
  }

  // 2. Cerrar todas las conexiones WebSocket INMEDIATAMENTE
  console.log('🔌 Cerrando conexiones WebSocket...');
  if (wss) {
    const clientCount = wss.clients.size;
    console.log(`📊 Forzando cierre de ${clientCount} conexiones WebSocket...`);
    
    wss.clients.forEach((client, index) => {
      try {
        // Terminar INMEDIATAMENTE sin mensajes
        client.terminate();
      } catch (e) {}
    });
    
    // Cerrar el WebSocket server inmediatamente
    try {
      wss.close();
      wss.terminate && wss.terminate();
    } catch (e) {}
    
    console.log('✅ WebSocket Server cerrado INMEDIATAMENTE');
  }

  // 3. Cerrar conexión de Gazepoint con limpieza completa
  console.log('👁️  Cerrando conexión Gazepoint...');
  if (gazepointClient) {
    try {
      gazepointClient.removeAllListeners(); // Remover todos los event listeners
      gazepointClient.destroy();
      gazepointClient = null;
      console.log('✅ Conexión Gazepoint cerrada');
    } catch (e) {
      console.error('Error cerrando Gazepoint:', e.message);
    }
  }

  // 4. Limpiar timers de reconexión y resetear intentos
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    console.log('✅ Timer de reconexión limpiado');
  }
  reconnectAttempts = 0; // Resetear contador de intentos

  // 5. Cerrar streams de archivos si están abiertos
  console.log('📁 Cerrando streams de archivos...');
  if (txtStream) {
    try {
      txtStream.end();
      txtStream = null;
      console.log('✅ Stream TXT cerrado');
    } catch (e) {
      console.error('Error cerrando txtStream:', e.message);
    }
  }
  
  if (gazepointStream) {
    try {
      gazepointStream.end();
      gazepointStream = null;
      console.log('✅ Stream Gazepoint cerrado');
    } catch (e) {
      console.error('Error cerrando gazepointStream:', e.message);
    }
  }

  // 6. Limpiar variables globales
  console.log('🧹 Limpiando variables globales...');
  currentRecordingPath = null;
  currentRecordingFolder = null;
  currentSessionId = null;
  headerWritten = false;
  
  // 7. Forzar garbage collection si está disponible
  console.log('🗑️  Ejecutando garbage collection...');
  if (global.gc) {
    try {
      global.gc();
      console.log('✅ Garbage collection ejecutado');
    } catch (e) {
      console.error('Error en garbage collection:', e.message);
    }
  } else {
    console.log('⚠️  Garbage collection no disponible (usar --expose-gc para habilitarlo)');
  }

  // 8. Salir del proceso INMEDIATAMENTE
  console.log('👋 Finalizando proceso...');
  setTimeout(() => {
    console.log('✅ Proceso finalizado correctamente');
    process.exit(0);
  }, 500); // Reducido a 500ms
  
  // Terminación forzada más rápida
  setTimeout(() => {
    console.log('⚠️  Terminación forzada activada');
    process.kill(process.pid, 'SIGKILL');
  }, 2000); // Reducido a 2 segundos
}

// Capturar señales de cierre
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Terminación normal
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT')); // Quit

// Capturar errores no manejados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rechazada sin manejar:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Manejar el evento beforeExit
process.on('beforeExit', (code) => {
  console.log('🔄 Proceso a punto de salir con código:', code);
});

console.log('🛡️  Sistema de limpieza configurado correctamente');
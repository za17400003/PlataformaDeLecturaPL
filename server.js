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
  // Permitir scripts inline, Google Fonts, CDNs, blob URLs para imágenes y estilos (para epubjs)
  res.set('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' blob: https://fonts.googleapis.com https://fonts.gstatic.com; font-src 'self' blob: https://fonts.gstatic.com; img-src 'self' data: blob: https: http:");
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
  
  // Validación de inputs
  if (!username || !username.trim()) {
    console.error(`❌ ERROR LOGIN: username vacío`);
    return res.status(400).json({ error: 'Usuario requerido' });
  }
  
  if (!password) {
    console.error(`❌ ERROR LOGIN: password no proporcionada para usuario "${username}"`);
    return res.status(400).json({ error: 'Contraseña requerida' });
  }
  
  // Validar longitud de entrada para prevenir ataques
  if (username.length < config.VALIDATION.USERNAME_MIN_LENGTH || 
      username.length > config.VALIDATION.USERNAME_MAX_LENGTH) {
    console.error(`❌ ERROR LOGIN: username longitud inválida: ${username.length}`);
    return res.status(400).json({ error: 'Usuario inválido' });
  }
  
  if (password.length < config.VALIDATION.PASSWORD_MIN_LENGTH || 
      password.length > config.VALIDATION.PASSWORD_MAX_LENGTH) {
    console.error(`❌ ERROR LOGIN: password longitud inválida: ${password.length}`);
    return res.status(400).json({ error: 'Contraseña inválida' });
  }
  
  db.get(
    'SELECT id, username, password, isDeveloper, isVerified, email, preferences FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        console.error('❌ ERROR LOGIN en DB:', err);
        return res.status(500).json({ error: 'Error del servidor' });
      }
      
      if (!user) {
        console.error(`❌ ERROR LOGIN: usuario no encontrado: "${username}"`);
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      }
      
      // ⚠️ TEMPORALMENTE DESACTIVADO: Verificar si la cuenta está verificada
      // if (!user.isVerified) {
      //   console.error(`❌ ERROR LOGIN: cuenta no verificada para "${username}"`);
      //   return res.status(403).json({ 
      //     error: 'Por favor verifica tu correo electrónico antes de iniciar sesión',
      //     unverified: true,
      //     email: user.email
      //   });
      // }
      
      // Comparar contraseña con bcrypt
      try {
        const ok = await bcrypt.compare(password, user.password);
        
        if (!ok) {
          console.error(`❌ ERROR LOGIN: contraseña incorrecta para "${username}"`);
          return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
      } catch (e) {
        console.error('❌ ERROR LOGIN en bcrypt compare:', e);
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
      
      let preferences = { fontSize: 100, theme: 'light', font: 'original', lineHeight: 1.45, brightness: 1.0 };
      try {
        preferences = JSON.parse(user.preferences);
      } catch (e) {
        console.warn('⚠️ Error parseando preferencias de usuario:', e.message);
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
  
  // TEMPORALMENTE DESACTIVADO: Validación de correos institucionales
  // if (!emailService.isInstitutionalEmail(email)) {
  //   const allowedDomains = config.INSTITUTIONAL_EMAILS.domains.join(', ');
  //   return res.status(400).json({ 
  //     error: `Solo se permiten correos institucionales: ${allowedDomains}` 
  //   });
  // }
  
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
        
        // Generar token de verificación (por si acaso)
        const verificationToken = emailService.generateVerificationToken();
        const expiresAt = emailService.getTokenExpirationDate();
        
        // ⚠️ TEMPORALMENTE: Crear usuario YA VERIFICADO (sin requerir email)
        db.run(
          `INSERT INTO users (username, email, password, isDeveloper, isVerified, verificationToken, verificationTokenExpires, preferences)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [username, email, hashedPassword, 0, 1, verificationToken, expiresAt, 
           JSON.stringify({ fontSize: 100, theme: 'light', font: 'original', lineHeight: 1.45, brightness: 1.0 })],
          async function(err) {
            if (err) {
              console.error('Error creando usuario:', err);
              return res.status(500).json({ error: 'Error al crear la cuenta' });
            }
            
            try {
              // ⚠️ TEMPORALMENTE DESACTIVADO: Envío de email
              // await emailService.sendVerificationEmail(email, username, verificationToken);
              
              console.log('✅ Usuario registrado (VERIFICACIÓN DE EMAIL DESACTIVADA):', username);
              
              res.status(201).json({ 
                message: '✅ Cuenta creada exitosamente. Puedes iniciar sesión ahora.',
                userId: this.lastID,
                username: username,
                email: email,
                requiresVerification: false,
                verified: true
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

// ============================================================
// RECUPERACIÓN DE CONTRASEÑA
// ============================================================

/**
 * Solicitar recuperación de contraseña
 * POST /api/forgot-password
 */
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Correo requerido' });
  }
  
  db.get(
    'SELECT id, username, email FROM users WHERE email = ?',
    [email],
    async (err, user) => {
      if (err) {
        console.error('Error buscando usuario:', err);
        return res.status(500).json({ error: 'Error del servidor' });
      }
      
      if (!user) {
        // No revelar si el email existe o no (por seguridad)
        return res.json({ 
          message: 'Si el correo existe en nuestro sistema, recibirás un enlace para recuperar tu contraseña',
          email: email
        });
      }
      
      try {
        // Generar token de recuperación
        const resetToken = emailService.generateVerificationToken();
        const expiresAt = emailService.getTokenExpirationDate();
        
        // Guardar token en base de datos
        db.run(
          'UPDATE users SET resetToken = ?, resetTokenExpires = ? WHERE id = ?',
          [resetToken, expiresAt, user.id],
          async (err) => {
            if (err) {
              console.error('Error guardando token de recuperación:', err);
              return res.status(500).json({ error: 'Error al procesar solicitud' });
            }
            
            try {
              // ⚠️ TEMPORALMENTE DESACTIVADO: Envío de email de recuperación
              // await emailService.sendPasswordResetEmail(email, user.username, resetToken);
              
              console.log('✅ Token de recuperación generado (EMAIL DESACTIVADO):', user.username);
              console.log('🔗 Token para testing:', resetToken);
              
              res.json({ 
                message: '✅ Token de recuperación generado. Usa el token para cambiar tu contraseña.',
                email: email,
                username: user.username,
                token: resetToken,  // 🔧 TEMPORALMENTE: Devolver token para testing
                resetUrl: `http://localhost:3000/recuperar-contrasena?token=${resetToken}`,
                expiresIn: '1 hora'
              });
            } catch (emailErr) {
              console.error('Error enviando email de recuperación:', emailErr);
              // Aun así devolvemos un mensaje genérico (no revelamos si falló el envío)
              res.json({ 
                message: '✅ Token de recuperación generado. Usa el token para cambiar tu contraseña.',
                email: email,
                username: user.username,
                token: resetToken,  // 🔧 TEMPORALMENTE: Devolver token para testing
                resetUrl: `http://localhost:3000/recuperar-contrasena?token=${resetToken}`,
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

/**
 * Verificar token de recuperación
 * GET /api/verify-reset-token?token=xxxxx
 */
app.get('/api/verify-reset-token', (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: 'Token requerido' });
  }
  
  db.get(
    'SELECT id, username, email, resetTokenExpires FROM users WHERE resetToken = ?',
    [token],
    (err, user) => {
      if (err) {
        console.error('Error verificando token:', err);
        return res.status(500).json({ error: 'Error del servidor' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'Token inválido' });
      }
      
      // Verificar si el token expiró
      if (new Date() > new Date(user.resetTokenExpires)) {
        return res.status(400).json({ error: 'El token de recuperación expiró' });
      }
      
      res.json({ 
        message: 'Token válido',
        username: user.username,
        email: user.email,
        token: token
      });
    }
  );
});

/**
 * Restablecer contraseña
 * POST /api/reset-password
 */
app.post('/api/reset-password', async (req, res) => {
  const { token, nuevaContrasena } = req.body;
  
  if (!token || !nuevaContrasena) {
    return res.status(400).json({ error: 'Token y contraseña requeridos' });
  }
  
  // Validar longitud de contraseña
  if (nuevaContrasena.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  
  db.get(
    'SELECT id, username, email, resetTokenExpires FROM users WHERE resetToken = ?',
    [token],
    async (err, user) => {
      if (err) {
        console.error('Error buscando usuario:', err);
        return res.status(500).json({ error: 'Error del servidor' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'Token inválido o expirado' });
      }
      
      // Verificar si el token expiró
      if (new Date() > new Date(user.resetTokenExpires)) {
        return res.status(400).json({ error: 'El token de recuperación expiró' });
      }
      
      try {
        // Hashear nueva contraseña
        const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);
        
        // Actualizar contraseña y limpiar token
        db.run(
          'UPDATE users SET password = ?, resetToken = NULL, resetTokenExpires = NULL WHERE id = ?',
          [hashedPassword, user.id],
          (err) => {
            if (err) {
              console.error('Error actualizando contraseña:', err);
              return res.status(500).json({ error: 'Error al actualizar contraseña' });
            }
            
            res.json({ 
              message: 'Contraseña actualizada exitosamente',
              username: user.username,
              email: user.email
            });
          }
        );
      } catch (hashErr) {
        console.error('Error hasheando contraseña:', hashErr);
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
  const userId = req.user.userId;
  
  console.log('[server] 💾 POST /api/reading-progress');
  console.log('[server]   userId:', userId);
  console.log('[server]   bookFile:', bookFile);
  console.log('[server]   currentPage:', currentPage, '/', totalPages);
  console.log('[server]   progress:', progress?.toFixed(1) + '%' || 'undefined');
  
  // Validar parámetros requeridos
  if (!bookFile || bookFile.trim() === '') {
    console.error('[server] ❌ ERROR: bookFile vacío o no proporcionado');
    return res.status(400).json({ error: 'bookFile es requerido' });
  }
  
  if (currentPage === undefined || currentPage === null || currentPage < 1) {
    console.error('[server] ❌ ERROR: currentPage inválido:', currentPage);
    return res.status(400).json({ error: 'currentPage debe ser >= 1' });
  }
  
  if (totalPages === undefined || totalPages === null || totalPages < 1) {
    console.error('[server] ❌ ERROR: totalPages inválido:', totalPages);
    return res.status(400).json({ error: 'totalPages debe ser >= 1' });
  }

  // Validar que currentPage no exceda totalPages
  if (currentPage > totalPages) {
    console.error('[server] ❌ ERROR: currentPage > totalPages:', { currentPage, totalPages });
    return res.status(400).json({ error: 'currentPage no puede exceder totalPages' });
  }

  db.run(
    `INSERT INTO reading_progress (userId, bookFile, currentPage, totalPages, progress, lastReadAt)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(userId, bookFile) DO UPDATE SET 
       currentPage = ?,
       totalPages = ?,
       progress = ?,
       lastReadAt = CURRENT_TIMESTAMP`,
    [userId, bookFile, currentPage, totalPages, progress, currentPage, totalPages, progress],
    (err) => {
      if (err) {
        console.error('[server] ❌ ERROR guardando progreso:', err);
        return res.status(500).json({ error: 'Error al guardar progreso' });
      }
      console.log('[server] ✅ Progreso guardado correctamente en BD');
      res.json({ message: 'Progreso guardado' });
    }
  );
});

// Obtener progreso de lectura de un libro
app.get('/api/reading-progress/:bookFile', requireAuth, (req, res) => {
  const bookFile = decodeURIComponent(req.params.bookFile);
  const userId = req.user.userId;
  
  console.log('[server] 📥 GET /api/reading-progress/:bookFile');
  console.log('[server]   userId:', userId);
  console.log('[server]   bookFile:', bookFile);
  
  // Validar bookFile
  if (!bookFile || bookFile.trim() === '') {
    console.error('[server] ❌ ERROR: bookFile vacío en GET /api/reading-progress/:bookFile');
    return res.status(400).json({ error: 'bookFile es requerido' });
  }
  
  db.get(
    'SELECT currentPage, totalPages, progress, lastReadAt FROM reading_progress WHERE userId = ? AND bookFile = ?',
    [userId, bookFile],
    (err, row) => {
      if (err) {
        console.error('[server] ❌ ERROR obteniendo progreso:', err);
        return res.status(500).json({ error: 'Error al obtener progreso' });
      }
      
      if (!row) {
        console.log('[server] ℹ️ Sin progreso previo para este libro');
        // Sin progreso es normal, retornar default sin error
        res.json({ currentPage: 1, totalPages: 0, progress: 0 });
        return;
      }
      
      console.log('[server] ✅ Progreso encontrado:');
      console.log('[server]   currentPage:', row.currentPage, '/', row.totalPages);
      console.log('[server]   progress:', row.progress?.toFixed(1) + '%' || '0%');
      console.log('[server]   lastReadAt:', row.lastReadAt);
      
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


// ============ ENDPOINTS DE EXPERIMENTOS V2 ============
// Nota: La versión v1 (GET/POST/PUT/DELETE /api/experiments) fue eliminada
// Usar endpoints /api/experiments-v2 en su lugar

// Iniciar experimento - Comunica con Flask para lanzar lector.py
app.post('/api/experiment-runs/start', requireVerified, async (req, res) => {
  const { experimentId } = req.body;
  
  try {
    // 1. Obtener experimento y su configuración
    db.get(
      'SELECT * FROM experiments WHERE id = ? AND user_id = ?',
      [experimentId, req.user.userId],
      async (err, experiment) => {
        if (err || !experiment) {
          return res.status(403).json({ error: 'Experimento no encontrado' });
        }
        
        if (experiment.deleted_at) {
          return res.status(400).json({ error: 'Experimento eliminado' });
        }
        
        try {
          // 2. Crear corrida en BD
          const config = typeof experiment.config === 'string' ? JSON.parse(experiment.config) : experiment.config || {};
          const numBlocks = config.num_blocks || 5;
          const sessionId = `session_${experimentId}_${Date.now()}`;
          
          db.run(
            `INSERT INTO experiment_runs (experiment_id, user_id, session_id, status, started_at)
             VALUES (?, ?, ?, 'in_progress', CURRENT_TIMESTAMP)`,
            [experimentId, req.user.userId, sessionId],
            async function(err) {
              if (err) {
                console.error('Error creando corrida:', err);
                return res.status(500).json({ error: 'Error al crear corrida' });
              }
              
              const runId = this.lastID;
              
              // 3. DESACTIVADO: Flask/Python por ahora (será activado después)
              // Retornar runId para que React lo use sin Python
              res.status(201).json({
                runId: runId,
                experimentId: experimentId,
                totalBlocks: numBlocks,
                config: config,
                pythonAvailable: false,
                pythonStatus: 'disabled'
              });
            }
          );
        } catch (parseErr) {
          res.status(400).json({ error: 'Configuración inválida' });
        }
      }
    );
  } catch (err) {
    console.error('Error en /api/experiment-runs/start:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Crear una nueva corrida de experimento
app.post('/api/experiment-runs', requireVerified, (req, res) => {
  const { experimentId, totalBlocks } = req.body;
  
  // Verificar que el experimento pertenece al usuario
  db.get(
    'SELECT id, name FROM experiments WHERE id = ? AND user_id = ?',
    [experimentId, req.user.userId],
    (err, experiment) => {
      if (err || !experiment) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      const sessionId = `session_${experimentId}_${Date.now()}`;
      
      db.run(
        `INSERT INTO experiment_runs (experiment_id, user_id, session_id, status, started_at)
         VALUES (?, ?, ?, 'in_progress', CURRENT_TIMESTAMP)`,
        [experimentId, req.user.userId, sessionId],
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
    'SELECT id FROM experiment_runs WHERE id = ? AND user_id = ?',
    [runId, req.user.userId],
    (err, run) => {
      if (err || !run) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO experiment_run_blocks 
         (run_id, block_id, block_number, book_id, page_number, started_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [runId, blockId, blockNumber, bookId, pageNumber, now],
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
     JOIN experiment_runs er ON erb.run_id = er.id
     WHERE erb.id = ? AND er.user_id = ?`,
    [runBlockId, req.user.userId],
    (err, runBlock) => {
      if (err || !runBlock) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      const now = new Date().toISOString();
      const startTime = new Date(runBlock.started_at);
      const duration = Math.floor((new Date(now) - startTime) / 1000);
      
      db.run(
        `UPDATE experiment_run_blocks 
         SET completed_at = ?
         WHERE id = ?`,
        [now, runBlockId],
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
    'SELECT * FROM experiment_runs WHERE id = ? AND user_id = ?',
    [runId, req.user.userId],
    (err, run) => {
      if (err || !run) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      
      const now = new Date().toISOString();
      const startTime = new Date(run.started_at);
      const duration = Math.floor((new Date(now) - startTime) / 1000);
      
      db.run(
        `UPDATE experiment_runs
         SET completed_at = ?, duration_seconds = ?, status = 'completed'
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
     SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
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

// Pausar experimento
app.put('/api/experiment-runs/:runId/pause', requireVerified, (req, res) => {
  const { runId } = req.params;
  
  console.log('[API] Pausa solicitada para runId:', runId);
  
  db.run(
    `UPDATE experiment_runs
     SET status = 'paused'
     WHERE id = ? AND user_id = ?`,
    [runId, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error pausando corrida:', err);
        return res.status(500).json({ error: 'Error al pausar corrida' });
      }
      res.json({ message: 'Corrida pausada', runId });
    }
  );
});

// Reanudar experimento
app.put('/api/experiment-runs/:runId/resume', requireVerified, (req, res) => {
  const { runId } = req.params;
  
  console.log('[API] Reanudación solicitada para runId:', runId);
  
  db.run(
    `UPDATE experiment_runs
     SET status = 'running'
     WHERE id = ? AND user_id = ?`,
    [runId, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error reanudando corrida:', err);
        return res.status(500).json({ error: 'Error al reanudar corrida' });
      }
      res.json({ message: 'Corrida reanudada', runId });
    }
  );
});

// Guardar datos capturados durante el experimento
app.post('/api/experiment-runs/data', requireVerified, (req, res) => {
  const { runId, runBlockId, dataType, data } = req.body;
  
  // Verificar autorización
  db.get(
    'SELECT id FROM experiment_runs WHERE id = ? AND user_id = ?',
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
     WHERE experiment_id = ? AND user_id = ?
     ORDER BY started_at DESC`,
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
     JOIN experiments e ON er.experiment_id = e.id
     WHERE er.id = ? AND er.user_id = ?`,
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

// ============ PROXY FLASK PARA EXPERIMENTOS ============
// Las rutas de experimentos se proxyean a Flask en puerto 5000
const FLASK_URL = 'http://localhost:5000';

// Helper para hacer requests a Flask
async function proxyToFlask(method, endpoint, body = null, authToken = null) {
  try {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${FLASK_URL}${endpoint}`, options);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Flask error ${response.status}: ${error}`);
    }

    return await response.json();
  } catch (error) {
    // Silenciar logs de proxy si Flask no está disponible (normal en desarrollo)
    throw error;
  }
}

// ============ RUTAS CRUD PARA EXPERIMENTOS (Nueva BD) ============

// GET - Listar experimentos del usuario (SOLO no eliminados - soft delete)
app.get('/api/experiments-v2/list', requireVerified, (req, res) => {
  try {
    db.all(
      `SELECT id, name, description, config, created_at as createdAt, updated_at as updatedAt
       FROM experiments
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [req.user.userId],
      (err, rows) => {
        if (err) {
          console.error('Error al listar experimentos:', err.message);
          return res.status(500).json({ error: 'Error al listar experimentos' });
        }
        
        // Parsear config JSON
        const experiments = rows.map(row => ({
          ...row,
          config: row.config ? JSON.parse(row.config) : {}
        }));
        
        res.json(experiments);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al listar experimentos' });
  }
});

// GET - Listar experimentos eliminados (papelera - soft delete)
app.get('/api/experiments-v2/trash', requireVerified, (req, res) => {
  try {
    db.all(
      `SELECT id, name, description, config, created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
       FROM experiments
       WHERE user_id = ? AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`,
      [req.user.userId],
      (err, rows) => {
        if (err) {
          console.error('Error al listar papelera:', err.message);
          return res.status(500).json({ error: 'Error al listar papelera' });
        }
        
        // Parsear config JSON
        const experiments = rows.map(row => ({
          ...row,
          config: row.config ? JSON.parse(row.config) : {}
        }));
        
        res.json(experiments);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al listar papelera' });
  }
});

// POST - Crear nuevo experimento
app.post('/api/experiments-v2/create', requireVerified, (req, res) => {
  const { name, description, config } = req.body;
  
  // Validar nombre
  if (!name || !name.trim()) {
    console.error('❌ ERROR: CREATE experiment sin nombre');
    return res.status(400).json({ error: 'El nombre del experimento es requerido' });
  }

  // Validar config
  if (!config) {
    console.error('❌ ERROR: CREATE experiment sin config. Config es requerida con num_blocks y minutes_per_block');
    return res.status(400).json({ error: 'Config con num_blocks y minutes_per_block es requerida' });
  }

  // Validar propiedades requeridas en config
  if (typeof config.num_blocks !== 'number' || config.num_blocks < 1) {
    console.error('❌ ERROR: CREATE experiment - config.num_blocks inválido:', config.num_blocks);
    return res.status(400).json({ error: 'config.num_blocks debe ser número >= 1' });
  }

  if (typeof config.minutes_per_block !== 'number' || config.minutes_per_block <= 0) {
    console.error('❌ ERROR: CREATE experiment - config.minutes_per_block inválido:', config.minutes_per_block);
    return res.status(400).json({ error: 'config.minutes_per_block debe ser número > 0' });
  }

  try {
    const configJSON = JSON.stringify(config);

    db.run(
      `INSERT INTO experiments (user_id, name, description, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [req.user.userId, name.trim(), description || '', configJSON],
      function(err) {
        if (err) {
          console.error('❌ ERROR INSERT experiment:', err);
          return res.status(500).json({ error: 'Error al crear experimento' });
        }

        db.get(
          'SELECT * FROM experiments WHERE id = ?',
          [this.lastID],
          (err, row) => {
            if (err) {
              console.error('❌ ERROR SELECT experimento creado:', err);
              return res.status(500).json({ error: 'Error al obtener experimento creado' });
            }
            res.json({
              ...row,
              config: JSON.parse(row.config)
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('❌ ERROR en POST /api/experiments-v2/create:', error);
    res.status(500).json({ error: 'Error al crear experimento' });
  }
});

// PUT - Actualizar experimento
app.put('/api/experiments-v2/:id', requireVerified, (req, res) => {
  const { id } = req.params;
  const { name, description, config } = req.body;

  // Validar que id existe
  if (!id) {
    console.error('❌ ERROR PUT experiment sin id');
    return res.status(400).json({ error: 'ID del experimento es requerido' });
  }

  // Validar config si se proporciona
  if (config !== undefined && !config) {
    console.error('❌ ERROR PUT experiment con config vacío');
    return res.status(400).json({ error: 'Config no puede ser vacío' });
  }

  try {
    // Si config no se proporciona, NO actualizar (dejar el existente)
    let configJSON = undefined;
    if (config !== undefined) {
      configJSON = JSON.stringify(config);
    }

    // Construir UPDATE dinámicamente basado en qué se proporciona
    let updateFields = [];
    let updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (configJSON !== undefined) {
      updateFields.push('config = ?');
      updateValues.push(configJSON);
    }

    if (updateFields.length === 0) {
      console.error('❌ ERROR PUT experiment sin campos para actualizar');
      return res.status(400).json({ error: 'Al menos un campo (name, description, config) es requerido' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);
    updateValues.push(req.user.userId);

    const updateSQL = `UPDATE experiments
       SET ${updateFields.join(', ')}
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`;

    db.run(updateSQL, updateValues, function(err) {
        if (err) {
          console.error('❌ ERROR UPDATE experiment:', err);
          return res.status(500).json({ error: 'Error al actualizar experimento' });
        }

        if (this.changes === 0) {
          console.error('❌ ERROR: Experimento no encontrado o ya eliminado:', id);
          return res.status(404).json({ error: 'Experimento no encontrado' });
        }

        db.get(
          'SELECT * FROM experiments WHERE id = ?',
          [id],
          (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Error al obtener experimento actualizado' });
            }
            res.json({
              ...row,
              config: JSON.parse(row.config)
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar experimento' });
  }
});

// DELETE - SOFT DELETE: marcar como eliminado (no borrar físicamente)
app.delete('/api/experiments-v2/:id', requireVerified, (req, res) => {
  const { id } = req.params;

  try {
    db.run(
      `UPDATE experiments
       SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [req.user.userId, id, req.user.userId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al eliminar experimento' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Experimento no encontrado o ya eliminado' });
        }

        // Verificar papelera: máximo 5 experimentos. Si hay más, borrar el más antiguo (FIFO)
        db.get(
          `SELECT COUNT(*) as count FROM experiments WHERE user_id = ? AND deleted_at IS NOT NULL`,
          [req.user.userId],
          (err, result) => {
            if (err || !result) {
              console.log('[PAPELERA] Error contando experimentos eliminados:', err);
              return res.json({ success: true, message: 'Experimento movido a papelera' });
            }

            console.log('[PAPELERA] Count actual:', result.count, 'para usuario:', req.user.userId);

            if (result.count >= 5) {
              // FIFO: si ya hay 5 o más, borrar el más antiguo ANTES de permitir más
              db.get(
                `SELECT id FROM experiments WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at ASC LIMIT 1`,
                [req.user.userId],
                (err, oldestExp) => {
                  if (err || !oldestExp) {
                    console.log('[PAPELERA] No se encontró experimento antiguo para borrar');
                    return res.json({ success: true, message: 'Experimento movido a papelera (Máximo alcanzado)' });
                  }

                  // Borrar completamente el más antiguo
                  console.log('[PAPELERA] Borrando experimento antiguo:', oldestExp.id);
                  db.run(
                    `DELETE FROM experiments WHERE id = ? AND user_id = ?`,
                    [oldestExp.id, req.user.userId],
                    (err) => {
                      if (err) {
                        console.error('[PAPELERA] Error eliminando experimento antiguo:', err);
                      } else {
                        console.log('[PAPELERA] Experimento antiguo eliminado exitosamente');
                      }
                      res.json({ success: true, message: 'Experimento movido a papelera (Se eliminó el más antiguo)' });
                    }
                  );
                }
              );
            } else {
              console.log('[PAPELERA] Espacio disponible en papelera, count:', result.count);
              res.json({ success: true, message: 'Experimento movido a papelera' });
            }
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar experimento' });
  }
});

// POST - Restaurar de papelera (soft delete reversal)
app.post('/api/experiments-v2/:id/restore', requireVerified, (req, res) => {
  const { id } = req.params;

  try {
    db.run(
      `UPDATE experiments
       SET deleted_at = NULL, deleted_by = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [id, req.user.userId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al restaurar experimento' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Experimento no encontrado en papelera' });
        }

        db.get(
          'SELECT * FROM experiments WHERE id = ?',
          [id],
          (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Error al obtener experimento restaurado' });
            }
            res.json({
              ...row,
              config: JSON.parse(row.config)
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al restaurar experimento' });
  }
});

// DELETE - ELIMINAR PERMANENTEMENTE (borrar de papelera completamente)
app.delete('/api/experiments-v2/:id/permanently-delete', requireVerified, (req, res) => {
  const { id } = req.params;

  try {
    // Verificar que solo se puede eliminar experimentos de este usuario Y que estén en papelera
    db.run(
      `DELETE FROM experiments
       WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [id, req.user.userId],
      function(err) {
        if (err) {
          console.error('Error eliminando permanentemente:', err);
          return res.status(500).json({ error: 'Error al eliminar permanentemente' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: 'Experimento no encontrado en papelera' });
        }

        console.log('[PAPELERA] Eliminado permanentemente:', id);
        res.json({ success: true, message: 'Experimento eliminado permanentemente de papelera' });
      }
    );
  } catch (error) {
    console.error('[PAPELERA] Error en permanently-delete:', error);
    res.status(500).json({ error: 'Error al eliminar permanentemente' });
  }
});

// GET - Obtener experimento por ID (excluir eliminados)
app.get('/api/experiments-v2/:id', requireVerified, (req, res) => {
  const { id } = req.params;

  try {
    db.get(
      `SELECT * FROM experiments
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, req.user.userId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Error al obtener experimento' });
        }

        if (!row) {
          return res.status(404).json({ error: 'Experimento no encontrado' });
        }

        res.json({
          ...row,
          config: JSON.parse(row.config)
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener experimento' });
  }
});

// BLOQUES: Se generan automáticamente desde config.num_blocks
// No se guardan en BD, se calculan en tiempo de ejecución

// ============ RUTAS DE EJECUCIONES (Runs) ============

// GET - Listar runs de un experimento
app.get('/api/experiments-v2/:experimentId/runs', requireVerified, (req, res) => {
  const { experimentId } = req.params;

  try {
    db.all(
      `SELECT er.* FROM experiment_runs er
       JOIN experiments e ON er.experiment_id = e.id
       WHERE er.experiment_id = ? AND e.user_id = ? AND e.deleted_at IS NULL
       ORDER BY er.started_at DESC`,
      [experimentId, req.user.userId],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Error al listar runs' });
        }
        res.json(rows || []);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al listar runs' });
  }
});

// GET - Obtener detalles de un run
app.get('/api/experiments-v2/runs/:runId', requireVerified, (req, res) => {
  const { runId } = req.params;

  try {
    db.get(
      `SELECT er.* FROM experiment_runs er
       JOIN experiments e ON er.experiment_id = e.id
       WHERE er.id = ? AND e.user_id = ?`,
      [runId, req.user.userId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Error al obtener run' });
        }

        if (!row) {
          return res.status(404).json({ error: 'Run no encontrado' });
        }

        // Obtener assets asociados
        db.all(
          'SELECT * FROM run_assets WHERE run_id = ?',
          [runId],
          (err, assets) => {
            if (err) {
              return res.status(500).json({ error: 'Error al obtener assets' });
            }

            res.json({
              ...row,
              assets: assets || []
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener run' });
  }
});

// ============ RUTAS DE EXPORTACIÓN ============

// GET - Exportar CSV de eventos
app.get('/api/experiments-v2/runs/:runId/export-csv', requireVerified, (req, res) => {
  const { runId } = req.params;

  try {
    // Obtener todos los eventos del run
    db.all(
      `SELECT * FROM run_events WHERE run_id = ? ORDER BY timestamp_ms ASC`,
      [runId],
      (err, events) => {
        if (err) {
          return res.status(500).json({ error: 'Error al obtener eventos' });
        }

        if (!events || events.length === 0) {
          return res.status(404).json({ error: 'No hay eventos para exportar' });
        }

        // Crear CSV
        let csv = 'timestamp_ms,block_number,event_type,data\n';
        events.forEach(event => {
          csv += `${event.timestamp_ms},${event.block_number},${event.event_type},"${(event.data || '').replace(/"/g, '""')}"\n`;
        });

        // Retornar como descarga
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="run_${runId}_events.csv"`);
        res.send(csv);
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error al exportar CSV' });
  }
});

// ============ RUTAS DE FLASK PROXY (para compatibilidad) ============

// GET - Obtener configuración del experimento actual
app.get('/api/experiment/config', requireVerified, async (req, res) => {
  try {
    const data = await proxyToFlask('GET', '/api/experiment/config', null, req.headers.authorization?.substring(7));
    res.json(data);
  } catch (error) {
    // Si Flask no está disponible, retornar config por defecto
    console.log('⚠️  Flask no disponible, usando configuración por defecto');
    res.json({
      config: {
        num_blocks: 5,
        minutes_per_block: 5.22,
        quotas: { V: 2, K: 2, A: 2, PST: 3, PFT: 6 },
        stim_blocks: [0, 2, 4]
      }
    });
  }
});

// POST - Establecer configuración del experimento
app.post('/api/experiment/config', requireVerified, async (req, res) => {
  try {
    const data = await proxyToFlask('POST', '/api/experiment/config', req.body, req.headers.authorization?.substring(7));
    res.json(data);
  } catch (error) {
    // Si Flask no está disponible, simplemente confirmar que se guardó
    console.log('⚠️  Flask no disponible, configuración guardada localmente');
    res.json({ success: true, message: 'Configuración guardada' });
  }
});

// POST - Iniciar experimento (lanza lector.py)
app.post('/api/experiment/start', requireVerified, async (req, res) => {
  try {
    const data = await proxyToFlask('POST', '/api/experiment/start', req.body, req.headers.authorization?.substring(7));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error iniciando experimento' });
  }
});

// POST - Detener experimento
app.post('/api/experiment/stop', requireVerified, async (req, res) => {
  try {
    const data = await proxyToFlask('POST', '/api/experiment/stop', null, req.headers.authorization?.substring(7));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error deteniendo experimento' });
  }
});

// GET - Obtener estado del experimento
app.get('/api/experiment/status', requireVerified, async (req, res) => {
  try {
    const data = await proxyToFlask('GET', '/api/experiment/status', null, req.headers.authorization?.substring(7));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo estado del experimento' });
  }
});

// GET - Listar sesiones de experimento
app.get('/api/experiment/sessions', requireVerified, async (req, res) => {
  try {
    const data = await proxyToFlask('GET', '/api/experiment/sessions', null, req.headers.authorization?.substring(7));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo sesiones de experimento' });
  }
});

// GET - Obtener datos de una sesión
app.get('/api/experiment/session/:name/data', requireVerified, async (req, res) => {
  try {
    const data = await proxyToFlask('GET', `/api/experiment/session/${req.params.name}/data`, null, req.headers.authorization?.substring(7));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo datos de sesión' });
  }
});

// GET - Health check de Flask
app.get('/api/experiment/health', async (req, res) => {
  try {
    const data = await proxyToFlask('GET', '/api/health');
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: 'Flask server no disponible', status: 'disconnected' });
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

// Variables de Gazepoint (para limpiar en shutdown)
let reconnectTimer = null;
let reconnectAttempts = 0;
let txtStream = null;
let gazepointStream = null;

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

// ============ ENDPOINT PARA SERVIR EPUBS CON CORS COMPLETO ============
app.get('/api/epub/:filename', (req, res) => {
  const { filename } = req.params;
  
  // Validar que sea un archivo válido (evitar path traversal)
  if (!filename.match(/^[a-zA-Z0-9\s\-_.()]+\.epub$/i)) {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }
  
  const filePath = path.join(librosPath, filename);
  
  // Verificar que el archivo existe y está dentro de la carpeta de libros
  if (!filePath.startsWith(librosPath)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }
  
  console.log('[server] Sirviendo EPUB:', filename);
  
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // Headers CORS y Content-Type
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.set('Content-Type', 'application/epub+zip');
    res.set('Content-Length', fileSize);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=3600');
    
    // Soportar Range requests para que epubjs pueda acceder parcialmente al ZIP
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      console.log(`[server] Range request: bytes=${start}-${end}/${fileSize}`);
      
      res.status(206);
      res.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.set('Content-Length', chunksize);
      
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // Sin Range: servir el archivo completo
      res.set('Content-Length', fileSize);
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (err) {
    console.error('[server] Error sirviendo EPUB:', err);
    res.status(500).json({ error: 'Error sirviendo el archivo', details: err.message });
  }
});

// ============ API: ARCHIVOS DE SESIÓN ============
app.get('/api/sesion-file/:sesion/:filename', (req, res) => {
  const { sesion, filename } = req.params;
  
  // Validar que sea un nombre válido (evitar path traversal)
  if (!sesion.match(/^S\d+$/) || !filename.match(/^S\d+_.*\.(mp4|wav|csv)$/i)) {
    return res.status(400).json({ error: 'Nombre de archivo inválido' });
  }
  
  const filePath = path.join(__dirname, 'src', 'Sesiones', sesion, filename);
  
  // Verificar que el archivo existe
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Archivo no encontrado: ${filePath}`);
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }
  
  // Determinar el tipo MIME
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  
  if (ext === '.mp4') contentType = 'video/mp4';
  else if (ext === '.wav') contentType = 'audio/wav';
  else if (ext === '.csv') contentType = 'text/csv';
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  
  // Para videos, soportar range requests
  if (ext === '.mp4') {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
        'Content-Type': contentType
      });
      
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': fileSize });
      fs.createReadStream(filePath).pipe(res);
    }
  } else {
    // Para otros archivos
    fs.createReadStream(filePath).pipe(res);
  }
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

// ============ ENDPOINTS DE DATOS PARA RESULTADOS ============

// GET gaze data - Datos de seguimiento ocular
// Segregación: Solo retorna si el usuario creó el experimento
app.get('/api/session/:runId/data/gaze', requireVerified, (req, res) => {
  const { runId } = req.params;
  const page = parseInt(req.query.page) || 0;
  const limit = parseInt(req.query.limit) || 100;
  const offset = page * limit;

  // Verificar que el usuario es propietario del experimento
  db.all(
    `SELECT gs.id, gs.run_id, gs.timestamp_ms, gs.x_px, gs.y_px, gs.confidence, gs.block_number, gs.page_number, gs.validity
     FROM gaze_samples gs
     JOIN experiment_runs er ON gs.run_id = er.id
     JOIN experiments e ON er.experiment_id = e.id
     WHERE gs.run_id = ? AND e.user_id = ?
     ORDER BY gs.timestamp_ms ASC 
     LIMIT ? OFFSET ?`,
    [runId, req.user.userId, limit, offset],
    (err, rows) => {
      if (err) {
        console.error('Error fetching gaze:', err);
        return res.status(500).json({ error: 'Error cargando datos' });
      }
      res.json({ data: rows, page, limit });
    }
  );
});

// GET events data - Mind wandering events
// Segregación: Solo retorna si el usuario creó el experimento
app.get('/api/session/:runId/data/events', requireVerified, (req, res) => {
  const { runId } = req.params;

  db.all(
    `SELECT mwe.id, mwe.run_id, mwe.block_number, mwe.event_type, 
            mwe.event_timestamp_ms as timestamp_ms, mwe.duration_ms, mwe.confidence,
            mwe.timestamp_end_ms, mwe.event_id, mwe.description
     FROM mind_wandering_events mwe
     JOIN experiment_runs er ON mwe.run_id = er.id
     JOIN experiments e ON er.experiment_id = e.id
     WHERE mwe.run_id = ? AND e.user_id = ?
     ORDER BY mwe.event_timestamp_ms ASC`,
    [runId, req.user.userId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching events:', err);
        return res.status(500).json({ error: 'Error cargando eventos' });
      }
      res.json({ data: rows });
    }
  );
});

// GET meta data (resumen)
app.get('/api/session/:runId/data/meta', requireVerified, (req, res) => {
  const { runId } = req.params;

  db.get(
    `SELECT 
       er.id, er.session_id, er.status, er.created_at,
       COUNT(DISTINCT gs.id) as gaze_count,
       COUNT(DISTINCT re.id) as event_count
     FROM experiment_runs er
     LEFT JOIN gaze_samples gs ON er.id = gs.run_id
     LEFT JOIN run_events re ON er.id = re.run_id
     WHERE er.id = ?
     GROUP BY er.id`,
    [runId],
    (err, row) => {
      if (err) {
        console.error('Error fetching meta:', err);
        return res.status(500).json({ error: 'Error cargando metadata' });
      }
      res.json(row || {});
    }
  );
});

// GET videos/assets
app.get('/api/session/:runId/videos', requireVerified, (req, res) => {
  const { runId } = req.params;
  const fs = require('fs');
  const path = require('path');

  db.all(
    `SELECT id, run_id, asset_type, asset_path, block_number 
     FROM run_assets 
     WHERE run_id = ? AND asset_type = 'video'
     ORDER BY block_number ASC`,
    [runId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching videos:', err);
        return res.status(500).json({ error: 'Error cargando videos' });
      }
      
      // Calcular tamaño de archivo para cada video
      const videosWithSize = rows.map(row => {
        try {
          const filePath = path.resolve(row.asset_path);
          const stats = fs.statSync(filePath);
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          return { ...row, size_mb: parseFloat(sizeMB) };
        } catch (err) {
          console.warn(`No se pudo obtener tamaño de ${row.asset_path}:`, err.message);
          return { ...row, size_mb: 0 };
        }
      });
      
      res.json({ videos: videosWithSize });
    }
  );
});

// GET - Descargar o servir video específico
app.get('/api/session/:runId/download-video', requireVerified, (req, res) => {
  const { runId } = req.params;
  const { block } = req.query;

  if (!block) {
    return res.status(400).json({ error: 'Bloque requerido' });
  }

  db.get(
    `SELECT asset_path FROM run_assets 
     WHERE run_id = ? AND block_number = ? AND asset_type = 'video'
     LIMIT 1`,
    [runId, parseInt(block)],
    (err, row) => {
      if (err) {
        console.error('Error fetching video:', err);
        return res.status(500).json({ error: 'Error cargando video' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Video no encontrado' });
      }

      const videoPath = path.join(__dirname, row.asset_path);

      // Verificar que el archivo existe
      if (!fs.existsSync(videoPath)) {
        console.error('Archivo de video no existe:', videoPath);
        return res.status(404).json({ error: 'Archivo de video no encontrado' });
      }

      // Servir el archivo con range support (para streaming)
      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
          'Access-Control-Allow-Origin': '*'
        });

        fs.createReadStream(videoPath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Access-Control-Allow-Origin': '*'
        });

        fs.createReadStream(videoPath).pipe(res);
      }
    }
  );
});

// GET - Stream video (alias para download-video)
app.get('/api/session/:runId/video-stream', requireVerified, (req, res) => {
  // Redirigir o usar la misma lógica que download-video
  const { runId } = req.params;
  const { block } = req.query;

  if (!block) {
    return res.status(400).json({ error: 'Bloque requerido' });
  }


// ===== Session control endpoints (pause/resume/abort) =====
// These endpoints are lightweight helpers used by the front-end keyboard handlers.
app.post('/api/session/:runId/pause', requireVerified, (req, res) => {
  const { runId } = req.params;
  // Intentar actualizar por user_id o userId (compatibilidad)
  db.run(
    `UPDATE experiment_runs SET status = 'paused' WHERE id = ? AND (user_id = ? OR userId = ?)`,
    [runId, req.user.userId, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error pausando corrida:', err);
        return res.status(500).json({ error: 'Error al pausar' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Corrida no encontrada o no autorizada' });
      res.json({ ok: true, message: 'paused' });
    }
  );
});

app.post('/api/session/:runId/resume', requireVerified, (req, res) => {
  const { runId } = req.params;
  db.run(
    `UPDATE experiment_runs SET status = 'in_progress' WHERE id = ? AND (user_id = ? OR userId = ?)`,
    [runId, req.user.userId, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error reanudando corrida:', err);
        return res.status(500).json({ error: 'Error al reanudar' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Corrida no encontrada o no autorizada' });
      res.json({ ok: true, message: 'resumed' });
    }
  );
});

app.post('/api/session/:runId/abort', requireVerified, (req, res) => {
  const { runId } = req.params;
  db.run(
    `UPDATE experiment_runs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND (user_id = ? OR userId = ?)`,
    [runId, req.user.userId, req.user.userId],
    function(err) {
      if (err) {
        console.error('Error abortando corrida:', err);
        return res.status(500).json({ error: 'Error al abortar' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Corrida no encontrada o no autorizada' });
      res.json({ ok: true, message: 'aborted' });
    }
  );
});
  db.get(
    `SELECT asset_path FROM run_assets 
     WHERE run_id = ? AND block_number = ? AND asset_type = 'video'
     LIMIT 1`,
    [runId, parseInt(block)],
    (err, row) => {
      if (err) {
        console.error('Error fetching video stream:', err);
        return res.status(500).json({ error: 'Error cargando video' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Video no encontrado' });
      }

      const videoPath = path.join(__dirname, row.asset_path);

      // Verificar que el archivo existe
      if (!fs.existsSync(videoPath)) {
        console.error('Archivo de video no existe:', videoPath);
        return res.status(404).json({ error: 'Archivo de video no encontrado' });
      }

      // Servir el archivo con range support
      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4'
        });

        fs.createReadStream(videoPath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4'
        });

        fs.createReadStream(videoPath).pipe(res);
      }
    }
  );
});

// ============ RUTA CATCH-ALL (SPA) ============
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'build', 'index.html');
  
  // Verificar que el archivo existe antes de intentar enviarlo
  if (!fs.existsSync(indexPath)) {
    console.warn('[server] ⚠️ ADVERTENCIA: build/index.html no encontrado en:', indexPath);
    return res.status(500).json({ 
      error: 'Aplicación no compilada correctamente',
      message: 'Por favor ejecuta: npm run build'
    });
  }
  
  res.sendFile(indexPath);
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
  if (typeof wss !== 'undefined' && wss) {
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
  if (typeof gazepointClient !== 'undefined' && gazepointClient) {
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
  }, 100); // Reducido a 100ms
  
  // Terminación forzada rápida
  setTimeout(() => {
    console.log('⚠️  Terminación forzada activada');
    process.exit(1);
  }, 500); // Reducido a 500ms
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

const sgMail = require('@sendgrid/mail');
const config = require('../config');
const crypto = require('crypto');

/**
 * Servicio de email para verificación de cuentas con SendGrid
 */

// Inicializar SendGrid
if (config.EMAIL.SERVICE === 'sendgrid' && config.EMAIL.SENDGRID_API_KEY) {
  sgMail.setApiKey(config.EMAIL.SENDGRID_API_KEY);
}

/**
 * Generar token de verificación
 * @returns {string} Token hexadecimal
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calcular fecha de expiración del token
 * @returns {Date} Fecha de expiración
 */
function getTokenExpirationDate() {
  const date = new Date();
  date.setHours(date.getHours() + config.EMAIL.TOKEN_EXPIRATION_HOURS);
  return date;
}

/**
 * Enviar email de verificación con SendGrid
 * @param {string} email - Correo del usuario
 * @param {string} username - Nombre de usuario
 * @param {string} token - Token de verificación
 * @returns {Promise<{success: boolean, token: string, expiresAt: Date}>}
 */
async function sendVerificationEmail(email, username, token) {
  try {
    console.log('📧 Intentando enviar email de verificación con SendGrid...');
    console.log('📧 A:', email);
    
    const verificationUrl = `${config.EMAIL.VERIFICATION_URL}/verify-email?token=${token}`;
    
    const msg = {
      to: email,
      from: config.EMAIL.FROM,
      subject: 'Verifica tu correo - Biblioteca Digital',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">¡Bienvenido a la Biblioteca Digital!</h2>
          <p>Hola <strong>${username}</strong>,</p>
          <p>Gracias por crear una cuenta. Para completar tu registro, por favor verifica tu correo electrónico haciendo clic en el siguiente enlace:</p>
          
          <div style="margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verificar Correo
            </a>
          </div>
          
          <p>O copia y pega esta URL en tu navegador:</p>
          <p style="word-break: break-all; color: #666; font-size: 12px;">${verificationUrl}</p>
          
          <p style="color: #999; font-size: 12px;">Este enlace expirará en ${config.EMAIL.TOKEN_EXPIRATION_HOURS} horas.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">Si no creaste esta cuenta, por favor ignora este correo.</p>
        </div>
      `
    };
    
    const response = await sgMail.send(msg);
    console.log('✅ Email de verificación enviado:', response[0].statusCode);
    
    return {
      success: true,
      token: token,
      expiresAt: getTokenExpirationDate()
    };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    if (error.response) {
      console.error('❌ Respuesta de SendGrid:', error.response.body);
    }
    throw new Error('No se pudo enviar el email de verificación');
  }
}

/**
 * Enviar email de recuperación de contraseña
 * @param {string} email - Correo del usuario
 * @param {string} username - Nombre de usuario
 * @param {string} token - Token de recuperación
 * @returns {Promise<{success: boolean, token: string, expiresAt: Date}>}
 */
async function sendPasswordResetEmail(email, username, token) {
  try {
    console.log('📧 Intentando enviar email de recuperación de contraseña con SendGrid...');
    console.log('📧 A:', email);
    
    const resetUrl = `${config.EMAIL.VERIFICATION_URL}/recuperar-contrasena?token=${token}`;
    
    const msg = {
      to: email,
      from: config.EMAIL.FROM,
      subject: 'Recuperar tu contraseña - Biblioteca Digital',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Recuperar Contraseña</h2>
          <p>Hola <strong>${username}</strong>,</p>
          <p>Recibimos una solicitud para recuperar tu contraseña. Si no fuiste tú, por favor ignora este correo.</p>
          
          <p>Para establecer una nueva contraseña, haz clic en el siguiente enlace:</p>
          
          <div style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Recuperar Contraseña
            </a>
          </div>
          
          <p>O copia y pega esta URL en tu navegador:</p>
          <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>
          
          <p style="color: #999; font-size: 12px;">Este enlace expirará en ${config.EMAIL.TOKEN_EXPIRATION_HOURS} horas.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">Si no solicitaste recuperar tu contraseña, por favor ignora este correo y tu contraseña permanecerá segura.</p>
        </div>
      `
    };
    
    const response = await sgMail.send(msg);
    console.log('✅ Email de recuperación enviado:', response[0].statusCode);
    
    return {
      success: true,
      token: token,
      expiresAt: getTokenExpirationDate()
    };
  } catch (error) {
    console.error('❌ Error enviando email de recuperación:', error);
    if (error.response) {
      console.error('❌ Respuesta de SendGrid:', error.response.body);
    }
    throw new Error('No se pudo enviar el email de recuperación');
  }
}

/**
 * Validar que el email es institucional
 * @param {string} email - Correo a validar
 * @returns {boolean} True si es válido
 */
function isInstitutionalEmail(email) {
  const lowerEmail = email.toLowerCase();
  return config.INSTITUTIONAL_EMAILS.domains.some(domain => 
    lowerEmail.endsWith(domain)
  );
}

/**
 * Validar formato de email
 * @param {string} email - Correo a validar
 * @returns {boolean} True si el formato es válido
 */
function isValidEmailFormat(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  generateVerificationToken,
  getTokenExpirationDate,
  sendVerificationEmail,
  sendPasswordResetEmail,
  isInstitutionalEmail,
  isValidEmailFormat
};

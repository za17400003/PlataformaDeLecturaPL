const nodemailer = require('nodemailer');
const config = require('../config');
const crypto = require('crypto');

/**
 * Servicio de email para verificación de cuentas
 */

let transporter;

// Inicializar transporter
function initializeTransporter() {
  if (transporter) return transporter;

  // Configurar según el servicio de email
  if (config.EMAIL.SERVICE === 'gmail') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.EMAIL.USER,
        pass: config.EMAIL.PASSWORD
      }
    });
  } else {
    // Para otros servicios SMTP (como Ethereal)
    transporter = nodemailer.createTransport({
      host: config.EMAIL.HOST,
      port: config.EMAIL.PORT,
      secure: config.EMAIL.SECURE,
      auth: {
        user: config.EMAIL.USER,
        pass: config.EMAIL.PASSWORD
      }
    });
  }

  return transporter;
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
 * Enviar email de verificación
 * @param {string} email - Correo del usuario
 * @param {string} username - Nombre de usuario
 * @param {string} token - Token de verificación
 * @returns {Promise<{success: boolean, token: string, expiresAt: Date}>}
 */
async function sendVerificationEmail(email, username, token) {
  try {
    console.log('📧 Intentando enviar email de verificación...');
    console.log('📧 Config EMAIL.USER:', config.EMAIL.USER);
    console.log('📧 Config EMAIL.SERVICE:', config.EMAIL.SERVICE);
    console.log('📧 A:', email);
    
    const transporter = initializeTransporter();
    
    const verificationUrl = `${config.EMAIL.VERIFICATION_URL}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: config.EMAIL.FROM,
      to: email,
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
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email de verificación enviado:', info.response);
    
    return {
      success: true,
      token: token,
      expiresAt: getTokenExpirationDate()
    };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw new Error('No se pudo enviar el email de verificación');
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
  isInstitutionalEmail,
  isValidEmailFormat
};

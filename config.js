/**
 * Configuración centralizada para la aplicación PL
 * Variables de entorno y valores por defecto
 */

module.exports = {
  // Puerto del servidor
  PORT: process.env.PORT || 3000,

  // JWT Secret (cambiar en producción!)
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',

  // Credenciales por defecto para desarrollo (NO USAR EN PRODUCCIÓN)
  DEFAULT_ADMIN: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || '123'
  },

  // Configuración de reintentos para guardado de progreso
  PROGRESS_SAVE: {
    MAX_RETRIES: 2,
    BASE_DELAY_MS: 500,
    DEBOUNCE_MS: 2000
  },

  // Configuración de base de datos
  DATABASE: {
    PATH: process.env.DB_PATH || './db/library.db',
    TIMEOUT: 5000
  },

  // Configuración de rate limiting (futura)
  RATE_LIMIT: {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
    MAX_REQUESTS: 100 // máximo 100 requests por ventana
  },

  // Configuración de CORS
  CORS: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },

  // Rutas estáticas
  STATIC_DIRS: {
    BOOKS: './build/libros',
    PUBLIC: './build',
    ASSETS: './public'
  },

  // Validación de inputs
  VALIDATION: {
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 50,
    PASSWORD_MIN_LENGTH: 3,
    PASSWORD_MAX_LENGTH: 100
  },

  // Configuración de email para verificación
  EMAIL: {
    // Servicio a usar: 'sendgrid', 'gmail', o 'smtp'
    SERVICE: process.env.EMAIL_SERVICE || 'sendgrid',
    // SendGrid API Key
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
    // Email (para Gmail o SMTP)
    USER: process.env.EMAIL_USER || 'tu-email@gmail.com',
    PASSWORD: process.env.EMAIL_PASSWORD || 'tu-contraseña-app',
    FROM: process.env.EMAIL_FROM || 'noreply@bibliotecadigital.com',
    // Configuración SMTP para servidores como Ethereal
    HOST: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    PORT: parseInt(process.env.EMAIL_PORT || '587'),
    SECURE: process.env.EMAIL_SECURE === 'true' || false,
    // URL base para los links de verificación
    VERIFICATION_URL: process.env.VERIFICATION_URL || 'http://localhost:3000',
    // Tiempo de expiración del token de verificación en horas
    TOKEN_EXPIRATION_HOURS: 24
  },

  // Correos institucionales permitidos
  INSTITUTIONAL_EMAILS: {
    domains: ['@zapopan.tecmm.edu.mx', '@cicese.mx']
  }
};

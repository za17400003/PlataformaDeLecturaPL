/**
 * Constantes y configuración del cliente (App.js)
 */

export const API_CONFIG = {
  BASE_URL: 'http://localhost:3000',
  ENDPOINTS: {
    LOGIN: '/api/login',
    LOGOUT: '/api/logout',
    USER: '/api/user',
    READING_PROGRESS: '/api/reading-progress',
    USER_PREFERENCES: '/api/user-preferences'
  },
  
  // Credenciales por defecto para desarrollo
  // SOLO PARA DESARROLLO - cambiar en producción
  DEFAULT_CREDENTIALS: {
    username: 'admin',
    password: '123'
  },

  // Timeouts
  REQUEST_TIMEOUT_MS: 5000,
  SESSION_CHECK_INTERVAL_MS: 60000,

  // Mensajes de error
  ERROR_MESSAGES: {
    INVALID_CREDENTIALS: 'Usuario o contraseña incorrectos',
    SESSION_EXPIRED: 'Sesión expirada. Por favor, inicia sesión de nuevo.',
    SERVER_ERROR: 'Error del servidor. Por favor, intenta más tarde.',
    NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet.'
  }
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData',
  PREFERENCES: 'userPreferences'
};

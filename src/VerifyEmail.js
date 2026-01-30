import React, { useState, useEffect } from 'react';
import './VerifyEmail.css';

function VerifyEmail() {
  const [estado, setEstado] = useState('verificando'); // 'verificando', 'exito', 'error'
  const [mensaje, setMensaje] = useState('');
  const [usuario, setUsuario] = useState('');
  const [contador, setContador] = useState(5);

  useEffect(() => {
    // Obtener token de la URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setEstado('error');
      setMensaje('Token de verificación no encontrado');
      return;
    }

    // Llamar al endpoint de verificación
    verificarEmail(token);
  }, []);

  const verificarEmail = async (token) => {
    try {
      const response = await fetch(`http://localhost:3000/api/verify-email?token=${token}`);
      const data = await response.json();

      if (response.ok) {
        setEstado('exito');
        setMensaje(data.message);
        setUsuario(data.username);
        
        // Guardar token de autenticación en localStorage para login automático
        if (data.authToken) {
          localStorage.setItem('authToken', data.authToken);
          localStorage.setItem('usuario', data.username);
          
          // Iniciar contador de 5 segundos
          let tiempoRestante = 5;
          setContador(5);
          
          const intervalo = setInterval(() => {
            tiempoRestante--;
            setContador(tiempoRestante);
            
            if (tiempoRestante <= 0) {
              clearInterval(intervalo);
              window.location.href = '/';
            }
          }, 1000);
        }
      } else {
        setEstado('error');
        setMensaje(data.error || 'Error al verificar el correo');
      }
    } catch (error) {
      console.error('Error verificando email:', error);
      setEstado('error');
      setMensaje('Error de conexión. Intenta de nuevo.');
    }
  };

  return (
    <div className="VerifyEmail-container">
      <div className="VerifyEmail-content">
        {estado === 'verificando' && (
          <div className="verify-state verificando">
            <div className="spinner"></div>
            <h1>Verificando tu correo...</h1>
            <p>Por favor espera mientras verificamos tu cuenta.</p>
          </div>
        )}

        {estado === 'exito' && (
          <div className="verify-state exito">
            <div className="success-icon">✓</div>
            <h1>¡Correo Verificado!</h1>
            <p>{mensaje}</p>
            <div className="user-info">
              <p>Usuario: <strong>{usuario}</strong></p>
            </div>
            <div className="next-steps">
              <p>Redirigiendo en <strong>{contador}</strong> segundos...</p>
              <a href="/" className="btn-ir-inicio" style={{ pointerEvents: 'none', opacity: 0.6 }}>Ir al inicio</a>
            </div>
          </div>
        )}

        {estado === 'error' && (
          <div className="verify-state error">
            <div className="error-icon">✕</div>
            <h1>Error en la Verificación</h1>
            <p>{mensaje}</p>
            <div className="next-steps">
              <p>Por favor, intenta nuevamente o contacta al administrador.</p>
              <a href="/" className="btn-ir-inicio">Volver al inicio</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;

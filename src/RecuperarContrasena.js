import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './RecuperarContrasena.css';
import './VerifyEmail.css'; // Reutilizar estilos

function RecuperarContrasena() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState('solicitar'); // 'solicitar', 'verificando', 'reset', 'exito', 'error'
  const [email, setEmail] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const [contador, setContador] = useState(5);

  // ============================================================
  // PASO 1: Solicitar token de recuperación
  // ============================================================
  const handleSolicitar = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setMensaje('Por favor ingresa tu correo');
      return;
    }

    setLoading(true);
    setMensaje('');

    try {
      const response = await fetch('http://localhost:3000/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setPaso('exito');
        setMensaje('✅ Hemos enviado un link de recuperación a tu correo. Revisa tu bandeja.');
        
        // Reiniciar contador
        let tiempoRestante = 10;
        setContador(10);
        
        const intervalo = setInterval(() => {
          tiempoRestante--;
          setContador(tiempoRestante);
          
          if (tiempoRestante <= 0) {
            clearInterval(intervalo);
            setPaso('solicitar');
            setEmail('');
          }
        }, 1000);
      } else {
        setPaso('error');
        setMensaje(data.message || 'Error al solicitar recuperación');
      }
    } catch (err) {
      setPaso('error');
      setMensaje('Error de conexión: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // PASO 2: Verificar token y resetear contraseña
  // ============================================================
  useEffect(() => {
    // Si llegamos aquí con token en URL, cambiar a paso 'reset'
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');

    if (token) {
      setPaso('verificando');
      verificarToken(token);
    }
  }, []);

  const verificarToken = async (token) => {
    try {
      const response = await fetch(`http://localhost:3000/api/verify-reset-token?token=${token}`);
      const data = await response.json();

      if (response.ok) {
        setPaso('reset');
        setMensaje(''); // Limpiar mensaje anterior
        // Guardar token para usar en el reset
        sessionStorage.setItem('resetToken', token);
      } else {
        setPaso('error');
        setMensaje(data.message || 'Token inválido o expirado');
      }
    } catch (err) {
      setPaso('error');
      setMensaje('Error al verificar token: ' + err.message);
    }
  };

  // ============================================================
  // PASO 3: Formulario de nueva contraseña
  // ============================================================
  const handleResetPassword = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const nuevaContrasena = formData.get('nuevaContrasena');
    const confirmar = formData.get('confirmar');
    const token = sessionStorage.getItem('resetToken');

    // Validaciones
    if (!nuevaContrasena || !confirmar) {
      setMensaje('Por favor completa todos los campos');
      return;
    }

    if (nuevaContrasena.length < 8) {
      setMensaje('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (nuevaContrasena !== confirmar) {
      setMensaje('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    setMensaje('');

    try {
      const response = await fetch('http://localhost:3000/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          nuevaContrasena
        })
      });

      const data = await response.json();

      if (response.ok) {
        setPaso('exito');
        setMensaje('✅ Contraseña actualizada correctamente. Redirigiendo al login...');
        sessionStorage.removeItem('resetToken');
        
        // Redirigir después de 3 segundos
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setMensaje(data.message || 'Error al resetear contraseña');
      }
    } catch (err) {
      setMensaje('Error de conexión: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDERIZADO
  // ============================================================
  
  const goToLogin = () => {
    navigate('/');
  };

  return (
    <div className="verify-container">
      <button onClick={goToLogin} className="back-button">← Volver</button>
      
      {paso === 'solicitar' && (
        <div className="verify-card">
          <h2>🔐 Recuperar Contraseña</h2>
          <form onSubmit={handleSolicitar}>
            <input
              type="email"
              placeholder="Ingresa tu correo registrado"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Link de Recuperación'}
            </button>
          </form>
          {mensaje && <p className="error-message">{mensaje}</p>}
        </div>
      )}

      {paso === 'verificando' && (
        <div className="verify-card">
          <h2>⏳ Verificando...</h2>
          <p>Validando tu token de recuperación...</p>
        </div>
      )}

      {paso === 'reset' && (
        <div className="verify-card">
          <h2>🔑 Nueva Contraseña</h2>
          <form onSubmit={handleResetPassword}>
            <input
              type="password"
              name="nuevaContrasena"
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              disabled={loading}
              required
            />
            <input
              type="password"
              name="confirmar"
              placeholder="Confirmar contraseña"
              disabled={loading}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </form>
          {mensaje && <p className="error-message">{mensaje}</p>}
        </div>
      )}

      {paso === 'exito' && (
        <div className="verify-card success">
          <h2>✅ ¡Listo!</h2>
          <p>{mensaje}</p>
          {paso === 'exito' && contador > 0 && (
            <p className="countdown">Redirigiendo en {contador} segundos...</p>
          )}
        </div>
      )}

      {paso === 'error' && (
        <div className="verify-card error">
          <h2>❌ Error</h2>
          <p>{mensaje}</p>
          <button onClick={() => {
            setPaso('solicitar');
            setEmail('');
            setMensaje('');
          }} className="secondary-button">
            ← Intentar de Nuevo
          </button>
        </div>
      )}
    </div>
  );
}

export default RecuperarContrasena;

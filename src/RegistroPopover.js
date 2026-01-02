import React, { useState } from 'react';
import './RegistroPopover.css';

function RegistroPopover({ onClose, onRegistroExitoso }) {
  const [usuarioRegistro, setUsuarioRegistro] = useState('');
  const [emailRegistro, setEmailRegistro] = useState('');
  const [contrasenaRegistro, setContrasenaRegistro] = useState('');
  const [contrasenaConfirm, setContrasenaConfirm] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [etapa, setEtapa] = useState('form'); // 'form' o 'verificacion'

  // Validar formato de email
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validar que sea correo institucional
  const isInstitutionalEmail = (email) => {
    const lowerEmail = email.toLowerCase();
    return lowerEmail.endsWith('@zapopan.tecmm.edu.mx') || lowerEmail.endsWith('@cicese.mx');
  };

  const handleRegistro = async () => {
    // Validaciones
    if (!usuarioRegistro.trim()) {
      setError('Por favor, ingresa un nombre de usuario');
      return;
    }
    
    if (usuarioRegistro.length < 3) {
      setError('El usuario debe tener al menos 3 caracteres');
      return;
    }

    if (!emailRegistro.trim()) {
      setError('Por favor, ingresa tu correo electrónico');
      return;
    }

    if (!isValidEmail(emailRegistro)) {
      setError('Por favor, ingresa un correo válido');
      return;
    }

    if (!isInstitutionalEmail(emailRegistro)) {
      setError('Solo se permiten correos institucionales:\n@zapopan.tecmm.edu.mx\n@cicese.mx');
      return;
    }

    if (!contrasenaRegistro) {
      setError('Por favor, ingresa una contraseña');
      return;
    }

    if (contrasenaRegistro.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    if (contrasenaRegistro !== contrasenaConfirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setCargando(true);
    setError('');
    setExito('');

    try {
      const response = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: usuarioRegistro,
          email: emailRegistro,
          password: contrasenaRegistro
        })
      });

      const data = await response.json();

      if (response.ok) {
        setExito('¡Cuenta creada! Se ha enviado un correo de verificación a ' + emailRegistro);
        setEtapa('verificacion');
        setTimeout(() => {
          setEtapa('verificacion');
        }, 1500);
      } else if (data.userExists && data.requiresVerification) {
        // Usuario existe pero no está verificado
        setError('');
        setEtapa('usuario-existe');
      } else {
        setError(data.error || 'Error al crear la cuenta');
      }
    } catch (error) {
      console.error('Error en registro:', error);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && etapa === 'form') {
      handleRegistro();
    }
  };

  const handleReenviarVerificacion = async () => {
    setCargando(true);
    setError('');
    setExito('');
    
    try {
      const response = await fetch('http://localhost:3000/api/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: usuarioRegistro,
          email: emailRegistro
        })
      });
      
      const data = await response.json();
      
      if (response.ok || response.status === 201) {
        // Cambiar a pantalla de verificación
        setEtapa('verificacion');
        setExito('Correo de verificación reenviado a ' + emailRegistro);
        setCargando(false);
      } else {
        setError(data.error || 'Error al reenviar correo');
        setCargando(false);
      }
    } catch (error) {
      console.error('Error reenviando:', error);
      setError('Error de conexión. Intenta de nuevo.');
      setCargando(false);
    }
  };

  // Pantalla: Usuario existe pero no verificado
  if (etapa === 'usuario-existe') {
    return (
      <div className="RegistroPopover-overlay" onClick={onClose}>
        <div className="RegistroPopover-content" onClick={(e) => e.stopPropagation()}>
          <button className="RegistroPopover-close" onClick={onClose}>✕</button>
          
          <h2 className="RegistroPopover-title">Cuenta ya existe</h2>
          
          <div className="RegistroPopover-verification">
            <div className="verification-icon" style={{ fontSize: '2rem' }}>⚠️</div>
            <p className="verification-message">
              Esta cuenta ya fue creada pero aún no ha sido verificada.
            </p>
            <p className="verification-email">{emailRegistro}</p>
            
            <div className="verification-note">
              <p>¿Deseas que te reenviemos el correo de verificación?</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                className="RegistroPopover-btn-crear"
                onClick={handleReenviarVerificacion}
                disabled={cargando}
                style={{ backgroundColor: '#4CAF50' }}
              >
                {cargando ? <div className="loader-registro" /> : 'Sí, reenviar'}
              </button>
              <button
                className="RegistroPopover-btn-crear"
                onClick={() => setEtapa('form')}
                disabled={cargando}
                style={{ backgroundColor: '#999' }}
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (etapa === 'verificacion') {
    return (
      <div className="RegistroPopover-overlay" onClick={onClose}>
        <div className="RegistroPopover-content" onClick={(e) => e.stopPropagation()}>
          <button className="RegistroPopover-close" onClick={onClose}>✕</button>
          
          <h2 className="RegistroPopover-title">Verifica tu Correo</h2>
          
          <div className="RegistroPopover-verification">
            <div className="verification-icon">✓</div>
            <p className="verification-message">
              Se ha enviado un correo de verificación a:
            </p>
            <p className="verification-email">{emailRegistro}</p>
            
            <div className="verification-instructions">
              <h3>¿Qué hacer ahora?</h3>
              <ol>
                <li>Revisa tu correo electrónico</li>
                <li>Busca el mensaje de "Biblioteca Digital"</li>
                <li>Haz clic en el enlace de verificación</li>
                <li>¡Listo! Ya podrás iniciar sesión</li>
              </ol>
            </div>

            <div className="verification-note">
              <p>💡 <strong>Nota:</strong> El correo puede tardar algunos minutos en llegar. Revisa tu carpeta de spam si no lo ves.</p>
            </div>

            <button
              className="RegistroPopover-btn-crear"
              onClick={onClose}
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="RegistroPopover-overlay" onClick={onClose}>
      <div className="RegistroPopover-content" onClick={(e) => e.stopPropagation()}>
        <button className="RegistroPopover-close" onClick={onClose}>✕</button>
        
        <h2 className="RegistroPopover-title">Crear Cuenta</h2>
        
        <div className="RegistroPopover-form">
          <input
            type="text"
            placeholder="Nombre de usuario"
            className="RegistroPopover-input"
            value={usuarioRegistro}
            onChange={(e) => setUsuarioRegistro(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={cargando}
          />

          <input
            type="email"
            placeholder="Correo institucional"
            className="RegistroPopover-input"
            value={emailRegistro}
            onChange={(e) => setEmailRegistro(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={cargando}
          />
          
          <input
            type="password"
            placeholder="Contraseña"
            className="RegistroPopover-input"
            value={contrasenaRegistro}
            onChange={(e) => setContrasenaRegistro(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={cargando}
          />
          
          <input
            type="password"
            placeholder="Confirmar contraseña"
            className="RegistroPopover-input"
            value={contrasenaConfirm}
            onChange={(e) => setContrasenaConfirm(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={cargando}
          />

          {error && <div className="RegistroPopover-error">{error}</div>}
          {exito && <div className="RegistroPopover-exito">{exito}</div>}

          <button
            className="RegistroPopover-btn-crear"
            onClick={handleRegistro}
            disabled={cargando}
          >
            {cargando ? <div className="loader-registro" /> : 'Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RegistroPopover;

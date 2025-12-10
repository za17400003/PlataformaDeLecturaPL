import React, { useState } from 'react';
import './RegistroPopover.css';

function RegistroPopover({ onClose, onRegistroExitoso }) {
  const [usuarioRegistro, setUsuarioRegistro] = useState('');
  const [contrasenaRegistro, setContrasenaRegistro] = useState('');
  const [contrasenaConfirm, setContrasenaConfirm] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

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
          password: contrasenaRegistro
        })
      });

      const data = await response.json();

      if (response.ok) {
        setExito('¡Cuenta creada exitosamente! Inicia sesión ahora.');
        setTimeout(() => {
          onRegistroExitoso && onRegistroExitoso(usuarioRegistro);
          onClose();
        }, 1500);
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
    if (e.key === 'Enter') {
      handleRegistro();
    }
  };

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

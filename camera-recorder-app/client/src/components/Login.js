import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import useCameraPermission from '../hooks/useCameraPermission';

export default function Login({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const history = useHistory();
  const { requestCameraPermission } = useCameraPermission();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // credenciales esperadas: usuario "123" y contraseña "123"
    if (user === '123' && pass === '123') {
      try {
        // pedir permiso de cámara antes de proceder
        const permissionGranted = await requestCameraPermission();
        if (!permissionGranted) {
          setError('Se requiere permiso de cámara para continuar.');
          return;
        }
        // avisar al padre que inició sesión correctamente
        onLogin && onLogin();
        // redirigir a la "biblioteca"
        try { history.push('/library'); } catch (err) { /* ignore if no router */ }
      } catch (err) {
        console.error('Error al solicitar permiso de cámara', err);
        setError('Error al solicitar permiso de cámara.');
      }
    } else {
      setError('Usuario o contraseña incorrectos.');
    }
  };

  return (
    <div className="Login">
      <h2>Iniciar sesión</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Usuario
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="Login-error">{error}</div>}
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
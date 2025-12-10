import React, { useState, useEffect } from 'react';
import './App.css';

import solAnimado from './assets/sol.png';
import pajaritos from './assets/pajaros.png';
import Biblioteca from './biblioteca';
import RegistroPopover from './RegistroPopover';

function App() {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [mensajeBoton, setMensajeBoton] = useState('Iniciar sesión');
  const [loginExitoso, setLoginExitoso] = useState(false);
  const [animarSalida, setAnimarSalida] = useState(false);
  const [animarEntrada, setAnimarEntrada] = useState(false);
  const [userData, setUserData] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mostrarRegistro, setMostrarRegistro] = useState(false);

  // Verificar si hay una sesión activa al cargar
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Verificar que la sesión sea válida
      fetch('http://localhost:3000/api/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.id) {
            setUserData(data);
            setLoginExitoso(true);
            setCheckingSession(false);
          } else {
            localStorage.removeItem('authToken');
            setCheckingSession(false);
          }
        })
        .catch(() => {
          localStorage.removeItem('authToken');
          setCheckingSession(false);
        });
    } else {
      // Si no hay token, mostrar pantalla de login
      setCheckingSession(false);
    }
  }, []);

  const iniciarSesion = async () => {
    setCargando(true);
    setError(false);
    setMensajeBoton('');

    try {
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: usuario, password: contrasena })
      });

      const data = await response.json();
      
      setCargando(false);
      
      if (response.ok && data.token) {
        // Guardar token y datos de usuario
        localStorage.setItem('authToken', data.token);
        setUserData(data.user);
        
        setAnimarSalida(true);
        setTimeout(() => {
          setLoginExitoso(true);
        }, 1500); // espera a que termine la animación
      } else {
        setError(true);
        setMensajeBoton(data.error || 'usuario/contraseña no válido');
        setTimeout(() => {
          setError(false);
          setMensajeBoton('Iniciar sesión');
        }, 2000);
      }
    } catch (error) {
      console.error('Error en login:', error);
      setCargando(false);
      setError(true);
      setMensajeBoton('Error de conexión');
      setTimeout(() => {
        setError(false);
        setMensajeBoton('Iniciar sesión');
      }, 2000);
    }
  };

  if (checkingSession) {
    return (
      <div className="App">
        <div className="loader" />
      </div>
    );
  }

  if (loginExitoso) {
    const handleLogout = () => {
      // Iniciar animación de logout en App (animarEntrada)
      setAnimarEntrada(true);
      setTimeout(() => {
        // Después de la animación, cambiar de pantalla
        setLoginExitoso(false);
        setUsuario('');
        setContrasena('');
        setMensajeBoton('Iniciar sesión'); // Restaurar texto del botón
        setAnimarSalida(false);
        setAnimarEntrada(false);
        localStorage.removeItem('authToken');
        setUserData(null);
      }, 1500);
    };
    
    // Si animarEntrada está activo, mostrar App en lugar de Biblioteca
    if (animarEntrada) {
      return (
        <div className={`App ${animarEntrada ? 'fade-in' : ''}`}>
          <img
            src={solAnimado}
            alt="Sol animado"
            className={`app-sol-animado ${animarEntrada ? 'sol-entrada' : ''}`}
          />
          <div className="Login-container" />
          <img
            src={pajaritos}
            alt="Pajaritos en rama"
            className={`Imagen-pajaros ${animarEntrada ? 'pajaros-entrada' : ''}`}
          />
        </div>
      );
    }
    
    return <Biblioteca userData={userData} onLogout={handleLogout} />;
  }

  return (
    <div className={`App ${animarSalida ? 'fade-out' : ''} ${!loginExitoso && animarEntrada ? 'fade-in' : ''}`}>
      <img
        src={solAnimado}
        alt="Sol animado"
        className={`app-sol-animado ${animarSalida ? 'sol-salida' : ''} ${animarEntrada ? 'sol-entrada' : ''}`}
      />

      <div className="Login-container">
        <input
          type="text"
          placeholder="USUARIO"
          className="Input"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />
        <input
          type="password"
          placeholder="CONTRASEÑA"
          className="Input"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />

        <button
          className={`Boton-login ${error ? 'Boton-error' : ''}`}
          onClick={iniciarSesion}
          disabled={cargando}
        >
          {cargando ? <div className="loader" /> : mensajeBoton}
        </button>

        <div className="Login-divider">
          <span>¿No tienes cuenta?</span>
        </div>

        <button
          className="Boton-registrar"
          onClick={() => setMostrarRegistro(true)}
        >
          Crear cuenta
        </button>
      </div>

      <img
        src={pajaritos}
        alt="Pajaritos en rama"
        className={`Imagen-pajaros ${animarSalida ? 'pajaros-salida' : ''} ${animarEntrada ? 'pajaros-entrada' : ''}`}
      />

      {mostrarRegistro && (
        <RegistroPopover
          onClose={() => setMostrarRegistro(false)}
          onRegistroExitoso={(username) => {
            setUsuario(username);
            setContrasena('');
          }}
        />
      )}
    </div>
  );
}

export default App;
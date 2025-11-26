import React, { useState, useEffect } from 'react';
import './App.css';

import solAnimado from './assets/sol.png';
import pajaritos from './assets/pajaros.png';
import Biblioteca from './biblioteca';

function App() {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [mensajeBoton, setMensajeBoton] = useState('Iniciar sesión');
  const [loginExitoso, setLoginExitoso] = useState(false);
  const [animarSalida, setAnimarSalida] = useState(false);
  const [userData, setUserData] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

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
      // Si no hay token, intentar login automático con admin/123
      autoLogin();
    }
  }, []);

  // Login automático con credenciales por defecto
  const autoLogin = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: 'admin', password: '123' })
      });

      const data = await response.json();
      
      if (response.ok && data.token) {
        localStorage.setItem('authToken', data.token);
        setUserData(data.user);
        setLoginExitoso(true);
      } else {
        setCheckingSession(false);
      }
    } catch (error) {
      console.error('Error en auto-login:', error);
      setCheckingSession(false);
    }
  };

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
    return <Biblioteca userData={userData} />;
  }

  return (
    <div className={`App ${animarSalida ? 'fade-out' : ''}`}>
      <img
        src={solAnimado}
        alt="Sol animado"
        className={`app-sol-animado ${animarSalida ? 'sol-salida' : ''}`}
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
      </div>

      <img
        src={pajaritos}
        alt="Pajaritos en rama"
        className={`Imagen-pajaros ${animarSalida ? 'pajaros-salida' : ''}`}
      />
    </div>
  );
}

export default App;
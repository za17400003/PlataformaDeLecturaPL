import React, { useState, useEffect } from 'react';
import './App.css';

import solAnimado from './assets/sol.png';
import pajaritos from './assets/pajaros.png';
import Biblioteca from './biblioteca';

function App() {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [modoDev, setModoDev] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [mensajeBoton, setMensajeBoton] = useState('Iniciar sesión');
  const [loginExitoso, setLoginExitoso] = useState(false);
  const [animarSalida, setAnimarSalida] = useState(false);

  const iniciarSesion = () => {
    setCargando(true);
    setError(false);
    setMensajeBoton('');

    setTimeout(() => {
      setCargando(false);
      if (usuario === 'usuario' && contrasena === '123') {
        setAnimarSalida(true);
        setTimeout(() => {
          setLoginExitoso(true);
        }, 1500); // espera a que termine la animación
      } else {
        setError(true);
        setMensajeBoton('usuario/contraseña no válido');
        setTimeout(() => {
          setError(false);
          setMensajeBoton('Iniciar sesión');
        }, 2000);
      }
    }, 1500);
  };

  if (loginExitoso) {
    return <Biblioteca />;
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

        <label className="Checkbox">
          <input
            type="checkbox"
            checked={modoDev}
            onChange={() => setModoDev(!modoDev)}
          />
          MODO DESARROLLADOR
        </label>

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
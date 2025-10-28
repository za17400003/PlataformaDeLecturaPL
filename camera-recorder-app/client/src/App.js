import React, { useState, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom';
import Login from './components/Login';
import LectorCamara from './components/LectorCamara';
import { AuthProvider } from './contexts/AuthContext';
import { RecorderProvider, RecorderContext } from './contexts/RecorderContext';
import './styles/App.css';

function RecorderButtonPortal() {
  const { isRecording, toggle } = useContext(RecorderContext);
  const label = isRecording ? 'DETENER' : 'REC';

  useEffect(() => {
    console.log('[RecorderButton] mounted - isRecording=', isRecording);
  }, [isRecording]);

  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <button
      className={`FloatingRecBtn ${isRecording ? 'on' : ''}`}
      title={label}
      aria-label={label}
      onClick={toggle}
    >
      {label}
    </button>,
    document.body
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // al iniciar sesión mostramos el overlay de carga; espera evento 'library:ready'
  const handleLogin = () => {
    setIsLoggedIn(true);
    setLibraryLoading(true);

    const onReady = () => {
      setLibraryLoading(false);
      window.removeEventListener('library:ready', onReady);
    };
    window.addEventListener('library:ready', onReady);

    // fallback por si no se dispara el evento
    const t = setTimeout(() => {
      setLibraryLoading(false);
      window.removeEventListener('library:ready', onReady);
    }, 10000);

    // limpiar timeout si desmontan el componente
    const cleanup = () => clearTimeout(t);
    window.__libraryLoadingCleanup = cleanup;
  };

  useEffect(() => {
    return () => {
      try { window.__libraryLoadingCleanup && window.__libraryLoadingCleanup(); } catch (e) {}
    };
  }, []);

  // Pseudoaleatorizar ritmos de las nubes y sincronizar el texto con la nube.
  // Se aplica cuando el usuario está en la biblioteca (isLoggedIn true).
  useEffect(() => {
    if (!isLoggedIn) return;

    const applyRandomMotion = () => {
      const nodes = document.querySelectorAll('.Nubes-blancas .Libro-nube');
      nodes.forEach((node, i) => {
        // duraciones entre 4s y 9s
        const duration = (4 + Math.random() * 5).toFixed(2) + 's';
        // amplitud entre 6px y 16px
        const amplitude = (6 + Math.random() * 10).toFixed(2) + 'px';
        // negative delay para que empiece en un punto del ciclo (estado inicial de flotación)
        const delaySec = (Math.random() * parseFloat(duration)).toFixed(2);
        const delay = `-${delaySec}s`;

        node.style.setProperty('--duration', duration);
        node.style.setProperty('--float-amplitude', amplitude);
        node.style.setProperty('--animation-delay', delay);

        // también aplicar a elementos internos que representan título / imagen
        const title = node.querySelector('.Libro-titulo, .book-title');
        if (title) {
          title.style.setProperty('--duration', duration);
          title.style.setProperty('--float-amplitude', amplitude);
          title.style.setProperty('--animation-delay', delay);
        }

        // fuerza reflow para que el navegador reconozca el delay negativo inicial
        // eslint-disable-next-line no-unused-expressions
        node.offsetHeight;
      });
    };

    // aplicar inmediatamente y también después de un breve retraso (por si el DOM cambia)
    applyRandomMotion();
    const id = setTimeout(applyRandomMotion, 400);
    return () => clearTimeout(id);
  }, [isLoggedIn]);

  return (
    <AuthProvider>
      <RecorderProvider>
        <div className="App Biblioteca">
          {isLoggedIn ? <LectorCamara /> : <Login onLogin={handleLogin} />}

          {/* overlay de carga de la biblioteca */}
          {isLoggedIn && libraryLoading && (
            <div className="Library-skeleton-wrapper" role="status" aria-live="polite">
              <div className="Library-skeleton-inner">
                <div className="skeleton-header">
                  <div className="skeleton-title-bar"></div>
                </div>
                <div className="skeleton-grid" aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div className="skeleton-item" key={i}>
                      <div className="skeleton-cover" />
                      <div className="skeleton-line short" />
                      <div className="skeleton-line" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* botón REC global */}
          {isLoggedIn && <RecorderButtonPortal />}
        </div>
      </RecorderProvider>
    </AuthProvider>
  );
}
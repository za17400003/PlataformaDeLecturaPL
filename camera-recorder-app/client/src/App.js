import React, { useState, useContext, useEffect } from 'react';
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
  }, []);

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

  const handleLogin = () => {
    console.log('[App] onLogin called');
    setIsLoggedIn(true);
  };

  return (
    <AuthProvider>
      <RecorderProvider>
        <div className="App">
          {isLoggedIn ? <LectorCamara /> : <Login onLogin={handleLogin} />}

          {/* botón flotante renderizado en body para evitar stacking/context issues */}
          {isLoggedIn && <RecorderButtonPortal />}
        </div>
      </RecorderProvider>
    </AuthProvider>
  );
}
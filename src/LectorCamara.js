import React, { useEffect, useRef, useState } from 'react';

function LectorCamara() {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const iniciarCamara = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' }, // Puedes ajustar esto si quieres usar la cámara trasera
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError('No se pudo acceder a la cámara. Verifica permisos o conexión.');
        console.error(err);
      }
    };

    iniciarCamara();
  }, []);

  return (
    <div className="LectorCamara">
      <h2>📷 Cámara activa para lectura</h2>
      {error ? (
        <p className="ErrorCamara">{error}</p>
      ) : (
        <video ref={videoRef} autoPlay playsInline className="VideoCamara" />
      )}
    </div>
  );
}

export default LectorCamara;
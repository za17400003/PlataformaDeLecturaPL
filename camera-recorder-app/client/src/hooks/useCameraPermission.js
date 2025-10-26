import { useEffect, useState } from 'react';

const useCameraPermission = () => {
  const [hasPermission, setHasPermission] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasPermission(true);
        // Stop the stream immediately to prevent recording
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        setHasPermission(false);
        setError('No se pudo acceder a la cámara. Verifica permisos o conexión.');
        console.error(err);
      }
    };

    requestCameraPermission();
  }, []);

  return { hasPermission, error };
};

export default useCameraPermission;
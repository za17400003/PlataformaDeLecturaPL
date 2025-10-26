import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useContext } from 'react';
import { RecorderContext } from '../contexts/RecorderContext';

const LectorCamara = forwardRef(function LectorCamara(_, ref) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isRecordingInternal, setIsRecordingInternal] = useState(false);

  const { registerHandlers, clearHandlers } = useContext(RecorderContext);

  useImperativeHandle(ref, () => ({
    startRecording: () => startRecording(),
    stopRecording: () => stopRecording(),
    isRecording: () => isRecordingInternal
  }), [isRecordingInternal]);

  useEffect(() => {
    let mounted = true;
    const iniciarCamara = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // preparar MediaRecorder
        try {
          const options = (() => {
            if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return { mimeType: 'video/webm;codecs=vp9' };
            if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return { mimeType: 'video/webm;codecs=vp8' };
            return { mimeType: 'video/webm' };
          })();

          const mr = new MediaRecorder(stream, options);
          mediaRecorderRef.current = mr;
          chunksRef.current = [];

          mr.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
          };

          mr.onstop = async () => {
            const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'video/webm' });
            chunksRef.current = [];
            try {
              const fd = new FormData();
              const filename = `recording-${Date.now()}.webm`;
              fd.append('file', blob, filename);
              await fetch('/upload', { method: 'POST', body: fd });
            } catch (err) {
              console.error('Upload failed', err);
            }
          };

          // registrar handlers en el contexto (start/stop controlables desde otros componentes)
          registerHandlers({ start: () => startRecording(), stop: () => stopRecording() });

          setPermissionGranted(true);
        } catch (err) {
          console.warn('MediaRecorder no disponible: ', err);
          setError('Tu navegador no soporta MediaRecorder.');
        }
      } catch (err) {
        setError('No se pudo acceder a la cámara. Verifica permisos o conexión.');
        console.error(err);
      }
    };

    iniciarCamara();

    return () => {
      mounted = false;
      try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); } catch (e) {}
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      clearHandlers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) { setError('Grabador no preparado.'); return; }
    if (mr.state === 'recording') return;
    chunksRef.current = [];
    try {
      mr.start(1000);
      setIsRecordingInternal(true);
    } catch (e) {
      console.error('Error iniciando grabación', e);
      setError('No se pudo iniciar la grabación.');
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (mr.state === 'inactive') return;
    try {
      mr.stop();
      setIsRecordingInternal(false);
    } catch (e) {
      console.error('Error deteniendo grabación', e);
    }
  };

  return (
    <div className="LectorCamara">
      <h2>📷 Cámara activa para lectura</h2>
      {error ? <p className="ErrorCamara">{error}</p> : (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="VideoCamara" style={{ width: '100%', maxWidth: 720 }} />
          <div style={{ marginTop: 8 }}>
            <div>Permiso cámara: {permissionGranted ? 'concedido' : 'pendiente'}</div>
            <div>Grabando (estado): {isRecordingInternal ? 'sí' : 'no'}</div>
          </div>
        </>
      )}
    </div>
  );
});

export default LectorCamara;
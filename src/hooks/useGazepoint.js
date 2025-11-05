import { useEffect, useRef, useState } from 'react';

export function useGazepoint() {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    function connect() {
      try {
        // Conecta al mismo servidor en la raíz (ws://localhost:3001)
        const ws = new WebSocket('ws://localhost:3001');
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
          setIsConnected(true);
          console.log('[gazepoint] WS conectado');
        };

        ws.onclose = () => {
          setIsConnected(false);
          scheduleReconnect();
          console.log('[gazepoint] WS desconectado');
        };

        ws.onerror = () => {
          // El onclose se encargará del reconnect
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.type === 'GAZEPOINT_DATA') {
              // data.leftEye {x,y}, data.rightEye {x,y}
              // Aquí podríamos actualizar algún overlay si quisieras
              // console.debug('gaze:', data.leftEye, data.rightEye);
            }
          } catch (_) {}
        };
      } catch (e) {
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (reconnectTimerRef.current) return;
      const delay = Math.min(15000, 500 * Math.pow(2, reconnectAttemptsRef.current++));
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    }

    connect();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) {}
        wsRef.current = null;
      }
    };
  }, []);

  const startRecording = (recordingPath) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const timestamp = new Date().toISOString();
    wsRef.current.send(JSON.stringify({ type: 'START_RECORDING', path: recordingPath, timestamp }));
  };

  const stopRecording = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'STOP_RECORDING' }));
  };

  return { isConnected, startRecording, stopRecording };
}
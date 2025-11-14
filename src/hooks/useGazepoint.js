/**
 * useGazepoint.js
 * 
 * Hook personalizado para conectarse al sistema Gazepoint (eye-tracking)
 * 
 * Características:
 * - Conexión WebSocket al servidor local (ws://localhost:3000)
 * - Reconexión automática con backoff exponencial
 * - Recibe datos de seguimiento ocular (leftEye, rightEye)
 * - Controla inicio/detención de grabación de sesiones
 * 
 * Retorna:
 * - isConnected: boolean - estado de conexión
 * - startRecording: función para iniciar sesión
 * - stopRecording: función para detener sesión
 */

import { useEffect, useRef, useState } from 'react';

export function useGazepoint() {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    /**
     * Conecta al servidor WebSocket de Gazepoint
     */
    function connect() {
      try {
        // Conecta al mismo servidor unificado (ws://localhost:3000)
        const ws = new WebSocket('ws://localhost:3000');
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

        // Recibir datos de eye-tracking
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

    /**
     * Programa una reconexión con backoff exponencial
     */
    function scheduleReconnect() {
      if (reconnectTimerRef.current) return;
      // Backoff exponencial: 500ms, 1s, 2s, 4s, 8s, 15s (máximo)
      const delay = Math.min(15000, 500 * Math.pow(2, reconnectAttemptsRef.current++));
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    }

    connect();
    
    // Cleanup al desmontar
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

  /**
   * Inicia la grabación de una sesión de eye-tracking
   * @param {string} sessionTimestamp - ID único de la sesión
   */
  const startRecording = (sessionTimestamp) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const timestamp = new Date().toISOString();
    wsRef.current.send(JSON.stringify({ 
      type: 'START_RECORDING', 
      timestamp, 
      sessionId: sessionTimestamp || timestamp.replace(/[:.]/g, '-')
    }));
  };

  /**
   * Detiene la grabación de eye-tracking
   */
  const stopRecording = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'STOP_RECORDING' }));
  };

  return { isConnected, startRecording, stopRecording };
}
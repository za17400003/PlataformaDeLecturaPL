import { useEffect, useRef, useState } from 'react';

export function useGazepoint() {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Conectar al servidor WebSocket del eye tracker
    const ws = new WebSocket('ws://localhost:4000/gazepoint');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Conectado al servidor de eye tracking');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('Desconectado del servidor de eye tracking');
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'GAZEPOINT_DATA') {
        const { leftEye, rightEye } = parseGazepointData(data.xmlData);
        console.debug('Eye tracking data:', leftEye, rightEye);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startRecording = (recordingPath) => {
    if (!wsRef.current || !isConnected) return;
    
    const timestamp = new Date().toISOString();
    wsRef.current.send(JSON.stringify({
      type: 'START_RECORDING',
      path: recordingPath,
      timestamp: timestamp
    }));
  };

  const stopRecording = () => {
    if (!wsRef.current || !isConnected) return;

    wsRef.current.send(JSON.stringify({
      type: 'STOP_RECORDING'
    }));
  };

  return {
    isConnected,
    startRecording,
    stopRecording
  };
}

function parseGazepointData(xmlData) {
  // Parsear datos XML del Gazepoint para ambos ojos
  const leftEye = {
    x: xmlData.match(/LFPOGX="([^"]+)"/) ? parseFloat(RegExp.$1) : 0,
    y: xmlData.match(/LFPOGY="([^"]+)"/) ? parseFloat(RegExp.$1) : 0
  };
  
  const rightEye = {
    x: xmlData.match(/RFPOGX="([^"]+)"/) ? parseFloat(RegExp.$1) : 0,
    y: xmlData.match(/RFPOGY="([^"]+)"/) ? parseFloat(RegExp.$1) : 0
  };
  
  return { leftEye, rightEye };
}
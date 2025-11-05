import { useEffect, useRef } from 'react';

export function useGazeHighlight(iframeRef, isEnabled = false) {
  const wsRef = useRef(null);
  const lastFixationRef = useRef(null);
  const fixationTimerRef = useRef(null);
  const gazeBufferRef = useRef([]);
  const highlightedSpanRef = useRef(null);

  useEffect(() => {
    if (!isEnabled || !iframeRef?.current) return;

    function connect() {
      try {
        const ws = new WebSocket('ws://localhost:3001');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[gaze-highlight] Conectado al servidor de gaze');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data && data.type === 'GAZEPOINT_DATA') {
              const { leftEye } = data;
              if (leftEye && leftEye.x && leftEye.y) {
                processGazeData(leftEye.x, leftEye.y);
              }
            }
          } catch (_) {}
        };

        ws.onerror = () => {
          console.error('[gaze-highlight] Error en conexión');
        };

        ws.onclose = () => {
          console.log('[gaze-highlight] Desconectado');
        };
      } catch (e) {
        console.error('[gaze-highlight] Error:', e);
      }
    }

    function processGazeData(x, y) {
      gazeBufferRef.current.push({ x, y, time: Date.now() });
      
      const now = Date.now();
      gazeBufferRef.current = gazeBufferRef.current.filter(p => now - p.time < 500);

      if (gazeBufferRef.current.length > 5) {
        const avgX = gazeBufferRef.current.reduce((sum, p) => sum + p.x, 0) / gazeBufferRef.current.length;
        const avgY = gazeBufferRef.current.reduce((sum, p) => sum + p.y, 0) / gazeBufferRef.current.length;
        
        const variance = gazeBufferRef.current.reduce(
          (sum, p) => sum + Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2),
          0
        ) / gazeBufferRef.current.length;

        if (variance < 100) {
          highlightWordAtCoordinate(avgX, avgY);
        }
      }
    }

    function highlightWordAtCoordinate(x, y) {
      try {
        const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
        if (!iframeDoc) return;

        // Remover highlight anterior
        if (highlightedSpanRef.current) {
          const parent = highlightedSpanRef.current.parentNode;
          while (highlightedSpanRef.current.firstChild) {
            parent.insertBefore(highlightedSpanRef.current.firstChild, highlightedSpanRef.current);
          }
          parent.removeChild(highlightedSpanRef.current);
          highlightedSpanRef.current = null;
        }

        // Obtener elemento en coordenada
        const element = iframeDoc.elementFromPoint(x, y);
        if (!element) return;

        // Recorrer hasta encontrar nodo de texto
        let node = element;
        while (node && node.nodeType !== 3) {
          if (node.childNodes.length === 0) return;
          node = node.firstChild;
        }

        if (!node || node.nodeType !== 3) return;

        const text = node.textContent;
        if (!text) return;

        // Encontrar posición relativa del gaze en el texto
        const range = iframeDoc.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();

        // Calcular posición relativa dentro del texto (de izq a der, arriba a abajo)
        const relX = ((x - rect.left) / rect.width) * text.length;
        const charIndex = Math.floor(Math.max(0, Math.min(text.length - 1, relX)));

        // Encontrar palabra alrededor de charIndex
        let wordStart = charIndex;
        let wordEnd = charIndex;

        while (wordStart > 0 && /\w/.test(text[wordStart - 1])) wordStart--;
        while (wordEnd < text.length && /\w/.test(text[wordEnd])) wordEnd++;

        const word = text.substring(wordStart, wordEnd);

        if (word && word !== lastFixationRef.current) {
          lastFixationRef.current = word;

          // Reemplazar texto con span subrayado
          const beforeText = text.substring(0, wordStart);
          const afterText = text.substring(wordEnd);

          const span = iframeDoc.createElement('u');
          span.style.textDecoration = 'underline wavy #5bd8cf';
          span.style.textDecorationThickness = '2px';
          span.style.textUnderlineOffset = '4px';
          span.style.color = 'inherit';
          span.textContent = word;

          highlightedSpanRef.current = span;

          // Insertar el span
          if (beforeText) node.parentNode.insertBefore(iframeDoc.createTextNode(beforeText), node);
          node.parentNode.insertBefore(span, node);
          if (afterText) node.parentNode.insertBefore(iframeDoc.createTextNode(afterText), node);
          node.parentNode.removeChild(node);

          // Remover highlight después de 500ms
          if (fixationTimerRef.current) clearTimeout(fixationTimerRef.current);
          fixationTimerRef.current = setTimeout(() => {
            if (highlightedSpanRef.current && highlightedSpanRef.current.parentNode) {
              const parent = highlightedSpanRef.current.parentNode;
              while (highlightedSpanRef.current.firstChild) {
                parent.insertBefore(highlightedSpanRef.current.firstChild, highlightedSpanRef.current);
              }
              parent.removeChild(highlightedSpanRef.current);
              highlightedSpanRef.current = null;
            }
            lastFixationRef.current = null;
          }, 500);
        }
      } catch (e) {
        console.error('[gaze-highlight] Error:', e);
      }
    }

    connect();

    return () => {
      if (fixationTimerRef.current) clearTimeout(fixationTimerRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) {}
      }
    };
  }, [iframeRef, isEnabled]);

  return null;
}

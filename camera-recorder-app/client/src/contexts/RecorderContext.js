import React, { createContext, useRef, useState, useCallback } from 'react';

export const RecorderContext = createContext({
  isRecording: false,
  start: () => {},
  stop: () => {},
  toggle: () => {},
  registerHandlers: () => {},
  clearHandlers: () => {}
});

export function RecorderProvider({ children }) {
  const handlersRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);

  const registerHandlers = useCallback((h) => { handlersRef.current = h; }, []);
  const clearHandlers = useCallback(() => { handlersRef.current = null; }, []);

  const start = useCallback(() => {
    if (handlersRef.current && handlersRef.current.start) {
      try { handlersRef.current.start(); setIsRecording(true); } catch (e) { console.error(e); }
    }
  }, []);

  const stop = useCallback(() => {
    if (handlersRef.current && handlersRef.current.stop) {
      try { handlersRef.current.stop(); setIsRecording(false); } catch (e) { console.error(e); }
    }
  }, []);

  const toggle = useCallback(() => {
    if (isRecording) stop(); else start();
  }, [isRecording, start, stop]);

  return (
    <RecorderContext.Provider value={{ isRecording, start, stop, toggle, registerHandlers, clearHandlers }}>
      {children}
    </RecorderContext.Provider>
  );
}
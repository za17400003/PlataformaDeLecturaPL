import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// Early global suppression for ResizeObserver loop errors to avoid create-react-app overlay spam
try {
  const matchResizeMsg = (text) => typeof text === 'string' && text.indexOf('ResizeObserver loop completed with undelivered notifications') !== -1;
  window.addEventListener('error', (ev) => {
    try {
      const msg = ev && (ev.message || (ev.error && ev.error.message)) ? (ev.message || ev.error.message).toString() : '';
      if (matchResizeMsg(msg)) {
        ev.preventDefault && ev.preventDefault();
        ev.stopImmediatePropagation && ev.stopImmediatePropagation();
        console.debug && console.debug('[global] suppressed ResizeObserver error');
      }
    } catch (e) {}
  }, true);
  window.addEventListener('unhandledrejection', (ev) => {
    try {
      const reason = ev && ev.reason;
      const msg = reason && (reason.message || reason.toString()) ? (reason.message || reason.toString()) : '';
      if (matchResizeMsg(msg)) {
        ev.preventDefault && ev.preventDefault();
        ev.stopImmediatePropagation && ev.stopImmediatePropagation();
        console.debug && console.debug('[global] suppressed ResizeObserver unhandledrejection');
      }
    } catch (e) {}
  }, true);
} catch (e) {}
/* meta charset removed from JS */

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

import React from 'react';

export default function TabSelector({ activeTab, onChange }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: '2px solid #ccc',
      marginBottom: '1rem',
      gap: '0'
    }}>
      {['datos', 'videos'].map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            padding: '0.8rem 1.5rem',
            backgroundColor: activeTab === tab ? '#007bff' : 'transparent',
            color: activeTab === tab ? 'white' : '#007bff',
            border: 'none',
            borderBottom: activeTab === tab ? '3px solid #007bff' : 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: activeTab === tab ? 'bold' : 'normal',
            textTransform: 'capitalize'
          }}
        >
          {tab === 'datos' ? '📊 Datos de Gaze & Eventos' : '🎥 Videos'}
        </button>
      ))}
    </div>
  );
}

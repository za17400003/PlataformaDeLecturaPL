import React, { useState, useEffect } from 'react';

export default function TabDatos({ runId }) {
  const [meta, setMeta] = useState(null);
  const [gazeData, setGazeData] = useState([]);
  const [eventData, setEventData] = useState([]);
  const [gazePage, setGazePage] = useState(1);
  const [gazeTotal, setGazeTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [eventFilter, setEventFilter] = useState('');
  const [validityFilter, setValidityFilter] = useState('');

  const GAZE_LIMIT = 100;

  // Fetch metadata
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`/api/session/${runId}/data/meta`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setMeta(data);
      } catch (err) {
        console.error('Error fetching meta:', err);
      }
    };
    
    fetchMeta();
  }, [runId]);

  // Fetch gaze data con paginación
  useEffect(() => {
    const fetchGaze = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const url = `/api/session/${runId}/data/gaze?page=${gazePage}&limit=${GAZE_LIMIT}`;
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setGazeData(data.data || []);
        setGazeTotal(data.total || 0);
      } catch (err) {
        console.error('Error fetching gaze:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGaze();
  }, [runId, gazePage]);

  // Fetch event data
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`/api/session/${runId}/data/events`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setEventData(data.data || []);
      } catch (err) {
        console.error('Error fetching events:', err);
      }
    };
    
    fetchEvents();
  }, [runId]);

  const filteredEvents = eventData.filter(e => 
    (eventFilter === '' || e.event_type === eventFilter)
  );

  const filteredGaze = gazeData.filter(g =>
    validityFilter === '' || 
    (validityFilter === 'valid' && g.validity === 1) ||
    (validityFilter === 'invalid' && g.validity === 0)
  );

  const exportGaze = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/session/${runId}/export/gaze`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gaze_${runId}.csv`;
      a.click();
    } catch (err) {
      console.error('Error exporting gaze:', err);
    }
  };

  const exportEvents = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/session/${runId}/export/events`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `events_${runId}.csv`;
      a.click();
    } catch (err) {
      console.error('Error exporting events:', err);
    }
  };

  if (!meta) return <div style={{padding: '1rem'}}>Cargando datos...</div>;

  return (
    <div style={{padding: '1rem'}}>
      {/* RESUMEN SUPERIOR */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <div><strong>Experimento:</strong> {meta.experiment_name}</div>
        <div><strong>Fecha:</strong> {new Date(meta.started_at).toLocaleString()}</div>
        <div><strong>Duración:</strong> {meta.duration_seconds ? `${Math.floor(meta.duration_seconds / 60)}:${String(meta.duration_seconds % 60).padStart(2, '0')}` : 'N/A'}</div>
        <div><strong>Bloques:</strong> {meta.block_count}</div>
        <div><strong>Estado:</strong> {meta.status}</div>
        <div><strong>Total Eventos:</strong> {meta.total_events}</div>
        <div><strong>Total Muestras Gaze:</strong> {meta.total_gaze_samples}</div>
      </div>

      {/* TABLA GAZE */}
      <div style={{marginBottom: '2rem'}}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <h3>Muestras de Gaze ({gazeTotal} total)</h3>
          <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
            <select 
              value={validityFilter}
              onChange={(e) => {
                setValidityFilter(e.target.value);
                setGazePage(1);
              }}
              style={{padding: '0.3rem'}}
            >
              <option value="">Todos</option>
              <option value="valid">Válidos</option>
              <option value="invalid">Inválidos</option>
            </select>
            <button onClick={exportGaze} style={{padding: '0.3rem 0.8rem', cursor: 'pointer'}}>📥 Exportar CSV</button>
          </div>
        </div>
        
        <div style={{overflowX: 'auto', marginBottom: '0.5rem', border: '1px solid #ddd', borderRadius: '4px'}}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8rem'
          }}>
            <thead>
              <tr style={{backgroundColor: '#007bff', color: 'white'}}>
                <th style={{padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #005bbf'}}>Timestamp (ms)</th>
                <th style={{padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #005bbf'}}>X</th>
                <th style={{padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #005bbf'}}>Y</th>
                <th style={{padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #005bbf'}}>Validez</th>
                <th style={{padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #005bbf'}}>Pupila Izq</th>
                <th style={{padding: '0.5rem', textAlign: 'left'}}>Pupila Der</th>
              </tr>
            </thead>
            <tbody>
              {filteredGaze.length > 0 ? (
                filteredGaze.map((row) => (
                  <tr key={row.id} style={{
                    backgroundColor: row.validity === 1 ? '#ffffff' : '#ffe6e6',
                    borderBottom: '1px solid #ddd'
                  }}>
                    <td style={{padding: '0.4rem', borderRight: '1px solid #ddd'}}>{row.timestamp_ms}</td>
                    <td style={{padding: '0.4rem', borderRight: '1px solid #ddd'}}>{row.bpogx?.toFixed(2)}</td>
                    <td style={{padding: '0.4rem', borderRight: '1px solid #ddd'}}>{row.bpogy?.toFixed(2)}</td>
                    <td style={{padding: '0.4rem', borderRight: '1px solid #ddd'}}>{row.validity === 1 ? '✓ Válido' : '✗ Inválido'}</td>
                    <td style={{padding: '0.4rem', borderRight: '1px solid #ddd'}}>{row.pupil_left?.toFixed(2)}</td>
                    <td style={{padding: '0.4rem'}}>{row.pupil_right?.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" style={{padding: '1rem', textAlign: 'center', color: '#999'}}>No hay datos</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div style={{display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem'}}>
          <button 
            onClick={() => setGazePage(Math.max(1, gazePage - 1))}
            disabled={gazePage === 1}
            style={{padding: '0.3rem 0.8rem', cursor: gazePage === 1 ? 'not-allowed' : 'pointer'}}
          >
            ← Anterior
          </button>
          <span style={{fontSize: '0.9rem'}}>Página {gazePage} de {Math.ceil(gazeTotal / GAZE_LIMIT || 1)}</span>
          <button 
            onClick={() => setGazePage(gazePage + 1)}
            disabled={gazePage >= Math.ceil(gazeTotal / GAZE_LIMIT)}
            style={{padding: '0.3rem 0.8rem', cursor: gazePage >= Math.ceil(gazeTotal / GAZE_LIMIT) ? 'not-allowed' : 'pointer'}}
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* TABLA EVENTOS */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <h3>Eventos ({filteredEvents.length})</h3>
          <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
            <select 
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              style={{padding: '0.3rem'}}
            >
              <option value="">Todos los tipos</option>
              <option value="stim_visual">Estímulo Visual</option>
              <option value="stim_kinesthetic">Estímulo Kinestésico</option>
              <option value="stim_auditory">Estímulo Auditivo</option>
              <option value="block_start">Inicio de Bloque</option>
              <option value="block_end">Fin de Bloque</option>
            </select>
            <button onClick={exportEvents} style={{padding: '0.3rem 0.8rem', cursor: 'pointer'}}>📥 Exportar CSV</button>
          </div>
        </div>

        <div style={{overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px'}}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8rem'
          }}>
            <thead>
              <tr style={{backgroundColor: '#28a745', color: 'white'}}>
                <th style={{padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #1e6e32'}}>Timestamp (ms)</th>
                <th style={{padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #1e6e32'}}>Bloque</th>
                <th style={{padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #1e6e32'}}>Tipo</th>
                <th style={{padding: '0.5rem', textAlign: 'left'}}>Datos</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length > 0 ? (
                filteredEvents.map((row) => (
                  <tr key={row.id} style={{borderBottom: '1px solid #ddd'}}>
                    <td style={{padding: '0.4rem', borderRight: '1px solid #ddd'}}>{row.timestamp_ms}</td>
                    <td style={{padding: '0.4rem', borderRight: '1px solid #ddd'}}>Bloque {row.block_number}</td>
                    <td style={{padding: '0.4rem', borderRight: '1px solid #ddd', fontWeight: 'bold'}}>{row.event_type}</td>
                    <td style={{padding: '0.4rem', fontSize: '0.7rem', color: '#666'}}>
                      {typeof row.event_data === 'string' ? row.event_data : JSON.stringify(row.event_data)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4" style={{padding: '1rem', textAlign: 'center', color: '#999'}}>No hay eventos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

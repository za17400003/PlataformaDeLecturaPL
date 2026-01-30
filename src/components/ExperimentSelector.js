import React from 'react';

export default function ExperimentSelector({ runs, selectedRun, onChange }) {
  return (
    <div style={{marginBottom: '1rem'}}>
      <label style={{marginRight: '0.5rem', fontWeight: 'bold'}}>
        Seleccionar corrida:
      </label>
      <select 
        value={selectedRun?.id || ''}
        onChange={(e) => {
          const run = runs.find(r => r.id === parseInt(e.target.value));
          onChange(run);
        }}
        style={{padding: '0.5rem', minWidth: '300px'}}
      >
        {runs.map(run => (
          <option key={run.id} value={run.id}>
            Corrida {run.id} - {new Date(run.started_at).toLocaleString()} ({run.status})
          </option>
        ))}
      </select>
    </div>
  );
}

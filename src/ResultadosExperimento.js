import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TabDatos from './components/TabDatos';
import TabVideos from './components/TabVideos';
import ExperimentSelector from './components/ExperimentSelector';
import TabSelector from './components/TabSelector';

export default function ResultadosExperimento() {
  const { experimentId } = useParams();
  const navigate = useNavigate();
  
  const [selectedRun, setSelectedRun] = useState(null);
  const [activeTab, setActiveTab] = useState('datos');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState([]);
  const [experimentName, setExperimentName] = useState('');

  // Fetch lista de runs para este experimento
  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const res = await fetch(`/api/experiments-v2/${experimentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        setExperimentName(data.name);
        
        // Obtener runs
        const runsRes = await fetch(`/api/experiments-v2/${experimentId}/runs`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const runsData = await runsRes.json();
        setRuns(runsData.runs || []);
        
        if (runsData.runs && runsData.runs.length > 0) {
          setSelectedRun(runsData.runs[0]);
        }
      } catch (err) {
        setError('Error cargando experimento: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRuns();
  }, [experimentId]);

  if (loading) return <div style={{padding: '1rem'}}>Cargando...</div>;
  if (error) return <div style={{padding: '1rem', color: 'red'}}>{error}</div>;

  return (
    <div className="resultados-container">
      <div className="resultados-header">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
          <h1 style={{margin: 0, fontSize: '1.8rem'}}>📊 {experimentName}</h1>
          <button 
            onClick={() => navigate('/experimentos')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Volver
          </button>
        </div>
      </div>
      
      <div className="resultados-content">
        {runs.length > 0 ? (
          <>
            <ExperimentSelector 
              runs={runs}
              selectedRun={selectedRun}
              onChange={setSelectedRun}
            />
            
            <TabSelector 
              activeTab={activeTab}
              onChange={setActiveTab}
            />
            
            {activeTab === 'datos' && selectedRun && (
              <TabDatos runId={selectedRun.id} />
            )}
            
            {activeTab === 'videos' && selectedRun && (
              <TabVideos runId={selectedRun.id} />
            )}
          </>
        ) : (
          <p>No hay resultados para este experimento.</p>
        )}
      </div>
    </div>
  );
}

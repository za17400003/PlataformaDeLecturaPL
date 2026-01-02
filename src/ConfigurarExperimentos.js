import React, { useState, useEffect } from 'react';
import './ConfigurarExperimentos.css';

// ============ COMPONENTE LISTA DE EXPERIMENTOS ============

const ConfigurarExperimentos = ({ userData, onClose, onStartExperiment }) => {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [viewingResults, setViewingResults] = useState(null);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/experiments', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setExperiments(data);
      }
    } catch (err) {
      setError('Error al cargar experimentos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExperiment = async () => {
    const name = prompt('Nombre del nuevo experimento:');
    if (!name || !name.trim()) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim(), description: '' }),
        credentials: 'include'
      });

      if (response.ok) {
        const created = await response.json();
        setExperiments([...experiments, created]);
        setSelectedExperiment(created);
      } else {
        setError('Error al crear experimento');
      }
    } catch (err) {
      setError('Error al crear experimento');
      console.error(err);
    }
  };

  const handleConfigureExperiment = (exp) => {
    setSelectedExperiment(exp);
  };

  const handleStartExperiment = (exp) => {
    // Llamar la función de callback que pasó Biblioteca
    console.log('[ConfigurarExperimentos] handleStartExperiment llamado con:', exp);
    console.log('[ConfigurarExperimentos] onStartExperiment callback:', typeof onStartExperiment);
    if (onStartExperiment) {
      console.log('[ConfigurarExperimentos] Llamando onStartExperiment...');
      onStartExperiment(exp);
      console.log('[ConfigurarExperimentos] Cerrando popover...');
      onClose(); // Cerrar el popover de experimentos
    } else {
      console.error('[ConfigurarExperimentos] ERROR: onStartExperiment no está definido!');
    }
  };

  const handleDeleteExperiment = async (expId) => {
    if (!window.confirm('¿Eliminar este experimento?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/experiments/${expId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        setExperiments(experiments.filter(e => e.id !== expId));
        setError('');
      } else {
        setError('Error al eliminar experimento');
      }
    } catch (err) {
      setError('Error al eliminar');
      console.error(err);
    }
  };

  if (selectedExperiment) {
    return (
      <ConfigurarExperimento
        experiment={selectedExperiment}
        userData={userData}
        onBack={() => {
          setSelectedExperiment(null);
          fetchExperiments();
        }}
        onExperimentUpdated={fetchExperiments}
      />
    );
  }

  if (viewingResults) {
    return <ExperimentResults experiment={viewingResults} onBack={() => setViewingResults(null)} />;
  }

  return (
    <div className="configurar-experimentos">
      <h2 style={{margin:'0 0 1rem 0',color:'#333'}}>Mis Experimentos</h2>

      {error && <div className="error-message">{error}</div>}

      <button className="btn btn-primary" onClick={handleCreateExperiment} style={{marginBottom:'1rem'}}>
        + Crear Experimento
      </button>

      {loading ? (
        <p className="loading">Cargando experimentos...</p>
      ) : experiments.length === 0 ? (
        <p className="empty-message">No hay experimentos. Crea uno nuevo.</p>
      ) : (
        <div className="experimentos-list">
          {experiments.map((exp, idx) => (
            <div key={exp.id} className="experimento-card">
              <div className="experimento-info">
                <h3>Experimento {idx + 1}</h3>
                <p className="exp-name">{exp.name}</p>
                {exp.description && <p className="exp-desc">{exp.description}</p>}
              </div>
              <div className="experimento-actions">
                <button
                  className="btn btn-small btn-play"
                  onClick={() => handleStartExperiment(exp)}
                  title="Iniciar experimento"
                >
                  ▶ Iniciar
                </button>
                <button
                  className="btn btn-small btn-results"
                  onClick={() => setViewingResults(exp)}
                  title="Ver resultados"
                >
                  📊 Resultados
                </button>
                <button
                  className="btn btn-small btn-configure"
                  onClick={() => handleConfigureExperiment(exp)}
                >
                  Configurar
                </button>
                <button
                  className="btn btn-small btn-delete"
                  onClick={() => handleDeleteExperiment(exp.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============ COMPONENTE CONFIGURAR EXPERIMENTO ============

const ConfigurarExperimento = ({ experiment, userData, onBack, onExperimentUpdated }) => {
  const [expState, setExpState] = useState(experiment);
  const [experimentForm, setExperimentForm] = useState({ name: experiment.name || '', description: experiment.description || '' });
  const [isEditingExperiment, setIsEditingExperiment] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Navigation state: null = experimento, blockId/'new' = viendo bloque
  const [navState, setNavState] = useState(null);

  // Editor de bloque (crear/editar + configuración)
  const [editingBlock, setEditingBlock] = useState(null);
  const [libros, setLibros] = useState([]); // Para la lista de libros
  const [blockEditor, setBlockEditor] = useState({
    name: '',
    duration: 5,
    bookId: '',
    pageNumber: 1,
    config: {
      vibrationEnabled: false,
      auditoryEnabled: false,
      visualEnabled: false,
      extraStimuli: [],
      randomFrequency: 1.0,
      frequencyCross: false
    }
  });

  useEffect(() => {
    setExperimentForm({ name: expState.name || '', description: expState.description || '' });
    if (expState.id) {
      fetchBlocks();
      fetchLibros();
    } else {
      setBlocks([]);
      setLibros([]);
    }
  }, [expState.id]);

  const fetchLibros = async () => {
    try {
      const response = await fetch('/api/books', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setLibros(data);
      }
    } catch (err) {
      console.error('Error al cargar libros:', err);
    }
  };

  const fetchBlocks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/experiments/${expState.id}/blocks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setBlocks(data);
      }
    } catch (err) {
      setError('Error al cargar bloques');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openBlockEditor = async (block) => {
    setEditingBlock(block || null);

    if (block) {
      const token = localStorage.getItem('authToken');
      try {
        const cfgResp = await fetch(`/api/blocks/${block.id}/stimuli-config`, {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        let cfg = {
          vibrationEnabled: false,
          auditoryEnabled: false,
          visualEnabled: false,
          extraStimuli: [],
          randomFrequency: 1.0,
          frequencyCross: false
        };
        if (cfgResp.ok) {
          const data = await cfgResp.json();
          if (data.blockId) {
            cfg = {
              vibrationEnabled: !!data.vibrationEnabled,
              auditoryEnabled: !!data.auditoryEnabled,
              visualEnabled: !!data.visualEnabled,
              extraStimuli: data.extraStimuli ? JSON.parse(data.extraStimuli) : [],
              randomFrequency: data.randomFrequency || 1.0,
              frequencyCross: !!data.frequencyCross
            };
          }
        }
        setBlockEditor({ 
          name: block.name, 
          duration: block.duration, 
          bookId: block.bookId || '',
          pageNumber: block.pageNumber || 1,
          config: cfg 
        });
      } catch {}
    } else {
      setBlockEditor({
        name: '',
        duration: 5,
        bookId: '',
        pageNumber: 1,
        config: {
          vibrationEnabled: false,
          auditoryEnabled: false,
          visualEnabled: false,
          extraStimuli: [],
          randomFrequency: 1.0,
          frequencyCross: false
        }
      });
    }

    setNavState(block?.id || 'new');
  };

  const goBackFromBlock = () => {
    setNavState(null);
  };

  const saveBlockEditor = async () => {
    const token = localStorage.getItem('authToken');
    try {
      let blockId = editingBlock?.id;
      if (!blockEditor.name.trim()) {
        setError('El nombre del bloque es requerido');
        return;
      }
      if (!blockId) {
        // crear bloque
        const blockNumber = blocks.length + 1;
        const resp = await fetch(`/api/experiments/${expState.id}/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ 
            blockNumber, 
            name: blockEditor.name, 
            duration: parseInt(blockEditor.duration),
            bookId: blockEditor.bookId || null,
            pageNumber: blockEditor.pageNumber ? parseInt(blockEditor.pageNumber) : 1
          }),
          credentials: 'include'
        });
        if (!resp.ok) {
          setError('Error al crear bloque');
          return;
        }
        const created = await resp.json();
        blockId = created.id;
      } else {
        // actualizar bloque
        const respUp = await fetch(`/api/experiments/${expState.id}/blocks/${blockId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ 
            name: blockEditor.name, 
            duration: parseInt(blockEditor.duration),
            bookId: blockEditor.bookId || null,
            pageNumber: blockEditor.pageNumber ? parseInt(blockEditor.pageNumber) : 1
          }),
          credentials: 'include'
        });
        if (!respUp.ok) {
          setError('Error al actualizar bloque');
          return;
        }
      }
      // guardar configuración
      const respCfg = await fetch(`/api/blocks/${blockId}/stimuli-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(blockEditor.config),
        credentials: 'include'
      });
      if (!respCfg.ok) {
        setError('Error al guardar configuración');
        return;
      }
      goBackFromBlock();
      fetchBlocks();
      setError('');
    } catch (err) {
      setError('Error al guardar bloque');
      console.error(err);
    }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm('¿Eliminar este bloque?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `/api/experiments/${experiment.id}/blocks/${blockId}`,
        { 
          method: 'DELETE', 
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include' 
        }
      );

      if (response.ok) {
        fetchBlocks();
        setError('');
      } else {
        setError('Error al eliminar bloque');
      }
    } catch (err) {
      setError('Error al eliminar');
      console.error(err);
    }
  };

  const handleCloneBlock = async (block) => {
    if (!window.confirm(`¿Clonar "${block.name}"?`)) return;

    try {
      const token = localStorage.getItem('authToken');
      const configResponse = await fetch(`/api/blocks/${block.id}/stimuli-config`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      const originalConfig = await configResponse.ok ? await configResponse.json() : {};

      const blockNumber = blocks.length + 1;
      const createResponse = await fetch(`/api/experiments/${experiment.id}/blocks`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          blockNumber,
          name: `${block.name} (copia)`,
          duration: block.duration,
          bookId: block.bookId || null,
          pageNumber: block.pageNumber || 1
        }),
        credentials: 'include'
      });

      if (createResponse.ok) {
        const newBlock = await createResponse.json();

        if (originalConfig.blockId) {
          await fetch(`/api/blocks/${newBlock.id}/stimuli-config`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              vibrationEnabled: originalConfig.vibrationEnabled,
              auditoryEnabled: originalConfig.auditoryEnabled,
              visualEnabled: originalConfig.visualEnabled,
              extraStimuli: originalConfig.extraStimuli,
              randomFrequency: originalConfig.randomFrequency,
              frequencyCross: originalConfig.frequencyCross
            }),
            credentials: 'include'
          });
        }

        fetchBlocks();
        setError('');
      } else {
        setError('Error al clonar bloque');
      }
    } catch (err) {
      setError('Error al clonar');
      console.error(err);
    }
  };

  return (
    <div className="configurar-experimento" style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {!navState && (
        <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
          <div style={{display:'flex',alignItems:'center',gap:'1rem',marginBottom:'1rem',paddingBottom:'0.8rem',borderBottom:'2px solid #4CAF50'}}>
            <button className="back-btn" onClick={onBack} style={{padding:'6px 12px',fontSize:'13px'}}>← Volver</button>
            {!isEditingExperiment && (
              <div style={{display:'flex',alignItems:'center',gap:'0.8rem',flex:1}}>
                <h2 style={{margin:0,fontSize:'1.3rem',color:'#333',fontWeight:'600'}}>
                  {expState.name || 'Sin nombre'}
                </h2>
                <button className="btn btn-small btn-edit" onClick={()=>setIsEditingExperiment(true)}>Editar</button>
              </div>
            )}
            {!isEditingExperiment && expState.description && (
              <p style={{margin:'0.5rem 0 0 0',fontSize:'0.9rem',color:'#666',fontStyle:'italic'}}>
                {expState.description}
              </p>
            )}
          </div>
          
          {isEditingExperiment && (
            <div style={{display:'flex',flexDirection:'column',gap:'0.8rem',marginBottom:'1rem'}}>
              <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
                <label style={{fontSize:'0.9rem',fontWeight:'500',color:'#555'}}>Título *</label>
                <input
                  type="text"
                  value={experimentForm.name}
                  onChange={(e)=>setExperimentForm({...experimentForm,name:e.target.value})}
                  placeholder="Nombre del experimento"
                  style={{padding:'0.5rem 0.6rem',fontSize:'1rem'}}
                />
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
                <label style={{fontSize:'0.9rem',fontWeight:'500',color:'#555'}}>Descripción</label>
                <input
                  type="text"
                  value={experimentForm.description}
                  onChange={(e)=>setExperimentForm({...experimentForm,description:e.target.value})}
                  placeholder="Descripción del experimento (opcional)"
                  style={{padding:'0.5rem 0.6rem',fontSize:'0.9rem'}}
                />
              </div>
              <div style={{display:'flex',gap:'0.5rem'}}>
                <button className="btn btn-small btn-primary" onClick={async ()=>{
                    try{
                      const token = localStorage.getItem('authToken');
                      if (!expState.id){
                        const resp = await fetch('/api/experiments',{
                          method:'POST',
                          headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
                          body: JSON.stringify({name: experimentForm.name, description: experimentForm.description}),
                          credentials:'include'
                        });
                        if(!resp.ok){ setError('Error al crear experimento'); return; }
                        const created = await resp.json();
                        setExpState(created);
                        onExperimentUpdated && onExperimentUpdated();
                      } else {
                        const respU = await fetch(`/api/experiments/${expState.id}`,{
                          method:'PUT',
                          headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
                          body: JSON.stringify({name: experimentForm.name, description: experimentForm.description}),
                          credentials:'include'
                        });
                        if(!respU.ok){ setError('Error al actualizar experimento'); return; }
                        onExperimentUpdated && onExperimentUpdated();
                      }
                      setIsEditingExperiment(false);
                      setError('');
                    }catch(err){ setError('Error al guardar experimento'); console.error(err); }
                  }}>Guardar</button>
                <button className="btn btn-small btn-cancel" onClick={()=>{
                  setExperimentForm({name: expState.name || '', description: expState.description || ''});
                  setIsEditingExperiment(false);
                }}>Cancelar</button>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="blocks-toolbar">
            <button className="btn btn-primary" disabled={!expState.id} onClick={()=>openBlockEditor(null)}>
              + Agregar Bloque de Lectura
            </button>
            {!expState.id && <p style={{marginTop:'0.5rem'}}>Guarda el experimento para añadir bloques.</p>}
          </div>

          {loading ? (
            <p className="loading">Cargando bloques...</p>
          ) : blocks.length === 0 ? (
            <p className="empty-message">No hay bloques. Crea uno nuevo.</p>
          ) : (
            <div className="blocks-list" style={{flex:1,overflowY:'auto',paddingRight:'5px'}}>
              {blocks.map((block) => (
                <div key={block.id} className="block-card">
                  <div className="block-info">
                    <h4>Bloque {block.blockNumber}</h4>
                    <p className="block-name">{block.name}</p>
                    <p className="block-duration">Duración: {block.duration}s</p>
                    {block.bookId && (
                      <p className="block-book">📖 Página {block.pageNumber}</p>
                    )}
                  </div>
                  <div className="block-actions">
                    <button className="btn btn-small btn-configure" onClick={() => openBlockEditor(block)}>Configurar</button>
                    <button className="btn btn-small btn-clone" onClick={() => handleCloneBlock(block)}>Clonar</button>
                    <button className="btn btn-small btn-delete" onClick={() => handleDeleteBlock(block.id)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {navState && (
        <div className="configurar-bloque" style={{display:'flex',flexDirection:'column',height:'100%',background:'white'}}>
          <div className="bloque-header" style={{padding:'15px 20px',borderBottom:'2px solid #FF9500'}}>
            <button className="back-btn" onClick={goBackFromBlock}>← Volver</button>
            <h2 style={{margin:'0 0 0 10px',color:'#FF9500'}}>{editingBlock ? editingBlock.name : 'Nuevo Bloque'}</h2>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div style={{flex:1,overflowY:'auto',padding:'15px 20px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
              <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
                <label style={{fontSize:'0.9rem',fontWeight:'500',color:'#555'}}>Nombre del Bloque *</label>
                <input type="text" value={blockEditor.name} onChange={(e)=>setBlockEditor({...blockEditor, name:e.target.value})} style={{padding:'0.5rem 0.6rem'}} />
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
                <label style={{fontSize:'0.9rem',fontWeight:'500',color:'#555'}}>Duración (segundos) *</label>
                <input type="number" min="1" max="300" value={blockEditor.duration} onChange={(e)=>setBlockEditor({...blockEditor, duration:e.target.value})} style={{padding:'0.5rem 0.6rem'}} />
              </div>

              <h4 style={{marginTop:'1rem',color:'#333'}}>Contexto del Experimento</h4>
              <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
                <label style={{fontSize:'0.9rem',fontWeight:'500',color:'#555'}}>Libro (opcional)</label>
                <select value={blockEditor.bookId} onChange={(e)=>setBlockEditor({...blockEditor, bookId:e.target.value})} style={{padding:'0.5rem 0.6rem'}}>
                  <option value="">-- Seleccionar libro --</option>
                  {libros.map((libro) => (
                    <option key={libro.id} value={libro.id}>{libro.title || libro.name}</option>
                  ))}
                </select>
              </div>
              {blockEditor.bookId && (
                <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
                  <label style={{fontSize:'0.9rem',fontWeight:'500',color:'#555'}}>Página del Libro</label>
                  <input type="number" min="1" value={blockEditor.pageNumber} onChange={(e)=>setBlockEditor({...blockEditor, pageNumber:e.target.value})} style={{padding:'0.5rem 0.6rem'}} />
                </div>
              )}

              <h4 style={{marginTop:'1rem',color:'#333'}}>Configuración de Estímulos</h4>
              <div className="stimuli-grid">
                <label className="stimuli-checkbox">
                  <input type="checkbox" checked={blockEditor.config.vibrationEnabled} onChange={(e)=>setBlockEditor({...blockEditor, config:{...blockEditor.config, vibrationEnabled:e.target.checked}})} />
                  <span className="checkbox-label">🔊 Vibración</span>
                </label>
                <label className="stimuli-checkbox">
                  <input type="checkbox" checked={blockEditor.config.auditoryEnabled} onChange={(e)=>setBlockEditor({...blockEditor, config:{...blockEditor.config, auditoryEnabled:e.target.checked}})} />
                  <span className="checkbox-label">🔔 Auditivo</span>
                </label>
                <label className="stimuli-checkbox">
                  <input type="checkbox" checked={blockEditor.config.visualEnabled} onChange={(e)=>setBlockEditor({...blockEditor, config:{...blockEditor.config, visualEnabled:e.target.checked}})} />
                  <span className="checkbox-label">👁️ Visual</span>
                </label>
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:'0.8rem'}}>
                <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
                  <label style={{fontSize:'0.9rem',fontWeight:'500',color:'#555'}}>Frecuencia Aleatoria</label>
                  <input type="number" step="0.1" min="0.1" max="10" value={blockEditor.config.randomFrequency} onChange={(e)=>setBlockEditor({...blockEditor, config:{...blockEditor.config, randomFrequency: parseFloat(e.target.value)}})} style={{padding:'0.5rem 0.6rem'}} />
                </div>
                <label className="frequency-mode">
                  <input type="checkbox" checked={blockEditor.config.frequencyCross} onChange={(e)=>setBlockEditor({...blockEditor, config:{...blockEditor.config, frequencyCross:e.target.checked}})} />
                  <span>Cruzar Frecuencias</span>
                </label>
              </div>
            </div>
          </div>

          <div style={{padding:'15px 20px',borderTop:'1px solid #eee',display:'flex',gap:'0.5rem'}}>
            <button className="btn btn-cancel" onClick={goBackFromBlock}>Cancelar</button>
            <button className="btn btn-primary" onClick={saveBlockEditor}>{editingBlock ? 'Guardar Cambios' : 'Crear Bloque'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ COMPONENTE RESULTADOS DE EXPERIMENTO ============

const ExperimentResults = ({ experiment, onBack }) => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runDetails, setRunDetails] = useState(null);

  useEffect(() => {
    fetchRuns();
  }, [experiment.id]);

  const fetchRuns = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/experiments/${experiment.id}/runs`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRuns(data);
      }
    } catch (err) {
      console.error('Error cargando runs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRunDetails = async (runId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/experiment-runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRunDetails(data);
      }
    } catch (err) {
      console.error('Error cargando detalles:', err);
    }
  };

  return (
    <div className="experiment-results-overlay">
      <div className="experiment-results">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem'}}>
          <h2 style={{margin:0}}>📊 Resultados: {experiment.name}</h2>
          <button className="btn btn-cancel" onClick={onBack}>← Volver</button>
        </div>

      {loading ? (
        <p>Cargando resultados...</p>
      ) : runs.length === 0 ? (
        <div style={{textAlign:'center',padding:'3rem',color:'#666'}}>
          <p style={{fontSize:'1.2rem',marginBottom:'0.5rem'}}>📭 Sin ejecuciones</p>
          <p>Este experimento aún no se ha ejecutado. Inicia el experimento para generar datos.</p>
        </div>
      ) : (
        <div style={{display:'flex',gap:'1.5rem'}}>
          {/* Lista de ejecuciones */}
          <div style={{flex:'0 0 300px',borderRight:'1px solid #ddd',paddingRight:'1.5rem'}}>
            <h3 style={{marginTop:0}}>Ejecuciones ({runs.length})</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
              {runs.map(run => (
                <div
                  key={run.id}
                  onClick={() => {
                    setSelectedRun(run.id);
                    fetchRunDetails(run.id);
                  }}
                  style={{
                    padding:'0.8rem',
                    border: selectedRun === run.id ? '2px solid #2196F3' : '1px solid #ddd',
                    borderRadius:'6px',
                    cursor:'pointer',
                    backgroundColor: selectedRun === run.id ? '#E3F2FD' : 'white'
                  }}
                >
                  <div style={{fontWeight:'bold',marginBottom:'0.3rem'}}>
                    Ejecución #{run.id}
                  </div>
                  <div style={{fontSize:'0.85rem',color:'#666'}}>
                    {new Date(run.startedAt).toLocaleString()}
                  </div>
                  <div style={{fontSize:'0.85rem',color: run.status === 'completed' ? 'green' : run.status === 'cancelled' ? 'orange' : 'blue'}}>
                    {run.status === 'completed' ? '✓ Completado' : run.status === 'cancelled' ? '⚠ Cancelado' : '⏳ En curso'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detalles de la ejecución seleccionada */}
          <div style={{flex:1}}>
            {selectedRun && runDetails ? (
              <div>
                <h3>Detalles de Ejecución #{selectedRun}</h3>
                <div style={{marginBottom:'1rem'}}>
                  <p><strong>Estado:</strong> {runDetails.status}</p>
                  <p><strong>Inicio:</strong> {new Date(runDetails.startedAt).toLocaleString()}</p>
                  {runDetails.completedAt && <p><strong>Fin:</strong> {new Date(runDetails.completedAt).toLocaleString()}</p>}
                  {runDetails.duration && <p><strong>Duración:</strong> {runDetails.duration}s</p>}
                </div>

                <h4>Bloques Ejecutados ({runDetails.blocks?.length || 0})</h4>
                <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                  {runDetails.blocks?.map((block, idx) => (
                    <div key={block.id} style={{padding:'0.8rem',border:'1px solid #ddd',borderRadius:'6px',backgroundColor:'#f9f9f9'}}>
                      <div><strong>Bloque {idx + 1}:</strong> {block.blockName || `Bloque ${block.blockNumber}`}</div>
                      {block.bookId && <div style={{fontSize:'0.9rem',color:'#666'}}>📖 Libro: {block.bookId}</div>}
                      <div style={{fontSize:'0.85rem',color:'#666'}}>
                        Inicio: {new Date(block.startedAt).toLocaleTimeString()}
                        {block.completedAt && ` | Fin: ${new Date(block.completedAt).toLocaleTimeString()}`}
                      </div>
                    </div>
                  ))}
                </div>

                {runDetails.data && runDetails.data.length > 0 && (
                  <>
                    <h4 style={{marginTop:'1.5rem'}}>Datos Capturados ({runDetails.data.length})</h4>
                    <div style={{maxHeight:'300px',overflow:'auto',border:'1px solid #ddd',borderRadius:'6px',padding:'0.5rem'}}>
                      {runDetails.data.map((d, idx) => (
                        <div key={idx} style={{fontSize:'0.85rem',padding:'0.3rem',borderBottom:'1px solid #eee'}}>
                          <strong>{d.dataType}:</strong> {d.data}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{textAlign:'center',color:'#999',padding:'2rem'}}>
                Selecciona una ejecución para ver sus detalles
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default ConfigurarExperimentos;

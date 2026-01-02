import React, { useState, useEffect } from 'react';
import './ConfigurarExperimentos.css';

// ============ COMPONENTE LISTA DE EXPERIMENTOS ============

const ConfigurarExperimentos = ({ userData, onClose }) => {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedExperiment, setSelectedExperiment] = useState(null);

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
  const [isNavigating, setIsNavigating] = useState(false);

  // Editor de bloque (crear/editar + configuración)
  const [editingBlock, setEditingBlock] = useState(null);
  const [blockEditor, setBlockEditor] = useState({
    name: '',
    duration: 5,
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
    } else {
      setBlocks([]);
    }
  }, [expState.id]);

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
    setIsNavigating(true);

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
        setBlockEditor({ name: block.name, duration: block.duration, config: cfg });
      } catch {}
    } else {
      setBlockEditor({
        name: '',
        duration: 5,
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

    setTimeout(() => {
      setNavState(block?.id || 'new');
      setIsNavigating(false);
    }, 300);
  };

  const goBackFromBlock = () => {
    setIsNavigating(true);
    setTimeout(() => {
      setNavState(null);
      setIsNavigating(false);
    }, 300);
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
          body: JSON.stringify({ blockNumber, name: blockEditor.name, duration: parseInt(blockEditor.duration) }),
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
          body: JSON.stringify({ name: blockEditor.name, duration: parseInt(blockEditor.duration) }),
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
          duration: block.duration
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
    <div className="configurar-experimento" style={{position:'relative',overflow:'hidden'}}>
      {!navState && (
        <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
          <button className="back-btn" onClick={onBack}>← Volver</button>
          
          <div className="exp-inline-editor" style={{display:'flex',flexDirection:'column',gap:'0.5rem',flex:1}}>
            {!isEditingExperiment ? (
              <>
                <div style={{display:'flex',alignItems:'center',gap:'0.8rem'}}>
                  <h2 style={{margin:0,fontSize:'1.5rem',color:'#333',fontWeight:'600'}}>
                    {expState.name || 'Sin nombre'}
                  </h2>
                  <button className="btn btn-small btn-edit" onClick={()=>setIsEditingExperiment(true)}>Editar</button>
                </div>
                {expState.description && (
                  <p style={{margin:0,fontSize:'0.95rem',color:'#666',fontStyle:'italic'}}>
                    {expState.description}
                  </p>
                )}
              </>
            ) : (
              <>
                <div style={{display:'flex',flexDirection:'column',gap:'0.8rem'}}>
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
              </>
            )}
          </div>

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
            <div className="blocks-list">
              {blocks.map((block) => (
                <div key={block.id} className="block-card">
                  <div className="block-info">
                    <h4>Bloque {block.blockNumber}</h4>
                    <p className="block-name">{block.name}</p>
                    <p className="block-duration">Duración: {block.duration}s</p>
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
        <div className={`configurar-bloque ${!isNavigating ? 'view-enter' : 'view-exit'}`} style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'white',zIndex:10,display:'flex',flexDirection:'column'}}>
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

export default ConfigurarExperimentos;

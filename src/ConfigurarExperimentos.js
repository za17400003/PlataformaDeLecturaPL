import React, { useState, useEffect, useRef } from 'react';
import './ConfigurarExperimentos.css';
import TabDatos from './components/TabDatos';
import TabVideos from './components/TabVideos';
import ExperimentSelector from './components/ExperimentSelector';
import TabSelector from './components/TabSelector';

// ============ UTILIDADES ============

// Normalizar datos del backend (snake_case) a frontend (camelCase)
const normalizeExperimentData = (exp) => ({
  ...exp
});

// ============ COMPONENTE LISTA DE EXPERIMENTOS ============

const ConfigurarExperimentos = ({ userData, onClose, onStartExperiment }) => {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [isNewExperiment, setIsNewExperiment] = useState(false);
  const [viewingResults, setViewingResults] = useState(null);
  const [showTrash, setShowTrash] = useState(false);
  const [trash, setTrash] = useState([]);
  const [trashLoading, setTrashLoading] = useState(false);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/experiments-v2/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        // Normalizar datos de backend (snake_case) a frontend (camelCase)
        const normalized = data.map(normalizeExperimentData);
        setExperiments(normalized);
      }
    } catch (err) {
      setError('Error al cargar experimentos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrash = async () => {
    try {
      setTrashLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/experiments-v2/trash', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setTrash(data);
      }
    } catch (err) {
      setError('Error al cargar papelera');
      console.error(err);
    } finally {
      setTrashLoading(false);
    }
  };

  const handleCreateExperiment = async () => {
    // Generar nombre automático: "Experimento {fecha-hora}"
    const now = new Date();
    const timestamp = now.toLocaleDateString('es-ES').replace(/\//g, '-') + ' ' + now.toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'});
    const name = `Experimento ${timestamp}`;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/experiments-v2/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: name.trim(), 
          description: 'Nuevo experimento - Configura bloques y parámetros',
          config: {
            num_blocks: 5,
            minutes_per_block: 5.22,
            epubFile: '',
            initial_page: 1,
            quotas: { V: 2, K: 2, A: 2, PST: 3, PFT: 6 },
            stim_blocks: [0, 2, 4]
          }
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const created = await response.json();
        setExperiments([...experiments, created]);
        setSelectedExperiment(created);
        setIsNewExperiment(true); // Abrir en modo edición automático
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
    // Validar SOLO configuración Python (bloques se generan automáticamente desde config.num_blocks)
    const config = typeof exp.config === 'string' ? JSON.parse(exp.config) : exp.config || {};
    
    // Los bloques se generan en memoria, validar que tenga num_blocks válido
    const numBlocks = config.num_blocks || 5; // Default a 5 si no hay
    if (numBlocks < 1) {
      alert('⚠️ Número de bloques debe ser >= 1');
      return;
    }
    
    // Validar que tenga quotas configuradas (con valores por defecto si es necesario)
    const quotas = config.quotas || { V: 2, K: 2, A: 2, PST: 3, PFT: 6 };
    
    // Llamar la función de callback que pasó Biblioteca
    console.log('[ConfigurarExperimentos] handleStartExperiment - Config:', { numBlocks, quotas });
    if (onStartExperiment) {
      onStartExperiment(exp);
      onClose(); // Cerrar el popover de experimentos
    } else {
      console.error('[ConfigurarExperimentos] ERROR: onStartExperiment no está definido!');
    }
  };

  const handleDeleteExperiment = async (expId) => {
    if (!window.confirm('¿Eliminar este experimento? (Puede restaurarse desde papelera)')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/experiments-v2/${expId}`, {
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

  const handleRestoreFromTrash = async (expId) => {
    if (!window.confirm('¿Restaurar este experimento?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/experiments-v2/${expId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });

      if (response.ok) {
        setTrash(trash.filter(e => e.id !== expId));
        setError('');
        await fetchExperiments(); // Refrescar lista principal
      } else {
        setError('Error al restaurar experimento');
      }
    } catch (err) {
      setError('Error al restaurar');
      console.error(err);
    }
  };

  if (selectedExperiment) {
    return (
      <ConfigurarExperimento
        experiment={selectedExperiment}
        userData={userData}
        isNewExperiment={isNewExperiment}
        onBack={() => {
          setSelectedExperiment(null);
          setIsNewExperiment(false);
          fetchExperiments();
        }}
        onExperimentUpdated={fetchExperiments}
        onStartExperiment={onStartExperiment}
      />
    );
  }

  if (viewingResults) {
    return <ExperimentResults experiment={viewingResults} onBack={() => setViewingResults(null)} />;
  }

  // Vista de papelera
  if (showTrash) {
    const handleEmptyTrash = async () => {
      if (!window.confirm('⚠️ ¿Vaciar TODA la papelera? Los experimentos no se podrán recuperar.')) {
        return;
      }
      
      try {
        setError('');
        setTrashLoading(true);
        const token = localStorage.getItem('authToken');
        
        // Borrar todos los experimentos en papelera
        const deletePromises = trash.map(exp =>
          fetch(`/api/experiments-v2/${exp.id}/permanently-delete`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
          })
        );
        
        await Promise.all(deletePromises);
        setTrash([]);
      } catch (err) {
        setError('Error al vaciar papelera: ' + err.message);
        console.error(err);
      } finally {
        setTrashLoading(false);
      }
    };
    
    return (
      <div className="configurar-experimentos">
        <h2 style={{margin:'0 0 1rem 0',color:'#333'}}>🗑️ Papelera</h2>

        <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
          <button className="btn btn-secondary" onClick={() => { setShowTrash(false); setTrash([]); }}>
            ← Volver a Mis Experimentos
          </button>
          <button 
            className="btn btn-danger" 
            onClick={handleEmptyTrash}
            disabled={trashLoading}
            style={{backgroundColor:'#f44336'}}
          >
            🗑️ Vaciar Papelera ({trash.length})
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Mensaje informativo */}
        <div style={{backgroundColor:'#e3f2fd',border:'1px solid #90caf9',borderRadius:'6px',padding:'0.8rem',marginBottom:'1rem'}}>
          <p style={{margin:'0',fontSize:'0.9rem',color:'#1976d2'}}>
            💡 <strong>Solo los últimos 5 experimentos se guardan en la papelera.</strong> Los más antiguos se eliminarán permanentemente de forma automática.
          </p>
        </div>

        {trashLoading ? (
          <p className="loading">Cargando papelera...</p>
        ) : trash.length === 0 ? (
          <p className="empty-message">La papelera está vacía.</p>
        ) : (
          <div className="experimentos-list">
            {trash.map((exp, idx) => (
              <div key={exp.id} className="experimento-card" style={{opacity: 0.7}}>
                <div className="experimento-info">
                  <h3>{exp.name || '(sin nombre)'}</h3>
                  <p className="exp-desc" style={{fontSize:'0.85rem', color:'#999'}}>
                    🗑️ Eliminado: {exp.deletedAt ? new Date(exp.deletedAt).toLocaleString() : 'Fecha desconocida'}
                  </p>
                </div>
                <div className="experimento-actions">
                  <button
                    className="btn btn-small btn-success"
                    onClick={() => handleRestoreFromTrash(exp.id)}
                  >
                    ↻ Restaurar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="configurar-experimentos">
      <h2 style={{margin:'0 0 1rem 0',color:'#333'}}>Mis Experimentos</h2>

      {error && <div className="error-message">{error}</div>}

      <div style={{display:'flex', gap:'0.5rem', marginBottom:'1rem'}}>
        <button className="btn btn-primary" onClick={handleCreateExperiment}>
          + Crear Experimento
        </button>
        <button className="btn btn-secondary" onClick={() => { fetchTrash(); setShowTrash(true); }}>
          🗑️ Papelera
        </button>
      </div>

      {loading ? (
        <p className="loading">Cargando experimentos...</p>
      ) : experiments.length === 0 ? (
        <p className="empty-message">No hay experimentos. Crea uno nuevo.</p>
      ) : (
        <div className="experimentos-list">
          {experiments.map((exp, idx) => (
            <div key={exp.id} className="experimento-card">
              <div className="experimento-info">
                <h3 className="exp-name-display">{exp.name || '(sin nombre)'}</h3>
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

const ConfigurarExperimento = ({ experiment, userData, isNewExperiment, onBack, onExperimentUpdated, onStartExperiment }) => {
  const [expState, setExpState] = useState(experiment);
  const [experimentForm, setExperimentForm] = useState({ name: experiment.name || '', description: experiment.description || '' });
  const [isEditingExperiment, setIsEditingExperiment] = useState(isNewExperiment === true); // Auto-editar si es nuevo
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

  // Actualizar expState cuando la prop experiment cambia
  useEffect(() => {
    console.log('[ConfigurarExperimento] experiment prop cambió:', experiment);
    console.log('[ConfigurarExperimento] experiment.id:', experiment.id);
    console.log('[ConfigurarExperimento] experiment.config:', experiment.config);
    const normalized = normalizeExperimentData(experiment);
    setExpState(normalized);
    setExperimentForm({ name: normalized.name || '', description: normalized.description || '' });
  }, [experiment.id]);

  useEffect(() => {
    setExperimentForm({ name: expState.name || '', description: expState.description || '' });
    if (expState.id) {
      // fetchBlocks() eliminado - los bloques se generan en memoria desde config.num_blocks
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

  const handleSaveExperiment = async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!expState.id) {
        // CREATE
        const resp = await fetch('/api/experiments-v2/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            name: experimentForm.name,
            description: experimentForm.description,
            config: expState.config
          }),
          credentials: 'include'
        });
        
        if (!resp.ok) {
          setError('Error al crear experimento');
          return;
        }
        
        const created = await resp.json();
        const normalized = normalizeExperimentData(created);
        setExpState(normalized);
        onExperimentUpdated && onExperimentUpdated();
      } else {
        // UPDATE
        const respU = await fetch(`/api/experiments-v2/${expState.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            name: experimentForm.name,
            description: experimentForm.description,
            config: expState.config
          }),
          credentials: 'include'
        });
        
        if (!respU.ok) {
          setError('Error al actualizar experimento');
          return;
        }
        
        const updated = await respU.json();
        const normalized = normalizeExperimentData(updated);
        setExpState(normalized);
        onExperimentUpdated && onExperimentUpdated();
      }
      
      setIsEditingExperiment(false);
      setError('');
    } catch (err) {
      setError('Error al guardar experimento');
      console.error(err);
    }
  };

  // fetchBlocks() ELIMINADA - Los bloques se generan en memoria desde config.num_blocks
  // Ya no hay endpoints de bloques individuales

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
        const resp = await fetch(`/api/experiments-v2/${expState.id}/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ 
            block_number: blockNumber, 
            name: blockEditor.name, 
            duration_minutes: parseInt(blockEditor.duration),
            book_id: blockEditor.bookId || null,
            page_number: blockEditor.pageNumber ? parseInt(blockEditor.pageNumber) : 1
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
        const respUp = await fetch(`/api/experiments-v2/blocks/${blockId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ 
            name: blockEditor.name, 
            duration_minutes: parseInt(blockEditor.duration),
            book_id: blockEditor.bookId || null,
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
      // fetchBlocks() eliminada - bloques se generan en memoria
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
        `/api/experiments-v2/blocks/${blockId}`,
        { 
          method: 'DELETE', 
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include' 
        }
      );

      if (response.ok) {
        // fetchBlocks() eliminada - bloques se generan en memoria
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
      const createResponse = await fetch(`/api/experiments-v2/${experiment.id}/blocks`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          block_number: blockNumber,
          name: `${block.name} (copia)`,
          duration_minutes: block.duration_minutes,
          book_id: block.book_id || null,
          page_number: block.page_number || 1
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

        // fetchBlocks() eliminada - bloques se generan en memoria
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
              <div style={{display:'flex',flexDirection:'column',gap:'0.3rem',flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'0.8rem'}}>
                  <h2 style={{margin:0,fontSize:'1.3rem',color:'#333',fontWeight:'600',flex:1}}>
                    {expState.name || 'Sin nombre'}
                  </h2>
                  <button className="btn btn-small btn-edit" onClick={()=>setIsEditingExperiment(true)}>Editar</button>
                </div>
                {expState.description && (
                  <p style={{margin:0,fontSize:'0.9rem',color:'#666',fontStyle:'italic'}}>
                    {expState.description}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {isEditingExperiment && (
            <div style={{display:'flex',flexDirection:'column',gap:'0.15rem'}}>
              <input type="text" value={experimentForm.name} onChange={(e)=>setExperimentForm({...experimentForm,name:e.target.value})} placeholder="Título" style={{padding:'0.2rem 0.3rem',fontSize:'0.75rem'}} />
              <input type="text" value={experimentForm.description} onChange={(e)=>setExperimentForm({...experimentForm,description:e.target.value})} placeholder="Descripción" style={{padding:'0.2rem 0.3rem',fontSize:'0.75rem'}} />
              
              {/* CAMPOS DE LIBROS - AFUERA DE EXPERIMENTCONFIGSECTION */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.2rem',marginTop:'0.2rem',padding:'0.2rem',backgroundColor:'#f9f9f9',borderRadius:'3px'}}>
                <BookSelector 
                  experiment={expState}
                  token={localStorage.getItem('authToken')}
                  onConfigUpdated={(newConfig) => {setExpState({...expState, config: newConfig});}}
                />
              </div>
              
              <ExperimentConfigSection experiment={expState} token={localStorage.getItem('authToken')} isNewExperiment={isNewExperiment} inlineMode={true} onConfigUpdated={(newConfig) => {setExpState({...expState, config: newConfig});}} />
              <div style={{display:'flex',gap:'0.2rem',marginTop:'0.2rem'}}>
                <button className="btn btn-primary" onClick={handleSaveExperiment} style={{fontSize:'0.7rem',padding:'0.2rem 0.4rem',flex:1}}>Guardar</button>
                <button className="btn btn-cancel" onClick={()=>{ setExperimentForm({name: expState.name || '', description: expState.description || ''}); setIsEditingExperiment(false); }} style={{fontSize:'0.7rem',padding:'0.2rem 0.4rem',flex:1}}>Cancelar</button>
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          {(() => {
            const shouldShow = expState.id && !isEditingExperiment;
            console.log('[ConfigurarExperimento RENDER] Botón Iniciar shouldShow:', shouldShow, 'expState.id:', expState.id, 'isEditingExperiment:', isEditingExperiment);
            return shouldShow ? (
              <div style={{display:'flex',gap:'0.5rem',marginBottom:'1rem'}}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    console.log('[ConfigurarExperimento] Botón Iniciar presionado. expState:', expState);
                    console.log('[ConfigurarExperimento] expState.config:', expState.config);
                    console.log('[ConfigurarExperimento] onStartExperiment función:', typeof onStartExperiment);
                    if (onStartExperiment) {
                      onStartExperiment(expState);
                    } else {
                      console.error('[ConfigurarExperimento] ERROR: onStartExperiment no definido!');
                    }
                  }}
                  style={{fontSize:'1rem',padding:'0.7rem 1rem'}}
                >
                  ▶ Iniciar Experimento
                </button>
              </div>
            ) : null;
          })()}

          {/* SECCIÓN DE CONFIGURACIÓN DE EXPERIMENTO - VISTA LECTURA */}
          {expState.id && !isEditingExperiment && (
            <>
              <ExperimentConfigSection 
                experiment={expState} 
                token={localStorage.getItem('authToken')}
                isNewExperiment={isNewExperiment}
              />
            </>
          )}

          {/* Los bloques se generan automáticamente desde config.num_blocks */}

          {loading ? (
            <p className="loading">Preparando bloques...</p>
          ) : blocks.length === 0 ? null : (
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
  const [activeTab, setActiveTab] = useState('datos');

  useEffect(() => {
    fetchRuns();
  }, [experiment.id]);

  const fetchRuns = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/experiments-v2/${experiment.id}/runs`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setRuns(data);
        if (data.length > 0) {
          setSelectedRun(data[0]);
        }
      }
    } catch (err) {
      console.error('Error cargando runs:', err);
    } finally {
      setLoading(false);
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
            
            {selectedRun && (
              <>
                {activeTab === 'datos' && <TabDatos runId={selectedRun.id} />}
                {activeTab === 'videos' && <TabVideos runId={selectedRun.id} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ============ COMPONENTE CONFIGURACIÓN DE EXPERIMENTO ============

const ExperimentConfigSection = ({ experiment, token, isNewExperiment, inlineMode = false, onConfigUpdated }) => {
  const [editMode, setEditMode] = useState(false);
  const [editConfig, setEditConfig] = useState(null);
  const [error, setError] = useState('');
  const [availableBooks, setAvailableBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Cargar libros disponibles
  useEffect(() => {
    const loadBooks = async () => {
      try {
        setBooksLoading(true);
        const response = await fetch('/api/books', {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        if (response.ok) {
          const books = await response.json();
          setAvailableBooks(books);
        }
      } catch (err) {
        console.error('Error loading books:', err);
      } finally {
        setBooksLoading(false);
      }
    };
    
    if (token) loadBooks();
  }, [token]);

  // Inicializar con config del experimento y abrir en edición si es nuevo
  useEffect(() => {
    if (experiment && experiment.config) {
      const cfg = typeof experiment.config === 'string' ? JSON.parse(experiment.config) : experiment.config;
      setEditConfig(cfg);
      // Abrir en edición si es experimento nuevo
      setEditMode(isNewExperiment === true);
    }
  }, [experiment, isNewExperiment]);

  // Auto-guardar SOLO si NO estamos en modo inline
  useEffect(() => {
    if (!inlineMode && !editMode && editConfig && experiment && experiment.id) {
      // Guardar después de una pequeña pausa para dejar que los cambios se asimilen
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        handleSaveConfig();
      }, 500);
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [editMode, inlineMode]);

  const handleSaveConfig = async () => {
    try {
      // Validar que num_blocks sea válido
      if (!editConfig.num_blocks || editConfig.num_blocks < 1) {
        setError('Número de bloques debe ser >= 1');
        return;
      }
      
      const response = await fetch(`/api/experiments-v2/${experiment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: experiment.name,
          description: experiment.description,
          config: editConfig
        }),
        credentials: 'include'
      });
      
      if (response.ok) {
        setEditMode(false);
        setError('');
        onConfigUpdated && onConfigUpdated(editConfig);
      } else {
        setError('Error al guardar configuración');
      }
    } catch (err) {
      setError('Error al guardar configuración: ' + err.message);
      console.error(err);
    }
  };

  if (!editConfig) {
    return <div style={{padding:'1rem',textAlign:'center',color:'#999'}}>Cargando configuración...</div>;
  }

  // En modo inline, siempre mostrar en edición
  const showEditMode = inlineMode ? true : editMode;

  return (
    <div style={{marginBottom:'1rem',padding:'1rem',backgroundColor:'#f5f5f5',borderRadius:'6px',border:'1px solid #e0e0e0'}}>
      <div style={{marginBottom:'0.8rem'}}>
        <h3 style={{margin:0,fontSize:'1rem',color:'#333',fontWeight:'600'}}>⚙️ Configuración de Experimento</h3>
      </div>

      {error && <div className="error-message" style={{marginBottom:'0.8rem'}}>{error}</div>}

      {!showEditMode ? (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem',fontSize:'0.9rem'}}>
          <div><strong>Bloques:</strong> {editConfig.num_blocks || 5}</div>
          <div><strong>Minutos/Bloque:</strong> {editConfig.minutes_per_block || 5.22}</div>
          <div><strong>Libro:</strong> {editConfig.epubFile ? editConfig.epubFile.split('/').pop().replace('.epub', '') : 'No especificado'}</div>
          <div><strong>Página Inicial:</strong> {editConfig.initial_page || 1}</div>
          <div><strong>Cuota Visual (V):</strong> {editConfig.quotas?.V || 2}</div>
          <div><strong>Cuota Kinética (K):</strong> {editConfig.quotas?.K || 2}</div>
          <div><strong>Cuota Audio (A):</strong> {editConfig.quotas?.A || 2}</div>
          <div><strong>Cuota PST:</strong> {editConfig.quotas?.PST || 3}</div>
          <div><strong>Cuota PFT:</strong> {editConfig.quotas?.PFT || 6}</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'0.8rem'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
              <label style={{fontSize:'0.85rem',fontWeight:'500'}}>Número de Bloques</label>
              <input
                type="number"
                min="1"
                max="10"
                value={editConfig.num_blocks || 5}
                onChange={(e)=>setEditConfig({...editConfig,num_blocks:parseInt(e.target.value)})}
                style={{padding:'0.4rem 0.6rem',fontSize:'0.9rem'}}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
              <label style={{fontSize:'0.85rem',fontWeight:'500'}}>Minutos por Bloque</label>
              <input
                type="number"
                min="1"
                max="30"
                step="0.01"
                value={editConfig.minutes_per_block || 5.22}
                onChange={(e)=>setEditConfig({...editConfig,minutes_per_block:parseFloat(e.target.value)})}
                style={{padding:'0.4rem 0.6rem',fontSize:'0.9rem'}}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
              <label style={{fontSize:'0.85rem',fontWeight:'500'}}>Cuota Visual (V)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={editConfig.quotas?.V || 2}
                onChange={(e)=>setEditConfig({...editConfig,quotas:{...editConfig.quotas,V:parseInt(e.target.value)}})}
                style={{padding:'0.4rem 0.6rem',fontSize:'0.9rem'}}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
              <label style={{fontSize:'0.85rem',fontWeight:'500'}}>Cuota Kinética (K)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={editConfig.quotas?.K || 2}
                onChange={(e)=>setEditConfig({...editConfig,quotas:{...editConfig.quotas,K:parseInt(e.target.value)}})}
                style={{padding:'0.4rem 0.6rem',fontSize:'0.9rem'}}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
              <label style={{fontSize:'0.85rem',fontWeight:'500'}}>Cuota Audio (A)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={editConfig.quotas?.A || 2}
                onChange={(e)=>setEditConfig({...editConfig,quotas:{...editConfig.quotas,A:parseInt(e.target.value)}})}
                style={{padding:'0.4rem 0.6rem',fontSize:'0.9rem'}}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
              <label style={{fontSize:'0.85rem',fontWeight:'500'}}>Cuota PST</label>
              <input
                type="number"
                min="0"
                max="10"
                value={editConfig.quotas?.PST || 3}
                onChange={(e)=>setEditConfig({...editConfig,quotas:{...editConfig.quotas,PST:parseInt(e.target.value)}})}
                style={{padding:'0.4rem 0.6rem',fontSize:'0.9rem'}}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
              <label style={{fontSize:'0.85rem',fontWeight:'500'}}>Cuota Audio (A)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={editConfig.quotas?.A || 2}
                onChange={(e)=>setEditConfig({...editConfig,quotas:{...editConfig.quotas,A:parseInt(e.target.value)}})}
                style={{padding:'0.4rem 0.6rem',fontSize:'0.9rem'}}
              />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.3rem'}}>
              <label style={{fontSize:'0.85rem',fontWeight:'500'}}>Cuota PFT</label>
              <input
                type="number"
                min="0"
                max="10"
                value={editConfig.quotas?.PFT || 6}
                onChange={(e)=>setEditConfig({...editConfig,quotas:{...editConfig.quotas,PFT:parseInt(e.target.value)}})}
                style={{padding:'0.4rem 0.6rem',fontSize:'0.9rem'}}
              />
            </div>
          </div>
        </div>
      )}

      {/* Botones de edición removidos - usar el Editar de arriba en el título */}
    </div>
  );
};

// ============ COMPONENTE SELECTOR DE LIBROS ============
const BookSelector = ({ experiment, token, onConfigUpdated }) => {
  const [availableBooks, setAvailableBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [editConfig, setEditConfig] = useState(null);

  // Cargar libros disponibles
  useEffect(() => {
    const loadBooks = async () => {
      try {
        setBooksLoading(true);
        const response = await fetch('/api/books', {
          headers: { 'Authorization': `Bearer ${token}` },
          credentials: 'include'
        });
        if (response.ok) {
          const books = await response.json();
          setAvailableBooks(books);
        }
      } catch (err) {
        console.error('Error loading books:', err);
      } finally {
        setBooksLoading(false);
      }
    };
    
    if (token) loadBooks();
  }, [token]);

  // Inicializar config
  useEffect(() => {
    if (experiment && experiment.config) {
      const cfg = typeof experiment.config === 'string' ? JSON.parse(experiment.config) : experiment.config;
      setEditConfig(cfg);
    }
  }, [experiment]);

  if (!editConfig) return null;

  return (
    <>
      <div style={{display:'flex',flexDirection:'column',gap:'0.2rem',minWidth:'0'}}>
        <label style={{fontSize:'0.8rem',fontWeight:'500',color:'#0066cc'}}>📚 Libro a Leer</label>
        <select
          value={editConfig.epubFile || ''}
          onChange={(e) => {
            const newConfig = {...editConfig, epubFile: e.target.value};
            setEditConfig(newConfig);
            onConfigUpdated && onConfigUpdated(newConfig);
          }}
          style={{padding:'0.3rem 0.5rem',fontSize:'0.85rem',cursor:'pointer',borderRadius:'3px',minWidth:'0'}}
          disabled={booksLoading}
        >
          <option value="">-- Selecciona un libro --</option>
          {availableBooks.map((book) => (
            <option key={book.id || book.name} value={book.path || book.file || book.filePath || book.name}>
              {book.name || book.title || 'Libro sin nombre'}
            </option>
          ))}
        </select>
        {booksLoading && <small style={{color:'#999',fontSize:'0.75rem'}}>Cargando...</small>}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'0.2rem',minWidth:'0'}}>
        <label style={{fontSize:'0.8rem',fontWeight:'500',color:'#0066cc'}}>📖 Página Inicial</label>
        <input
          type="number"
          min="1"
          value={editConfig.initial_page || 1}
          onChange={(e) => {
            const newConfig = {...editConfig, initial_page: parseInt(e.target.value)};
            setEditConfig(newConfig);
            onConfigUpdated && onConfigUpdated(newConfig);
          }}
          style={{padding:'0.3rem 0.5rem',fontSize:'0.85rem',borderRadius:'3px',minWidth:'0'}}
        />
      </div>
    </>
  );
};

export default ConfigurarExperimentos;

import React, { useState, useEffect, useRef } from 'react';

export default function TabVideos({ runId }) {
  const [videos, setVideos] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(0); // 0-indexed para matchear BD
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const [videoDuration, setVideoDuration] = useState(0);

  // Fetch lista de videos Y eventos
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        console.log('[TabVideos] Fetching videos for runId:', runId);
        
        // Fetch videos
        const videoRes = await fetch(`/api/session/${runId}/videos`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('[TabVideos] Response status:', videoRes.status);
        
        if (!videoRes.ok) {
          const errorText = await videoRes.text();
          console.error('[TabVideos] Server error:', {
            status: videoRes.status,
            statusText: videoRes.statusText,
            body: errorText.substring(0, 200)
          });
          throw new Error(`Server error ${videoRes.status}: ${videoRes.statusText}`);
        }
        
        const videoData = await videoRes.json();
        console.log('[TabVideos] Videos loaded:', videoData);
        setVideos(videoData.videos || []);
        
        // Fetch eventos para mostrar en timeline
        const eventsRes = await fetch(`/api/session/${runId}/data/events`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const eventsData = await eventsRes.json();
        setEvents(eventsData.data || []);
        
        if (videoData.videos && videoData.videos.length > 0) {
          // Seleccionar el primer video (usar block_number de la BD que es 0-indexed)
          setSelectedBlock(videoData.videos[0].block_number);
        }
      } catch (err) {
        console.error('[TabVideos] Error:', err);
        setError('Error cargando videos: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [runId]);

  const selectedVideo = videos.find(v => v.block_number === selectedBlock);
  
  // Filtrar eventos para el bloque seleccionado
  // Si block_number es null, mostrar todos los eventos para este bloque
  const blockEvents = events.filter(e => 
    e.block_number === selectedBlock || 
    (selectedBlock === 0 && (e.block_number === null || e.block_number === 0)) ||
    (e.block_number == selectedBlock) // Comparación flexible por si hay tipo numérico vs string
  );

  const downloadVideo = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(
        `/api/session/${runId}/download-video?block=${selectedBlock}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bloque_${selectedBlock}.mp4`;
      a.click();
    } catch (err) {
      console.error('Error downloading video:', err);
    }
  };

  // Cuando click en evento de timeline, ir al tiempo del evento en el video
  const handleEventClick = (event) => {
    if (videoRef.current && videoDuration > 0) {
      // Los timestamps están en ms, convertir a segundos
      const eventTimeSeconds = (event.timestamp_ms || 0) / 1000;
      const normalizedTime = Math.min(eventTimeSeconds, videoDuration);
      videoRef.current.currentTime = normalizedTime;
    }
  };

  // Calcular posición del evento en la timeline (0-100%)
  const getEventPosition = (event) => {
    if (videoDuration === 0) return 0;
    const eventTimeSeconds = (event.timestamp_ms || 0) / 1000;
    return Math.min((eventTimeSeconds / videoDuration) * 100, 100);
  };

  if (loading) return <div style={{padding: '1rem'}}>Cargando videos...</div>;
  if (error) return <div style={{color: 'red', padding: '1rem'}}>{error}</div>;
  if (videos.length === 0) return <div style={{padding: '1rem'}}>No hay videos disponibles.</div>;

  return (
    <div style={{padding: '1rem'}}>
      {/* SELECTOR DE BLOQUES */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        flexWrap: 'wrap'
      }}>
        {videos.map(video => (
          <button
            key={video.block_number}
            onClick={() => setSelectedBlock(video.block_number)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: selectedBlock === video.block_number ? '#007bff' : '#e0e0e0',
              color: selectedBlock === video.block_number ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: selectedBlock === video.block_number ? 'bold' : 'normal'
            }}
          >
            Bloque {video.block_number + 1}
          </button>
        ))}
      </div>

      {/* REPRODUCTOR */}
      {selectedVideo && (
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '1rem',
            marginBottom: '1rem',
            alignItems: 'start'
          }}>
            <div>
              <p><strong>Bloque:</strong> {selectedVideo.block_number + 1}</p>
              <p><strong>Archivo:</strong> {selectedVideo.asset_path.split('/').pop()}</p>
              <p><strong>Tamaño:</strong> {selectedVideo.size_mb} MB</p>
              <p style={{color: '#666', fontSize: '0.9rem'}}>
                📊 {blockEvents.length} evento{blockEvents.length !== 1 ? 's' : ''} en este bloque
              </p>
            </div>
            <button 
              onClick={downloadVideo}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 'bold'
              }}
            >
              📥 Descargar
            </button>
          </div>

          <video
            ref={videoRef}
            controls
            onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
            style={{
              width: '100%',
              maxHeight: '600px',
              backgroundColor: '#000',
              borderRadius: '4px',
              marginBottom: '1rem'
            }}
            src={`/api/session/${runId}/video-stream?block=${selectedBlock}`}
          />

          {/* TIMELINE CON EVENTOS */}
          {blockEvents.length > 0 && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fff',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}>
              <h4 style={{margin: '0 0 1rem 0', fontSize: '0.95rem'}}>
                ⏱️ Timeline de Eventos ({blockEvents.length})
              </h4>
              
              {/* BARRA VISUAL DE TIMELINE */}
              <div style={{
                position: 'relative',
                height: '60px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                marginBottom: '1rem',
                border: '1px solid #ddd',
                overflow: 'hidden'
              }}>
                {/* Línea de progreso */}
                <div style={{
                  position: 'absolute',
                  height: '100%',
                  backgroundColor: 'rgba(0, 150, 200, 0.1)',
                  width: `${videoDuration > 0 && videoRef.current ? (videoRef.current.currentTime / videoDuration) * 100 : 0}%`,
                  transition: 'width 0.1s linear',
                  zIndex: 1
                }} />
                
                {/* Puntos de eventos */}
                {blockEvents.map((event, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleEventClick(event)}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${getEventPosition(event)}%`,
                      transform: 'translate(-50%, -50%)',
                      cursor: 'pointer',
                      zIndex: 2,
                      transition: 'all 0.2s ease'
                    }}
                    title={`${event.event_type}: ${new Date(event.timestamp_ms).toLocaleTimeString()}`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translate(-50%, -50%)';
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      backgroundColor: getEventColorByType(event.event_type),
                      borderRadius: '50%',
                      border: '2px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }} />
                  </div>
                ))}
              </div>

              {/* LEYENDA Y LISTA DE EVENTOS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                fontSize: '0.85rem'
              }}>
                <div>
                  <h5 style={{margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: 'bold'}}>
                    Leyenda de Eventos:
                  </h5>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '0.3rem'}}>
                    {['page_change', 'fixation', 'saccade', 'blink', 'pause'].map(type => (
                      <div key={type} style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          backgroundColor: getEventColorByType(type),
                          borderRadius: '50%'
                        }} />
                        <span>{type.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 style={{margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: 'bold'}}>
                    Eventos en este bloque:
                  </h5>
                  <div style={{
                    maxHeight: '150px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem'
                  }}>
                    {blockEvents.map((event, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleEventClick(event)}
                        style={{
                          padding: '0.4rem 0.6rem',
                          backgroundColor: getEventColorByType(event.event_type) + '20',
                          border: `1px solid ${getEventColorByType(event.event_type)}`,
                          borderRadius: '3px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = getEventColorByType(event.event_type) + '40';
                          e.currentTarget.style.fontWeight = 'bold';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = getEventColorByType(event.event_type) + '20';
                          e.currentTarget.style.fontWeight = 'normal';
                        }}
                      >
                        <strong>{event.event_type}</strong> @ {(event.timestamp_ms / 1000).toFixed(2)}s
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Función auxiliar para asignar colores por tipo de evento
function getEventColorByType(eventType) {
  const colors = {
    'page_change': '#FF6B6B',   // Rojo
    'fixation': '#4ECDC4',      // Cyan
    'saccade': '#45B7D1',       // Azul
    'blink': '#96CEB4',         // Verde
    'pause': '#FFEAA7'          // Amarillo
  };
  return colors[eventType] || '#999';
}

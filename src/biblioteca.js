import React, { useState, useEffect } from 'react';
import './biblioteca.css';
import ePub from 'epubjs';

import nubeBlanca from './assets/nube.png';
import nubeSoplonaIzq from './assets/nubesoplonaizq.png';
import nubeSoplonaDer from './assets/nubesoplonader.png';
import flechaIzq from './assets/flechaizq.png';
import flechaDer from './assets/flechader.png';
import LectorSimple from './LectorSimple';

function Biblioteca() {
  const [libros, setLibros] = useState([]);
  const [portadas, setPortadas] = useState([]);
  const [nubeActiva, setNubeActiva] = useState(null);
  const [deslizarDireccion, setDeslizarDireccion] = useState(null);
  const [paginaActual, setPaginaActual] = useState(0);
  const [libroSeleccionado, setLibroSeleccionado] = useState(null);
  const [cargandoPortadas, setCargandoPortadas] = useState(false);
  const [paginationInfo, setPaginationInfo] = useState(null);
  const librosPorPagina = 6;

  useEffect(() => {
    const cargarPagina = async (pageNumber) => {
      console.log(`Cargando página ${pageNumber}...`);
      setCargandoPortadas(true);
      
      try {
        const res = await fetch(`/api/libros?page=${pageNumber}&limit=${librosPorPagina}`);
        
        if (!res.ok) {
          throw new Error(`Error del servidor: ${res.status}`);
        }

        const data = await res.json();
        console.log('Datos recibidos:', data);

        setLibros(data.books || []);
        setPaginationInfo(data.pagination);
        
        // Cargar solo las portadas de los libros de esta página
        const resultados = await Promise.all(
          (data.books || []).map(async (libro) => {
            try {
              console.log('Cargando libro:', libro.archivo);
              const epub = ePub(libro.archivo);
              await epub.ready;

              let tituloReal = libro.titulo;
              let portada = null;

              try {
                tituloReal = epub.package?.metadata?.title || libro.titulo;
                const coverUrl = await epub.loaded.cover;
                
                if (coverUrl) {
                  portada = await epub.archive.createUrl(coverUrl, { base64: true });
                  console.log('Portada cargada para:', libro.titulo);
                }
              } catch (error) {
                console.error('Error al cargar metadatos/portada:', error);
              }

              return { titulo: tituloReal, portada, archivo: libro.archivo };
            } catch (error) {
              console.error(`Error al cargar ${libro.archivo}:`, error);
              return { titulo: libro.titulo, portada: null, archivo: libro.archivo };
            }
          })
        );
        
        setPortadas(resultados);
      } catch (err) {
        console.error('Error al cargar página:', err);
        setLibros([]);
        setPortadas([]);
      } finally {
        setCargandoPortadas(false);
      }
    };

    cargarPagina(paginaActual);
  }, [paginaActual, librosPorPagina]);

  const activarAnimacion = (direccion) => {
    setNubeActiva(direccion);
    setTimeout(() => {
      setNubeActiva(null);
      setDeslizarDireccion(null);
    }, 1200);
  };

  const avanzarPagina = () => {
    console.log('avanzarPagina llamada:', { paginationInfo, paginaActual });
    if (paginationInfo) {
      if (paginationInfo.hasNextPage) {
        console.log('Avanzando a página siguiente...');
        setDeslizarDireccion('derecha');
        activarAnimacion('izquierda'); // Nube soplando hacia la izquierda
        setTimeout(() => {
          setPaginaActual(prev => prev + 1);
        }, 1200);
      } else {
        // Navegación circular: ir al principio
        console.log('Final alcanzado, volviendo al principio...');
        setDeslizarDireccion('derecha');
        activarAnimacion('izquierda'); // Nube soplando hacia la izquierda
        setTimeout(() => {
          setPaginaActual(0);
        }, 1200);
      }
    }
  };

  const retrocederPagina = () => {
    console.log('retrocederPagina llamada:', { paginationInfo, paginaActual });
    if (paginationInfo) {
      if (paginationInfo.hasPrevPage) {
        console.log('Retrocediendo a página anterior...');
        setDeslizarDireccion('izquierda');
        activarAnimacion('derecha'); // Nube soplando hacia la derecha
        setTimeout(() => {
          setPaginaActual(prev => prev - 1);
        }, 1200);
      } else {
        // Navegación circular: ir al final
        console.log('Principio alcanzado, yendo al final...');
        setDeslizarDireccion('izquierda');
        activarAnimacion('derecha'); // Nube soplando hacia la derecha
        setTimeout(() => {
          setPaginaActual(paginationInfo.totalPages - 1);
        }, 1200);
      }
    }
  };

  console.log('Estado actual:', {
    libros: libros.length,
    portadas: portadas.length,
    paginaActual,
    paginationInfo,
    cargandoPortadas
  });

  return (
    <div className="Biblioteca fade-in">
      <div className="Titulo-biblioteca-container">
        <h2 className="Titulo-biblioteca">
          <span className="Titulo-nube">☁️</span>
          <span className="Titulo-texto">Biblioteca</span>
          <span className="Titulo-nube">☁️</span>
        </h2>
      </div>

      <div className="Contenedor-nubes">
        {nubeActiva === 'izquierda' && (
          <img
            src={nubeSoplonaIzq}
            alt="Nube soplando izquierda"
            className="Nube-cian izquierda animar"
          />
        )}
        {nubeActiva === 'derecha' && (
          <img
            src={nubeSoplonaDer}
            alt="Nube soplando derecha"
            className="Nube-cian derecha animar"
          />
        )}

        <div className="Nubes-blancas">
          {/* Skeleton placeholders mientras se cargan los libros */}
          {cargandoPortadas && (
            <>
              {Array.from({ length: librosPorPagina }).map((_, i) => (
                <div key={`sk-${i}`} className="Libro-nube" style={{ cursor: 'default', '--float-duration': '4s', '--float-delay': '0s' }}>
                  <div className="Nube-blanca Skeleton-card">
                    <div className="Skeleton-title" />
                  </div>
                </div>
              ))}
            </>
          )}

          {!cargandoPortadas && portadas.length > 0 && portadas.map((libro, index) => {
            const duration = 4 + (index % 3);
            const delay = (index % 3) * 0.15;
            return (
              <div
                key={index}
                className={`Libro-nube ${deslizarDireccion === 'derecha' ? 'deslizar-derecha' : ''} ${deslizarDireccion === 'izquierda' ? 'deslizar-izquierda' : ''}`}
                onClick={() => setLibroSeleccionado(libro.archivo)}
                style={{ cursor: 'pointer', '--float-duration': `${duration}s`, '--float-delay': `${delay}s` }}
              >
                <div
                  className="Nube-blanca"
                  style={{ backgroundImage: `url(${nubeBlanca})` }}
                >
                  {libro.portada ? (
                    <img
                      src={libro.portada}
                      alt={`Portada de ${libro.titulo}`}
                      className="Portada"
                    />
                  ) : (
                    <div className="Error-libro">Sin portada</div>
                  )}
                </div>
                <h3 className="Titulo-libro">{libro.titulo}</h3>
              </div>
            );
          })}
        </div>

        <div className="Flechas-navegacion">
          <img
            src={flechaIzq}
            alt="Flecha izquierda"
            className="Flecha animable"
            onClick={retrocederPagina}
          />
          <img
            src={flechaDer}
            alt="Flecha derecha"
            className="Flecha animable"
            onClick={avanzarPagina}
          />
        </div>
      </div>

      {/* agregado: Lector modal */}
      {libroSeleccionado && (
        <LectorSimple archivo={libroSeleccionado} onClose={() => setLibroSeleccionado(null)} />
      )}
    </div>
  );
}

export default Biblioteca;
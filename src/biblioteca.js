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
  const [libroSeleccionado, setLibroSeleccionado] = useState(null); // agregado: libro abierto
  const librosPorPagina = 6;

  useEffect(() => {
    const cargarLibros = async () => {
      console.log('Solicitando lista de libros al servidor...');
      try {
  const res = await fetch('http://localhost:3001/api/libros');
        console.log('Respuesta recibida:', res.status);
        console.log('Headers:', res.headers);

        if (!res.ok) {
          throw new Error(`Error del servidor: ${res.status}`);
        }

        const data = await res.text();
        console.log('Respuesta cruda:', data);

        if (!data) {
          console.error('Respuesta vacía del servidor');
          return;
        }

        const json = JSON.parse(data);
        console.log('Libros cargados:', json);

        if (Array.isArray(json)) {
          setLibros(json);
        } else {
          console.error('Formato de respuesta inesperado:', json);
        }
      } catch (err) {
        console.error('Error al obtener libros:', err);
        setLibros([]);
      }
    };

    cargarLibros();
  }, []);

  useEffect(() => {
    const cargarPortadasYTitulos = async () => {
      const resultados = await Promise.all(
        libros.map(async (libro) => {
          try {
            console.log('Intentando cargar libro:', libro.archivo);
            const epub = ePub(libro.archivo);
            
            try {
              await epub.ready;
              console.log('Libro cargado correctamente:', libro.titulo);
            } catch (error) {
              console.error('Error en epub.ready:', error);
              throw error;
            }

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
    };

    if (libros.length > 0) {
      cargarPortadasYTitulos();
    }
  }, [libros]);

  const librosVisibles = portadas.slice(
    paginaActual * librosPorPagina,
    (paginaActual + 1) * librosPorPagina
  );

  const activarAnimacion = (direccion) => {
    setNubeActiva(direccion);
    setTimeout(() => {
      setNubeActiva(null);
      setDeslizarDireccion(null);
    }, 1200);
  };

  const avanzarPagina = () => {
    setDeslizarDireccion('derecha');
    activarAnimacion('izquierda');
    setTimeout(() => {
      setPaginaActual(prev => {
        const totalPaginas = Math.ceil(portadas.length / librosPorPagina);
        return prev + 1 >= totalPaginas ? 0 : prev + 1;
      });
    }, 1200);
  };

  const retrocederPagina = () => {
    setDeslizarDireccion('izquierda');
    activarAnimacion('derecha');
    setTimeout(() => {
      setPaginaActual(prev => {
        const totalPaginas = Math.ceil(portadas.length / librosPorPagina);
        return prev - 1 < 0 ? totalPaginas - 1 : prev - 1;
      });
    }, 1200);
  };

  console.log('Estado actual:', {
    libros: libros.length,
    portadas: portadas.length,
    librosPorPagina,
    paginaActual,
    librosVisibles: librosVisibles.length
  });

  return (
    <div className="Biblioteca fade-in">
      <h2 className="Titulo-biblioteca">📚 Biblioteca</h2>

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
          {portadas.length === 0 && (
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

          {portadas.length > 0 && librosVisibles.map((libro, index) => {
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
            onClick={avanzarPagina}
          />
          <img
            src={flechaDer}
            alt="Flecha derecha"
            className="Flecha animable"
            onClick={retrocederPagina}
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
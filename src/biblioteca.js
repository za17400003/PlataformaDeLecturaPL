import React, { useState, useEffect } from 'react';
import './biblioteca.css';
import ePub from 'epubjs';

import nubeBlanca from './assets/nube.png';
import nubeSoplonaIzq from './assets/nubesoplonaizq.png';
import nubeSoplonaDer from './assets/nubesoplonader.png';
import flechaIzq from './assets/flechaizq.png';
import flechaDer from './assets/flechader.png';
import Lector from './Lector'; // agregado: lector

function Biblioteca() {
  const [libros, setLibros] = useState([]);
  const [portadas, setPortadas] = useState([]);
  const [nubeActiva, setNubeActiva] = useState(null);
  const [deslizarDireccion, setDeslizarDireccion] = useState(null);
  const [paginaActual, setPaginaActual] = useState(0);
  const [libroSeleccionado, setLibroSeleccionado] = useState(null); // agregado: libro abierto
  const librosPorPagina = 6;

  useEffect(() => {
    fetch('http://localhost:3001/api/libros')
      .then(res => res.json())
      .then(data => setLibros(data))
      .catch(err => console.error('Error al obtener libros:', err));
  }, []);

  useEffect(() => {
    const cargarPortadasYTitulos = async () => {
      const resultados = await Promise.all(
        libros.map(async (libro) => {
          try {
            const epub = ePub(libro.archivo);
            await epub.ready;

            const tituloReal = epub.package?.metadata?.title || libro.titulo;
            const coverUrl = await epub.loaded.cover;

            let portada = null;
            if (coverUrl) {
              portada = await epub.archive.createUrl(coverUrl, { base64: true });
            }

            // agregado: incluir archivo para poder abrir en el lector
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
          {/* Skeleton placeholders (same DOM structure que las nubes reales) */}
          {portadas.length === 0 && libros.length > 0 && (
            Array.from({ length: librosPorPagina }).map((_, i) => (
              <div key={`sk-${i}`} className="Libro-nube" style={{ cursor: 'default', '--float-duration': '4s', '--float-delay': '0s' }}>
                <div className="Nube-blanca Skeleton-card" />
                <div className="Skeleton-title" />
              </div>
            ))
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
        <Lector archivo={libroSeleccionado} onClose={() => setLibroSeleccionado(null)} />
      )}
    </div>
  );
}

export default Biblioteca;
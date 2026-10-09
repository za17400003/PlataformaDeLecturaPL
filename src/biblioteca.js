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
  const [cargando, setCargando] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState(false);
  const [portadas, setPortadas] = useState([]);
  const [nubeActiva, setNubeActiva] = useState(null);
  const [deslizarDireccion, setDeslizarDireccion] = useState(null);
  const [paginaActual, setPaginaActual] = useState(0);
  const [libroSeleccionado, setLibroSeleccionado] = useState(null); // agregado: libro abierto
  const librosPorPagina = 6;

  useEffect(() => {
    fetch('http://localhost:3001/api/libros')
      .then(res => {
        if (!res.ok) throw new Error('No se pudo cargar el catalogo');
        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('El catalogo no tiene un formato valido');
        setLibros(data);
      })
      .catch(err => {
        console.error('Error al obtener libros:', err);
        setErrorCatalogo(true);
      })
      .finally(() => setCargando(false));
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

  const avanzarPagina = () => {
    if ((paginaActual + 1) * librosPorPagina < portadas.length) {
      setDeslizarDireccion('derecha');
      setNubeActiva('izquierda');

      setTimeout(() => {
        setPaginaActual(prev => prev + 1);
        setNubeActiva(null);
        setDeslizarDireccion(null);
      }, 1200); // espera a que termine la animación
    }
  };

  const retrocederPagina = () => {
    if (paginaActual > 0) {
      setDeslizarDireccion('izquierda');
      setNubeActiva('derecha');

      setTimeout(() => {
        setPaginaActual(prev => prev - 1);
        setNubeActiva(null);
        setDeslizarDireccion(null);
      }, 1200); // espera a que termine la animación
    }
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
          {!cargando && libros.length === 0 && (
            <div className="Estado-vacio" role={errorCatalogo ? 'alert' : 'status'}>
              <h3>{errorCatalogo ? 'No se pudo cargar la biblioteca' : 'Todavia no hay libros'}</h3>
              <p>
                {errorCatalogo
                  ? 'Inicia el servidor local con npm run server y vuelve a intentarlo.'
                  : 'Agrega archivos EPUB con licencia en public/libros para verlos aqui.'}
              </p>
            </div>
          )}

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
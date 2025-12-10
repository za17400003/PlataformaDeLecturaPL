/**
 * BIBLIOTECA - Componente principal que muestra la colección de libros
 * 
 * Características:
 * - Carga libros desde el servidor (paginados de 6 en 6)
 * - Extrae portadas y títulos de archivos EPUB
 * - Navegación entre páginas con animaciones de nubes
 * - Navegación circular (al llegar al final vuelve al inicio)
 * - Abre el lector cuando se selecciona un libro
 */

import React, { useState, useEffect } from 'react';
import './biblioteca.css';
import ePub from 'epubjs';

import nubeBlanca from './assets/nube.png';
import nubeSoplonaIzq from './assets/nubesoplonaizq.png';
import nubeSoplonaDer from './assets/nubesoplonader.png';
import flechaIzq from './assets/flechaizq.png';
import flechaDer from './assets/flechader.png';
import papalote1 from './assets/papalote1.png';
import papalote2 from './assets/papalote2.png';
import papalote3 from './assets/papalote3.png';
import papalote4 from './assets/papalote4.png';
import papalote5 from './assets/papalote5.png';
import papalote6 from './assets/papalote6.png';
import Lector from './Lector';

function Biblioteca({ userData, onLogout }) {
  // ============ ESTADOS ============
  const [libros, setLibros] = useState([]); // Lista de libros actuales
  const [portadas, setPortadas] = useState([]); // Portadas extraídas de los EPUBs
  
  // Estado para popover de desarrollador
  const [showDevPopover, setShowDevPopover] = useState(false);
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ id: null, username: '', password: '', isDeveloper: false });
  const [editMode, setEditMode] = useState(false);
  const [userError, setUserError] = useState('');
  const [nubeActiva, setNubeActiva] = useState(null); // Para animación hover
  const [deslizarDireccion, setDeslizarDireccion] = useState(null); // Para animación de transición
  const [paginaActual, setPaginaActual] = useState(0); // Página actual de libros
  const [libroSeleccionado, setLibroSeleccionado] = useState(null); // Libro abierto en el lector
  const [cargandoPortadas, setCargandoPortadas] = useState(false); // Estado de carga
  const [paginationInfo, setPaginationInfo] = useState(null); // Info de paginación del servidor
  const [papalotesAleatorios, setpapalotesAleatorios] = useState([]); // 3 papalotes aleatorios para grid inferior
  const librosPorPagina = 6; // Constante: 6 libros por página
  const papalotesDisponibles = [papalote1, papalote2, papalote3, papalote4, papalote5, papalote6];

  // ============ HANDLERS DE USUARIO (SOLO DESARROLLADOR) ============
  
  // Cargar usuarios cuando se abre el popover
  useEffect(() => {
    if (showDevPopover && userData?.isDeveloper) {
      fetch('http://localhost:3000/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
      })
        .then(res => res.json())
        .then(setUsers)
        .catch(() => setUsers([]));
    }
  }, [showDevPopover, userData]);

  // Handlers para el formulario de usuario
  const handleUserFormChange = e => {
    const { name, value, type, checked } = e.target;
    setUserForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleUserSave = async () => {
    setUserError('');
    if (!userForm.username || (!editMode && !userForm.password)) {
      setUserError('Usuario y contraseña requeridos');
      return;
    }
    try {
      const res = await fetch('http://localhost:3000/api/users' + (editMode ? `/${userForm.id}` : ''), {
        method: editMode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          username: userForm.username,
          password: userForm.password,
          // En edición, enviar isDeveloper; en creación, no enviarlo (será false por defecto)
          ...(editMode && { isDeveloper: userForm.isDeveloper }),
          preferences: userForm.preferences
        })
      });
      if (!res.ok) throw new Error('Error al guardar usuario');
      setShowDevPopover(false);
      setUserForm({ id: null, username: '', password: '', isDeveloper: false });
      setEditMode(false);
    } catch (e) {
      setUserError('No se pudo guardar el usuario');
    }
  };

  const handleUserEdit = u => {
    setUserForm({
      id: u.id,
      username: u.username,
      password: '',
      isDeveloper: !!u.isDeveloper,
      preferences: u.preferences
    });
    setEditMode(true);
  };

  const handleUserDelete = async id => {
    if (!window.confirm('¿Eliminar usuario?')) return;
    await fetch(`http://localhost:3000/api/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
    });
    setUsers(users => users.filter(u => u.id !== id));
  };

  // ============ HANDLERS GENERALES ============
  
  /**
   * Genera 3 papalotes aleatorios diferentes
   */
  const generarPapalotesAleatorios = () => {
    const indices = Array.from({ length: 6 }, (_, i) => i); // [0, 1, 2, 3, 4, 5]
    const seleccionados = [];
    for (let i = 0; i < 3; i++) {
      const randomIdx = Math.floor(Math.random() * indices.length);
      seleccionados.push(papalotesDisponibles[indices[randomIdx]]);
      indices.splice(randomIdx, 1); // Remover para no repetir
    }
    setpapalotesAleatorios(seleccionados);
  };
  
  /**
   * Cierra sesión y redirige al login
   */
  const handleLogout = async () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        await fetch('http://localhost:3000/api/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error('Error al cerrar sesión:', error);
      }
    }
    localStorage.removeItem('authToken');
    // Llamar al callback de logout del padre (App.js)
    if (onLogout) {
      onLogout();
    }
  };

  /**
   * Carga los libros de una página específica desde el servidor
   * Extrae las portadas y títulos de cada archivo EPUB
   */
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
              // Construir URL válida para el libro
              const bookUrl = libro.archivo.startsWith('http') ? libro.archivo : `http://localhost:3000${libro.archivo}`;
              const epub = ePub(bookUrl);
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
        generarPapalotesAleatorios(); // Generar nuevos papalotes cuando se cargan libros
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

  // ============ FUNCIONES DE NAVEGACIÓN ============
  
  /**
   * Activa la animación de la nube que "sopla" los libros
   * @param {string} direccion - 'izquierda' o 'derecha', indica hacia dónde sopla la nube
   */
  const activarAnimacion = (direccion) => {
    setNubeActiva(direccion);
    setTimeout(() => {
      setNubeActiva(null);
      setDeslizarDireccion(null);
    }, 1200); // 1.2 segundos de animación
  };

  /**
   * Avanza a la siguiente página de libros
   * Si llega al final, vuelve al principio (navegación circular)
   */
  const avanzarPagina = () => {
    console.log('avanzarPagina llamada:', { paginationInfo, paginaActual });
    if (paginationInfo) {
      if (paginationInfo.hasNextPage) {
        // Hay más páginas: avanzar
        console.log('Avanzando a página siguiente...');
        setDeslizarDireccion('izquierda'); // Libros se desplazan hacia la izquierda
        activarAnimacion('derecha'); // Nube derecha sopla hacia la izquierda
        setTimeout(() => {
          setPaginaActual(prev => prev + 1);
        }, 1200);
      } else {
        // Final alcanzado: volver al principio (navegación circular)
        console.log('Final alcanzado, volviendo al principio...');
        setDeslizarDireccion('izquierda');
        activarAnimacion('derecha');
        setTimeout(() => {
          setPaginaActual(0);
        }, 1200);
      }
    }
  };

  /**
   * Retrocede a la página anterior de libros
   * Si está al principio, va al final (navegación circular)
   */
  const retrocederPagina = () => {
    console.log('retrocederPagina llamada:', { paginationInfo, paginaActual });
    if (paginationInfo) {
      if (paginationInfo.hasPrevPage) {
        // Hay páginas anteriores: retroceder
        console.log('Retrocediendo a página anterior...');
        setDeslizarDireccion('derecha'); // Libros se desplazan hacia la derecha
        activarAnimacion('izquierda'); // Nube izquierda sopla hacia la derecha
        setTimeout(() => {
          setPaginaActual(prev => prev - 1);
        }, 1200);
      } else {
        // Principio alcanzado: ir al final (navegación circular)
        console.log('Principio alcanzado, yendo al final...');
        setDeslizarDireccion('derecha');
        activarAnimacion('izquierda');
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

        {/* Botón de logout y opciones de desarrollador */}
        <div className="Top-buttons">
          <button 
            className="Logout-button" 
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
          {userData?.isDeveloper && (
            <button
              className="DevOptions-button"
              title="Opciones de desarrollador"
              onClick={() => setShowDevPopover(v => !v)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
            </button>
          )}
        </div>

        {/* Popover de opciones de desarrollador */}
        {userData?.isDeveloper && showDevPopover && (
          <div className="DevPopover">
            <div className="DevPopover-title">Gestión de usuarios</div>
            <div className="DevPopover-list">
              {users.map(u => (
                <div key={u.id} className="DevPopover-user">
                  <span>{u.username}</span>
                  <span className="DevPopover-role">{u.isDeveloper ? '👨‍💻 Dev' : 'Usuario'}</span>
                  <button className="DevPopover-edit" onClick={() => handleUserEdit(u)} title="Editar">✏️</button>
                  <button className="DevPopover-delete" onClick={() => handleUserDelete(u.id)} title="Eliminar">🗑️</button>
                </div>
              ))}
            </div>
            <hr />
            <div className="DevPopover-form">
              <input
                name="username"
                placeholder="Usuario"
                value={userForm.username}
                onChange={handleUserFormChange}
                autoComplete="off"
              />
              <input
                name="password"
                type="password"
                placeholder={editMode ? "Nueva contraseña (opcional)" : "Contraseña"}
                value={userForm.password}
                onChange={handleUserFormChange}
                autoComplete="new-password"
              />
              {editMode && (
                <label style={{marginTop: 8, display: 'flex', alignItems: 'center', gap: 8}}>
                  <input
                    type="checkbox"
                    name="isDeveloper"
                    checked={userForm.isDeveloper}
                    onChange={handleUserFormChange}
                  />
                  <span>Es desarrollador</span>
                </label>
              )}
              {userError && <div className="DevPopover-error">{userError}</div>}
              <div className="DevPopover-actions">
                <button onClick={handleUserSave}>{editMode ? 'Guardar cambios' : 'Crear usuario'}</button>
                {editMode && <button onClick={() => { setEditMode(false); setUserForm({ id: null, username: '', password: '', isDeveloper: false }); }}>Cancelar</button>}
              </div>
            </div>
          </div>
        )}

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
            const esGridInferior = index >= 3; // Últimos 3 elementos (índices 3, 4, 5)
            const papaloteIndex = index - 3; // 0, 1, 2 para los 3 inferiores
            const backgroundImage = esGridInferior && papalotesAleatorios[papaloteIndex]
              ? `url(${papalotesAleatorios[papaloteIndex]})`
              : `url(${nubeBlanca})`;
            
            return (
              <div
                key={index}
                className={`Libro-nube ${deslizarDireccion === 'derecha' ? 'deslizar-derecha' : ''} ${deslizarDireccion === 'izquierda' ? 'deslizar-izquierda' : ''}`}
                onClick={() => setLibroSeleccionado(libro.archivo)}
                style={{ cursor: 'pointer', '--float-duration': `${duration}s`, '--float-delay': `${delay}s` }}
              >
                <div
                  className="Nube-blanca"
                  style={{ backgroundImage }}
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
                <h3 className={`Titulo-libro ${esGridInferior ? 'titulo-papalote' : ''}`}>{libro.titulo}</h3>
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
          <Lector 
           archivo={libroSeleccionado} 
           onClose={() => setLibroSeleccionado(null)} 
           userData={userData}
           initialPreferences={userData?.preferences}
          />
      )}
    </div>
  );
}

export default Biblioteca;
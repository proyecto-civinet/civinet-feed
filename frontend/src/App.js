import React, { useState, useEffect } from "react";
import "./App.css";

const CATEGORIAS = ["Todos", "Ayuda Social", "Educación", "Medio Ambiente", "Animales", "Deporte"];

function App() {
  const [publicaciones, setPublicaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [publicacionSeleccionada, setPublicacionSeleccionada] = useState(null);
  const [comentarios, setComentarios] = useState({});
  const [comentariosAbiertos, setComentariosAbiertos] = useState([]);
  const [likesDados, setLikesDados] = useState([]);
  const [comentariosDetalle, setComentariosDetalle] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState("Todos");
  const [cargando, setCargando] = useState(true);

  useEffect(() => { obtenerFeed(); }, []);

  useEffect(() => {
    if (publicacionSeleccionada) obtenerComentarios(publicacionSeleccionada.id);
  }, [publicacionSeleccionada]);

  const obtenerFeed = async () => {
    setCargando(true);
    try {
      const res = await fetch("http://localhost:4000/api/feed?pagina=1&limite=10");
      const data = await res.json();

      const totalPaginas = data.totalPaginas || 1;
      let todasLasPublicaciones = [...(data.publicaciones || [])];

      if (totalPaginas > 1) {
        const peticiones = [];
        for (let i = 2; i <= totalPaginas; i++) {
          peticiones.push(fetch(`http://localhost:4000/api/feed?pagina=${i}&limite=10`).then(r => r.json()));
        }
        const resultados = await Promise.all(peticiones);
        resultados.forEach(r => {
          todasLasPublicaciones = [...todasLasPublicaciones, ...(r.publicaciones || [])];
        });
      }

      // ✅ Elimina duplicados por id
      const sinDuplicados = todasLasPublicaciones.filter(
        (pub, index, self) => index === self.findIndex(p => p.id === pub.id)
      );

      console.log(`📦 Total cargadas: ${todasLasPublicaciones.length} → Sin duplicados: ${sinDuplicados.length}`);
      setPublicaciones(sinDuplicados);
    } catch (error) {
      console.error("❌ Error al obtener feed:", error);
    } finally {
      setCargando(false);
    }
  };

  const obtenerComentarios = async (id) => {
    try {
      const res = await fetch(`http://localhost:4000/api/feed/${id}/comentarios`);
      const data = await res.json();
      setComentariosDetalle(data.comentarios || []);
    } catch (error) {
      console.error("Error al obtener comentarios:", error);
    }
  };

  const darLike = async (id) => {
    if (likesDados.includes(id)) {
      setLikesDados(likesDados.filter(l => l !== id));
      setPublicaciones(prev => prev.map(pub => pub.id === id ? { ...pub, total_likes: String(Number(pub.total_likes) - 1) } : pub));
      return;
    }
    try {
      await fetch(`http://localhost:4000/api/feed/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: 1 })
      });
      setLikesDados([...likesDados, id]);
      setPublicaciones(prev => prev.map(pub => pub.id === id ? { ...pub, total_likes: String(Number(pub.total_likes) + 1) } : pub));
    } catch (error) {
      console.error("Error al dar like:", error);
    }
  };

  const toggleComentarios = (id) => {
    if (comentariosAbiertos.includes(id)) setComentariosAbiertos(comentariosAbiertos.filter(c => c !== id));
    else setComentariosAbiertos([...comentariosAbiertos, id]);
  };

  const comentar = async (id) => {
    const texto = comentarios[id];
    if (!texto) return;
    try {
      await fetch(`http://localhost:4000/api/feed/${id}/comentario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: 1, comentario: texto })
      });
      setComentarios({ ...comentarios, [id]: "" });
      setPublicaciones(prev => prev.map(pub => pub.id === id ? { ...pub, total_comentarios: String(Number(pub.total_comentarios) + 1) } : pub));
      obtenerComentarios(id);
    } catch (error) {
      console.error("Error al comentar:", error);
    }
  };

  const normalizar = (texto) =>
    (texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const publicacionesFiltradas = publicaciones.filter((pub) => {
    const textoBusqueda = normalizar(busqueda);

    const coincideBusqueda =
      textoBusqueda === "" ||
      normalizar(pub.ong_nombre).includes(textoBusqueda) ||
      normalizar(pub.titulo).includes(textoBusqueda) ||
      normalizar(pub.descripcion).includes(textoBusqueda);

    const coincideCategoria =
      categoriaActiva === "Todos" ||
      normalizar(pub.categoria) === normalizar(categoriaActiva);

    return coincideBusqueda && coincideCategoria;
  });

  const iconosCategoria = {
    "Todos": "",
    "Ayuda Social": "",
    "Educación": "",
    "Medio Ambiente": "",
    "Animales": "",
    "Deporte": ""
  };

  if (publicacionSeleccionada) {
    const pub = publicacionSeleccionada;
    return (
      <div className="detalle">
        <button className="btn-volver" onClick={() => { setPublicacionSeleccionada(null); setComentariosDetalle([]); }}>
          ← Volver
        </button>
        {pub.imagen_url && <img src={pub.imagen_url} alt={pub.titulo} className="detalle-img" />}
        <div className="detalle-body">
          <span className="ong-tag">{pub.ong_nombre || pub.categoria || "Publicación"}</span>
          <h2>{pub.titulo}</h2>
          <p>{pub.descripcion}</p>
          <div className="detalle-meta">
            <div className="barra-container">
              <div className={`barra ${Number(pub.porcentaje) >= 50 ? "alta" : "baja"}`} style={{ width: `${Math.min(Number(pub.porcentaje), 100)}%` }}></div>
            </div>
            <span className={`meta-texto ${Number(pub.porcentaje) >= 50 ? "alta" : "baja"}`}>
              ${Number(pub.monto_actual).toLocaleString()} de ${Number(pub.monto_objetivo).toLocaleString()} — {pub.porcentaje}%
            </span>
          </div>
          <div className="detalle-acciones">
            <button className={`btn-like ${likesDados.includes(pub.id) ? "liked" : ""}`} onClick={() => darLike(pub.id)}>
              {likesDados.includes(pub.id) ? "❤️" : "🤍"} {pub.total_likes} Me gusta
            </button>
            <span>💬 {pub.total_comentarios} comentarios</span>
          </div>
          <div className="detalle-comentar">
            <input type="text" placeholder="Escribe un comentario..." value={comentarios[pub.id] || ""} onChange={(e) => setComentarios({ ...comentarios, [pub.id]: e.target.value })} />
            <button onClick={() => comentar(pub.id)}>Publicar</button>
          </div>
          <div className="lista-comentarios">
            {comentariosDetalle.length === 0 ? (
              <p className="sin-comentarios">No hay comentarios aún. ¡Sé el primero!</p>
            ) : (
              comentariosDetalle.map((c) => (
                <div className="comentario-item" key={c.id}>
                  <div className="comentario-avatar">U</div>
                  <div className="comentario-contenido">
                    <span className="comentario-usuario">Usuario {c.usuario_id}</span>
                    <p className="comentario-texto">{c.comentario}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-logo">
          <img src="/logo2.jpeg" alt="CiviNet" style={{height: '50px', objectFit: 'contain', mixBlendMode: 'multiply'}} />
        </div>
        <div className="navbar-menu" onClick={() => setMenuAbierto(!menuAbierto)}>☰ Menú</div>
        <div style={{flex: 1}}></div>
        <div className="navbar-search">
          <input type="text" placeholder="Busca ONG o publicación..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <div className="navbar-avatar">MS</div>
      </nav>

      {menuAbierto && (
        <div className="menu-desplegable">
          <ul>
            <li onClick={() => setMenuAbierto(false)}>Inicio</li>
            <li onClick={() => setMenuAbierto(false)}>Donaciones</li>
            <li onClick={() => setMenuAbierto(false)}>ONGs</li>
            <li onClick={() => setMenuAbierto(false)}>Voluntarios</li>
            <li onClick={() => setMenuAbierto(false)}>Mi perfil</li>
          </ul>
        </div>
      )}

      <div className="app">
        <div className="filtros">
          {CATEGORIAS.map((cat) => (
            <button
              key={cat}
              data-cat={cat}
              className={`filtro-btn ${categoriaActiva === cat ? "activo" : ""}`}
              onClick={() => setCategoriaActiva(cat)}
            >
              {iconosCategoria[cat]} {cat}
            </button>
          ))}
        </div>

        <h2 className="seccion-titulo">
          Publicaciones disponibles:
          <span style={{fontSize: '0.8rem', fontWeight: 'normal', marginLeft: '8px', color: '#888'}}>
            ({publicacionesFiltradas.length} de {publicaciones.length})
          </span>
        </h2>

        {cargando ? (
          <div style={{textAlign: 'center', padding: '40px', color: '#888'}}>
            Cargando publicaciones...
          </div>
        ) : publicacionesFiltradas.length === 0 ? (
          <div style={{textAlign: 'center', padding: '40px', color: '#888'}}>
            {publicaciones.length === 0
              ? "No se pudieron cargar las publicaciones. Verifica tu conexión con la API."
              : "No hay publicaciones que coincidan con tu búsqueda."}
          </div>
        ) : (
          <div className="feed">
            {publicacionesFiltradas.map((pub) => (
              <div className="card" key={pub.id}>
                {pub.imagen_url ? <img src={pub.imagen_url} alt={pub.titulo} /> : <div className="card-placeholder"></div>}
                <div className="card-body">
                  <h3>{pub.ong_nombre || pub.categoria || "Sin nombre"}</h3>
                  <div className="card-autor">{pub.titulo}</div>
                  <div className="card-direccion">{pub.descripcion?.substring(0, 80)}...</div>
                  <div className="barra-container">
                    <div className={`barra ${Number(pub.porcentaje) >= 50 ? "alta" : "baja"}`} style={{ width: `${Math.min(Number(pub.porcentaje), 100)}%` }}></div>
                  </div>
                  <div className={`meta-texto ${Number(pub.porcentaje) >= 50 ? "alta" : "baja"}`}>{pub.porcentaje}% recaudado</div>
                  <div className="card-footer">
                    <button className="btn-conoce" onClick={() => setPublicacionSeleccionada(pub)}>Conoce más →</button>
                    <div className="likes">
                      <button onClick={() => darLike(pub.id)} className={likesDados.includes(pub.id) ? "liked" : ""}>
                        {likesDados.includes(pub.id) ? "❤️" : "🤍"}
                      </button>
                      {pub.total_likes}
                    </div>
                  </div>
                  <div className="comentarios-toggle" onClick={() => toggleComentarios(pub.id)}>
                    💬 {pub.total_comentarios} comentarios {comentariosAbiertos.includes(pub.id) ? "▲" : "▼"}
                  </div>
                  {comentariosAbiertos.includes(pub.id) && (
                    <div className="comentar-seccion">
                      <input type="text" placeholder="Escribe un comentario..." value={comentarios[pub.id] || ""} onChange={(e) => setComentarios({ ...comentarios, [pub.id]: e.target.value })} />
                      <button onClick={() => comentar(pub.id)}>Publicar</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default App;
const pool = require("../config/db");

// ─────────────────────────────────────────────
// GET /api/feed
// Obtener feed paginado (con filtro opcional por tipo)
// Ejemplo: /api/feed?pagina=1&limite=10&tipo=urgente
// ─────────────────────────────────────────────
exports.obtenerFeed = async (req, res) => {
  const pagina = parseInt(req.query.pagina) || 1;
  const limite = parseInt(req.query.limite) || 10;
  const offset = (pagina - 1) * limite;
  const tipo   = req.query.tipo || null;

  try {
    const countResult = await pool.query(
      tipo
        ? `SELECT COUNT(*) FROM publicaciones WHERE tipo = $1`
        : `SELECT COUNT(*) FROM publicaciones`,
      tipo ? [tipo] : []
    );
    const total = parseInt(countResult.rows[0].count);

    const params = tipo ? [limite, offset, tipo] : [limite, offset];
    const resultado = await pool.query(
      `SELECT
         p.id,
         p.titulo,
         p.descripcion,
         p.imagen_url,
         p.fecha_creacion,
         p.tipo,
         o.id   AS ong_id,
         o.nombre AS ong_nombre,
         m.monto_objetivo,
         m.monto_actual,
         ROUND((m.monto_actual / m.monto_objetivo) * 100, 2) AS porcentaje,
         (SELECT COUNT(*) FROM likes_publicacion lp WHERE lp.publicacion_id = p.id) AS total_likes,
         (SELECT COUNT(*) FROM comentarios c WHERE c.publicacion_id = p.id) AS total_comentarios
       FROM publicaciones p
       JOIN ongs o ON p.ong_id = o.id
       JOIN metas m ON p.meta_id = m.id
       ${tipo ? "WHERE p.tipo = $3" : ""}
       ORDER BY p.fecha_creacion DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    res.json({
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
      publicaciones: resultado.rows,
    });
  } catch (error) {
    console.error("Error obtenerFeed:", error);
    res.status(500).json({ mensaje: "Error al obtener el feed" });
  }
};

// ─────────────────────────────────────────────
// GET /api/feed/recaudaciones
// Ver el estado de recaudación de todas las ONGs
// ─────────────────────────────────────────────
exports.obtenerRecaudaciones = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT
        o.id AS ong_id,
        o.nombre AS ong_nombre,
        m.id AS meta_id,
        m.monto_objetivo,
        m.monto_actual,
        ROUND((m.monto_actual / m.monto_objetivo) * 100, 2) AS porcentaje
      FROM metas m
      JOIN ongs o ON m.ong_id = o.id
      ORDER BY porcentaje DESC
    `);
    res.json(resultado.rows);
  } catch (error) {
    console.error("Error obtenerRecaudaciones:", error);
    res.status(500).json({ mensaje: "Error al obtener recaudaciones" });
  }
};

// ─────────────────────────────────────────────
// POST /api/feed
// Crear nueva publicación (solo ONGs)
// Body: { ong_id, meta_id, titulo, descripcion, imagen_url, tipo }
// ─────────────────────────────────────────────
exports.crearPublicacion = async (req, res) => {
  const { ong_id, meta_id, titulo, descripcion, imagen_url, tipo } = req.body;

  if (!ong_id || !meta_id || !titulo || !descripcion) {
    return res.status(400).json({
      mensaje: "Faltan campos obligatorios: ong_id, meta_id, titulo, descripcion",
    });
  }

  const tiposValidos = ["actualizacion", "recaudacion", "urgente"];
  const tipoFinal = tiposValidos.includes(tipo) ? tipo : "actualizacion";

  try {
    const nueva = await pool.query(
      `INSERT INTO publicaciones (ong_id, meta_id, titulo, descripcion, imagen_url, tipo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [ong_id, meta_id, titulo, descripcion, imagen_url || null, tipoFinal]
    );

    const publicacion = nueva.rows[0];

    // Notificar suscriptores
    const suscriptores = await pool.query(
      `SELECT usuario_id FROM suscripciones_feed WHERE ong_id = $1 AND activa = TRUE`,
      [ong_id]
    );

    if (suscriptores.rows.length > 0) {
      const valores = suscriptores.rows.map(
        (s) => `(${s.usuario_id}, ${publicacion.id}, 'Nueva publicación: ${titulo.replace(/'/g, "''")}', FALSE, NOW())`
      );
      await pool.query(
        `INSERT INTO notificaciones_feed (usuario_id, publicacion_id, mensaje, leida, fecha)
         VALUES ${valores.join(", ")}`
      );
      console.log(`[Notificación] Enviada a ${suscriptores.rows.length} suscriptores`);
    }

    res.status(201).json({
      mensaje: "Publicación creada exitosamente",
      publicacion,
      suscriptoresNotificados: suscriptores.rows.length,
    });
  } catch (error) {
    console.error("Error crearPublicacion:", error);
    res.status(500).json({ mensaje: "Error al crear la publicación" });
  }
};

// ─────────────────────────────────────────────
// POST /api/feed/:id/like
// Dar like a una publicación
// Body: { usuario_id }
// ─────────────────────────────────────────────
exports.darLike = async (req, res) => {
  const { id } = req.params;
  const { usuario_id } = req.body;

  if (!usuario_id) {
    return res.status(400).json({ mensaje: "Se requiere usuario_id" });
  }

  try {
    await pool.query(
      `INSERT INTO likes_publicacion (publicacion_id, usuario_id)
       VALUES ($1, $2)
       ON CONFLICT (publicacion_id, usuario_id) DO NOTHING`,
      [id, usuario_id]
    );

    const total = await pool.query(
      `SELECT COUNT(*) FROM likes_publicacion WHERE publicacion_id = $1`,
      [id]
    );

    res.json({
      mensaje: "Like registrado",
      total_likes: parseInt(total.rows[0].count),
    });
  } catch (error) {
    console.error("Error darLike:", error);
    res.status(500).json({ mensaje: "Error al dar like" });
  }
};

// ─────────────────────────────────────────────
// POST /api/feed/:id/comentario
// Agregar comentario a una publicación
// Body: { usuario_id, comentario }
// ─────────────────────────────────────────────
exports.comentar = async (req, res) => {
  const { id } = req.params;
  const { usuario_id, comentario } = req.body;

  if (!usuario_id || !comentario) {
    return res.status(400).json({ mensaje: "Se requieren usuario_id y comentario" });
  }

  try {
    const nuevo = await pool.query(
      `INSERT INTO comentarios (publicacion_id, usuario_id, comentario)
       VALUES ($1, $2, $3) RETURNING *`,
      [id, usuario_id, comentario]
    );

    res.status(201).json({
      mensaje: "Comentario agregado",
      comentario: nuevo.rows[0],
    });
  } catch (error) {
    console.error("Error comentar:", error);
    res.status(500).json({ mensaje: "Error al agregar comentario" });
  }
};

// ─────────────────────────────────────────────
// GET /api/feed/:id/comentarios
// Ver todos los comentarios de una publicación
// ─────────────────────────────────────────────
exports.verComentarios = async (req, res) => {
  const { id } = req.params;

  try {
    const resultado = await pool.query(
      `SELECT
         c.id,
         c.usuario_id,
         c.comentario,
         c.fecha
       FROM comentarios c
       WHERE c.publicacion_id = $1
       ORDER BY c.fecha ASC`,
      [id]
    );

    res.json({
      publicacion_id: parseInt(id),
      total: resultado.rows.length,
      comentarios: resultado.rows,
    });
  } catch (error) {
    console.error("Error verComentarios:", error);
    res.status(500).json({ mensaje: "Error al obtener comentarios" });
  }
};

// ─────────────────────────────────────────────
// POST /api/feed/suscribir
// Suscribirse a notificaciones de una ONG
// Body: { usuario_id, ong_id }
// ─────────────────────────────────────────────
exports.suscribirse = async (req, res) => {
  const { usuario_id, ong_id } = req.body;

  if (!usuario_id || !ong_id) {
    return res.status(400).json({ mensaje: "Se requieren usuario_id y ong_id" });
  }

  try {
    await pool.query(
      `INSERT INTO suscripciones_feed (usuario_id, ong_id, activa)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (usuario_id, ong_id) DO UPDATE SET activa = TRUE`,
      [usuario_id, ong_id]
    );
    res.json({ mensaje: `Suscrito correctamente a notificaciones de la ONG ${ong_id}` });
  } catch (error) {
    console.error("Error suscribirse:", error);
    res.status(500).json({ mensaje: "Error al suscribirse" });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/feed/suscribir
// Cancelar suscripción a notificaciones
// Body: { usuario_id, ong_id }
// ─────────────────────────────────────────────
exports.cancelarSuscripcion = async (req, res) => {
  const { usuario_id, ong_id } = req.body;

  if (!usuario_id || !ong_id) {
    return res.status(400).json({ mensaje: "Se requieren usuario_id y ong_id" });
  }

  try {
    await pool.query(
      `UPDATE suscripciones_feed SET activa = FALSE
       WHERE usuario_id = $1 AND ong_id = $2`,
      [usuario_id, ong_id]
    );
    res.json({ mensaje: "Suscripción cancelada correctamente" });
  } catch (error) {
    console.error("Error cancelarSuscripcion:", error);
    res.status(500).json({ mensaje: "Error al cancelar suscripción" });
  }
};

// ─────────────────────────────────────────────
// GET /api/feed/notificaciones/:usuario_id
// Ver notificaciones de un usuario
// ─────────────────────────────────────────────
exports.obtenerNotificaciones = async (req, res) => {
  const { usuario_id } = req.params;

  try {
    const resultado = await pool.query(
      `SELECT
         n.id,
         n.mensaje,
         n.leida,
         n.fecha,
         p.titulo AS publicacion_titulo,
         p.tipo   AS publicacion_tipo
       FROM notificaciones_feed n
       JOIN publicaciones p ON n.publicacion_id = p.id
       WHERE n.usuario_id = $1
       ORDER BY n.fecha DESC`,
      [usuario_id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error("Error obtenerNotificaciones:", error);
    res.status(500).json({ mensaje: "Error al obtener notificaciones" });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/feed/notificaciones/:notificacion_id/leer
// Marcar una notificación como leída
// ─────────────────────────────────────────────
exports.marcarLeida = async (req, res) => {
  const { notificacion_id } = req.params;

  try {
    await pool.query(
      `UPDATE notificaciones_feed SET leida = TRUE WHERE id = $1`,
      [notificacion_id]
    );
    res.json({ mensaje: "Notificación marcada como leída" });
  } catch (error) {
    console.error("Error marcarLeida:", error);
    res.status(500).json({ mensaje: "Error al marcar notificación" });
  }
};


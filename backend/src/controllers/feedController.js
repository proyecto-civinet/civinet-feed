const supabase = require('../supabaseClient');

exports.obtenerFeed = async (req, res) => {
  const pagina = parseInt(req.query.pagina) || 1;
  const limite = parseInt(req.query.limite) || 10;
  const offset = (pagina - 1) * limite;
  const tipo   = req.query.tipo || null;

  try {
    let countQuery = supabase.from('publicaciones').select('id', { count: 'exact', head: true });
    if (tipo) countQuery = countQuery.eq('tipo', tipo);
    const { count: total, error: countError } = await countQuery;
    if (countError) throw countError;

    let query = supabase
      .from('publicaciones')
      .select(`
        id, titulo, descripcion, imagen_url, fecha_creacion, tipo, categoria,
        ongs ( id, nombre ),
        metas ( monto_objetivo, monto_actual ),
        likes_publicacion ( id ),
        comentarios ( id )
      `)
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limite - 1);

    if (tipo) query = query.eq('tipo', tipo);

    const { data, error } = await query;
    if (error) throw error;

    const publicaciones = data.map(p => {
      const meta = Array.isArray(p.metas) ? p.metas[0] : p.metas;

      return {
        id: p.id,
        titulo: p.titulo,
        descripcion: p.descripcion,
        imagen_url: p.imagen_url,
        fecha_creacion: p.fecha_creacion,
        tipo: p.tipo,
        categoria: p.categoria,
        ong_id: p.ongs?.id,
        ong_nombre: p.ongs?.nombre,
        monto_objetivo: meta?.monto_objetivo ?? 0,
        monto_actual: meta?.monto_actual ?? 0,
        porcentaje: meta?.monto_objetivo
          ? Math.round((meta.monto_actual / meta.monto_objetivo) * 10000) / 100
          : 0,
        total_likes: p.likes_publicacion?.length || 0,
        total_comentarios: p.comentarios?.length || 0,
      };
    });

    // Elimina duplicados por id por si acaso
    const sinDuplicados = publicaciones.filter(
      (pub, index, self) => index === self.findIndex(p => p.id === pub.id)
    );

    res.json({ pagina, limite, total, totalPaginas: Math.ceil(total / limite), publicaciones: sinDuplicados });
  } catch (error) {
    console.error('Error obtenerFeed:', error);
    res.status(500).json({ mensaje: 'Error al obtener el feed' });
  }
};

exports.obtenerRecaudaciones = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('metas')
      .select('id, monto_objetivo, monto_actual, ongs ( id, nombre )')
      .order('monto_actual', { ascending: false });

    if (error) throw error;

    const resultado = data.map(m => ({
      ong_id: m.ongs?.id,
      ong_nombre: m.ongs?.nombre,
      meta_id: m.id,
      monto_objetivo: m.monto_objetivo,
      monto_actual: m.monto_actual,
      porcentaje: m.monto_objetivo
        ? Math.round((m.monto_actual / m.monto_objetivo) * 10000) / 100
        : 0,
    }));

    res.json(resultado);
  } catch (error) {
    console.error('Error obtenerRecaudaciones:', error);
    res.status(500).json({ mensaje: 'Error al obtener recaudaciones' });
  }
};

exports.crearPublicacion = async (req, res) => {
  const { ong_id, meta_id, titulo, descripcion, imagen_url, tipo, categoria } = req.body;

  if (!ong_id || !meta_id || !titulo || !descripcion) {
    return res.status(400).json({ mensaje: 'Faltan campos obligatorios' });
  }

  const tiposValidos = ['actualizacion', 'recaudacion', 'urgente'];
  const tipoFinal = tiposValidos.includes(tipo) ? tipo : 'actualizacion';

  try {
    const { data: publicacion, error } = await supabase
      .from('publicaciones')
      .insert([{ ong_id, meta_id, titulo, descripcion, imagen_url: imagen_url || null, tipo: tipoFinal, categoria: categoria || null }])
      .select()
      .single();

    if (error) throw error;

    const { data: suscriptores, error: suscError } = await supabase
      .from('suscripciones_feed')
      .select('usuario_id')
      .eq('ong_id', ong_id)
      .eq('activa', true);

    if (suscError) throw suscError;

    if (suscriptores.length > 0) {
      const notificaciones = suscriptores.map(s => ({
        usuario_id: s.usuario_id,
        publicacion_id: publicacion.id,
        mensaje: `Nueva publicación: ${titulo}`,
        leida: false,
      }));
      const { error: notifError } = await supabase.from('notificaciones_feed').insert(notificaciones);
      if (notifError) throw notifError;
    }

    res.status(201).json({ mensaje: 'Publicación creada exitosamente', publicacion, suscriptoresNotificados: suscriptores.length });
  } catch (error) {
    console.error('Error crearPublicacion:', error);
    res.status(500).json({ mensaje: 'Error al crear la publicación' });
  }
};

exports.darLike = async (req, res) => {
  const { id } = req.params;
  const { usuario_id } = req.body;

  if (!usuario_id) return res.status(400).json({ mensaje: 'Se requiere usuario_id' });

  try {
    await supabase
      .from('likes_publicacion')
      .upsert([{ publicacion_id: parseInt(id), usuario_id }], { onConflict: 'publicacion_id,usuario_id', ignoreDuplicates: true });

    const { count, error } = await supabase
      .from('likes_publicacion')
      .select('id', { count: 'exact', head: true })
      .eq('publicacion_id', id);

    if (error) throw error;

    res.json({ mensaje: 'Like registrado', total_likes: count });
  } catch (error) {
    console.error('Error darLike:', error);
    res.status(500).json({ mensaje: 'Error al dar like' });
  }
};

exports.comentar = async (req, res) => {
  const { id } = req.params;
  const { usuario_id, comentario } = req.body;

  if (!usuario_id || !comentario) return res.status(400).json({ mensaje: 'Se requieren usuario_id y comentario' });

  try {
    const { data, error } = await supabase
      .from('comentarios')
      .insert([{ publicacion_id: parseInt(id), usuario_id, comentario }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ mensaje: 'Comentario agregado', comentario: data });
  } catch (error) {
    console.error('Error comentar:', error);
    res.status(500).json({ mensaje: 'Error al agregar comentario' });
  }
};

exports.verComentarios = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('comentarios')
      .select('id, usuario_id, comentario, fecha')
      .eq('publicacion_id', id)
      .order('fecha', { ascending: true });

    if (error) throw error;

    res.json({ publicacion_id: parseInt(id), total: data.length, comentarios: data });
  } catch (error) {
    console.error('Error verComentarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener comentarios' });
  }
};

exports.suscribirse = async (req, res) => {
  const { usuario_id, ong_id } = req.body;

  if (!usuario_id || !ong_id) return res.status(400).json({ mensaje: 'Se requieren usuario_id y ong_id' });

  try {
    const { error } = await supabase
      .from('suscripciones_feed')
      .upsert([{ usuario_id, ong_id, activa: true }], { onConflict: 'usuario_id,ong_id' });

    if (error) throw error;

    res.json({ mensaje: `Suscrito correctamente a notificaciones de la ONG ${ong_id}` });
  } catch (error) {
    console.error('Error suscribirse:', error);
    res.status(500).json({ mensaje: 'Error al suscribirse' });
  }
};

exports.cancelarSuscripcion = async (req, res) => {
  const { usuario_id, ong_id } = req.body;

  if (!usuario_id || !ong_id) return res.status(400).json({ mensaje: 'Se requieren usuario_id y ong_id' });

  try {
    const { error } = await supabase
      .from('suscripciones_feed')
      .update({ activa: false })
      .eq('usuario_id', usuario_id)
      .eq('ong_id', ong_id);

    if (error) throw error;

    res.json({ mensaje: 'Suscripción cancelada correctamente' });
  } catch (error) {
    console.error('Error cancelarSuscripcion:', error);
    res.status(500).json({ mensaje: 'Error al cancelar suscripción' });
  }
};

exports.obtenerNotificaciones = async (req, res) => {
  const { usuario_id } = req.params;

  try {
    const { data, error } = await supabase
      .from('notificaciones_feed')
      .select('id, mensaje, leida, fecha, publicaciones ( titulo, tipo )')
      .eq('usuario_id', usuario_id)
      .order('fecha', { ascending: false });

    if (error) throw error;

    const resultado = data.map(n => ({
      id: n.id,
      mensaje: n.mensaje,
      leida: n.leida,
      fecha: n.fecha,
      publicacion_titulo: n.publicaciones?.titulo,
      publicacion_tipo: n.publicaciones?.tipo,
    }));

    res.json(resultado);
  } catch (error) {
    console.error('Error obtenerNotificaciones:', error);
    res.status(500).json({ mensaje: 'Error al obtener notificaciones' });
  }
};

exports.marcarLeida = async (req, res) => {
  const { notificacion_id } = req.params;

  try {
    const { error } = await supabase
      .from('notificaciones_feed')
      .update({ leida: true })
      .eq('id', notificacion_id);

    if (error) throw error;

    res.json({ mensaje: 'Notificación marcada como leída' });
  } catch (error) {
    console.error('Error marcarLeida:', error);
    res.status(500).json({ mensaje: 'Error al marcar notificación' });
  }
};
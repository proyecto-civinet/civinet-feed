const express = require("express");
const router  = express.Router();
const feedController = require("../controllers/feedController");

// ── Feed ─────────────────────────────────────────────────────────
router.get("/feed",                                   feedController.obtenerFeed);
router.post("/feed",                                  feedController.crearPublicacion);

// ── Recaudaciones ────────────────────────────────────────────────
router.get("/feed/recaudaciones",                     feedController.obtenerRecaudaciones);

// ── Likes y comentarios ──────────────────────────────────────────
router.post("/feed/:id/like",                         feedController.darLike);
router.post("/feed/:id/comentario",                   feedController.comentar);
router.get("/feed/:id/comentarios",                   feedController.verComentarios);

// ── Suscripciones ────────────────────────────────────────────────
router.post("/feed/suscribir",                        feedController.suscribirse);
router.delete("/feed/suscribir",                      feedController.cancelarSuscripcion);

// ── Notificaciones ───────────────────────────────────────────────
router.get("/feed/notificaciones/:usuario_id",        feedController.obtenerNotificaciones);
router.patch("/feed/notificaciones/:notificacion_id/leer", feedController.marcarLeida);

module.exports = router;
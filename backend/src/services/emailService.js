const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error("Error al conectar con Gmail:", error.message);
  } else {
    console.log("Servicio de correos Gmail listo");
  }
});

exports.enviarNotificacionPublicacion = async ({ destinatario, ong_nombre, titulo, descripcion, tipo }) => {
  const coloresTipo = {
    urgente:       { color: "#ef4444", etiqueta: "URGENTE" },
    recaudacion:   { color: "#22c55e", etiqueta: "Recaudacion" },
    actualizacion: { color: "#3b82f6", etiqueta: "Actualizacion" },
  };
  const estilo = coloresTipo[tipo] || coloresTipo.actualizacion;
  const html = "<div style='font-family:Arial,sans-serif'><h1>" + titulo + "</h1><p>" + descripcion + "</p></div>";
  await transporter.sendMail({
    from: '"Plataforma Donaciones" <' + process.env.EMAIL_USER + '>',
    to: destinatario,
    subject: estilo.etiqueta + " - " + ong_nombre + ": " + titulo,
    html,
  });
};

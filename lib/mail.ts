import nodemailer from "nodemailer";

// Correo saliente por SMTP. Con Gmail basta con SMTP_USER (tu correo) y SMTP_PASS (contraseña de aplicación):
// el servidor por defecto es smtp.gmail.com y el remitente es el mismo correo.
// Opcionales: SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_SECURE (true para 465).
const cfg = () => {
  const user = process.env.SMTP_USER?.trim() || "";
  // Google muestra la contraseña de aplicación en bloques de 4 con espacios; se ignoran.
  const pass = (process.env.SMTP_PASS ?? "").replace(/\s+/g, "");
  const host = process.env.SMTP_HOST?.trim() || (user ? "smtp.gmail.com" : "");
  const port = Number(process.env.SMTP_PORT) || 587;
  const from = process.env.SMTP_FROM?.trim() || (user ? `Marmo Workshop <${user}>` : "");
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  return { user, pass, host, port, from, secure };
};

export const mailEnabled = () => {
  const c = cfg();
  return !!(c.host && c.from && (!c.user || c.pass));
};

export async function sendMail({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }) {
  const c = cfg();
  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.pass } : undefined,
  });
  await transport.sendMail({ from: c.from, to, subject, text, html });
}

// api/_factura-email.js
// Envía emails con factura electrónica al cliente vía Resend
// NO es función serverless de Vercel (empieza con _)
//
// Maneja:
//   ✅ Email con datos de la factura (CAE, número, importe)
//   ✅ Link al PDF de AFIP (oficial)
//   ✅ Formato profesional con branding AVAI
//   ✅ Notificación al admin si algo falla

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || "AVAI <noreply@avai.ar>";
const ADMIN_EMAIL = "valen810a@gmail.com";

let resendInstance = null;
function getResend() {
  if (resendInstance) return resendInstance;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no configurada");
  resendInstance = new Resend(RESEND_API_KEY);
  return resendInstance;
}

// ─── ARMAR URL DEL PDF DE AFIP ─────────────────────────────────
function getPdfAfipUrl(factura) {
  // AFIP genera el PDF del comprobante con este formato de URL
  // Solo funciona en producción (no en homologación)
  if (!factura.production) {
    return null; // en homologación no hay PDF público
  }
  
  // URL oficial de consulta de comprobantes AFIP
  // El usuario puede consultar su factura con CAE + nro + CUIT
  return `https://serviciosweb.afip.gob.ar/genericos/comprobantes/cae.aspx?cae=${factura.cae}&cuit=${process.env.AFIP_CUIT}&nro=${factura.numero}`;
}

// ─── FORMATEAR FECHA ESPAÑOL ───────────────────────────────────
function formatearFecha(fechaISO) {
  const fecha = new Date(fechaISO);
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── FORMATEAR PRECIO ─────────────────────────────────────────
function formatearPrecio(importe) {
  return importe.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

// ─── EMAIL HTML — DISEÑO PROFESIONAL ──────────────────────────
function armarHTMLFactura(factura) {
  const numeroFormateado = String(factura.numero).padStart(8, "0");
  const puntoVentaFormateado = String(factura.puntoVenta).padStart(4, "0");
  const fechaLegible = formatearFecha(factura.fecha);
  const importeLegible = formatearPrecio(factura.importe);
  const pdfUrl = getPdfAfipUrl(factura);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Factura AVAI</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);max-width:600px;">
          
          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 32px 24px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                🧾 Factura AVAI
              </h1>
              <p style="margin:8px 0 0;color:#e9d5ff;font-size:14px;">
                Tu comprobante de pago
              </p>
            </td>
          </tr>
          
          <!-- CUERPO -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#18181b;">
                ¡Hola <strong>${factura.nombreCliente}</strong>! 👋
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#52525b;line-height:1.6;">
                Gracias por tu pago. Te dejamos los datos de tu factura electrónica:
              </p>
              
              <!-- TABLA DE DATOS -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:12px;padding:24px;margin:0 0 24px;">
                <tr>
                  <td style="padding:8px 0;color:#71717a;font-size:14px;">Comprobante:</td>
                  <td style="padding:8px 0;color:#18181b;font-size:14px;font-weight:600;text-align:right;">
                    Factura C ${puntoVentaFormateado}-${numeroFormateado}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#71717a;font-size:14px;">Fecha:</td>
                  <td style="padding:8px 0;color:#18181b;font-size:14px;font-weight:600;text-align:right;">
                    ${fechaLegible}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#71717a;font-size:14px;">Concepto:</td>
                  <td style="padding:8px 0;color:#18181b;font-size:14px;font-weight:600;text-align:right;">
                    ${factura.concepto}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#71717a;font-size:14px;">CAE:</td>
                  <td style="padding:8px 0;color:#18181b;font-size:13px;font-weight:600;text-align:right;font-family:'Courier New',monospace;">
                    ${factura.cae}
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0 8px;border-top:1px solid #e4e4e7;color:#18181b;font-size:16px;font-weight:700;">Total:</td>
                  <td style="padding:16px 0 8px;border-top:1px solid #e4e4e7;color:#6366f1;font-size:20px;font-weight:700;text-align:right;">
                    ${importeLegible}
                  </td>
                </tr>
              </table>
              
              ${pdfUrl ? `
              <!-- BOTÓN VER FACTURA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center">
                    <a href="${pdfUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
                      📄 Ver factura en AFIP
                    </a>
                  </td>
                </tr>
              </table>
              ` : `
              <!-- AVISO HOMOLOGACIÓN -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:#fef3c7;border-radius:8px;padding:12px;">
                <tr>
                  <td style="font-size:13px;color:#92400e;text-align:center;">
                    ⚠️ Factura de prueba (modo homologación)
                  </td>
                </tr>
              </table>
              `}
              
              <p style="margin:24px 0 0;font-size:14px;color:#71717a;line-height:1.6;">
                Si tenés cualquier consulta, respondé este email y te ayudamos.
              </p>
              <p style="margin:16px 0 0;font-size:14px;color:#71717a;line-height:1.6;">
                ¡Seguí aprendiendo con AVAI! 🚀
              </p>
            </td>
          </tr>
          
          <!-- FOOTER -->
          <tr>
            <td style="background:#fafafa;padding:24px 32px;text-align:center;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
                <strong style="color:#18181b;">AVAI</strong> — Tu mentor de IA argentino<br>
                <a href="https://avai.ar" style="color:#6366f1;text-decoration:none;">avai.ar</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#a1a1aa;">
                Valentino Avalos — CUIT ${process.env.AFIP_CUIT}<br>
                Monotributo / Factura tipo C
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// ─── ENVIAR FACTURA POR EMAIL ─────────────────────────────────
export async function enviarFacturaPorEmail(factura) {
  const resend = getResend();
  const numeroFormateado = String(factura.numero).padStart(8, "0");
  const puntoVentaFormateado = String(factura.puntoVenta).padStart(4, "0");
  
  const html = armarHTMLFactura(factura);
  
  const subject = `🧾 Factura AVAI C ${puntoVentaFormateado}-${numeroFormateado}`;
  
  try {
    const resp = await resend.emails.send({
      from: RESEND_FROM,
      to: factura.emailCliente,
      subject,
      html,
    });
    
    console.log(`Factura enviada por email a ${factura.emailCliente}:`, resp);
    return { ok: true, resp };
    
  } catch (err) {
    console.error(`Error enviando factura por email:`, err);
    return { ok: false, error: err.message };
  }
}

// ─── NOTIFICAR AL ADMIN SI ALGO FALLA ─────────────────────────
export async function notificarAdminError(error, contexto = {}) {
  try {
    const resend = getResend();
    
    const htmlError = `
      <h2 style="color:#dc2626;">⚠️ Error en facturación AFIP</h2>
      <p><strong>Error:</strong> ${error.message || error}</p>
      <p><strong>Contexto:</strong></p>
      <pre style="background:#f4f4f5;padding:12px;border-radius:8px;font-size:12px;">
${JSON.stringify(contexto, null, 2)}
      </pre>
      <p style="color:#71717a;font-size:12px;">
        Revisá los logs de Vercel y el panel de AFIP.<br>
        Fecha: ${new Date().toISOString()}
      </p>
    `;
    
    await resend.emails.send({
      from: RESEND_FROM,
      to: ADMIN_EMAIL,
      subject: "⚠️ Error AFIP - Acción requerida",
      html: htmlError,
    });
    
    console.log("Admin notificado del error AFIP");
    
  } catch (err) {
    // Si esto también falla, solo lo logueamos (no recursión)
    console.error("FALLA CRÍTICA: no se pudo notificar al admin:", err);
  }
}

// api/_afip-helper.js
// Helper para integración con AFIP/ARCA — Facturación Electrónica
// NO es una función serverless de Vercel (empieza con _)
// 
// Maneja:
//   ✅ Inicialización del SDK con cert + key desde env vars
//   ✅ Obtener próximo número de factura
//   ✅ Generar Factura C (consumidor final - monotributo)
//   ✅ Guardar factura en Redis
//   ✅ Marcar factura como pendiente si AFIP falla
//   ✅ Reintentar facturas pendientes

import Afip from "@afipsdk/afip.js";

// ─── CONFIGURACIÓN ─────────────────────────────────────────────
const AFIP_CUIT = process.env.AFIP_CUIT;
const AFIP_PUNTO_VENTA = parseInt(process.env.AFIP_PUNTO_VENTA || "1", 10);
const AFIP_PRODUCTION = process.env.AFIP_PRODUCTION === "true";
const AFIP_CERT = process.env.AFIP_CERT;
const AFIP_KEY = process.env.AFIP_KEY;

// ─── SINGLETON ─────────────────────────────────────────────────
let afipInstance = null;

function getAfip() {
  if (afipInstance) return afipInstance;
  
  if (!AFIP_CUIT || !AFIP_CERT || !AFIP_KEY) {
    throw new Error("AFIP no configurado: faltan variables de entorno");
  }
  
  afipInstance = new Afip({
    CUIT: parseInt(AFIP_CUIT, 10),
    production: AFIP_PRODUCTION,
    cert: AFIP_CERT,
    key: AFIP_KEY,
  });
  
  console.log(`AFIP inicializado: CUIT=${AFIP_CUIT}, Prod=${AFIP_PRODUCTION}, PV=${AFIP_PUNTO_VENTA}`);
  return afipInstance;
}

// ─── KV HELPER ─────────────────────────────────────────────────
async function getKV() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

// ─── OBTENER PRÓXIMO NÚMERO DE FACTURA ─────────────────────────
async function getProximoNumero() {
  const afip = getAfip();
  
  // Factura C = tipo 11 (para monotributo)
  const TIPO_FACTURA_C = 11;
  
  try {
    const ultimo = await afip.ElectronicBilling.getLastVoucher(
      AFIP_PUNTO_VENTA, 
      TIPO_FACTURA_C
    );
    return ultimo + 1;
  } catch (err) {
    console.error("Error obteniendo último voucher:", err.message);
    // Si es la primera factura, devolver 1
    if (err.message?.includes("no_voucher")) return 1;
    throw err;
  }
}

// ─── GENERAR FACTURA C ─────────────────────────────────────────
export async function generarFacturaC({ 
  importe, 
  emailCliente, 
  nombreCliente = "Consumidor Final",
  concepto = "AVAI Premium - Suscripción Mensual",
  mpPaymentId,
}) {
  const afip = getAfip();
  
  // 1. Obtener próximo número
  const numeroFactura = await getProximoNumero();
  
  // 2. Preparar datos de la factura
  const fechaHoy = parseInt(
    new Date().toISOString().substring(0, 10).replace(/-/g, ""), 
    10
  ); // YYYYMMDD
  
  const factura = {
    CantReg: 1,                          // 1 comprobante
    PtoVta: AFIP_PUNTO_VENTA,            // tu punto de venta
    CbteTipo: 11,                        // tipo 11 = Factura C
    Concepto: 2,                         // 2 = Servicios
    DocTipo: 99,                         // 99 = Consumidor final (sin CUIT)
    DocNro: 0,                           // sin CUIT
    CbteDesde: numeroFactura,
    CbteHasta: numeroFactura,
    CbteFch: fechaHoy,
    FchServDesde: fechaHoy,
    FchServHasta: fechaHoy,
    FchVtoPago: fechaHoy,
    ImpTotal: importe,                   // total
    ImpTotConc: 0,                       // sin IVA (monotributo)
    ImpNeto: importe,                    // neto = total
    ImpOpEx: 0,                          // sin operaciones exentas
    ImpIVA: 0,                           // sin IVA
    ImpTrib: 0,                          // sin tributos
    MonId: "PES",                        // pesos argentinos
    MonCotiz: 1,                         // cotización 1:1
  };
  
  console.log("Generando factura AFIP:", { numero: numeroFactura, importe, email: emailCliente });
  
  // 3. Crear voucher en AFIP
  const resultado = await afip.ElectronicBilling.createVoucher(factura);
  
  // 4. Armar objeto factura para guardar
  const facturaCompleta = {
    numero: numeroFactura,
    puntoVenta: AFIP_PUNTO_VENTA,
    tipo: "C",
    cae: resultado.CAE,
    caeVencimiento: resultado.CAEFchVto,
    importe,
    fecha: new Date().toISOString(),
    emailCliente: emailCliente.toLowerCase().trim(),
    nombreCliente,
    concepto,
    mpPaymentId: mpPaymentId || null,
    production: AFIP_PRODUCTION,
  };
  
  console.log("Factura generada OK:", { numero: numeroFactura, cae: resultado.CAE });
  
  return facturaCompleta;
}

// ─── GUARDAR FACTURA EN REDIS ──────────────────────────────────
export async function guardarFactura(factura) {
  const kv = await getKV();
  
  // Key principal: factura específica
  const key = `factura:${factura.emailCliente}:${factura.numero}`;
  await kv.set(key, factura);
  
  // Lista de facturas del usuario (para historial)
  const listKey = `facturas:${factura.emailCliente}`;
  await kv.lpush(listKey, factura.numero);
  
  // Contador global de facturas
  await kv.incr("facturas:total");
  
  console.log(`Factura guardada en Redis: ${key}`);
}

// ─── MARCAR FACTURA COMO PENDIENTE (SI AFIP FALLA) ─────────────
export async function marcarFacturaPendiente({ 
  email, 
  importe, 
  mpPaymentId, 
  errorMsg 
}) {
  const kv = await getKV();
  const key = `factura_pendiente:${email}:${mpPaymentId}`;
  
  const pendiente = {
    email: email.toLowerCase().trim(),
    importe,
    mpPaymentId,
    error: errorMsg,
    intentos: 1,
    creado_at: new Date().toISOString(),
    estado: "pendiente",
  };
  
  await kv.set(key, pendiente);
  await kv.lpush("facturas_pendientes:lista", key);
  
  console.warn(`Factura pendiente guardada: ${key}`);
}

// ─── REINTENTAR FACTURAS PENDIENTES ────────────────────────────
// (Esta función la puede llamar un cron job o desde el panel admin)
export async function reintentarPendientes() {
  const kv = await getKV();
  const listKey = "facturas_pendientes:lista";
  const pendientes = await kv.lrange(listKey, 0, 50); // máximo 50 por ejecución
  
  const resultados = { exitosas: 0, fallidas: 0, total: pendientes.length };
  
  for (const key of pendientes) {
    try {
      const pendiente = await kv.get(key);
      if (!pendiente || pendiente.estado === "completada") continue;
      
      const factura = await generarFacturaC({
        importe: pendiente.importe,
        emailCliente: pendiente.email,
        mpPaymentId: pendiente.mpPaymentId,
      });
      
      await guardarFactura(factura);
      
      // Marcar como completada
      pendiente.estado = "completada";
      pendiente.factura_numero = factura.numero;
      await kv.set(key, pendiente);
      await kv.lrem(listKey, 0, key);
      
      resultados.exitosas++;
      console.log(`Pendiente recuperada: ${pendiente.email}`);
      
    } catch (err) {
      resultados.fallidas++;
      console.error(`Error reintentando ${key}:`, err.message);
    }
  }
  
  return resultados;
}

// ─── OBTENER FACTURA POR NÚMERO (para panel admin) ─────────────
export async function getFactura(email, numero) {
  const kv = await getKV();
  return await kv.get(`factura:${email.toLowerCase().trim()}:${numero}`);
}

// ─── LISTAR FACTURAS DE UN USUARIO (historial) ─────────────────
export async function listarFacturasUsuario(email) {
  const kv = await getKV();
  const listKey = `facturas:${email.toLowerCase().trim()}`;
  const numeros = await kv.lrange(listKey, 0, -1);
  
  const facturas = [];
  for (const num of numeros) {
    const fact = await getFactura(email, num);
    if (fact) facturas.push(fact);
  }
  
  return facturas.sort((a, b) => b.numero - a.numero); // más recientes primero
}

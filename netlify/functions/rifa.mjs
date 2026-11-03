// API de la rifa: guarda el tablero en Netlify Blobs y protege las acciones del administrador
// con el código guardado en la variable de entorno ADMIN_CODE (se configura en Netlify).
import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";
import semilla from "../lib/semilla.mjs";

const NUM = /^\d\d$/;
const json = (d, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const hash = (s) => createHash("sha256").update(String(s)).digest();
const codigoValido = (recibido) => {
  const real = process.env.ADMIN_CODE || "";
  if (real.length < 6 || !recibido) return false;
  return timingSafeEqual(hash(recibido), hash(real));
};
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (v, max) => String(v ?? "").trim().slice(0, max);

// Lo que ve cualquier visitante: solo el estado de cada número, sin nombres ni teléfonos.
function publico(e) {
  const boletas = {};
  for (const [k, b] of Object.entries(e.boletas)) boletas[k] = { e: b.e };
  const { whatsapp, nequi, titulo, responsable, valor, ganador } = e.config;
  return { config: { whatsapp, nequi, titulo, responsable, valor, ganador }, boletas, actualizado: e.actualizado,
    ganadorNombre: ganador && e.boletas[ganador] ? e.boletas[ganador].n.split(" ")[0] : "" };
}

// El celular es de la persona, no del número: si se da uno, queda en todos sus números,
// y si alguno de sus números ya tiene celular, los demás lo heredan.
function unificarTel(estado, nombre, tel) {
  const clave = (x) => x.trim().toLowerCase();
  if (nombre && tel) {
    for (const b of Object.values(estado.boletas)) if (clave(b.n) === clave(nombre)) b.tel = tel;
  }
  const telDe = {};
  for (const b of Object.values(estado.boletas)) if (b.tel && !telDe[clave(b.n)]) telDe[clave(b.n)] = b.tel;
  let cambio = false;
  for (const b of Object.values(estado.boletas)) {
    const t = telDe[clave(b.n)];
    if (t && !b.tel) { b.tel = t; cambio = true; }
  }
  return cambio;
}

export default async (req) => {
  const store = getStore({ name: "rifa", consistency: "strong" });
  let estado = await store.get("estado", { type: "json" });
  if (!estado) {
    estado = structuredClone(semilla);
    await store.setJSON("estado", estado);
  }
  if (unificarTel(estado)) await store.setJSON("estado", estado);
  const esAdmin = codigoValido(req.headers.get("x-admin-code"));
  const guardar = async () => {
    estado.actualizado = new Date().toISOString();
    await store.setJSON("estado", estado);
  };

  if (req.method === "GET") return json(esAdmin ? { admin: true, estado } : { admin: false, estado: publico(estado) });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Solicitud inválida" }, 400); }
  const accion = body && body.accion;

  // --- Acciones públicas ---
  if (accion === "login") {
    if (codigoValido(body.codigo)) return json({ admin: true, estado });
    await espera(1200); // frena a quien intente adivinar el código
    return json({ error: "Código incorrecto" }, 401);
  }

  if (accion === "reservar") {
    const nombre = txt(body.nombre, 60);
    const tel = txt(body.tel, 20);
    const numeros = Array.isArray(body.numeros) ? [...new Set(body.numeros.map(String))] : [];
    if (nombre.length < 2) return json({ error: "Escribe tu nombre." }, 400);
    if (!numeros.length || numeros.length > 10 || !numeros.every((n) => NUM.test(n)))
      return json({ error: "Escoge entre 1 y 10 números." }, 400);
    const ocupados = numeros.filter((n) => estado.boletas[n]);
    if (ocupados.length)
      return json({ error: "Alguien ya apartó " + ocupados.join(", ") + ". Escoge otro.", ocupados, estado: publico(estado) }, 409);
    for (const n of numeros) {
      const b = { n: nombre, e: "reservado", web: true, fecha: new Date().toISOString() };
      if (tel) b.tel = tel;
      estado.boletas[n] = b;
    }
    unificarTel(estado, nombre, tel);
    await guardar();
    return json({ ok: true, estado: publico(estado) });
  }

  // --- Acciones del administrador ---
  if (!esAdmin) { await espera(800); return json({ error: "Solo el responsable puede hacer este cambio." }, 401); }

  if (accion === "guardar") {
    const k = String(body.k || "");
    if (!NUM.test(k)) return json({ error: "Número inválido" }, 400);
    if (body.e === "free") delete estado.boletas[k];
    else {
      const n = txt(body.n, 60);
      if (!n) return json({ error: "Escribe el nombre de quien compró el número." }, 400);
      const b = { n, e: body.e === "paid" ? "pagado" : "reservado" };
      const tel = txt(body.tel, 20), nota = txt(body.nota, 200);
      if (tel) b.tel = tel;
      if (nota) b.nota = nota;
      estado.boletas[k] = b;
      unificarTel(estado, n, tel);
    }
  } else if (accion === "pagar-todo") {
    const nombre = txt(body.nombre, 60).toLowerCase();
    for (const b of Object.values(estado.boletas)) if (b.n.trim().toLowerCase() === nombre) b.e = "pagado";
  } else if (accion === "persona") {
    // Cambia el nombre y/o celular de una persona en todos sus números
    const nombre = txt(body.nombre, 60).toLowerCase();
    const nuevo = txt(body.nuevo, 60);
    const tel = txt(body.tel, 20);
    if (nuevo.length < 2) return json({ error: "Escribe el nombre." }, 400);
    let n = 0;
    for (const b of Object.values(estado.boletas)) {
      if (b.n.trim().toLowerCase() !== nombre) continue;
      b.n = nuevo;
      if (tel) b.tel = tel; else delete b.tel;
      n++;
    }
    if (!n) return json({ error: "No encontré a esa persona. Recarga la página." }, 404);
  } else if (accion === "nota-x") {
    const i = Number(body.i);
    if (Number.isInteger(i) && i >= 0) estado.notas.splice(i, 1);
  } else if (accion === "config") {
    estado.config.whatsapp = txt(body.whatsapp, 20).replace(/[^\d+]/g, "");
    estado.config.nequi = txt(body.nequi, 20).replace(/\D/g, "");
    const g = String(body.ganador ?? "").replace(/\D/g, "");
    estado.config.ganador = g ? g.padStart(2, "0").slice(-2) : "";
  } else {
    return json({ error: "Acción desconocida" }, 400);
  }
  await guardar();
  return json({ admin: true, estado });
};

export const config = { path: "/api/rifa" };

import { supabase } from "@/lib/supabase";

/**
 * Acceso a datos contra Supabase.
 *
 * La migración va por módulos: acá vive lo que ya dejó de guardarse en el
 * navegador. Cada función devuelve { datos } o { error } con un mensaje
 * entendible, para que las pantallas no tengan que interpretar códigos.
 */

const traducir = (error) => {
  if (!error) return null;
  const m = (error.message || "").toLowerCase();
  if (m.includes("permission denied") || m.includes("row-level security"))
    return "No tienes permiso para hacer esto.";
  if (m.includes("duplicate key")) return "Ya existe un registro igual.";
  if (m.includes("failed to fetch")) return "Sin conexión. Revisa tu internet.";
  return error.message || "Ocurrió un error inesperado.";
};

/* ---------------- Equipo ---------------- */

export async function listarEquipo() {
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, telefono, rol, comision, activo, debe_cambiar_clave")
    .order("activo", { ascending: false })
    .order("nombre");
  if (error) return { error: traducir(error) };
  return { datos: data || [] };
}

/**
 * Editar un miembro. La base impide cambiar el rol o la comisión de uno mismo,
 * y quedarse sin administradores: si eso ocurre, devuelve el motivo.
 */
export async function guardarMiembro(id, cambios) {
  const permitidos = {
    nombre: cambios.nombre,
    telefono: cambios.telefono || null,
    rol: cambios.rol,
    comision: cambios.comision,
    activo: cambios.activo,
  };
  const { error } = await supabase.from("perfiles").update(permitidos).eq("id", id);
  if (error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("propio rol")) return { error: "No puedes cambiar tu propio rol." };
    if (m.includes("propia comisión") || m.includes("propia comision"))
      return { error: "No puedes cambiar tu propia comisión." };
    if (m.includes("sin ningún administrador") || m.includes("sin ningun administrador"))
      return { error: "No puedes dejar la barbería sin ningún administrador activo." };
    return { error: traducir(error) };
  }
  return { ok: true };
}

export async function cambiarActivo(id, activo) {
  return guardarMiembro(id, { activo });
}

/* ---------------- Servicios ---------------- */

export async function listarServicios() {
  const { data, error } = await supabase
    .from("servicios")
    .select("id, nombre, descripcion, duracion, precio, activo, foto_path")
    .order("precio");
  if (error) return { error: traducir(error) };
  return { datos: (data || []).map((s) => ({ ...s, foto: s.foto_path })) };
}

export async function guardarServicio(barberiaId, s) {
  const fila = {
    nombre: s.nombre, descripcion: s.descripcion || null,
    duracion: Number(s.duracion) || 30, precio: Number(s.precio) || 0,
    activo: s.activo !== false, foto_path: s.foto || null,
  };
  const { error } = s.id
    ? await supabase.from("servicios").update(fila).eq("id", s.id)
    : await supabase.from("servicios").insert({ ...fila, barberia_id: barberiaId });
  return error ? { error: traducir(error) } : { ok: true };
}

export async function borrarServicio(id) {
  const { error } = await supabase.from("servicios").delete().eq("id", id);
  return error ? { error: traducir(error) } : { ok: true };
}

/* ---------------- Sucursales ---------------- */

export async function listarSucursales() {
  const { data, error } = await supabase
    .from("sucursales")
    .select("id, nombre, direccion, telefono, activa")
    .order("nombre");
  if (error) return { error: traducir(error) };
  return { datos: data || [] };
}

export async function guardarSucursal(barberiaId, s) {
  const fila = {
    nombre: s.nombre, direccion: s.direccion || null,
    telefono: s.telefono || null, activa: s.activa !== false,
  };
  const { error } = s.id
    ? await supabase.from("sucursales").update(fila).eq("id", s.id)
    : await supabase.from("sucursales").insert({ ...fila, barberia_id: barberiaId });
  return error ? { error: traducir(error) } : { ok: true };
}

export async function borrarSucursal(id) {
  const { error } = await supabase.from("sucursales").delete().eq("id", id);
  return error ? { error: traducir(error) } : { ok: true };
}

/* ---------------- Clientes ---------------- */

const deCliente = (c) => ({
  id: c.id, nombre: c.nombre, telefono: c.telefono || "", correo: c.correo || "",
  vip: c.vip, cortes: c.cortes || 0,
  ultimaVisita: c.ultima_visita || null,
  observaciones: c.observaciones || "",
  tipoPelo: c.tipo_pelo || "", densidad: c.densidad || "",
  formaRostro: c.forma_rostro || "",
  visagismo: c.visagismo || null,
  anonimizado: Boolean(c.anonimizado_en),
});

export async function listarClientes() {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, correo, vip, cortes, ultima_visita, observaciones, tipo_pelo, densidad, forma_rostro, visagismo, anonimizado_en")
    .order("nombre");
  if (error) return { error: traducir(error) };
  return { datos: (data || []).map(deCliente) };
}

export async function crearCliente(barberiaId, c) {
  const { data, error } = await supabase.from("clientes").insert({
    barberia_id: barberiaId,
    nombre: c.nombre, telefono: c.telefono || null, correo: c.correo || null,
  }).select("id").single();
  return error ? { error: traducir(error) } : { datos: data };
}

export async function guardarCliente(id, c) {
  const fila = {};
  if ("nombre" in c) fila.nombre = c.nombre;
  if ("telefono" in c) fila.telefono = c.telefono || null;
  if ("correo" in c) fila.correo = c.correo || null;
  if ("vip" in c) fila.vip = c.vip;
  if ("observaciones" in c) fila.observaciones = c.observaciones || null;
  if ("tipoPelo" in c) fila.tipo_pelo = c.tipoPelo || null;
  if ("densidad" in c) fila.densidad = c.densidad || null;
  if ("formaRostro" in c) fila.forma_rostro = c.formaRostro || null;
  if ("visagismo" in c) fila.visagismo = c.visagismo;

  const { error } = await supabase.from("clientes").update(fila).eq("id", id);
  if (error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("visagismo"))
      return { error: "El cliente no autorizó el análisis de visagismo." };
    return { error: traducir(error) };
  }
  return { ok: true };
}

/* Consentimientos: la ley exige uno separado por finalidad */
export async function darConsentimiento(barberiaId, clienteId, tipo) {
  const { error } = await supabase.from("consentimientos").insert({
    barberia_id: barberiaId, cliente_id: clienteId, tipo,
    texto_version: "v1", origen: "mostrador",
  });
  /* Si ya existe uno vigente, no es un error */
  if (error && !(error.message || "").toLowerCase().includes("duplicate"))
    return { error: traducir(error) };
  return { ok: true };
}

export async function tieneConsentimiento(clienteId, tipo) {
  const { data, error } = await supabase
    .from("consentimientos")
    .select("id")
    .eq("cliente_id", clienteId).eq("tipo", tipo).is("revocado_en", null)
    .maybeSingle();
  if (error) return { datos: false };
  return { datos: Boolean(data) };
}

/* ---------------- Reservas ---------------- */

const deReserva = (r) => ({
  id: r.id, sucursalId: r.sucursal_id, clienteId: r.cliente_id,
  clienteNombre: r.cliente_nombre, barberoId: r.barbero_id,
  servicioId: r.servicio_id, fecha: r.fecha,
  hora: (r.hora || "").slice(0, 5),
  estado: r.estado, notas: r.notas || "", foto: r.foto || null,
});

export async function listarReservas() {
  const { data, error } = await supabase
    .from("reservas")
    .select("id, sucursal_id, cliente_id, cliente_nombre, barbero_id, servicio_id, fecha, hora, estado, notas, foto")
    .order("fecha", { ascending: false })
    .limit(2000);
  if (error) return { error: traducir(error) };
  return { datos: (data || []).map(deReserva) };
}

export async function crearReserva(barberiaId, r) {
  const { data, error } = await supabase.from("reservas").insert({
    barberia_id: barberiaId,
    sucursal_id: r.sucursalId || null,
    cliente_id: r.clienteId || null,
    cliente_nombre: r.clienteNombre,
    barbero_id: r.barberoId || null,
    servicio_id: r.servicioId || null,
    fecha: r.fecha, hora: r.hora,
    estado: r.estado || "reservado",
    notas: r.notas || null,
  }).select("id").single();
  return error ? { error: traducir(error) } : { datos: data };
}

export async function guardarReserva(id, r) {
  const fila = {};
  if ("estado" in r) fila.estado = r.estado;
  if ("notas" in r) fila.notas = r.notas || null;
  if ("foto" in r) fila.foto = r.foto;
  if ("clienteId" in r) fila.cliente_id = r.clienteId;

  const { error } = await supabase.from("reservas").update(fila).eq("id", id);
  if (error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("fotos de su corte"))
      return { error: "El cliente no autorizó que se guarden fotos de su corte." };
    return { error: traducir(error) };
  }
  return { ok: true };
}

/* ---------------- Finanzas ---------------- */

export async function listarIngresos() {
  const { data, error } = await supabase
    .from("ingresos").select("id, fecha, concepto, metodo, monto, barbero_id, reserva_id")
    .order("fecha", { ascending: false }).limit(2000);
  if (error) return { datos: [] };   // el barbero no los ve: no es un fallo
  return { datos: (data || []).map((i) => ({ ...i, barberoId: i.barbero_id })) };
}

export async function crearIngreso(barberiaId, i) {
  const { error } = await supabase.from("ingresos").insert({
    barberia_id: barberiaId, fecha: i.fecha, concepto: i.concepto,
    metodo: i.metodo || "efectivo", monto: Number(i.monto) || 0,
    barbero_id: i.barberoId || null, reserva_id: i.reservaId || null,
  });
  return error ? { error: traducir(error) } : { ok: true };
}

export async function listarGastos() {
  const { data, error } = await supabase
    .from("gastos").select("id, fecha, categoria, descripcion, monto")
    .order("fecha", { ascending: false }).limit(2000);
  if (error) return { datos: [] };
  return { datos: data || [] };
}

export async function crearGasto(barberiaId, g) {
  const { error } = await supabase.from("gastos").insert({
    barberia_id: barberiaId, fecha: g.fecha, categoria: g.categoria,
    descripcion: g.descripcion || null, monto: Number(g.monto) || 0,
  });
  return error ? { error: traducir(error) } : { ok: true };
}

export async function listarPagosComision() {
  const { data, error } = await supabase
    .from("pagos_comision").select("id, barbero_id, mes, monto, metodo")
    .order("mes", { ascending: false });
  if (error) return { datos: [] };
  return { datos: (data || []).map((p) => ({ ...p, barberoId: p.barbero_id })) };
}

export async function crearPagoComision(barberiaId, p) {
  const { error } = await supabase.from("pagos_comision").insert({
    barberia_id: barberiaId, barbero_id: p.barberoId, mes: p.mes,
    monto: Number(p.monto) || 0, metodo: p.metodo || "transferencia",
  });
  return error ? { error: traducir(error) } : { ok: true };
}

/* ---------------- Campañas ---------------- */

export async function crearCampana(barberiaId, c) {
  const { error } = await supabase.from("campanas").insert({
    barberia_id: barberiaId, canal: c.canal, segmento: c.segmento,
    mensaje: c.mensaje, destinatarios: c.destinatarios || 0,
  });
  return error ? { error: traducir(error) } : { ok: true };
}

/* ---------------- Barbería ---------------- */

export async function guardarBarberia(id, cambios) {
  const { error } = await supabase.from("barberias").update(cambios).eq("id", id);
  if (error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("duplicate") || m.includes("unique"))
      return { error: "Esa dirección de link ya la usa otra barbería. Prueba con otra." };
    return { error: traducir(error) };
  }
  return { ok: true };
}

/* ---------------- Página pública de reservas ----------------
   El visitante no tiene sesión: no toca las tablas, solo estas tres
   funciones controladas que devuelven lo mínimo necesario.            */

export async function publicoBarberia(slug) {
  const { data, error } = await supabase.rpc("publico_barberia", { p_slug: slug });
  if (error) return { error: traducir(error) };
  if (!data) return { datos: null };
  return { datos: data };
}

export async function publicoHorasOcupadas(slug, fecha, sucursalId, barberoId) {
  const { data, error } = await supabase.rpc("publico_horas_ocupadas", {
    p_slug: slug,
    p_fecha: fecha,
    p_sucursal: sucursalId || null,
    p_barbero: barberoId || null,
  });
  if (error) return { error: traducir(error) };
  return { datos: data || [] };
}

export async function publicoReservar(datos) {
  const { data, error } = await supabase.rpc("publico_reservar", {
    p_slug: datos.slug,
    p_sucursal: datos.sucursalId || null,
    p_servicio: datos.servicioId,
    p_barbero: datos.barberoId || null,
    p_fecha: datos.fecha,
    p_hora: datos.hora,
    p_nombre: datos.nombre,
    p_telefono: datos.telefono,
    p_correo: datos.correo || null,
    p_acepta_datos: datos.aceptaDatos === true,
  });
  if (error) {
    /* Los mensajes de la base vienen ya redactados para el cliente */
    const m = error.message || "";
    const limpio = m.replace(/^.*?:\s*/, "");
    return { error: limpio || traducir(error) };
  }
  return { datos: data };
}

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

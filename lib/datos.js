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

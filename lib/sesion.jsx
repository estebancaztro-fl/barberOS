"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, haySupabase } from "@/lib/supabase";

/**
 * Sesión del usuario.
 *
 * El rol y la barbería salen de la tabla `perfiles`, no del navegador.
 * Aunque alguien manipule el código en su equipo, las políticas de la base
 * siguen decidiendo qué puede ver: acá solo se ajusta lo que se muestra.
 */
const Ctx = createContext(null);

export function SesionProvider({ children }) {
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState(null);   // auth.users
  const [perfil, setPerfil] = useState(null);     // perfiles + barbería
  const [error, setError] = useState("");

  const cargarPerfil = useCallback(async (uid) => {
    if (!uid) { setPerfil(null); return; }

    /* Se piden primero las columnas nuevas y, si la base todavía no las
       tiene, se reintenta con las de siempre.

       Sin esto, subir código antes de correr una migración deja a todo el
       mundo afuera con un mensaje que además miente: la consulta falla por
       una columna que no existe, no porque al usuario le falte el perfil. */
    const BASE = "id, nombre, correo, telefono, rol, comision, activo, debe_cambiar_clave, barberia_id";
    const CAMPOS_BARBERIA = "id, nombre, slug, logo_url, slugs_anteriores, onboarding_completo";
    const EXTRA_BARBERIA = "recordatorio_activo, recordatorio_minutos, recordatorio_plantilla, whatsapp_modo";

    const pedir = (campos) =>
      supabase.from("perfiles").select(`${BASE}, barberias(${campos})`).eq("id", uid).single();

    let { data, error } = await pedir(`${CAMPOS_BARBERIA}, ${EXTRA_BARBERIA}`);

    if (error && /column|does not exist|schema cache/i.test(error.message || "")) {
      console.warn("Faltan migraciones por correr:", error.message);
      ({ data, error } = await pedir(CAMPOS_BARBERIA));
    }

    if (error) {
      /* No es lo mismo no tener perfil que no poder consultarlo */
      const m = (error.message || "").toLowerCase();
      if (m.includes("permission denied") || m.includes("row-level security")) {
        setError("El servidor no tiene permiso para leer tu perfil. Revisa las migraciones de permisos.");
      } else if (error.code === "PGRST116" || m.includes("no rows")) {
        setError("Tu usuario existe pero no tiene perfil en ninguna barbería.");
      } else {
        setError("No se pudo cargar tu perfil: " + (error.message || "error desconocido"));
      }
      setPerfil(null);
      return;
    }
    if (!data.activo) {
      setError("Tu cuenta está desactivada. Habla con el administrador.");
      setPerfil(null);
      return;
    }
    setError("");
    setPerfil(data);
  }, []);

  useEffect(() => {
    if (!haySupabase) { setCargando(false); return; }

    supabase.auth.getSession().then(async ({ data }) => {
      const u = data?.session?.user ?? null;
      setUsuario(u);
      await cargarPerfil(u?.id);
      setCargando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evento, sesion) => {
      const u = sesion?.user ?? null;
      setUsuario(u);
      await cargarPerfil(u?.id);
      setCargando(false);
    });

    return () => sub?.subscription?.unsubscribe();
  }, [cargarPerfil]);

  const entrar = async (correo, clave) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim().toLowerCase(),
      password: clave,
    });
    return error;
  };

  const salir = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setPerfil(null);
  };

  const valor = {
    cargando, usuario, perfil, error, entrar, salir, haySupabase,
    recargarPerfil: () => cargarPerfil(usuario?.id),
    autenticado: Boolean(usuario && perfil),
    debeCambiarClave: Boolean(perfil?.debe_cambiar_clave),
    /* El asistente solo lo ve el administrador de una barbería recién creada */
    debeConfigurar: Boolean(
      perfil?.rol === "admin" && perfil?.barberias && perfil.barberias.onboarding_completo === false
    ),
    rol: perfil?.rol ?? null,
    barberia: perfil?.barberias ?? null,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useSesion = () => useContext(Ctx);

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
    const { data, error } = await supabase
      .from("perfiles")
      .select("id, nombre, correo, telefono, rol, comision, activo, debe_cambiar_clave, barberia_id, barberias(id, nombre, slug, logo_url, slugs_anteriores, onboarding_completo)")
      .eq("id", uid)
      .single();

    if (error) {
      setError("Tu usuario existe pero no tiene perfil en ninguna barbería.");
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

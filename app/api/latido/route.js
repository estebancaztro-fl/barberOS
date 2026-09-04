import { clienteAdmin } from "@/lib/servidor";

export const dynamic = "force-dynamic";

/**
 * Latido para que Supabase no pause el proyecto.
 *
 * El plan gratis pausa un proyecto tras 7 días sin actividad, y una barbería
 * que abre el lunes y encuentra su agenda caída no vuelve. Esta ruta hace una
 * consulta mínima una vez al día, lo que basta para mantenerlo despierto.
 *
 * Es un parche mientras no haya clientes pagando. Con clientes de verdad
 * corresponde el plan Pro: además de no pausar, trae respaldos diarios, que
 * es lo que en serio importa cuando guardas la agenda y la plata de otros.
 */
export async function GET(request) {
  /* Vercel manda este encabezado si configuraste CRON_SECRET. Sin la
     comprobación, cualquiera podría llamar la ruta a discreción. */
  const secreto = process.env.CRON_SECRET;
  if (secreto) {
    const cabecera = request.headers.get("authorization");
    if (cabecera !== `Bearer ${secreto}`) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const admin = clienteAdmin();
  if (!admin) return Response.json({ ok: false, motivo: "sin clave secreta" });

  /* La consulta más barata posible: solo confirma que la base responde */
  const { error } = await admin
    .from("barberias")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("latido", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, cuando: new Date().toISOString() });
}

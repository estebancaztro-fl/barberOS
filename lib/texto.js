/**
 * Utilidades de texto sin dependencias.
 *
 * Viven aparte del store porque el servidor también las necesita, y el store
 * es código de navegador ("use client"): importarlo desde una ruta del
 * servidor arrastraría React entero.
 */

/**
 * Convierte el nombre de la barbería en dirección para el link público.
 * "Barbería Ñuñoa & Co." → "barberia-nunoa-co"
 */
export function aSlug(texto) {
  return (texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // quita tildes
    .replace(/ñ/gi, "n")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "barberia";
}

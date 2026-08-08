/**
 * Comprime una foto antes de guardarla.
 *
 * Una foto de celular pesa 3-5 MB y el almacenamiento del navegador solo
 * aguanta unos 5 MB en total, así que guardarlas tal cual llenaría el
 * espacio con dos o tres cortes. Redimensionamos el lado mayor y bajamos
 * la calidad: una foto queda en torno a 60-90 KB, suficiente para ver el
 * corte en la ficha.
 */

const MAX_LADO = 900;
const CALIDAD = 0.72;

export async function comprimirImagen(file, maxLado = MAX_LADO, calidad = CALIDAD) {
  const bitmap = await cargar(file);
  const esc = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * esc);
  const h = Math.round(bitmap.height * esc);

  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  return cv.toDataURL("image/jpeg", calidad);
}

/* createImageBitmap respeta la orientación EXIF; si no existe, usamos <img> */
async function cargar(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {}
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Peso aproximado en KB de un dataURL */
export function pesoKB(dataUrl) {
  if (!dataUrl) return 0;
  const base64 = dataUrl.split(",")[1] || "";
  return Math.round((base64.length * 3) / 4 / 1024);
}

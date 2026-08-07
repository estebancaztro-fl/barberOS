/**
 * Análisis de forma del rostro — 100% en el dispositivo, sin servicios externos.
 *
 * Cómo funciona:
 *  1. MediaPipe Face Mesh detecta 468 puntos del rostro sobre la foto.
 *  2. Se corrige la inclinación de la cabeza alineando la línea de los ojos.
 *  3. Se miden 4 distancias: largo, pómulos, mandíbula y frente.
 *  4. Se comparan las proporciones contra un perfil de referencia por cada
 *     forma de rostro y se calcula el porcentaje de similitud con cada una.
 *
 * No hay entrenamiento ni dataset: las referencias son proporciones
 * antropométricas, así que el resultado siempre se puede explicar.
 */

/* Índices de los puntos de MediaPipe Face Mesh que usamos */
export const PUNTOS = {
  frenteArriba: 10,   // nacimiento del pelo (centro)
  menton: 152,        // punta del mentón
  ojoIzq: 33,         // esquina externa ojo izquierdo
  ojoDer: 263,        // esquina externa ojo derecho
  frenteIzq: 21,      // sien izquierda
  frenteDer: 251,     // sien derecha
  pomuloIzq: 234,     // pómulo izquierdo (punto más ancho)
  pomuloDer: 454,     // pómulo derecho
  mandibulaIzq: 58,   // ángulo mandibular izquierdo
  mandibulaDer: 288,  // ángulo mandibular derecho
};

/**
 * Perfiles de referencia. Cada forma se define por 3 proporciones:
 *   r1 = largo / ancho de pómulos
 *   r2 = ancho de mandíbula / ancho de pómulos
 *   r3 = ancho de frente / ancho de pómulos
 */
export const FORMAS = {
  Ovalado: {
    r1: 1.42, r2: 0.84, r3: 0.88,
    resumen: "Largo algo mayor que el ancho, con la mandíbula más estrecha que los pómulos.",
    favorece: [
      "Prácticamente cualquier corte le queda bien",
      "Degradado medio o alto con textura arriba",
      "Corte clásico con raya al costado",
    ],
    evitar: ["Flequillos muy pesados que tapen la frente completa"],
  },
  Redondo: {
    r1: 1.05, r2: 0.90, r3: 0.88,
    resumen: "Largo y ancho parecidos, con contorno suave y mandíbula poco marcada.",
    favorece: [
      "Volumen y altura arriba para estilizar",
      "Degradado alto o laterales cortos",
      "Barba corta en el mentón para alargar",
    ],
    evitar: ["Laterales con volumen", "Cortes redondeados tipo casquete", "Flequillo recto"],
  },
  Cuadrado: {
    r1: 1.15, r2: 0.98, r3: 0.96,
    resumen: "Frente, pómulos y mandíbula de ancho similar, con mandíbula marcada y angular.",
    favorece: [
      "Textura y movimiento arriba para suavizar",
      "Degradado medio, sin rapar demasiado",
      "Barba corta y perfilada que acompañe la línea",
    ],
    evitar: ["Cortes muy rectos que remarquen la mandíbula", "Laterales rapados al cero"],
  },
  Alargado: {
    r1: 1.62, r2: 0.90, r3: 0.90,
    resumen: "Rostro notoriamente más largo que ancho.",
    favorece: [
      "Volumen a los lados, no arriba",
      "Flequillo o pelo hacia adelante para acortar",
      "Barba con volumen en los laterales",
    ],
    evitar: ["Tupé o mucha altura arriba", "Laterales muy rapados"],
  },
  Triangular: {
    r1: 1.25, r2: 1.04, r3: 0.82,
    resumen: "Mandíbula más ancha que la frente.",
    favorece: [
      "Volumen arriba y en la zona de las sienes",
      "Corte con textura que amplíe la parte superior",
      "Barba corta y cerrada para afinar el mentón",
    ],
    evitar: ["Laterales muy rapados", "Barba frondosa en la mandíbula"],
  },
  Invertido: {
    r1: 1.25, r2: 0.74, r3: 1.00,
    resumen: "Frente ancha y mentón fino, en triángulo invertido.",
    favorece: [
      "Flequillo o pelo con caída adelante",
      "Barba que dé peso al mentón",
      "Laterales medios, sin rapar",
    ],
    evitar: ["Mucho volumen arriba", "Peinar el pelo hacia atrás dejando la frente al aire"],
  },
};

export const NOMBRES_FORMAS = Object.keys(FORMAS);

/* Peso de cada proporción en la comparación */
const PESOS = { r1: 1.0, r2: 1.35, r3: 1.15 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Convierte los puntos normalizados (0..1) a píxeles y corrige la
 * inclinación de la cabeza rotando según la línea de los ojos.
 */
export function normalizarPuntos(landmarks, ancho, alto) {
  const px = landmarks.map((p) => ({ x: p.x * ancho, y: p.y * alto }));
  const oi = px[PUNTOS.ojoIzq];
  const od = px[PUNTOS.ojoDer];
  const angulo = Math.atan2(od.y - oi.y, od.x - oi.x);
  const cos = Math.cos(-angulo);
  const sin = Math.sin(-angulo);
  const cx = (oi.x + od.x) / 2;
  const cy = (oi.y + od.y) / 2;
  return px.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

/** Devuelve las 4 medidas base, en píxeles */
export function medirRostro(puntos) {
  return {
    largo: dist(puntos[PUNTOS.frenteArriba], puntos[PUNTOS.menton]),
    pomulos: dist(puntos[PUNTOS.pomuloIzq], puntos[PUNTOS.pomuloDer]),
    mandibula: dist(puntos[PUNTOS.mandibulaIzq], puntos[PUNTOS.mandibulaDer]),
    frente: dist(puntos[PUNTOS.frenteIzq], puntos[PUNTOS.frenteDer]),
  };
}

/**
 * Compara las proporciones medidas contra cada perfil de referencia.
 * Devuelve la lista de formas ordenada por similitud (0-100).
 */
export function clasificar(medidas) {
  const { largo, pomulos, mandibula, frente } = medidas;
  if (!pomulos) return null;

  const r = {
    r1: largo / pomulos,
    r2: mandibula / pomulos,
    r3: frente / pomulos,
  };

  /* Cada forma se puntúa por separado: 100 = proporciones idénticas
     a la referencia. No se reparte un total entre las seis. */
  const ranking = NOMBRES_FORMAS.map((nombre) => {
    const ref = FORMAS[nombre];
    let d2 = 0;
    for (const k of ["r1", "r2", "r3"]) {
      const dif = (r[k] - ref[k]) / ref[k]; // diferencia relativa
      d2 += PESOS[k] * dif * dif;
    }
    const distancia = Math.sqrt(d2);
    return { nombre, distancia, similitud: Math.round(100 * Math.exp(-2.5 * distancia)) };
  }).sort((a, b) => b.similitud - a.similitud);

  /* Si las dos primeras están muy cerca, el resultado es dudoso */
  const margen = ranking[0].similitud - ranking[1].similitud;
  const confianza = margen >= 12 ? "alta" : margen >= 5 ? "media" : "baja";

  return { proporciones: r, ranking, forma: ranking[0].nombre, margen, confianza };
}

/** Explicación en palabras de por qué salió esa forma */
export function explicar(proporciones) {
  const { r1, r2, r3 } = proporciones;
  const notas = [];

  if (r1 > 1.5) notas.push("El rostro es bastante más largo que ancho.");
  else if (r1 < 1.15) notas.push("El largo y el ancho del rostro son parecidos.");
  else notas.push("El largo del rostro supera levemente su ancho.");

  if (r2 > 0.97) notas.push("La mandíbula es casi tan ancha como los pómulos: contorno marcado.");
  else if (r2 < 0.8) notas.push("La mandíbula es notoriamente más estrecha que los pómulos.");
  else notas.push("La mandíbula es algo más estrecha que los pómulos.");

  const dif = r3 - r2;
  if (dif > 0.1) notas.push("La frente es más ancha que la mandíbula.");
  else if (dif < -0.1) notas.push("La mandíbula es más ancha que la frente.");
  else notas.push("Frente y mandíbula tienen un ancho similar.");

  return notas;
}

/** Análisis completo a partir de los puntos detectados */
export function analizar(landmarks, ancho, alto) {
  const puntos = normalizarPuntos(landmarks, ancho, alto);
  const medidas = medirRostro(puntos);
  const res = clasificar(medidas);
  if (!res) return null;
  return {
    ...res,
    medidas,
    puntos,
    explicacion: explicar(res.proporciones),
    recomendaciones: FORMAS[res.forma],
  };
}

/**
 * Revisión del proyecto antes de subirlo.
 *
 * Resuelve los imports "@/..." de verdad, así detecta funciones que se usan
 * pero no se importaron — el tipo de error que solo aparece cuando el usuario
 * toca el botón, no al compilar.
 *
 * Uso:  node revisar.mjs
 * (requiere esbuild:  npm i -D esbuild)
 */
import { readdirSync, statSync } from "fs";

/* esbuild es opcional: si no está instalado, se hace igual la revisión
   de imports faltantes, que es la que caza los errores más molestos. */
let build = null;
try { ({ build } = await import("esbuild")); } catch {}
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const raiz = dirname(fileURLToPath(import.meta.url));

/* Resuelve @/lib/store → ./lib/store.jsx probando las extensiones reales */
const aliasArroba = {
  name: "alias-arroba",
  setup(b) {
    /* El CSS lo maneja Next, acá no aporta nada revisarlo */
    b.onResolve({ filter: /\.css$/ }, () => ({ path: "css-ignorado", namespace: "vacio" }));
    b.onLoad({ filter: /.*/, namespace: "vacio" }, () => ({ contents: "", loader: "js" }));

    b.onResolve({ filter: /^@\// }, (args) => {
      const base = join(raiz, args.path.slice(2));
      for (const ext of ["", ".jsx", ".js", "/index.jsx", "/index.js"]) {
        const p = base + ext;
        try { if (statSync(p).isFile()) return { path: p }; } catch {}
      }
      return { errors: [{ text: `No se encuentra el módulo ${args.path}` }] };
    });
  },
};

function archivos(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".next" || n.startsWith("_")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (/\.(jsx|js)$/.test(n)) acc.push(p);
  }
  return acc;
}

const entradas = ["app", "components", "lib"]
  .flatMap((d) => { try { return archivos(resolve(raiz, d)); } catch { return []; } });

let fallos = 0;
for (const entrada of build ? entradas : []) {
  try {
    await build({
      entryPoints: [entrada],
      bundle: true,
      write: false,
      logLevel: "silent",
      format: "esm",
      platform: "neutral",
      loader: { ".js": "jsx", ".jsx": "jsx", ".svg": "text" },
      plugins: [aliasArroba],
      /* Solo se externalizan las librerías de terceros: los módulos propios
         SÍ se resuelven, que es lo que permite cazar imports faltantes */
      external: ["react", "react-dom", "react/*", "next", "next/*", "@supabase/*", "crypto"],
    });
    process.stdout.write(".");
  } catch (e) {
    fallos++;
    const rel = entrada.replace(raiz + "/", "");
    console.log(`\n\n✗ ${rel}`);
    for (const err of e.errors || []) {
      const l = err.location;
      console.log(`   ${err.text}${l ? `  (línea ${l.line})` : ""}`);
    }
  }
}

/* ============================================================
   Segunda revisión: funciones propias usadas sin importar.

   Compilar NO detecta esto: JavaScript asume que un nombre desconocido
   podría ser una variable global, así que el error solo aparece cuando el
   usuario toca el botón. Es exactamente lo que rompió el guardado del
   visagismo, así que se revisa a propósito.
   ============================================================ */

import { readFileSync } from "fs";

/* Nombres que exporta cada módulo propio */
const exportados = new Map();
for (const archivo of entradas) {
  const src = readFileSync(archivo, "utf8");
  const nombres = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/g))
    nombres.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g))
    for (const parte of m[1].split(","))
      nombres.add(parte.trim().split(/\s+as\s+/).pop().trim());
  if (/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/.test(src))
    nombres.add(src.match(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/)[1]);
  for (const n of nombres) if (n) exportados.set(n, archivo);
}

/* Quita comentarios y textos para no confundir menciones en prosa */
const limpiar = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ")
   .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
   .replace(/"(?:[^"\\]|\\.)*"/g, '""')
   .replace(/'(?:[^'\\]|\\.)*'/g, "''")
   .replace(/`(?:[^`\\]|\\.)*`/g, "``");

let sinImportar = 0;
for (const archivo of entradas) {
  const src = readFileSync(archivo, "utf8");
  const cuerpo = limpiar(src.replace(/^import[\s\S]*?from\s*["'][^"']+["'];?/gm, ""));

  /* Lo que este archivo importa o define por su cuenta */
  const disponibles = new Set();
  /* Contempla las tres formas: import {a}, import X, {a}  e  import * as X */
  for (const m of src.matchAll(/import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]+)\}\s*from/g))
    for (const p of m[1].split(",")) disponibles.add(p.trim().split(/\s+as\s+/).pop().trim());
  for (const m of src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/g)) disponibles.add(m[1]);
  for (const m of src.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)/g)) disponibles.add(m[1]);
  for (const m of cuerpo.matchAll(/(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g))
    disponibles.add(m[1]);

  const faltan = [];
  for (const [nombre, origen] of exportados) {
    if (origen === archivo || disponibles.has(nombre)) continue;
    /* Tres formas de uso real, escritas para no confundirse con prosa:
         nombre(        llamada
         nombre.algo    acceso a propiedad — el punto debe ir seguido de letra,
                        si no "desde Admin." se leería como uso
         <Nombre        etiqueta JSX — el < va ANTES, si no "Clientes</span>"
                        (texto suelto) contaría como componente                */
    const comoLlamada  = new RegExp(`(?<![\\w$.])${nombre}\\s*\\(`).test(cuerpo);
    const comoPropiedad = new RegExp(`(?<![\\w$.])${nombre}\\.[A-Za-z_$]`).test(cuerpo);
    const comoEtiqueta = new RegExp(`<\\s*${nombre}[\\s/>]`).test(cuerpo);
    const usado = comoLlamada || comoPropiedad || comoEtiqueta;
    if (usado) faltan.push(`${nombre}  (se exporta desde ${origen.replace(raiz + "/", "")})`);
  }

  if (faltan.length) {
    sinImportar++;
    console.log(`\n✗ ${archivo.replace(raiz + "/", "")}`);
    for (const f of faltan) console.log(`   usa "${f}" pero no lo importa`);
  }
}

const total = fallos + sinImportar;
console.log(
  total === 0
    ? `\n✓ ${entradas.length} archivos revisados, sin problemas`
    : `\n✗ ${total} archivo(s) con problemas`
);
process.exit(total ? 1 : 0);

"use client";
import { useState, useRef, useEffect } from "react";
import Modal from "@/components/Modal";
import { analizar, PUNTOS } from "@/lib/rostro";
import { Upload, ImgIcon, Scissors, X } from "@/components/Icons";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const MODELO =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/* El detector se carga una sola vez por sesión */
let detectorPromise = null;
function obtenerDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
      return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELO, delegate: "GPU" },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    })().catch((e) => { detectorPromise = null; throw e; });
  }
  return detectorPromise;
}

export default function AnalisisRostro({ onClose, onUsar, nombreCliente, titulo = "Análisis de rostro", textoGuardar = "Guardar en la ficha" }) {
  const [estado, setEstado] = useState("inicio"); // inicio | cargando | listo | error
  const [error, setError] = useState("");
  const [res, setRes] = useState(null);
  const canvasRef = useRef(null);
  const datosRef = useRef(null);

  /* Dibuja la foto y las medidas cuando hay resultado */
  useEffect(() => {
    if (estado !== "listo" || !datosRef.current || !canvasRef.current) return;
    const { img, crudos } = datosRef.current;
    const cv = canvasRef.current;
    const maxA = 460;
    const esc = Math.min(1, maxA / img.width);
    cv.width = img.width * esc;
    cv.height = img.height * esc;
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, cv.width, cv.height);

    const p = (i) => ({ x: crudos[i].x * cv.width, y: crudos[i].y * cv.height });
    const linea = (a, b, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      [a, b].forEach((q) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    linea(p(PUNTOS.frenteArriba), p(PUNTOS.menton), "#ffffff");
    linea(p(PUNTOS.frenteIzq), p(PUNTOS.frenteDer), "#82b6de");
    linea(p(PUNTOS.pomuloIzq), p(PUNTOS.pomuloDer), "#ee8d96");
    linea(p(PUNTOS.mandibulaIzq), p(PUNTOS.mandibulaDer), "#8ee0b0");
  }, [estado, res]);

  const procesar = async (file) => {
    if (!file) return;
    setEstado("cargando");
    setError("");
    try {
      const detector = await obtenerDetector();
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();

      const salida = detector.detect(img);
      URL.revokeObjectURL(url); // la foto no se guarda ni se sube

      const crudos = salida?.faceLandmarks?.[0];
      if (!crudos) {
        setError("No se detectó un rostro. Usa una foto de frente, con buena luz y sin lentes oscuros.");
        setEstado("error");
        return;
      }

      const r = analizar(crudos, img.width, img.height);
      if (!r) {
        setError("No se pudieron tomar las medidas. Prueba con otra foto.");
        setEstado("error");
        return;
      }

      datosRef.current = { img, crudos };
      setRes(r);
      setEstado("listo");
    } catch (e) {
      console.error(e);
      setError("No se pudo cargar el analizador. Revisa tu conexión e inténtalo otra vez.");
      setEstado("error");
    }
  };

  const reiniciar = () => { setRes(null); datosRef.current = null; setEstado("inicio"); };

  return (
    <Modal
      title={titulo}
      sub={nombreCliente}
      onClose={onClose}
      ancho={640}
      footer={
        estado === "listo" ? (
          <>
            <button className="link-btn" onClick={reiniciar}>Repetir</button>
            <button className="btn dark" onClick={() => onUsar(res)}>{textoGuardar}</button>
          </>
        ) : (
          <button className="link-btn" onClick={onClose}>Cerrar</button>
        )
      }
    >
      {estado === "inicio" && (
        <>
          <div className="stack" style={{ gap: 12 }}>
            <label className="upload" style={{ cursor: "pointer", padding: "26px 16px", flexDirection: "column", gap: 8 }}>
              <ImgIcon style={{ width: 28, height: 28 }} />
              <b style={{ color: "var(--ink)", fontSize: 16 }}>Tomar foto</b>
              <span style={{ fontSize: 13 }}>El cliente de frente, mirando a la cámara</span>
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                onChange={(e) => procesar(e.target.files?.[0])} />
            </label>
            <label className="upload" style={{ cursor: "pointer" }}>
              <Upload /> Elegir una foto existente
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => procesar(e.target.files?.[0])} />
            </label>
          </div>
          <p className="muted" style={{ marginTop: 18, fontSize: 13, lineHeight: 1.6 }}>
            El análisis ocurre dentro de este dispositivo: la foto no se sube a ningún servidor
            y se descarta al terminar. Solo se guarda la forma de rostro resultante.
            Pide permiso al cliente antes de fotografiarlo.
          </p>
        </>
      )}

      {estado === "cargando" && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div className="spinner" />
          <p style={{ marginTop: 18, fontWeight: 600 }}>Analizando el rostro…</p>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            La primera vez tarda unos segundos en preparar el analizador.
          </p>
        </div>
      )}

      {estado === "error" && (
        <div style={{ textAlign: "center", padding: "34px 16px" }}>
          <div style={{ fontSize: 15, marginBottom: 20, color: "var(--red)", fontWeight: 600 }}>{error}</div>
          <button className="btn dark" onClick={reiniciar}>Intentar de nuevo</button>
        </div>
      )}

      {estado === "listo" && res && (
        <>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <canvas ref={canvasRef} style={{ maxWidth: "100%", borderRadius: 16, display: "block" }} />
          </div>

          <div className="res-cab">
            <div>
              <div className="muted" style={{ fontSize: 13 }}>Forma detectada</div>
              <b style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.5px" }}>{res.forma}</b>
            </div>
            <div style={{ textAlign: "right" }}>
              <b style={{ fontSize: 27, fontWeight: 800 }}>{res.ranking[0].similitud}%</b>
              <div className={"conf conf-" + res.confianza}>coincidencia {res.confianza}</div>
            </div>
          </div>

          {res.confianza === "baja" && (
            <div className="aviso">
              Las proporciones quedaron entre dos formas. Revisa el resultado y ajústalo a mano si no calza.
            </div>
          )}

          <p style={{ margin: "16px 0 18px", lineHeight: 1.6 }}>{res.recomendaciones.resumen}</p>

          <div className="med-grid">
            <Medida c="#ffffff" b label="Largo" v={res.medidas.largo} />
            <Medida c="#82b6de" label="Frente" v={res.medidas.frente} />
            <Medida c="#ee8d96" label="Pómulos" v={res.medidas.pomulos} />
            <Medida c="#8ee0b0" label="Mandíbula" v={res.medidas.mandibula} />
          </div>

          <div className="bloque">
            <div className="bloque-t">Por qué</div>
            <ul className="lista">
              {res.explicacion.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>

          <div className="bloque">
            <div className="bloque-t"><Scissors style={{ width: 16, height: 16, verticalAlign: -3, marginRight: 7 }} />Cortes que favorecen</div>
            <ul className="lista si">
              {res.recomendaciones.favorece.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
            <div className="bloque-t" style={{ marginTop: 16 }}><X style={{ width: 15, height: 15, verticalAlign: -2, marginRight: 7 }} />Mejor evitar</div>
            <ul className="lista no">
              {res.recomendaciones.evitar.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>

          <div className="bloque">
            <div className="bloque-t">Similitud con cada forma</div>
            {res.ranking.map((r) => (
              <div className="barra-fila" key={r.nombre}>
                <span>{r.nombre}</span>
                <div className="barra"><div style={{ width: r.similitud + "%" }} /></div>
                <b>{r.similitud}%</b>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function Medida({ c, label, v, b }) {
  return (
    <div className="med">
      <span className="med-c" style={{ background: c, border: b ? "1px solid rgba(23,23,26,0.15)" : "none" }} />
      <div>
        <div className="muted" style={{ fontSize: 12.5 }}>{label}</div>
        <b>{Math.round(v)} px</b>
      </div>
    </div>
  );
}

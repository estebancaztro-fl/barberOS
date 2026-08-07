"use client";
import { X } from "@/components/Icons";

export default function Modal({ title, sub, onClose, children, footer, ancho }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={ancho ? { maxWidth: ancho } : undefined}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button className="x" onClick={onClose}><X /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange }) {
  return (
    <button type="button" className={"toggle" + (on ? " on" : "")} onClick={() => onChange(!on)} aria-pressed={on}>
      <span />
    </button>
  );
}

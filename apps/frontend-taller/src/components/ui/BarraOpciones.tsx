// src/components/ui/BarraOpciones.tsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";


// OJO: ajustá el import si tu ruta real cambia
import FormularioArreglo from "../modales/ModalFormularioArreglo";

type Props = {
  onNuevoArreglo: (dto: any) => void | Promise<void>;

  activarModoEliminar: () => void;
  salirModoEliminar: () => void;
  modoEliminar: boolean;

  onFinalizarArreglos: () => void;
  mostrarFinalizados: () => void;
  verHistorialPorPatente: () => void;
  verHistorialDelDia: () => void;

  abierto?: boolean;
  onOpen?: () => void;
  onClose?: () => void;

  mostrarHamburguesa?: boolean;
  mostrarAgregar?: boolean;
  mostrarQuitar?: boolean;
  mostrarSalirQuitar?: boolean;
  mostrarFinalizar?: boolean;
  mostrarVerFinalizados?: boolean;
  mostrarHistorial?: boolean;

  movilId?: string | number | null;
  defaultPatente?: string;
};

export default function BarraOpciones({
  onNuevoArreglo,
  activarModoEliminar,
  salirModoEliminar,
  modoEliminar,
  onFinalizarArreglos,
  mostrarFinalizados,
  verHistorialPorPatente,
  verHistorialDelDia,

  abierto = false,
  onOpen,
  onClose,

  mostrarHamburguesa = true,
  mostrarAgregar = true,
  mostrarQuitar = true,
  mostrarSalirQuitar = true,
  mostrarFinalizar = true,
  mostrarVerFinalizados = true,
  mostrarHistorial = true,

  movilId,
  defaultPatente,
}: Props) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [coords, setCoords] = useState({ top: 72, left: 16 });

  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const h = document.querySelector(".ts-header") as HTMLElement | null;
    headerRef.current = h || null;

    const calc = () => {
      const el = headerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = Math.max(0, Math.round(rect.bottom) + 8);
      const left = 16;
      setCoords({ top, left });
    };

    calc();

    const onScroll = () => calc();
    window.addEventListener("scroll", onScroll, { passive: true });

    let ro: ResizeObserver | undefined;
    if (headerRef.current && "ResizeObserver" in window) {
      ro = new ResizeObserver(calc);
      ro.observe(headerRef.current);
    }
    window.addEventListener("resize", calc);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", calc);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && abierto && onClose?.();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [abierto, onClose]);

  const floatingBtn =
    mostrarHamburguesa &&
    createPortal(
      <button
        onClick={onOpen}
        aria-label="Abrir menú"
        className="ts-burger"
        style={{
          position: "fixed",
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          zIndex: 2147483000,
        }}
      >
        ☰
      </button>,
      document.body
    );

  return (
    <>
      {floatingBtn}

      {abierto && <div className="overlay" onClick={onClose} />}

      <aside className={`sidebar ${abierto ? "abierto" : ""}`} role="dialog" aria-hidden={!abierto}>
        <button className="cerrar-btn" onClick={onClose}>
          ✖
        </button>

        {mostrarAgregar && (
          <button className="opcion" onClick={() => setMostrarFormulario(true)}>
            ➕ Añadir arreglo
          </button>
        )}

        {!modoEliminar && mostrarQuitar && (
          <button className="opcion" onClick={activarModoEliminar}>
            ❌ Quitar arreglo
          </button>
        )}

        {modoEliminar && mostrarSalirQuitar && (
          <button className="opcion" onClick={salirModoEliminar}>
            🔙 Salir del modo eliminar
          </button>
        )}

        {mostrarFinalizar && (
          <button className="opcion" onClick={onFinalizarArreglos}>
            ✅ Finalizar arreglos
          </button>
        )}

        {mostrarVerFinalizados && (
          <button className="opcion" onClick={mostrarFinalizados}>
            📂 Ver arreglos finalizados
          </button>
        )}

        {mostrarHistorial && (
          <button className="opcion" onClick={verHistorialPorPatente}>
            📋 Historial por patente
          </button>
        )}

        <button className="opcion opcion--dia" onClick={verHistorialDelDia}>
          🗓️ Historial del día
        </button>
      </aside>

      {mostrarFormulario && (
        <FormularioArreglo
          movilId={movilId}
          defaultPatente={defaultPatente}
          onClose={() => setMostrarFormulario(false)}
          onAgregar={onNuevoArreglo}
        />
      )}
    </>
  );
}

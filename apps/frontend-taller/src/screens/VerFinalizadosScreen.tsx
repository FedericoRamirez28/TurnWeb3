import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { api } from "../lib/api";
import { useMovilId } from "./useMovilId";

type Tarea = { texto: string };
type Finalizado = {
  id: string;
  movil_id?: string | number | null;
  patente: string;
  fecha: string;
  anotaciones: string;
  tareas: Tarea[];
};

function fechaHoy() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function VerFinalizadosScreen({ filtro = "" }: { filtro?: string }) {
  const movilId = useMovilId();
  const [finalizados, setFinalizados] = useState<Finalizado[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const url = movilId ? `/finalizados?movilId=${encodeURIComponent(movilId)}` : `/finalizados`;
        const data = await api.get(url);
        setFinalizados(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Error cargando finalizados:", e);
      } finally {
        setCargando(false);
      }
    })();
  }, [movilId]);

  const filtrados = useMemo(() => {
    const f = String(filtro).toLowerCase();
    return finalizados.filter((a) => {
      const txt = `${a.patente} ${a.fecha} ${a.anotaciones} ${(a.tareas || []).map((t) => t.texto).join(" ")}`.toLowerCase();
      return txt.includes(f);
    });
  }, [finalizados, filtro]);

  const exportarExcel = () => {
    const datos = filtrados.map((a) => ({
      Movil: a.movil_id ?? "",
      Patente: a.patente,
      Fecha: a.fecha,
      Anotaciones: a.anotaciones,
      Tareas: (a.tareas || []).map((t) => t.texto).join(", "),
    }));
    const hoja = XLSX.utils.json_to_sheet(datos);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Finalizados");
    XLSX.writeFile(libro, `arreglos_finalizados_${fechaHoy()}.xlsx`);
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Arreglos Finalizados", 14, 16);

    const filas = filtrados.map((a) => [
      a.movil_id ?? "",
      a.patente,
      a.fecha,
      a.anotaciones,
      (a.tareas || []).map((t) => t.texto).join(", "),
    ]);

    autoTable(doc, {
      head: [["Móvil", "Patente", "Fecha", "Anotaciones", "Tareas"]],
      body: filas,
      startY: 30,
    });

    doc.save(`arreglos_finalizados_${fechaHoy()}.pdf`);
  };

  const exportarExcelItem = (a: Finalizado) => {
    const hoja = XLSX.utils.json_to_sheet([
      {
        Movil: a.movil_id ?? "",
        Patente: a.patente,
        Fecha: a.fecha,
        Anotaciones: a.anotaciones,
        Tareas: (a.tareas || []).map((t) => t.texto).join(", "),
      },
    ]);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Finalizado");
    XLSX.writeFile(libro, `finalizado_${a.id}_${fechaHoy()}.xlsx`);
  };

  const exportarPDFItem = (a: Finalizado) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Finalizado #${a.id}`, 14, 16);

    autoTable(doc, {
      head: [["Móvil", "Patente", "Fecha", "Anotaciones", "Tareas"]],
      body: [
        [
          a.movil_id ?? "",
          a.patente,
          a.fecha,
          a.anotaciones,
          (a.tareas || []).map((t) => t.texto).join(", "),
        ],
      ],
      startY: 30,
    });

    doc.save(`finalizado_${a.id}_${fechaHoy()}.pdf`);
  };

  if (cargando) return <div className="ver-finalizados"><p>Cargando…</p></div>;

  return (
    <div className="ver-finalizados">
      <h2>{movilId ? `Finalizados del Móvil #${movilId}` : "Arreglos finalizados"}</h2>

      <div className="botones-exportar">
        <button onClick={exportarExcel}>📊 Exportar Excel (vista)</button>
        <button onClick={exportarPDF}>📄 Exportar PDF (vista)</button>
      </div>

      <ul className="lista-finalizados">
        {filtrados.map((a) => (
          <li key={a.id} className="item-finalizado">
            <div className="fila-1">
              <strong>Patente: {a.patente}</strong>
              {a.movil_id && <span className="chip">Móvil #{a.movil_id}</span>}
              <span className="fecha">Fecha: {a.fecha}</span>
            </div>

            <div className="anotaciones">Anotaciones: {a.anotaciones}</div>

            <div className="tareas-text">Arreglos realizados: </div>
            <ul className="tareas">
              {(a.tareas || []).map((t, i) => (
                <li key={i}>✔ {t.texto}</li>
              ))}
            </ul>

            <div className="container-botones_item">
              <button className="botones-item" onClick={() => exportarExcelItem(a)}>
                📊 Excel (este)
              </button>
              <button className="botones-item" onClick={() => exportarPDFItem(a)}>
                📄 PDF (este)
              </button>
            </div>
          </li>
        ))}

        {!filtrados.length && <li>No hay resultados para “{filtro}”.</li>}
      </ul>
    </div>
  );
}

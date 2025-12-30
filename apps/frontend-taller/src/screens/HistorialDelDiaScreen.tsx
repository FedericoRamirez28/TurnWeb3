// src/screens/ParteDiariaScreen.tsx
import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../lib/api";

type YesNo = "si" | "no" | "na";
type CombustibleLevel = "reserva" | "1/4" | "1/2" | "3/4" | "lleno";

const YESNO = [
  { v: "si", label: "Sí" },
  { v: "no", label: "No" },
  { v: "na", label: "N/A" },
] as const;

const COMBUSTIBLE = [
  { v: "reserva", label: "Reserva" },
  { v: "1/4", label: "1/4" },
  { v: "1/2", label: "1/2" },
  { v: "3/4", label: "3/4" },
  { v: "lleno", label: "Lleno" },
] as const;

function getQuery(k: string) {
  const s1 = new URLSearchParams(location.search);
  if (s1.has(k)) return s1.get(k);

  if (location.hash?.includes("?")) {
    const idx = location.hash.indexOf("?");
    const s2 = new URLSearchParams(location.hash.slice(idx + 1));
    if (s2.has(k)) return s2.get(k);
  }
  return null;
}

/** ✅ Pills genérico: tipa value/onChange según options */
function Pills<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { v: T; label: string }[];
}) {
  return (
    <div className="pills">
      {options.map((o) => (
        <label key={o.v} className={`pill ${value === o.v ? "on" : ""}`}>
          <input
            type="radio"
            name={name}
            value={o.v}
            checked={value === o.v}
            onChange={() => onChange(o.v)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function YesNoTable<T extends Record<string, YesNo>>({
  title,
  items,
  values,
  onChange,
}: {
  title: string;
  items: { key: keyof T & string; label: string }[];
  values: T;
  onChange: (k: keyof T & string, v: YesNo) => void;
}) {
  return (
    <section className="pd-card">
      <h3>{title}</h3>
      <div className="yn-table">
        {items.map((it) => (
          <div key={it.key} className="yn-row">
            <span className="yn-label">{it.label}</span>
            <div className="yn-opts">
              {YESNO.map((o) => (
                <label key={o.v} className={`opt ${values[it.key] === o.v ? "on" : ""}`}>
                  <input
                    type="radio"
                    name={it.key}
                    value={o.v}
                    checked={values[it.key] === o.v}
                    onChange={() => onChange(it.key, o.v)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ParteDiariaScreen() {
  const initialKey = useMemo(() => getQuery("key") || "", []);
  const initialMovil = useMemo(() => getQuery("movil") || "", []);

  const [pdKey] = useState(initialKey);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");

  const [movilId, setMovilId] = useState(initialMovil);
  const [form, setForm] = useState({
    patente: "",
    chofer: "",
    enfermero: "",
    km_inicio: "",
    km_fin: "",
    hora_inicio: "",
    hora_fin: "",
    observaciones: "",
  });
  const onF = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const [combustible, setCombustible] = useState<CombustibleLevel>("1/2");

  const [docu, setDocu] = useState({
    cedulaVerde: "na" as YesNo,
    tarjetaSeguro: "na" as YesNo,
    vtv: "na" as YesNo,
    permisoManejo: "na" as YesNo,
  });

  const [pre, setPre] = useState({
    combustibleOk: "na" as YesNo,
    aceite: "na" as YesNo,
    agua: "na" as YesNo,
    liquidoRefrigerante: "na" as YesNo,
    liquidoFrenos: "na" as YesNo,
    cubiertas: "na" as YesNo,
    limpieza: "na" as YesNo,
  });

  const [vehiculo, setVehiculo] = useState({
    balizas: "na" as YesNo,
    matafuego: "na" as YesNo,
    llaveRueda: "na" as YesNo,
    crique: "na" as YesNo,
    radioEstereo: "na" as YesNo,
    ruedaAuxilio: "na" as YesNo,
  });

  const [medico, setMedico] = useState({
    botiquin: "na" as YesNo,
    collares: "na" as YesNo,
    canulasGuedel: "na" as YesNo,
    ambu: "na" as YesNo,
    tensiometro: "na" as YesNo,
    glucometro: "na" as YesNo,
    estetoscopio: "na" as YesNo,
    vendasGasas: "na" as YesNo,
    tablaEspinal: "na" as YesNo,
    inmovilizadores: "na" as YesNo,
    desfibrilador: "na" as YesNo,
    oxigeno: "na" as YesNo,
  });

  const submit = async () => {
    if (!movilId) return alert("Ingresá el Nº de móvil.");
    if (!form.patente || !form.chofer || !form.km_inicio || !form.km_fin) {
      return alert("Completá Patente, Chofer, Km iniciales y Km finales.");
    }

    setSaving(true);
    setOk("");
    try {
      const payload = {
        patente: form.patente,
        chofer: form.chofer,
        km_inicio: form.km_inicio,
        km_fin: form.km_fin,
        observaciones: form.observaciones,
        fecha: new Date().toISOString().slice(0, 10),
        pd_key: pdKey || undefined,
        // Si después querés persistir todo el checklist, lo mandamos acá:
        // combustible,
        // docu, pre, vehiculo, medico,
      };
      await api.post(`/moviles/${encodeURIComponent(movilId)}/parte-diario`, payload);
      setOk("✅ Parte diario enviado. ¡Gracias!");
      setForm((s) => ({ ...s, km_inicio: "", km_fin: "", observaciones: "" }));
    } catch (e) {
      alert("Error guardando parte diario");
    } finally {
      setSaving(false);
    }
  };

  const descargarPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const today = new Date().toLocaleDateString();

    doc.setFontSize(16);
    doc.text(`Parte diario de novedades del móvil #${movilId || "-"}`, 40, 40);
    doc.setFontSize(10);
    doc.text(`Fecha: ${today}`, 40, 58);

    autoTable(doc, {
      startY: 78,
      head: [["Campo", "Valor"]],
      body: [
        ["Patente", form.patente || "-"],
        ["Chofer", form.chofer || "-"],
        ["Enfermero/a", form.enfermero || "-"],
        ["Km iniciales", form.km_inicio || "-"],
        ["Km finales", form.km_fin || "-"],
        ["Hora de comienzo", form.hora_inicio || "-"],
        ["Hora de finalización", form.hora_fin || "-"],
        ["Nivel de combustible", (combustible || "-").toUpperCase()],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [20, 20, 20] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [["DOCUMENTACIÓN", "Sí/No/N/A"]],
      body: [
        ["Cédula verde", docu.cedulaVerde],
        ["Tarjeta/Seguro", docu.tarjetaSeguro],
        ["VTV vigente", docu.vtv],
        ["Permiso de manejo", docu.permisoManejo],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [20, 20, 20] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [["PRE-CHEQUEO", "OK/NO/N/A"]],
      body: [
        ["Combustible OK", pre.combustibleOk],
        ["Aceite", pre.aceite],
        ["Agua", pre.agua],
        ["Líquido refrigerante", pre.liquidoRefrigerante],
        ["Líquido de frenos", pre.liquidoFrenos],
        ["Cubiertas", pre.cubiertas],
        ["Limpieza", pre.limpieza],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [20, 20, 20] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [["EQUIPAMIENTO DEL VEHÍCULO", "OK/NO/N/A"]],
      body: [
        ["Balizas", vehiculo.balizas],
        ["Matafuego", vehiculo.matafuego],
        ["Llave de rueda", vehiculo.llaveRueda],
        ["Crique", vehiculo.crique],
        ["Radio/Estéreo", vehiculo.radioEstereo],
        ["Rueda de auxilio", vehiculo.ruedaAuxilio],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [20, 20, 20] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [["EQUIPAMIENTO / MÉDICO", "OK/NO/N/A"]],
      body: [
        ["Botiquín", medico.botiquin],
        ["Collares cervicales", medico.collares],
        ["Cánulas Guedel", medico.canulasGuedel],
        ["Ambú", medico.ambu],
        ["Tensiómetro", medico.tensiometro],
        ["Glucómetro", medico.glucometro],
        ["Estetoscopio", medico.estetoscopio],
        ["Vendas / Gasas", medico.vendasGasas],
        ["Tabla espinal", medico.tablaEspinal],
        ["Inmovilizadores", medico.inmovilizadores],
        ["Desfibrilador", medico.desfibrilador],
        ["Oxígeno", medico.oxigeno],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [20, 20, 20] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 12,
      head: [["OBSERVACIONES"]],
      body: [[form.observaciones || "-"]],
      theme: "grid",
      styles: { cellPadding: 6, minCellHeight: 40, fontSize: 9 },
      headStyles: { fillColor: [20, 20, 20] },
    });

    doc.save(`parte-movil-${movilId || "X"}.pdf`);
  };

  return (
    <div className="pd-wrap">
      <header className="pd-header">
        <h1>Parte diario de novedades del móvil</h1>
      </header>

      <main className="pd-main">
        <section className="pd-card">
          <h3>Datos del móvil</h3>
          <div className="pd-grid">
            <label>
              Nº de móvil
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={movilId}
                onChange={(e) => setMovilId(e.currentTarget.value.replace(/\D/g, ""))}
                placeholder="Ej: 3"
              />
            </label>

            <label>
              Patente
              <input
                value={form.patente}
                onChange={(e) => onF("patente", e.currentTarget.value.toUpperCase())}
                placeholder="ABC123 / AA123BB"
              />
            </label>

            <label>
              Chofer
              <input
                value={form.chofer}
                onChange={(e) => onF("chofer", e.currentTarget.value)}
                placeholder="Nombre y apellido"
              />
            </label>

            <label>
              Enfermero/a
              <input
                value={form.enfermero}
                onChange={(e) => onF("enfermero", e.currentTarget.value)}
                placeholder="Nombre y apellido"
              />
            </label>

            <label>
              Km iniciales
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.km_inicio}
                onChange={(e) => onF("km_inicio", e.currentTarget.value.replace(/\D/g, ""))}
                placeholder="0"
              />
            </label>

            <label>
              Km finales
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.km_fin}
                onChange={(e) => onF("km_fin", e.currentTarget.value.replace(/\D/g, ""))}
                placeholder="0"
              />
            </label>

            <label>
              Hora de comienzo
              <input type="time" value={form.hora_inicio} onChange={(e) => onF("hora_inicio", e.currentTarget.value)} />
            </label>

            <label>
              Hora de finalización
              <input type="time" value={form.hora_fin} onChange={(e) => onF("hora_fin", e.currentTarget.value)} />
            </label>
          </div>

          <div className="pd-block">
            <div className="label_style-parte">
              <label>Nivel de combustible</label>
            </div>
            <Pills<CombustibleLevel>
              name="combustible"
              value={combustible}
              options={COMBUSTIBLE}
              onChange={setCombustible}
            />
          </div>

          <div className="pd-block">
            <div className="label_style-parte">
              <label>Observaciones</label>
            </div>
            <textarea
              className="no-resize"
              rows={5}
              value={form.observaciones}
              onChange={(e) => onF("observaciones", e.currentTarget.value)}
              placeholder="Detalle cualquier novedad o problema del móvil…"
            />
          </div>
        </section>

        <YesNoTable
          title="Documentación"
          items={[
            { key: "cedulaVerde", label: "Cédula verde" },
            { key: "tarjetaSeguro", label: "Tarjeta de Seguro" },
            { key: "vtv", label: "VTV vigente" },
            { key: "permisoManejo", label: "Permiso de manejo" },
          ]}
          values={docu}
          onChange={(k, v) => setDocu((s) => ({ ...s, [k]: v }))}
        />

        <YesNoTable
          title="Pre-chequeo"
          items={[
            { key: "combustibleOk", label: "Combustible OK" },
            { key: "aceite", label: "Aceite" },
            { key: "agua", label: "Agua" },
            { key: "liquidoRefrigerante", label: "Líquido refrigerante" },
            { key: "liquidoFrenos", label: "Líquido de frenos" },
            { key: "cubiertas", label: "Cubiertas" },
            { key: "limpieza", label: "Limpieza" },
          ]}
          values={pre}
          onChange={(k, v) => setPre((s) => ({ ...s, [k]: v }))}
        />

        <YesNoTable
          title="Equipamiento del vehículo"
          items={[
            { key: "balizas", label: "Balizas" },
            { key: "matafuego", label: "Matafuego" },
            { key: "llaveRueda", label: "Llave de rueda" },
            { key: "crique", label: "Crique" },
            { key: "radioEstereo", label: "Radio / Estéreo" },
            { key: "ruedaAuxilio", label: "Rueda de auxilio" },
          ]}
          values={vehiculo}
          onChange={(k, v) => setVehiculo((s) => ({ ...s, [k]: v }))}
        />

        <YesNoTable
          title="Equipamiento / Médico"
          items={[
            { key: "botiquin", label: "Botiquín" },
            { key: "collares", label: "Collares cervicales" },
            { key: "canulasGuedel", label: "Cánulas Guedel" },
            { key: "ambu", label: "Ambú" },
            { key: "tensiometro", label: "Tensiómetro" },
            { key: "glucometro", label: "Glucómetro" },
            { key: "estetoscopio", label: "Estetoscopio" },
            { key: "vendasGasas", label: "Vendas / Gasas" },
            { key: "tablaEspinal", label: "Tabla espinal" },
            { key: "inmovilizadores", label: "Inmovilizadores" },
            { key: "desfibrilador", label: "Desfibrilador" },
            { key: "oxigeno", label: "Oxígeno" },
          ]}
          values={medico}
          onChange={(k, v) => setMedico((s) => ({ ...s, [k]: v }))}
        />

        <section className="pd-actions">
          <button className="btn save" onClick={submit} disabled={saving}>
            {saving ? "Enviando…" : "Guardar parte"}
          </button>
          <button className="btn pdf" onClick={descargarPDF}>
            Descargar PDF
          </button>
          {ok && <p className="pd-ok">{ok}</p>}
        </section>
      </main>
    </div>
  );
}

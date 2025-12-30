import React, { useState } from "react";
import logo from "../../assets/images/logo-hd.png";

type Props = {
  apiBase?: string;
  onAuth?: (token: string, user: any) => void;
};

export default function LoginScreen({ apiBase = "http://localhost:3001", onAuth }: Props) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function doLogin(e?: React.FormEvent) {
    e?.preventDefault?.();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const base = String(apiBase || "").replace(/\/+$/, "");
      const r = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
        mode: "cors",
      });
      let j: any = {};
      try {
        j = await r.json();
      } catch {}

      if (!r.ok || !j?.ok || !j?.token) {
        setError(j?.error || `Error HTTP ${r.status}`);
      } else {
        onAuth?.(j.token, j.user);
      }
    } catch (err) {
      setError("No se pudo conectar con el servidor (network/CORS).");
      console.error("[login] fetch error", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src={logo} alt="Taller Solutions" className="login-logo" />
        <h1 className="login-title">Taller Solutions</h1>
        <p className="login-subtitle">Acceso restringido</p>

        <form className="login-form" onSubmit={doLogin}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="admin@taller.local"
              required
              disabled={loading}
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <div className="password-box">
              <input
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                value={pass}
                onChange={(e) => setPass(e.currentTarget.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="toggle"
                onClick={() => setShowPass((v) => !v)}
                disabled={loading}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          {error && <div className="error">{error}</div>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <details className="admin-tools">
          <summary>Ayuda</summary>
          <div className="pin-setup">
            <p className="hint">
              Usuario inicial : <b>admin@taller.local</b>
              <br />
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

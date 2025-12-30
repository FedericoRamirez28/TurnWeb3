import React, { useMemo } from "react";
import SearchInputHighlight from "./SearchInputHighlight";

type Props = {
  variant?: "home" | "inner";
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  onBuscar?: (value: string) => void;
  buscarValue?: string;
  onToggleSidebar?: () => void;
  showBurger?: boolean;

  // si querés mantener assets iguales, dejalos así;
  // o después los pasamos al paquete de assets común del monorepo.
  logoFullSrc?: string;
  logoMarkSrc?: string;
};

export default function Header({
  variant = "home",
  title = "Taller Solutions",
  showBack = false,
  onBack,
  onBuscar,
  buscarValue = "",
  onToggleSidebar,
  showBurger = false,
  logoFullSrc,
  logoMarkSrc,
}: Props) {
  const isHome = variant === "home";

  const pathname = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return window.location.pathname || "/";
  }, []);

  const hideSearch = /^\/movil\//.test(pathname);

  const placeholder = pathname.includes("/finalizados")
    ? "Buscar finalizado…"
    : "Buscar arreglo…";

  return (
    <header className={`ts-header ${isHome ? "ts-header--home" : "ts-header--inner"}`}>
      <div className="ts-header__left">
        {showBurger && onToggleSidebar && (
          <button
            className="hdr-burger"
            aria-label="Abrir menú"
            title="Menú"
            onClick={onToggleSidebar}
          >
            <span />
            <span />
            <span />
          </button>
        )}

        {!isHome && logoMarkSrc && (
          <img
            src={logoMarkSrc}
            alt="Taller Solutions"
            className="logo-mark"
            width={28}
            height={28}
          />
        )}

        {showBack && (
          <button className="icon-btn" aria-label="Volver" title="Volver" onClick={onBack}>
            ←
          </button>
        )}
      </div>

      <div className="ts-header__center">
        {isHome ? (
          logoFullSrc ? (
            <img src={logoFullSrc} alt="Taller Solutions" className="logo-full" />
          ) : (
            <h1 className="title">{title}</h1>
          )
        ) : (
          <h1 className="title">{title}</h1>
        )}
      </div>

      <div className="ts-header__right">
        {onBuscar && !hideSearch && (
          <SearchInputHighlight
            value={buscarValue}
            placeholder={placeholder}
            onChangeText={onBuscar}
          />
        )}
      </div>
    </header>
  );
}

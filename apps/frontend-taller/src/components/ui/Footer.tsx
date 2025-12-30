import React from "react";


type Props = {
  version?: string;
};

export default function Footer({ version }: Props) {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__left">
        <strong>Taller Solutions</strong> · {year}
        {version && <span className="footer__version"> · {version}</span>}
      </div>

      <nav className="footer__links">
        <a href="#" rel="noopener noreferrer">
          Soporte
        </a>
        <a href="#" rel="noopener noreferrer">
          Privacidad
        </a>
        <a href="#" rel="noopener noreferrer">
          Términos
        </a>
      </nav>
    </footer>
  );
}

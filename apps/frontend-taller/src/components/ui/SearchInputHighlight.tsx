import React, { useMemo } from "react";


type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  value?: string;
  placeholder?: string;
  onChangeText?: (value: string) => void;
  className?: string;
};

export default function SearchInputHighlight({
  value = "",
  placeholder = "Buscar…",
  onChangeText,
  className = "",
  ...props
}: Props) {
  const parts = useMemo(() => {
    const typed = String(value || "");
    const ph = String(placeholder || "");
    const rest = ph.slice(typed.length);
    return { typed, rest, ph };
  }, [value, placeholder]);

  return (
    <div className={`si-wrap ${className}`.trim()}>
      <div className="si-ghost" aria-hidden="true">
        <span className="typed">{parts.typed}</span>
        <span className="rest">{parts.rest}</span>
      </div>

      <input
        type="text"
        className="si-input"
        value={value}
        placeholder={parts.ph}
        aria-label={placeholder}
        onChange={(e) => onChangeText?.(e.currentTarget.value)}
        style={{ color: "transparent", background: "transparent" }}
        {...props}
      />
    </div>
  );
}

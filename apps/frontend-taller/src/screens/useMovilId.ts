import { useParams } from "react-router-dom";

export function useMovilId(): string {
  const p = useParams();
  return String(p.id ?? p.movilId ?? "");
}

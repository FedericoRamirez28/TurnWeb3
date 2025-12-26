import type { Request } from 'express';
import { UnauthorizedException } from '@nestjs/common';

type AuthUserShape = {
  id?: unknown;
  sub?: unknown;
};

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s : null;
}

export function getUserId(req: Request): string {
  // 1) Auth real: req.user puede venir de Passport/JWT
  const maybeUser = (req as unknown as { user?: AuthUserShape }).user;

  const fromAuth =
    asNonEmptyString(maybeUser?.id) || asNonEmptyString(maybeUser?.sub);

  if (fromAuth) return fromAuth;

  // 2) Fallback DEV
  const fromHeader = asNonEmptyString(req.header('x-user-id'));
  if (fromHeader) return fromHeader;

  throw new UnauthorizedException(
    'Falta autenticación (cookie) o x-user-id (solo dev)',
  );
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

const COOKIE_NAME = 'medic_token';

export type JwtPayload = {
  sub: string;
  username: string;
  displayName: string;
  role: string;
};

function getCookie(req: Request, name: string): string | undefined {
  const maybeCookies: unknown = (req as { cookies?: unknown }).cookies;
  // eslint-disable-next-line prettier/prettier
  if (typeof maybeCookies !== 'object' || maybeCookies === null) return undefined;
  if (!(name in maybeCookies)) return undefined;
  const value = (maybeCookies as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

@Injectable()
export class JwtCookieAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const token = getCookie(req, COOKIE_NAME);
    if (!token) return false;

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      req.user = payload;
      return true;
    } catch {
      return false;
    }
  }
}

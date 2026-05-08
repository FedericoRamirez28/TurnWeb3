import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

const COOKIE_NAME = 'medic_token';

type JwtPayload = {
  sub: string;
  username: string;
  displayName: string;
  role: string;
};

function isRequestSecure(req: Request): boolean {
  // Express: req.secure funciona con trust proxy + x-forwarded-proto
  if (req.secure) return true;

  const xfProto = req.headers['x-forwarded-proto'];
  if (typeof xfProto === 'string') {
    return xfProto.split(',')[0].trim().toLowerCase() === 'https';
  }

  return false;
}

function setAuthCookie(
  req: Request,
  res: Response,
  token: string,
  remember: boolean,
) {
  const isProd = process.env.NODE_ENV === 'production';

  // ✅ si realmente es HTTPS → secure true, sameSite none para cross-site
  // ✅ si es HTTP (localhost) → secure false, sameSite lax
  const secure = isProd ? isRequestSecure(req) : false;
  const sameSite = secure ? ('none' as const) : ('lax' as const);

  const base = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  } as const;

  if (remember) {
    res.cookie(COOKIE_NAME, token, {
      ...base,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  } else {
    res.cookie(COOKIE_NAME, token, base);
  }
}

function clearAuthCookie(req: Request, res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  const secure = isProd ? isRequestSecure(req) : false;
  const sameSite = secure ? ('none' as const) : ('lax' as const);

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  });
}

function getCookie(req: Request, name: string): string | undefined {
  const maybeCookies: unknown = (req as unknown as { cookies?: unknown })
    .cookies;

  if (typeof maybeCookies !== 'object' || maybeCookies === null)
    return undefined;
  if (!(name in maybeCookies)) return undefined;

  const value = (maybeCookies as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private jwt: JwtService,
  ) {}

  @Post('register')
  async register(
    @Req() req: Request,
    @Body()
    body: {
      username: string;
      password: string;
      displayName?: string;
      remember?: boolean;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(body);

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };

    const token = await this.jwt.signAsync(payload);
    setAuthCookie(req, res, token, Boolean(body.remember));

    return { user: payload };
  }

  @Post('login')
  async login(
    @Req() req: Request,
    @Body() body: { username: string; password: string; remember?: boolean },
    @Res({ passthrough: true }) res: Response,
  ) {
    const u = await this.auth.validate(body.username, body.password);

    const payload: JwtPayload = {
      sub: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
    };

    const token = await this.jwt.signAsync(payload);
    setAuthCookie(req, res, token, Boolean(body.remember));

    return { user: payload };
  }

  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    clearAuthCookie(req, res);
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const token = getCookie(req, COOKIE_NAME);
    if (!token) return { user: null };

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      return { user: payload };
    } catch {
      return { user: null };
    }
  }

  @Post('password/request')
  async requestReset(@Body() body: { username: string }) {
    const token = await this.auth.createPasswordResetToken(body.username);
    return { ok: true, token };
  }

  @Post('password/reset')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    await this.auth.resetPasswordWithToken(body.token, body.newPassword);
    return { ok: true };
  }
}

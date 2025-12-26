import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtCookieAuthGuard } from './jwt-cookie.guard';

@Injectable()
export class OptionalJwtCookieAuthGuard extends JwtCookieAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const ok = await super.canActivate(context);
      return ok;
    } catch {
      // Si no hay cookie / token, no bloqueamos: dejamos que el controller resuelva por x-user-id (solo dev)
      return true;
    }
  }
}

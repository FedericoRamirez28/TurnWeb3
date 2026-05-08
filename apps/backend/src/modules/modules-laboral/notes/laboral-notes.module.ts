import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LaboralNotesController } from './laboral-notes.controller';
import { LaboralNotesService } from './laboral-notes.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [LaboralNotesController],
  providers: [LaboralNotesService],
})
export class LaboralNotesModule {}

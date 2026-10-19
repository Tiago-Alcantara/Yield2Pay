import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdModule } from '../household/household.module';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';

@Module({
  imports: [AuthModule, HouseholdModule],
  providers: [StatementsService],
  controllers: [StatementsController],
})
export class StatementsModule {}

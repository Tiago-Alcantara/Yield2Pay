import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdModule } from '../household/household.module';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

@Module({
  imports: [HouseholdModule, AuthModule],
  providers: [SummaryService],
  controllers: [SummaryController],
})
export class SummaryModule {}

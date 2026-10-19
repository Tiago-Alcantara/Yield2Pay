import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdController } from './household.controller';
import { HouseholdService } from './household.service';

@Module({
  imports: [AuthModule],
  providers: [HouseholdService],
  controllers: [HouseholdController],
  exports: [HouseholdService],
})
export class HouseholdModule {}

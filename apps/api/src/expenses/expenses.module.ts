import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HouseholdModule } from '../household/household.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [AuthModule, HouseholdModule],
  providers: [ExpensesService],
  controllers: [ExpensesController],
})
export class ExpensesModule {}

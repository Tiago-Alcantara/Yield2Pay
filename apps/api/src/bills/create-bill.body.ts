import { IsIn, IsString, Length, Matches } from 'class-validator';
import type { BillType, CreateBillDto } from '@yield2pay/shared';

export class CreateBillBody implements CreateBillDto {
  @IsString()
  @Length(1, 80)
  vendor!: string;

  @IsString()
  @Length(1, 16)
  @Matches(/^\d+$/)
  monthlyCost!: string;

  @IsIn(['software', 'utility', 'other'])
  type!: BillType;
}

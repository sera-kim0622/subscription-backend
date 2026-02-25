import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class RefundInputDto {
  @IsString()
  reason: string;

  @ApiProperty({ example: 'success', description: 'success or fail' })
  @IsIn(['success', 'requested', 'fail'])
  simulate?: 'success' | 'requested' | 'fail';
}

export class RefundOutputDto {
  requestAmount: number;

  refundAmount?: number;

  resultMessage: string;

  resultStatus: 'FAILED' | 'REQUESTED' | 'SUCCEED';

  constructor(partial: Partial<RefundOutputDto>) {
    Object.assign(this, partial);
  }
}

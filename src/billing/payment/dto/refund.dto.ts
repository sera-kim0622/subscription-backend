import { IsString } from 'class-validator';

export class RefundInputDto {
  @IsString()
  reason: string;
}

export class RefundOutputDto {
  requestAmount: number;

  refundAmount?: number;

  resultMessage: string;

  resultStatus: 'FAILED' | 'REQUESTED' | 'SUCCEED';
}

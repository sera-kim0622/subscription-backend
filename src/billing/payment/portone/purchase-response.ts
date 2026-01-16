/**
 * @description PortOne 결제 응답 (모킹용 최소 스키마)
 */

import { PAYMENT_STATUS } from '../entities/payment.status';

export type PortOneResult = {
  pgPaymentId?: string; // 결제 트랜잭션 ID(고유 값으로 UUID)

  status: PAYMENT_STATUS;

  paidAt?: string; // ISO string

  failReason?: string;
};

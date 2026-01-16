import { randomUUID } from 'crypto';
import { PAYMENT_STATUS } from '../entities/payment.status';

export type PgPaymentFailResult = {
  status: PAYMENT_STATUS.FAIL;
  failReason: string;
};

export type PgPaymentSuccessResult = {
  status: PAYMENT_STATUS.SUCCESS;
  pgPaymentId: string;
  paidAt: string;
};

export type PgPaymentResult = PgPaymentFailResult | PgPaymentSuccessResult;

export const PgPaymentResultMap: Record<
  'fail' | 'subscription_fail' | 'success',
  PgPaymentResult
> = {
  fail: {
    status: PAYMENT_STATUS.FAIL,
    failReason: 'SIMULATED_FAILURE',
  },
  subscription_fail: {
    pgPaymentId: randomUUID(),
    status: PAYMENT_STATUS.SUCCESS,
    paidAt: new Date().toISOString(),
  },
  success: {
    pgPaymentId: randomUUID(),
    status: PAYMENT_STATUS.SUCCESS,
    paidAt: new Date().toISOString(),
  },
};

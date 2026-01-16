/**
 * @description 가짜 요청을 하기위한 함수
 * @param option state : success | fail | requested 중 택 1
 * requested는 요청 중 상태를 보고싶으면 보내면 됨
 * pgPaymentId는 기존 pg UUID보내면 됨
 * amount 취소할 금액
 */

import { randomUUID } from 'crypto';

export const refundPortOneResponse = (option: {
  pgPaymentId: string;
  cancelBody: {
    reason: string;
    amount: number;
  };
  state: 'success' | 'fail' | 'requested'; //
}): PORTONE_PAYMENT_CANCELLATION => {
  if (option.state === 'success') {
    return {
      status: 'SUCCEED',
      id: randomUUID(),
      pgCancellationId: option.pgPaymentId,
      totalAmount: option.cancelBody.amount,
      taxFreeAmount: option.cancelBody.amount * 0.9,
      vatAmount: option.cancelBody.amount * 0.1,
      reason: option.cancelBody.reason,
      cancelledAt: new Date().toDateString(),
      requestedAt: new Date().toDateString(),
      receiptUrl: '영수증 url',
    };
  } else if (option.state === 'fail') {
    return {
      status: 'FAILED',
      id: randomUUID(),
      totalAmount: option.cancelBody.amount,
      taxFreeAmount: option.cancelBody.amount * 0.9,
      vatAmount: option.cancelBody.amount * 0.1,
      reason: option.cancelBody.reason,
      requestedAt: new Date().toDateString(),
    };
  } else if (option.state === 'requested') {
    return {
      status: 'REQUESTED',
      id: randomUUID(),
      totalAmount: option.cancelBody.amount,
      taxFreeAmount: option.cancelBody.amount * 0.9,
      vatAmount: option.cancelBody.amount * 0.1,
      reason: option.cancelBody.reason,
      requestedAt: new Date().toDateString(),
    };
  }
};

// 결제 결과 타입
export type PORTONE_PAYMENT_CANCELLATION =
  | PORTONE_SUCCEEDED_PAYMENT_CANCELLATION
  | PORTONE_REQUESTED_PAYMENT_CANCELLATION
  | PORTONE_FAILED_PAYMENT_CANCELLATION;

// 결제
export type PORTONE_PAYMENT_CANCELLATION_RESPONSE = {
  status: 'FAILED' | 'REQUESTED' | 'SUCCEED';

  id: string;

  pgCancellationId?: string; // 취소된 아이디

  totalAmount: number;

  taxFreeAmount: number; // 취소 금액 중 면세 금액

  vatAmount: number; // 취소 금액 중 부가세액

  easyPayDiscountAmount?: number; // 적립형 포인트의 환불 금액

  reason: string; // 취소 사유

  cancelledAt?: string; // 취소 시점

  requestedAt: string; // 취소 요청 시점
};

export type PORTONE_SUCCEEDED_PAYMENT_CANCELLATION =
  PORTONE_PAYMENT_CANCELLATION_RESPONSE & {
    status: 'SUCCEED'; // 취소 성공

    receiptUrl?: string; // 결제 취소된 영수증 url
  };

// ===== 결제 취소 요청 시 객체 ===== //
export type PORTONE_REQUESTED_PAYMENT_CANCELLATION =
  PORTONE_PAYMENT_CANCELLATION_RESPONSE & {
    status: 'REQUESTED'; // 취소 요청
  };

// ===== 결제 취소 요청 실패 시 객체(포트원 명칭: FailedPaymentCancellation) ===== //
export type PORTONE_FAILED_PAYMENT_CANCELLATION =
  PORTONE_PAYMENT_CANCELLATION_RESPONSE & {
    status: 'FAILED'; // 취소 요청
  };

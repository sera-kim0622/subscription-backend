import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from '../product/entities/product.entity';
import {
  PurchaseInputDto,
  PurchaseOutputDto,
  PurchaseResultStatus,
} from './dto/purchase.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { Payment } from './entities/payment.entity';
import { UserService } from '../../user/user.service';
import { PAYMENT_STATUS } from './entities/payment.status';
import { PeriodType } from '../subscription/types';
import { SubscriptionOutputDto } from '../subscription/dtos/subscription.dto';
import { PaymentOutput } from './dto/payment.dto';
import { PgPaymentResultMap } from './portone/purchase.response';
import { ErrorCode } from '../../common/errors/error-code.enum';
import { GetLatestPaymentOutputDto } from './dto/get-latest-payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly userService: UserService,
    @Inject(forwardRef(() => SubscriptionService))
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * @description 결제 후 구독생성하는 함수
   */
  async purchase(
    dto: PurchaseInputDto,
    userId: number,
  ): Promise<PurchaseOutputDto> {
    const { productId, simulate } = dto;

    // 1. 현재 판매중인 상품인지 확인
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('존재하지 않는 상품입니다.');
    }

    // 2. 존재하는 유저인지 확인
    // JWT토큰에는 단지 id에 대한 정보만 있을 뿐
    // JWT가 만료시간이 남았는데 탈퇴한 유저라면? 이렇게 되면 에러를 일으키기때문에
    // 한 번 더 확인한다.
    const user = await this.userService.getUser(userId);

    // 3. 현재 유료 구독을 하고 있는지 확인
    const paidSubscription =
      await this.subscriptionService.getCurrentSubscription(userId);

    if (paidSubscription) {
      throw new BadRequestException('이미 구독중인 상품이 있습니다.');
    }

    // ===== mock 결제 모델 만드는 로직 =====
    const pgPaymentResult = PgPaymentResultMap[simulate];

    // 3. mock 결제 정보 payment 테이블에 저장
    const paymentObject = this.paymentRepository.create({
      user,
      pgPaymentId:
        pgPaymentResult.status === PAYMENT_STATUS.SUCCESS
          ? pgPaymentResult.pgPaymentId
          : null,
      status: pgPaymentResult.status,
      amount: product.price,
      paymentDate:
        pgPaymentResult.status === PAYMENT_STATUS.SUCCESS
          ? pgPaymentResult.paidAt
          : null,
      failReason:
        pgPaymentResult.status === PAYMENT_STATUS.FAIL
          ? pgPaymentResult.failReason
          : null,
      issuedSubscription: false,
    });

    let paymentResult: Payment;
    try {
      paymentResult = await this.paymentRepository.save(paymentObject);
    } catch (error) {
      throw new BadRequestException('결제 내역 저장에 실패했습니다.');
    }

    // 4. 결제 정보 받은 후 결과 반환
    // 결제 성공의 경우 : 구독 생성, 구독권과 결제 내역 반환
    // 결제 실패의 경우 : 결제 내역 반환
    if (paymentResult.status === PAYMENT_STATUS.SUCCESS) {
      let subscription: SubscriptionOutputDto;
      if (simulate === 'success') {
        try {
          subscription = await this.subscriptionService.createSubscription({
            userId,
            productId,
            period: product.type,
            paymentId: paymentResult.id,
          });
        } catch (error) {
          for await (const per of [1, 2, 3]) {
            try {
              subscription = await this.subscriptionService.createSubscription({
                userId,
                productId,
                period: product.type,
                paymentId: paymentResult.id,
              });
              break;
            } catch (error) {
              console.log(`${per}회 구독권 발급 시도 중`);
              continue;
            }
          }
        }
      }

      // 5. 구독권이 발급되었으면 결제건에 구독권 발급된 flag를 true로 만들어주고 저장
      if (subscription) {
        paymentResult.issuedSubscription = true;
        paymentResult = await this.paymentRepository.save(paymentResult);
      }

      return new PurchaseOutputDto({
        order: {
          productId: product.id,
          name: product.name,
          type: product.type,
          price: product.price,
        },
        payment: new PaymentOutput(paymentResult),
        subscription: subscription ?? null,
        resultMessage: subscription
          ? '결제 완료 후 구독권 발급에 성공하였습니다.'
          : '결제는 성공하였으나 구독권 발급에 실패하였습니다.',
        resultStatus: subscription
          ? PurchaseResultStatus.SUCCESS
          : PurchaseResultStatus.SUBSCRIPTION_FAILED,
      });
    } else if (paymentResult.status === PAYMENT_STATUS.FAIL) {
      return new PurchaseOutputDto({
        order: {
          productId: product.id,
          name: product.name,
          type: product.type,
          price: product.price,
        },
        payment: new PaymentOutput(paymentResult),
        resultMessage: '결제에 실패하였습니다.',
        resultStatus: PurchaseResultStatus.PAYMENT_FAILED,
      });
    }
  }

  /**
   * @description 환불해주는 함수, 유저가 현재 유효한 유료구독을 하고 있는 경우에만 작동
   * @param userId
   * @todo 해당 함수 완성시키기
   */
  async refund(userId: number) {
    // 1. 유저가 존재하는지 확인
    await this.userService.getUser(userId);

    // 2. 유저가 유효한 유료구독을 하고있는지 확인
    const subscription =
      await this.subscriptionService.getCurrentSubscription(userId);

    if (!subscription) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND_DATA,
        message: '환불 처리할 구독 내역이 존재하지 않습니다.',
      });
    }

    // 3. 유료구독 정보와 연결된 구매기록 확인(구매 성공으로 기록된 것만)
    const payment = await this.paymentRepository.findOne({
      where: {
        subscription: { id: subscription.id },
        status: PAYMENT_STATUS.SUCCESS,
      },
    });

    if (!payment) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND_DATA,
        message: '환불 처리할 결제 내역이 존재하지 않습니다.',
      });
    }

    // 4. 환불 금액 계산하기
    // 일(Day) 단위로 계산하기, 남은 날짜 = 만료 날짜 - 현재 날짜(millisecond를 일로 환산)
    const remainDays =
      subscription.expiredAt.getTime() -
      new Date().getTime() / (1000 / 60 / 60 / 24);

    // 현재 구독중인 상품의 일간 금액 계산하기
    const pricePerDay =
      subscription.product.price /
      (subscription.product.type === PeriodType.MONTHLY ? 30 : 365);

    // 결제한 금액 - (남은날짜 * 일간 금액)
    const refundAmount = payment.amount - remainDays * pricePerDay;

    // 5. 구매기록의 id로 결제대행사에 환불 요청 보내기
    const pgPaymentResult = {};
    // 5-1. 결제 대행사 응답 성공 버전 작성
    // 5-2. 결제 대행사 응답 실패 버전 작성
    // 6. 결제 결과 저장하기(새로운 record 생성)
    // 7. 구독 만료시키기(이 때, 연결된 payment_id는 환불한 record로 한다.)
    // 8. 결제, 구독상태 결과 반환
  }

  /**
   * @description 한 유저의 가장 최근 결제 중 구독이 발급되지 결제 한 건 가져오는 함수
   * reissueSubscription에서만 사용 중
   */
  async getLatestPayment(userId: number): Promise<GetLatestPaymentOutputDto> {
    const payment = await this.paymentRepository.findOne({
      where: {
        user: { id: userId },
        issuedSubscription: false,
      },
      order: {
        createdAt: 'DESC',
      },
      relations: ['product'],
    });

    if (!payment) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND_DATA,
        message: '구독권이 발급되지 않은 결제건이 없습니다.',
      });
    }

    return new GetLatestPaymentOutputDto(
      payment as Payment & { product: Product },
    );
  }
}

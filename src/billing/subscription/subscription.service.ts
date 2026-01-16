import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { Subscription } from './entities/subscription.entity';
import { Product } from '../product/entities/product.entity';
import { CreateSubscriptionInput, PeriodType } from './types/index';
import { UserService } from '../../user/user.service';
import { PaymentService } from '../payment/payment.service';
import { SubscriptionOutputDto } from './dtos/subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly userService: UserService,
    @Inject(forwardRef(() => PaymentService))
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * @description 결제 후 실행되는 구독 생성 내부 함수
   * @param input 유저정보, 상품정보, 결제정보
   * @returns
   */
  async createSubscription(
    input: CreateSubscriptionInput,
  ): Promise<SubscriptionOutputDto> {
    const { userId, productId, period, paymentId } = input;

    // 동일 거래 중복 방지
    const duplicateSubscription = await this.subscriptionRepository.findOne({
      where: { payment: { id: paymentId } } as any,
    });

    if (duplicateSubscription) {
      throw new ConflictException('해당 결제의 구독이 이미 생성되었습니다.');
    }

    // product 존재 확인
    const product = await this.productRepository.findOne({
      where: { id: productId } as any,
    });

    if (!product) throw new NotFoundException('존재하지 않는 상품입니다.');

    // 구독의 유효기간 설정
    const startedAt = new Date();
    const expiredAt = this._calculateExpirationDate(startedAt, period);

    // 구독 객체 생성
    const subscription = this.subscriptionRepository.create({
      user: { id: userId },
      product: { id: productId },
      payment: { id: paymentId },
      expiredAt,
    } as any);

    const result = (await this.subscriptionRepository.save(
      subscription,
    )) as unknown as Subscription;

    return new SubscriptionOutputDto(result);
  }

  /**
   * 월간/연간에 따라 시작일로부터 만료 날짜 계산해주는 함수
   * @param start : 시작일
   * @param type : MONTHLY / YEARLY
   * @returns 계산된 날짜
   */
  _calculateExpirationDate(start: Date, type: PeriodType) {
    const estimateDate = new Date(start);
    if (type === 'YEARLY') {
      estimateDate.setFullYear(estimateDate.getFullYear() + 1);
    } else {
      estimateDate.setMonth(estimateDate.getMonth() + 1);
    }
    return estimateDate;
  }

  /**
   * @description 유저의 현재 구독 정보 확인하는 함수
   */
  async getCurrentSubscription(userId: number) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { user: { id: userId }, expiredAt: MoreThan(new Date()) },
    });

    if (!subscription) {
      return null;
    }

    return subscription;
  }

  /**
   * @description 결제가 성공적으로 끝난 후 구독이 제대로 발급이 되지 않은 경우에만 구독을 재발급해주는 함수
   * 유저 확인 -> 결제 확인 -> 구독 발급(내부 함수 의존)
   * 이 때, 유저 확인은 유저 서비스에 의존하고 결제 확인은 결제 서비스에 의존
   * 각자 repository를 연결하게 되면 service가 각자 존재하는 의미가 적어져서 서비스단에서 의존
   * @param userId
   */
  async reissueSubscription(userId: number): Promise<SubscriptionOutputDto> {
    await this.userService.getUser(userId);

    const payment = await this.paymentService.getLatestPayment(userId);

    return await this.createSubscription({
      userId,
      productId: payment.product.id,
      period: payment.product.type,
      paymentId: payment.id,
    });
  }
}

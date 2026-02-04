import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from '../subscription/subscription.service';
import { PaymentService } from './payment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../product/entities/product.entity';
import { Payment } from './entities/payment.entity';
import { UserService } from '../../user/user.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PeriodType } from '../subscription/types';
import { PAYMENT_STATUS } from './entities/payment.status';
import { randomUUID } from 'crypto';

let paymentService: PaymentService;
let paymentRepository: any;
let productRepository: any;
let userService: any;
let subscriptionService: any;

beforeEach(async () => {
  productRepository = {
    findOne: jest.fn(),
  };

  paymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  userService = {
    getUser: jest.fn(),
  };

  subscriptionService = {
    getCurrentSubscription: jest.fn(),
    createSubscription: jest.fn(),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PaymentService,
      {
        provide: getRepositoryToken(Product),
        useValue: productRepository,
      },
      {
        provide: getRepositoryToken(Payment),
        useValue: paymentRepository,
      },
      {
        provide: UserService,
        useValue: userService,
      },
      {
        provide: SubscriptionService,
        useValue: subscriptionService,
      },
    ],
  }).compile();

  paymentService = module.get<PaymentService>(PaymentService);
});

describe('결제 함수(purchase) 테스트', () => {
  it('결제하려는 상품이 존재하지 않을 경우 에러를 반환', async () => {
    productRepository.findOne.mockResolvedValue(undefined);

    const result = paymentService.purchase(
      {
        productId: 1,
        simulate: 'success',
      },
      1,
    );

    await expect(result).rejects.toThrow(Error);
  });

  it('결제하려는 유저가 존재하지 않을 경우 에러를 반환', async () => {
    productRepository.findOne.mockResolvedValue({ id: 1 });

    userService.getUser.mockImplementation(() => {
      throw new NotFoundException('유저 없음');
    });

    const result = paymentService.purchase(
      {
        productId: 1,
        simulate: 'success',
      },
      1,
    );

    expect(productRepository.findOne).toHaveBeenCalledTimes(1);
    await expect(result).rejects.toThrow(Error);
  });

  it('이미 구독중인 상품이 있는 경우 에러를 반환', async () => {
    productRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'BASIC',
      type: PeriodType.MONTHLY,
      price: 3000,
    });

    userService.getUser.mockResolvedValue({ id: 1, email: 'sera@gmail.com' });
    subscriptionService.getCurrentSubscription.mockResolvedValue({
      id: 1,
      user: { id: 1 },
      product: { id: 1 },
      payment: { id: 1 },
      expiredAt: new Date(),
    });

    try {
      await paymentService.purchase({ productId: 1, simulate: 'success' }, 1);
      fail('에러가 발생해야 합니다.');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
    }
    expect(productRepository.findOne).toHaveBeenCalledTimes(1);
    expect(userService.getUser).toHaveBeenCalledTimes(1);
    expect(subscriptionService.getCurrentSubscription).toHaveBeenCalledTimes(1);
  });

  it.skip('결제 결과를 받은 후 결제 테이블에 저장하다가 실패', async () => {
    productRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'BASIC',
      type: PeriodType.MONTHLY,
      price: 3000,
    });

    userService.getUser.mockResolvedValue({ id: 1, email: 'sera@gmail.com' });
    subscriptionService.getCurrentSubscription.mockResolvedValue(null);
    paymentRepository.create.mockResolvedValue({
      user: { id: 1 },
      pgPaymentId: '550e8400-e29b-41d4-a716-446655440000',
      status: PAYMENT_STATUS.SUCCESS,
      amount: 3000,
      paymentDate: new Date(),
      issuedSubscription: false,
    });
    paymentRepository.save.mockRejectedValue(new Error());

    try {
      await paymentService.purchase(
        {
          productId: 1,
          simulate: 'success',
        },
        1,
      );
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
    expect(productRepository.findOne).toHaveBeenCalledTimes(1);
    expect(userService.getUser).toHaveBeenCalledTimes(1);
    expect(subscriptionService.getCurrentSubscription).toHaveBeenCalledTimes(1);
    expect(paymentRepository.create).toHaveBeenCalledTimes(1);
  });

  it.skip('결제 성공 후 구독권을 생성하다가 실패 => 구독권 발급 3회 시도 중 성공', async () => {
    productRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'BASIC',
      type: PeriodType.MONTHLY,
      price: 3000,
    });

    userService.getUser.mockResolvedValue({ id: 1, email: 'sera@gmail.com' });
    subscriptionService.getCurrentSubscription.mockResolvedValue(null);
    paymentRepository.create.mockResolvedValue({
      user: { id: 1 },
      pgPaymentId: '550e8400-e29b-41d4-a716-446655440000',
      status: PAYMENT_STATUS.SUCCESS,
      amount: 3000,
      paymentDate: new Date(),
      issuedSubscription: false,
    });
    // save 객체
    const pgPaymentId = randomUUID();
    paymentRepository.save.mockResolvedValue({
      id: 1,
      user: { id: 1 },
      pgPaymentId,
      status: PAYMENT_STATUS.SUCCESS,
      amount: 3000,
      paymentDate: new Date(),
      issuedSubscription: false,
    });

    // 구독권 발급하는 함수 조작
    subscriptionService.createSubscription
      .mockRejectedValueOnce(new Error('1st fail'))
      .mockRejectedValueOnce(new Error('2nd fail'))
      .mockResolvedValueOnce({
        id: 22,
        product: { id: 1 },
        user: { id: 1 },
        payment: { id: 1 },
        expiredAt: new Date(),
      });

    // 실행부
    const result = await paymentService.purchase(
      {
        productId: 1,
        simulate: 'success',
      },
      1,
    );

    // 이전 함수들이 실행되었는지 확인
    expect(productRepository.findOne).toHaveBeenCalledTimes(1);
    expect(userService.getUser).toHaveBeenCalledTimes(1);
    expect(subscriptionService.getCurrentSubscription).toHaveBeenCalledTimes(1);

    // 실제로 3번 호출되었는지 확인
    expect(subscriptionService.createSubscription).toHaveBeenCalledTimes(3);

    // payment객체를 두 번 저장해야함, 처음 결제 정보가 저장될 때 한 번, 이후 구독권 발급되어서
    // issuedSubscription이 false -> true로 변할 때
    expect(paymentRepository.save).toHaveBeenCalledTimes(2);

    // 결제 결과가 제대로 나왔는지 확인
    expect(result.resultMessage).toBe(
      '결제 완료 후 구독권 발급에 성공하였습니다.',
    );
    expect(result.subscription).toMatchObject({
      id: 22,
      expiredAt: expect.any(Date),
    });
  });

  it.skip('결제 성공 후 구독권을 생성하다가 실패 => 구독권 발급 3회 시도 모두 실패', async () => {
    productRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'BASIC',
      type: PeriodType.MONTHLY,
      price: 3000,
    });

    userService.getUser.mockResolvedValue({ id: 1, email: 'sera@gmail.com' });
    subscriptionService.getCurrentSubscription.mockResolvedValue(null);
    paymentRepository.create.mockResolvedValue({
      user: { id: 1 },
      pgPaymentId: '550e8400-e29b-41d4-a716-446655440000',
      status: PAYMENT_STATUS.SUCCESS,
      amount: 3000,
      paymentDate: new Date(),
      issuedSubscription: false,
    });
    // save 객체
    const pgPaymentId = randomUUID();
    paymentRepository.save.mockResolvedValue({
      id: 1,
      user: { id: 1 },
      pgPaymentId,
      status: PAYMENT_STATUS.SUCCESS,
      amount: 3000,
      paymentDate: new Date(),
      issuedSubscription: false,
    });

    // 구독권 발급하는 함수 조작
    subscriptionService.createSubscription
      .mockRejectedValueOnce(new Error('1st fail'))
      .mockRejectedValueOnce(new Error('2nd fail'))
      .mockRejectedValueOnce(new Error('3rd fail'));

    // 실행부
    const result = await paymentService.purchase(
      {
        productId: 1,
        simulate: 'success',
      },
      1,
    );

    // 이전 함수들이 실행되었는지 확인
    expect(productRepository.findOne).toHaveBeenCalledTimes(1);
    expect(userService.getUser).toHaveBeenCalledTimes(1);
    expect(subscriptionService.getCurrentSubscription).toHaveBeenCalledTimes(1);

    // 첫 번째 시도 + 3번 루프돌면서 총 4번 구독권 발급 호출하는지 확인
    expect(subscriptionService.createSubscription).toHaveBeenCalledTimes(4);

    // 결제 정보만 저장했으므로 1번만 실행함
    expect(paymentRepository.save).toHaveBeenCalledTimes(1);

    // 결과 반환하는 메세지가 실패했다고 나오는지 확인
    expect(result.resultMessage).toBe(
      '결제는 성공하였으나 구독권 발급에 실패하였습니다.',
    );
    // 구독권은 발급되지 않고 결제만 정의됨
    expect(result.subscription).toBe(null);
  });

  it('결제 성공 후 구독권을 생성하여 결제, 구독정보 반환', async () => {
    productRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'BASIC',
      type: PeriodType.MONTHLY,
      price: 3000,
    });

    userService.getUser.mockResolvedValue({ id: 1, email: 'sera@gmail.com' });

    subscriptionService.getCurrentSubscription.mockResolvedValue(null);

    paymentRepository.create.mockResolvedValue({
      user: { id: 1 },
      pgPaymentId: '550e8400-e29b-41d4-a716-446655440000',
      status: PAYMENT_STATUS.SUCCESS,
      amount: 3000,
      paymentDate: new Date(),
      issuedSubscription: false,
    });

    const pgPaymentId = randomUUID();
    paymentRepository.save.mockResolvedValue({
      id: 1,
      user: { id: 1 },
      pgPaymentId,
      status: PAYMENT_STATUS.SUCCESS,
      amount: 3000,
      paymentDate: new Date(),
      issuedSubscription: false,
    });

    // 구독권 한 번에 발급
    subscriptionService.createSubscription.mockResolvedValue({
      id: 22,
      product: { id: 1 },
      user: { id: 1 },
      payment: { id: 1 },
      expiredAt: new Date(),
    });

    // 함수 실행
    const result = await paymentService.purchase(
      {
        productId: 1,
        simulate: 'success',
      },
      1,
    );

    expect(productRepository.findOne).toHaveBeenCalledTimes(1);
    expect(userService.getUser).toHaveBeenCalledTimes(1);
    expect(subscriptionService.getCurrentSubscription).toHaveBeenCalledTimes(1);
    expect(subscriptionService.createSubscription).toHaveBeenCalledTimes(1);
    expect(paymentRepository.save).toHaveBeenCalledTimes(2);
    expect(result.resultMessage).toBe(
      '결제 완료 후 구독권 발급에 성공하였습니다.',
    );

    expect(result.subscription).toMatchObject({
      id: 22,
      expiredAt: expect.any(Date),
    });
  });

  it('결제 실패하여 결제 정보를 반환', async () => {
    productRepository.findOne.mockResolvedValue({
      id: 1,
      name: 'BASIC',
      type: PeriodType.MONTHLY,
      price: 3000,
    });

    userService.getUser.mockResolvedValue({ id: 1, email: 'sera@gmail.com' });

    subscriptionService.getCurrentSubscription.mockResolvedValue(null);

    const pgPaymentId = randomUUID();
    paymentRepository.create.mockResolvedValue({
      user: { id: 1 },
      pgPaymentId,
      status: PAYMENT_STATUS.FAIL,
      amount: 3000,
      paymentDate: new Date(),
      issuedSubscription: false,
    });

    paymentRepository.save.mockResolvedValue({
      id: 1,
      user: { id: 1 },
      pgPaymentId,
      status: PAYMENT_STATUS.FAIL,
      amount: 3000,
      paymentDate: new Date(),
      issuedSubscription: false,
    });

    // 실행부
    const result = await paymentService.purchase(
      {
        productId: 1,
        simulate: 'fail',
      },
      1,
    );

    expect(productRepository.findOne).toHaveBeenCalledTimes(1);
    expect(userService.getUser).toHaveBeenCalledTimes(1);
    expect(subscriptionService.getCurrentSubscription).toHaveBeenCalledTimes(1);
    // 실패했으므로 구독권 발급은 실행되면 안됨
    expect(subscriptionService.createSubscription).toHaveBeenCalledTimes(0);

    // 실패해도 결제 정보는 저장하므로 실행됨
    expect(paymentRepository.save).toHaveBeenCalledTimes(1);
    expect(result.resultMessage).toBe('결제에 실패하였습니다.');
    expect(result.subscription).not.toBeDefined();
  });
});

describe('환불 함수(refund) 테스트', () => {
  it('유저가 존재하지 않을 때 ', () => {});

  it('', () => {});

  it('', () => {});

  it('', () => {});
});

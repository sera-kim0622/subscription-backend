import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { Subscription } from './entities/subscription.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../product/entities/product.entity';
import { PeriodType } from './types';
import { PaymentService } from '../payment/payment.service';
import { UserService } from '../../user/user.service';

let subscriptionService: SubscriptionService;
let subscriptionRepository;
let productRepository;

const paymentServiceMock = {
  getLatestPayment: jest.fn(),
};

const userServiceMock = {
  getUser: jest.fn(),
};

beforeEach(async () => {
  subscriptionRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  productRepository = {
    findOne: jest.fn(),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SubscriptionService,
      { provide: UserService, useValue: userServiceMock },
      {
        provide: PaymentService,
        useValue: paymentServiceMock,
      },
      {
        provide: getRepositoryToken(Subscription),
        useValue: subscriptionRepository,
      },
      {
        provide: getRepositoryToken(Product),
        useValue: productRepository,
      },
    ],
  }).compile();

  subscriptionService = module.get<SubscriptionService>(SubscriptionService);
});

describe('결제 후 구독생성하는 함수 테스트', () => {
  it('동일 결제 id로 생성된 구독이 있으면 상태코드 409 에러를 반환', async () => {
    subscriptionRepository.findOne.mockResolvedValue({ id: 1 });
    const input = {
      userId: 1,
      productId: 1,
      period: PeriodType.MONTHLY,
      paymentId: 1,
    };

    const result = subscriptionService.createSubscription(input);
    await expect(result).rejects.toThrow(Error);
    await expect(result).rejects.toMatchObject({ status: 409 });
  });

  it('존재하지 않는 상품일 경우 상태코드 404 에러를 반환', async () => {
    subscriptionRepository.findOne.mockResolvedValue(undefined);
    productRepository.findOne.mockResolvedValue(undefined);
    const input = {
      userId: 1,
      productId: 1,
      period: PeriodType.MONTHLY,
      paymentId: 1,
    };

    const result = subscriptionService.createSubscription(input);
    await expect(result).rejects.toThrow(Error);
    await expect(result).rejects.toMatchObject({ status: 404 });
  });

  it('구독 객체 생성 중 오류가 발생되면 에러를 반환', async () => {
    subscriptionRepository.findOne.mockResolvedValue(undefined);
    productRepository.findOne.mockResolvedValue({ id: 1 });

    // 가짜 날짜 만들어야 함
    const fakeTime = new Date(2025, 12, 4, 20, 36);
    jest.useFakeTimers().setSystemTime(fakeTime);
    subscriptionService._calculateExpirationDate(fakeTime, PeriodType.MONTHLY);

    // subscriptionService._calculateExpirationDate(startDate, PeriodType.MONTHLY);
    const input = {
      userId: 1,
      productId: 1,
      period: PeriodType.MONTHLY,
      paymentId: 1,
    };
    subscriptionRepository.save.mockRejectedValue(new Error());

    const result = subscriptionService.createSubscription(input);
    await expect(result).rejects.toThrow(Error);
  });

  it('월 구독이 성공적으로 생성되어 구독 정보를 반환', async () => {
    subscriptionRepository.findOne.mockResolvedValue(undefined);
    productRepository.findOne.mockResolvedValue({ id: 1 });

    // 가짜 날짜 생성
    const fakeTime = new Date(2025, 11, 4, 20, 36);
    jest.useFakeTimers().setSystemTime(fakeTime);

    // 객체 생성
    subscriptionRepository.create.mockImplementation((data) => data);
    subscriptionRepository.save.mockImplementation(async (sub) => {
      return { ...sub, id: 1 };
    });

    const input = {
      userId: 1,
      productId: 1,
      period: PeriodType.MONTHLY,
      paymentId: 1,
    };

    const result = await subscriptionService.createSubscription(input);

    // 한 달 후의 날짜가 유효기간으로 설정된 구독권이 발급되었는지 확인
    const expected = new Date(fakeTime);
    expected.setMonth(expected.getMonth() + 1);
    expect(result.expiredAt.getFullYear()).toBe(expected.getFullYear());
    expect(result.expiredAt.getMonth()).toBe(expected.getMonth());
    expect(result.expiredAt.getDate()).toBe(expected.getDate());
  });

  it('연 구독이 성공적으로 생성되어 구독 정보를 반환', async () => {
    subscriptionRepository.findOne.mockResolvedValue(undefined);
    productRepository.findOne.mockResolvedValue({ id: 1 });

    // 가짜 날짜 생성
    const fakeTime = new Date(2025, 11, 4, 20, 36);
    jest.useFakeTimers().setSystemTime(fakeTime);

    // 객체 생성
    subscriptionRepository.create.mockImplementation((data) => data);
    subscriptionRepository.save.mockImplementation(async (sub) => {
      return { ...sub, id: 1 };
    });

    const input = {
      userId: 1,
      productId: 1,
      period: PeriodType.YEARLY,
      paymentId: 1,
    };

    const result = await subscriptionService.createSubscription(input);

    // 한 달 후의 날짜가 유효기간으로 설정된 구독권이 발급되었는지 확인
    const expected = new Date(fakeTime);
    expected.setFullYear(expected.getFullYear() + 1);
    expect(result.expiredAt.getFullYear()).toBe(expected.getFullYear());
    expect(result.expiredAt.getMonth()).toBe(expected.getMonth());
    expect(result.expiredAt.getDate()).toBe(expected.getDate());
  });
});

describe('유저의 현재 구독 정보 확인하는 함수 테스트', () => {
  it('유저의 현재 구독이 없다면 null을 반환', async () => {
    subscriptionRepository.findOne.mockResolvedValue(undefined);
    const result = await subscriptionService.getCurrentSubscription(1);
    expect(result).toBe(null);
  });

  it('유저의 현재 유료 구독이 있다면 해당 구독의 정보를 반환', async () => {
    subscriptionRepository.findOne.mockResolvedValue({
      id: 3,
      product: { id: 1, price: 1000 },
    });
    await subscriptionService.getCurrentSubscription(1);
    expect(subscriptionRepository.findOne).toHaveBeenCalledTimes(1);
  });
});

describe('결제 후 구독을 재발급하는 함수 테스트', () => {
  it('유저 확인 -> 가장 최근 결제 건(한 건) 확인 -> 구독 생성 순으로 실행된다.', async () => {
    const userId = 3;

    const paymentMock = {
      id: 1,
      product: {
        id: 10,
        type: PeriodType.MONTHLY,
        name: 'BASIC',
        price: 1000,
        createdAt: new Date(),
      },
    };

    jest.spyOn(userServiceMock, 'getUser').mockResolvedValue({ id: userId });
    jest
      .spyOn(paymentServiceMock, 'getLatestPayment')
      .mockResolvedValue(paymentMock);
    jest.spyOn(subscriptionService, 'createSubscription').mockResolvedValue({
      id: 99,
      expiredAt: new Date(),
      product: {
        id: 10,
        type: PeriodType.MONTHLY,
        name: 'BASIC',
        price: 1000,
        createdAt: new Date(),
      },
    });

    const result = await subscriptionService.reissueSubscription(userId);

    expect(userServiceMock.getUser).toHaveBeenCalledWith(userId);
    expect(paymentServiceMock.getLatestPayment).toHaveBeenCalledWith(userId);
    expect(subscriptionService.createSubscription).toHaveBeenCalledWith({
      userId,
      productId: 10,
      period: PeriodType.MONTHLY,
      paymentId: 1,
    });
    expect(result).toEqual({
      id: 99,
      expiredAt: new Date(),
      product: {
        name: 'BASIC',
        price: 1000,
        type: PeriodType.MONTHLY,
        id: 10,
        createdAt: new Date(),
      },
    });
  });
});

import { PAYMENT_STATUS } from '../../billing/payment/entities/payment.status';
import { TransformDate } from '../../common/decorators/date.format';
import { User, UserRole } from '../entities/user.entity';

export class RecentSubscriptionList {
  id: number;

  productName: string;

  @TransformDate('datetime')
  expiredAt: Date;

  price: number;
}

export class RecentPaymentList {
  id: number;

  status: PAYMENT_STATUS;

  amount: number;

  @TransformDate('datetime')
  paymentDate: Date;

  issuedSubscription: boolean;
}

export class ProfileOutputDto {
  id: number;

  email: string;

  role: UserRole;

  subscriptions: RecentSubscriptionList[];

  payments: RecentPaymentList[];

  activeSubscriptionId: number;

  constructor(params: {
    user: User;
    subscriptions: RecentSubscriptionList[];
    payments: RecentPaymentList[];
    activeSubscriptionId: number
  }) {
    const { user, subscriptions, payments, activeSubscriptionId } = params;

    this.id = user.id;
    this.email = user.email;
    this.role = user.role;
    this.subscriptions = subscriptions;
    this.payments = payments;
    this.activeSubscriptionId = activeSubscriptionId
  }
}

import { PAYMENT_STATUS } from '../../billing/payment/entities/payment.status';
import { TransformDate } from '../../common/decorators/date.format';
import { User, UserRole } from '../entities/user.entity';

export class RecentSubscriptionList {
  productName: string;

  @TransformDate('datetime')
  expiredAt: string;

  amount: number;
}

export class RecentPaymentList {
  status: PAYMENT_STATUS;

  amount: number;

  @TransformDate('datetime')
  paymentDate: string;

  issuedSubscription: boolean;
}

export class ProfileOutputDto {
  id: number;

  email: string;

  role: UserRole;

  subscriptions: RecentPaymentList[];

  payments: RecentSubscriptionList[];

  constructor(user: User) {
    this.id = user.id;
    this.email = user.email;
    this.role = user.role;
  }
}

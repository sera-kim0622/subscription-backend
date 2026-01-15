import { Payment } from '../../billing/payment/entities/payment.entity';
import { Subscription } from '../../billing/subscription/entities/subscription.entity';
import { User, UserRole } from '../entities/user.entity';

export class GetUserOutputDto {
  id: number;

  email: string;

  role: UserRole;

  subscriptions: Subscription[];

  payments: Payment[];

  constructor(user: User) {
    this.id = user.id;
    this.email = user.email;
    this.role = user.role;
    this.payments = user.payments;
    this.subscriptions = user.subscriptions;
  }
}

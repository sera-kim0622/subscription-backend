import { ProductOutputDto } from '../../product/dto/product.dto';
import { Product } from '../../product/entities/product.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentOutput } from './payment.dto';

type PaymentWithProduct = Payment & {
  product: Product;
};

export class GetLatestPaymentOutputDto extends PaymentOutput {
  product: ProductOutputDto;

  constructor(payment: PaymentWithProduct) {
    super(payment);
    this.product = new ProductOutputDto(payment.product);
  }
}

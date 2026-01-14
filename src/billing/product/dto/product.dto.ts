import { PeriodType } from '../../subscription/types';
import { Product } from '../entities/product.entity';

export class ProductOutputDto {
  id: number;

  name: string;

  type: PeriodType;

  price: number;

  constructor(product: Product) {
    this.id = product.id;
    this.name = product.name;
    this.type = product.type;
    this.price = product.price;
  }
}

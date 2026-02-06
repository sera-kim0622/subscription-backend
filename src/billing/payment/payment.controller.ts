import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { PurchaseInputDto, PurchaseOutputDto } from './dto/purchase.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator.ts';
import { RefundInputDto } from './dto/refund.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // controller에서 추가 로직이 없기때문에 service는 promise를 리턴하고
  // 리턴할 때까지 nestJS가 기다려주기 때문에 굳이 controller에서 await처리를
  // 하지 않아도 된다.
  @ApiOperation({ summary: '구독 상품 구매 (PortOne 모킹)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('purchase')
  purchase(
    @Body() dto: PurchaseInputDto,
    @CurrentUser() userId: number,
  ): Promise<PurchaseOutputDto> {
    return this.paymentService.purchase(dto, userId);
  }

  @ApiOperation({ summary: '구독 상품 구매 (PortOne 모킹)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('refund') // 환불 과정은 취소한 행위에 대한 새로운 처리이므로 관용적으로 post를 주로 사용, 결제대행사들도 모두 post를 사용함
  refund(@Body() dto: RefundInputDto, @CurrentUser() userId: number) {
    return this.paymentService.refund(dto, userId);
  }
}

import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { CurrentUser } from '../../auth/decorator/current-user.decorator.ts';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @ApiOperation({ summary: '결제 중 구독 실패한 경우 구독 재발급해주는 함수' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('reissue')
  reissueSubscription(@CurrentUser() userId: number) {
    return this.subscriptionService.reissueSubscription(userId);
  }
}

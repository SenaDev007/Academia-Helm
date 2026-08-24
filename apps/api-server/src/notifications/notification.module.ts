import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';
import { NotificationController } from './notification.controller';
// ⭐ V3-4: FCM sender for mobile push (Firebase Admin SDK)
import { FcmSenderService } from './fcm-sender.service';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule], // ⭐ FcmSenderService needs PrismaService
  controllers: [NotificationController],
  // PushService is replaced by WebPushService internally — both coexist:
  //   - PushService: Web Push (VAPID) for browsers
  //   - FcmSenderService: FCM for mobile apps
  providers: [NotificationService, PushService, FcmSenderService],
  exports: [NotificationService, PushService, FcmSenderService],
})
export class NotificationModule {}

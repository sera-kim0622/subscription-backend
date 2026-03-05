import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  BadRequestException,
  ClassSerializerInterceptor,
  ValidationPipe,
} from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Subscription API')
    .setDescription('구독/결제 API 문서')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const fieldErrors = errors.reduce(
          (acc, cur) => {
            acc[cur.property] = Object.values(cur.constraints ?? {})[0];
            return acc;
          },
          {} as Record<string, string>,
        );

        return new BadRequestException({
          type: 'VALIDATION_ERROR',
          errors: fieldErrors,
        });
      },
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.setGlobalPrefix('api');

  SwaggerModule.setup('api-docs', app, document);
  await app.listen(3000);
  console.log('api docs : http://localhost:3000/api-docs');
}
bootstrap();

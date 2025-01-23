import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  config();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: 'https://xucyx5s-thungan272003-8081.exp.direct/', 
    credentials: true,  // Cho phép gửi cookie từ frontend
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Chuyển đổi kiểu dữ liệu
      whitelist: true, // Tự động loại bỏ các thuộc tính không được định nghĩa trong DTO
      forbidNonWhitelisted: true, // Trả về lỗi nếu có thuộc tính không được định nghĩa
      forbidUnknownValues: true, // Trả về lỗi nếu giá trị không hợp lệ
    }),
  );
  const configS = new DocumentBuilder()

    .setTitle('User API')
    .setDescription('API for user management')
    .setVersion('1.0')
    .addTag('users')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, configS);
  SwaggerModule.setup('api-docs', app, document);
  app.use(cookieParser()); 
  await app.listen(process.env.PORT);
}
bootstrap();

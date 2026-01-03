import { PaginationInterceptor } from './shared/pagination.interceptor';
// import { ErrorInterceptor } from './shared/error.interceptor';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(
    new PaginationInterceptor(),
    // new ErrorInterceptor(),
  );
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3002);
}

bootstrap();

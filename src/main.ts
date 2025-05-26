import { ResponseInterceptor } from './shared/response.interceptor';
// import { ErrorInterceptor } from './shared/error.interceptor';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(
    // Global interceptors for handling responses and errors
    new ResponseInterceptor(),
    // new ErrorInterceptor(),
  );
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();

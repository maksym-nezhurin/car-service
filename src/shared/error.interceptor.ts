import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<Request>();

        const status =
          err instanceof HttpException
            ? err.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const message =
          err instanceof HttpException
            ? err.getResponse()
            : 'Internal server error';

        this.logger.error(
          `[${request?.method}] ${request?.url} - ${JSON.stringify(message)}`,
        );

        return throwError(() => ({
          success: false,
          statusCode: status,
          message,
        }));
      }),
    );
  }
}

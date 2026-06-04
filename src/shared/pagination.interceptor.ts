import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class PaginationInterceptor<T>
  implements NestInterceptor<PaginatedData<T> | T[], ApiResponse<T[]>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T[]>> {
    return next.handle().pipe(
      map((response): ApiResponse<T[]> => {
        if (
          typeof response === 'object' &&
          response !== null &&
          'data' in response &&
          'total' in response
        ) {
          const {
            data,
            total,
            page = 1,
            limit = data && data.length,
          } = response as PaginatedData<T>;
          const pages = Math.ceil(total / limit);

          return {
            success: true,
            data,
            pagination: {
              total,
              page,
              limit,
              pages,
            },
          };
        }

        return {
          success: true,
          data: response as T[],
        };
      }),
    );
  }
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: PaginationMeta;
}

export interface PaginatedData<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

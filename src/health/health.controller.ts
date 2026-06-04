import { Controller, Get } from '@nestjs/common';
import { createHealthResponse } from './health.response';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return createHealthResponse();
  }
}

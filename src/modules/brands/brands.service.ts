// Example for brands.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BrandsService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAllBrands() {
    const apiUrl = this.configService.get<string>('CARQUERY_API_URL');
    const url = `${apiUrl}?cmd=getMakes`;
    const response = await firstValueFrom(this.httpService.get(url));
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    return data.Makes || data.makes || data;
  }
}

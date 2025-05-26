import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ModelsService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getModelsByBrand(brandId: string) {
    const apiUrl = this.configService.get<string>('CARQUERY_API_URL');
    const url = `${apiUrl}?cmd=getModels&make=${brandId}`;
    const response = await firstValueFrom(this.httpService.get(url));
    // Adjust parsing as needed based on API response structure
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data.Models;
  }

  async getModelsByBrandAndYear(brandId: string, year: string) {
    const apiUrl = this.configService.get<string>('CARQUERY_API_URL');
    const url = `${apiUrl}?cmd=getModels&make=${brandId}&year=${year}`;
    const response = await firstValueFrom(this.httpService.get(url));
    // Adjust parsing as needed based on API response structure
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return response.data.Models;
  }
}

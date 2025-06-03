import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class VariantsService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getVariantsByModel(modelId: string) {
    const apiUrl = this.configService.get<string>('CARQUERY_API_URL');
    const url = `${apiUrl}?cmd=getTrims&model=${modelId}`;
    const response = await firstValueFrom(this.httpService.get(url));

    // Adjust parsing as needed based on API response structure
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return response.data.Trims;
  }

  async getVariantsByModelAndYear(modelId: string, year: string) {
    const apiUrl = this.configService.get<string>('CARQUERY_API_URL');
    const url = `${apiUrl}?cmd=getTrims&model=${modelId}&year=${year}`;
    const response = await firstValueFrom(this.httpService.get(url));

    // Adjust parsing as needed based on API response structure
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return response.data.Trims;
  }
}

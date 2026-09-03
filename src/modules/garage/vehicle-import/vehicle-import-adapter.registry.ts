import { Injectable } from '@nestjs/common';
import { VehicleImportAdapter } from './vehicle-import-adapter.interface';
import { MockVehicleImportAdapter } from './mock-vehicle-import.adapter';

@Injectable()
export class VehicleImportAdapterRegistry {
  private readonly adapters = new Map<string, VehicleImportAdapter>();

  constructor(mockAdapter: MockVehicleImportAdapter) {
    this.register(mockAdapter);
  }

  register(adapter: VehicleImportAdapter) {
    this.adapters.set(adapter.method, adapter);
  }

  getAdapter(method: string, countryCode: string): VehicleImportAdapter | null {
    const adapter = this.adapters.get(method);
    if (!adapter) return null;
    if (
      adapter.supportedCountries !== 'ALL' &&
      !adapter.supportedCountries.includes(countryCode)
    ) {
      return null;
    }
    return adapter;
  }
}

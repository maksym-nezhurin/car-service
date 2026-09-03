import { Injectable } from '@nestjs/common';
import {
  VehicleImportAdapter,
  VehicleImportResult,
} from './vehicle-import-adapter.interface';

/**
 * Ships in Phase 1 (docs/V1_5_VEHICLE_AUTOADD.md) so the scan-to-prefill UX is
 * fully demoable without a decoder vendor contract. Ignores the actual image —
 * always returns the same clearly-fake sample vehicle. Real decoding (Aztec-code
 * vendor, or a future mObywatel-based adapter) replaces this via the registry
 * without any frontend change.
 */
@Injectable()
export class MockVehicleImportAdapter implements VehicleImportAdapter {
  method = 'mock';
  supportedCountries: VehicleImportAdapter['supportedCountries'] = 'ALL';

  async extractVehicleData(): Promise<VehicleImportResult> {
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      status: 'OK',
      vehicle: {
        vin: 'MOCKSCAN00000001',
        plateNumber: 'DEMO001',
        countryCode: 'PL',
      },
    };
  }
}

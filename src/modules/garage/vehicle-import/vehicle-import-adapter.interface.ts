export interface VehicleImportInput {
  imageBase64?: string;
  rawText?: string;
}

export interface VehicleImportResult {
  status: 'OK' | 'FAILED';
  vehicle?: {
    vin?: string;
    plateNumber?: string;
    countryCode?: string;
    brandId?: string;
    modelId?: string;
  };
  error?: string;
}

/**
 * Deliberately has no field for owner-identifying data (e.g. PESEL, present in the
 * Polish dowód rejestracyjny's Aztec payload) — see docs/V1_5_VEHICLE_AUTOADD.md §3.
 * A real adapter must not put it in `vehicle`, and this type gives it nowhere to go.
 */
export interface VehicleImportAdapter {
  method: string;
  supportedCountries: string[] | 'ALL';
  extractVehicleData(input: VehicleImportInput): Promise<VehicleImportResult>;
}

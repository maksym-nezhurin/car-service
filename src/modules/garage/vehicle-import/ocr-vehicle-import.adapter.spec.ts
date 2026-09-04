import { OcrVehicleImportAdapter } from './ocr-vehicle-import.adapter';
import { DocumentAiClient } from './document-ai.client';
import { CatalogService } from '../../catalog/catalog.service';

describe('OcrVehicleImportAdapter', () => {
  const sampleDocumentText = [
    'A. KR1234A',
    'B. 12.03.2015',
    'C.1.1 JAN KOWALSKI',
    'PESEL: 90010112345',
    'D.1 VOLKSWAGEN',
    'D.3 TIGUAN',
    'E. WVWZZZ1KZAM123456',
  ].join('\n');

  function buildAdapter(overrides?: {
    documentAiClient?: Partial<DocumentAiClient>;
    catalogService?: Partial<CatalogService>;
  }) {
    const documentAiClient = {
      isConfigured: () => true,
      extractText: jest.fn().mockResolvedValue(sampleDocumentText),
      ...overrides?.documentAiClient,
    } as unknown as DocumentAiClient;

    const catalogService = {
      listMakes: jest.fn().mockResolvedValue([
        { id: '1', slug: 'volkswagen', name: 'Volkswagen' },
        { id: '2', slug: 'bmw', name: 'BMW' },
      ]),
      listModelsByMakeSlug: jest.fn().mockResolvedValue({
        make: { id: '1', slug: 'volkswagen', name: 'Volkswagen' },
        models: [
          { id: '10', slug: 'tiguan', name: 'Tiguan' },
          { id: '11', slug: 'golf', name: 'Golf' },
        ],
      }),
      ...overrides?.catalogService,
    } as unknown as CatalogService;

    return new OcrVehicleImportAdapter(documentAiClient, catalogService);
  }

  it('extracts VIN, plate, brand, and model, and never leaks the PESEL', async () => {
    const adapter = buildAdapter();
    const result = await adapter.extractVehicleData({ imageBase64: 'irrelevant' });

    expect(result.status).toBe('OK');
    expect(result.vehicle?.vin).toBe('WVWZZZ1KZAM123456');
    expect(result.vehicle?.plateNumber).toBe('KR1234A');
    expect(result.vehicle?.brandId).toBe('Volkswagen');
    expect(result.vehicle?.modelId).toBe('Tiguan');
    expect(result.vehicle?.countryCode).toBe('PL');

    // The whole result, serialized, must never contain the PESEL that was in the source text.
    expect(JSON.stringify(result)).not.toContain('90010112345');
  });

  it('returns FAILED without calling the OCR provider when no image is given', async () => {
    const documentAiClient = { extractText: jest.fn() };
    const adapter = buildAdapter({ documentAiClient });

    const result = await adapter.extractVehicleData({});

    expect(result.status).toBe('FAILED');
    expect(documentAiClient.extractText).not.toHaveBeenCalled();
  });

  it('returns FAILED when Document AI is not configured', async () => {
    const adapter = buildAdapter({ documentAiClient: { isConfigured: () => false } });

    const result = await adapter.extractVehicleData({ imageBase64: 'irrelevant' });

    expect(result.status).toBe('FAILED');
  });

  it('returns FAILED when the Document AI call throws, without crashing', async () => {
    const adapter = buildAdapter({
      documentAiClient: { extractText: jest.fn().mockRejectedValue(new Error('boom')) },
    });

    const result = await adapter.extractVehicleData({ imageBase64: 'irrelevant' });

    expect(result.status).toBe('FAILED');
  });

  it('degrades gracefully (blank brand/model) when the catalog service fails', async () => {
    const adapter = buildAdapter({
      catalogService: { listMakes: jest.fn().mockRejectedValue(new Error('db down')) },
    });

    const result = await adapter.extractVehicleData({ imageBase64: 'irrelevant' });

    expect(result.status).toBe('OK');
    expect(result.vehicle?.vin).toBe('WVWZZZ1KZAM123456');
    expect(result.vehicle?.brandId).toBeUndefined();
    expect(result.vehicle?.modelId).toBeUndefined();
  });

  it('leaves brand/model blank when nothing in the text matches the catalog', async () => {
    const adapter = buildAdapter({
      documentAiClient: {
        extractText: jest.fn().mockResolvedValue('E. WVWZZZ1KZAM123456\nA. KR1234A'),
      },
    });

    const result = await adapter.extractVehicleData({ imageBase64: 'irrelevant' });

    expect(result.vehicle?.brandId).toBeUndefined();
    expect(result.vehicle?.modelId).toBeUndefined();
  });
});

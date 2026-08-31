import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from '../../catalog/catalog.service';
import { DocumentAiClient } from './document-ai.client';
import { extractVin } from './vin-extractor.util';
import { extractPlateNumber } from './plate-extractor.util';
import { stripPeselFromFields } from './pesel-filter.util';
import { findBestFuzzyMatchAcrossQueries } from './fuzzy-match.util';
import {
  VehicleImportAdapter,
  VehicleImportInput,
  VehicleImportResult,
} from './vehicle-import-adapter.interface';

/**
 * Real (non-mock) adapter for AUT-32: hosted OCR (Google Document AI) + regex
 * for VIN/plate + catalog fuzzy-match for brand/model. See
 * docs/V1_5_VEHICLE_AUTOADD_OCR_RESEARCH.md for why this approach was chosen
 * over a vision-LLM, and the plan doc's §5 for the PESEL-safety-net rationale.
 *
 * This adapter OCRs the *entire* document — the owner's PESEL is present in
 * the raw text on every call. The raw text is discarded as soon as the four
 * target fields are extracted (never logged, never returned, never stored),
 * and every extracted field additionally passes through a PESEL-shaped-
 * sequence filter as a mandatory final check, not just defense-in-depth.
 */
@Injectable()
export class OcrVehicleImportAdapter implements VehicleImportAdapter {
  private readonly logger = new Logger(OcrVehicleImportAdapter.name);

  method = 'ocr';
  supportedCountries: VehicleImportAdapter['supportedCountries'] = ['PL'];

  constructor(
    private readonly documentAiClient: DocumentAiClient,
    private readonly catalogService: CatalogService,
  ) {}

  async extractVehicleData(
    input: VehicleImportInput,
  ): Promise<VehicleImportResult> {
    if (!input.imageBase64) {
      return { status: 'FAILED', error: 'No image provided.' };
    }

    if (!this.documentAiClient.isConfigured()) {
      return { status: 'FAILED', error: 'OCR is not configured.' };
    }

    let rawText: string;
    try {
      rawText = await this.documentAiClient.extractText(input.imageBase64);
    } catch (err) {
      this.logger.error(
        'Document AI call failed',
        err instanceof Error ? err.stack : undefined,
      );
      return { status: 'FAILED', error: 'OCR service call failed.' };
    }

    const vin = extractVin(rawText);
    const plateNumber = extractPlateNumber(rawText);
    const { brandId, modelId } = await this.matchCatalog(rawText);
    // rawText is not referenced again below this line — never logged or returned.

    const { cleaned, triggered } = stripPeselFromFields({
      vin,
      plateNumber,
      brandId,
      modelId,
    });
    if (triggered) {
      this.logger.warn(
        'PESEL-shaped sequence detected in OCR extraction output and stripped — ' +
          'prompt/extraction scoping may need tightening.',
      );
    }

    return {
      status: 'OK',
      vehicle: {
        ...cleaned,
        countryCode: 'PL',
      },
    };
  }

  /**
   * No layout information is available (see the class doc), so this scans
   * every "token" (roughly, a line or whitespace-separated chunk) against the
   * catalog and keeps the single best match — not the first one that clears
   * the similarity threshold. Wrapped in try/catch so a catalog-service
   * failure degrades to "brand/model left blank" rather than failing the
   * whole extraction (VIN/plate are extracted independently above).
   */
  private async matchCatalog(
    rawText: string,
  ): Promise<{ brandId?: string; modelId?: string }> {
    try {
      const tokens = rawText
        .split(/\r?\n/)
        .flatMap((line) => line.split(/\s{2,}|\t/))
        .map((token) => token.trim())
        .filter((token) => token.length >= 2);

      if (tokens.length === 0) return {};

      const makes = await this.catalogService.listMakes();
      const matchedMake = findBestFuzzyMatchAcrossQueries(
        tokens,
        makes as { name: string; slug: string }[],
      );
      if (!matchedMake) return {};

      const { models } = await this.catalogService.listModelsByMakeSlug(
        matchedMake.slug,
      );
      const matchedModel = findBestFuzzyMatchAcrossQueries(
        tokens,
        models as { name: string }[],
      );

      return {
        brandId: matchedMake.name,
        modelId: matchedModel?.name,
      };
    } catch (err) {
      this.logger.warn(
        `Catalog fuzzy-match failed, leaving brand/model blank: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {};
    }
  }
}

import { Injectable } from '@nestjs/common';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

/**
 * Thin wrapper around Google Cloud Document AI's plain-OCR processor.
 * Credentials come from the standard `GOOGLE_APPLICATION_CREDENTIALS` env var
 * (read automatically by the underlying google-auth-library — not handled
 * here). Client construction is lazy so importing/instantiating this class
 * doesn't require Document AI to be configured — only calling `extractText`
 * does. This lets `OcrVehicleImportAdapter` be registered even when nobody
 * has set up Document AI yet (falls back to `mock` at the registry level).
 */
@Injectable()
export class DocumentAiClient {
  private client: DocumentProcessorServiceClient | null = null;

  isConfigured(): boolean {
    return Boolean(
      process.env.DOCUMENT_AI_PROJECT_ID &&
        process.env.DOCUMENT_AI_PROCESSOR_ID,
    );
  }

  async extractText(
    imageBase64: string,
    mimeType = 'image/jpeg',
  ): Promise<string> {
    const projectId = process.env.DOCUMENT_AI_PROJECT_ID;
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
    const location = process.env.DOCUMENT_AI_LOCATION ?? 'eu';

    if (!projectId || !processorId) {
      throw new Error(
        'Document AI is not configured (missing DOCUMENT_AI_PROJECT_ID / DOCUMENT_AI_PROCESSOR_ID).',
      );
    }

    const client = this.getClient();
    const name = client.processorPath(projectId, location, processorId);

    // `content` is a protobuf `bytes` field — it needs an actual Buffer, not
    // the base64 *string* itself (protobufjs does not auto-decode a string
    // as base64 here; passing the raw string caused a silent INVALID_ARGUMENT).
    const [result] = await client.processDocument({
      name,
      rawDocument: {
        content: Buffer.from(imageBase64, 'base64'),
        mimeType,
      },
    });

    return result.document?.text ?? '';
  }

  private getClient(): DocumentProcessorServiceClient {
    if (!this.client) {
      // Document AI's Node client defaults to a non-regional endpoint, which
      // fails with a generic INVALID_ARGUMENT (no clearer error) for any
      // processor outside that default region. Must match DOCUMENT_AI_LOCATION.
      const location = process.env.DOCUMENT_AI_LOCATION ?? 'eu';
      this.client = new DocumentProcessorServiceClient({
        apiEndpoint: `${location}-documentai.googleapis.com`,
      });
    }
    return this.client;
  }
}

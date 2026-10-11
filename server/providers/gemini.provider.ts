import { GoogleGenAI } from '@google/genai';
import { serverConfig } from '../config.js';
import {
  AiProvider,
  AiProviderId,
  AiCapability,
  ProviderRequest,
  ProviderResponse,
  ProviderStatusReport,
  ProviderErrorCategory,
  AiProviderError,
} from './types.js';

/** Default timeout for Gemini API calls in milliseconds (18 seconds) */
export const DEFAULT_GEMINI_TIMEOUT_MS = 18_000;

/** Maximum frames bounded for multi-image requests */
export const MAX_MULTI_IMAGE_FRAMES = 5;

/** Structural interface for Google GenAI client to allow mock injection in tests */
export interface GoogleGenAIClientLike {
  models: {
    generateContent: (params: {
      model: string;
      contents: Array<{
        role?: string;
        parts: Array<{
          text?: string;
          inlineData?: {
            mimeType: string;
            data: string;
          };
        }>;
      }>;
    }) => Promise<{ text?: string | null }>;
  };
}

export interface GeminiProviderOptions {
  client?: GoogleGenAIClientLike;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

/** Helper to wrap a promise with a hard timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** Sanitize error messages to ensure API keys and auth secrets are never leaked */
function sanitizeErrorMessage(message: string, apiKey?: string): string {
  let sanitized = message;
  if (apiKey && apiKey.length > 5) {
    sanitized = sanitized.split(apiKey).join('[REDACTED_API_KEY]');
  }
  // Mask potential Gemini API key patterns (AIzaSy...)
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
  return sanitized;
}

/** Classify error into a typed ProviderErrorCategory */
function classifyError(error: unknown): {
  category: ProviderErrorCategory;
  statusCode?: number;
  isRetryable: boolean;
} {
  if (error instanceof AiProviderError) {
    return {
      category: error.category,
      statusCode: error.statusCode,
      isRetryable: error.isRetryable,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('timed out') || lowerMsg.includes('timeout')) {
    return { category: 'timeout', statusCode: 504, isRetryable: true };
  }

  if (
    lowerMsg.includes('api_key') ||
    lowerMsg.includes('api key') ||
    lowerMsg.includes('permission_denied') ||
    lowerMsg.includes('unauthenticated') ||
    lowerMsg.includes('401') ||
    lowerMsg.includes('403') ||
    lowerMsg.includes('unauthorized')
  ) {
    return { category: 'auth_error', statusCode: 401, isRetryable: false };
  }

  if (
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('429')
  ) {
    return { category: 'rate_limit', statusCode: 429, isRetryable: true };
  }

  if (
    lowerMsg.includes('schema') ||
    lowerMsg.includes('json') ||
    lowerMsg.includes('parse') ||
    lowerMsg.includes('syntaxerror')
  ) {
    return { category: 'invalid_output', statusCode: 502, isRetryable: false };
  }

  if (
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('network')
  ) {
    return { category: 'network_error', statusCode: 503, isRetryable: true };
  }

  return { category: 'unknown_error', statusCode: 500, isRetryable: false };
}

/**
 * Gemini Provider Adapter
 * Encapsulates the Google GenAI SDK behind the standard Draw2Play AI Provider interface.
 */
export class GeminiProvider implements AiProvider {
  public readonly id: AiProviderId = 'gemini';
  public readonly displayName = 'Google Gemini';
  public readonly defaultModel: string;
  public readonly capabilities: ReadonlySet<AiCapability> = new Set<AiCapability>([
    'text-generation',
    'image-understanding',
    'multi-image-analysis',
  ]);

  private client: GoogleGenAIClientLike | null = null;
  private apiKey: string | undefined;
  private defaultTimeoutMs: number;

  constructor(options?: GeminiProviderOptions) {
    this.defaultModel = options?.model || serverConfig.geminiModel || 'gemini-3.8-flash';
    this.apiKey = options?.apiKey ?? serverConfig.geminiApiKey;
    this.defaultTimeoutMs = options?.timeoutMs || DEFAULT_GEMINI_TIMEOUT_MS;

    if (options?.client) {
      this.client = options.client;
    }
  }

  /**
   * Returns whether the provider is configured with necessary credentials.
   */
  public isConfigured(): boolean {
    return Boolean(this.client || this.apiKey);
  }

  /**
   * Lazily initializes and returns the underlying GenAI client.
   */
  public getClient(): GoogleGenAIClientLike {
    if (!this.client) {
      if (!this.apiKey) {
        throw new AiProviderError({
          providerId: this.id,
          category: 'auth_error',
          message: 'GEMINI_API_KEY is not configured on the server',
          statusCode: 401,
          isRetryable: false,
        });
      }
      this.client = new GoogleGenAI({ apiKey: this.apiKey }) as unknown as GoogleGenAIClientLike;
    }
    return this.client;
  }

  /**
   * Safe status check with optional bounded live probe.
   * Does NOT make external network calls unless probe is explicitly true.
   */
  public async getStatus(probe = false): Promise<ProviderStatusReport> {
    const configured = this.isConfigured();

    if (!configured) {
      return {
        providerId: this.id,
        displayName: this.displayName,
        isConfigured: false,
        status: 'unconfigured',
        capabilities: Array.from(this.capabilities),
        model: this.defaultModel,
      };
    }

    if (!probe) {
      return {
        providerId: this.id,
        displayName: this.displayName,
        isConfigured: true,
        status: 'configured',
        capabilities: Array.from(this.capabilities),
        model: this.defaultModel,
      };
    }

    // Bounded explicit probe
    try {
      const client = this.getClient();
      await withTimeout(
        client.models.generateContent({
          model: this.defaultModel,
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Respond with OK' }],
            },
          ],
        }),
        5000,
        'Gemini health probe'
      );

      return {
        providerId: this.id,
        displayName: this.displayName,
        isConfigured: true,
        status: 'available',
        capabilities: Array.from(this.capabilities),
        model: this.defaultModel,
      };
    } catch (probeError: unknown) {
      const classification = classifyError(probeError);
      return {
        providerId: this.id,
        displayName: this.displayName,
        isConfigured: true,
        status: 'unavailable',
        capabilities: Array.from(this.capabilities),
        model: this.defaultModel,
        lastErrorCategory: classification.category,
      };
    }
  }

  /**
   * Executes a normalized AI request using the Gemini adapter.
   */
  public async execute<T = unknown>(request: ProviderRequest<T>): Promise<ProviderResponse<T>> {
    const startTime = Date.now();
    const model = request.modelOverride || this.defaultModel;
    const timeoutMs = request.timeoutMs || this.defaultTimeoutMs;

    // Validate capability support
    if (!this.capabilities.has(request.capability)) {
      throw new AiProviderError({
        providerId: this.id,
        category: 'unsupported_capability',
        message: `Provider "${this.id}" does not support capability "${request.capability}"`,
        statusCode: 400,
        isRetryable: false,
      });
    }

    try {
      const client = this.getClient();
      let parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

      switch (request.capability) {
        case 'text-generation': {
          parts = [{ text: request.prompt }];
          break;
        }

        case 'image-understanding': {
          const cleanBase64 = request.imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const mimeType = request.mimeType || 'image/png';
          parts = [
            { text: request.prompt },
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
          ];
          break;
        }

        case 'multi-image-analysis': {
          const boundedImages = request.imagesBase64.slice(0, MAX_MULTI_IMAGE_FRAMES);
          const mimeType = request.mimeType || 'image/png';
          parts = [
            { text: request.prompt },
            ...boundedImages.map((b64) => ({
              inlineData: {
                mimeType,
                data: b64.replace(/^data:image\/\w+;base64,/, ''),
              },
            })),
          ];
          break;
        }
      }

      const rawCall = client.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
      });

      const response = await withTimeout(rawCall, timeoutMs, `Gemini ${request.capability}`);
      const durationMs = Date.now() - startTime;
      const responseText = response?.text || '';

      // If no schema was requested, return rawText as data
      if (!request.schema) {
        return {
          data: responseText as unknown as T,
          rawText: responseText,
          metadata: {
            providerId: this.id,
            model,
            durationMs,
            success: true,
          },
        };
      }

      // Parse and validate structured output
      const cleaned = responseText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(cleaned);
      } catch (jsonErr: unknown) {
        throw new AiProviderError({
          providerId: this.id,
          category: 'invalid_output',
          message: `Gemini response is not valid JSON: ${(jsonErr as Error).message}`,
          statusCode: 502,
          isRetryable: false,
          cause: jsonErr,
        });
      }

      try {
        const validated = request.schema.parse(parsedJson);
        return {
          data: validated,
          rawText: responseText,
          metadata: {
            providerId: this.id,
            model,
            durationMs,
            success: true,
          },
        };
      } catch (schemaErr: unknown) {
        throw new AiProviderError({
          providerId: this.id,
          category: 'invalid_output',
          message: `Gemini structured output failed schema validation: ${(schemaErr as Error).message}`,
          statusCode: 502,
          isRetryable: false,
          cause: schemaErr,
        });
      }
    } catch (err: unknown) {
      const classification = classifyError(err);
      const safeMessage = sanitizeErrorMessage(
        err instanceof Error ? err.message : String(err),
        this.apiKey
      );

      throw new AiProviderError({
        providerId: this.id,
        category: classification.category,
        message: safeMessage,
        statusCode: classification.statusCode,
        isRetryable: classification.isRetryable,
        cause: err,
      });
    }
  }
}

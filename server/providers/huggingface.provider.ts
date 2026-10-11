import { z } from 'zod';
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

/** Default timeout for Hugging Face API calls in milliseconds (35 seconds) */
export const DEFAULT_HF_TIMEOUT_MS = 35_000;

/** Default Hugging Face Vision-Language Model */
export const DEFAULT_HF_VISION_MODEL = 'Qwen/Qwen2.5-VL-3B-Instruct';

/**
 * Executes a promise with an AbortSignal-aware timeout.
 * Cleans up listeners and timers cleanly on settlement or abort.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  signal?: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error('AbortError'));
    }

    let timer: NodeJS.Timeout | null = null;

    const onAbort = () => {
      if (timer) clearTimeout(timer);
      reject(new Error('AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        if (timer) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        if (timer) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

/** Sanitize error messages to ensure Hugging Face tokens and secrets are never leaked */
export function sanitizeHfErrorMessage(message: string, token?: string): string {
  let sanitized = message;
  if (token && token.length > 5) {
    sanitized = sanitized.split(token).join('[REDACTED_HF_TOKEN]');
  }
  // Mask HF token patterns (hf_...)
  sanitized = sanitized.replace(/hf_[0-9A-Za-z-_]{20,}/g, '[REDACTED_HF_TOKEN]');
  return sanitized;
}

/** Classify Hugging Face errors into standard ProviderErrorCategory */
export function classifyHfError(
  error: unknown,
  httpStatus?: number
): {
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

  // Cancellation / Abort
  if (
    lowerMsg.includes('aborterror') ||
    lowerMsg.includes('abort') ||
    lowerMsg.includes('cancelled') ||
    lowerMsg.includes('canceled')
  ) {
    return { category: 'cancelled', statusCode: 499, isRetryable: false };
  }

  // Missing configuration
  if (
    lowerMsg.includes('missing_configuration') ||
    lowerMsg.includes('is not configured') ||
    lowerMsg.includes('missing hf_token') ||
    lowerMsg.includes('missing token')
  ) {
    return { category: 'auth_error', statusCode: 401, isRetryable: false };
  }

  // Authentication & Permissions
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('invalid credentials') ||
    lowerMsg.includes('invalid username or password') ||
    lowerMsg.includes('invalid token')
  ) {
    return { category: 'auth_error', statusCode: 401, isRetryable: false };
  }

  // Rate Limiting
  if (
    httpStatus === 429 ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('too many requests') ||
    lowerMsg.includes('429')
  ) {
    return { category: 'rate_limit', statusCode: 429, isRetryable: true };
  }

  // Timeout
  if (
    httpStatus === 504 ||
    lowerMsg.includes('timed out') ||
    lowerMsg.includes('timeout')
  ) {
    return { category: 'timeout', statusCode: 504, isRetryable: true };
  }

  // Model loading / transient 503
  if (
    httpStatus === 503 ||
    lowerMsg.includes('currently loading') ||
    lowerMsg.includes('estimated_time') ||
    lowerMsg.includes('service unavailable')
  ) {
    return { category: 'network_error', statusCode: 503, isRetryable: true };
  }

  // Model not found or invalid argument
  if (
    httpStatus === 404 ||
    lowerMsg.includes('model not found') ||
    lowerMsg.includes('does not exist') ||
    lowerMsg.includes('not supported')
  ) {
    return { category: 'invalid_request', statusCode: 404, isRetryable: false };
  }

  // Invalid Model Output (JSON parse or schema mismatch, Zod validation errors)
  if (
    error instanceof z.ZodError ||
    (error as { name?: string })?.name === 'ZodError' ||
    lowerMsg.includes('schema') ||
    lowerMsg.includes('json') ||
    lowerMsg.includes('parse') ||
    lowerMsg.includes('syntaxerror') ||
    lowerMsg.includes('too_big') ||
    lowerMsg.includes('invalid_type')
  ) {
    return { category: 'invalid_output', statusCode: 502, isRetryable: false };
  }

  // Network & Transport Failures
  if (
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('econnrefused') ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('etimedout') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('network')
  ) {
    return { category: 'network_error', statusCode: 503, isRetryable: true };
  }

  return { category: 'server_error', statusCode: httpStatus || 500, isRetryable: false };
}

export interface HuggingFaceProviderOptions {
  token?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  endpointUrl?: string;
  fetchFn?: typeof fetch;
}

/**
 * Hugging Face Vision-Language Provider Adapter
 * Connects to Hugging Face Inference Router / API for multimodal image understanding.
 * Never leaks HF_TOKEN or credentials.
 */
export class HuggingFaceProvider implements AiProvider {
  public readonly id: AiProviderId = 'huggingface';
  public readonly displayName = 'Hugging Face';
  public readonly defaultModel: string;
  public readonly capabilities: ReadonlySet<AiCapability> = new Set<AiCapability>([
    'image-understanding',
    'text-generation',
  ]);

  private token: string | undefined;
  private defaultTimeoutMs: number;
  public readonly defaultMaxRetries: number;
  private endpointUrl: string;
  private fetchFn: typeof fetch;

  constructor(options?: HuggingFaceProviderOptions) {
    this.token = options && 'token' in options ? options.token : serverConfig.hfToken;
    this.defaultModel = options?.model || serverConfig.hfVisionModel || DEFAULT_HF_VISION_MODEL;
    this.defaultTimeoutMs =
      options?.timeoutMs || serverConfig.hfTimeoutMs || DEFAULT_HF_TIMEOUT_MS;
    this.defaultMaxRetries = options?.maxRetries ?? 1;
    this.endpointUrl =
      options?.endpointUrl || 'https://router.huggingface.co/hf-inference/v1/chat/completions';
    this.fetchFn = options?.fetchFn || globalThis.fetch;
  }

  /**
   * Returns whether Hugging Face is configured with a token or custom client.
   */
  public isConfigured(): boolean {
    return Boolean(this.token || this.fetchFn !== globalThis.fetch);
  }

  /**
   * Diagnostic health check for the provider.
   */
  public async getStatus(probe = false): Promise<ProviderStatusReport> {
    const configured = this.isConfigured();
    if (!configured) {
      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'unconfigured',
        isConfigured: false,
        model: this.defaultModel,
        capabilities: Array.from(this.capabilities),
      };
    }

    if (!probe) {
      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'configured',
        isConfigured: true,
        model: this.defaultModel,
        capabilities: Array.from(this.capabilities),
      };
    }

    try {
      await this.execute({
        capability: 'text-generation',
        prompt: 'Ping: Respond with {"status":"ok"}',
        schema: z.object({ status: z.string() }),
        timeoutMs: 8000,
      });

      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'available',
        isConfigured: true,
        model: this.defaultModel,
        capabilities: Array.from(this.capabilities),
      };
    } catch (err: unknown) {
      const classification = classifyHfError(err);
      return {
        providerId: this.id,
        displayName: this.displayName,
        status: 'unavailable',
        isConfigured: true,
        model: this.defaultModel,
        capabilities: Array.from(this.capabilities),
        lastErrorCategory: classification.category,
      };
    }
  }

  /**
   * Executes an AI request against Hugging Face Inference API.
   */
  public async execute<T = unknown>(request: ProviderRequest<T>): Promise<ProviderResponse<T>> {
    if (!this.capabilities.has(request.capability)) {
      throw new AiProviderError({
        providerId: this.id,
        category: 'unsupported_capability',
        code: 'UNSUPPORTED_CAPABILITY',
        message: `Hugging Face provider does not support capability "${request.capability}"`,
        statusCode: 400,
        isRetryable: false,
        correlationId: request.correlationId,
      });
    }

    if (!this.isConfigured()) {
      throw new AiProviderError({
        providerId: this.id,
        category: 'auth_error',
        code: 'MISSING_CONFIGURATION',
        message: 'HF_TOKEN is not configured on the server',
        statusCode: 401,
        isRetryable: false,
        correlationId: request.correlationId,
      });
    }

    if (request.signal?.aborted) {
      throw new AiProviderError({
        providerId: this.id,
        category: 'cancelled',
        code: 'CANCELLED',
        message: 'Request was cancelled',
        statusCode: 499,
        isRetryable: false,
        correlationId: request.correlationId,
      });
    }

    const timeoutMs = request.timeoutMs || this.defaultTimeoutMs;
    const maxRetries = request.maxRetries ?? this.defaultMaxRetries;
    const targetModel = request.modelOverride || this.defaultModel;

    let attempt = 0;
    const startTime = Date.now();

    while (true) {
      if (request.signal?.aborted) {
        throw new AiProviderError({
          providerId: this.id,
          category: 'cancelled',
          code: 'CANCELLED',
          message: 'Request was cancelled',
          statusCode: 499,
          isRetryable: false,
          correlationId: request.correlationId,
        });
      }

      try {
        let messages: Array<{
          role: string;
          content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
        }> = [];

        if (request.capability === 'image-understanding') {
          const imageUri = request.imageBase64.startsWith('data:')
            ? request.imageBase64
            : `data:${request.mimeType || 'image/png'};base64,${request.imageBase64}`;

          messages = [
            {
              role: 'user',
              content: [
                { type: 'text', text: request.prompt },
                { type: 'image_url', image_url: { url: imageUri } },
              ],
            },
          ];
        } else {
          // text-generation
          messages = [
            {
              role: 'user',
              content: request.prompt,
            },
          ];
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }
        if (request.correlationId) {
          headers['X-Correlation-ID'] = request.correlationId;
        }

        const requestPayload = {
          model: targetModel,
          messages,
          max_tokens: 2048,
          temperature: 0.2,
        };

        const fetchPromise = this.fetchFn(this.endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestPayload),
          signal: request.signal,
        });

        const response = await withTimeout(
          fetchPromise,
          timeoutMs,
          `Hugging Face model "${targetModel}" inference`,
          request.signal
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          let errorMessage = `Hugging Face request failed with HTTP ${response.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              errorMessage = Array.isArray(errorJson.error)
                ? errorJson.error.join(', ')
                : typeof errorJson.error === 'string'
                ? errorJson.error
                : JSON.stringify(errorJson.error);
            } else if (errorJson.message) {
              errorMessage = errorJson.message;
            }
          } catch {
            if (errorText) errorMessage = errorText.slice(0, 200);
          }

          const classification = classifyHfError(new Error(errorMessage), response.status);
          const safeMessage = sanitizeHfErrorMessage(errorMessage, this.token);

          // Retry transient failures if within bounded limit and not cancelled
          if (classification.isRetryable && attempt < maxRetries && !request.signal?.aborted) {
            attempt++;
            const waitMs = Math.min(200 * Math.pow(2, attempt), 2000);
            await new Promise((res) => setTimeout(res, waitMs));
            continue;
          }

          throw new AiProviderError({
            providerId: this.id,
            category: classification.category,
            code: classification.category.toUpperCase(),
            message: safeMessage,
            statusCode: classification.statusCode || response.status,
            isRetryable: classification.isRetryable,
            correlationId: request.correlationId,
          });
        }

        const responseJson = await response.json();
        const durationMs = Date.now() - startTime;

        // Extract assistant message content
        const rawContent =
          responseJson.choices?.[0]?.message?.content ||
          (Array.isArray(responseJson) ? responseJson[0]?.generated_text : responseJson?.generated_text) ||
          '';

        let parsedData: T = rawContent as unknown as T;

        if (request.schema) {
          const cleaned = rawContent
            .replace(/```(?:json)?/gi, '')
            .replace(/```/g, '')
            .trim();

          let jsonParsed: unknown;
          try {
            jsonParsed = JSON.parse(cleaned);
          } catch (jsonErr: unknown) {
            throw new AiProviderError({
              providerId: this.id,
              category: 'invalid_output',
              code: 'INVALID_RESPONSE',
              message: `Hugging Face returned non-JSON text: ${(jsonErr as Error).message}`,
              statusCode: 502,
              isRetryable: false,
              correlationId: request.correlationId,
            });
          }

          parsedData = request.schema.parse(jsonParsed);
        }

        return {
          data: parsedData,
          rawText: rawContent,
          metadata: {
            providerId: this.id,
            model: targetModel,
            durationMs,
            success: true,
            retryCount: attempt,
            correlationId: request.correlationId,
            usage: {
              promptTokens: responseJson.usage?.prompt_tokens,
              completionTokens: responseJson.usage?.completion_tokens,
              totalTokens: responseJson.usage?.total_tokens,
            },
          },
        };
      } catch (err: unknown) {
        if (
          (err instanceof Error && (err.name === 'AbortError' || err.message === 'AbortError')) ||
          request.signal?.aborted
        ) {
          throw new AiProviderError({
            providerId: this.id,
            category: 'cancelled',
            code: 'CANCELLED',
            message: 'Request was cancelled',
            statusCode: 499,
            isRetryable: false,
            correlationId: request.correlationId,
          });
        }

        if (err instanceof AiProviderError) {
          throw err;
        }

        const classification = classifyHfError(err);
        const safeMessage = sanitizeHfErrorMessage(
          err instanceof Error ? err.message : String(err),
          this.token
        );

        if (classification.isRetryable && attempt < maxRetries && !request.signal?.aborted) {
          attempt++;
          const waitMs = Math.min(200 * Math.pow(2, attempt), 2000);
          await new Promise((res) => setTimeout(res, waitMs));
          continue;
        }

        throw new AiProviderError({
          providerId: this.id,
          category: classification.category,
          code: classification.category.toUpperCase(),
          message: safeMessage,
          statusCode: classification.statusCode,
          isRetryable: classification.isRetryable,
          correlationId: request.correlationId,
          cause: err,
        });
      }
    }
  }
}

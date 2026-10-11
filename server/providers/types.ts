import { z } from 'zod';

export type AiProviderId = 'gemini' | 'huggingface' | 'mock';

export type AiCapability =
  | 'text-generation'
  | 'image-understanding'
  | 'multi-image-analysis'
  | 'image-generation';

export type ProviderStatus =
  | 'unconfigured'
  | 'configured'
  | 'available'
  | 'unavailable'
  | 'unknown';

export type ProviderErrorCategory =
  | 'missing_configuration'
  | 'auth_error'
  | 'rate_limit'
  | 'quota_exhausted'
  | 'invalid_request'
  | 'unsupported_image'
  | 'timeout'
  | 'network_error'
  | 'invalid_response'
  | 'server_error'
  | 'invalid_output'
  | 'unsupported_capability'
  | 'cancelled'
  | 'unknown_error';

export interface ProviderExecutionMetadata {
  providerId: AiProviderId;
  model: string;
  durationMs: number;
  success: boolean;
  errorCategory?: ProviderErrorCategory;
  retryCount?: number;
  correlationId?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface BaseProviderRequest<T = unknown> {
  schema?: z.ZodType<T>;
  timeoutMs?: number;
  modelOverride?: string;
  maxRetries?: number;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface TextGenerationRequest<T = unknown> extends BaseProviderRequest<T> {
  capability: 'text-generation';
  prompt: string;
  systemInstruction?: string;
}

export interface ImageUnderstandingRequest<T = unknown> extends BaseProviderRequest<T> {
  capability: 'image-understanding';
  prompt: string;
  imageBase64: string;
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface MultiImageAnalysisRequest<T = unknown> extends BaseProviderRequest<T> {
  capability: 'multi-image-analysis';
  prompt: string;
  imagesBase64: string[];
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface ImageGenerationRequest<T = unknown> extends BaseProviderRequest<T> {
  capability: 'image-generation';
  prompt: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  numberOfImages?: number;
  outputMimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
}

export type ProviderRequest<T = unknown> =
  | TextGenerationRequest<T>
  | ImageUnderstandingRequest<T>
  | MultiImageAnalysisRequest<T>
  | ImageGenerationRequest<T>;

export interface ProviderResponse<T = unknown> {
  data: T;
  rawText: string;
  metadata: ProviderExecutionMetadata;
}

export class AiProviderError extends Error {
  public readonly providerId: AiProviderId;
  public readonly category: ProviderErrorCategory;
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly isRetryable: boolean;
  public readonly retryAfterMs?: number;
  public readonly correlationId?: string;

  constructor(options: {
    providerId: AiProviderId;
    category: ProviderErrorCategory;
    message: string;
    code?: string;
    statusCode?: number;
    isRetryable?: boolean;
    retryAfterMs?: number;
    correlationId?: string;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'AiProviderError';
    this.providerId = options.providerId;
    this.category = options.category;
    this.code = options.code || options.category.toUpperCase();
    this.statusCode = options.statusCode;
    this.isRetryable = options.isRetryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
    this.correlationId = options.correlationId;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

export interface ProviderStatusReport {
  providerId: AiProviderId;
  displayName: string;
  isConfigured: boolean;
  status: ProviderStatus;
  capabilities: AiCapability[];
  model: string;
  lastErrorCategory?: ProviderErrorCategory;
}

export interface AiProvider {
  readonly id: AiProviderId;
  readonly displayName: string;
  readonly defaultModel: string;
  readonly capabilities: ReadonlySet<AiCapability>;

  isConfigured(): boolean;
  getStatus(probe?: boolean): Promise<ProviderStatusReport>;
  execute<T>(request: ProviderRequest<T>): Promise<ProviderResponse<T>>;
}

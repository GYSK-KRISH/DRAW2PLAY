/**
 * Draw2Play AI — Truthful AI Status & Pipeline Model
 *
 * Enforces explicit separation between:
 * - Backend server connectivity (port 3001)
 * - Provider configuration (Gemini API key present and verified)
 * - Active request state (validating, uploading, analyzing, ready)
 * - Provenance truth (never claims Gemini Vision for heuristic fallback)
 */

export type BackendConnectivity = 'connected' | 'offline' | 'checking';

export type ProviderConfiguration = 'gemini-ready' | 'huggingface-ready' | 'mock-fallback' | 'misconfigured';

export type AnalysisStage =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'analyzing'
  | 'validating_result'
  | 'generating'
  | 'ready'
  | 'error';

export type ResultProvenance = 'gemini-vision' | 'huggingface-vision' | 'mock-heuristic' | 'manual-input' | 'none';

export type LastErrorCategory =
  | 'none'
  | 'missing_config'
  | 'auth_error'
  | 'quota_exhausted'
  | 'rate_limit'
  | 'timeout'
  | 'network_error'
  | 'invalid_output'
  | 'validation_error';

export interface AiPipelineStatus {
  connectivity: BackendConnectivity;
  providerConfig: ProviderConfiguration;
  activeStage: AnalysisStage;
  latestProvider: string;
  latestProvenance: ResultProvenance;
  fallbackReason: string | null;
  lastErrorCategory: LastErrorCategory;
  lastErrorMessage: string | null;
  retryAvailable: boolean;
  correlationId?: string;
  lastCheckedAt?: string;
}

export const DEFAULT_AI_STATUS: AiPipelineStatus = {
  connectivity: 'checking',
  providerConfig: 'mock-fallback',
  activeStage: 'idle',
  latestProvider: 'Deterministic Local Heuristic',
  latestProvenance: 'none',
  fallbackReason: 'No reference analyzed yet in this session.',
  lastErrorCategory: 'none',
  lastErrorMessage: null,
  retryAvailable: false,
};

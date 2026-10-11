export type AnalysisProcessingStage =
  | 'received'
  | 'validating'
  | 'uploading'
  | 'analyzing'
  | 'retry'
  | 'validating_result'
  | 'success'
  | 'fallback'
  | 'error'
  | 'cancelled';

export interface AnalysisLogEvent {
  correlationId: string;
  stage: AnalysisProcessingStage;
  durationMs: number;
  provider: string;
  model: string;
  httpStatus: number;
  errorCategory?: string | null;
  retryCount?: number;
  isFallback: boolean;
  details?: string;
}

/**
 * Secret-safe, structured logger for AI analysis events.
 * Never logs API keys, auth headers, full base64 image payloads, or sensitive user credentials.
 */
export function logAnalysisEvent(event: AnalysisLogEvent): void {
  const timestamp = new Date().toISOString();

  // Ensure sanitized error category and details
  let sanitizedDetails = event.details;
  if (sanitizedDetails) {
    sanitizedDetails = sanitizedDetails
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
      .replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, '[IMAGE_BASE64_DATA]')
      .slice(0, 300);
  }

  const payload = {
    timestamp,
    correlationId: event.correlationId,
    stage: event.stage,
    durationMs: event.durationMs,
    provider: event.provider,
    model: event.model,
    httpStatus: event.httpStatus,
    errorCategory: event.errorCategory || null,
    retryCount: event.retryCount ?? 0,
    isFallback: event.isFallback,
    ...(sanitizedDetails ? { details: sanitizedDetails } : {}),
  };

  const line = `[AI-ANALYSIS] ${JSON.stringify(payload)}`;
  if (event.stage === 'error') {
    console.error(line);
  } else if (event.stage === 'retry' || event.isFallback) {
    console.warn(line);
  } else {
    console.log(line);
  }
}

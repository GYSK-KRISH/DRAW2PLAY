import type {
  ReferenceAnalysis,
  GameCategory,
  TargetEngine,
} from '../types/reference.js';
import { ReferenceAnalysisSchema } from '../types/reference.js';
import {
  uploadReferenceMedia,
  analyzeReferenceVision,
  ApiError,
} from './api.js';
import type { LoadedImageMedia } from '../utils/mediaExtractor.js';

export type AnalysisLifecycleState =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'analyzing'
  | 'validating_result'
  | 'success'
  | 'error'
  | 'cancelled';

export interface AnalysisErrorState {
  code: string;
  message: string;
  category?: string;
  isRetryable: boolean;
  canFallbackToHeuristic: boolean;
  correlationId?: string;
  details?: unknown;
}

export interface AnalysisLifecycleSnapshot {
  state: AnalysisLifecycleState;
  correlationId: string | null;
  analysis: ReferenceAnalysis | null;
  source: 'gemini-vision' | 'huggingface-vision' | 'mock-heuristic' | 'manual-input' | 'development-mock' | null;
  provider: {
    id: string;
    model: string;
    isFallback: boolean;
  } | null;
  notice: string | null;
  error: AnalysisErrorState | null;

  // Preserved input state across recoverable errors
  preservedMedia: LoadedImageMedia | null;
  preservedPrompt: string;
  preservedCategory: GameCategory;
  preservedEngine: TargetEngine;
  referenceId: string | null;
}

export type LifecycleListener = (snapshot: AnalysisLifecycleSnapshot) => void;

/**
 * Central Reference Analysis Lifecycle Manager
 * Enforces explicit state machine:
 * idle -> validating -> uploading -> analyzing -> validating_result -> success | error | cancelled
 *
 * Guarantees:
 * - Duplicate submission prevention
 * - Cancellation via AbortController
 * - Correlation ID tracking
 * - Stale response rejection
 * - Input preservation on error
 * - Truthful provenance & strict validation
 */
export class AnalysisLifecycleManager {
  private state: AnalysisLifecycleState = 'idle';
  private activeCorrelationId: string | null = null;
  private abortController: AbortController | null = null;
  private listeners = new Set<LifecycleListener>();

  private analysis: ReferenceAnalysis | null = null;
  private source: 'gemini-vision' | 'huggingface-vision' | 'mock-heuristic' | 'manual-input' | 'development-mock' | null = null;
  private provider: { id: string; model: string; isFallback: boolean } | null = null;
  private notice: string | null = null;
  private error: AnalysisErrorState | null = null;

  // Preserved inputs
  private preservedMedia: LoadedImageMedia | null = null;
  private preservedPrompt: string = '';
  private preservedCategory: GameCategory = 'voxel';
  private preservedEngine: TargetEngine = 'future-3d-engine';
  private referenceId: string | null = null;

  public getState(): AnalysisLifecycleSnapshot {
    return {
      state: this.state,
      correlationId: this.activeCorrelationId,
      analysis: this.analysis,
      source: this.source,
      provider: this.provider,
      notice: this.notice,
      error: this.error,
      preservedMedia: this.preservedMedia,
      preservedPrompt: this.preservedPrompt,
      preservedCategory: this.preservedCategory,
      preservedEngine: this.preservedEngine,
      referenceId: this.referenceId,
    };
  }

  public subscribe(listener: LifecycleListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  public isBusy(): boolean {
    return (
      this.state === 'validating' ||
      this.state === 'uploading' ||
      this.state === 'analyzing' ||
      this.state === 'validating_result'
    );
  }

  public generateCorrelationId(): string {
    return `corr-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
  }

  /**
   * Starts an end-to-end analysis request.
   * Rejects duplicate submissions while active.
   */
  public async startAnalysis(params: {
    media: LoadedImageMedia;
    userPrompt: string;
    category?: GameCategory;
    engine?: TargetEngine;
    mode?: 'auto' | 'gemini-only' | 'hf-only' | 'heuristic-only';
    allowFallback?: boolean;
    correlationIdOverride?: string;
  }): Promise<ReferenceAnalysis | null> {
    if (this.isBusy()) {
      console.warn('[AnalysisLifecycle] Duplicate submission ignored while request is in flight');
      return null;
    }

    // Abort previous controller if any
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const correlationId = params.correlationIdOverride || this.generateCorrelationId();
    this.activeCorrelationId = correlationId;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Preserve inputs and clear obsolete errors
    this.preservedMedia = params.media;
    this.preservedPrompt = params.userPrompt;
    if (params.category) this.preservedCategory = params.category;
    if (params.engine) this.preservedEngine = params.engine;
    this.error = null;
    this.notice = null;

    try {
      // 1. VALIDATING
      this.state = 'validating';
      this.notify();

      if (!params.media || !params.media.dataUrl) {
        throw new Error('No valid image media provided for analysis.');
      }
      if (params.media.dataUrl.length < 50) {
        throw new Error('Image data is too small or truncated.');
      }
      if (signal.aborted) throw new Error('AbortError');

      // 2. UPLOADING
      this.state = 'uploading';
      this.notify();

      const uploadRes = await uploadReferenceMedia(
        params.media.dataUrl,
        params.media.fileName,
        'image',
        params.userPrompt,
        { correlationId, signal }
      );

      if (signal.aborted) throw new Error('AbortError');
      if (this.activeCorrelationId !== correlationId) {
        console.warn(`[AnalysisLifecycle] Discarding stale upload response for ${correlationId}`);
        return null;
      }

      this.referenceId = uploadRes.reference.id;

      // 3. ANALYZING
      this.state = 'analyzing';
      this.notify();

      const analysisRes = await analyzeReferenceVision(
        params.media.dataUrl,
        params.userPrompt,
        {
          correlationId,
          signal,
          mode: params.mode || 'auto',
          allowFallback: params.allowFallback ?? true,
          referenceId: this.referenceId,
        }
      );

      if (signal.aborted) throw new Error('AbortError');
      if (this.activeCorrelationId !== correlationId) {
        console.warn(`[AnalysisLifecycle] Discarding stale analysis response for ${correlationId}`);
        return null;
      }

      // 4. VALIDATING RESULT
      this.state = 'validating_result';
      this.notify();

      const validatedAnalysis = ReferenceAnalysisSchema.parse(analysisRes.analysis);

      if (signal.aborted) throw new Error('AbortError');
      if (this.activeCorrelationId !== correlationId) {
        console.warn(`[AnalysisLifecycle] Discarding stale validation result for ${correlationId}`);
        return null;
      }

      // 5. SUCCESS
      this.analysis = validatedAnalysis;
      this.source = analysisRes.source;
      this.provider = analysisRes.provider || null;
      this.notice = analysisRes.notice || null;
      this.state = 'success';
      this.abortController = null;
      this.notify();

      return validatedAnalysis;
    } catch (err: unknown) {
      // Check if aborted/cancelled
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError') || (err as Error).message === 'AbortError') {
        if (this.activeCorrelationId === correlationId) {
          this.state = 'cancelled';
          this.abortController = null;
          this.notify();
        }
        return null;
      }

      // Discard stale error
      if (this.activeCorrelationId !== correlationId) {
        return null;
      }

      // Format typed error state
      let code = 'ANALYSIS_ERROR';
      let message = 'An error occurred during reference analysis.';
      let category = 'unknown_error';
      let isRetryable = true;
      let canFallbackToHeuristic = true;
      let details: unknown = undefined;

      if (err instanceof ApiError) {
        code = err.code;
        message = err.message;
        category = err.category || 'api_error';
        isRetryable = err.isRetryable;
        canFallbackToHeuristic = err.canFallbackToHeuristic;
        details = err.details;
      } else if (err instanceof Error) {
        message = err.message;
        code = err.name.toUpperCase();
      }

      this.error = {
        code,
        message,
        category,
        isRetryable,
        canFallbackToHeuristic,
        correlationId,
        details,
      };

      this.state = 'error';
      this.abortController = null;
      this.notify();
      return null;
    }
  }

  /**
   * Cancel the currently active in-flight request.
   */
  public cancel(): void {
    if (this.isBusy() && this.abortController) {
      this.abortController.abort();
      this.state = 'cancelled';
      this.abortController = null;
      this.notify();
    }
  }

  /**
   * Retry the analysis using preserved media and prompt.
   */
  public async retry(): Promise<ReferenceAnalysis | null> {
    if (!this.preservedMedia) {
      console.warn('[AnalysisLifecycle] Cannot retry: no preserved media available');
      return null;
    }

    return this.startAnalysis({
      media: this.preservedMedia,
      userPrompt: this.preservedPrompt,
      category: this.preservedCategory,
      engine: this.preservedEngine,
      mode: 'auto',
      allowFallback: false,
    });
  }

  /**
   * Explicitly fall back to local heuristic analysis when live AI fails.
   */
  public async runHeuristicFallback(): Promise<ReferenceAnalysis | null> {
    if (!this.preservedMedia) {
      console.warn('[AnalysisLifecycle] Cannot run fallback: no preserved media available');
      return null;
    }

    return this.startAnalysis({
      media: this.preservedMedia,
      userPrompt: this.preservedPrompt,
      category: this.preservedCategory,
      engine: this.preservedEngine,
      mode: 'heuristic-only',
      allowFallback: true,
    });
  }

  /**
   * Update preserved inputs without triggering immediate analysis.
   */
  public editInputs(updates: {
    prompt?: string;
    category?: GameCategory;
    engine?: TargetEngine;
    media?: LoadedImageMedia;
  }): void {
    if (updates.prompt !== undefined) this.preservedPrompt = updates.prompt;
    if (updates.category !== undefined) this.preservedCategory = updates.category;
    if (updates.engine !== undefined) this.preservedEngine = updates.engine;
    if (updates.media !== undefined) this.preservedMedia = updates.media;
    if (this.state === 'error' || this.state === 'cancelled') {
      this.state = 'idle';
      this.error = null;
    }
    this.notify();
  }

  /**
   * Reset the lifecycle state to idle.
   */
  public reset(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.state = 'idle';
    this.activeCorrelationId = null;
    this.analysis = null;
    this.source = null;
    this.provider = null;
    this.notice = null;
    this.error = null;
    this.preservedMedia = null;
    this.preservedPrompt = '';
    this.referenceId = null;
    this.notify();
  }
}

export const analysisLifecycleManager = new AnalysisLifecycleManager();

import {
  AiProvider,
  AiProviderId,
  AiCapability,
  ProviderStatusReport,
  AiProviderError,
} from './types.js';
import { GeminiProvider } from './gemini.provider.js';
import { HuggingFaceProvider } from './huggingface.provider.js';

/**
 * Server-side AI Provider Registry.
 * Manages registered AI providers, capability lookups, and diagnostic reporting.
 */
export class AiProviderRegistry {
  private providers = new Map<AiProviderId, AiProvider>();
  private defaultProviderId: AiProviderId = 'gemini';

  constructor() {}

  /**
   * Register a new AI provider.
   * Throws if a provider with the same ID is already registered unless override is true.
   */
  public registerProvider(provider: AiProvider, override = false): void {
    if (this.providers.has(provider.id) && !override) {
      throw new Error(`AI provider with ID "${provider.id}" is already registered`);
    }
    this.providers.set(provider.id, provider);
  }

  /**
   * Unregister an AI provider by ID.
   */
  public unregisterProvider(id: AiProviderId): boolean {
    return this.providers.delete(id);
  }

  /**
   * Retrieves a provider by ID, or undefined if not found.
   */
  public getProvider(id: AiProviderId): AiProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Retrieves a provider by ID, or throws a typed error if not registered.
   */
  public requireProvider(id: AiProviderId): AiProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new AiProviderError({
        providerId: id,
        category: 'unknown_error',
        message: `AI provider "${id}" is not registered on this server`,
        statusCode: 404,
        isRetryable: false,
      });
    }
    return provider;
  }

  /**
   * Returns the default server AI provider (Gemini).
   */
  public getDefaultProvider(): AiProvider {
    return this.requireProvider(this.defaultProviderId);
  }

  /**
   * Sets the default provider ID. Must already be registered.
   */
  public setDefaultProvider(id: AiProviderId): void {
    this.requireProvider(id);
    this.defaultProviderId = id;
  }

  /**
   * Retrieves a provider capable of performing the requested operation.
   * Throws a typed unsupported_capability error if the requested provider cannot perform it.
   */
  public getProviderForCapability(
    capability: AiCapability,
    preferredProviderId?: AiProviderId
  ): AiProvider {
    const providerId = preferredProviderId || this.defaultProviderId;
    const provider = this.requireProvider(providerId);

    if (!provider.capabilities.has(capability)) {
      throw new AiProviderError({
        providerId,
        category: 'unsupported_capability',
        message: `Provider "${providerId}" does not support capability "${capability}"`,
        statusCode: 400,
        isRetryable: false,
      });
    }

    return provider;
  }

  /**
   * Returns a list of all currently registered providers.
   */
  public getAllProviders(): AiProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Generates safe diagnostic status reports for all registered providers.
   * Never leaks API keys, secrets, or raw internal credentials.
   */
  public async getProviderStatuses(probe = false): Promise<ProviderStatusReport[]> {
    const reports: ProviderStatusReport[] = [];
    for (const provider of this.providers.values()) {
      reports.push(await provider.getStatus(probe));
    }
    return reports;
  }

  /**
   * Utility for testing: clear registered providers.
   */
  public clearForTesting(): void {
    this.providers.clear();
  }
}

/**
 * Singleton instance of the server-side AI provider registry.
 * In Phase 7.1, Gemini is the sole registered provider.
 */
export const aiProviderRegistry = new AiProviderRegistry();

// Initialize with the standard Gemini and Hugging Face providers
aiProviderRegistry.registerProvider(new GeminiProvider());
aiProviderRegistry.registerProvider(new HuggingFaceProvider());

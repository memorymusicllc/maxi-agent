/**
 * Pow3r Pass Service
 * Fetches credentials from https://config.superbots.link/pass
 * Guardian compliance: All API keys via Pow3r Pass
 */

import logger from '../utils/logger';

const POW3R_PASS_URL = 'https://config.superbots.link/pass';
const COMPONENT = 'Pow3rPass';

export interface CredentialInfo {
  provider: string;
  available: boolean;
  lastChecked: string;
}

export interface Pow3rPassCredential {
  token: string;
  provider: string;
  expiresAt?: string;
}

class Pow3rPassService {
  private cache: Map<string, { token: string; expiresAt: number }> = new Map();
  private healthChecked = false;
  private isHealthy = false;

  /**
   * Check if Pow3r Pass API is available
   */
  async checkHealth(): Promise<boolean> {
    logger.info(COMPONENT, 'Checking Pow3r Pass health...');
    
    try {
      const response = await fetch(`${POW3R_PASS_URL}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      this.healthChecked = true;
      this.isHealthy = response.ok;

      if (this.isHealthy) {
        logger.success(COMPONENT, 'Pow3r Pass is healthy');
      } else {
        logger.warn(COMPONENT, `Pow3r Pass health check failed: ${response.status}`);
      }

      return this.isHealthy;
    } catch (error) {
      logger.error(COMPONENT, 'Pow3r Pass health check error', error);
      this.healthChecked = true;
      this.isHealthy = false;
      return false;
    }
  }

  /**
   * Get credential for a specific provider
   */
  async getCredential(provider: string): Promise<string | null> {
    logger.info(COMPONENT, `Fetching credential for ${provider}`);

    // Check cache first
    const cached = this.cache.get(provider);
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug(COMPONENT, `Using cached credential for ${provider}`);
      return cached.token;
    }

    try {
      const response = await fetch(`${POW3R_PASS_URL}/credentials/${provider}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Agent-ID': 'maxi',
        },
      });

      if (!response.ok) {
        logger.warn(COMPONENT, `Failed to fetch credential for ${provider}: ${response.status}`);
        return null;
      }

      const data = await response.json() as Pow3rPassCredential;
      
      // Cache for 5 minutes (or until expiry)
      const expiresAt = data.expiresAt 
        ? new Date(data.expiresAt).getTime() 
        : Date.now() + 5 * 60 * 1000;
      
      this.cache.set(provider, { token: data.token, expiresAt });
      
      logger.success(COMPONENT, `Fetched credential for ${provider}`);
      return data.token;
    } catch (error) {
      logger.error(COMPONENT, `Error fetching credential for ${provider}`, error);
      return null;
    }
  }

  /**
   * Get all available credentials
   */
  async getAllCredentials(): Promise<CredentialInfo[]> {
    logger.info(COMPONENT, 'Fetching all available credentials');

    try {
      const response = await fetch(`${POW3R_PASS_URL}/credentials`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Agent-ID': 'maxi',
        },
      });

      if (!response.ok) {
        logger.warn(COMPONENT, `Failed to fetch credentials list: ${response.status}`);
        return [];
      }

      const data = await response.json() as { credentials: CredentialInfo[] };
      logger.success(COMPONENT, `Found ${data.credentials?.length || 0} credentials`);
      return data.credentials || [];
    } catch (error) {
      logger.error(COMPONENT, 'Error fetching credentials list', error);
      return [];
    }
  }

  /**
   * Check if a specific provider credential is available
   */
  async hasCredential(provider: string): Promise<boolean> {
    const credential = await this.getCredential(provider);
    return credential !== null;
  }

  /**
   * Clear cached credentials
   */
  clearCache(): void {
    logger.info(COMPONENT, 'Clearing credential cache');
    this.cache.clear();
  }
}

// Singleton instance
let instance: Pow3rPassService | null = null;

export function getPow3rPassService(): Pow3rPassService {
  if (!instance) {
    instance = new Pow3rPassService();
  }
  return instance;
}

export default Pow3rPassService;

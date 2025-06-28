// Environment configuration for different deployment scenarios

interface EnvironmentConfig {
  apiUrl: string;
  wsUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
  enableDebug: boolean;
}

// Auto-detect environment and configure URLs
function getEnvironmentConfig(): EnvironmentConfig {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const isDevelopment = import.meta.env.DEV || hostname === 'localhost' || hostname === '127.0.0.1';
  const isProduction = import.meta.env.PROD;

  // Default configuration
  let apiUrl = import.meta.env.VITE_API_URL;
  let wsUrl = import.meta.env.VITE_WS_URL;

  // Auto-detect if no environment variables are set
  if (!apiUrl || !wsUrl) {
    if (isDevelopment) {
      // Development defaults
      apiUrl = apiUrl || 'http://localhost:3000';
      wsUrl = wsUrl || 'ws://localhost:3000/wss';
    } else if (hostname.includes('vercel.app')) {
      // Vercel deployment - try to detect Render backend
      const renderBackendUrl = detectRenderBackendUrl();
      apiUrl = apiUrl || renderBackendUrl || 'https://scotland-yard-backend.onrender.com';
      wsUrl = wsUrl || (renderBackendUrl ? renderBackendUrl.replace('https://', 'wss://') + '/wss' : 'wss://scotland-yard-backend.onrender.com/wss');
    } else {
      // Production fallback
      apiUrl = apiUrl || `${protocol}//${hostname}:3000`;
      wsUrl = wsUrl || `${protocol === 'https:' ? 'wss:' : 'ws:'}//${hostname}:3000/wss`;
    }
  }

  return {
    apiUrl,
    wsUrl,
    isDevelopment,
    isProduction,
    enableDebug: isDevelopment || import.meta.env.VITE_DEBUG === 'true',
  };
}

// Try to detect Render backend URL from common patterns
function detectRenderBackendUrl(): string | null {
  // Check if there's a known backend URL pattern
  const frontendUrl = window.location.origin;
  
  // Common patterns for Render deployments
  const patterns = [
    // If frontend is yard-frontend-xxx, backend might be yard-backend-xxx
    frontendUrl.replace('yard-frontend', 'yard-backend').replace('frontend', 'backend'),
    // If frontend is scotland-yard-xxx, backend might be scotland-yard-backend-xxx
    frontendUrl.replace('scotland-yard', 'scotland-yard-backend'),
    // Generic pattern
    frontendUrl.replace(/^https:\/\/([^.]+)/, 'https://$1-backend'),
  ];

  // Return the first pattern that looks valid
  for (const pattern of patterns) {
    if (pattern !== frontendUrl && pattern.includes('.onrender.com')) {
      return pattern;
    }
  }

  return null;
}

// Export the configuration
export const ENV = getEnvironmentConfig();

// Debug logging
if (ENV.enableDebug) {
  console.log('🔧 Environment Configuration:', {
    hostname: window.location.hostname,
    origin: window.location.origin,
    apiUrl: ENV.apiUrl,
    wsUrl: ENV.wsUrl,
    isDevelopment: ENV.isDevelopment,
    isProduction: ENV.isProduction,
    envVars: {
      VITE_API_URL: import.meta.env.VITE_API_URL,
      VITE_WS_URL: import.meta.env.VITE_WS_URL,
      VITE_DEBUG: import.meta.env.VITE_DEBUG,
      DEV: import.meta.env.DEV,
      PROD: import.meta.env.PROD,
    }
  });
}

// Validation
if (!ENV.apiUrl || !ENV.wsUrl) {
  console.error('❌ Missing API or WebSocket URL configuration');
  console.log('Please set VITE_API_URL and VITE_WS_URL environment variables');
}

// Export individual values for convenience
export const API_URL = ENV.apiUrl;
export const WS_URL = ENV.wsUrl;
export const IS_DEVELOPMENT = ENV.isDevelopment;
export const IS_PRODUCTION = ENV.isProduction;
export const ENABLE_DEBUG = ENV.enableDebug;

// Helper function to test connectivity
export async function testConnectivity(): Promise<{
  api: boolean;
  websocket: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let apiConnected = false;
  let websocketConnected = false;

  // Test API connectivity
  try {
    const response = await fetch(`${ENV.apiUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    apiConnected = response.ok;
    if (!response.ok) {
      errors.push(`API health check failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    errors.push(`API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Test WebSocket connectivity
  try {
    const ws = new WebSocket(ENV.wsUrl);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        websocketConnected = true;
        ws.close();
        resolve(true);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  } catch (error) {
    errors.push(`WebSocket connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    api: apiConnected,
    websocket: websocketConnected,
    errors,
  };
}

// Export for use in components
export default ENV;

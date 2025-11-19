/**
 * API Client for Front-JS Worker
 * Provides methods to interact with the Cloudflare Worker endpoints
 */

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://front-js.m-tama-ramu.workers.dev';

export interface TunnelInfo {
  clientId: string;
  updatedAt: number;
  createdAt: number;
}

export interface TunnelsResponse {
  success: boolean;
  data: TunnelInfo[];
  count: number;
}

export interface ApiError {
  error: string;
  message?: string;
}

/**
 * Fetch list of available tunnels
 */
export async function fetchTunnels(): Promise<TunnelsResponse> {
  const response = await fetch(`${WORKER_URL}/tunnels`);

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.message || error.error);
  }

  return response.json();
}

/**
 * Execute a method through the tunnel proxy
 */
export async function executeTunnelRequest(
  clientId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${WORKER_URL}/tunnel/${clientId}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response;
}

/**
 * Find which process provides a given service
 */
async function findProcessForService(clientId: string, serviceName: string): Promise<string | null> {
  try {
    const registry = await fetchGrpcRegistry(clientId);

    for (const process of registry.available_processes) {
      if (process.services && process.services.length > 0) {
        for (const service of process.services) {
          if (service.name === serviceName) {
            return process.name;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding process for service:', error);
    return null;
  }
}

/**
 * Execute a gRPC-Web request through the tunnel proxy
 */
export async function executeGrpcWebRequest(
  clientId: string,
  service: string,
  method: string,
  data: any
): Promise<any> {
  // Derive process name from service name using registry
  const processName = await findProcessForService(clientId, service);

  if (!processName) {
    throw new Error(`Could not find process for service: ${service}`);
  }

  // Use /api/invoke endpoint with proper request format
  const invokeRequest = {
    process: processName,
    service: service,
    method: method,
    data: data
  };

  const response = await executeTunnelRequest(clientId, '/api/invoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(invokeRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to invoke gRPC method: ${errorText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'gRPC invocation failed');
  }

  return result.data;
}

/**
 * Execute a simple HTTP GET request through the tunnel
 */
export async function getTunnelData(
  clientId: string,
  path: string = ''
): Promise<any> {
  const response = await executeTunnelRequest(clientId, path, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error);
  }

  const contentType = response.headers.get('Content-Type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

/**
 * Execute a simple HTTP POST request through the tunnel
 */
export async function postTunnelData(
  clientId: string,
  path: string,
  data: any
): Promise<any> {
  const response = await executeTunnelRequest(clientId, path, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error);
  }

  return response.json();
}

export interface MessageField {
  name: string;
  type: string;
  repeated: boolean;
  number: number;
  optional: boolean;
}

export interface GrpcMethod {
  name: string;
  input_type: string;
  output_type: string;
}

export interface GrpcService {
  name: string;
  methods: GrpcMethod[];
}

export interface MessageDetail {
  name: string;
  fields: MessageField[];
}

export interface RegistryResponse {
  proxy_base_url: string;
  available_processes: Array<{
    name: string;
    display_name: string;
    status: string;
    instances: number;
    proxy_path: string;
    repository: string;
    current_ports: number[];
    services?: GrpcService[];
    messages?: Record<string, MessageDetail>;
  }>;
  timestamp: string;
}

/**
 * Fetch gRPC registry from gowinproc
 * Returns services, methods, and message schemas
 * Note: This is a standard HTTP GET endpoint that returns JSON (not gRPC-Web)
 */
export async function fetchGrpcRegistry(clientId: string): Promise<RegistryResponse> {
  const response = await executeTunnelRequest(
    clientId,
    '/api/registry',
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch gRPC registry: ${errorText}`);
  }

  return response.json();
}

/**
 * List available gRPC services using registry endpoint
 */
export async function listGrpcServices(clientId: string): Promise<GrpcService[]> {
  try {
    const registry = await fetchGrpcRegistry(clientId);

    // Return all services from all processes
    const allServices: GrpcService[] = [];
    for (const process of registry.available_processes) {
      if (process.services && process.services.length > 0) {
        allServices.push(...process.services);
      }
    }

    return allServices;
  } catch (error) {
    console.error('Error fetching gRPC services:', error);
    return [];
  }
}

/**
 * Get methods for a specific gRPC service using reflection
 */
export async function listGrpcMethods(
  clientId: string,
  serviceName: string
): Promise<GrpcMethod[]> {
  try {
    const response = await executeTunnelRequest(
      clientId,
      '/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web-text+proto',
        },
        body: JSON.stringify({
          fileContainingSymbol: serviceName,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch gRPC methods');
    }

    await response.json(); // Reserved for future protobuf parsing
    // Parse file descriptor proto to extract methods
    // This is a simplified version - actual implementation would need protobuf parsing
    return [];
  } catch (error) {
    console.error('Error fetching gRPC methods:', error);
    return [];
  }
}

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
 * Execute a gRPC-Web request through the tunnel proxy
 */
export async function executeGrpcWebRequest(
  clientId: string,
  service: string,
  method: string,
  data: any
): Promise<any> {
  const path = `/grpc/${service}/${method}`;

  const response = await executeTunnelRequest(clientId, path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web+json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error);
  }

  return response.json();
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
 */
export async function fetchGrpcRegistry(clientId: string): Promise<RegistryResponse> {
  const response = await executeTunnelRequest(
    clientId,
    '/api/grpc/registry',
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

    // Find the current client in the registry
    const processInfo = registry.available_processes.find(
      p => p.name === clientId || p.name.toLowerCase() === clientId.toLowerCase()
    );

    return processInfo?.services || [];
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

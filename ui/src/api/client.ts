/**
 * API Client for Front-JS Worker
 * Provides methods to interact with the Cloudflare Worker endpoints
 */

import { createTunnelClient } from './grpc-tunnel-client';

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
 * Get tunnel URL for a client ID
 */
async function getTunnelUrl(clientId: string): Promise<string> {
  // Check for local tunnel URLs in environment
  const localTunnelUrls = import.meta.env.VITE_LOCAL_TUNNEL_URLS;
  if (localTunnelUrls) {
    const tunnels = localTunnelUrls.split(',');
    for (const tunnel of tunnels) {
      const [id, url] = tunnel.split('=');
      if (id === clientId) {
        return url;
      }
    }
  }

  // Use Worker proxy URL
  return `${WORKER_URL}/tunnel/${clientId}`;
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
 * Execute a gRPC-Web request using gRPC-Web protocol
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

  const tunnelUrl = await getTunnelUrl(clientId);
  const client = createTunnelClient(tunnelUrl);

  // Invoke method using gRPC-Web
  const response = await client.invokeMethod({
    process: processName,
    service: service,
    method: method,
    data: JSON.stringify(data),
  });

  if (!response.success) {
    throw new Error(response.error || 'gRPC invocation failed');
  }

  return JSON.parse(response.data);
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
 * Fetch gRPC registry from gowinproc using gRPC-Web
 * Returns services, methods, and message schemas
 */
export async function fetchGrpcRegistry(clientId: string): Promise<RegistryResponse> {
  const tunnelUrl = await getTunnelUrl(clientId);
  const client = createTunnelClient(tunnelUrl);

  const response = await client.getRegistry();

  // Convert pb.RegistryResponse to RegistryResponse
  return {
    proxy_base_url: response.proxyBaseUrl,
    available_processes: response.availableProcesses.map(proc => ({
      name: proc.name,
      display_name: proc.displayName,
      status: proc.status,
      instances: proc.instances,
      proxy_path: proc.proxyPath,
      repository: proc.repository,
      current_ports: proc.currentPorts,
      services: proc.services.map(svc => ({
        name: svc.name,
        methods: svc.methods.map(method => ({
          name: method.name,
          input_type: method.inputType,
          output_type: method.outputType,
        })),
      })),
      messages: Object.fromEntries(
        Object.entries(proc.messages).map(([key, msg]) => [
          key,
          {
            name: msg.name,
            fields: msg.fields.map(field => ({
              name: field.name,
              type: field.type,
              repeated: field.repeated,
              number: field.number,
              optional: field.optional,
            })),
          },
        ])
      ),
    })),
    timestamp: response.timestamp,
  };
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

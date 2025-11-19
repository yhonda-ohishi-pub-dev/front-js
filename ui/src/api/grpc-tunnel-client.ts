import { grpc } from '@improbable-eng/grpc-web'
import * as pb from '../proto/tunnel_service'

// Helper to create a message wrapper for @improbable-eng/grpc-web
function createMessageWrapper(data: Uint8Array) {
  return {
    serializeBinary: () => data,
  }
}

// RPC implementation for @improbable-eng/grpc-web
class GrpcWebRpc {
  private host: string

  constructor(host: string) {
    this.host = host
  }

  request(service: string, method: string, data: Uint8Array): Promise<Uint8Array> {
    const methodDesc = this.getMethodDescriptor(service, method)
    const wrappedRequest = createMessageWrapper(data)

    return new Promise((resolve, reject) => {
      grpc.unary(methodDesc, {
        request: wrappedRequest as any,
        host: this.host,
        metadata: new grpc.Metadata(),
        onEnd: (response) => {
          const { status, statusMessage, message } = response
          if (status === grpc.Code.OK && message) {
            const responseData = (message as any).serializeBinary?.() || message
            resolve(responseData as Uint8Array)
          } else {
            reject(new Error(statusMessage || `gRPC error: ${status}`))
          }
        },
      })
    })
  }

  clientStreamingRequest(): Promise<Uint8Array> {
    throw new Error('Client streaming not implemented')
  }

  serverStreamingRequest(): any {
    throw new Error('Server streaming not implemented')
  }

  bidirectionalStreamingRequest(): any {
    throw new Error('Bidirectional streaming not implemented')
  }

  private getMethodDescriptor(service: string, method: string): any {
    return {
      methodName: method,
      service: { serviceName: service },
      requestStream: false,
      responseStream: false,
      requestType: {
        serializeBinary: (msg: any) => msg.serializeBinary(),
        deserializeBinary: (bytes: Uint8Array) => createMessageWrapper(bytes),
      },
      responseType: {
        serializeBinary: (msg: any) => msg.serializeBinary(),
        deserializeBinary: (bytes: Uint8Array) => createMessageWrapper(bytes),
      },
    }
  }
}

// Create gRPC-Web client for a given tunnel URL
export function createTunnelClient(tunnelUrl: string) {
  const rpc = new GrpcWebRpc(tunnelUrl)

  return {
    // Get registry
    getRegistry: async (): Promise<pb.TunnelRegistryResponse> => {
      const request = pb.TunnelRegistryRequest.encode({}).finish()
      const response = await rpc.request('tunnel.TunnelService', 'GetRegistry', request)
      return pb.TunnelRegistryResponse.decode(response)
    },

    // Invoke method
    invokeMethod: async (req: pb.TunnelInvokeRequest): Promise<pb.TunnelInvokeResponse> => {
      const request = pb.TunnelInvokeRequest.encode(req).finish()
      const response = await rpc.request('tunnel.TunnelService', 'InvokeMethod', request)
      return pb.TunnelInvokeResponse.decode(response)
    },
  }
}

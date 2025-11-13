/**
 * Cloudflare Worker for Tunnel URL Management
 *
 * This worker fetches tunnel URLs from ohishi-auth.mtamaramu.com
 * and provides direct connection capabilities.
 */

interface TunnelData {
	clientId: string;
	tunnelUrl: string;
	updatedAt: number;
	createdAt: number;
}

interface TunnelResponse {
	success: boolean;
	data: TunnelData[];
	count: number;
}

export default {
	async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		console.log('Request:', request.method, url.pathname);

		// CORS headers for browser access
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, x-grpc-web, x-user-agent, Authorization',
			'Access-Control-Expose-Headers': 'grpc-status, grpc-message',
		};

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: corsHeaders,
			});
		}

		// Route: GET /tunnels - Fetch tunnel URLs
		if (url.pathname === '/tunnels' && request.method === 'GET') {
			try {
				// Fetch from ohishi-auth.mtamaramu.com
				const authUrl = 'https://ohishi-auth.mtamaramu.com/tunnels';

				// Direct fetch (Service Binding not connected in local dev)
				const response = await fetch(authUrl, {
					method: 'GET',
					headers: request.headers,
				});

				if (!response.ok) {
					return new Response(
						JSON.stringify({
							error: 'Failed to fetch tunnels',
							status: response.status,
							statusText: response.statusText
						}),
						{
							status: response.status,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders,
							},
						}
					);
				}

				const apiResponse: TunnelResponse = await response.json();

				// Hide tunnel URLs from public response for security
				const sanitizedData = {
					success: apiResponse.success,
					data: apiResponse.data.map(tunnel => ({
						clientId: tunnel.clientId,
						updatedAt: tunnel.updatedAt,
						createdAt: tunnel.createdAt,
						// tunnelUrl is intentionally omitted for security
					})),
					count: apiResponse.count,
				};

				return new Response(JSON.stringify(sanitizedData), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'public, max-age=60',
						...corsHeaders,
					},
				});

			} catch (error) {
				return new Response(
					JSON.stringify({
						error: 'Internal server error',
						message: error instanceof Error ? error.message : 'Unknown error'
					}),
					{
						status: 500,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders,
						},
					}
				);
			}
		}

		// Route: /tunnel/:id/api/registry - gowinproc registry endpoint (GET only, returns JSON)
		const registryMatch = url.pathname.match(/^\/tunnel\/([^\/]+)\/api\/registry$/);
		console.log('registryMatch:', registryMatch, 'method:', request.method);
		if (registryMatch && request.method === 'GET') {
			console.log('Registry route matched! tunnelId:', registryMatch[1]);
			const tunnelId = registryMatch[1];

			try {
				// Check if client ID is allowed
				if (env.ALLOWED_CLIENT_IDS) {
					const allowedIds = env.ALLOWED_CLIENT_IDS.split(',').map((id: string) => id.trim());
					if (!allowedIds.includes(tunnelId)) {
						return new Response(
							JSON.stringify({
								error: 'Forbidden',
								message: 'このクライアントIDへのアクセスは許可されていません。'
							}),
							{
								status: 403,
								headers: {
									'Content-Type': 'application/json',
									...corsHeaders,
								},
							}
						);
					}
				}

				// Get tunnel URL
				const authUrl = 'https://ohishi-auth.mtamaramu.com/tunnels';
				const response = await fetch(authUrl, {
					method: 'GET',
					headers: request.headers,
				});

				if (!response.ok) {
					return new Response(
						JSON.stringify({ error: 'Failed to fetch tunnels' }),
						{
							status: response.status,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders,
							},
						}
					);
				}

				const apiResponse: TunnelResponse = await response.json();
				const tunnel = apiResponse.data.find((t: TunnelData) => t.clientId === tunnelId);

				if (!tunnel) {
					return new Response(
						JSON.stringify({ error: 'Tunnel not found' }),
						{
							status: 404,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders,
							},
						}
					);
				}

				// Access registry endpoint (GET, returns JSON)
				// Check for local development override
				let baseUrl = tunnel.tunnelUrl;
				if (env.LOCAL_TUNNEL_URLS) {
					const overrides = env.LOCAL_TUNNEL_URLS.split(',');
					for (const override of overrides) {
						const [id, url] = override.split('=');
						if (id.trim() === tunnelId) {
							baseUrl = url.trim();
							console.log(`Using local override for ${tunnelId}:`, baseUrl);
							break;
						}
					}
				}

				const targetUrl = new URL(baseUrl);
				targetUrl.pathname = '/api/registry';

				console.log('Fetching from:', targetUrl.toString());

				const tunnelResponse = await fetch(targetUrl.toString(), {
					method: 'GET',
					headers: {
						'Accept': 'application/json',
					},
				});

				console.log('Backend response status:', tunnelResponse.status, tunnelResponse.statusText);

				// Return response with CORS headers
				const responseBody = await tunnelResponse.text();
				return new Response(responseBody, {
					status: tunnelResponse.status,
					statusText: tunnelResponse.statusText,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json',
					},
				});

			} catch (error) {
				return new Response(
					JSON.stringify({
						error: 'Failed to connect to registry',
						message: error instanceof Error ? error.message : 'Unknown error'
					}),
					{
						status: 500,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders,
						},
					}
				);
			}
		}

		// Route: POST /tunnel/:id/api/invoke - Special handling for gowinproc gRPC invoke
		const invokeMatch = url.pathname.match(/^\/tunnel\/([^\/]+)\/api\/invoke$/);
		if (invokeMatch && request.method === 'POST') {
			const tunnelId = invokeMatch[1];

			try {
				// Check if client ID is allowed
				if (env.ALLOWED_CLIENT_IDS) {
					const allowedIds = env.ALLOWED_CLIENT_IDS.split(',').map((id: string) => id.trim());
					if (!allowedIds.includes(tunnelId)) {
						return new Response(
							JSON.stringify({
								error: 'Forbidden',
								message: 'このクライアントIDへのアクセスは許可されていません。'
							}),
							{
								status: 403,
								headers: {
									'Content-Type': 'application/json',
									...corsHeaders,
								},
							}
						);
					}
				}

				// Get tunnel URL
				const authUrl = 'https://ohishi-auth.mtamaramu.com/tunnels';
				const response = await fetch(authUrl, {
					method: 'GET',
					headers: request.headers,
				});

				if (!response.ok) {
					return new Response(
						JSON.stringify({ error: 'Failed to fetch tunnels' }),
						{
							status: response.status,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders,
							},
						}
					);
				}

				const apiResponse: TunnelResponse = await response.json();
				const tunnel = apiResponse.data.find((t: TunnelData) => t.clientId === tunnelId);

				if (!tunnel) {
					return new Response(
						JSON.stringify({ error: 'Tunnel not found' }),
						{
							status: 404,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders,
							},
						}
					);
				}

				// Access invoke endpoint
				const targetUrl = new URL(tunnel.tunnelUrl);
				targetUrl.pathname = '/api/invoke';

				// Forward original Content-Type for gRPC-Web compatibility
				const forwardHeaders: HeadersInit = {};
				const contentType = request.headers.get('Content-Type');
				if (contentType) {
					forwardHeaders['Content-Type'] = contentType;
				}

				const tunnelResponse = await fetch(targetUrl.toString(), {
					method: 'POST',
					headers: forwardHeaders,
					body: request.body,
				});

				// Return response with CORS headers
				const responseBody = await tunnelResponse.text();
				return new Response(responseBody, {
					status: tunnelResponse.status,
					statusText: tunnelResponse.statusText,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json',
					},
				});

			} catch (error) {
				return new Response(
					JSON.stringify({
						error: 'Failed to connect to invoke endpoint',
						message: error instanceof Error ? error.message : 'Unknown error'
					}),
					{
						status: 500,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders,
						},
					}
				);
			}
		}

		// Route: /tunnel/:id/* - Connect to specific tunnel and proxy all paths
		// Exclude /api/grpc/* paths as they are handled by specific routes above
		const tunnelMatch = url.pathname.match(/^\/tunnel\/([^\/]+)(\/.*)?$/);
		if (tunnelMatch) {
			const tunnelId = tunnelMatch[1];
			const remainingPath = tunnelMatch[2] || ''; // Path after /tunnel/:id

			// Skip if this is a gRPC API path (handled by specific routes above)
			if (remainingPath.startsWith('/api/grpc/')) {
				// This should have been handled by the specific routes above
				// If we reach here, the method might not be allowed
				return new Response(
					JSON.stringify({
						error: 'Method Not Allowed',
						message: 'This gRPC endpoint does not support the requested method'
					}),
					{
						status: 405,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders,
						},
					}
				);
			}

			try {
				// Check if client ID is allowed
				if (env.ALLOWED_CLIENT_IDS) {
					const allowedIds = env.ALLOWED_CLIENT_IDS.split(',').map((id: string) => id.trim());
					if (!allowedIds.includes(tunnelId)) {
						return new Response(
							JSON.stringify({
								error: 'Forbidden',
								message: 'このクライアントIDへのアクセスは許可されていません。'
							}),
							{
								status: 403,
								headers: {
									'Content-Type': 'application/json',
									...corsHeaders,
								},
							}
						);
					}
				}
				// First, get the list of tunnels
				const authUrl = 'https://ohishi-auth.mtamaramu.com/tunnels';

				// Direct fetch (Service Binding not connected in local dev)
				const response = await fetch(authUrl, {
					method: 'GET',
					headers: request.headers,
				});

				if (!response.ok) {
					return new Response(
						JSON.stringify({ error: 'Failed to fetch tunnels' }),
						{
							status: response.status,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders,
							},
						}
					);
				}

				const apiResponse: TunnelResponse = await response.json();
				const tunnel = apiResponse.data.find((t: TunnelData) => t.clientId === tunnelId);

				if (!tunnel) {
					return new Response(
						JSON.stringify({ error: 'Tunnel not found' }),
						{
							status: 404,
							headers: {
								'Content-Type': 'application/json',
								...corsHeaders,
							},
						}
					);
				}

				// Proxy request to the tunnel URL with remaining path
				const targetUrl = new URL(tunnel.tunnelUrl);
				targetUrl.pathname = remainingPath;
				targetUrl.search = url.search; // Preserve query parameters

				const tunnelResponse = await fetch(targetUrl.toString(), {
					method: request.method,
					headers: request.headers,
					body: request.body,
				});

				return new Response(tunnelResponse.body, {
					status: tunnelResponse.status,
					statusText: tunnelResponse.statusText,
					headers: tunnelResponse.headers,
				});

			} catch (error) {
				return new Response(
					JSON.stringify({
						error: 'Failed to connect to tunnel',
						message: error instanceof Error ? error.message : 'Unknown error'
					}),
					{
						status: 500,
						headers: {
							'Content-Type': 'application/json',
							...corsHeaders,
						},
					}
				);
			}
		}

		// Default route
		// Serve static assets (UI) for all other requests
		// This includes root path (/), /assets/*, etc.
		if (env.ASSETS) {
			try {
				// Try to serve the requested path from static assets
				return await env.ASSETS.fetch(request);
			} catch (error) {
				console.error('Error serving static asset:', error);
			}
		}

		// Fallback: Root information (if no ASSETS binding or error)
		return new Response(
			JSON.stringify({
				message: 'Tunnel URL Service',
				version: '1.0.0',
				endpoints: {
					'GET /tunnels': 'トンネルリストを取得（トンネルURLは非表示）',
					'ALL /tunnel/:clientId/*': '指定されたトンネルにプロキシ接続（全てのHTTPメソッド、パス、クエリパラメータをサポート）'
				},
				examples: [
					'GET /tunnels',
					'GET /tunnel/gowinproc',
					'POST /tunnel/gowinproc/api/some-endpoint',
					'GET /tunnel/testclient/path/to/resource?query=value'
				],
				security: {
					note: 'トンネルURLは外部に公開されません。Auth Workerで管理されています。'
				}
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders,
				},
			}
		);
	},
} satisfies ExportedHandler<Env>;

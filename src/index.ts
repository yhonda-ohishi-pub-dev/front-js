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

		// CORS headers for browser access
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
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

				let response: Response;

				// Use Service Binding if available
				if (env.AUTH_SERVICE) {
					response = await env.AUTH_SERVICE.fetch(new Request(authUrl, {
						method: 'GET',
						headers: request.headers,
					}));
				} else {
					// Fallback to direct fetch
					response = await fetch(authUrl, {
						method: 'GET',
						headers: request.headers,
					});
				}

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

		// Route: /tunnel/:id/* - Connect to specific tunnel and proxy all paths
		const tunnelMatch = url.pathname.match(/^\/tunnel\/([^\/]+)(\/.*)?$/);
		if (tunnelMatch) {
			const tunnelId = tunnelMatch[1];
			const remainingPath = tunnelMatch[2] || ''; // Path after /tunnel/:id

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

				let response: Response;
				if (env.AUTH_SERVICE) {
					response = await env.AUTH_SERVICE.fetch(new Request(authUrl, {
						method: 'GET',
						headers: request.headers,
					}));
				} else {
					response = await fetch(authUrl, {
						method: 'GET',
						headers: request.headers,
					});
				}

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

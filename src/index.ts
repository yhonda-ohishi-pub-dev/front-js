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

				const data: TunnelResponse = await response.json();

				return new Response(JSON.stringify(data), {
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

		// Route: GET /tunnel/:id - Connect to specific tunnel
		const tunnelMatch = url.pathname.match(/^\/tunnel\/([^\/]+)$/);
		if (tunnelMatch && request.method === 'GET') {
			const tunnelId = tunnelMatch[1];

			try {
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

				// Proxy request to the tunnel URL
				const tunnelResponse = await fetch(tunnel.tunnelUrl, {
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
				endpoints: {
					'/tunnels': 'GET - List all available tunnels',
					'/tunnel/:id': 'GET - Connect to a specific tunnel by ID'
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

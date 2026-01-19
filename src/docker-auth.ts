/**
 * Docker Registry 认证服务
 * 实现 Docker Registry v2 Token Authentication
 */

export interface DockerAuthRequest {
	service?: string;
	scope?: string;
	account?: string;
}

export interface DockerToken {
	token: string;
	access_token: string;
	expires_in: number;
	issued_at: string;
}

/**
 * 处理 Docker Registry Token 认证
 */
export async function handleDockerRegistryAuth(
	request: Request,
	env: any
): Promise<Response> {
	const url = new URL(request.url);

	// 从 Basic Auth 获取 appId 和 apiKey
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Basic ')) {
		return new Response(
			JSON.stringify({ error: 'Missing credentials' }),
			{
				status: 401,
				headers: {
					'Content-Type': 'application/json',
					'WWW-Authenticate': 'Basic realm="Docker Registry"',
				},
			}
		);
	}

	// 解码 Basic Auth
	const base64Credentials = authHeader.replace('Basic ', '');
	const credentials = atob(base64Credentials);
	const [appId, apiKey] = credentials.split(':');

	if (!appId || !apiKey) {
		return new Response(
			JSON.stringify({ error: 'Invalid credentials format' }),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	// 验证 appId 和 apiKey
	const isValid = await validateDockerCredentials(env, appId, apiKey);
	if (!isValid) {
		return new Response(
			JSON.stringify({ error: 'Invalid credentials' }),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	// 获取请求参数
	const service = url.searchParams.get('service') || 'registry.docker.io';
	const scope = url.searchParams.get('scope') || '';

	// 生成 token
	const token = await generateDockerToken(appId, service, scope);

	const tokenResponse: DockerToken = {
		token: token,
		access_token: token,
		expires_in: 3600, // 1 小时
		issued_at: new Date().toISOString(),
	};

	return new Response(JSON.stringify(tokenResponse), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}

/**
 * 验证 Docker 凭证（appId 和 apiKey）
 */
async function validateDockerCredentials(
	env: any,
	appId: string,
	apiKey: string
): Promise<boolean> {
	try {
		// 从 KV 获取 API Key 数据
		const dataStr = await env.API_KEYS.get(appId);
		if (!dataStr) {
			return false;
		}

		const data = JSON.parse(dataStr);

		// 验证 apiKey
		if (data.apiKey !== apiKey) {
			return false;
		}

		// 更新使用次数
		data.usageCount = (data.usageCount || 0) + 1;
		data.lastUsedAt = new Date().toISOString();
		await env.API_KEYS.put(appId, JSON.stringify(data));

		return true;
	} catch (error) {
		console.error('Validate credentials error:', error);
		return false;
	}
}

/**
 * 生成 Docker Token (简化版 JWT)
 */
async function generateDockerToken(
	appId: string,
	service: string,
	scope: string
): Promise<string> {
	const payload = {
		sub: appId,
		iss: 'geo.hns.cool',
		aud: service,
		scope: scope,
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 3600, // 1 小时后过期
	};

	// 简单编码（生产环境应该使用真正的 JWT 签名）
	const token = btoa(JSON.stringify(payload));
	return token;
}

/**
 * 验证 Docker Token
 */
export async function verifyDockerToken(token: string): Promise<boolean> {
	try {
		// 解码 token
		const payload = JSON.parse(atob(token));

		// 检查过期时间
		const now = Math.floor(Date.now() / 1000);
		if (payload.exp && payload.exp < now) {
			return false;
		}

		// 检查签发者
		if (payload.iss !== 'geo.hns.cool') {
			return false;
		}

		return true;
	} catch (error) {
		console.error('Verify token error:', error);
		return false;
	}
}

/**
 * 从请求中提取 Token
 */
export function extractTokenFromRequest(request: Request): string | null {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) {
		return null;
	}

	// Bearer Token
	if (authHeader.startsWith('Bearer ')) {
		return authHeader.replace('Bearer ', '');
	}

	return null;
}

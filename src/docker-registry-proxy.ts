/**
 * Docker Registry 代理功能
 * 代理 Docker Hub 请求，加速国内访问
 */

export interface DockerProxyConfig {
	// 上游 Docker Registry 地址
	upstreamRegistry: string;
	// 缓存时间（秒）
	cacheTTL: number;
	// 是否启用缓存
	enableCache: boolean;
}

const defaultConfig: DockerProxyConfig = {
	upstreamRegistry: 'https://registry-1.docker.io',
	cacheTTL: 3600, // 1 小时
	enableCache: true,
};

/**
 * 处理 Docker Registry 请求
 */
export async function handleDockerRegistryProxy(
	request: Request,
	config: Partial<DockerProxyConfig> = {}
): Promise<Response> {
	const mergedConfig = { ...defaultConfig, ...config };
	const url = new URL(request.url);

	// 提取 Docker Registry 路径
	// 例如: /v2/library/nginx/manifests/latest
	const registryPath = url.pathname.replace(/^\/docker-proxy/, '');

	// 如果没有路径，返回帮助信息
	if (!registryPath || registryPath === '/') {
		return new Response(
			JSON.stringify({
				message: 'Docker Registry Proxy',
				usage: {
					pull: 'docker pull your-domain.com/docker-proxy/library/nginx:latest',
					example: 'docker pull your-domain.com/docker-proxy/library/ubuntu:22.04',
				},
				upstream: mergedConfig.upstreamRegistry,
			}),
			{
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	// 构建上游 URL
	const upstreamUrl = new URL(registryPath + url.search, mergedConfig.upstreamRegistry);

	// 检查缓存
	const cacheKey = new Request(upstreamUrl.toString(), request);
	const cache = caches.default;

	if (mergedConfig.enableCache) {
		const cachedResponse = await cache.match(cacheKey);
		if (cachedResponse) {
			return new Response(cachedResponse.body, {
				status: cachedResponse.status,
				statusText: cachedResponse.statusText,
				headers: {
					...Object.fromEntries(cachedResponse.headers),
					'X-Cache': 'HIT',
				},
			});
		}
	}

	// 转发请求到上游 Registry
	const proxyRequest = new Request(upstreamUrl.toString(), {
		method: request.method,
		headers: prepareUpstreamHeaders(request.headers),
		body: request.body,
	});

	try {
		const response = await fetch(proxyRequest);

		// 准备响应头
		const responseHeaders = new Headers(response.headers);
		responseHeaders.set('X-Cache', 'MISS');
		responseHeaders.set('X-Proxy-By', 'Cloudflare Workers');

		// 创建响应
		const proxyResponse = new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
		});

		// 缓存成功的响应
		if (
			mergedConfig.enableCache &&
			response.ok &&
			shouldCacheResponse(registryPath, response)
		) {
			const cacheResponse = proxyResponse.clone();
			const cacheHeaders = new Headers(cacheResponse.headers);
			cacheHeaders.set('Cache-Control', `public, max-age=${mergedConfig.cacheTTL}`);

			const responseToCahce = new Response(cacheResponse.body, {
				status: cacheResponse.status,
				statusText: cacheResponse.statusText,
				headers: cacheHeaders,
			});

			// 异步缓存，不阻塞响应
			await cache.put(cacheKey, responseToCahce);
		}

		return proxyResponse;
	} catch (error) {
		console.error('Docker Registry Proxy Error:', error);
		return new Response(
			JSON.stringify({
				error: 'Failed to fetch from upstream registry',
				message: error instanceof Error ? error.message : 'Unknown error',
			}),
			{
				status: 502,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
}

/**
 * 准备上游请求头
 */
function prepareUpstreamHeaders(headers: Headers): Headers {
	const upstreamHeaders = new Headers(headers);

	// 移除可能导致问题的头
	upstreamHeaders.delete('cf-connecting-ip');
	upstreamHeaders.delete('cf-ray');
	upstreamHeaders.delete('cf-visitor');

	// 设置必要的 Docker Registry 头
	if (!upstreamHeaders.has('Accept')) {
		upstreamHeaders.set('Accept', 'application/vnd.docker.distribution.manifest.v2+json');
	}

	return upstreamHeaders;
}

/**
 * 判断是否应该缓存响应
 */
function shouldCacheResponse(path: string, response: Response): boolean {
	// 只缓存 GET 请求
	if (response.status !== 200) {
		return false;
	}

	// 缓存 manifests 和 blobs
	if (path.includes('/manifests/') || path.includes('/blobs/')) {
		return true;
	}

	return false;
}

/**
 * 处理 Docker Hub 特定的认证
 */
export async function handleDockerHubAuth(request: Request): Promise<Response> {
	const authUrl = 'https://auth.docker.io/token';
	const url = new URL(request.url);

	// 转发认证请求
	const authRequest = new Request(
		authUrl + url.search,
		{
			method: request.method,
			headers: request.headers,
		}
	);

	try {
		const response = await fetch(authRequest);
		return new Response(response.body, {
			status: response.status,
			headers: response.headers,
		});
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'Authentication failed' }),
			{
				status: 502,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}
}

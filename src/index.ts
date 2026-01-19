/**
 * 地理位置感知的动态 SDK Worker
 * 根据用户所在地区返回不同的 SDK 内容
 */

import { handleDockerRegistryProxy } from './docker-registry-proxy';
import { handleDockerRegistryAuth } from './docker-auth';

interface Env {
	API_KEYS: KVNamespace;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	GITHUB_REDIRECT_URI: string;
	SESSION_SECRET: string;
}

interface SessionData {
	userId: string;
	githubId: number;
	githubLogin: string;
	githubAvatar: string;
	githubEmail?: string;
	githubName?: string;
	createdAt: string;
}

interface GitHubUser {
	id: number;
	login: string;
	avatar_url: string;
	email?: string;
	name?: string;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const country = request.cf?.country || 'UNKNOWN';

		// 设置 CORS 头
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// 处理 OPTIONS 请求
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// 路由处理
		// Docker Registry 认证
		if (url.pathname.startsWith('/docker-auth/token')) {
			return handleDockerRegistryAuth(request, env);
		}
		// Docker Registry 代理
		else if (url.pathname.startsWith('/docker-proxy')) {
			return handleDockerRegistryProxy(request, {
				enableCache: true,
				cacheTTL: 3600,
				requireAuth: true, // 需要认证
			});
		} else if (url.pathname === '/sdk.js') {
			return handleSDK(country, corsHeaders);
		} else if (url.pathname === '/api/geo') {
			return handleGeoInfo(request, corsHeaders);
		} else if (url.pathname === '/api/geo-query') {
			return handleGeoQuery(request, corsHeaders);
		} else if (url.pathname === '/auth/github') {
			return handleGitHubLogin(env);
		} else if (url.pathname === '/auth/github/callback') {
			return handleGitHubCallback(request, env);
		} else if (url.pathname === '/auth/logout') {
			return handleLogout(corsHeaders);
		} else if (url.pathname === '/api/user') {
			return handleGetUser(request, env, corsHeaders);
		} else if (url.pathname === '/api/register') {
			return handleRegister(request, env, country, corsHeaders);
		} else if (url.pathname === '/api/validate') {
			return handleValidate(request, env, corsHeaders);
		} else if (url.pathname === '/api/stats') {
			return handleStats(env, corsHeaders);
		}

		// 其他路径返回 404（静态资源由 assets 处理）
		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * 处理 SDK 请求
 */
function handleSDK(country: string, corsHeaders: Record<string, string>): Response {
	const isChinaMainland = country === 'CN';
	const sdkCode = generateSDK(isChinaMainland, country);

	return new Response(sdkCode, {
		headers: {
			...corsHeaders,
			'Content-Type': 'application/javascript; charset=utf-8',
			'Cache-Control': 'public, max-age=300',
			'X-Country': country,
		},
	});
}

/**
 * 处理地理位置信息请求
 */
function handleGeoInfo(request: Request, corsHeaders: Record<string, string>): Response {
	const cf = request.cf;

	// 获取客户端 IP 地址
	const ip = request.headers.get('CF-Connecting-IP') ||
	           request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
	           request.headers.get('X-Real-IP') ||
	           'Unknown';

	const geoInfo = {
		// IP 地址信息
		ip: ip,
		ipVersion: ip.includes(':') ? 'IPv6' : 'IPv4',

		// 基本位置信息
		country: cf?.country || 'UNKNOWN',
		countryName: getCountryName(cf?.country as string || 'UNKNOWN'),
		city: cf?.city || 'Unknown',
		region: cf?.region || 'Unknown',
		regionCode: cf?.regionCode || 'Unknown',
		postalCode: cf?.postalCode || 'Unknown',

		// 坐标信息
		latitude: cf?.latitude || 'Unknown',
		longitude: cf?.longitude || 'Unknown',

		// 时区
		timezone: cf?.timezone || 'Unknown',

		// 网络信息
		colo: cf?.colo || 'Unknown', // Cloudflare 数据中心代码
		asn: cf?.asn || 'Unknown', // 自治系统编号
		asOrganization: cf?.asOrganization || 'Unknown',

		// 其他信息
		continent: cf?.continent || 'Unknown',
		metroCode: cf?.metroCode || 'Unknown',

		// 请求时间
		timestamp: new Date().toISOString(),
	};

	return new Response(JSON.stringify(geoInfo, null, 2), {
		headers: {
			...corsHeaders,
			'Content-Type': 'application/json; charset=utf-8',
		},
	});
}

/**
 * 处理IP地址查询请求
 */
async function handleGeoQuery(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
	const url = new URL(request.url);
	const ipParam = url.searchParams.get('ip');

	if (!ipParam) {
		return new Response(
			JSON.stringify({ error: '缺少IP地址参数，请使用 ?ip=xxx.xxx.xxx.xxx' }),
			{
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
			}
		);
	}

	// 验证IP地址格式（简单验证）
	const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
	const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

	if (!ipv4Regex.test(ipParam) && !ipv6Regex.test(ipParam)) {
		return new Response(
			JSON.stringify({ error: 'IP地址格式不正确' }),
			{
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
			}
		);
	}

	try {
		// 使用 ip-api.com 查询IP地理位置（免费API）
		const apiUrl = `http://ip-api.com/json/${ipParam}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;
		const response = await fetch(apiUrl);
		const data = await response.json() as any;

		if (data.status === 'fail') {
			return new Response(
				JSON.stringify({ error: data.message || 'IP地址查询失败' }),
				{
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
				}
			);
		}

		// 格式化响应数据
		const geoInfo = {
			// IP 地址信息
			ip: data.query || ipParam,
			ipVersion: ipParam.includes(':') ? 'IPv6' : 'IPv4',

			// 基本位置信息
			country: data.countryCode || 'UNKNOWN',
			countryName: data.country || 'Unknown',
			city: data.city || 'Unknown',
			region: data.regionName || 'Unknown',
			regionCode: data.region || 'Unknown',
			postalCode: data.zip || 'Unknown',

			// 坐标信息
			latitude: data.lat?.toString() || 'Unknown',
			longitude: data.lon?.toString() || 'Unknown',

			// 时区
			timezone: data.timezone || 'Unknown',

			// 网络信息
			asn: data.as?.split(' ')[0]?.replace('AS', '') || 'Unknown',
			asOrganization: data.isp || data.org || 'Unknown',
			isp: data.isp || 'Unknown',
			org: data.org || 'Unknown',

			// 其他信息
			continent: data.continentCode || 'Unknown',
			continentName: data.continent || 'Unknown',

			// 请求时间
			timestamp: new Date().toISOString(),
		};

		return new Response(JSON.stringify(geoInfo, null, 2), {
			headers: {
				...corsHeaders,
				'Content-Type': 'application/json; charset=utf-8',
			},
		});
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'IP地址查询失败，请稍后重试' }),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
			}
		);
	}
}

/**
 * 获取国家中文名称
 */
function getCountryName(code: string): string {
	const countryNames: Record<string, string> = {
		'CN': '中国',
		'US': '美国',
		'JP': '日本',
		'KR': '韩国',
		'GB': '英国',
		'FR': '法国',
		'DE': '德国',
		'CA': '加拿大',
		'AU': '澳大利亚',
		'SG': '新加坡',
		'HK': '香港',
		'TW': '台湾',
		'UNKNOWN': '未知',
	};
	return countryNames[code] || code;
}

/**
 * 处理 API Key 申请（需要登录）
 */
async function handleRegister(
	request: Request,
	env: Env,
	country: string,
	corsHeaders: Record<string, string>
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	// 验证用户是否已登录
	const session = await getSessionFromRequest(request, env);
	if (!session) {
		return new Response(
			JSON.stringify({ error: '请先使用 GitHub 登录' }),
			{
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	}

	try {
		const body = await request.json() as { appName?: string; email?: string };
		const appName = body.appName || 'Unnamed App';
		const email = body.email || session.githubEmail || '';

		// 生成唯一的 App ID 和 API Key
		const appId = generateAppId();
		const apiKey = generateApiKey();

		// 存储到 KV，关联 GitHub 用户
		const apiKeyData = {
			appId,
			apiKey,
			appName,
			email,
			country,
			githubId: session.githubId,
			githubLogin: session.githubLogin,
			createdAt: new Date().toISOString(),
			usageCount: 0,
		};

		await env.API_KEYS.put(appId, JSON.stringify(apiKeyData));
		await env.API_KEYS.put(`key_${apiKey}`, appId); // 反向索引

		// 记录用户的 API Keys
		const userKeysKey = `user_keys_${session.userId}`;
		const userKeysStr = await env.API_KEYS.get(userKeysKey);
		const userKeys = userKeysStr ? JSON.parse(userKeysStr) : [];
		userKeys.push(appId);
		await env.API_KEYS.put(userKeysKey, JSON.stringify(userKeys));

		return new Response(
			JSON.stringify({
				success: true,
				appId,
				apiKey,
				message: 'API Key 创建成功',
				user: {
					login: session.githubLogin,
					id: session.githubId,
				},
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'Invalid request body' }),
			{
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	}
}

/**
 * 验证 API Key
 */
async function handleValidate(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json() as { appId?: string; apiKey?: string };
		const { appId, apiKey } = body;

		if (!appId || !apiKey) {
			return new Response(
				JSON.stringify({ valid: false, error: 'Missing appId or apiKey' }),
				{
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				}
			);
		}

		// 从 KV 获取数据
		const dataStr = await env.API_KEYS.get(appId);
		if (!dataStr) {
			return new Response(
				JSON.stringify({ valid: false, error: 'Invalid appId' }),
				{
					status: 401,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				}
			);
		}

		const data = JSON.parse(dataStr);
		if (data.apiKey !== apiKey) {
			return new Response(
				JSON.stringify({ valid: false, error: 'Invalid apiKey' }),
				{
					status: 401,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				}
			);
		}

		// 更新使用次数
		data.usageCount = (data.usageCount || 0) + 1;
		data.lastUsedAt = new Date().toISOString();
		await env.API_KEYS.put(appId, JSON.stringify(data));

		return new Response(
			JSON.stringify({ valid: true, appName: data.appName, usageCount: data.usageCount }),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'Invalid request body' }),
			{
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	}
}

/**
 * 获取统计信息
 */
async function handleStats(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
	try {
		const keys = await env.API_KEYS.list({ prefix: 'app_' });
		const totalApps = keys.keys.length;

		return new Response(
			JSON.stringify({
				totalRegistrations: totalApps,
				timestamp: new Date().toISOString(),
			}),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'Failed to fetch stats' }),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	}
}

/**
 * 生成 App ID
 */
function generateAppId(): string {
	return 'app_' + generateRandomString(24);
}

/**
 * 生成 API Key
 */
function generateApiKey(): string {
	return 'sk_' + generateRandomString(32);
}

/**
 * 生成随机字符串
 */
function generateRandomString(length: number): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	const randomValues = new Uint8Array(length);
	crypto.getRandomValues(randomValues);
	for (let i = 0; i < length; i++) {
		result += chars[randomValues[i] % chars.length];
	}
	return result;
}

/**
 * 生成动态 SDK 代码
 */
function generateSDK(isChinaMainland: boolean, country: string): string {
	if (isChinaMainland) {
		// 境内用户返回拒绝访问的 SDK
		return `
(function() {
  'use strict';

  // SDK 版本
  const SDK_VERSION = '1.0.0';
  const USER_COUNTRY = '${country}';
  const API_BASE_URL = window.location.origin;

  // 境内用户提示
  console.warn('[SDK] 检测到您来自中国境内，应用暂时拒绝访问');

  // 创建全局 SDK 对象
  window.MySDK = {
    version: SDK_VERSION,
    country: USER_COUNTRY,
    available: false,
    message: '应用暂时拒绝访问',

    init: function(config) {
      console.error('[SDK] 应用暂不支持中国境内访问');
      return {
        success: false,
        error: '应用暂时拒绝访问',
        country: USER_COUNTRY
      };
    },

    // 所有方法都返回不可用状态
    call: function() {
      throw new Error('SDK 不可用：应用暂时拒绝访问');
    }
  };

  console.info('[SDK] v' + SDK_VERSION + ' 已加载（受限模式）');
})();
`.trim();
	} else {
		// 境外用户返回正常的 SDK
		return `
(function() {
  'use strict';

  // SDK 版本
  const SDK_VERSION = '1.0.0';
  const USER_COUNTRY = '${country}';
  const API_BASE_URL = window.location.origin;

  console.info('[SDK] 欢迎使用，您的位置：' + USER_COUNTRY);

  // 创建全局 SDK 对象
  window.MySDK = {
    version: SDK_VERSION,
    country: USER_COUNTRY,
    available: true,
    config: null,

    // 初始化方法
    init: function(config) {
      console.log('[SDK] 正在初始化...', config);
      this.config = config || {};

      // 验证 API Key（可选）
      if (config.appId && config.apiKey) {
        return this.validateCredentials(config.appId, config.apiKey);
      }

      return Promise.resolve({
        success: true,
        country: USER_COUNTRY,
        message: '初始化成功（未验证 API Key）'
      });
    },

    // 验证凭证
    validateCredentials: function(appId, apiKey) {
      return fetch(API_BASE_URL + '/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appId: appId, apiKey: apiKey })
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.valid) {
          console.log('[SDK] API Key 验证成功');
          return {
            success: true,
            country: USER_COUNTRY,
            appName: data.appName,
            usageCount: data.usageCount
          };
        } else {
          console.error('[SDK] API Key 验证失败:', data.error);
          return {
            success: false,
            error: data.error
          };
        }
      })
      .catch(function(error) {
        console.error('[SDK] 验证请求失败:', error);
        return {
          success: false,
          error: '网络请求失败'
        };
      });
    },

    // API 调用方法
    call: function(endpoint, data) {
      console.log('[SDK] 调用 API:', endpoint, data);

      var headers = {
        'Content-Type': 'application/json',
        'X-SDK-Version': SDK_VERSION,
        'X-Country': USER_COUNTRY
      };

      // 添加认证头
      if (this.config && this.config.appId && this.config.apiKey) {
        headers['X-App-ID'] = this.config.appId;
        headers['X-API-Key'] = this.config.apiKey;
      }

      return fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      }).then(function(response) {
        return response.json();
      });
    },

    // 获取用户信息
    getUserInfo: function() {
      return {
        country: USER_COUNTRY,
        timestamp: new Date().toISOString(),
        version: SDK_VERSION
      };
    },

    // 注册新的 API Key
    register: function(appName, email) {
      return fetch(API_BASE_URL + '/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appName: appName, email: email })
      })
      .then(function(response) {
        return response.json();
      });
    }
  };

  console.info('[SDK] v' + SDK_VERSION + ' 已成功加载');
})();
`.trim();
	}
}

/**
 * ==================== GitHub OAuth 和会话管理 ====================
 */

/**
 * 生成会话 Token
 */
function generateSessionToken(): string {
	return 'sess_' + generateRandomString(48);
}

/**
 * 创建会话
 */
async function createSession(env: Env, githubUser: GitHubUser): Promise<string> {
	const sessionToken = generateSessionToken();
	const userId = `user_github_${githubUser.id}`;

	const sessionData: SessionData = {
		userId,
		githubId: githubUser.id,
		githubLogin: githubUser.login,
		githubAvatar: githubUser.avatar_url,
		githubEmail: githubUser.email,
		githubName: githubUser.name,
		createdAt: new Date().toISOString(),
	};

	// 会话有效期 30 天
	await env.API_KEYS.put(`session_${sessionToken}`, JSON.stringify(sessionData), {
		expirationTtl: 30 * 24 * 60 * 60,
	});

	// 存储用户信息
	await env.API_KEYS.put(userId, JSON.stringify({
		githubId: githubUser.id,
		login: githubUser.login,
		avatar: githubUser.avatar_url,
		email: githubUser.email,
		name: githubUser.name,
		lastLoginAt: new Date().toISOString(),
	}));

	return sessionToken;
}

/**
 * 验证会话
 */
async function validateSession(env: Env, sessionToken: string | null): Promise<SessionData | null> {
	if (!sessionToken) {
		return null;
	}

	const sessionDataStr = await env.API_KEYS.get(`session_${sessionToken}`);
	if (!sessionDataStr) {
		return null;
	}

	return JSON.parse(sessionDataStr) as SessionData;
}

/**
 * 从请求中获取会话
 */
async function getSessionFromRequest(request: Request, env: Env): Promise<SessionData | null> {
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) {
		return null;
	}

	const cookies = parseCookies(cookieHeader);
	const sessionToken = cookies['session'];

	return validateSession(env, sessionToken);
}

/**
 * 解析 Cookie 字符串
 */
function parseCookies(cookieHeader: string): Record<string, string> {
	const cookies: Record<string, string> = {};
	cookieHeader.split(';').forEach(cookie => {
		const [name, ...rest] = cookie.split('=');
		cookies[name.trim()] = rest.join('=').trim();
	});
	return cookies;
}

/**
 * 处理 GitHub 登录 - 重定向到 GitHub
 */
function handleGitHubLogin(env: Env): Response {
	const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
	githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
	githubAuthUrl.searchParams.set('redirect_uri', env.GITHUB_REDIRECT_URI);
	githubAuthUrl.searchParams.set('scope', 'read:user user:email');

	return Response.redirect(githubAuthUrl.toString(), 302);
}

/**
 * 处理 GitHub 回调
 */
async function handleGitHubCallback(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');

	if (!code) {
		return new Response('Missing authorization code', { status: 400 });
	}

	try {
		// 1. 用 code 换取 access_token
		const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: JSON.stringify({
				client_id: env.GITHUB_CLIENT_ID,
				client_secret: env.GITHUB_CLIENT_SECRET,
				code,
				redirect_uri: env.GITHUB_REDIRECT_URI,
			}),
		});

		const tokenData = await tokenResponse.json() as any;

		if (tokenData.error || !tokenData.access_token) {
			console.error('GitHub OAuth error:', tokenData);
			return new Response('Failed to authenticate with GitHub', { status: 401 });
		}

		const accessToken = tokenData.access_token;

		// 2. 获取用户信息
		const userResponse = await fetch('https://api.github.com/user', {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Accept': 'application/vnd.github.v3+json',
				'User-Agent': 'Geo-SDK-Worker',
			},
		});

		if (!userResponse.ok) {
			return new Response('Failed to fetch user info from GitHub', { status: 401 });
		}

		const githubUser = await userResponse.json() as GitHubUser;

		// 3. 创建会话
		const sessionToken = await createSession(env, githubUser);

		// 4. 设置 Cookie 并重定向回首页
		return new Response(null, {
			status: 302,
			headers: {
				'Location': '/',
				'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
			},
		});
	} catch (error) {
		console.error('GitHub callback error:', error);
		return new Response('Authentication failed', { status: 500 });
	}
}

/**
 * 处理登出
 */
function handleLogout(corsHeaders: Record<string, string>): Response {
	return new Response(null, {
		status: 302,
		headers: {
			...corsHeaders,
			'Location': '/',
			'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
		},
	});
}

/**
 * 获取当前登录用户信息
 */
async function handleGetUser(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	const session = await getSessionFromRequest(request, env);

	if (!session) {
		return new Response(
			JSON.stringify({ authenticated: false }),
			{
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			}
		);
	}

	return new Response(
		JSON.stringify({
			authenticated: true,
			user: {
				id: session.githubId,
				login: session.githubLogin,
				avatar: session.githubAvatar,
				email: session.githubEmail,
				name: session.githubName,
			},
		}),
		{
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		}
	);
}

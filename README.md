# @jjuidev/bridge

Modern TypeScript HTTP client built on Axios with automatic token management, interceptors, and event-driven refresh token handling.

## Features

- Axios wrapper with full TypeScript support
- Automatic JWT token management with expiry detection
- Event-driven architecture for token lifecycle
- Request/Response interceptors (supports single or array)
- Automatic token attachment to requests with ignore patterns
- Full TypeScript types and interfaces
- Concurrent request handling during token refresh

## Installation

```bash
# npm
npm install @jjuidev/bridge

# yarn
yarn add @jjuidev/bridge

# pnpm
pnpm add @jjuidev/bridge

# bun
bun add @jjuidev/bridge
```

## Basic Usage

```typescript
import { HttpClient } from '@jjuidev/bridge'

const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		ignoreTokenPatterns: [/\/auth\/login/],
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()

			return data.data
		}
	}
})

const response = await httpClient.get('/users')
console.log(response.data)
```

## Interceptors

### Single Request Interceptor

```typescript
httpClient.useRequestInterceptor({
	onRequest: (config) => {
		console.log('Request:', config.url)
		config.headers['X-Request-ID'] = crypto.randomUUID()
		return config
	},
	onRequestError: (error) => {
		console.error('Request error:', error)
		return Promise.reject(error)
	}
})
```

### Multiple Response Interceptors

```typescript
httpClient.useResponseInterceptor([
	{
		onResponse: (response) => {
			console.log('Status:', response.status)
			return response
		}
	},
	{
		onResponse: (response) => {
			return response.data
		}
	}
])
```

## Token Management

### ⚠️ Important: Refresh Token API Call

**DO NOT use `httpClient` to call refresh token API** - This will cause an infinite loop!

**Why?**

```
httpClient.post('/auth/refresh')
  → Interceptor checks token → getToken()
  → Token expired → refreshTokenIfNecessary()
  → executeRefreshToken() → httpClient.post('/auth/refresh') again
  → INFINITE LOOP! 🔄
```

**✅ Correct Approach: Use `fetch` directly**

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()

			return data.data
		}
	}
})
```

### Custom Token Storage

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		expiryThreshold: 120_000, // 120 seconds in milliseconds
		tokenKey: {
			accessToken: 'token_access',
			refreshToken: 'token_refresh'
		},
		getAccessToken: () => sessionStorage.getItem('token_access') ?? '',
		getRefreshToken: () => sessionStorage.getItem('token_refresh') ?? '',
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()

			return data.data
		}
	}
})
```

### Token Lifecycle Callbacks

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()

			return data.data
		},
		onTokenInvalid: (error) => {
			console.error('Token invalid:', error)
			// Handle invalid token (e.g., redirect to login)
			localStorage.clear()
		},
		onBeforeRefreshToken: (currentToken) => {
			console.log('Starting token refresh with current token:', currentToken)
		},
		onAfterRefreshToken: (newToken) => {
			console.log('Token refreshed:', newToken)
			// Token is automatically saved to localStorage
			// Or handle custom storage here
		},
		onRefreshTokenError: (error) => {
			console.error('Refresh failed:', error)
			// Handle refresh error
		},
		onRefreshTokenExpired: (error) => {
			console.error('Refresh token expired:', error)
			// Handle expired refresh token (e.g., logout)
			localStorage.clear()
			window.location.href = '/login'
		}
	}
})
```

### Custom Token Validation

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		isAccessTokenExpired: (token) => {
			// Custom logic to check if access token is expired
			// Return true if expired, false if valid
			return false
		},
		isRefreshTokenExpired: (token) => {
			// Custom logic to check if refresh token is expired
			// Return true if expired, false if valid
			return false
		},
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()

			return data.data
		}
	}
})
```

## Ignore Token Patterns

By default, token is automatically attached to all requests. Use `ignoreTokenPatterns` to skip token attachment for specific routes (e.g., public endpoints, login, register):

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	ignoreTokenPatterns: [/\/auth\/login/, /\/auth\/register/, /\/public\//],
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				}
			})

			const data = await response.json()

			return data.data
		}
	}
})

await httpClient.post('/auth/login', { email, password })

await httpClient.get('/public/articles')
```

## Custom Auth Injection

By default, token is automatically injected as `Authorization: Bearer ${token}` header. Use `injectAuth` to customize how the token is attached to requests.

### Default Behavior (Bearer Token)

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			// ... refresh logic
		}
	}
	// Default: request.headers['Authorization'] = `Bearer ${token}`
})
```

### Custom Auth Type

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			// ... refresh logic
		}
	},
	injectAuth: (token, request) => {
		// Use custom auth type
		request.headers['X-Auth-Token'] = token
		// ...
	}
})
```

### Custom Token Format

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		executeRefreshToken: async ({ accessToken, refreshToken }) => {
			// ... refresh logic
		}
	},
	injectAuth: (token, request) => {
		// Custom format: không dùng Bearer prefix
		request.headers['Authorization'] = `Token ${token}`
	}
})
```

## Token Refresh Flow

The library automatically handles token refresh with the following flow:

1. **Request Interceptor**: Before each request, checks if access token is valid
2. **Token Validation**: Uses JWT decode to check token expiry with threshold (or custom validation)
3. **Automatic Refresh**: If token expired, automatically refreshes using refresh token
4. **Concurrent Handling**: Multiple requests during refresh wait for single refresh operation (single-flight pattern)
5. **Event Emission**: Emits events throughout the refresh lifecycle
6. **Error Handling**: Handles invalid refresh tokens and network errors

```
// Flow refreshToken by Event-Driven Architecture
Request → getToken() → isAccessTokenExpired()? → No Token/Invalid? → Emit 'token:invalid' → throw
                              ↓
                  refreshTokenIfNecessary()
                              ↓
                    Already Refreshing? → Wait (Single-Flight)
                              ↓
                    isRefreshTokenExpired()? → No Token/Invalid? → Emit 'token:invalid' → throw
                              ↓
                    Emit 'refreshToken:start' → executeRefreshToken()
                                                          ↓
                                                      Success? -> Emit 'refreshToken:error' → throw
                                                          ↓
                                              Emit 'refreshToken:success'
                                                          ↓
                                                    getAccessToken() - (after onRefreshTokenSuccess)
```

### Event Flow

- **`token:invalid`**: Emitted when token is missing, invalid, or cannot be decoded
- **`refreshToken:start`**: Emitted when refresh process begins
- **`refreshToken:success`**: Emitted when refresh succeeds (includes new token object)
- **`refreshToken:error`**: Emitted when refresh API call fails
- **`refreshToken:expired`**: Emitted when refresh token itself is expired or invalid

## Configuration Options

### HttpClientOptions

```typescript
interface HttpClientOptions extends CreateAxiosDefaults {
	ignoreTokenPatterns?: RegExp[]
	tokenManagerOptions: TokenManagerOptions
	injectAuth?: (token: string, request: InternalAxiosRequestConfig) => void
}
```

**Note:**

- Token is automatically attached to all requests by default as `Authorization: Bearer ${token}` header
- Use `ignoreTokenPatterns` to skip token attachment for specific endpoints (e.g., public routes, login, register)
- Use `injectAuth` to customize how the token is injected into requests (header name, format, query params, etc.)

### TokenManagerOptions

```typescript
interface TokenManagerOptions {
	getAccessToken?: () => string
	getRefreshToken?: () => string
	isAccessTokenExpired?: (token: string) => boolean
	isRefreshTokenExpired?: (token: string) => boolean

	executeRefreshToken: (currentToken: {
		accessToken: string
		refreshToken: string
	}) => Promise<{ accessToken: string; refreshToken: string }>
	onTokenInvalid?: (error: any) => void
	onBeforeRefreshToken?: (currentToken: { accessToken: string; refreshToken: string }) => void
	onAfterRefreshToken?: (newToken: { accessToken: string; refreshToken: string }) => void
	onRefreshTokenError?: (error: any) => void
	onRefreshTokenExpired?: (error: any) => void

	tokenKey?: { accessToken: string; refreshToken: string }
	expiryThreshold?: number // milliseconds
}
```

## Events

- `token:invalid` - Token is invalid or missing (emits error)
- `refreshToken:start` - Token refresh started
- `refreshToken:success` - Token refresh completed successfully (emits token object)
- `refreshToken:error` - Token refresh failed (emits error)
- `refreshToken:expired` - Refresh token is invalid or expired (emits error)

## Author

**jjuidev**

- Email: hi@jjuidev.com
- GitHub: [jjuidev](https://github.com/jjuidev)

## License

MIT

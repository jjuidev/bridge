# @jjuidev/bridge

Modern TypeScript HTTP client built on axios with token management. Supports event-driven refresh token flow.

## Features

- Inject token to request headers.
- Event-driven refresh token flow.
- Default logic base on axios, localStorage and jwt-decode.
- Easy to use and configure for authentication refresh token flow.
- Factory for create service and query key. Ref: [Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys)

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
```

## Interceptors

### Single Request Interceptor

```typescript
...
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
...
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

### Custom source of token (getAccessToken and getRefreshToken)

By default, the library will get accessToken and refreshToken from localStorage. You can define your own logic to get accessToken and refreshToken from sessionStorage, cookie, etc.

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		...
		getAccessToken: () => sessionStorage.getItem('token_access') ?? '',
		getRefreshToken: () => sessionStorage.getItem('token_refresh') ?? ''
	}
})
```

### Token events callbacks

By default, the library will `set|clear` token `to|from` `localStorage` for the token events. You can define your own logic to handle the token events.

| Token event            | Default behavior |
| ---------------------- | ---------------- |
| `token:invalid`        | clear            |
| `refreshToken:start`   | \_               |
| `refreshToken:success` | set              |
| `refreshToken:error`   | clear            |
| `refreshToken:expired` | clear            |

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		...
		onTokenInvalid: (error) => {
			// Handle invalid token (e.g., redirect to login)
		},
		onRefreshTokenStart: () => {
			// Handle refresh token start if necessary
		},
		onRefreshTokenSuccess: (newToken) => {
			// Handle refresh token (e.g., update token in localStorage)
		},
		onRefreshTokenError: (error) => {
			// Handle refresh error (e.g., redirect to login)
		},
		onRefreshTokenExpired: (error) => {
			// Handle expired refresh token (e.g., redirect to login)
		}
	}
})
```

### Custom token validation (isAccessTokenExpired and isRefreshTokenExpired)

By default, the library will use JWT decode to check token `exp` with `expiryThreshold` (1 minute by default). You can define your own logic to check if access token or refresh token is expired.

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	tokenManagerOptions: {
		... // other tokenManagerOptions
		isAccessTokenExpired: (token) => {
			// Custom logic to check if access token is expired
			// Return true if expired, false if valid
			return false
		},
		isRefreshTokenExpired: (token) => {
			// Custom logic to check if refresh token is expired
			// Return true if expired, false if valid
			return false
		}
	}
})
```

## Ignore Token Patterns

By default, token is automatically attached to all requests. Use `ignoreTokenPatterns` to skip token attachment for specific routes (e.g., public endpoints, login, register)

```typescript
const httpClient = new HttpClient({
	baseURL: API_BASE_URL,
	ignoreTokenPatterns: [/\/auth\/login/, /\/auth\/register/, /\/public\//],
	tokenManagerOptions: {
		...
	}
})
```

## Custom auth injection (injectAuth)

By default, token is automatically injected as `Authorization: Bearer ${token}` header. Use `injectAuth` to customize how the token is attached to requests (header name, format, query params, etc.)

### Default Behavior (Bearer Token)

```typescript
const httpClient = new HttpClient({
        ...
        // Default: request.headers['Authorization'] = `Bearer ${token}`
})
```

### Custom Auth

```typescript
const httpClient = new HttpClient({
	...
	injectAuth: (token, request) => {
		// Custom auth type, example: X-Auth-Token
		request.headers['X-Auth-Token'] = token
	}
})
```

## Token Refresh Flow

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

### Token refresh flow events

| Token event            | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `token:invalid`        | Emitted when token is `missing`, `invalid`, or `cannot be decoded` |
| `refreshToken:start`   | Emitted when refresh process begins                                |
| `refreshToken:success` | Emitted when refresh succeeds (includes new token object)          |
| `refreshToken:error`   | Emitted when refresh API call fails                                |
| `refreshToken:expired` | Emitted when refreshToken is `expired`                             |

# Bridge - React Query Integration

## Basic Usage

```typescript
...
const { createQueryKey, createService } = createBridgeFactory({
  httpClient
})

const usersService = createService('users') // Use default Factory service: list, infinityList, detail, create, update, delete, remove, restore
const usersQueryKey = createQueryKey('users') // Use default Factory queryKey: all, list, infinityList, detail
```

## Custom Factory Service

```typescript
...
const { createService } = createBridgeFactory({
  httpClient,
  serviceFactoryFn: ({ httpClient, buildQueryString }) => ({
    	list2: (filter?: Filter) => httpClient.get(`/users?${buildQueryString(filter)}`)
  })
})

const usersService = createService('users')
usersService.list2()
```

## Custom Factory Service with extend

```typescript
...
const { createService } = createBridgeFactory({
  httpClient,
  serviceFactoryFn: ({ httpClient, buildQueryString }) => ({
    	list2: (filter?: Filter) => httpClient.get(`/users?${buildQueryString(filter)}`)
  })
})

const usersService = createService('users', ({ httpClient, buildQueryString }) => ({
    	list3: (filter?: Filter) => httpClient.get(`/users?${buildQueryString(filter)}`)
}))
usersService.list2()
usersService.list3()
```

## Custom Factory Query Key

```typescript
...
const { createQueryKey } = createBridgeFactory({
  httpClient,
  queryKeyFactoryFn: ({ buildQueryKey }) => ({
    	list2: (filter?: Filter) => buildQueryKey(filter)
  })
})
const usersQueryKey = createQueryKey('users')
usersQueryKey.list2()
```

## Custom Factory Query Key with extend

```typescript
...
const { createQueryKey } = createBridgeFactory({
  httpClient,
  queryKeyFactoryFn: ({ buildQueryKey }) => ({
    	list2: (filter?: Filter) => buildQueryKey(filter)
  })
})
const usersQueryKey = createQueryKey('users', ({ buildQueryKey }) => ({
    	list3: (filter?: Filter) => buildQueryKey(filter)
}))
usersQueryKey.list2()
usersQueryKey.list3()
```

## Author

**jjuidev**

- Email: hi@jjuidev.com
- GitHub: [jjuidev](https://github.com/jjuidev)

## License

MIT

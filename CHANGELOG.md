# Changelog

## 2.3.0

### Minor Changes

- 7128dcf: Add bridge feature

## 2.2.1

### Patch Changes

- 7e7bb03: Update features docs

## 2.2.0

### Minor Changes

- b53b19a: Clean code, docs.

## 2.1.0

### Minor Changes

- b85c3d9: Add injectAuth method
- 4053bb7: Change expiryThreshold, executeRefreshToken

## 2.0.0

### Major Changes

- 9243e8a: Fix typescript extendable

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-12-17

### Added

- Initial release
- Axios-based HTTP client with TypeScript support
- Automatic JWT token management with jwt-decode
- Event-driven token refresh system using `EventEmitter`
- Request/Response interceptors (single or array)
- Token expiry detection with configurable threshold
- Automatic token attachment to requests via `HttpClient`
- Ignore token patterns for public/public-like routes
- Concurrent request handling during token refresh (single-flight)
- Custom token storage and validation via callbacks
- Token lifecycle events: `token:invalid`, `refreshToken:start`, `refreshToken:success`, `refreshToken:error`, `refreshToken:expired`
- Comprehensive TypeScript types and interfaces
- Full documentation with usage examples

### Features

- **TokenManager**: Manages access and refresh tokens with automatic refresh, expiry checks, and event emission
- **EventEmitter**: Lightweight, generic event system used internally for token lifecycle
- **HttpClient**: Axios wrapper with automatic token management and request/response interceptors
- **Interceptors**: Support for both single and array interceptors on request/response chains

### Token Refresh Flow

1. Check access token validity before each request via `TokenManager.getToken()`
2. Automatically refresh if expired using refresh token (`refreshTokenIfNecessary`)
3. Handle concurrent requests during refresh with shared refresh promise
4. Emit events throughout the lifecycle (`token:invalid`, `refreshToken:*`)
5. Handle errors and invalid/expired tokens with customizable callbacks and safe defaults

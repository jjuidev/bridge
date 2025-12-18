import axios, {
	AxiosError,
	AxiosRequestConfig,
	AxiosResponse,
	CreateAxiosDefaults,
	InternalAxiosRequestConfig
} from 'axios'

import { TokenManager, TokenManagerOptions } from './TokenManager'

export interface BridgeResponse<T = any, D = any, H = {}> extends AxiosResponse<T, D, H> {}

export interface RequestInterceptor {
	onRequest?: (request: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig> | InternalAxiosRequestConfig
	onRequestError?: (error: AxiosError) => Promise<never>
}

export interface ResponseInterceptor {
	onResponse?: (response: BridgeResponse) => any
	onResponseError?: (error: AxiosError) => Promise<never>
}

export interface HttpClientOptions extends CreateAxiosDefaults {
	ignoreTokenPatterns?: RegExp[]
	tokenManagerOptions: TokenManagerOptions
}

export class HttpClient {
	private instance: ReturnType<typeof axios.create>
	public tokenManager: TokenManager

	constructor(options: HttpClientOptions) {
		const { ignoreTokenPatterns = [], tokenManagerOptions, ...axiosOptions } = options

		this.instance = axios.create(axiosOptions)
		this.tokenManager = new TokenManager(tokenManagerOptions)

		this.useRequestInterceptor({
			onRequest: async (request) => {
				if (ignoreTokenPatterns.some((pattern) => pattern.test(request.url ?? ''))) {
					return request
				}

				const token = await this.tokenManager.getToken()

				if (token) {
					request.headers['Authorization'] = `Bearer ${token}`
				}

				return request
			}
		})
	}

	public useRequestInterceptor(interceptor: RequestInterceptor | RequestInterceptor[]) {
		if (Array.isArray(interceptor)) {
			interceptor.forEach((interceptor) => {
				this.instance.interceptors.request.use(interceptor.onRequest, interceptor.onRequestError)
			})
		} else {
			this.instance.interceptors.request.use(interceptor.onRequest, interceptor.onRequestError)
		}
	}

	public useResponseInterceptor(interceptor: ResponseInterceptor | ResponseInterceptor[]) {
		if (Array.isArray(interceptor)) {
			interceptor.forEach((interceptor) => {
				this.instance.interceptors.response.use(interceptor.onResponse, interceptor.onResponseError)
			})
		} else {
			this.instance.interceptors.response.use(interceptor.onResponse, interceptor.onResponseError)
		}
	}

	public destroy() {
		this.tokenManager.destroy()
	}

	// https://github.com/axios/axios
	public head = <T = any, R = BridgeResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>) =>
		this.instance.head<T, R, D>(url, config)
	public options = <T = any, R = BridgeResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>) =>
		this.instance.options<T, R, D>(url, config)
	public request = <T = any, R = BridgeResponse<T>, D = any>(config: AxiosRequestConfig<D>) =>
		this.instance.request<T, R, D>(config)
	public get = <T = any, R = BridgeResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>) =>
		this.instance.get<T, R, D>(url, config)
	public post = <T = any, R = BridgeResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
		this.instance.post<T, R, D>(url, data, config)
	public put = <T = any, R = BridgeResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
		this.instance.put<T, R, D>(url, data, config)
	public patch = <T = any, R = BridgeResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>) =>
		this.instance.patch<T, R, D>(url, data, config)
	public delete = <T = any, R = BridgeResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>) =>
		this.instance.delete<T, R, D>(url, config)
}

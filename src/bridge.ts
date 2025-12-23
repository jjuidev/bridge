import queryString, { StringifyOptions } from 'query-string'

import { BridgeResponse, HttpClient } from './HttpClient'

export type Id = string
export type Filter = Record<string, any>
export type QueryKey = readonly unknown[]

export interface DefaultService {
	list: <T = any>(filter?: Filter) => Promise<BridgeResponse<T>>
	infinityList: <T = any>(filter?: Filter) => Promise<BridgeResponse<T>>
	detail: <T = any>(id: Id) => Promise<BridgeResponse<T>>
	create: <T = any, D = any>(data: D) => Promise<BridgeResponse<T>>
	update: <T = any, D = any>(params: { id: Id; data: D }) => Promise<BridgeResponse<T>>
	delete: (id: Id) => Promise<BridgeResponse<any>>
	remove: (id: Id) => Promise<BridgeResponse<any>>
	restore: (id: Id) => Promise<BridgeResponse<any>>
}

export interface ServiceUtils {
	httpClient: HttpClient
	buildQueryString: (filter?: Filter) => string
}

export interface DefaultQueryKey {
	list: (filter?: Filter) => QueryKey
	infinityList: (filter?: Filter) => QueryKey
	detail: (id?: Id) => QueryKey
}

export interface QueryKeyUtils {
	pick: (filter: Filter, keys: string[]) => Filter
	omit: (filter: Filter, keys: string[]) => Filter
	buildQueryKey: (...args: unknown[]) => QueryKey
}

export interface BridgeFactoryOptions<
	TServiceFactory = Record<string, never>,
	TQueryKeyFactory = Record<string, never>
> {
	httpClient: HttpClient
	filterOptions?: {
		skipNull: boolean
		skipEmptyString: boolean
	}
	serviceFactoryFn?: (utils: ServiceUtils) => TServiceFactory
	queryKeyFactoryFn?: (utils: QueryKeyUtils) => TQueryKeyFactory
}

export type BaseServiceType<TServiceFactory> =
	TServiceFactory extends Record<string, never> ? DefaultService : TServiceFactory

export type QueryKeyAll = {
	all: QueryKey
}
export type BaseQueryKeyType<TQueryKeyFactory> =
	TQueryKeyFactory extends Record<string, never> ? DefaultQueryKey & QueryKeyAll : TQueryKeyFactory & QueryKeyAll
export interface BridgeFactory<TServiceFactory = Record<string, never>, TQueryKeyFactory = Record<string, never>> {
	createQueryKey: <TExtend = Record<string, never>>(
		resource: string,
		extend?: (utils: QueryKeyUtils) => TExtend
	) => BaseQueryKeyType<TQueryKeyFactory> & TExtend
	createService: <TExtend = Record<string, never>>(
		resource: string,
		extend?: (utils: ServiceUtils) => TExtend
	) => BaseServiceType<TServiceFactory> & TExtend
}

export const createBridgeFactory = <TServiceFactory = Record<string, never>, TQueryKeyFactory = Record<string, never>>(
	options: BridgeFactoryOptions<TServiceFactory, TQueryKeyFactory>
): BridgeFactory<TServiceFactory, TQueryKeyFactory> => {
	const { httpClient, serviceFactoryFn, queryKeyFactoryFn, filterOptions } = options

	// service
	const buildQueryString = (filter: Filter = {}): string => {
		const options: StringifyOptions = {
			arrayFormat: 'none',
			skipNull: true,
			skipEmptyString: true,
			...filterOptions
		}

		return queryString.stringify(filter, options)
	}

	const serviceUtils: ServiceUtils = {
		httpClient,
		buildQueryString
	}

	const createDefaultService = (resource: string): DefaultService => ({
		list: (filter) => httpClient.get(`${resource}?${buildQueryString(filter)}`),
		infinityList: (filter) => httpClient.get(`${resource}?${buildQueryString(filter)}`),
		detail: (id) => httpClient.get(`${resource}/${id}`),
		create: (data) => httpClient.post(resource, data),
		update: ({ id, data }) => httpClient.put(`${resource}/${id}`, data),
		delete: (id) => httpClient.delete(`${resource}/${id}`),
		remove: (id) => httpClient.delete(`${resource}/remove/${id}`),
		restore: (id) => httpClient.post(`${resource}/restore/${id}`)
	})

	const createService = <TExtend = Record<string, never>>(
		resource: string,
		extend?: (utils: ServiceUtils) => TExtend
	): BaseServiceType<TServiceFactory> & TExtend => {
		const baseService = createDefaultService(resource)
		const extensions = extend?.(serviceUtils) ?? ({} as TExtend)

		if (serviceFactoryFn) {
			const factoryService = serviceFactoryFn(serviceUtils)

			return {
				...factoryService,
				...extensions
			} as BaseServiceType<TServiceFactory> & TExtend
		}

		return {
			...baseService,
			...extensions
		} as BaseServiceType<TServiceFactory> & TExtend
	}

	// queryKey
	const omit = (filter: Filter = {}, keys: string[]): Filter =>
		Object.fromEntries(Object.entries(filter).filter(([key]) => !keys.includes(key)))

	const pick = (filter: Filter = {}, keys: string[]): Filter =>
		Object.fromEntries(Object.entries(filter).filter(([key]) => keys.includes(key)))

	const shouldSkipValue = (value: unknown): boolean => {
		const options = {
			skipNull: true,
			skipEmptyString: true,
			...filterOptions
		}

		if (options.skipNull && value === null) {
			return true
		}

		if (options.skipEmptyString && value === '') {
			return true
		}

		return false
	}

	const cleanFilter = (filter: Filter = {}): Filter =>
		Object.entries(filter).reduce((cleanedFilter, [key, value]) => {
			if (shouldSkipValue(value)) {
				return cleanedFilter
			}

			if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				cleanedFilter[key] = cleanFilter(value)
			} else {
				cleanedFilter[key] = value
			}

			return cleanedFilter
		}, {} as Filter)

	const buildQueryKey = (...args: unknown[]): QueryKey => {
		const queryKey: any[] = []
		const cleanedArgs = args.filter((arg: unknown) => arg !== undefined)

		cleanedArgs.forEach((arg: unknown) => {
			if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
				queryKey.push(cleanFilter(arg))
			} else {
				queryKey.push(arg)
			}
		})

		return queryKey as QueryKey
	}

	const wrapExtensions = <T extends Record<string, unknown>>(resource: string, extensions: T): T => {
		const wrapped: Record<string, unknown> = {}

		for (const [methodName, fn] of Object.entries(extensions)) {
			if (typeof fn === 'function') {
				wrapped[methodName] = (...args: unknown[]) => {
					const result = fn(...args)

					if (Array.isArray(result)) {
						return [resource, methodName, ...result]
					}

					return result
				}
			} else {
				wrapped[methodName] = fn
			}
		}

		return wrapped as T
	}

	const createQueryKeyAll = (resource: string): QueryKeyAll => ({
		all: [resource]
	})

	const queryKeyUtils: QueryKeyUtils = {
		pick,
		omit,
		buildQueryKey
	}

	const createDefaultQueryKey = (resource: string): DefaultQueryKey => ({
		...createQueryKeyAll(resource),
		list: (filter?: Filter) => buildQueryKey(resource, 'list', cleanFilter(filter)),
		infinityList: (filter?: Filter) => buildQueryKey(resource, 'infinityList', omit(filter, ['page'])),
		detail: (id?: Id) => buildQueryKey(resource, 'detail', id)
	})

	const createQueryKey = <TExtend = Record<string, never>>(
		resource: string,
		extend?: (utils: QueryKeyUtils) => TExtend
	): BaseQueryKeyType<TQueryKeyFactory> & TExtend => {
		const baseQueryKey = createDefaultQueryKey(resource)
		const userExtensions = extend?.(queryKeyUtils)

		const wrappedUserExtensions = userExtensions ? wrapExtensions(resource, userExtensions) : ({} as TExtend)

		const extensions = {
			...createQueryKeyAll(resource),
			...wrappedUserExtensions
		} as TExtend

		if (queryKeyFactoryFn) {
			const factoryQueryKey = queryKeyFactoryFn(queryKeyUtils)
			const wrappedFactoryQueryKey = wrapExtensions(resource, factoryQueryKey as Record<string, unknown>)

			return {
				...wrappedFactoryQueryKey,
				...extensions
			} as BaseQueryKeyType<TQueryKeyFactory> & TExtend
		}

		return {
			...baseQueryKey,
			...extensions
		} as BaseQueryKeyType<TQueryKeyFactory> & TExtend
	}

	return {
		createQueryKey,
		createService
	}
}

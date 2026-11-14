const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api';

export class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

let tokenProvider = null;
let userIdProvider = null;
let onUnauthorizedCallback = null;

export const setTokenProvider = (provider) => {
    tokenProvider = provider;
};

export const setUserIdProvider = (provider) => {
    userIdProvider = provider;
};

export const setUnauthorizedHandler = (handler) => {
    onUnauthorizedCallback = handler;
};

export async function apiRequest(path, { method = 'GET', body, token, params, headers: customHeaders, skipAuth = false } = {}) {
    let url = `${BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

    if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
        });
        const queryString = searchParams.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
    }

    const activeToken = !skipAuth ? (token ?? (tokenProvider ? tokenProvider() : null)) : null;
    const activeUserId = !skipAuth && userIdProvider ? userIdProvider() : null;

    const headers = {
        'Content-Type': 'application/json',
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        ...(activeUserId ? { 'x-user-id': String(activeUserId) } : {}),
        ...customHeaders,
    };

    let res;
    try {
        res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (error) {
        throw new ApiError(error.message || 'Network request failed', 0);
    }

    if (res.status === 401 && onUnauthorizedCallback) {
        onUnauthorizedCallback();
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data);
    }

    return data;
}

export const api = {
    get: (path, options = {}) => apiRequest(path, { ...options, method: 'GET' }),
    post: (path, body, options = {}) => apiRequest(path, { ...options, method: 'POST', body }),
    put: (path, body, options = {}) => apiRequest(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options = {}) => apiRequest(path, { ...options, method: 'PATCH', body }),
    delete: (path, options = {}) => apiRequest(path, { ...options, method: 'DELETE' }),
};

export default api;

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setTokenProvider, setUnauthorizedHandler, setUserIdProvider } from '../services/api';
import { clearSession, getTokenExpiry, loadSession, saveSession } from '../services/authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    // True while we read a saved session from storage on launch, so the
    // login screen doesn't flash before the user is restored.
    const [isLoading, setIsLoading] = useState(true);

    // Refs are updated during render, so the API client sees a new token immediately.
    // (Child screens' effects run before this provider's effects, so reading state
    // via a useEffect-registered closure would send the first request without a token.)
    const tokenRef = useRef(null);
    const userRef = useRef(null);
    tokenRef.current = token;
    userRef.current = user;

    const applySession = useCallback((nextUser, nextToken) => {
        // Update refs right away so requests fired before the next render use the new token.
        tokenRef.current = nextToken;
        userRef.current = nextUser;
        setUser(nextUser);
        setToken(nextToken);
    }, []);

    const signOut = useCallback(async () => {
        applySession(null, null);
        await clearSession();
    }, [applySession]);

    useEffect(() => {
        setTokenProvider(() => tokenRef.current);
        setUserIdProvider(() => userRef.current?.id ?? null);
        setUnauthorizedHandler(() => {
            // Token rejected by the server (expired/invalid) — drop the saved session too.
            applySession(null, null);
            clearSession();
        });
    }, [applySession]);

    // Restore a saved session on app launch.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const stored = await loadSession();
            if (cancelled) return;
            if (stored) {
                applySession(stored.user, stored.token);
            }
            setIsLoading(false);

            if (!stored) return;
            // Refresh the user in the background and confirm the token is still accepted.
            // A 401 triggers the unauthorized handler above; a network error keeps the
            // stored session so the app still opens offline.
            try {
                const res = await api.get('/auth/me', { token: stored.token });
                if (cancelled || tokenRef.current !== stored.token) return;
                applySession(res.data, stored.token);
                saveSession({ user: res.data, token: stored.token });
            } catch {
                // handled above
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [applySession]);

    // Log out automatically when the token expires while the app is open.
    useEffect(() => {
        if (!token) return undefined;
        const expiresAt = getTokenExpiry(token);
        if (!expiresAt) return undefined;
        const delay = expiresAt - Date.now();
        // setTimeout overflows above ~24.8 days; the launch check covers longer tokens.
        if (delay > 2 ** 31 - 1) return undefined;
        const timer = setTimeout(signOut, Math.max(delay, 0));
        return () => clearTimeout(timer);
    }, [token, signOut]);

    // Both endpoints return { data: { user, token } }. Errors (e.g. wrong password)
    // are thrown as ApiError so the screen can show the message.
    const signIn = useCallback(async (email, password) => {
        const res = await api.post('/auth/login', { email, password }, { skipAuth: true });
        applySession(res.data.user, res.data.token);
        await saveSession(res.data);
    }, [applySession]);

    const signUp = useCallback(async ({ name, email, password }) => {
        const res = await api.post('/auth/register', { name, email, password }, { skipAuth: true });
        applySession(res.data.user, res.data.token);
        await saveSession(res.data);
    }, [applySession]);

    const setSession = useCallback(({ user: nextUser, token: nextToken }) => {
        applySession(nextUser ?? null, nextToken ?? null);
        if (nextToken) {
            saveSession({ user: nextUser, token: nextToken });
        } else {
            clearSession();
        }
    }, [applySession]);

    const value = useMemo(
        () => ({
            user,
            token,
            isLoading,
            isAuthenticated: !!user,
            signIn,
            signUp,
            signOut,
            setSession,
        }),
        [user, token, isLoading, signIn, signUp, signOut, setSession]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

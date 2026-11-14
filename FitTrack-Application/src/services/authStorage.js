import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Persists the logged-in session so users stay signed in across app restarts.
// Native: expo-secure-store (iOS Keychain / Android Keystore, encrypted).
// Web: SecureStore is unavailable, so fall back to localStorage.

const TOKEN_KEY = 'fittrack.authToken';
const USER_KEY = 'fittrack.authUser';

const isWeb = Platform.OS === 'web';

const storage = {
    getItem: async (key) => {
        if (isWeb) {
            try {
                return globalThis.localStorage?.getItem(key) ?? null;
            } catch {
                return null;
            }
        }
        return SecureStore.getItemAsync(key);
    },
    setItem: async (key, value) => {
        if (isWeb) {
            try {
                globalThis.localStorage?.setItem(key, value);
            } catch {
                // Storage blocked (private mode etc.) — session just won't persist.
            }
            return;
        }
        await SecureStore.setItemAsync(key, value);
    },
    removeItem: async (key) => {
        if (isWeb) {
            try {
                globalThis.localStorage?.removeItem(key);
            } catch {
                // ignore
            }
            return;
        }
        await SecureStore.deleteItemAsync(key);
    },
};

// Reads the `exp` claim (seconds since epoch) from a JWT without verifying it.
// The server still verifies the signature; this only avoids restoring a token
// we already know is expired.
export function getTokenExpiry(token) {
    try {
        const payload = token.split('.')[1];
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const { exp } = JSON.parse(atob(padded));
        return typeof exp === 'number' ? exp * 1000 : null;
    } catch {
        return null;
    }
}

export function isTokenExpired(token) {
    const expiresAt = getTokenExpiry(token);
    // Treat an unreadable token as expired so the user is asked to log in again.
    return expiresAt === null || Date.now() >= expiresAt;
}

export async function saveSession({ token, user }) {
    try {
        await Promise.all([
            storage.setItem(TOKEN_KEY, token),
            storage.setItem(USER_KEY, JSON.stringify(user ?? null)),
        ]);
    } catch (error) {
        console.warn('Failed to persist session', error);
    }
}

// Returns { token, user } if a non-expired session is stored, otherwise null
// (and clears any stale data).
export async function loadSession() {
    try {
        const [token, userJson] = await Promise.all([
            storage.getItem(TOKEN_KEY),
            storage.getItem(USER_KEY),
        ]);
        if (!token || isTokenExpired(token)) {
            if (token) await clearSession();
            return null;
        }
        const user = userJson ? JSON.parse(userJson) : null;
        return { token, user };
    } catch (error) {
        console.warn('Failed to load stored session', error);
        return null;
    }
}

export async function clearSession() {
    try {
        await Promise.all([storage.removeItem(TOKEN_KEY), storage.removeItem(USER_KEY)]);
    } catch (error) {
        console.warn('Failed to clear stored session', error);
    }
}

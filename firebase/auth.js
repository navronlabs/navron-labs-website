import { auth, db } from "./config.js";
import {
    browserLocalPersistence,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const persistenceReady = setPersistence(auth, browserLocalPersistence);
const adminAccessCache = new Map();

const createAdminAccessError = () => {
    const error = new Error("This Firebase account is not authorized for admin access.");
    error.code = "auth/unauthorized-admin";
    return error;
};

const getCurrentAdminPage = () => window.location.pathname.split("/").pop() || "dashboard.html";

const redirectToLogin = (redirectTo, reason = "") => {
    const loginUrl = new URL(redirectTo, window.location.href);
    loginUrl.searchParams.set("redirect", getCurrentAdminPage());
    if (reason) loginUrl.searchParams.set("authError", reason);
    window.location.replace(loginUrl.href);
};

export const clearAdminAccessCache = (uid = null) => {
    if (uid) {
        adminAccessCache.delete(uid);
        return;
    }

    adminAccessCache.clear();
};

export const isAdminUser = async (uid, { forceRefresh = false } = {}) => {
    await persistenceReady;

    if (!uid) return false;
    if (!forceRefresh && adminAccessCache.has(uid)) {
        return adminAccessCache.get(uid);
    }

    const adminCheck = getDoc(doc(db, "admins", uid))
        .then((snapshot) => snapshot.exists())
        .catch((error) => {
            adminAccessCache.delete(uid);
            throw error;
        });

    adminAccessCache.set(uid, adminCheck);
    return adminCheck;
};

export const loginAdmin = async (email, password) => {
    await persistenceReady;
    const trimmedEmail = String(email || "").trim();
    const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
    const hasAdminAccess = await isAdminUser(credential.user.uid);

    if (!hasAdminAccess) {
        await signOut(auth);
        clearAdminAccessCache(credential.user.uid);
        throw createAdminAccessError();
    }

    return credential;
};

export const logoutAdmin = async () => {
    await persistenceReady;
    clearAdminAccessCache(auth.currentUser?.uid || null);
    return signOut(auth);
};

export const observeAdminAuth = (callback, errorCallback) => {
    return onAuthStateChanged(auth, callback, errorCallback);
};

export const getAdminSession = async () => {
    await persistenceReady;

    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
                unsubscribe();
                resolve(user);
            },
            (error) => {
                unsubscribe();
                reject(error);
            }
        );
    });
};

export const requireAdminSession = async ({ redirectTo = "login.html" } = {}) => {
    return requireAdminAccess({ redirectTo });
};

export const requireAdminAccess = async ({ redirectTo = "login.html" } = {}) => {
    const user = await getAdminSession();

    if (!user) {
        redirectToLogin(redirectTo);
        return null;
    }

    const hasAdminAccess = await isAdminUser(user.uid);

    if (!hasAdminAccess) {
        await logoutAdmin();
        redirectToLogin(redirectTo, "unauthorized");
        return null;
    }

    return user;
};

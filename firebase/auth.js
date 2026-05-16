import { auth } from "./config.js";
import {
    browserLocalPersistence,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const persistenceReady = setPersistence(auth, browserLocalPersistence);

export const loginAdmin = async (email, password) => {
    await persistenceReady;
    const trimmedEmail = String(email || "").trim();
    return signInWithEmailAndPassword(auth, trimmedEmail, password);
};

export const logoutAdmin = async () => {
    await persistenceReady;
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
    const user = await getAdminSession();

    if (!user) {
        const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";
        const loginUrl = new URL(redirectTo, window.location.href);
        loginUrl.searchParams.set("redirect", currentPage);
        window.location.replace(loginUrl.href);
        return null;
    }

    return user;
};

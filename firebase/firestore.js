import { db } from "./config.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let cachedGlobalSettings = null;
let globalSettingsUnsubscribe = null;
const globalSettingsSubscribers = new Set();
const globalSettingsErrorSubscribers = new Set();

/**
 * Fetch all services from Firestore
 */
export const fetchServices = async () => {
    try {
        const q = query(collection(db, "services")); // optionally add orderBy
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching services: ", error);
        throw error;
    }
};

/**
 * Fetch portfolio items from Firestore
 */
export const fetchPortfolio = async () => {
    try {
        const q = query(collection(db, "portfolio"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching portfolio: ", error);
        throw error;
    }
};

/**
 * Fetch team members from Firestore
 */
export const fetchTeamMembers = async () => {
    try {
        const q = query(collection(db, "team")); // optionally add orderBy
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching team: ", error);
        throw error;
    }
};

/**
 * Fetch testimonials from Firestore (only approved, ordered by newest)
 */
export const fetchTestimonials = async (limitCount = null) => {
    try {
        let q = query(
            collection(db, "testimonials"),
            where("approved", "==", true),
            orderBy("createdAt", "desc")
        );
        if (limitCount) {
            q = query(
                collection(db, "testimonials"),
                where("approved", "==", true),
                orderBy("createdAt", "desc"),
                limit(limitCount)
            );
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching testimonials: ", error);
        throw error;
    }
};

/**
 * Submit a new testimonial
 */
export const submitTestimonial = async (data) => {
    try {
        const docRef = await addDoc(collection(db, "testimonials"), {
            clientName: data.clientName,
            review: data.review,
            rating: data.rating,
            photoUrl: data.photoUrl || null,
            approved: false,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error submitting testimonial: ", error);
        throw error;
    }
};

/**
 * Fetch settings from Firestore
 */
export const fetchSettings = async () => {
    try {
        const q = query(collection(db, "settings"));
        const snapshot = await getDocs(q);
        const settings = {};
        snapshot.docs.forEach(doc => {
            settings[doc.id] = doc.data();
        });
        return settings;
    } catch (error) {
        console.error("Error fetching settings: ", error);
        throw error;
    }
};

export const fetchGlobalSettings = async () => {
    if (cachedGlobalSettings) return cachedGlobalSettings;

    try {
        const snapshot = await getDoc(doc(db, "settings", "global"));
        cachedGlobalSettings = snapshot.exists() ? snapshot.data() : {};
        return cachedGlobalSettings;
    } catch (error) {
        console.error("Error fetching global settings: ", error);
        throw error;
    }
};

/**
 * Submit a new lead to the Firestore 'leads' collection
 */
export const submitLeadForm = async (leadData) => {
    try {
        const docRef = await addDoc(collection(db, "leads"), {
            name: leadData.name,
            email: leadData.email,
            phone: leadData.phone,
            message: leadData.message,
            createdAt: serverTimestamp(),
            status: "new"
        });
        return docRef.id;
    } catch (error) {
        console.error("Error submitting lead: ", error);
        throw error;
    }
};

export const listenToCollection = (collectionName, callback, errorCallback) => {
    const q = query(collection(db, collectionName));

    return onSnapshot(
        q,
        (snapshot) => {
            const records = snapshot.docs.map(documentSnapshot => ({
                id: documentSnapshot.id,
                ...documentSnapshot.data()
            }));
            callback(records);
        },
        errorCallback
    );
};

export const createRecord = async (collectionName, data) => {
    const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return docRef.id;
};

export const updateRecord = async (collectionName, id, data) => {
    await updateDoc(doc(db, collectionName, id), {
        ...data,
        updatedAt: serverTimestamp()
    });
};

export const deleteRecord = async (collectionName, id) => {
    await deleteDoc(doc(db, collectionName, id));
};

export const listenToGlobalSettings = (callback, errorCallback) => {
    globalSettingsSubscribers.add(callback);
    if (errorCallback) globalSettingsErrorSubscribers.add(errorCallback);

    if (cachedGlobalSettings) {
        callback(cachedGlobalSettings);
    }

    if (!globalSettingsUnsubscribe) {
        globalSettingsUnsubscribe = onSnapshot(
            doc(db, "settings", "global"),
            (snapshot) => {
                cachedGlobalSettings = snapshot.exists() ? snapshot.data() : {};
                globalSettingsSubscribers.forEach((subscriber) => subscriber(cachedGlobalSettings));
            },
            (error) => {
                globalSettingsErrorSubscribers.forEach((subscriber) => subscriber(error));
            }
        );
    }

    return () => {
        globalSettingsSubscribers.delete(callback);
        if (errorCallback) globalSettingsErrorSubscribers.delete(errorCallback);

        if (globalSettingsSubscribers.size === 0 && globalSettingsUnsubscribe) {
            globalSettingsUnsubscribe();
            globalSettingsUnsubscribe = null;
        }
    };
};

export const saveGlobalSettings = async (data) => {
    await setDoc(doc(db, "settings", "global"), {
        ...data,
        updatedAt: serverTimestamp()
    }, { merge: true });
};

import {
    isAdminUser,
    loginAdmin,
    logoutAdmin,
    observeAdminAuth,
    requireAdminAccess
} from "../../firebase/auth.js";
import {
    createRecord,
    deleteRecord,
    listenToCollection,
    listenToGlobalSettings,
    saveGlobalSettings,
    updateRecord
} from "../../firebase/firestore.js";

const ADMIN_HOME = "dashboard.html";
const LOGIN_PAGE = "login.html";
const CLOUDINARY_CLOUD_NAME = "dbzd1bqp8";
const CLOUDINARY_UPLOAD_PRESET = "navronlabs_uploads";
const CLOUDINARY_FOLDER = "navron-labs";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const ALLOWED_REDIRECTS = new Set([
    "dashboard.html",
    "services.html",
    "portfolio.html",
    "leads.html",
    "settings.html",
    "team.html",
    "testimonials.html"
]);

const state = {
    records: [],
    filteredRecords: [],
    unsubscribe: null,
    deleteTarget: null,
    currentConfig: null,
    eventsBound: false,
    pendingActions: new Set(),
    queuedSettings: null
};

const collectionConfigs = {
    services: {
        collection: "services",
        title: "Services",
        empty: "No services have been added yet.",
        searchFields: ["title", "description"],
        fields: [
            { name: "title", label: "Title", type: "text", required: true },
            { name: "description", label: "Description", type: "textarea", required: true },
            { name: "icon", label: "Service Icon", type: "image" },
            { name: "featured", label: "Featured service", type: "checkbox" }
        ],
        columns: ["icon", "title", "description", "featured", "createdAt"],
        normalize: (data) => ({
            title: data.title,
            description: data.description,
            icon: data.icon,
            iconSvg: getServiceIconValue(data.icon, data.title),
            featured: data.featured
        })
    },
    portfolio: {
        collection: "portfolio",
        title: "Portfolio",
        empty: "No portfolio projects have been added yet.",
        searchFields: ["title", "category", "description", "projectUrl"],
        filters: [{ key: "category", label: "Category" }],
        fields: [
            { name: "title", label: "Title", type: "text", required: true },
            { name: "category", label: "Category", type: "text", required: true },
            { name: "image", label: "Project Image", type: "image" },
            { name: "description", label: "Description", type: "textarea", required: true },
            { name: "projectUrl", label: "Project URL", type: "url" },
            { name: "featured", label: "Featured project", type: "checkbox" }
        ],
        columns: ["image", "title", "category", "projectUrl", "featured", "createdAt"],
        normalize: (data) => ({
            title: data.title,
            category: data.category,
            image: data.image,
            imageUrl: data.image,
            description: data.description,
            shortDescription: data.description,
            fullDescription: data.description,
            projectUrl: data.projectUrl,
            featured: data.featured
        })
    },
    team: {
        collection: "team",
        title: "Team",
        empty: "No team members have been added yet.",
        searchFields: ["name", "role", "bio", "linkedin", "twitter", "website"],
        fields: [
            { name: "name", label: "Name", type: "text", required: true },
            { name: "role", label: "Role", type: "text", required: true },
            { name: "bio", label: "Bio", type: "textarea", required: true },
            { name: "image", label: "Profile Image", type: "image" },
            { name: "linkedin", label: "LinkedIn URL", type: "url" },
            { name: "twitter", label: "Twitter URL", type: "url" },
            { name: "website", label: "Website URL", type: "url" },
            { name: "featured", label: "Featured member", type: "checkbox" }
        ],
        columns: ["image", "name", "role", "featured", "createdAt"],
        normalize: (data) => ({
            name: data.name,
            role: data.role,
            bio: data.bio,
            image: data.image,
            imageUrl: data.image,
            shortDescription: data.bio,
            fullDescription: data.bio,
            socialLinks: {
                linkedin: data.linkedin,
                twitter: data.twitter,
                website: data.website
            },
            linkedin: data.linkedin,
            twitter: data.twitter,
            website: data.website,
            featured: data.featured
        })
    },
    testimonials: {
        collection: "testimonials",
        title: "Testimonials",
        empty: "No testimonials have been submitted yet.",
        searchFields: ["clientName", "review"],
        filters: [{ key: "approved", label: "Approval", booleanLabels: { true: "Approved", false: "Pending" } }],
        fields: [
            { name: "clientName", label: "Client Name", type: "text", required: true },
            { name: "review", label: "Review", type: "textarea", required: true },
            { name: "rating", label: "Rating", type: "number", min: 1, max: 5, required: true },
            { name: "photoUrl", label: "Client Photo", type: "image" },
            { name: "approved", label: "Approved", type: "checkbox" }
        ],
        columns: ["photoUrl", "clientName", "rating", "approved", "createdAt"],
        rowActions: ["approve", "reject", "edit", "delete"],
        normalize: (data) => ({
            clientName: data.clientName,
            review: data.review,
            rating: Number(data.rating) || 5,
            photoUrl: data.photoUrl,
            approved: data.approved
        })
    },
    leads: {
        collection: "leads",
        title: "Leads",
        empty: "No leads have been submitted yet.",
        readonlyCreate: true,
        searchFields: ["name", "email", "phone", "message", "status"],
        filters: [{ key: "status", label: "Status", values: ["new", "contacted", "closed"] }],
        fields: [
            { name: "name", label: "Name", type: "text", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "phone", label: "Phone", type: "tel" },
            { name: "message", label: "Message", type: "textarea", required: true },
            { name: "status", label: "Status", type: "select", options: ["new", "contacted", "closed"], required: true }
        ],
        columns: ["name", "email", "phone", "status", "createdAt"],
        rowActions: ["status", "delete"],
        normalize: (data) => ({
            name: data.name,
            email: data.email,
            phone: data.phone,
            message: data.message,
            status: data.status || "new"
        })
    }
};

const settingsFields = [
    { name: "companyName", label: "Company Name", type: "text", required: true },
    { name: "tagline", label: "Tagline", type: "text" },
    { name: "footerText", label: "Footer Text", type: "text" },
    { name: "ctaText", label: "CTA Supporting Text", type: "text" },
    { name: "copyrightText", label: "Copyright Text", type: "text" },
    { name: "email", label: "Contact Email", type: "email" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "address", label: "Address", type: "textarea" },
    { name: "linkedin", label: "LinkedIn URL", type: "url" },
    { name: "twitter", label: "Twitter URL", type: "url" },
    { name: "instagram", label: "Instagram URL", type: "url" },
    { name: "logoUrl", label: "Navbar Logo", type: "image" },
    { name: "footerLogoUrl", label: "Footer Logo", type: "image" },
    { name: "ogImageUrl", label: "Open Graph Image", type: "image" },
    { name: "seoTitle", label: "SEO Title", type: "text" },
    { name: "seoDescription", label: "SEO Description", type: "textarea" }
];

const getRedirectTarget = () => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    return ALLOWED_REDIRECTS.has(redirect) ? redirect : ADMIN_HOME;
};

const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatLabel = (value) => String(value || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());

const formatDate = (value) => {
    const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
        : "Not set";
};

const getValue = (record, key) => {
    if (key === "icon") return record.icon || record.iconSvg || "";
    if (key === "image") return record.image || record.imageUrl || "";
    if (key === "description") return record.description || record.shortDescription || "";
    if (key === "bio") return record.bio || record.shortDescription || "";
    if (["linkedin", "twitter", "website"].includes(key)) return record[key] || record.socialLinks?.[key] || "";
    return record[key] ?? "";
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

const normalizeWebsiteUrl = (value, label = "URL") => {
    const rawValue = String(value || "").trim();
    if (!rawValue) return "";

    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;

    try {
        const url = new URL(candidate);
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) {
            throw new Error();
        }

        return url.href;
    } catch {
        throw new Error(`${label} must be a valid website link.`);
    }
};

const getOptimizedCloudinaryUrl = (url, transform = "f_auto,q_auto,w_480,c_limit") => {
    const value = String(url || "").trim();
    if (!value.includes("res.cloudinary.com") || !value.includes("/upload/")) return value;
    if (/\/upload\/[a-z_]+,[^/]+\//i.test(value)) return value;
    return value.replace("/upload/", `/upload/${transform}/`);
};

const getServiceIconValue = (value, title = "Service icon") => {
    const iconValue = String(value || "").trim();
    if (!iconValue) return "";
    if (!isHttpUrl(iconValue)) return iconValue;

    return `<img src="${escapeHtml(getOptimizedCloudinaryUrl(iconValue, "f_auto,q_auto,w_96,h_96,c_fit"))}" alt="${escapeHtml(title)}" loading="lazy">`;
};

const getImagePreviewHtml = (value) => {
    if (!isHttpUrl(value)) return "";

    return `
        <div class="admin-upload-preview" data-upload-preview>
            <a href="${escapeHtml(value)}" target="_blank" rel="noopener" aria-label="Open uploaded image">
                <img src="${escapeHtml(getOptimizedCloudinaryUrl(value, "f_auto,q_auto,w_360,h_240,c_fit"))}" alt="">
            </a>
        </div>
    `;
};

const getAuthErrorMessage = (error) => {
    const code = error?.code || "";

    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
        return "The email or password is incorrect.";
    }

    if (code.includes("too-many-requests")) return "Too many attempts. Please wait a moment and try again.";
    if (code.includes("invalid-email")) return "Enter a valid admin email address.";
    if (code.includes("network-request-failed")) return "Network error. Check your connection and try again.";
    if (code.includes("permission-denied")) return "Firebase rejected this action. Check Firestore rules.";
    if (code.includes("unauthorized-admin")) return "This account is not authorized for admin access.";

    if (error?.message) return error.message;

    return "Unable to complete the action. Please try again.";
};

const setButtonLoading = (button, isLoading, loadingText = "Working...") => {
    if (!button) return;

    if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent.trim();
    button.disabled = isLoading;
    button.setAttribute("aria-busy", String(isLoading));
    button.classList.toggle("is-loading", isLoading);
    button.textContent = isLoading ? loadingText : button.dataset.defaultText;
};

const setFormControlsDisabled = (form, isDisabled, exceptions = []) => {
    if (!form) return;

    const exceptionSet = new Set(exceptions.filter(Boolean));
    form.querySelectorAll("input, textarea, select, button").forEach((control) => {
        if (exceptionSet.has(control)) return;
        control.disabled = isDisabled;
    });
};

const setStatus = (element, message = "", statusState = "error") => {
    if (!element) return;

    element.textContent = message;
    element.dataset.state = statusState;
    element.hidden = !message;
};

const showToast = (message, type = "success") => {
    const region = document.querySelector("[data-toast-region]");
    if (!region) return;

    const toast = document.createElement("div");
    toast.className = `admin-toast admin-toast-${type}`;
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
};

const hydrateAdminIdentity = (user) => {
    document.querySelectorAll("[data-admin-email]").forEach((element) => {
        element.textContent = user?.email || "Admin";
    });
};

const initPasswordToggle = () => {
    const toggle = document.querySelector("[data-password-toggle]");
    const passwordInput = document.querySelector("#admin-password");

    if (!toggle || !passwordInput) return;

    toggle.addEventListener("click", () => {
        const isVisible = passwordInput.type === "text";
        passwordInput.type = isVisible ? "password" : "text";
        toggle.textContent = isVisible ? "Show" : "Hide";
        toggle.setAttribute("aria-pressed", String(!isVisible));
        passwordInput.focus();
    });
};

const initLoginPage = () => {
    const form = document.querySelector("[data-admin-login-form]");
    const status = document.querySelector("[data-auth-status]");
    const submitButton = form?.querySelector("button[type='submit']");

    initPasswordToggle();

    const params = new URLSearchParams(window.location.search);
    if (params.get("authError") === "unauthorized") {
        setStatus(status, "This account is not authorized for admin access.");
    }

    const unsubscribe = observeAdminAuth(async (user) => {
        if (!user) return;

        try {
            setStatus(status, "Verifying admin access...", "info");
            const hasAdminAccess = await isAdminUser(user.uid);

            if (hasAdminAccess) {
                unsubscribe();
                window.location.replace(getRedirectTarget());
                return;
            }

            await logoutAdmin();
            setStatus(status, "This account is not authorized for admin access.");
        } catch (error) {
            await logoutAdmin().catch(() => {});
            setStatus(status, getAuthErrorMessage(error));
        }
    }, (error) => setStatus(status, getAuthErrorMessage(error)));

    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setStatus(status);
        setButtonLoading(submitButton, true, "Signing in...");

        const formData = new FormData(form);

        try {
            await loginAdmin(formData.get("email"), formData.get("password"));
            window.location.replace(getRedirectTarget());
        } catch (error) {
            setStatus(status, getAuthErrorMessage(error));
            setButtonLoading(submitButton, false);
        }
    });
};

const initLogout = () => {
    document.querySelectorAll("[data-admin-logout]").forEach((button) => {
        if (button.dataset.bound === "true") return;
        button.dataset.bound = "true";

        button.addEventListener("click", async () => {
            setButtonLoading(button, true, "Signing out...");

            try {
                await logoutAdmin();
                window.location.replace(LOGIN_PAGE);
            } catch (error) {
                showToast(getAuthErrorMessage(error), "error");
                setButtonLoading(button, false);
            }
        });
    });
};

const initActiveNav = () => {
    const page = document.body.dataset.adminPage;

    document.querySelectorAll(".admin-nav a").forEach((link) => {
        const href = link.getAttribute("href") || "";
        link.classList.toggle("is-active", href.includes(`${page}.html`));
    });
};

const renderLoading = (target, label = "Loading records...") => {
    target.innerHTML = `
        <div class="admin-loading" role="status">
            <span class="admin-spinner"></span>
            <span>${escapeHtml(label)}</span>
        </div>
    `;
};

const getUploadFieldHtml = (field, value) => {
    const hasImage = isHttpUrl(value);

    return `
        <div class="admin-field admin-upload-field" data-upload-field="${escapeHtml(field.name)}">
            <span>${escapeHtml(field.label)}</span>
            <input id="field-${field.name}" name="${field.name}" type="hidden" value="${escapeHtml(value)}" ${field.required ? "required" : ""}>
            <div class="admin-upload-dropzone" data-upload-dropzone tabindex="0" role="button" aria-label="Upload ${escapeHtml(field.label)}">
                <div class="admin-upload-copy">
                    <strong>${hasImage ? "Replace image" : "Upload image"}</strong>
                    <small>Drop an image here or choose jpg, png, webp, or svg.</small>
                </div>
                <button class="admin-btn admin-btn-secondary admin-upload-trigger" type="button" data-upload-trigger>Choose Image</button>
                <input class="admin-upload-input" type="file" accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml" data-upload-input>
            </div>
            <div class="admin-upload-progress" data-upload-progress hidden>
                <span class="admin-spinner"></span>
                <span>Uploading to Cloudinary...</span>
            </div>
            ${getImagePreviewHtml(value)}
            <div class="admin-upload-actions" ${hasImage ? "" : "hidden"} data-upload-actions>
                <button class="admin-icon-btn" type="button" data-upload-replace>Replace</button>
                <button class="admin-icon-btn admin-danger-link" type="button" data-upload-remove>Remove</button>
            </div>
        </div>
    `;
};

const getFieldHtml = (field, record = {}) => {
    const value = getValue(record, field.name);
    const required = field.required ? "required" : "";
    const common = `id="field-${field.name}" name="${field.name}" ${required}`;

    if (field.type === "image") {
        return getUploadFieldHtml(field, value);
    }

    if (field.type === "textarea") {
        return `
            <label class="admin-field" for="field-${field.name}">
                <span>${escapeHtml(field.label)}</span>
                <textarea ${common} rows="4">${escapeHtml(value)}</textarea>
            </label>
        `;
    }

    if (field.type === "checkbox") {
        return `
            <label class="admin-check-field">
                <input type="checkbox" name="${field.name}" ${value ? "checked" : ""}>
                <span>${escapeHtml(field.label)}</span>
            </label>
        `;
    }

    if (field.type === "select") {
        const options = field.options.map((option) => `
            <option value="${escapeHtml(option)}" ${String(value) === option ? "selected" : ""}>${escapeHtml(formatLabel(option))}</option>
        `).join("");

        return `
            <label class="admin-field" for="field-${field.name}">
                <span>${escapeHtml(field.label)}</span>
                <select ${common}>${options}</select>
            </label>
        `;
    }

    return `
        <label class="admin-field" for="field-${field.name}">
            <span>${escapeHtml(field.label)}</span>
            <input ${common} type="${field.type === "url" ? "text" : field.type}" value="${escapeHtml(value)}" ${field.min ? `min="${field.min}"` : ""} ${field.max ? `max="${field.max}"` : ""} ${field.type === "url" ? "inputmode=\"url\" autocomplete=\"url\"" : ""}>
        </label>
    `;
};

const readFormData = (form, fields) => {
    const formData = new FormData(form);

    return fields.reduce((data, field) => {
        if (field.type === "checkbox") {
            data[field.name] = formData.has(field.name);
            return data;
        }

        const rawValue = String(formData.get(field.name) || "").trim();
        if (field.type === "url") {
            data[field.name] = normalizeWebsiteUrl(rawValue, field.label);
        } else {
            data[field.name] = field.type === "number" ? Number(rawValue) : rawValue;
        }
        return data;
    }, {});
};

const getUploadField = (target) => target.closest("[data-upload-field]");

const setUploadLoading = (field, isLoading) => {
    if (!field) return;
    field.dataset.uploading = isLoading ? "true" : "false";
    const progress = field.querySelector("[data-upload-progress]");
    if (progress) progress.hidden = !isLoading;
    field.querySelectorAll("button, [data-upload-input]").forEach((control) => {
        control.disabled = isLoading;
        control.setAttribute("aria-busy", String(isLoading));
    });
    field.querySelector("[data-upload-dropzone]")?.classList.toggle("is-uploading", isLoading);
};

const setUploadValue = (field, value) => {
    if (!field) return;
    const input = field.querySelector("input[type='hidden']");
    const actions = field.querySelector("[data-upload-actions]");
    const previousPreview = field.querySelector("[data-upload-preview]");
    const progress = field.querySelector("[data-upload-progress]");
    const safeValue = String(value || "").trim();

    if (input) input.value = safeValue;
    previousPreview?.remove();

    if (safeValue && isHttpUrl(safeValue) && progress) {
        progress.insertAdjacentHTML("afterend", getImagePreviewHtml(safeValue));
    }

    if (actions) actions.hidden = !isHttpUrl(safeValue);
};

const uploadImageToCloudinary = async (file) => {
    if (!file) return "";

    const extension = file.name.split(".").pop()?.toLowerCase();
    const isAllowedExtension = ["jpg", "jpeg", "png", "webp", "svg"].includes(extension);

    if (!ALLOWED_IMAGE_TYPES.has(file.type) && !isAllowedExtension) {
        throw new Error("Upload a jpg, png, webp, or svg image.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", CLOUDINARY_FOLDER);

    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: "POST",
        body: formData
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.secure_url) {
        throw new Error(result.error?.message || "Cloudinary upload failed.");
    }

    return result.secure_url;
};

const handleImageUpload = async (field, file) => {
    if (!field || !file || field.dataset.uploading === "true") return;

    const uploadToken = `${Date.now()}-${Math.random()}`;
    field.dataset.uploadToken = uploadToken;
    setUploadLoading(field, true);

    try {
        const secureUrl = await uploadImageToCloudinary(file);
        if (field.dataset.uploadToken !== uploadToken) return;
        setUploadValue(field, secureUrl);
        showToast("Image uploaded successfully.");
    } catch (error) {
        showToast(getAuthErrorMessage(error), "error");
    } finally {
        const fileInput = field.querySelector("[data-upload-input]");
        if (fileInput) fileInput.value = "";
        if (field.dataset.uploadToken === uploadToken) {
            delete field.dataset.uploadToken;
            setUploadLoading(field, false);
        }
        document.dispatchEvent(new CustomEvent("admin-upload-settled"));
    }
};

const initUploadEvents = () => {
    if (document.documentElement.dataset.uploadEventsBound === "true") return;
    document.documentElement.dataset.uploadEventsBound = "true";

    document.addEventListener("click", (event) => {
        const trigger = event.target.closest("[data-upload-trigger], [data-upload-replace]");
        if (trigger) {
            getUploadField(trigger)?.querySelector("[data-upload-input]")?.click();
            return;
        }

        const remove = event.target.closest("[data-upload-remove]");
        if (remove) {
            setUploadValue(getUploadField(remove), "");
            showToast("Image removed from this record.");
        }
    });

    document.addEventListener("change", (event) => {
        const input = event.target.closest("[data-upload-input]");
        if (!input) return;
        handleImageUpload(getUploadField(input), input.files?.[0]);
    });

    document.addEventListener("dragover", (event) => {
        const dropzone = event.target.closest("[data-upload-dropzone]");
        if (!dropzone) return;
        event.preventDefault();
        dropzone.classList.add("is-dragging");
    });

    document.addEventListener("dragleave", (event) => {
        event.target.closest("[data-upload-dropzone]")?.classList.remove("is-dragging");
    });

    document.addEventListener("drop", (event) => {
        const dropzone = event.target.closest("[data-upload-dropzone]");
        if (!dropzone) return;
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
        handleImageUpload(getUploadField(dropzone), event.dataTransfer?.files?.[0]);
    });

    document.addEventListener("keydown", (event) => {
        const dropzone = event.target.closest("[data-upload-dropzone]");
        if (!dropzone || !["Enter", " "].includes(event.key)) return;
        event.preventDefault();
        getUploadField(dropzone)?.querySelector("[data-upload-input]")?.click();
    });
};

const openEditor = (config, record = null) => {
    const modal = document.querySelector("[data-editor-modal]");
    const title = modal.querySelector("[data-modal-title]");
    const form = modal.querySelector("[data-editor-form]");

    title.textContent = record ? `Edit ${config.title}` : `Add ${config.title}`;
    form.dataset.mode = record ? "edit" : "create";
    form.dataset.recordId = record?.id || "";
    form.innerHTML = `
        <div class="admin-form-grid">
            ${config.fields.map((field) => getFieldHtml(field, record || {})).join("")}
        </div>
        <div class="admin-modal-actions">
            <button class="admin-btn admin-btn-secondary" type="button" data-close-modal>Cancel</button>
            <button class="admin-btn" type="submit">${record ? "Save Changes" : "Create Record"}</button>
        </div>
    `;
    modal.hidden = false;
    form.querySelector("input, textarea, select")?.focus();
};

const closeEditor = () => {
    const modal = document.querySelector("[data-editor-modal]");
    if (!modal) return;
    modal?.querySelectorAll("[data-upload-field]").forEach((field) => {
        delete field.dataset.uploadToken;
        setUploadLoading(field, false);
    });
    modal.hidden = true;
};

const openDeleteConfirm = (config, record) => {
    const modal = document.querySelector("[data-delete-modal]");
    state.deleteTarget = { config, record };
    modal.querySelector("[data-delete-title]").textContent = `Delete ${record.title || record.name || record.clientName || "record"}?`;
    modal.hidden = false;
};

const closeDeleteConfirm = () => {
    const modal = document.querySelector("[data-delete-modal]");
    state.deleteTarget = null;
    modal.hidden = true;
};

const renderFilters = (config) => {
    const toolbar = document.querySelector("[data-admin-toolbar]");
    if (!toolbar) return;

    const filter = config.filters?.[0];
    const filterOptions = filter
        ? getFilterOptions(filter).map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")
        : "";

    toolbar.innerHTML = `
        <div class="admin-toolbar-group">
            <input class="admin-search" type="search" placeholder="Search ${escapeHtml(config.title.toLowerCase())}" data-admin-search>
            ${filter ? `<select class="admin-filter" data-admin-filter="${escapeHtml(filter.key)}"><option value="">All ${escapeHtml(filter.label)}</option>${filterOptions}</select>` : ""}
        </div>
        ${config.readonlyCreate ? "" : `<button class="admin-btn" type="button" data-add-record>Add ${escapeHtml(config.title)}</button>`}
    `;
};

const getFilterOptions = (filter) => {
    if (filter.values) {
        return filter.values.map((value) => ({ value, label: formatLabel(value) }));
    }

    if (filter.booleanLabels) {
        return [
            { value: "true", label: filter.booleanLabels.true },
            { value: "false", label: filter.booleanLabels.false }
        ];
    }

    const uniqueValues = [...new Set(state.records.map((record) => record[filter.key]).filter(Boolean))];
    return uniqueValues.sort().map((value) => ({ value, label: value }));
};

const applyFilters = (config) => {
    const search = document.querySelector("[data-admin-search]")?.value.trim().toLowerCase() || "";
    const filterElement = document.querySelector("[data-admin-filter]");
    const filterKey = filterElement?.dataset.adminFilter;
    const filterValue = filterElement?.value || "";

    state.filteredRecords = state.records.filter((record) => {
        const matchesSearch = !search || config.searchFields.some((field) => {
            const value = getValue(record, field);
            return String(value).toLowerCase().includes(search);
        });

        if (!matchesSearch) return false;
        if (!filterKey || !filterValue) return true;

        return String(record[filterKey]) === filterValue;
    });

    renderTable(config);
};

const sortRecords = (records) => [...records].sort((first, second) => {
    const firstDate = first.createdAt?.toMillis?.() || 0;
    const secondDate = second.createdAt?.toMillis?.() || 0;
    return secondDate - firstDate;
});

const renderCell = (record, key) => {
    const value = getValue(record, key);
    const imageColumns = new Set(["image", "imageUrl", "icon", "photoUrl", "logoUrl", "footerLogoUrl", "ogImageUrl"]);

    if (key === "createdAt") return formatDate(record.createdAt);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (key === "status") return `<span class="admin-pill admin-pill-${escapeHtml(value || "new")}">${escapeHtml(formatLabel(value || "new"))}</span>`;
    if (key === "approved") return `<span class="admin-pill ${value ? "admin-pill-closed" : "admin-pill-new"}">${value ? "Approved" : "Pending"}</span>`;
    if (imageColumns.has(key) && isHttpUrl(value)) {
        return `
            <a class="admin-image-cell" href="${escapeHtml(value)}" target="_blank" rel="noopener">
                <img src="${escapeHtml(getOptimizedCloudinaryUrl(value, "f_auto,q_auto,w_180,h_120,c_fit"))}" alt="">
            </a>
        `;
    }
    if (String(value).startsWith("http")) return `<a class="admin-link" href="${escapeHtml(value)}" target="_blank" rel="noopener">Open</a>`;

    return escapeHtml(value || "Not set");
};

const renderRowActions = (config, record) => {
    const actions = config.rowActions || ["edit", "delete"];

    return actions.map((action) => {
        if (action === "approve" && !record.approved) {
            return `<button class="admin-icon-btn" type="button" data-action="approve" data-id="${record.id}">Approve</button>`;
        }

        if (action === "reject" && record.approved) {
            return `<button class="admin-icon-btn" type="button" data-action="reject" data-id="${record.id}">Reject</button>`;
        }

        if (action === "status") {
            return `
                <select class="admin-row-select" data-action="status" data-id="${record.id}" data-previous-value="${escapeHtml(record.status || "new")}">
                    ${["new", "contacted", "closed"].map((status) => `<option value="${status}" ${record.status === status ? "selected" : ""}>${formatLabel(status)}</option>`).join("")}
                </select>
            `;
        }

        if (action === "edit") return `<button class="admin-icon-btn" type="button" data-action="edit" data-id="${record.id}">Edit</button>`;
        if (action === "delete") return `<button class="admin-icon-btn admin-danger-link" type="button" data-action="delete" data-id="${record.id}">Delete</button>`;
        return "";
    }).join("");
};

const renderTable = (config) => {
    const target = document.querySelector("[data-admin-table]");
    if (!target) return;

    if (!state.filteredRecords.length) {
        target.innerHTML = `
            <div class="admin-empty">
                <h2>No records found</h2>
                <p>${escapeHtml(config.empty)}</p>
                ${config.readonlyCreate ? "" : `<button class="admin-btn" type="button" data-add-record>Add ${escapeHtml(config.title)}</button>`}
            </div>
        `;
        return;
    }

    target.innerHTML = `
        <div class="admin-table-wrap">
            <table class="admin-table">
                <thead>
                    <tr>
                        ${config.columns.map((column) => `<th>${escapeHtml(formatLabel(column))}</th>`).join("")}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${state.filteredRecords.map((record) => `
                        <tr>
                            ${config.columns.map((column) => `<td>${renderCell(record, column)}</td>`).join("")}
                            <td><div class="admin-row-actions">${renderRowActions(config, record)}</div></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
};

const runGuardedAction = async (key, control, loadingText, action) => {
    if (state.pendingActions.has(key)) return;

    state.pendingActions.add(key);
    setButtonLoading(control, true, loadingText);

    try {
        await action();
    } catch (error) {
        showToast(getAuthErrorMessage(error), "error");
    } finally {
        state.pendingActions.delete(key);
        setButtonLoading(control, false);
    }
};

const handleAdminClick = (event) => {
    const addButton = event.target.closest("[data-add-record]");
    if (addButton) {
        if (state.currentConfig) openEditor(state.currentConfig);
        return;
    }

    const closeButton = event.target.closest("[data-close-modal]");
    if (closeButton) {
        closeEditor();
        closeDeleteConfirm();
        return;
    }

    const deleteConfirm = event.target.closest("[data-confirm-delete]");
    if (deleteConfirm) {
        const target = state.deleteTarget;
        if (!target) return;

        runGuardedAction(
            `delete:${target.config.collection}:${target.record.id}`,
            deleteConfirm,
            "Deleting...",
            async () => {
                await deleteRecord(target.config.collection, target.record.id);
                showToast("Record deleted.");
                closeDeleteConfirm();
            }
        );
        return;
    }

    const actionButton = event.target.closest("button[data-action]");
    const config = state.currentConfig;
    if (!actionButton || !config) return;

    const record = state.records.find((item) => item.id === actionButton.dataset.id);
    if (!record) return;

    const action = actionButton.dataset.action;
    if (action === "edit") {
        openEditor(config, record);
        return;
    }

    if (action === "delete") {
        openDeleteConfirm(config, record);
        return;
    }

    if (action === "approve" || action === "reject") {
        const approved = action === "approve";
        runGuardedAction(
            `${action}:${config.collection}:${record.id}`,
            actionButton,
            approved ? "Approving..." : "Moving...",
            async () => {
                await updateRecord(config.collection, record.id, { approved });
                showToast(approved ? "Testimonial approved." : "Testimonial moved to pending.");
            }
        );
    }
};

const handleAdminChange = async (event) => {
    const statusSelect = event.target.closest("select[data-action='status']");
    const config = state.currentConfig;
    if (!statusSelect || !config) return;

    const previousValue = statusSelect.dataset.previousValue || "";
    const nextValue = statusSelect.value;
    const key = `status:${config.collection}:${statusSelect.dataset.id}`;
    if (state.pendingActions.has(key)) return;

    state.pendingActions.add(key);
    statusSelect.disabled = true;
    statusSelect.setAttribute("aria-busy", "true");

    try {
        await updateRecord(config.collection, statusSelect.dataset.id, { status: nextValue });
        statusSelect.dataset.previousValue = nextValue;
        showToast("Lead status updated.");
    } catch (error) {
        if (previousValue) statusSelect.value = previousValue;
        showToast(getAuthErrorMessage(error), "error");
    } finally {
        state.pendingActions.delete(key);
        statusSelect.disabled = false;
        statusSelect.setAttribute("aria-busy", "false");
    }
};

const handleEditorSubmit = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const config = state.currentConfig;
    const submitButton = form.querySelector("button[type='submit']");
    if (!config || form.dataset.submitting === "true") return;

    form.dataset.submitting = "true";
    setButtonLoading(submitButton, true, "Saving...");

    try {
        if (form.querySelector("[data-uploading='true']")) {
            throw new Error("Please wait for image uploads to finish.");
        }

        const mode = form.dataset.mode;
        const recordId = form.dataset.recordId;
        const payload = config.normalize(readFormData(form, config.fields));

        setFormControlsDisabled(form, true, [submitButton]);

        if (mode === "edit") {
            await updateRecord(config.collection, recordId, payload);
            showToast(`${config.title} updated.`);
        } else {
            await createRecord(config.collection, payload);
            showToast(`${config.title} created.`);
        }

        closeEditor();
    } catch (error) {
        showToast(getAuthErrorMessage(error), "error");
    } finally {
        form.dataset.submitting = "false";
        setFormControlsDisabled(form, false);
        setButtonLoading(submitButton, false);
    }
};

const bindCrudEvents = () => {
    if (state.eventsBound) return;
    state.eventsBound = true;

    document.addEventListener("click", handleAdminClick);
    document.addEventListener("change", handleAdminChange);
    document.querySelector("[data-editor-form]")?.addEventListener("submit", handleEditorSubmit);
};

const initCollectionPage = (pageType) => {
    const config = collectionConfigs[pageType];
    const target = document.querySelector("[data-admin-table]");

    if (!config || !target) return;

    state.currentConfig = config;
    renderLoading(target);
    renderFilters(config);
    bindCrudEvents();

    document.querySelector("[data-admin-toolbar]")?.addEventListener("input", () => applyFilters(config));
    document.querySelector("[data-admin-toolbar]")?.addEventListener("change", () => applyFilters(config));

    state.unsubscribe = listenToCollection(
        config.collection,
        (records) => {
            state.records = sortRecords(records);
            renderFilters(config);
            state.filteredRecords = state.records;
            renderTable(config);
        },
        (error) => {
            target.innerHTML = `<div class="admin-empty"><h2>Unable to load records</h2><p>${escapeHtml(getAuthErrorMessage(error))}</p></div>`;
        }
    );
};

const initSettingsPage = () => {
    const form = document.querySelector("[data-settings-form]");
    if (!form) return;

    const renderSettingsForm = (settings) => {
        form.innerHTML = `
            <div class="admin-form-grid">
                ${settingsFields.map((field) => getFieldHtml(field, settings)).join("")}
            </div>
            <div class="admin-modal-actions">
                <button class="admin-btn" type="submit">Save Settings</button>
            </div>
        `;
    };

    renderLoading(form, "Loading settings...");

    const unsubscribe = listenToGlobalSettings(
        (settings) => {
            if (form.dataset.submitting === "true" || form.querySelector("[data-uploading='true']")) {
                state.queuedSettings = settings;
                return;
            }

            state.queuedSettings = null;
            renderSettingsForm(settings);
        },
        (error) => {
            form.innerHTML = `<div class="admin-empty"><h2>Unable to load settings</h2><p>${escapeHtml(getAuthErrorMessage(error))}</p></div>`;
        }
    );

    state.unsubscribe = unsubscribe;

    document.addEventListener("admin-upload-settled", () => {
        if (form.dataset.submitting === "true" || form.querySelector("[data-uploading='true']") || !state.queuedSettings) {
            return;
        }

        const settings = state.queuedSettings;
        state.queuedSettings = null;
        renderSettingsForm(settings);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type='submit']");
        if (form.dataset.submitting === "true") return;

        form.dataset.submitting = "true";
        setButtonLoading(button, true, "Saving...");

        try {
            if (form.querySelector("[data-uploading='true']")) {
                throw new Error("Please wait for image uploads to finish.");
            }

            const payload = readFormData(form, settingsFields);

            payload.socialLinks = {
                linkedin: payload.linkedin,
                twitter: payload.twitter,
                instagram: payload.instagram
            };

            setFormControlsDisabled(form, true, [button]);
            await saveGlobalSettings(payload);
            showToast("Settings saved.");
        } catch (error) {
            showToast(getAuthErrorMessage(error), "error");
        } finally {
            form.dataset.submitting = "false";
            setFormControlsDisabled(form, false);
            setButtonLoading(button, false);
            if (state.queuedSettings) {
                const settings = state.queuedSettings;
                state.queuedSettings = null;
                renderSettingsForm(settings);
            }
        }
    });
};

const initDashboard = () => {
    const cards = document.querySelector("[data-dashboard-stats]");
    if (!cards) return;

    const collections = ["services", "portfolio", "team", "testimonials", "leads"];
    const counts = {};
    const unsubscribers = collections.map((collectionName) => listenToCollection(
        collectionName,
        (records) => {
            counts[collectionName] = records.length;
            cards.innerHTML = collections.map((name) => `
                <article class="admin-card">
                    <h2>${escapeHtml(formatLabel(name))}</h2>
                    <p>Realtime records in Firestore.</p>
                    <span class="admin-stat">${counts[name] ?? "..."}</span>
                </article>
            `).join("");
        },
        (error) => showToast(`${formatLabel(collectionName)}: ${getAuthErrorMessage(error)}`, "error")
    ));

    state.unsubscribe = () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};

const initProtectedPage = async () => {
    document.documentElement.classList.add("auth-checking");

    try {
        const user = await requireAdminAccess({ redirectTo: LOGIN_PAGE });
        if (!user) return;

        hydrateAdminIdentity(user);
        initLogout();
        initActiveNav();
        initUploadEvents();
        document.documentElement.classList.remove("auth-checking");
        document.documentElement.classList.add("auth-ready");

        const pageType = document.body.dataset.adminPage;
        if (pageType === "dashboard") initDashboard();
        if (pageType === "settings") initSettingsPage();
        if (collectionConfigs[pageType]) initCollectionPage(pageType);
    } catch (error) {
        window.location.replace(LOGIN_PAGE);
    }
};

window.addEventListener("beforeunload", () => {
    if (typeof state.unsubscribe === "function") state.unsubscribe();
});

document.addEventListener("DOMContentLoaded", () => {
    const pageType = document.body.dataset.adminPage;

    if (pageType === "login") {
        initLoginPage();
        return;
    }

    if (document.body.dataset.adminProtected === "true") {
        initProtectedPage();
    }
});

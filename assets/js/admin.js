import {
    loginAdmin,
    logoutAdmin,
    observeAdminAuth,
    requireAdminSession
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
    currentConfig: null
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
            { name: "icon", label: "Icon or SVG", type: "textarea" },
            { name: "featured", label: "Featured service", type: "checkbox" }
        ],
        columns: ["title", "description", "featured", "createdAt"],
        normalize: (data) => ({
            title: data.title,
            description: data.description,
            icon: data.icon,
            iconSvg: data.icon,
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
            { name: "image", label: "Image URL", type: "url" },
            { name: "description", label: "Description", type: "textarea", required: true },
            { name: "projectUrl", label: "Project URL", type: "url" },
            { name: "featured", label: "Featured project", type: "checkbox" }
        ],
        columns: ["title", "category", "projectUrl", "featured", "createdAt"],
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
            { name: "image", label: "Profile Image URL", type: "url" },
            { name: "linkedin", label: "LinkedIn URL", type: "url" },
            { name: "twitter", label: "Twitter URL", type: "url" },
            { name: "website", label: "Website URL", type: "url" },
            { name: "featured", label: "Featured member", type: "checkbox" }
        ],
        columns: ["name", "role", "featured", "createdAt"],
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
            { name: "photoUrl", label: "Photo URL", type: "url" },
            { name: "approved", label: "Approved", type: "checkbox" }
        ],
        columns: ["clientName", "rating", "approved", "createdAt"],
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
    { name: "logoUrl", label: "Navbar Logo URL", type: "url" },
    { name: "footerLogoUrl", label: "Footer Logo URL", type: "url" },
    { name: "ogImageUrl", label: "Open Graph Image URL", type: "url" },
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
    if (key === "image") return record.image || record.imageUrl || "";
    if (key === "description") return record.description || record.shortDescription || "";
    if (key === "bio") return record.bio || record.shortDescription || "";
    if (["linkedin", "twitter", "website"].includes(key)) return record[key] || record.socialLinks?.[key] || "";
    return record[key] ?? "";
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

    return "Unable to complete the action. Please try again.";
};

const setButtonLoading = (button, isLoading, loadingText = "Working...") => {
    if (!button) return;

    if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent.trim();
    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);
    button.textContent = isLoading ? loadingText : button.dataset.defaultText;
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

    const unsubscribe = observeAdminAuth((user) => {
        if (user) {
            unsubscribe();
            window.location.replace(getRedirectTarget());
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

const getFieldHtml = (field, record = {}) => {
    const value = getValue(record, field.name);
    const required = field.required ? "required" : "";
    const common = `id="field-${field.name}" name="${field.name}" ${required}`;

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
            <input ${common} type="${field.type}" value="${escapeHtml(value)}" ${field.min ? `min="${field.min}"` : ""} ${field.max ? `max="${field.max}"` : ""}>
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
        data[field.name] = field.type === "number" ? Number(rawValue) : rawValue;
        return data;
    }, {});
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

    if (key === "createdAt") return formatDate(record.createdAt);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (key === "status") return `<span class="admin-pill admin-pill-${escapeHtml(value || "new")}">${escapeHtml(formatLabel(value || "new"))}</span>`;
    if (key === "approved") return `<span class="admin-pill ${value ? "admin-pill-closed" : "admin-pill-new"}">${value ? "Approved" : "Pending"}</span>`;
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
                <select class="admin-row-select" data-action="status" data-id="${record.id}">
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

const bindCrudEvents = (config) => {
    document.addEventListener("click", (event) => {
        const addButton = event.target.closest("[data-add-record]");
        if (addButton) openEditor(config);

        const closeButton = event.target.closest("[data-close-modal]");
        if (closeButton) {
            closeEditor();
            closeDeleteConfirm();
        }

        const actionButton = event.target.closest("[data-action]");
        if (!actionButton) return;

        const record = state.records.find((item) => item.id === actionButton.dataset.id);
        if (!record) return;

        const action = actionButton.dataset.action;
        if (action === "edit") openEditor(config, record);
        if (action === "delete") openDeleteConfirm(config, record);
        if (action === "approve") {
            updateRecord(config.collection, record.id, { approved: true })
                .then(() => showToast("Testimonial approved."))
                .catch((error) => showToast(getAuthErrorMessage(error), "error"));
        }

        if (action === "reject") {
            updateRecord(config.collection, record.id, { approved: false })
                .then(() => showToast("Testimonial moved to pending."))
                .catch((error) => showToast(getAuthErrorMessage(error), "error"));
        }
    });

    document.addEventListener("change", async (event) => {
        const statusSelect = event.target.closest("[data-action='status']");
        if (!statusSelect) return;

        try {
            await updateRecord(config.collection, statusSelect.dataset.id, { status: statusSelect.value });
            showToast("Lead status updated.");
        } catch (error) {
            showToast(getAuthErrorMessage(error), "error");
        }
    });

    document.querySelector("[data-editor-form]")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const submitButton = form.querySelector("button[type='submit']");
        const mode = form.dataset.mode;
        const recordId = form.dataset.recordId;
        const payload = config.normalize(readFormData(form, config.fields));

        setButtonLoading(submitButton, true, "Saving...");

        try {
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
            setButtonLoading(submitButton, false);
        }
    });

    document.querySelector("[data-confirm-delete]")?.addEventListener("click", async (event) => {
        if (!state.deleteTarget) return;

        setButtonLoading(event.currentTarget, true, "Deleting...");

        try {
            await deleteRecord(state.deleteTarget.config.collection, state.deleteTarget.record.id);
            showToast("Record deleted.");
            closeDeleteConfirm();
        } catch (error) {
            showToast(getAuthErrorMessage(error), "error");
        } finally {
            setButtonLoading(event.currentTarget, false);
        }
    });
};

const initCollectionPage = (pageType) => {
    const config = collectionConfigs[pageType];
    const target = document.querySelector("[data-admin-table]");

    if (!config || !target) return;

    state.currentConfig = config;
    renderLoading(target);
    renderFilters(config);
    bindCrudEvents(config);

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

    renderLoading(form, "Loading settings...");

    const unsubscribe = listenToGlobalSettings(
        (settings) => {
            form.innerHTML = `
                <div class="admin-form-grid">
                    ${settingsFields.map((field) => getFieldHtml(field, settings)).join("")}
                </div>
                <div class="admin-modal-actions">
                    <button class="admin-btn" type="submit">Save Settings</button>
                </div>
            `;
        },
        (error) => {
            form.innerHTML = `<div class="admin-empty"><h2>Unable to load settings</h2><p>${escapeHtml(getAuthErrorMessage(error))}</p></div>`;
        }
    );

    state.unsubscribe = unsubscribe;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type='submit']");
        const payload = readFormData(form, settingsFields);

        payload.socialLinks = {
            linkedin: payload.linkedin,
            twitter: payload.twitter,
            instagram: payload.instagram
        };

        setButtonLoading(button, true, "Saving...");

        try {
            await saveGlobalSettings(payload);
            showToast("Settings saved.");
        } catch (error) {
            showToast(getAuthErrorMessage(error), "error");
        } finally {
            setButtonLoading(button, false);
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
        const user = await requireAdminSession({ redirectTo: LOGIN_PAGE });
        if (!user) return;

        hydrateAdminIdentity(user);
        initLogout();
        initActiveNav();
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

/**
 * Main Javascript for Navron Labs
 * Handles global UI interactions & Firebase Data Fetching
 */

import { fetchServices, fetchPortfolio, fetchTeamMembers, listenToGlobalSettings, fetchTestimonials, submitLeadForm, submitTestimonial } from '../../firebase/firestore.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile Menu Toggle
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            
            // Toggle hamburger icon animation
            const spans = menuToggle.querySelectorAll('span');
            if (navLinks.classList.contains('active')) {
                spans[0].style.transform = 'translateY(7px) rotate(45deg)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    }

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }, { passive: true });
    }

    // Scroll Reveal Animation System
    const revealOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    window.applyScrollReveal = (elements) => {
        if (!elements) return;
        elements.forEach(el => {
            el.classList.add('reveal');
            revealObserver.observe(el);
        });
    };

    // Apply reveal to static sections initially
    setTimeout(() => {
        window.applyScrollReveal(document.querySelectorAll('section, .process-step, .feature-item, .contact-info-card, .faq-item'));
    }, 100);

    // 2. Active Link Highlighting
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navItems = document.querySelectorAll('.nav-links a');
    navItems.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });

    // Modals Initialization
    const modal = document.getElementById('global-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalClose = document.querySelector('.modal-close');
    let previousBodyOverflow = '';

    if (modal) {
        modal.setAttribute('aria-hidden', 'true');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        if (modalTitle?.id) modal.setAttribute('aria-labelledby', modalTitle.id);
    }

    window.openModal = (title, content, options = {}) => {
        if(modal) {
            modalTitle.textContent = title;
            modalBody.innerHTML = content;
            modal.classList.toggle('modal-large', options.size === 'large');
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            previousBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            modalClose?.focus({ preventScroll: true });
        }
    };

    window.closeModal = () => {
        if(modal) {
            modal.classList.remove('active');
            modal.classList.remove('modal-large');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = previousBodyOverflow;
        }
    };

    if (modalClose) modalClose.addEventListener('click', window.closeModal);
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) window.closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal?.classList.contains('active')) {
            window.closeModal();
        }
    });

    // Portfolio Filtering logic (Global static listener that queries dynamically)
    const initPortfolioFiltering = () => {
        const filterBtns = document.querySelectorAll('.portfolio-filters .btn');
        if (filterBtns.length > 0) {
            filterBtns.forEach(btn => {
                // Ensure we don't attach multiple times
                if (!btn.hasAttribute('data-filter-bound')) {
                    btn.setAttribute('data-filter-bound', 'true');
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        filterBtns.forEach(b => {
                            b.classList.remove('btn-primary');
                            b.classList.add('btn-outline');
                        });
                        btn.classList.remove('btn-outline');
                        btn.classList.add('btn-primary');

                        const filterValue = btn.getAttribute('data-filter');
                        const portfolioCards = document.querySelectorAll('.portfolio-card');

                        portfolioCards.forEach(card => {
                            if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
                                card.style.display = 'block';
                                card.style.animation = 'none';
                                card.offsetHeight; /* trigger reflow */
                                card.style.animation = 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                            } else {
                                card.style.display = 'none';
                            }
                        });
                    });
                }
            });
        }
    };
    
    // Call immediately to bind static buttons
    initPortfolioFiltering();

    // Helper: Loading UI
    const getLoaderHTML = () => `<div style="text-align:center; padding: 3rem; width: 100%; grid-column: 1 / -1;"><p style="color: var(--color-text-muted);">Loading data...</p></div>`;
    const getEmptyHTML = (msg) => `<div style="text-align:center; padding: 3rem; width: 100%; grid-column: 1 / -1;"><p style="color: var(--color-text-muted);">${msg}</p></div>`;
    const getErrorHTML = (msg) => `<div style="text-align:center; padding: 3rem; width: 100%; grid-column: 1 / -1;"><p style="color: #9B1C1C;">${msg}</p></div>`;
    const escapeHtml = (value) => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    const getText = (...values) => {
        for (const value of values) {
            if (typeof value === 'string' && value.trim()) return value.trim();
            if (typeof value === 'number' && Number.isFinite(value)) return String(value);
            if (Array.isArray(value) && value.length) return value;
        }
        return '';
    };
    const normalizeExternalUrl = (value) => {
        const rawValue = String(value || '').trim();
        if (!rawValue) return '';
        const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;

        try {
            const url = new URL(candidate);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    };
    const getOptimizedCloudinaryUrl = (url, transform = 'f_auto,q_auto,w_1200,h_800,c_fit') => {
        const value = String(url || '').trim();
        if (!value.includes('res.cloudinary.com') || !value.includes('/upload/')) return value;
        if (/\/upload\/[a-z_]+,[^/]+\//i.test(value)) return value;
        return value.replace('/upload/', `/upload/${transform}/`);
    };
    const getListItems = (value) => {
        if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
        return String(value || '')
            .split(/[,|\n]/)
            .map(item => item.trim())
            .filter(Boolean);
    };
    const getSocialLinks = (member = {}) => ({
        linkedin: normalizeExternalUrl(member.linkedin || member.socialLinks?.linkedin),
        twitter: normalizeExternalUrl(member.twitter || member.x || member.socialLinks?.twitter || member.socialLinks?.x),
        website: normalizeExternalUrl(member.website || member.socialLinks?.website)
    });
    const getIcon = (name) => {
        const icons = {
            external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/><path d="M5 12v7h7"/></svg>',
            info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
            linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><path d="M2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>',
            twitter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 11.5 16H20L8.5 4H4z"/><path d="M4 20 20 4"/></svg>',
            website: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20"/><path d="M12 2a15.3 15.3 0 0 0 0 20"/></svg>'
        };
        return icons[name] || '';
    };
    const renderExternalButton = (url, label = 'Open Project') => url
        ? `<a href="${escapeHtml(url)}" class="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer">${getIcon('external')}<span>${escapeHtml(label)}</span></a>`
        : '';
    const renderProjectModal = (project = {}) => {
        const title = getText(project.title, 'Project Details');
        const category = getText(project.category, 'Portfolio');
        const description = getText(project.fullDescription, project.description, project.shortDescription, 'Project details are being updated.');
        const projectUrl = normalizeExternalUrl(project.projectUrl);
        const imageUrl = getText(project.imageUrl, project.image);
        const techStack = getListItems(project.techStack || project.technologies || project.stack);
        const metaItems = [
            ['Category', escapeHtml(category)],
            ['Featured', project.featured ? 'Yes' : 'No']
        ];
        if (projectUrl) metaItems.push(['Project URL', `<a href="${escapeHtml(projectUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(new URL(projectUrl).hostname)}</a>`]);

        return `
            <div class="project-modal">
                ${imageUrl ? `<div class="project-modal-image"><img src="${escapeHtml(getOptimizedCloudinaryUrl(imageUrl, 'f_auto,q_auto,w_1200,h_780,c_fit'))}" alt="${escapeHtml(title)}"></div>` : ''}
                <div class="project-modal-content">
                    <div class="project-modal-meta">
                        ${metaItems.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`).join('')}
                    </div>
                    <p>${escapeHtml(description)}</p>
                    ${techStack.length ? `<div class="tech-stack">${techStack.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
                    <div class="modal-actions">
                        ${projectUrl ? renderExternalButton(projectUrl, 'Visit Website') : ''}
                    </div>
                </div>
            </div>
        `;
    };
    const renderSocialLinks = (member = {}) => {
        const socials = getSocialLinks(member);
        const items = [
            ['linkedin', 'LinkedIn', socials.linkedin],
            ['twitter', 'Twitter/X', socials.twitter],
            ['website', 'Website', socials.website]
        ].filter(([, , url]) => url);

        if (!items.length) return '';

        return `
            <div class="team-social-links">
                ${items.map(([icon, label, url]) => `
                    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}">
                        ${getIcon(icon)}
                        <span>${escapeHtml(label)}</span>
                    </a>
                `).join('')}
            </div>
        `;
    };
    const getRatingHTML = (rating = 5) => {
        const normalizedRating = Math.max(0, Math.min(5, Number(rating) || 5));
        return Array.from({ length: 5 }, (_, index) => {
            const state = index < normalizedRating ? 'filled' : 'empty';
            return `<svg class="rating-star ${state}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        }).join('');
    };
    const SUBMISSION_COOLDOWN_MS = 45000;
    const getStoredTimestamp = (key) => {
        try {
            return Number(window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || 0);
        } catch {
            return 0;
        }
    };
    const setStoredTimestamp = (key, value) => {
        try {
            window.localStorage.setItem(key, String(value));
        } catch {
            try {
                window.sessionStorage.setItem(key, String(value));
            } catch {
                // Storage may be unavailable in private browsing; pending-state still prevents double submits.
            }
        }
    };
    const getCooldownSeconds = (key) => {
        const elapsed = Date.now() - getStoredTimestamp(key);
        const remaining = SUBMISSION_COOLDOWN_MS - elapsed;
        return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    };
    const startCooldown = (key) => setStoredTimestamp(key, Date.now());
    const hasHoneypotValue = (form) => Boolean(form.querySelector('.spam-trap input')?.value.trim());
    const setFormPending = (form, button, isPending, loadingText) => {
        if (!form || !button) return;
        if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent.trim();
        form.dataset.submitting = String(isPending);
        button.disabled = isPending;
        button.setAttribute('aria-busy', String(isPending));
        button.textContent = isPending ? loadingText : button.dataset.defaultText;
    };
    const isValidEmail = (email) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/i.test(email)
        && email.length <= 160
        && !email.includes('..');
    const normalizeOptionalUrl = (value) => {
        const rawValue = String(value || '').trim();
        if (!rawValue) return '';
        if (rawValue.length > 1000) throw new Error('Photo URL is too long.');

        const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;
        const url = new URL(candidate);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
            throw new Error('Enter a valid photo URL.');
        }

        return url.href;
    };
    const getSubmissionErrorMessage = (error, fallback) => {
        const code = error?.code || '';
        if (code.includes('permission-denied')) return 'This submission was rejected. Please check the fields and try again.';
        if (code.includes('unavailable') || code.includes('deadline-exceeded') || code.includes('network-request-failed')) {
            return 'Network trouble. Please check your connection and try again shortly.';
        }
        if (error?.message) return error.message;
        return fallback;
    };
    const validateLeadInput = ({ name, email, phone, subject, message }) => {
        if (!name || !email || !phone || !subject || !message) return 'Please fill out all required fields.';
        if (name.length < 2 || name.length > 120) return 'Name must be between 2 and 120 characters.';
        if (!isValidEmail(email)) return 'Please enter a valid email address.';
        const normalizedPhone = phone.replace(/[\s()+-]/g, '');
        if (!/^\d{7,15}$/.test(normalizedPhone)) return 'Please enter a valid phone number.';
        if (subject.length < 2 || subject.length > 160) return 'Subject must be between 2 and 160 characters.';
        if (message.length < 10) return 'Message must be at least 10 characters.';
        if (message.length > 3000) return 'Message must be 3000 characters or fewer.';
        return '';
    };
    const validateTestimonialInput = ({ clientName, rating, photoUrl, review }) => {
        if (!clientName || !rating || !review) return 'Please fill out all required fields.';
        if (clientName.length < 2 || clientName.length > 120) return 'Name must be between 2 and 120 characters.';
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return 'Rating must be between 1 and 5.';
        if (review.length < 10) return 'Review must be at least 10 characters.';
        if (review.length > 2000) return 'Review must be 2000 characters or fewer.';
        if (photoUrl.length > 1000) return 'Photo URL is too long.';
        return '';
    };
    const renderServiceIcon = (service) => {
        const icon = String(service.iconSvg || service.icon || '').trim();
        const fallback = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';

        if (!icon) return fallback;
        if (/^https?:\/\//i.test(icon)) {
            return `<img src="${escapeHtml(getOptimizedCloudinaryUrl(icon, 'f_auto,q_auto,w_96,h_96,c_fit'))}" alt="${escapeHtml(getText(service.title, 'Service icon'))}" loading="lazy" style="width:38px; height:38px; object-fit:contain;">`;
        }

        return icon;
    };

    // Global settings binding: one realtime listener, cached in firebase/firestore.js
    const getSetting = (settings, ...keys) => {
        for (const key of keys) {
            const value = key.split('.').reduce((source, part) => source?.[part], settings);
            if (typeof value === 'string' && value.trim()) return value.trim();
        }

        return '';
    };

    const setText = (selector, value) => {
        if (!value) return;
        document.querySelectorAll(selector).forEach(el => {
            el.textContent = value;
        });
    };

    const updateMeta = (selector, value) => {
        if (!value) return;
        document.querySelectorAll(selector).forEach(el => {
            el.setAttribute('content', value);
        });
    };

    const setLinkedLine = (selector, label, value, href) => {
        if (!value) return;
        document.querySelectorAll(selector).forEach(el => {
            const parent = el.closest('p');
            const link = document.createElement('a');
            link.href = href;
            link.textContent = value;
            link.className = el.className;

            if (parent) {
                parent.textContent = `${label}: `;
                parent.append(link);
            } else {
                el.textContent = value;
            }
        });
    };

    const setContactCard = (headingText, value, href = '') => {
        if (!value) return;
        document.querySelectorAll('.contact-info-card h3').forEach(heading => {
            if (heading.textContent.trim() !== headingText) return;

            const target = heading.parentElement?.querySelector('p');
            if (!target) return;

            if (href) {
                const link = document.createElement('a');
                link.href = href;
                link.textContent = value;
                target.textContent = '';
                target.append(link);
            } else {
                target.textContent = value;
            }
        });
    };

    const normalizePhoneHref = (phone) => `tel:${phone.replace(/[^\d+]/g, '')}`;

    const applyGlobalSettings = (settings = {}) => {
        const companyName = getSetting(settings, 'companyName', 'company');
        const tagline = getSetting(settings, 'tagline');
        const email = getSetting(settings, 'email', 'contactEmail');
        const phone = getSetting(settings, 'phone', 'phoneNumber');
        const address = getSetting(settings, 'address');
        const seoTitle = getSetting(settings, 'seoTitle');
        const seoDescription = getSetting(settings, 'seoDescription');
        const footerText = getSetting(settings, 'footerText') || tagline;
        const copyrightText = getSetting(settings, 'copyrightText');
        const ctaText = getSetting(settings, 'ctaText') || tagline;
        const logoUrl = getSetting(settings, 'logoUrl', 'logoIconUrl', 'logos.icon', 'logos.default');
        const footerLogoUrl = getSetting(settings, 'footerLogoUrl', 'logoLightUrl', 'logoUrl', 'logos.light', 'logos.default');
        const ogImageUrl = getSetting(settings, 'ogImageUrl', 'seoImageUrl', 'logoUrl', 'logos.default');
        const linkedin = getSetting(settings, 'linkedin', 'socialLinks.linkedin');
        const twitter = getSetting(settings, 'twitter', 'socialLinks.twitter');
        const instagram = getSetting(settings, 'instagram', 'socialLinks.instagram');

        if (companyName) {
            setText('.logo-text, .footer-logo-text', companyName);
            document.querySelectorAll('.logo, .footer-logo').forEach(link => {
                link.setAttribute('aria-label', `${companyName} - Home`);
            });

            if (!seoTitle && document.title.includes('Navron Labs')) {
                document.title = document.title.replaceAll('Navron Labs', companyName);
                updateMeta('meta[property="og:title"]', document.title);
            }

            if (!copyrightText) {
                document.querySelectorAll('.footer-bottom p').forEach(el => {
                    el.textContent = el.textContent.replace('Navron Labs', companyName);
                });
            }
        }

        if (seoTitle) {
            document.title = seoTitle;
            updateMeta('meta[property="og:title"]', seoTitle);
        }

        if (seoDescription) {
            updateMeta('meta[name="description"]', seoDescription);
            updateMeta('meta[property="og:description"]', seoDescription);
        }

        updateMeta('meta[property="og:image"]', ogImageUrl);

        setText('.hero-subtitle, .dynamic-tagline', tagline);
        setText('.cta-content p', ctaText);

        if (footerText) {
            document.querySelectorAll('.footer-brand p').forEach(el => {
                el.textContent = footerText;
            });
        }

        if (copyrightText) {
            document.querySelectorAll('.footer-bottom p').forEach(el => {
                el.textContent = copyrightText;
            });
        }

        setLinkedLine('.dynamic-email', 'Email', email, `mailto:${email}`);
        setLinkedLine('.dynamic-phone', 'Phone', phone, normalizePhoneHref(phone));

        if (address) {
            document.querySelectorAll('.footer-contact p').forEach(el => {
                if (el.textContent.trim().startsWith('Location:')) {
                    el.textContent = `Location: ${address}`;
                }
            });
        }

        setContactCard('Our Office', address);
        setContactCard('Email Us', email, `mailto:${email}`);
        setContactCard('Call Us', phone, normalizePhoneHref(phone));

        if (phone) {
            document.querySelectorAll('.contact-info-card.whatsapp').forEach(card => {
                const whatsappNumber = phone.replace(/\D/g, '');
                if (whatsappNumber) {
                    card.onclick = () => window.open(`https://wa.me/${whatsappNumber}`, '_blank', 'noopener');
                }
            });
        }

        document.querySelectorAll('.logo-mark').forEach(img => {
            if (logoUrl) img.src = logoUrl;
            if (companyName) img.alt = '';
        });

        document.querySelectorAll('.footer-logo-mark').forEach(img => {
            if (footerLogoUrl) img.src = footerLogoUrl;
            if (companyName) img.alt = '';
        });

        const socialMap = { LinkedIn: linkedin, Twitter: twitter, Instagram: instagram };
        document.querySelectorAll('.social-links a').forEach(link => {
            const label = link.getAttribute('aria-label') || link.textContent.trim();
            const url = socialMap[label];
            if (!url) return;

            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener';
        });
    };

    listenToGlobalSettings(applyGlobalSettings, (err) => {
        console.error("Error applying global settings:", err);
    });

    // Dynamic Services Fetch & Render
    const servicesGrid = document.getElementById('dynamic-services');
    if (servicesGrid) {
        servicesGrid.innerHTML = getLoaderHTML();
        fetchServices().then(services => {
            if (services.length === 0) {
                servicesGrid.innerHTML = getEmptyHTML("No services currently available.");
            } else {
                servicesGrid.innerHTML = services.map(service => {
                    const title = getText(service.title, 'Service Title');
                    const description = getText(service.description, 'Description not provided.');
                    const features = Array.isArray(service.features) ? service.features.filter(Boolean) : [];

                    return `
                    <div class="service-card reveal">
                        <div class="icon-wrapper">
                            ${renderServiceIcon(service)}
                        </div>
                        <div class="service-card-body">
                            <h3>${escapeHtml(title)}</h3>
                            <p>${escapeHtml(description)}</p>
                            ${features.length ? `<ul class="service-feature-list">${features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
                        </div>
                    </div>
                `;
                }).join('');
                
                setTimeout(() => window.applyScrollReveal(servicesGrid.querySelectorAll('.service-card')), 50);
            }
        }).catch(err => {
            console.error(err);
            servicesGrid.innerHTML = getErrorHTML("Failed to load services. Please try again later.");
        });
    }

    // Dynamic Portfolio Fetch & Render
    const portfolioGrid = document.getElementById('dynamic-portfolio');
    if (portfolioGrid) {
        portfolioGrid.innerHTML = getLoaderHTML();
        fetchPortfolio().then(portfolio => {
            if (portfolio.length === 0) {
                portfolioGrid.innerHTML = getEmptyHTML("No portfolio projects currently available.");
            } else {
                portfolioGrid.innerHTML = portfolio.map((project, index) => {
                    const title = getText(project.title, 'Project Title');
                    const category = getText(project.category, 'Portfolio');
                    const shortDescription = getText(project.shortDescription, project.description, 'Short description not available.');
                    const imageUrl = getText(project.imageUrl, project.image);
                    const projectUrl = normalizeExternalUrl(project.projectUrl);

                    return `
                    <div class="portfolio-card reveal" data-category="${escapeHtml(category)}">
                        <div class="portfolio-image">
                            ${imageUrl ? `<img src="${escapeHtml(getOptimizedCloudinaryUrl(imageUrl))}" alt="${escapeHtml(title)}" loading="lazy">` : `<div class="image-placeholder">Project Image</div>`}
                        </div>
                        <div class="portfolio-content">
                            <div class="portfolio-copy">
                                <span class="portfolio-category">${escapeHtml(category)}</span>
                                <h3 class="portfolio-title">${escapeHtml(title)}</h3>
                                <p class="portfolio-desc">${escapeHtml(shortDescription)}</p>
                            </div>
                            <div class="card-actions">
                                <button class="btn btn-outline btn-sm view-project-btn" type="button" data-project-index="${index}">
                                    ${getIcon('info')}<span>View Project</span>
                                </button>
                                ${projectUrl ? renderExternalButton(projectUrl, 'Visit Website') : ''}
                            </div>
                        </div>
                    </div>
                `;
                }).join('');
                
                initPortfolioFiltering();
                setTimeout(() => window.applyScrollReveal(portfolioGrid.querySelectorAll('.portfolio-card')), 50);

                portfolioGrid.querySelectorAll('.view-project-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const project = portfolio[Number(btn.dataset.projectIndex)] || {};
                        window.openModal(getText(project.title, 'Project Details'), renderProjectModal(project), { size: 'large' });
                    });
                });
            }
        }).catch(err => {
            console.error(err);
            portfolioGrid.innerHTML = getErrorHTML("Failed to load portfolio. Please try again later.");
        });
    }

    // Dynamic Team Fetch & Render
    const teamGrid = document.getElementById('dynamic-team');
    if (teamGrid) {
        teamGrid.innerHTML = getLoaderHTML();
        fetchTeamMembers().then(members => {
            if (members.length === 0) {
                teamGrid.innerHTML = getEmptyHTML("No team members currently listed.");
            } else {
                teamGrid.innerHTML = members.map((member, index) => {
                    const name = getText(member.name, 'Name');
                    const role = getText(member.role, 'Role');
                    const shortDescription = getText(member.shortDescription, member.bio, '');
                    const imageUrl = getText(member.imageUrl, member.image);

                    return `
                    <div class="team-card reveal">
                        <div class="team-image">
                            ${imageUrl ? `<img src="${escapeHtml(getOptimizedCloudinaryUrl(imageUrl, 'f_auto,q_auto,w_900,h_1100,c_fit'))}" alt="${escapeHtml(name)}" loading="lazy">` : `<div class="image-placeholder">Photo</div>`}
                        </div>
                        <div class="team-info">
                            <div class="team-copy">
                                <h3>${escapeHtml(name)}</h3>
                                <div class="team-role">${escapeHtml(role)}</div>
                                ${shortDescription ? `<p>${escapeHtml(shortDescription)}</p>` : ''}
                            </div>
                            <div class="team-card-footer">
                                ${renderSocialLinks(member)}
                                <button class="btn btn-outline btn-sm view-team-btn" type="button" data-member-index="${index}">
                                    ${getIcon('info')}<span>View Details</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                }).join('');

                setTimeout(() => window.applyScrollReveal(teamGrid.querySelectorAll('.team-card')), 50);

                teamGrid.querySelectorAll('.view-team-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const member = members[Number(btn.dataset.memberIndex)] || {};
                        const name = getText(member.name, 'Team Member');
                        const role = getText(member.role, 'Role');
                        const description = getText(member.fullDescription, member.bio, member.shortDescription, 'Profile details are being updated.');
                        window.openModal(name, `
                            <div class="team-modal">
                                <p class="modal-kicker">${escapeHtml(role)}</p>
                                <p>${escapeHtml(description)}</p>
                                ${renderSocialLinks(member)}
                            </div>
                        `);
                    });
                });
            }
        }).catch(err => {
            console.error(err);
            teamGrid.innerHTML = getErrorHTML("Failed to load team members. Please try again later.");
        });
    }
    
    // Dynamic Testimonials Fetch & Render (If container exists)
    const testimonialsGrid = document.getElementById('dynamic-testimonials');
    if (testimonialsGrid) {
        const limitAttr = testimonialsGrid.getAttribute('data-limit');
        const limitCount = limitAttr ? parseInt(limitAttr, 10) : null;

        testimonialsGrid.innerHTML = getLoaderHTML();
        fetchTestimonials(limitCount).then(testimonials => {
            if (testimonials.length === 0) {
                testimonialsGrid.innerHTML = getEmptyHTML("No testimonials available yet.");
            } else {
                testimonialsGrid.innerHTML = testimonials.map(testimonial => {
                    const clientName = getText(testimonial.clientName, 'Anonymous');
                    const review = getText(testimonial.review, '');

                    return `
                    <div class="reveal testimonial-card">
                        <div class="testimonial-header">
                            ${testimonial.photoUrl ? `<img src="${escapeHtml(getOptimizedCloudinaryUrl(testimonial.photoUrl, 'f_auto,q_auto,w_160,h_160,c_fit'))}" alt="${escapeHtml(clientName)}" loading="lazy" class="testimonial-avatar">` : `<div class="testimonial-avatar-fallback">${escapeHtml(clientName.charAt(0))}</div>`}
                            <div>
                                <h4 class="testimonial-name">${escapeHtml(clientName)}</h4>
                                <div class="testimonial-rating" aria-label="${testimonial.rating || 5} out of 5 stars">${getRatingHTML(testimonial.rating)}</div>
                            </div>
                        </div>
                        <p class="testimonial-review">"${escapeHtml(review)}"</p>
                    </div>
                `;
                }).join('');
                
                setTimeout(() => window.applyScrollReveal(testimonialsGrid.querySelectorAll('.reveal')), 50);
            }
        }).catch(err => {
            console.error(err);
            testimonialsGrid.innerHTML = getErrorHTML("Failed to load testimonials.");
        });
    }

    // Testimonial Toggle UX
    const toggleBtn = document.getElementById('toggle-testimonial-form-btn');
    const formContainer = document.getElementById('expandable-testimonial-form');
    
    if (toggleBtn && formContainer) {
        toggleBtn.addEventListener('click', () => {
            const isOpen = formContainer.classList.contains('open');
            if (isOpen) {
                formContainer.classList.remove('open');
                toggleBtn.setAttribute('aria-expanded', 'false');
                toggleBtn.textContent = 'Add Review';
            } else {
                formContainer.classList.add('open');
                toggleBtn.setAttribute('aria-expanded', 'true');
                toggleBtn.textContent = 'Cancel Review';
            }
        });
    }

    // Testimonial Form Validation & Submission
    const testimonialForm = document.getElementById('testimonial-form');
    if (testimonialForm) {
        const submitBtn = testimonialForm.querySelector('button[type="submit"]');
        const cooldownKey = 'navron:testimonial:lastSubmitAt';

        testimonialForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (testimonialForm.dataset.submitting === 'true') return;
            if (hasHoneypotValue(testimonialForm)) return;

            const cooldownSeconds = getCooldownSeconds(cooldownKey);
            if (cooldownSeconds) {
                showTestimonialStatus(`Please wait ${cooldownSeconds} seconds before submitting another review.`, 'error');
                return;
            }
            
            const clientName = document.getElementById('t-name').value.trim();
            const rating = parseInt(document.getElementById('t-rating').value, 10);
            const rawPhotoUrl = document.getElementById('t-photo').value.trim();
            const review = document.getElementById('t-review').value.trim();
            let photoUrl = '';

            const validationError = validateTestimonialInput({ clientName, rating, photoUrl: rawPhotoUrl, review });
            if (validationError) {
                showTestimonialStatus(validationError, 'error');
                return;
            }

            try {
                photoUrl = normalizeOptionalUrl(rawPhotoUrl);
            } catch (error) {
                showTestimonialStatus(error.message, 'error');
                return;
            }

            setFormPending(testimonialForm, submitBtn, true, 'Submitting...');
            startCooldown(cooldownKey);
            try {
                await submitTestimonial({ clientName, rating, photoUrl, review });
                testimonialForm.reset();
                
                // Collapse Form UX
                if (formContainer) {
                    formContainer.classList.remove('open');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                    toggleBtn.textContent = 'Add Review';
                }
                
                const globalStatus = document.getElementById('global-testimonial-status');
                if (globalStatus) {
                    globalStatus.textContent = 'Your review has been submitted for approval.';
                    globalStatus.className = 'form-status success';
                    globalStatus.style.display = 'block';
                    setTimeout(() => globalStatus.style.display = 'none', 8000);
                } else {
                    showTestimonialStatus('Your review has been submitted for approval.', 'success');
                }
            } catch (error) {
                showTestimonialStatus(getSubmissionErrorMessage(error, 'There was an error submitting your review. Please try again later.'), 'error');
            } finally {
                setFormPending(testimonialForm, submitBtn, false);
            }
        });

        function showTestimonialStatus(msg, type) {
            const formStatus = document.getElementById('testimonial-status');
            if (!formStatus) return;
            formStatus.textContent = msg;
            formStatus.className = `form-status ${type}`;
            formStatus.style.display = 'block';
            setTimeout(() => {
                formStatus.style.display = 'none';
            }, 5000);
        }
    }

    // Contact Form Validation & Submission
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const cooldownKey = 'navron:lead:lastSubmitAt';

        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (contactForm.dataset.submitting === 'true') return;
            if (hasHoneypotValue(contactForm)) return;

            const cooldownSeconds = getCooldownSeconds(cooldownKey);
            if (cooldownSeconds) {
                showStatus(`Please wait ${cooldownSeconds} seconds before sending another message.`, 'error');
                return;
            }
            
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const subject = document.getElementById('subject').value.trim();
            const message = document.getElementById('message').value.trim();

            const validationError = validateLeadInput({ name, email, phone, subject, message });
            if (validationError) {
                showStatus(validationError, 'error');
                return;
            }

            setFormPending(contactForm, submitBtn, true, 'Sending...');
            startCooldown(cooldownKey);
            try {
                await submitLeadForm({ name, email, phone, message });
                showStatus('Message sent successfully! We will get back to you soon.', 'success');
                contactForm.reset();
            } catch (error) {
                showStatus(getSubmissionErrorMessage(error, 'There was an error sending your message. Please try again later.'), 'error');
            } finally {
                setFormPending(contactForm, submitBtn, false);
            }
        });

        function showStatus(msg, type) {
            const formStatus = document.getElementById('form-status');
            if (!formStatus) return;
            formStatus.textContent = msg;
            formStatus.className = `form-status ${type}`;
            formStatus.style.display = 'block';
            setTimeout(() => {
                formStatus.style.display = 'none';
            }, 5000);
        }
    }
});

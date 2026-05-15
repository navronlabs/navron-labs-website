/**
 * Main Javascript for Navron Labs
 * Handles global UI interactions & Firebase Data Fetching
 */

import { fetchServices, fetchPortfolio, fetchTeamMembers, fetchSettings, fetchTestimonials, submitLeadForm, submitTestimonial } from '../../firebase/firestore.js';

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

    window.openModal = (title, content) => {
        if(modal) {
            modalTitle.textContent = title;
            modalBody.innerHTML = content;
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeModal = () => {
        if(modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    if (modalClose) modalClose.addEventListener('click', window.closeModal);
    if (modal) modal.addEventListener('click', (e) => {
        if (e.target === modal) window.closeModal();
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
    const getRatingHTML = (rating = 5) => {
        const normalizedRating = Math.max(0, Math.min(5, Number(rating) || 5));
        return Array.from({ length: 5 }, (_, index) => {
            const state = index < normalizedRating ? 'filled' : 'empty';
            return `<svg class="rating-star ${state}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        }).join('');
    };

    // Fetch Global Settings
    fetchSettings().then(settings => {
        const globalSettings = settings['global'] || {};
        
        if (globalSettings.email) {
            document.querySelectorAll('.dynamic-email').forEach(el => el.textContent = globalSettings.email);
        }
        if (globalSettings.phone) {
            document.querySelectorAll('.dynamic-phone').forEach(el => el.textContent = globalSettings.phone);
        }
        if (globalSettings.tagline) {
            document.querySelectorAll('.dynamic-tagline').forEach(el => el.textContent = globalSettings.tagline);
        }
    }).catch(err => console.error("Error applying global settings:", err));

    // Dynamic Services Fetch & Render
    const servicesGrid = document.getElementById('dynamic-services');
    if (servicesGrid) {
        servicesGrid.innerHTML = getLoaderHTML();
        fetchServices().then(services => {
            if (services.length === 0) {
                servicesGrid.innerHTML = getEmptyHTML("No services currently available.");
            } else {
                servicesGrid.innerHTML = services.map(service => `
                    <div class="service-card reveal">
                        <div class="icon-wrapper">
                            ${service.iconSvg || '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'}
                        </div>
                        <h3>${service.title || 'Service Title'}</h3>
                        <p>${service.description || 'Description not provided.'}</p>
                        ${service.features ? `<ul style="margin-top: 1.5rem; padding-left: 1.5rem; color: var(--color-text-muted);">${service.features.map(f => `<li style="margin-bottom: 0.5rem;">${f}</li>`).join('')}</ul>` : ''}
                    </div>
                `).join('');
                
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
                portfolioGrid.innerHTML = portfolio.map(project => `
                    <div class="portfolio-card reveal" data-category="${project.category || 'Portfolio'}">
                        <div class="portfolio-image">
                            ${project.imageUrl ? `<img src="${project.imageUrl}" alt="${project.title}" loading="lazy">` : `<div class="image-placeholder">Project Image</div>`}
                        </div>
                        <div class="portfolio-content">
                            <span class="portfolio-category">${project.category || 'Category'}</span>
                            <h3 class="portfolio-title">${project.title || 'Project Title'}</h3>
                            <p class="portfolio-desc">${project.shortDescription || 'Short description not available.'}</p>
                            <a href="#" class="btn btn-outline btn-sm view-project-btn" 
                               data-title="${project.title || ''}" 
                               data-desc="${project.fullDescription || project.shortDescription || ''}">
                               View Project
                            </a>
                        </div>
                    </div>
                `).join('');
                
                initPortfolioFiltering();
                setTimeout(() => window.applyScrollReveal(portfolioGrid.querySelectorAll('.portfolio-card')), 50);

                document.querySelectorAll('.view-project-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const title = btn.getAttribute('data-title');
                        const desc = btn.getAttribute('data-desc');
                        window.openModal(title, `<p>${desc}</p><p style="margin-top: 1.5rem; color: var(--color-text-muted);">More details about this project will be available soon.</p>`);
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
                teamGrid.innerHTML = members.map(member => `
                    <div class="team-card reveal">
                        <div class="team-image">
                            ${member.imageUrl ? `<img src="${member.imageUrl}" alt="${member.name}" loading="lazy" style="width:100%; height:100%; object-fit:cover;">` : `Photo`}
                        </div>
                        <div class="team-info">
                            <h3 style="margin-bottom: 0.25rem;">${member.name || 'Name'}</h3>
                            <div class="team-role">${member.role || 'Role'}</div>
                            <p style="color: var(--color-text-muted); font-size: 0.9375rem; margin-bottom: 1.5rem;">${member.shortDescription || ''}</p>
                            <a href="#" class="btn btn-outline btn-sm view-team-btn"
                               data-name="${member.name || ''}"
                               data-role="${member.role || ''}"
                               data-desc="${member.fullDescription || member.shortDescription || ''}">
                               View Details
                            </a>
                        </div>
                    </div>
                `).join('');

                setTimeout(() => window.applyScrollReveal(teamGrid.querySelectorAll('.team-card')), 50);

                document.querySelectorAll('.view-team-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        const name = btn.getAttribute('data-name');
                        const role = btn.getAttribute('data-role');
                        const desc = btn.getAttribute('data-desc');
                        window.openModal(name, `<h4 style="color: var(--color-primary); margin-bottom: 0.5rem;">${role}</h4><p>${desc}</p><p style="margin-top: 1.5rem; color: var(--color-text-muted);">Extended professional background details.</p>`);
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
                testimonialsGrid.innerHTML = testimonials.map(testimonial => `
                    <div class="reveal testimonial-card">
                        <div class="testimonial-header">
                            ${testimonial.photoUrl ? `<img src="${testimonial.photoUrl}" alt="${testimonial.clientName}" loading="lazy" class="testimonial-avatar">` : `<div class="testimonial-avatar-fallback">${testimonial.clientName.charAt(0)}</div>`}
                            <div>
                                <h4 class="testimonial-name">${testimonial.clientName || 'Anonymous'}</h4>
                                <div class="testimonial-rating" aria-label="${testimonial.rating || 5} out of 5 stars">${getRatingHTML(testimonial.rating)}</div>
                            </div>
                        </div>
                        <p class="testimonial-review">"${testimonial.review || ''}"</p>
                    </div>
                `).join('');
                
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

        testimonialForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const clientName = document.getElementById('t-name').value.trim();
            const rating = parseInt(document.getElementById('t-rating').value, 10);
            const photoUrl = document.getElementById('t-photo').value.trim();
            const review = document.getElementById('t-review').value.trim();

            if (!clientName || !rating || !review) {
                showTestimonialStatus('Please fill out all required fields.', 'error');
                return;
            }

            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Submitting...';
            submitBtn.disabled = true;

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
                showTestimonialStatus('There was an error submitting your review. Please try again later.', 'error');
            } finally {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });

        function showTestimonialStatus(msg, type) {
            const formStatus = document.getElementById('testimonial-status');
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

        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const message = document.getElementById('message').value.trim();

            if (!name || !email || !phone || !message) {
                showStatus('Please fill out all required fields.', 'error');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showStatus('Please enter a valid email address.', 'error');
                return;
            }

            const phoneRegex = /^[0-9]{10,15}$/;
            if (!phoneRegex.test(phone.replace(/[\s+-]/g, ''))) {
                showStatus('Please enter a valid phone number.', 'error');
                return;
            }

            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            try {
                await submitLeadForm({ name, email, phone, message });
                showStatus('Message sent successfully! We will get back to you soon.', 'success');
                contactForm.reset();
            } catch (error) {
                showStatus('There was an error sending your message. Please try again later.', 'error');
            } finally {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });

        function showStatus(msg, type) {
            const formStatus = document.getElementById('form-status');
            formStatus.textContent = msg;
            formStatus.className = `form-status ${type}`;
            formStatus.style.display = 'block';
            setTimeout(() => {
                formStatus.style.display = 'none';
            }, 5000);
        }
    }
});

/* WPVault - Viral UI Engine */
(function() {
    "use strict";

    var WPVault = {};

    /* ============================================
       TOAST NOTIFICATION SYSTEM
       ============================================ */
    WPVault.toast = function(msg, type) {
        type = type || "info";
        var container = document.getElementById("toastContainer");
        if (!container) return;
        var el = document.createElement("div");
        el.className = "toast toast-" + type;
        var icons = { success: "\u2705", error: "\u274C", info: "\u2139\uFE0F", warning: "\u26A0\uFE0F" };
        el.innerHTML = '<span class="toast-icon">' + (icons[type] || "") + '</span><span class="toast-msg">' + msg + "</span>";
        container.appendChild(el);
        requestAnimationFrame(function() { el.classList.add("show"); });
        setTimeout(function() {
            el.classList.remove("show");
            setTimeout(function() { el.remove(); }, 400);
        }, 4000);
    };

    /* ============================================
       SOCIAL PROOF NOTIFICATION ENGINE
       ============================================ */
    var socialProofNames = [
        "Alex", "Sarah", "Mike", "Emma", "David", "Lisa", "James", "Anna",
        "Chris", "Jessica", "Ryan", "Emily", "Daniel", "Sophie", "Matt",
        "Rachel", "Tom", "Laura", "Ben", "Amy", "Jake", "Nicole", "Mark",
        "Katie", "Luke", "Olivia", "Sam", "Mia", "Jordan", "Grace"
    ];
    var socialProofCities = [
        "New York", "London", "Berlin", "Toronto", "Sydney", "Paris",
        "Amsterdam", "Tokyo", "Dubai", "Singapore", "Austin", "Mumbai",
        "Stockholm", "Barcelona", "San Francisco", "Chicago", "Melbourne",
        "Dublin", "Lisbon", "Vancouver", "Seattle", "Denver", "Milan"
    ];
    var socialProofPlugins = [
        "Elementor Pro", "WooCommerce", "Yoast SEO Premium", "ACF Pro",
        "WP Rocket", "Gravity Forms", "JEPA Theme", "Astra Pro",
        "Divi Builder", "Slider Revolution", "JEPA Theme", "JEPA Ultimate",
        "TablePress", "Redirection Pro", "MainWP Pro", "MonsterInsights Pro",
        "Wordfence Premium", "All in One SEO", "WP Mail SMTP Pro", "UpdraftPlus Premium"
    ];

    function showSocialProof() {
        var container = document.getElementById("socialProofContainer");
        if (!container) return;
        var name = socialProofNames[Math.floor(Math.random() * socialProofNames.length)];
        var city = socialProofCities[Math.floor(Math.random() * socialProofCities.length)];
        var plugin = socialProofPlugins[Math.floor(Math.random() * socialProofPlugins.length)];
        var mins = Math.floor(Math.random() * 12) + 1;
        var el = document.createElement("div");
        el.className = "social-proof-toast";
        el.innerHTML = '<div class="sp-avatar">' + name[0] + '</div><div class="sp-content"><strong>' + name + '</strong> from ' + city + ' downloaded <strong>' + plugin + '</strong><div class="sp-time">' + mins + ' min ago</div></div>';
        container.appendChild(el);
        requestAnimationFrame(function() { el.classList.add("show"); });
        setTimeout(function() {
            el.classList.remove("show");
            setTimeout(function() { el.remove(); }, 500);
        }, 5000);
    }

    /* ============================================
       COUNTDOWN TIMER ENGINE
       ============================================ */
    function initCountdowns() {
        var timers = document.querySelectorAll("[data-countdown]");
        timers.forEach(function(el) {
            updateCountdown(el);
        });
        /* Also handle announcement bar timer */
        var announcementTimer = document.getElementById("announcementTimer");
        if (announcementTimer) {
            updateAnnouncementTimer(announcementTimer);
        }
        var checkoutTimer = document.getElementById("checkoutTimer");
        if (checkoutTimer) {
            updateCheckoutTimer(checkoutTimer);
        }
    }

    function updateAnnouncementTimer(el) {
        var now = new Date();
        var end = new Date(now);
        end.setHours(23, 59, 59, 999);
        function tick() {
            var diff = end - new Date();
            if (diff <= 0) { el.textContent = "00:00:00"; return; }
            var h = Math.floor(diff / 3600000);
            var m = Math.floor((diff % 3600000) / 60000);
            var s = Math.floor((diff % 60000) / 1000);
            el.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
        }
        tick();
        setInterval(tick, 1000);
    }

    function updateCheckoutTimer(el) {
        var now = new Date();
        var end = new Date(now);
        end.setHours(23, 59, 59, 999);
        function tick() {
            var diff = end - new Date();
            if (diff <= 0) { el.textContent = "00:00:00"; return; }
            var h = Math.floor(diff / 3600000);
            var m = Math.floor((diff % 3600000) / 60000);
            var s = Math.floor((diff % 60000) / 1000);
            el.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
        }
        tick();
        setInterval(tick, 1000);
    }

    function updateCountdown(el) {
        var hours = parseInt(el.getAttribute("data-countdown") || "24");
        var stored = localStorage.getItem("wpv_countdown_" + hours);
        var end;
        if (stored) {
            end = new Date(parseInt(stored));
            if (end <= new Date()) {
                end = new Date(new Date().getTime() + hours * 3600000);
                localStorage.setItem("wpv_countdown_" + hours, end.getTime());
            }
        } else {
            end = new Date(new Date().getTime() + hours * 3600000);
            localStorage.setItem("wpv_countdown_" + hours, end.getTime());
        }
        function tick() {
            var diff = end - new Date();
            if (diff <= 0) { el.textContent = "00:00:00"; return; }
            var h = Math.floor(diff / 3600000);
            var m = Math.floor((diff % 3600000) / 60000);
            var s = Math.floor((diff % 60000) / 1000);
            el.textContent = pad(h) + ":" + pad(m) + ":" + pad(s);
        }
        tick();
        setInterval(tick, 1000);
    }

    function pad(n) { return n < 10 ? "0" + n : "" + n; }

    /* ============================================
       ANIMATED STAT COUNTERS
       ============================================ */
    function animateCounters() {
        var counters = document.querySelectorAll("[data-count], [data-target]");
        counters.forEach(function(el) {
            var target = parseInt(el.getAttribute("data-count") || el.getAttribute("data-target"));
            if (isNaN(target)) return;
            var suffix = el.getAttribute("data-suffix") || "";
            var prefix = el.getAttribute("data-prefix") || "";
            var duration = 2000;
            var startTime = null;
            function step(ts) {
                if (!startTime) startTime = ts;
                var progress = Math.min((ts - startTime) / duration, 1);
                var eased = 1 - Math.pow(1 - progress, 3);
                var current = Math.floor(eased * target);
                el.textContent = prefix + current.toLocaleString() + suffix;
                if (progress < 1) requestAnimationFrame(step);
            }
            var observer = new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting) {
                        requestAnimationFrame(step);
                        observer.unobserve(el);
                    }
                });
            }, { threshold: 0.3 });
            observer.observe(el);
        });
    }

    /* ============================================
       SCROLL ANIMATIONS (REVEAL ON SCROLL)
       ============================================ */
    function initScrollReveal() {
        var reveals = document.querySelectorAll(".reveal");
        if (!reveals.length) return;
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.01, rootMargin: "0px 0px 200px 0px" });
        reveals.forEach(function(el) { observer.observe(el); });
        function forceRevealVisible() {
            document.querySelectorAll(".reveal:not(.visible)").forEach(function(el) {
                var rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight + 100) {
                    el.classList.add("visible");
                }
            });
        }
        setTimeout(forceRevealVisible, 100);
        setTimeout(forceRevealVisible, 500);
        window.addEventListener("scroll", forceRevealVisible, { passive: true });
        setTimeout(function() {
            document.querySelectorAll(".reveal:not(.visible)").forEach(function(el) {
                el.classList.add("visible");
            });
        }, 2000);
    }

    /* ============================================
       SCROLL PROGRESS BAR
       ============================================ */
    function initScrollProgress() {
        var bar = document.getElementById("scrollProgress");
        if (!bar) return;
        window.addEventListener("scroll", function() {
            var h = document.documentElement;
            var pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
            bar.style.width = pct + "%";
        }, { passive: true });
    }

    /* ============================================
       BACK TO TOP BUTTON
       ============================================ */
    function initBackToTop() {
        var btn = document.getElementById("backToTop");
        if (!btn) return;
        window.addEventListener("scroll", function() {
            if (window.scrollY > 400) btn.classList.add("visible");
            else btn.classList.remove("visible");
        }, { passive: true });
        btn.addEventListener("click", function() {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    /* ============================================
       STICKY NAVBAR ON SCROLL
       ============================================ */
    function initStickyNav() {
        var nav = document.querySelector(".navbar");
        if (!nav) return;
        window.addEventListener("scroll", function() {
            if (window.scrollY > 60) nav.classList.add("scrolled");
            else nav.classList.remove("scrolled");
        }, { passive: true });
    }

    /* ============================================
       FAQ ACCORDION
       ============================================ */
    function initFAQ() {
        var toggles = document.querySelectorAll(".faq-question");
        toggles.forEach(function(q) {
            q.addEventListener("click", function() {
                var item = this.closest(".faq-item");
                var isOpen = item.classList.contains("open");
                /* Close all */
                document.querySelectorAll(".faq-item.open").forEach(function(i) { i.classList.remove("open"); });
                if (!isOpen) item.classList.add("open");
            });
        });
    }

    /* ============================================
       LIVE VIEWER COUNT SIMULATION
       ============================================ */
    function initViewerCount() {
        var el = document.getElementById("viewerCount");
        if (!el) return;
        var base = parseInt(el.textContent) || 42;
        setInterval(function() {
            var delta = Math.floor(Math.random() * 5) - 2;
            base = Math.max(12, Math.min(150, base + delta));
            el.textContent = base;
        }, 3000);
    }

    /* ============================================
       HERO VIEWER COUNT
       ============================================ */
    function initHeroViewers() {
        var el = document.getElementById("heroViewers");
        if (!el) return;
        var base = parseInt(el.textContent) || 127;
        setInterval(function() {
            var delta = Math.floor(Math.random() * 7) - 3;
            base = Math.max(80, Math.min(300, base + delta));
            el.textContent = base;
        }, 4000);
    }

    /* ============================================
       NAVBAR AUTH STATE
       ============================================ */
    function initNavAuth() {
        var token = localStorage.getItem("token");
        var authEl = document.getElementById("navAuth");
        if (!authEl) return;
        if (token) {
            authEl.innerHTML = '<a href="/dashboard">Dashboard</a><a href="#" onclick="WPVault.logout();return false;">Logout</a>';
        } else {
            authEl.innerHTML = '<a href="/login">Login</a><a href="/register" class="btn btn-sm">Get Started</a>';
        }
    }

    WPVault.logout = function() {
        localStorage.removeItem("token");
        WPVault.toast("Logged out successfully", "success");
        setTimeout(function() { window.location = "/"; }, 500);
    };

    /* ============================================
       3D CARD TILT ON HOVER
       ============================================ */
    function initCardTilt() {
        var cards = document.querySelectorAll(".plugin-card, .feature-card, .pricing-card");
        cards.forEach(function(card) {
            card.addEventListener("mousemove", function(e) {
                var rect = card.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                var centerX = rect.width / 2;
                var centerY = rect.height / 2;
                var rotateX = ((y - centerY) / centerY) * -4;
                var rotateY = ((x - centerX) / centerX) * 4;
                card.style.transform = "perspective(1000px) rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg) scale(1.02)";
            });
            card.addEventListener("mouseleave", function() {
                card.style.transform = "";
            });
        });
    }

    /* ============================================
       TYPING TEXT EFFECT
       ============================================ */
    function initTypingEffect() {
        var el = document.getElementById("typingText");
        if (!el) return;
        var words = ["Premium Plugins", "GPL Themes", "12,000+ Products", "Developer Tools", "Pro Add-ons"];
        var wordIdx = 0;
        var charIdx = 0;
        var deleting = false;
        var speed = 100;

        function type() {
            var current = words[wordIdx];
            if (deleting) {
                el.textContent = current.substring(0, charIdx - 1);
                charIdx--;
                speed = 50;
            } else {
                el.textContent = current.substring(0, charIdx + 1);
                charIdx++;
                speed = 100;
            }

            if (!deleting && charIdx === current.length) {
                speed = 2000;
                deleting = true;
            } else if (deleting && charIdx === 0) {
                deleting = false;
                wordIdx = (wordIdx + 1) % words.length;
                speed = 400;
            }

            setTimeout(type, speed);
        }
        type();
    }

    /* ============================================
       PRICING TOGGLE (YEARLY / LIFETIME)
       ============================================ */
    function initPricingToggle() {
        var toggles = document.querySelectorAll(".pricing-toggle-btn");
        toggles.forEach(function(btn) {
            btn.addEventListener("click", function() {
                toggles.forEach(function(b) { b.classList.remove("active"); });
                this.classList.add("active");
            });
        });
    }

    /* ============================================
       COMPARISON TABLE HIGHLIGHTING
       ============================================ */
    function initComparisonTable() {
        var rows = document.querySelectorAll(".comparison-row");
        rows.forEach(function(row) {
            row.addEventListener("mouseenter", function() {
                this.style.background = "rgba(139, 92, 246, 0.06)";
            });
            row.addEventListener("mouseleave", function() {
                this.style.background = "";
            });
        });
    }

    /* ============================================
       SMOOTH SCROLL FOR ANCHOR LINKS
       ============================================ */
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function(a) {
            a.addEventListener("click", function(e) {
                var target = document.querySelector(this.getAttribute("href"));
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        });
    }

    /* ============================================
       PREFETCH ON HOVER
       ============================================ */
    function initPrefetch() {
        var links = document.querySelectorAll("a[href^='/plugin/']");
        links.forEach(function(a) {
            a.addEventListener("mouseenter", function() {
                var link = document.createElement("link");
                link.rel = "prefetch";
                link.href = this.href;
                document.head.appendChild(link);
            }, { once: true });
        });
    }

    /* ============================================
       INITIALIZE EVERYTHING ON DOM READY
       ============================================ */
    function init() {
        initStickyNav();
        initScrollProgress();
        initBackToTop();
        initScrollReveal();
        initCountdowns();
        animateCounters();
        initFAQ();
        initViewerCount();
        initHeroViewers();
        initNavAuth();
        initCardTilt();
        initTypingEffect();
        initPricingToggle();
        initComparisonTable();
        initSmoothScroll();
        initPrefetch();

        /* Social proof notifications every 8-15 seconds */
        setTimeout(function() {
            showSocialProof();
            setInterval(function() {
                showSocialProof();
            }, Math.floor(Math.random() * 7000) + 8000);
        }, 3000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    /* Expose globally */
    window.WPVault = WPVault;
})();

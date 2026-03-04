// Scroll-triggered section reveals
export function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible");
      });
    },
    { threshold: 0.08 }
  );

  document.querySelectorAll(".fade-section").forEach((el) => observer.observe(el));

  // Stagger children inside each visible section
  const childObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const children = entry.target.querySelectorAll(
            ".timeline-item, .project-card, .skill-group, .extra-card"
          );
          children.forEach((child, i) => {
            child.style.transitionDelay = `${i * 0.1}s`;
            child.classList.add("stagger-visible");
          });
        }
      });
    },
    { threshold: 0.05 }
  );

  document.querySelectorAll(".fade-section").forEach((el) => childObserver.observe(el));
}

// Active nav link based on scroll position
export function initActiveNav() {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-links a");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinks.forEach((link) => {
            link.classList.toggle(
              "active",
              link.getAttribute("href") === `#${entry.target.id}`
            );
          });
        }
      });
    },
    { threshold: 0.3 }
  );

  sections.forEach((section) => observer.observe(section));
}

const ITEMS = [
  { key: "students", label: "Students", detail: "Accounts", icon: "👥", href: "admin.html" },
  { key: "modules", label: "Modules", detail: "Catalogue", icon: "📚", href: "admin-modules.html" },
  { key: "questions", label: "Question Bank", detail: "Content", icon: "❓", href: "admin-questions.html" },
  { key: "quizzes", label: "Quiz Builder", detail: "Assessments", icon: "🧩", href: "admin-quizzes.html" },
  { key: "competitions", label: "Competitions", detail: "Rounds", icon: "🏆", href: "admin-competitions.html" },
  { key: "access", label: "Access Engine", detail: "Rules", icon: "🔐", href: "admin-access.html" },
  { key: "analytics", label: "Analytics", detail: "Reports", icon: "📊", href: "admin-analytics.html" }
];

function renderAdminShell() {
  document.querySelectorAll("[data-admin-shell]").forEach((host) => {
    const active = host.dataset.active || "";
    host.className = "acl-admin-shell";
    host.innerHTML = `
      <div class="acl-admin-shell-heading">
        <span>ADMIN CONTROL CENTRE</span>
      </div>
      <nav class="acl-admin-nav-line" aria-label="Administration sections">
        ${ITEMS.map(item => `
          <a class="acl-admin-nav-item ${item.key === active ? "is-active" : ""}"
             href="${item.href}" ${item.key === active ? 'aria-current="page"' : ""}>
            <span class="acl-admin-nav-icon">${item.icon}</span>
            <span class="acl-admin-nav-copy">
              <strong>${item.label}</strong>
              <small>${item.detail}</small>
            </span>
          </a>
        `).join("")}
      </nav>
    `;
  });
}

document.addEventListener("DOMContentLoaded", renderAdminShell);
if (document.readyState !== "loading") renderAdminShell();

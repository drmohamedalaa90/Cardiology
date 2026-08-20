import { supabaseClient } from "./supabase-client.js";

const isNested = location.pathname.includes("/modules/");
const root = isNested ? "../../" : "";
const page = location.pathname.split("/").pop() || "modules.html";
const q = new URLSearchParams(location.search);
let savedEdition = "";
try { savedEdition = localStorage.getItem("aclSelectedEdition") || ""; } catch {}
const edition = (q.get("edition") || savedEdition || "expert").toLowerCase() === "basic" ? "basic" : "expert";
try { localStorage.setItem("aclSelectedEdition", edition); } catch {}

function addCss(href) {
  if ([...document.styleSheets].some(s => s.href && s.href.includes(href.split("?")[0]))) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = root + href;
  document.head.appendChild(link);
}
addCss("assets/css/acl-command-center.css?v=2.1.0");
addCss("assets/css/acl-shared-shell.css?v=1.0.0");

// Remove legacy page-specific navigation so only one shell can exist.
document.querySelectorAll("body > header.topbar, .settings-shell > header.topbar").forEach(el => el.remove());

document.body.classList.add("acl-command-body", "acl-shared-page");
document.body.classList.toggle("acl-theme-basic", edition === "basic");
document.body.classList.toggle("acl-theme-expert", edition === "expert");

const main = document.querySelector("body > main");
if (main) main.classList.add("acl-command-main", "acl-shared-main");

const active = (name) => page === name ? " is-active" : "";
const withEdition = (name) => `${root}${name}?edition=${edition}`;

const shell = document.createElement("div");
shell.id = "aclSharedShell";
shell.innerHTML = `
<header class="acl-command-header">
  <div class="acl-command-header-left">
    <button id="aclDrawerToggle" class="acl-command-menu" type="button" aria-label="Open navigation" aria-controls="aclCommandDrawer" aria-expanded="false"><span></span><span></span><span></span></button>
    <a class="acl-command-brand" href="${withEdition("modules.html")}">
      <img src="${root}assets/images/acl-icon-192.png" alt="" class="acl-command-brand-logo">
      <span class="acl-command-brand-name">Alexandria Cardiology League</span>
      <span class="acl-command-brand-separator">•</span>
      <strong id="aclHeaderEdition">${edition === "basic" ? "THE BASIC EDITION" : "THE EXPERT EDITION"}</strong>
    </a>
  </div>
  <div class="acl-command-header-actions">
    <span id="aclHeaderUserName" class="acl-command-user-name">Member</span>
    <a class="acl-command-icon-btn" href="${root}notifications.html?edition=${edition}" aria-label="Notifications">🔔</a>
    <a class="acl-command-icon-btn" href="${root}settings.html?edition=${edition}" aria-label="Settings">⚙</a>
    <button id="aclHeaderLogout" class="acl-command-icon-btn" type="button" aria-label="Log out">↪</button>
  </div>
</header>
<div id="aclDrawerBackdrop" class="acl-drawer-backdrop" hidden></div>
<aside id="aclCommandDrawer" class="acl-command-drawer" aria-label="ACL navigation">
  <div class="acl-drawer-scroll">
    <section class="acl-drawer-profile">
      <div id="aclDrawerAvatar" class="acl-drawer-avatar"><span>ACL</span></div>
      <div class="acl-drawer-profile-copy"><strong id="aclDrawerName">Member</strong><a href="${root}profile.html?edition=${edition}" class="acl-drawer-edit">Edit profile</a></div>
    </section>
    <nav class="acl-drawer-nav">
      <a class="acl-drawer-link${active("modules.html")}" href="${withEdition("modules.html")}"><span class="acl-nav-icon">▦</span><span>Modules</span></a>
      <a class="acl-drawer-link${active("progress.html")}" href="${root}progress.html?edition=${edition}"><span class="acl-nav-icon">▤</span><span>My Progress</span></a>
      <section class="acl-nav-group">
        <button class="acl-nav-group-toggle" type="button" data-collapse-target="aclEditionMenu" aria-expanded="true"><span><span class="acl-nav-icon">⇄</span>Editions</span><span class="acl-chevron">⌄</span></button>
        <div id="aclEditionMenu" class="acl-nav-group-content">
          <a href="${root}modules.html?edition=basic" class="${edition === "basic" ? "is-selected" : ""}">Basic Edition</a>
          <a href="${root}modules.html?edition=expert" class="${edition === "expert" ? "is-selected" : ""}">Expert Edition</a>
        </div>
      </section>
      <a class="acl-drawer-link" href="${root}learning.html?edition=${edition}"><span class="acl-nav-icon">◆</span><span>Mindmaps & Flashcards</span></a>
      <a class="acl-drawer-link" href="${root}challenge.html?edition=${edition}"><span class="acl-nav-icon">⚔</span><span>Challenge Friends</span></a>
      <a class="acl-drawer-link" href="${root}competitions.html?edition=${edition}"><span class="acl-nav-icon">🏆</span><span>Formal ACL Competitions</span></a>
      <a class="acl-drawer-link${active("profile.html")}" href="${root}profile.html?edition=${edition}"><span class="acl-nav-icon">♙</span><span>Profile</span></a>
      <a class="acl-drawer-link${active("settings.html")}" href="${root}settings.html?edition=${edition}"><span class="acl-nav-icon">⚙</span><span>Settings</span></a>
    </nav>
  </div>
  <button id="aclDrawerLogout" class="acl-drawer-logout" type="button"><span>↪</span><span>Log out</span></button>
</aside>
<nav class="acl-mobile-bottom-nav" aria-label="Mobile navigation">
  <a href="${withEdition("modules.html")}" class="${page === "modules.html" ? "is-active" : ""}"><span>⌂</span><small>Home</small></a>
  <button id="aclMobileModulesButton" type="button"><span>▦</span><small>Menu</small></button>
  <a href="${root}progress.html?edition=${edition}" class="${page === "progress.html" ? "is-active" : ""}"><span>▤</span><small>Progress</small></a>
  <a href="${root}profile.html?edition=${edition}" class="${page === "profile.html" ? "is-active" : ""}"><span>♙</span><small>Profile</small></a>
</nav>`;
document.body.insertBefore(shell, document.body.firstChild);

const backdrop = document.getElementById("aclDrawerBackdrop");
const toggle = document.getElementById("aclDrawerToggle");
const mobile = () => matchMedia("(max-width:820px)").matches;
function openDrawer(){ if(mobile()){document.body.classList.add("drawer-open");backdrop.hidden=false;} else document.body.classList.remove("drawer-collapsed"); toggle?.setAttribute("aria-expanded","true"); }
function closeDrawer(){ if(mobile()){document.body.classList.remove("drawer-open");backdrop.hidden=true;} else document.body.classList.add("drawer-collapsed"); toggle?.setAttribute("aria-expanded","false"); }
toggle?.addEventListener("click",()=> mobile() ? (document.body.classList.contains("drawer-open") ? closeDrawer() : openDrawer()) : (document.body.classList.contains("drawer-collapsed") ? openDrawer() : closeDrawer()));
backdrop?.addEventListener("click",closeDrawer);
document.getElementById("aclMobileModulesButton")?.addEventListener("click",openDrawer);
window.addEventListener("resize",()=>{ if(!mobile()){document.body.classList.remove("drawer-open");backdrop.hidden=true;} });
document.querySelectorAll("[data-collapse-target]").forEach(btn=>btn.addEventListener("click",()=>{const target=document.getElementById(btn.dataset.collapseTarget);if(!target)return;const open=target.hidden;target.hidden=!open;btn.setAttribute("aria-expanded",String(open));const ch=btn.querySelector(".acl-chevron");if(ch)ch.textContent=open?"⌄":"›";}));

async function signOut(){ try{await supabaseClient.auth.signOut();}catch(e){console.warn(e);} location.replace(root+"login.html"); }
document.getElementById("aclHeaderLogout")?.addEventListener("click",signOut);
document.getElementById("aclDrawerLogout")?.addEventListener("click",signOut);

(async()=>{
  try{
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(!session?.user) return;
    const user=session.user;
    const {data:p}=await supabaseClient.from("profiles").select("*").eq("id",user.id).maybeSingle();
    const name=p?.display_name||p?.full_name||p?.name||user.user_metadata?.display_name||user.user_metadata?.full_name||user.email?.split("@")[0]||"Member";
    const photo=p?.avatar_url||p?.photo_url||p?.profile_photo_url||user.user_metadata?.avatar_url||user.user_metadata?.picture||"";
    ["aclHeaderUserName","aclDrawerName"].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=name;});
    const av=document.getElementById("aclDrawerAvatar");
    if(av){ if(photo) av.innerHTML=`<img src="${photo}" alt="">`; else av.textContent=name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"ACL"; }
  }catch(e){console.warn("ACL shared shell profile",e);}
})();

document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("drawer-open"))closeDrawer();});

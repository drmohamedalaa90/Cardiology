import { supabaseClient } from "./supabase-client.js";
const $=id=>document.getElementById(id);
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeHref=(value="")=>{
  const raw=String(value||"").trim();
  if(!raw)return "";
  try{
    const url=new URL(raw,location.href);
    if(!["http:","https:"].includes(url.protocol))return "";
    return url.origin===location.origin
      ? url.pathname+url.search+url.hash
      : url.toString();
  }catch{
    return "";
  }
};
let items=[];
let filter="all";
const expandedKeys=new Set();

const iconFor=kind=>{
  if(kind==="friend_request") return "👤";
  if(kind==="friend_accept") return "✓";
  if(kind==="competition") return "🏆";
  if(kind==="admin_message") return "✉";
  if(kind==="module_update") return "▤";
  if(kind==="app_update") return "↻";
  return "•";
};

const groupFor=kind=>{
  if(kind==="friend_request"||kind==="friend_accept") return "friends";
  if(kind==="competition") return "competition";
  if(kind==="module_update"||kind==="app_update"||kind==="admin_message"||kind==="announcement") return "updates";
  return "updates";
};

const when=value=>{
  if(!value)return "";
  const ms=Date.now()-new Date(value).getTime();
  if(!Number.isFinite(ms))return "";
  const min=Math.max(0,Math.floor(ms/60000));
  if(min<1)return "Just now";
  if(min<60)return min+" min ago";
  const hr=Math.floor(min/60);
  if(hr<24)return hr+" h ago";
  const d=Math.floor(hr/24);
  if(d<7)return d+" d ago";
  return new Date(value).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
};

function visibleItems(){
  return filter==="all" ? items : items.filter(item=>groupFor(item.kind)===filter);
}

function render(){
  const host=$("bnList");
  const rows=visibleItems();
  $("bnUnreadCount").textContent=String(items.filter(x=>x.is_unread).length);

  host.innerHTML=rows.length?rows.map(item=>{
    const href=safeHref(item.link_url);
    const bodyText=String(item.body||"");
    const expanded=expandedKeys.has(String(item.key));
    const needsMore=bodyText.length>145||bodyText.includes("\n");

    return `
      <article
        class="basic-notification-card ${item.is_unread?"is-unread":""} ${href?"is-clickable":""}"
        data-key="${esc(item.key)}"
        data-href="${esc(href)}"
        ${href?'role="link" tabindex="0"':''}>
        <div class="basic-notification-icon ${esc(item.kind)}">${iconFor(item.kind)}</div>
        <div class="basic-notification-copy">
          <div class="basic-notification-title-row">
            <strong>${esc(item.title||"ACL notification")}</strong>
            <span>${esc(when(item.event_at))}</span>
          </div>
          <p class="${expanded?"is-expanded":""}">${esc(bodyText)}</p>
          ${href
            ? '<span class="basic-notification-open-hint">Read more →</span>'
            : needsMore
              ? `<button class="basic-notification-read-more" type="button" data-expand-notification="${esc(item.key)}">${expanded?"Show less":"Read more"}</button>`
              : ""}
        </div>
        ${item.is_unread?'<span class="basic-unread-dot" aria-label="Unread"></span>':""}
      </article>
    `;
  }).join(""):'<div class="basic-empty-state">No notifications in this category yet.</div>';

  async function openNotificationCard(card){
    const item=items.find(x=>x.key===card.dataset.key);
    if(!item)return;

    if(item.is_unread){
      try{
        const {error}=await supabaseClient.rpc(
          "acl_mark_notification_read",
          {p_notification_key:item.key}
        );
        if(!error)item.is_unread=false;
      }catch{}
    }

    const href=safeHref(card.dataset.href);
    if(href){
      if(/^https?:\/\//i.test(href) && !href.startsWith(location.origin)){
        window.open(href,"_blank","noopener");
      }else{
        location.href=href;
      }
      return;
    }

    render();
  }

  host.querySelectorAll("[data-expand-notification]").forEach(button=>{
    button.addEventListener("click",event=>{
      event.stopPropagation();
      const key=String(button.dataset.expandNotification||"");
      if(!key)return;
      if(expandedKeys.has(key))expandedKeys.delete(key);
      else expandedKeys.add(key);
      render();
    });
  });

  host.querySelectorAll(".basic-notification-card").forEach(card=>{
    card.addEventListener("click",event=>{
      if(event.target.closest("button,a,input,select,textarea,label"))return;
      void openNotificationCard(card);
    });

    card.addEventListener("keydown",event=>{
      if(!card.dataset.href)return;
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        void openNotificationCard(card);
      }
    });
  });
}

async function load(){
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session?.user){location.replace("acl-access.html?build=20261023-clean");return}
  const {data,error}=await supabaseClient.rpc("acl_basic_notifications");
  if(error)throw error;
  items=Array.isArray(data?.items)?data.items:[];
  render();
}

document.querySelectorAll("[data-filter]").forEach(button=>{
  button.addEventListener("click",()=>{
    filter=button.dataset.filter||"all";
    document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("is-active",x===button));
    render();
  });
});

$("bnMarkAll")?.addEventListener("click",async()=>{
  const button=$("bnMarkAll");
  button.disabled=true;
  const {error}=await supabaseClient.rpc("acl_mark_all_basic_notifications_read");
  button.disabled=false;
  if(error)return;
  items.forEach(item=>item.is_unread=false);
  render();
});

load().catch(error=>{
  console.error("BASIC NOTIFICATIONS:",error);
  $("bnList").innerHTML='<div class="basic-empty-state">Could not load notifications.</div>';
});

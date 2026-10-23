import { supabaseClient } from "./supabase-client.js";
const $=id=>document.getElementById(id);
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let items=[];
let filter="all";

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
    const href=item.link_url||"#";
    return `
      <article class="basic-notification-card ${item.is_unread?"is-unread":""}" data-key="${esc(item.key)}">
        <div class="basic-notification-icon ${esc(item.kind)}">${iconFor(item.kind)}</div>
        <div class="basic-notification-copy">
          <div class="basic-notification-title-row">
            <strong>${esc(item.title||"ACL notification")}</strong>
            <span>${esc(when(item.event_at))}</span>
          </div>
          <p>${esc(item.body||"")}</p>
          ${href&&href!=="#" ? `<a href="${esc(href)}" data-open-notification="${esc(item.key)}">Open →</a>` : ""}
        </div>
        ${item.is_unread?'<span class="basic-unread-dot" aria-label="Unread"></span>':""}
      </article>
    `;
  }).join(""):'<div class="basic-empty-state">No notifications in this category yet.</div>';

  host.querySelectorAll("[data-open-notification]").forEach(link=>{
    link.addEventListener("click",async()=>{
      const key=link.dataset.openNotification;
      try{await supabaseClient.rpc("acl_mark_notification_read",{p_notification_key:key})}catch{}
    });
  });

  host.querySelectorAll(".basic-notification-card").forEach(card=>{
    card.addEventListener("click",async event=>{
      if(event.target.closest("a,button"))return;
      const item=items.find(x=>x.key===card.dataset.key);
      if(!item?.is_unread)return;
      const {error}=await supabaseClient.rpc("acl_mark_notification_read",{p_notification_key:item.key});
      if(!error){item.is_unread=false;render();}
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

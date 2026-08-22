(() => {
  const C = window.Clinic;
  if (!C || !window.ClinicPages) return;

  const esc = v => C.escape(v ?? "");
  const txt = (en, ar) => C.lang === "ar" ? ar : en;
  const isAdmin = () => !!(C.hasRole?.("owner") || C.hasRole?.("manager") || C.hasRole?.("deputy_manager"));
  const canPurchase = () => !!C.user?.id;
  const isSecretary = () => !!C.hasRole?.("secretary");

  let currentFilter = "all";
  let currentSearch = "";

  const cat = {
    drinks: ["Drinks","مشروبات"],
    cleaning: ["Cleaning","نظافة"],
    stationery: ["Stationery","أدوات مكتبية"],
    disposable: ["Disposable","مستهلكات"],
    equipment: ["Equipment","معدات"],
    other: ["Other","أخرى"]
  };

  function tpair(p){ return C.lang === "ar" ? p[1] : p[0]; }
  function itemName(i){
    return C.lang === "ar"
      ? (i.arabic_name || i.english_name || "عنصر")
      : (i.english_name || i.arabic_name || "Item");
  }

  async function rows(){
    const {data,error}=await C.sb.rpc("v62_logistics_items");
    if(error) throw error;
    return data || [];
  }

  async function criticalCount(){
    const {data,error}=await C.sb.rpc("v62_critical_logistics_count");
    if(error) throw error;
    return Number(data || 0);
  }

  function modal(html){
    const root=document.getElementById("modalRoot");
    if(!root) return null;
    root.innerHTML=html;
    root.classList.remove("hidden");
    root.querySelectorAll("[data-v62-close]").forEach(b=>{
      b.onclick=()=>{root.classList.add("hidden");root.innerHTML="";};
    });
    return root;
  }

  async function uploadImage(file){
    if(!file || !(file instanceof File) || !file.size) return null;
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
    const path=`v62/${crypto.randomUUID()}.${ext}`;
    const {error}=await C.sb.storage.from("clinic-item-images").upload(
      path,file,{upsert:false,cacheControl:"3600"}
    );
    if(error) throw error;
    return C.sb.storage.from("clinic-item-images").getPublicUrl(path).data.publicUrl;
  }

  function editItem(item=null){
    if(!isAdmin()) return;
    const root=modal(`
      <div class="modal-backdrop">
        <div class="modal-card v62-modal">
          <div class="modal-header">
            <div><span class="eyebrow">LOGISTICS</span><h3>${item?txt("Edit item","تعديل العنصر"):txt("Add item","إضافة عنصر")}</h3></div>
            <button class="icon-button" data-v62-close>✕</button>
          </div>
          <form id="v62ItemForm" class="v62-form">
            <label><span>${txt("English name","الاسم بالإنجليزية")}</span><input class="control" name="english_name" value="${esc(item?.english_name||"")}"></label>
            <label><span>${txt("Arabic name","الاسم بالعربية")}</span><input class="control" name="arabic_name" required value="${esc(item?.arabic_name||"")}"></label>
            <label><span>${txt("Category","التصنيف")}</span>
              <select class="control" name="category">
                ${Object.entries(cat).map(([k,v])=>`<option value="${k}" ${item?.category===k?"selected":""}>${esc(tpair(v))}</option>`).join("")}
              </select>
            </label>
            <label><span>${txt("Type","النوع")}</span>
              <select class="control" name="item_type">
                <option value="consumable" ${item?.item_type!=="equipment"?"selected":""}>${txt("Consumable","مستهلك")}</option>
                <option value="equipment" ${item?.item_type==="equipment"?"selected":""}>${txt("Equipment","معدات")}</option>
              </select>
            </label>
            <label><span>${txt("Current stock","المخزون الحالي")}</span><input class="control" type="number" min="0" step="1" name="stock" value="${Number(item?.available_stock??1)}"></label>
            <label><span>${txt("Item photo","صورة العنصر")}</span>
              ${item?.image_url?`<img class="v62-edit-preview" src="${esc(item.image_url)}" alt="">`:""}
              <input class="control" type="file" name="image" accept="image/*">
            </label>
            <button class="primary-button" type="submit">${txt("Save","حفظ")}</button>
          </form>
        </div>
      </div>
    `);
    const form=root?.querySelector("#v62ItemForm");
    if(!form) return;
    form.onsubmit=async e=>{
      e.preventDefault();
      const btn=form.querySelector('[type="submit"]'); btn.disabled=true;
      try{
        const fd=new FormData(form);
        let image=item?.image_url||null;
        const uploaded=await uploadImage(fd.get("image"));
        if(uploaded) image=uploaded;
        const type=String(fd.get("item_type")||"consumable");
        const {error}=await C.sb.rpc("v61_save_inventory_item",{
          p_item:item?.id||null,
          p_arabic_name:String(fd.get("arabic_name")||"").trim(),
          p_english_name:String(fd.get("english_name")||"").trim(),
          p_image_url:image,
          p_item_type:type,
          p_category:String(fd.get("category")||"other"),
          p_available_stock:Number(fd.get("stock")||0),
          p_min_stock:type==="equipment"?0:2,
          p_equipment_status:"working",
          p_maintenance_due_date:null
        });
        if(error) throw error;
        root.classList.add("hidden");root.innerHTML="";
        C.toast(txt("Item saved.","تم حفظ العنصر."));
        C.route("logistics");
      }catch(err){btn.disabled=false;C.toast(err.message,"error");}
    };
  }

  async function removeItem(item){
    if(!isAdmin() || item.system_key==="electricity") return;
    if(!confirm(txt(`Remove "${itemName(item)}"?`,`حذف "${itemName(item)}"؟`))) return;
    const {error}=await C.sb.rpc("v60_remove_inventory_item",{p_item:item.id});
    if(error) return C.toast(error.message,"error");
    C.toast(txt("Item removed.","تم حذف العنصر."));
    C.route("logistics");
  }

  async function markCritical(item, critical){
    let note = null;
    if(critical){
      note = prompt(txt(
        `Why is "${itemName(item)}" critical now? (optional)`,
        `لماذا "${itemName(item)}" حرج الآن؟ (اختياري)`
      )) || "";
    }

    const {error}=await C.sb.rpc("v62_set_inventory_critical",{
      p_item:item.id,
      p_critical:critical,
      p_note:note
    });
    if(error) return C.toast(error.message,"error");

    C.toast(critical
      ? txt("Critical alert activated.","تم تفعيل التنبيه الحرج.")
      : txt("Critical alert cleared.","تم إلغاء التنبيه الحرج.")
    );
    await updateBadges();
    C.route("logistics");
  }

  function purchaseModal(item){
    if(!canPurchase()) return;
    const root=modal(`
      <div class="modal-backdrop">
        <div class="modal-card v62-modal">
          <div class="modal-header">
            <div>
              <span class="eyebrow">RESTOCK</span>
              <h3>${txt("New stock bought","تم شراء مخزون جديد")}</h3>
            </div>
            <button class="icon-button" type="button" data-v62-close>✕</button>
          </div>

          <div class="v62-purchase-item">
            ${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : `<div>📦</div>`}
            <strong>${esc(itemName(item))}</strong>
          </div>

          <form id="v62PurchaseForm" class="v62-form">
            <label>
              <span>${txt("Quantity bought","الكمية المشتراة")}</span>
              <input class="control" type="number" min="1" step="1" name="quantity" value="1" required>
            </label>
            <label>
              <span>${txt("Amount paid (EGP)","المبلغ المدفوع (جنيه)")}</span>
              <input class="control" type="number" min="0.01" step="0.01" name="amount" required>
            </label>
            <label>
              <span>${txt("Payment method","طريقة الدفع")}</span>
              <select class="control" name="payment_method">
                <option value="cash">${txt("Cash","نقدي")}</option>
                <option value="card">${txt("Card","بطاقة")}</option>
                <option value="instapay">Instapay</option>
                <option value="bank_transfer">${txt("Bank transfer","تحويل بنكي")}</option>
                <option value="other">${txt("Other","أخرى")}</option>
              </select>
            </label>
            <label>
              <span>${txt("Note","ملاحظة")}</span>
              <textarea class="control" rows="3" name="note"></textarea>
            </label>
            <button class="primary-button" type="submit">
              ✓ ${txt("Save purchase & send to Finance","حفظ الشراء وإرساله للمصروفات")}
            </button>
          </form>
        </div>
      </div>
    `);

    const form=root?.querySelector("#v62PurchaseForm");
    if(!form) return;
    form.onsubmit=async e=>{
      e.preventDefault();
      const btn=form.querySelector('[type="submit"]');
      btn.disabled=true;
      const fd=new FormData(form);
      const {data,error}=await C.sb.rpc("v62_record_inventory_purchase",{
        p_item:item.id,
        p_units_added:Number(fd.get("quantity")),
        p_amount_paid:Number(fd.get("amount")),
        p_payment_method:String(fd.get("payment_method")),
        p_note:String(fd.get("note")||"").trim()
      });
      if(error){
        btn.disabled=false;
        return C.toast(error.message,"error");
      }
      root.classList.add("hidden"); root.innerHTML="";
      C.toast(txt(
        "Purchase saved. Critical alert cleared and expense added to Finance.",
        "تم حفظ الشراء وإلغاء التنبيه الحرج وإضافة المبلغ إلى المصروفات."
      ));
      await updateBadges();
      C.route("logistics");
    };
  }

  function criticalPopup(list){
    if(!list.length) return;
    const root=modal(`
      <div class="modal-backdrop v62-critical-backdrop">
        <div class="modal-card v62-critical-modal">
          <div class="v62-alarm-icon">🚨</div>
          <h2>${txt("Critical logistics alert","تنبيه لوجستي حرج")}</h2>
          <p>${txt(
            "These items are still marked critical. This warning will appear every time Logistics is opened until new stock is recorded.",
            "هذه العناصر ما زالت محددة كحرجة. سيظهر هذا التنبيه في كل مرة يتم فتح اللوجستيات حتى يتم تسجيل شراء مخزون جديد."
          )}</p>
          <div class="v62-critical-list">
            ${list.map(i=>`
              <div class="v62-critical-row">
                ${i.image_url?`<img src="${esc(i.image_url)}" alt="">`:`<div class="v62-mini-placeholder">📦</div>`}
                <div>
                  <strong>${esc(itemName(i))}</strong>
                  ${i.critical_note?`<small>${esc(i.critical_note)}</small>`:""}
                </div>
                ${canPurchase()?`<button class="primary-button compact" data-v62-popup-buy="${esc(i.id)}">${txt("Bought","تم الشراء")}</button>`:""}
              </div>
            `).join("")}
          </div>
          <button class="secondary-button" type="button" data-v62-close>${txt("Close","إغلاق")}</button>
        </div>
      </div>
    `);
    root?.querySelectorAll("[data-v62-popup-buy]").forEach(b=>{
      b.onclick=()=>{
        const item=list.find(x=>x.id===b.dataset.v62PopupBuy);
        if(item) purchaseModal(item);
      };
    });
  }

  async function electricityNoteModal(){
    const root=modal(`
      <div class="modal-backdrop">
        <div class="modal-card v62-modal">
          <div class="modal-header">
            <div>
              <span class="eyebrow">SATURDAY CHECK</span>
              <h3>${txt("Electricity weekly note","ملاحظة الكهرباء الأسبوعية")}</h3>
            </div>
            <button class="icon-button" type="button" data-v62-close>✕</button>
          </div>
          <p class="muted">${txt(
            "Please record the electricity note for this Saturday. You can include the meter reading, bill/payment information, or any problem noticed.",
            "يرجى تسجيل ملاحظة الكهرباء لهذا السبت. يمكن كتابة قراءة العداد أو معلومات الفاتورة/الدفع أو أي مشكلة تمت ملاحظتها."
          )}</p>
          <form id="v62ElectricityForm" class="v62-form">
            <label>
              <span>${txt("Meter reading (optional)","قراءة العداد (اختياري)")}</span>
              <input class="control" name="reading" placeholder="${txt("e.g. 12845 kWh","مثال: 12845 ك.و.س")}">
            </label>
            <label>
              <span>${txt("Saturday note","ملاحظة السبت")}</span>
              <textarea class="control" rows="5" name="note" required></textarea>
            </label>
            <button class="primary-button" type="submit">${txt("Save weekly note","حفظ الملاحظة الأسبوعية")}</button>
          </form>
        </div>
      </div>
    `);
    const form=root?.querySelector("#v62ElectricityForm");
    if(!form) return;
    form.onsubmit=async e=>{
      e.preventDefault();
      const fd=new FormData(form);
      const {error}=await C.sb.rpc("v62_submit_electricity_note",{
        p_note:String(fd.get("note")||"").trim(),
        p_meter_reading:String(fd.get("reading")||"").trim()
      });
      if(error) return C.toast(error.message,"error");
      root.classList.add("hidden"); root.innerHTML="";
      C.toast(txt("Saturday electricity note saved.","تم حفظ ملاحظة الكهرباء ليوم السبت."));
      if(C.currentPage==="logistics") C.route("logistics");
    };
  }

  async function electricityHistory(){
    const {data,error}=await C.sb.rpc("v62_electricity_notes",{p_limit:20});
    if(error) return C.toast(error.message,"error");
    modal(`
      <div class="modal-backdrop">
        <div class="modal-card v62-modal">
          <div class="modal-header">
            <h3>${txt("Electricity notes","ملاحظات الكهرباء")}</h3>
            <button class="icon-button" data-v62-close>✕</button>
          </div>
          <div class="v62-note-history">
            ${(data||[]).length ? (data||[]).map(n=>`
              <article>
                <strong>${esc(n.note_date)}</strong>
                ${n.meter_reading?`<span>⚡ ${esc(n.meter_reading)}</span>`:""}
                <p>${esc(n.note)}</p>
                <small>${esc(n.secretary_name||"")}</small>
              </article>
            `).join("") : `<div class="empty-state">${txt("No notes yet.","لا توجد ملاحظات بعد.")}</div>`}
          </div>
        </div>
      </div>
    `);
  }

  async function saturdayReminder(){
    if(!isSecretary()) return;
    const {data,error}=await C.sb.rpc("v62_electricity_note_status");
    if(error || !data?.due_today || data?.completed_today) return;

    const tryShow=()=>{
      const root=document.getElementById("modalRoot");
      if(!root || !root.classList.contains("hidden")) {
        setTimeout(tryShow,1200);
        return;
      }
      electricityNoteModal();
    };
    setTimeout(tryShow,700);
  }

  function card(item){
    const electricity=item.system_key==="electricity";
    const critical=!!item.is_critical;

    return `
      <article class="v62-item-card ${critical?"critical":""} ${electricity?"electricity":""}">
        <div class="v62-photo-wrap">
          ${item.image_url
            ? `<img src="${esc(item.image_url)}" alt="${esc(itemName(item))}" loading="lazy">`
            : `<div class="v62-photo-placeholder">${electricity?"⚡":"📦"}</div>`}
          ${critical
            ? `<span class="v62-top-state critical">🚨 ${txt("CRITICAL","حرج")}</span>`
            : `<span class="v62-top-state enough">✓ ${txt("Enough","كافٍ")}</span>`}
        </div>

        <div class="v62-name">${esc(itemName(item))}</div>
        <div class="v62-category">${esc(tpair(cat[item.category]||cat.other))}</div>

        ${electricity ? `
          <div class="v62-electricity-copy">
            <span>⚡ ${txt("Weekly Saturday check","متابعة أسبوعية كل سبت")}</span>
            ${item.last_electricity_note_date?`<small>${txt("Last note","آخر ملاحظة")}: ${esc(item.last_electricity_note_date)}</small>`:""}
          </div>
          <div class="v62-actions">
            ${isSecretary()?`<button class="primary-button compact" data-v62-electricity-note>${txt("Write note","كتابة ملاحظة")}</button>`:""}
            <button class="secondary-button compact" data-v62-electricity-history>${txt("History","السجل")}</button>
          </div>
        ` : `
          <div class="v62-stock-inline">
            <span>${txt("Stock","المخزون")}</span>
            <strong>${Number(item.available_stock||0)}</strong>
          </div>
          <div class="v62-actions">
            <button class="${critical?"danger-button":"secondary-button"} compact" data-v62-critical="${esc(item.id)}">
              ${critical ? `✓ ${txt("Clear","إنهاء")}` : `🚨 ${txt("Critical","حرج")}`}
            </button>
            ${canPurchase()?`<button class="primary-button compact" data-v62-buy="${esc(item.id)}">🛒 ${txt("Bought","تم الشراء")}</button>`:""}
            ${isAdmin()?`<button class="secondary-button compact" data-v62-edit="${esc(item.id)}">✎ ${txt("Edit","تعديل")}</button>${item.system_key!=="electricity"?`<button class="danger-button compact" data-v62-remove="${esc(item.id)}">🗑</button>`:""}`:""}
          </div>
        `}
      </article>
    `;
  }

  function filterItem(i){
    const name=`${i.arabic_name||""} ${i.english_name||""}`.toLowerCase();
    if(currentSearch && !name.includes(currentSearch.toLowerCase())) return false;
    if(currentFilter==="all") return true;
    if(currentFilter==="critical") return !!i.is_critical;
    if(currentFilter==="equipment") return i.item_type==="equipment";
    if(currentFilter.startsWith("cat:")) return i.category===currentFilter.slice(4);
    return true;
  }

  async function updateBadges(){
    let count=0;
    try{ count=await criticalCount(); }catch(e){ return; }

    const nav=document.querySelector('[data-page="logistics"]');
    if(nav){
      nav.querySelectorAll(".v44-logistics-alert,.v62-logistics-alert").forEach(x=>x.remove());
      if(count>0){
        const b=document.createElement("span");
        b.className="v62-logistics-alert";
        b.textContent="⚠";
        b.title=txt(`${count} critical logistics item(s)`,`${count} عنصر لوجستي حرج`);
        nav.appendChild(b);
      }
    }

    // Critical logistics also contributes to the main notification bell.
    const top=document.getElementById("notificationBadge");
    if(top && count>0){
      const existing=Number(top.textContent||0);
      const oldCritical=Number(top.dataset.v62Critical||0);
      const base=Math.max(0,existing-oldCritical);
      top.textContent=String(base+count);
      top.dataset.v62Critical=String(count);
      top.classList.remove("hidden");
    } else if(top){
      const existing=Number(top.textContent||0);
      const oldCritical=Number(top.dataset.v62Critical||0);
      const next=Math.max(0,existing-oldCritical);
      top.dataset.v62Critical="0";
      top.textContent=String(next);
      if(next===0) top.classList.add("hidden");
    }
  }

  async function injectNotificationDrawer(){
    let list;
    try{ list=(await rows()).filter(x=>x.is_critical); }catch(e){ return; }
    const host=document.getElementById("notificationList");
    if(!host) return;
    host.querySelectorAll(".v62-drawer-alert").forEach(x=>x.remove());
    list.reverse().forEach(i=>{
      const el=document.createElement("button");
      el.type="button";
      el.className="v62-drawer-alert";
      el.innerHTML=`
        <span class="v62-drawer-icon">🚨</span>
        <div><strong>${txt("Critical logistics","لوجستيات حرجة")}</strong><p>${esc(itemName(i))}${i.critical_note?` — ${esc(i.critical_note)}`:""}</p></div>
        <span>›</span>
      `;
      el.onclick=()=>C.route("logistics");
      host.prepend(el);
    });
  }

  const oldBuild=C.buildNavigation?.bind(C);
  if(oldBuild){
    C.buildNavigation=function(){
      oldBuild();
      setTimeout(updateBadges,0);
    };
  }

  document.getElementById("notificationButton")?.addEventListener("click",()=>{
    setTimeout(injectNotificationDrawer,150);
  });

  window.ClinicPages.logistics=async function(){
    C.setTitle(txt("Logistics","اللوجستيات"));
    const main=document.getElementById("mainContent");
    if(!main) return;

    main.innerHTML=`<section class="content-card empty-state">${txt("Loading logistics...","جارٍ تحميل اللوجستيات...")}</section>`;
    let all;
    try{ all=await rows(); }
    catch(e){main.innerHTML=`<section class="content-card empty-state">${esc(e.message)}</section>`;return;}

    const critical=all.filter(i=>i.is_critical);
    const equipment=all.filter(i=>i.item_type==="equipment");
    const filtered=all.filter(filterItem);

    main.innerHTML=`
      <section class="v62-page">
        <header class="v62-header">
          <div>
            <span class="eyebrow">CLINIC LOGISTICS</span>
            <h2>${txt("Clinic items","احتياجات العيادة")}</h2>
            <p class="muted">${txt(
              "Green means enough. Any team member can raise a red critical alarm when an item urgently needs replacement or restocking.",
              "الأخضر يعني أن الكمية كافية. يمكن لأي عضو في الفريق تفعيل إنذار أحمر حرج عندما يحتاج العنصر للشراء أو الاستبدال بشكل عاجل."
            )}</p>
          </div>
          ${isAdmin()?`<button id="v62AddItem" class="primary-button">＋ ${txt("Add item","إضافة عنصر")}</button>`:""}
        </header>

        <div class="v62-summary">
          <button data-v62-filter="all" class="${currentFilter==="all"?"active":""}"><strong>${all.length}</strong><span>${txt("All","الكل")}</span></button>
          <button data-v62-filter="critical" class="critical ${currentFilter==="critical"?"active":""}"><strong>${critical.length}</strong><span>🚨 ${txt("Critical","حرج")}</span></button>
          <button data-v62-filter="equipment" class="${currentFilter==="equipment"?"active":""}"><strong>${equipment.length}</strong><span>${txt("Equipment","معدات")}</span></button>
        </div>

        <div class="v62-toolbar">
          <input id="v62Search" class="control" placeholder="${txt("Search items...","ابحث عن عنصر...")}">
          <div class="v62-chips">
            ${Object.entries(cat).map(([k,v])=>`<button data-v62-filter="cat:${k}" class="${currentFilter===`cat:${k}`?"active":""}">${esc(tpair(v))}</button>`).join("")}
          </div>
        </div>

        <div class="v62-gallery" id="v62Grid">
          ${filtered.length?filtered.map(card).join(""):`<div class="content-card empty-state">${txt("No matching items.","لا توجد عناصر مطابقة.")}</div>`}
        </div>
      </section>
    `;

    // Re-use V61 admin item editor if available by firing the old V61 button/data convention.
    main.querySelector("#v62AddItem")?.addEventListener("click",()=>editItem(null));

    main.querySelectorAll("[data-v62-filter]").forEach(b=>b.onclick=()=>{currentFilter=b.dataset.v62Filter;C.route("logistics");});
    const search=main.querySelector("#v62Search");
    if(search){
      search.value=currentSearch;
      search.oninput=()=>{
        currentSearch=search.value.trim();
        const f=all.filter(filterItem);
        main.querySelector("#v62Grid").innerHTML=f.length?f.map(card).join(""):`<div class="content-card empty-state">${txt("No matching items.","لا توجد عناصر مطابقة.")}</div>`;
        bind();
      };
    }

    function bind(){
      main.querySelectorAll("[data-v62-critical]").forEach(b=>b.onclick=()=>{
        const i=all.find(x=>x.id===b.dataset.v62Critical); if(i) markCritical(i,!i.is_critical);
      });
      main.querySelectorAll("[data-v62-buy]").forEach(b=>b.onclick=()=>{
        const i=all.find(x=>x.id===b.dataset.v62Buy); if(i) purchaseModal(i);
      });
      main.querySelectorAll("[data-v62-electricity-note]").forEach(b=>b.onclick=electricityNoteModal);
      main.querySelectorAll("[data-v62-electricity-history]").forEach(b=>b.onclick=electricityHistory);
      main.querySelectorAll("[data-v62-edit]").forEach(b=>b.onclick=()=>{
        const i=all.find(x=>x.id===b.dataset.v62Edit); if(i) editItem(i);
      });
      main.querySelectorAll("[data-v62-remove]").forEach(b=>b.onclick=()=>{
        const i=all.find(x=>x.id===b.dataset.v62Remove); if(i) removeItem(i);
      });
    }
    bind();

    await updateBadges();
    // Required behavior: pop up every time Logistics is opened while critical remains.
    if(critical.length) setTimeout(()=>criticalPopup(critical),180);
  };

  // Realtime critical badges and page refresh.
  function installRealtime(){
    if(window.__v62LogisticsRealtime) return;
    window.__v62LogisticsRealtime=C.sb.channel(`clinic-v62-logistics-${C.user?.id||"user"}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"clinic_inventory_items"},()=>{
        updateBadges();
        if(C.currentPage==="logistics") C.route("logistics");
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"clinic_weekly_utility_notes"},()=>{
        if(C.currentPage==="logistics") C.route("logistics");
      })
      .subscribe();
  }

  const wait=setInterval(()=>{
    if(C.user?.id){
      clearInterval(wait);
      installRealtime();
      updateBadges();
      saturdayReminder();
    }
  },300);

  setInterval(updateBadges,30000);

  const style=document.createElement("style");
  style.textContent=`
    [data-page="logistics"]{position:relative}
    .v62-logistics-alert{margin-inline-start:auto;width:25px;height:25px;border-radius:999px;display:grid;place-items:center;background:#ff9d00;color:#fff;font-size:13px;box-shadow:0 0 0 4px rgba(255,157,0,.13)}
    .v62-page{display:grid;gap:15px}.v62-header{display:flex;justify-content:space-between;align-items:flex-end;gap:15px;flex-wrap:wrap}.v62-header h2{margin:3px 0}
    .v62-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.v62-summary button{background:#fff;border:1px solid rgba(17,34,56,.1);border-radius:14px;padding:11px 13px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}.v62-summary button strong{font-size:20px}.v62-summary button span{font-size:12px;color:#667085}.v62-summary button.active{box-shadow:0 0 0 2px rgba(17,34,56,.09);border-color:#112238}.v62-summary button.critical strong,.v62-summary button.critical span{color:#b42318}
    .v62-toolbar{display:grid;gap:9px}.v62-toolbar>.control{max-width:420px}.v62-chips{display:flex;gap:7px;flex-wrap:wrap}.v62-chips button{border:1px solid rgba(17,34,56,.12);background:#fff;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer}.v62-chips button.active{background:#112238;color:#fff}
    .v62-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:13px}.v62-item-card{background:#fff;border:1px solid rgba(17,34,56,.1);border-radius:18px;padding:10px;box-shadow:0 7px 20px rgba(17,34,56,.05)}.v62-item-card.critical{border:2px solid #e5484d;box-shadow:0 8px 24px rgba(229,72,77,.17)}
    .v62-photo-wrap{position:relative;aspect-ratio:1/1;border-radius:13px;overflow:hidden;background:#f3f5f7}.v62-photo-wrap img{width:100%;height:100%;object-fit:cover}.v62-photo-placeholder{width:100%;height:100%;display:grid;place-items:center;font-size:48px}
    .v62-top-state{position:absolute;right:8px;top:8px;border-radius:999px;padding:7px 9px;font-weight:900;font-size:11px;box-shadow:0 3px 12px rgba(0,0,0,.12)}.v62-top-state.enough{background:#e9f8ef;color:#137a3d}.v62-top-state.critical{background:#d92d20;color:#fff;animation:v62pulse 1.1s infinite alternate}@keyframes v62pulse{from{transform:scale(1)}to{transform:scale(1.07)}}
    .v62-name{text-align:center;font-weight:800;padding:9px 3px 2px;min-height:42px;display:grid;place-items:center}.v62-category{text-align:center;color:#7a8699;font-size:11px;margin-bottom:7px}.v62-stock-inline{display:flex;justify-content:space-between;padding:7px 2px;border-top:1px solid #eef0f3;font-size:12px}.v62-stock-inline strong{font-size:15px}
    .v62-actions{display:flex;gap:6px;flex-wrap:wrap}.v62-actions button{flex:1;min-width:78px;padding:8px 7px;font-size:11px}
    .v62-electricity-copy{display:grid;gap:3px;background:#fff8dc;border:1px solid #f7d76a;border-radius:10px;padding:8px;margin-bottom:7px;font-size:11px}.v62-electricity-copy span{font-weight:800;color:#7a5700}.v62-electricity-copy small{color:#7a6a39}
    .v62-critical-backdrop{backdrop-filter:blur(4px)}.v62-critical-modal{max-width:650px;border:2px solid #e5484d}.v62-alarm-icon{font-size:50px;text-align:center;animation:v62pulse .8s infinite alternate}.v62-critical-modal h2{text-align:center;color:#b42318}.v62-critical-modal>p{text-align:center;color:#5d6674}
    .v62-critical-list{display:grid;gap:8px;margin:16px 0}.v62-critical-row{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;padding:9px;border-radius:12px;background:#fff3f2;border:1px solid #ffd0cc}.v62-critical-row img,.v62-mini-placeholder{width:52px;height:52px;border-radius:9px;object-fit:cover;display:grid;place-items:center;background:#fff}.v62-critical-row div:nth-child(2){display:grid;gap:3px}.v62-critical-row small{color:#8a3b35}
    .v62-modal{max-width:560px}.v62-form{display:grid;gap:13px}.v62-form label{display:grid;gap:6px}.v62-edit-preview{width:150px;height:150px;object-fit:cover;border-radius:12px;border:1px solid #e2e6eb}.v62-purchase-item{display:flex;align-items:center;gap:10px;background:#f6f8fa;border-radius:12px;padding:10px;margin-bottom:12px}.v62-purchase-item img,.v62-purchase-item>div{width:62px;height:62px;border-radius:10px;object-fit:cover;display:grid;place-items:center;background:#fff}
    .v62-note-history{display:grid;gap:8px;max-height:60vh;overflow:auto}.v62-note-history article{padding:10px;border:1px solid #e7eaf0;border-radius:12px;display:grid;gap:4px}.v62-note-history article p{margin:2px 0;white-space:pre-wrap}.v62-note-history article span,.v62-note-history article small{color:#687386;font-size:11px}
    .v62-drawer-alert{width:100%;border:0;border-bottom:1px solid #f2d5d2;background:#fff4f3;padding:12px;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;text-align:start;cursor:pointer}.v62-drawer-icon{font-size:23px}.v62-drawer-alert p{margin:3px 0 0;font-size:12px;color:#7a3a35}
    @media(max-width:700px){.v62-summary{grid-template-columns:1fr}.v62-gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.v62-header .primary-button{width:100%}.v62-critical-row{grid-template-columns:46px 1fr}.v62-critical-row button{grid-column:1/-1}}
  `;
  document.head.appendChild(style);
})();
(() => {

  const C =
    window.Clinic;


  if(!C){
    return;
  }


  function esc(value){
    return C.escape(value ?? '');
  }


  function money(value){
    return C.formatMoney(
      Number(value || 0)
    );
  }


  function isOwner(){
    return C.hasRole?.('owner');
  }


  async function items(){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v44_logistics_items'
      );


    if(error){
      throw error;
    }


    return data || [];
  }


  async function requests(
    status=null
  ){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v44_logistics_requests',
        {
          p_status:
            status
        }
      );


    if(error){
      throw error;
    }


    return data || [];
  }


  async function alertCount(){

    const {
      data,
      error
    } =
      await C.sb.rpc(
        'v44_logistics_alert_count'
      );


    if(error){
      throw error;
    }


    return Number(data || 0);
  }


  async function uploadImage(file){

    if(!file){
      return null;
    }


    const ext =
      (
        file.name.split('.').pop()
        ||
        'jpg'
      ).toLowerCase();


    const path =
      `${crypto.randomUUID()}.${ext}`;


    const {
      error
    } =
      await C.sb.storage
        .from(
          'clinic-item-images'
        )
        .upload(
          path,
          file,
          {
            upsert:false,
            cacheControl:'3600'
          }
        );


    if(error){
      throw error;
    }


    const {
      data
    } =
      C.sb.storage
        .from(
          'clinic-item-images'
        )
        .getPublicUrl(
          path
        );


    return data.publicUrl;
  }


  function itemName(item){

    if(C.lang === 'ar'){

      return (
        item.arabic_name
        ||
        item.english_name
        ||
        'عنصر'
      );
    }


    return (
      item.english_name
      ||
      item.arabic_name
      ||
      'Item'
    );
  }


  // =========================================================
  // ORANGE ALERT BESIDE LOGISTICS FOR EVERYONE
  // =========================================================

  async function updateLogisticsBadge(){

    const navItem =
      document.querySelector(
        '[data-page="logistics"]'
      );


    if(!navItem){
      return;
    }


    let count = 0;


    try{

      count =
        await alertCount();

    }
    catch(error){

      console.warn(
        'Logistics alert count failed',
        error
      );

      return;
    }


    let badge =
      navItem.querySelector(
        '.v44-logistics-alert'
      );


    if(
      count <= 0
    ){

      badge?.remove();

      return;
    }


    if(!badge){

      badge =
        document.createElement(
          'span'
        );


      badge.className =
        'v44-logistics-alert';


      navItem.appendChild(
        badge
      );
    }


    // V80: show only a warning icon, never the total item/count number.
    badge.textContent = '⚠';
    badge.title =
      C.lang === 'ar'
        ? `${count} تنبيه لوجستي`
        : `${count} logistics alert${count === 1 ? '' : 's'}`;
  }


  const oldBuildNavigation =
    C.buildNavigation.bind(C);


  C.buildNavigation =
    function(){

      oldBuildNavigation();


      setTimeout(
        updateLogisticsBadge,
        0
      );
    };


  // =========================================================
  // MODALS
  // =========================================================

  function modal(html){

    const root =
      document.getElementById(
        'modalRoot'
      );


    if(!root){
      return null;
    }


    root.innerHTML = html;


    root.classList.remove(
      'hidden'
    );


    root
      .querySelectorAll(
        '[data-close-modal]'
      )
      .forEach(
        button=>{

          button.onclick =
            ()=>{

              root.classList.add(
                'hidden'
              );


              root.innerHTML =
                '';
            };
        }
      );


    return root;
  }


  function addOrEditItem(
    existing=null
  ){

    const root =
      modal(`
        <div class="modal-backdrop">
          <div class="modal-card v44-item-modal">

            <div class="modal-header">
              <h3>
                ${
                  existing
                    ? (
                        C.lang==='ar'
                          ? 'تعديل عنصر'
                          : 'Edit clinic item'
                      )
                    : (
                        C.lang==='ar'
                          ? 'إضافة عنصر للعيادة'
                          : 'Add clinic item'
                      )
                }
              </h3>

              <button
                type="button"
                class="icon-button"
                data-close-modal
              >
                ✕
              </button>
            </div>


            <form
              id="v44ItemForm"
              class="v44-item-form"
            >

              <label>
                <span>
                  ${
                    C.lang==='ar'
                      ? 'الاسم بالعربية'
                      : 'Arabic name'
                  }
                </span>

                <input
                  name="arabic_name"
                  class="control"
                  required
                  value="${esc(
                    existing?.arabic_name
                    ||
                    ''
                  )}"
                >
              </label>


              <label>
                <span>
                  ${
                    C.lang==='ar'
                      ? 'الاسم بالإنجليزية'
                      : 'English name'
                  }
                </span>

                <input
                  name="english_name"
                  class="control"
                  value="${esc(
                    existing?.english_name
                    ||
                    ''
                  )}"
                >
              </label>


              <label class="v44-image-field">
                <span>
                  ${
                    C.lang==='ar'
                      ? 'صورة العنصر'
                      : 'Item image'
                  }
                </span>

                ${
                  existing?.image_url
                    ? `
                        <img
                          class="v44-form-preview"
                          src="${esc(
                            existing.image_url
                          )}"
                          alt=""
                        >
                      `
                    : ''
                }

                <input
                  name="image"
                  class="control"
                  type="file"
                  accept="image/*"
                >
              </label>


              <label>
                <span>
                  ${
                    C.lang==='ar'
                      ? 'المخزون المتاح'
                      : 'Available stock'
                  }
                </span>

                <input
                  name="stock"
                  class="control"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value="${Number(
                    existing?.available_stock
                    ||
                    0
                  )}"
                >
              </label>


              <div class="form-actions v44-full">

                <button
                  class="primary-button"
                  type="submit"
                >
                  ${
                    C.lang==='ar'
                      ? 'حفظ'
                      : 'Save'
                  }
                </button>

              </div>

            </form>

          </div>
        </div>
      `);


    root
      .querySelector(
        '#v44ItemForm'
      )
      .onsubmit =
        async event=>{

          event.preventDefault();


          const form =
            event.currentTarget;


          const fd =
            new FormData(
              form
            );


          const file =
            fd.get(
              'image'
            );


          const button =
            form.querySelector(
              '[type="submit"]'
            );


          button.disabled =
            true;


          try{

            let imageUrl =
              existing?.image_url
              ||
              null;


            if(
              file
              &&
              file instanceof File
              &&
              file.size
            ){

              imageUrl =
                await uploadImage(
                  file
                );
            }


            const {
              error
            } =
              await C.sb.rpc(
                'v44_save_inventory_item',
                {
                  p_item:
                    existing?.id
                    ||
                    null,

                  p_arabic_name:
                    String(
                      fd.get(
                        'arabic_name'
                      )
                      ||
                      ''
                    ).trim(),

                  p_english_name:
                    String(
                      fd.get(
                        'english_name'
                      )
                      ||
                      ''
                    ).trim(),

                  p_image_url:
                    imageUrl,

                  p_available_stock:
                    Number(
                      fd.get(
                        'stock'
                      )
                      ||
                      0
                    )
                }
              );


            if(error){
              throw error;
            }


            root.classList.add(
              'hidden'
            );


            root.innerHTML =
              '';


            C.toast(
              C.lang==='ar'
                ? 'تم حفظ العنصر.'
                : 'Item saved.'
            );


            C.route(
              'logistics'
            );

          }
          catch(error){

            C.toast(
              error.message,
              'error'
            );


            button.disabled =
              false;
          }
        };
  }


  function requestItem(
    item
  ){

    const root =
      modal(`
        <div class="modal-backdrop">
          <div class="modal-card">

            <div class="modal-header">
              <h3>
                ${
                  C.lang==='ar'
                    ? 'طلب عنصر'
                    : 'Request item'
                }
              </h3>

              <button
                type="button"
                class="icon-button"
                data-close-modal
              >
                ✕
              </button>
            </div>


            <form
              id="v44RequestForm"
              class="form-grid"
            >

              <div class="v44-request-item full-span">

                ${
                  item.image_url
                    ? `
                        <img
                          src="${esc(
                            item.image_url
                          )}"
                          alt=""
                        >
                      `
                    : `
                        <div class="v44-placeholder">
                          📦
                        </div>
                      `
                }

                <div>
                  <strong>
                    ${esc(
                      itemName(
                        item
                      )
                    )}
                  </strong>

                  <small>
                    ${
                      C.lang==='ar'
                        ? 'المخزون الحالي:'
                        : 'Current stock:'
                    }
                    ${Number(
                      item.available_stock
                    )}
                  </small>
                </div>
              </div>


              <label>
                ${
                  C.lang==='ar'
                    ? 'الكمية المطلوبة'
                    : 'Requested quantity'
                }

                <input
                  name="quantity"
                  class="control"
                  type="number"
                  min="1"
                  step="1"
                  value="1"
                  required
                >
              </label>


              <label class="full-span">
                ${
                  C.lang==='ar'
                    ? 'سبب الطلب (اختياري)'
                    : 'Reason (optional)'
                }

                <textarea
                  name="reason"
                  class="control"
                  rows="3"
                ></textarea>
              </label>


              <div class="form-actions full-span">

                <button
                  class="primary-button"
                  type="submit"
                >
                  ${
                    C.lang==='ar'
                      ? 'إرسال الطلب'
                      : 'Send request'
                  }
                </button>

              </div>

            </form>

          </div>
        </div>
      `);


    root
      .querySelector(
        '#v44RequestForm'
      )
      .onsubmit =
        async event=>{

          event.preventDefault();


          const fd =
            new FormData(
              event.currentTarget
            );


          const {
            error
          } =
            await C.sb.rpc(
              'v44_request_inventory_item',
              {
                p_item:
                  item.id,

                p_quantity:
                  Number(
                    fd.get(
                      'quantity'
                    )
                    ||
                    1
                  ),

                p_reason:
                  String(
                    fd.get(
                      'reason'
                    )
                    ||
                    ''
                  ).trim()
              }
            );


          if(error){

            return C.toast(
              error.message,
              'error'
            );
          }


          root.classList.add(
            'hidden'
          );


          root.innerHTML =
            '';


          C.toast(
            C.lang==='ar'
              ? 'تم إرسال الطلب للمالك.'
              : 'Request sent to owner.'
          );


          await updateLogisticsBadge();


          C.route(
            'logistics'
          );
        };
  }


  function reviewRequest(
    request,
    action
  ){

    const note =
      prompt(
        action === 'approve'
          ? (
              C.lang==='ar'
                ? 'ملاحظة المالك عند الموافقة (اختياري)'
                : 'Owner note for approval (optional)'
            )
          : (
              C.lang==='ar'
                ? 'سبب الرفض'
                : 'Reason for rejection'
            ),
        ''
      );


    if(
      action === 'reject'
      &&
      note === null
    ){
      return;
    }


    C.sb.rpc(
      'v44_review_inventory_request',
      {
        p_request:
          request.id,

        p_action:
          action,

        p_owner_note:
          note
          ||
          ''
      }
    )
    .then(
      (
        {
          error
        }
      )=>{

        if(error){

          return C.toast(
            error.message,
            'error'
          );
        }


        C.toast(
          action === 'approve'
            ? (
                C.lang==='ar'
                  ? 'تمت الموافقة على الطلب.'
                  : 'Request approved.'
              )
            : (
                C.lang==='ar'
                  ? 'تم رفض الطلب.'
                  : 'Request rejected.'
              )
        );


        C.route(
          'logistics'
        );
      }
    );
  }


  function purchaseItem(
    item,
    request=null
  ){

    const root =
      modal(`
        <div class="modal-backdrop">
          <div class="modal-card">

            <div class="modal-header">
              <h3>
                ${
                  C.lang==='ar'
                    ? 'تسجيل شراء وإضافة مخزون'
                    : 'Record purchase & add stock'
                }
              </h3>

              <button
                type="button"
                class="icon-button"
                data-close-modal
              >
                ✕
              </button>
            </div>


            <form
              id="v44PurchaseForm"
              class="form-grid"
            >

              <div class="v44-purchase-summary full-span">
                <strong>
                  ${esc(
                    itemName(
                      item
                    )
                  )}
                </strong>

                <span>
                  ${
                    C.lang==='ar'
                      ? 'المخزون الحالي:'
                      : 'Current stock:'
                  }
                  ${Number(
                    item.available_stock
                  )}
                </span>

                ${
                  request
                    ? `
                        <span>
                          ${
                            C.lang==='ar'
                              ? 'الطلب المعتمد:'
                              : 'Approved request:'
                          }
                          ${Number(
                            request.requested_quantity
                          )}
                        </span>
                      `
                    : ''
                }
              </div>


              <label>
                ${
                  C.lang==='ar'
                    ? 'عدد الوحدات الجديدة'
                    : 'New units added'
                }

                <input
                  name="units"
                  class="control"
                  type="number"
                  min="1"
                  step="1"
                  value="${Number(
                    request?.requested_quantity
                    ||
                    1
                  )}"
                  required
                >
              </label>


              <label>
                ${
                  C.lang==='ar'
                    ? 'المبلغ المدفوع'
                    : 'Amount paid'
                }

                <input
                  name="amount"
                  class="control"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                >
              </label>


              <label class="full-span">
                ${
                  C.lang==='ar'
                    ? 'ملاحظة الشراء (اختياري)'
                    : 'Purchase note (optional)'
                }

                <textarea
                  name="note"
                  class="control"
                  rows="3"
                ></textarea>
              </label>


              <div class="form-actions full-span">

                <button
                  type="submit"
                  class="primary-button"
                >
                  ${
                    C.lang==='ar'
                      ? 'تأكيد الشراء وتحديث المخزون'
                      : 'Confirm purchase & update stock'
                  }
                </button>

              </div>

            </form>

          </div>
        </div>
      `);


    root
      .querySelector(
        '#v44PurchaseForm'
      )
      .onsubmit =
        async event=>{

          event.preventDefault();


          const fd =
            new FormData(
              event.currentTarget
            );


          const {
            data,
            error
          } =
            await C.sb.rpc(
              'v44_record_inventory_purchase',
              {
                p_item:
                  item.id,

                p_request:
                  request?.id
                  ||
                  null,

                p_units_added:
                  Number(
                    fd.get(
                      'units'
                    )
                    ||
                    0
                  ),

                p_amount_paid:
                  Number(
                    fd.get(
                      'amount'
                    )
                    ||
                    0
                  ),

                p_note:
                  String(
                    fd.get(
                      'note'
                    )
                    ||
                    ''
                  ).trim()
              }
            );


          if(error){

            return C.toast(
              error.message,
              'error'
            );
          }


          root.classList.add(
            'hidden'
          );


          root.innerHTML =
            '';


          C.toast(
            `${
              C.lang==='ar'
                ? 'تم تحديث المخزون إلى'
                : 'Stock updated to'
            } ${
              Number(
                data?.stock_after
                ||
                0
              )
            }`
          );


          C.route(
            'logistics'
          );
        };
  }


  // =========================================================
  // PAGE
  // =========================================================

  window.ClinicPages.logistics =
    async function(){

      C.setTitle(
        C.lang==='ar'
          ? 'اللوجستيات والمخزون'
          : 'Logistics & Inventory'
      );


      const main =
        document.getElementById(
          'mainContent'
        );


      main.innerHTML = `
        <section class="content-card empty-state">
          ${
            C.lang==='ar'
              ? 'جارٍ تحميل المخزون...'
              : 'Loading inventory...'
          }
        </section>
      `;


      let itemRows;
      let requestRows;


      try{

        [
          itemRows,
          requestRows
        ] =
          await Promise.all([
            items(),
            requests(null)
          ]);

      }
      catch(error){

        main.innerHTML = `
          <section class="content-card empty-state">
            ${esc(
              error.message
            )}
          </section>
        `;

        return;
      }


      const pending =
        requestRows.filter(
          row=>
            row.status ===
            'pending'
        );


      const approved =
        requestRows.filter(
          row=>
            row.status ===
            'approved'
        );


      main.innerHTML = `
        <section class="page-toolbar">

          <div>
            <span class="eyebrow">
              INVENTORY
            </span>

            <h2>
              ${
                C.lang==='ar'
                  ? 'اللوجستيات والمخزون'
                  : 'Logistics & Inventory'
              }
            </h2>

            <p class="muted">
              ${
                C.lang==='ar'
                  ? 'المخزون الحالي والطلبات والشراء في مكان واحد.'
                  : 'Current stock, requests and purchasing in one place.'
              }
            </p>
          </div>


          ${
            isOwner()
              ? `
                  <button
                    id="v44AddItem"
                    type="button"
                    class="primary-button"
                  >
                    ${
                      C.lang==='ar'
                        ? '+ إضافة عنصر'
                        : '+ Add item'
                    }
                  </button>
                `
              : ''
          }

        </section>


        ${
          pending.length
            ? `
                <section class="v44-alert-strip">
                  <span class="v44-orange-dot"></span>

                  <strong>
                    ${pending.length}
                    ${
                      C.lang==='ar'
                        ? ' طلب ينتظر مراجعة المالك'
                        : ' request(s) waiting for owner review'
                    }
                  </strong>
                </section>
              `
            : ''
        }


        <section class="v44-items-grid">

          ${itemRows.map(
            item=>{

              const urgent =
                Number(
                  item.available_stock
                ) <= 1
                ||
                Number(
                  item.pending_requests
                ) > 0
                ||
                Number(
                  item.approved_requests
                ) > 0;


              return `
                <article class="v44-item-card ${
                  urgent
                    ? 'urgent'
                    : ''
                }">

                  <div class="v44-image-box">

                    ${
                      item.image_url
                        ? `
                            <img
                              src="${esc(
                                item.image_url
                              )}"
                              alt=""
                            >
                          `
                        : `
                            <div class="v44-placeholder">
                              📦
                            </div>
                          `
                    }

                    ${
                      urgent
                        ? `
                            <span class="v44-card-alert"></span>
                          `
                        : ''
                    }

                  </div>


                  <div class="v44-item-body">

                    <div class="v44-item-title">
                      <strong>
                        ${esc(
                          item.arabic_name
                        )}
                      </strong>

                      ${
                        item.english_name
                          ? `
                              <span>
                                ${esc(
                                  item.english_name
                                )}
                              </span>
                            `
                          : ''
                      }
                    </div>


                    <div class="v44-stock-row">

                      <span>
                        ${
                          C.lang==='ar'
                            ? 'المخزون المتاح'
                            : 'Available stock'
                        }
                      </span>

                      <strong class="${
                        Number(
                          item.available_stock
                        ) <= 1
                          ? 'low'
                          : ''
                      }">
                        ${Number(
                          item.available_stock
                        )}
                      </strong>

                    </div>


                    ${
                      Number(
                        item.pending_requests
                      ) > 0
                      ||
                      Number(
                        item.approved_requests
                      ) > 0
                        ? `
                            <div class="v44-request-state">
                              ${
                                Number(
                                  item.pending_requests
                                ) > 0
                                  ? `
                                      <span>
                                        ${Number(
                                          item.pending_requests
                                        )}
                                        ${
                                          C.lang==='ar'
                                            ? ' طلب معلق'
                                            : ' pending'
                                        }
                                      </span>
                                    `
                                  : ''
                              }

                              ${
                                Number(
                                  item.approved_requests
                                ) > 0
                                  ? `
                                      <span class="approved">
                                        ${Number(
                                          item.approved_requests
                                        )}
                                        ${
                                          C.lang==='ar'
                                            ? ' معتمد'
                                            : ' approved'
                                        }
                                      </span>
                                    `
                                  : ''
                              }
                            </div>
                          `
                        : ''
                    }


                    <div class="v44-item-actions">

                      <button
                        type="button"
                        class="secondary-button compact"
                        data-v44-request="${item.id}"
                      >
                        ${
                          C.lang==='ar'
                            ? 'طلب العنصر'
                            : 'Request'
                        }
                      </button>


                      ${
                        isOwner()
                          ? `
                              <button
                                type="button"
                                class="secondary-button compact"
                                data-v44-edit="${item.id}"
                              >
                                ${
                                  C.lang==='ar'
                                    ? 'تعديل'
                                    : 'Edit'
                                }
                              </button>

                              <button
                                type="button"
                                class="primary-button compact"
                                data-v44-buy="${item.id}"
                              >
                                ${
                                  C.lang==='ar'
                                    ? 'تسجيل شراء'
                                    : 'Record purchase'
                                }
                              </button>
                            `
                          : ''
                      }

                    </div>

                  </div>

                </article>
              `;
            }
          ).join('')}

        </section>


        ${
          isOwner()
            ? `
                <section class="content-card v44-owner-requests">

                  <div class="section-head">

                    <div>
                      <span class="eyebrow">
                        OWNER APPROVAL
                      </span>

                      <h3>
                        ${
                          C.lang==='ar'
                            ? 'طلبات تنتظر موافقتي'
                            : 'Requests waiting for my approval'
                        }
                      </h3>
                    </div>

                  </div>


                  ${
                    pending.length
                      ? `
                          <div class="stack-list">

                            ${pending.map(
                              request=>`
                                <article class="list-card v44-request-card">

                                  <div class="v44-request-main">

                                    ${
                                      request.image_url
                                        ? `
                                            <img
                                              src="${esc(
                                                request.image_url
                                              )}"
                                              alt=""
                                            >
                                          `
                                        : `
                                            <div class="v44-small-placeholder">
                                              📦
                                            </div>
                                          `
                                    }

                                    <div>
                                      <strong>
                                        ${esc(
                                          request.item_name
                                        )}
                                      </strong>

                                      <div class="subline">
                                        ${
                                          C.lang==='ar'
                                            ? 'طلب بواسطة'
                                            : 'Requested by'
                                        }
                                        ${esc(
                                          request.requested_by_name
                                        )}
                                        •
                                        ${
                                          C.lang==='ar'
                                            ? 'الكمية'
                                            : 'Qty'
                                        }
                                        ${Number(
                                          request.requested_quantity
                                        )}
                                      </div>

                                      ${
                                        request.reason
                                          ? `
                                              <p>
                                                ${esc(
                                                  request.reason
                                                )}
                                              </p>
                                            `
                                          : ''
                                      }
                                    </div>

                                  </div>


                                  <div class="v44-review-actions">

                                    <button
                                      type="button"
                                      class="primary-button compact"
                                      data-v44-approve="${request.id}"
                                    >
                                      ${
                                        C.lang==='ar'
                                          ? '✓ موافقة'
                                          : '✓ Approve'
                                      }
                                    </button>

                                    <button
                                      type="button"
                                      class="danger-button compact"
                                      data-v44-reject="${request.id}"
                                    >
                                      ${
                                        C.lang==='ar'
                                          ? 'رفض'
                                          : 'Reject'
                                      }
                                    </button>

                                  </div>

                                </article>
                              `
                            ).join('')}

                          </div>
                        `
                      : `
                          <div class="empty-state">
                            ${
                              C.lang==='ar'
                                ? 'لا توجد طلبات معلقة.'
                                : 'No pending requests.'
                            }
                          </div>
                        `
                  }

                </section>


                ${
                  approved.length
                    ? `
                        <section class="content-card">

                          <div class="section-head">
                            <div>
                              <span class="eyebrow">
                                APPROVED — READY TO BUY
                              </span>

                              <h3>
                                ${
                                  C.lang==='ar'
                                    ? 'طلبات وافقت عليها وتنتظر الشراء'
                                    : 'Approved requests awaiting purchase'
                                }
                              </h3>
                            </div>
                          </div>


                          <div class="stack-list">

                            ${approved.map(
                              request=>`
                                <article class="list-card">

                                  <div>
                                    <strong>
                                      ${esc(
                                        request.item_name
                                      )}
                                    </strong>

                                    <div class="subline">
                                      ${esc(
                                        request.requested_by_name
                                      )}
                                      •
                                      Qty
                                      ${Number(
                                        request.requested_quantity
                                      )}
                                    </div>
                                  </div>


                                  <button
                                    type="button"
                                    class="primary-button compact"
                                    data-v44-purchase-request="${request.id}"
                                  >
                                    ${
                                      C.lang==='ar'
                                        ? 'تم الشراء'
                                        : 'Bought / add stock'
                                    }
                                  </button>

                                </article>
                              `
                            ).join('')}

                          </div>

                        </section>
                      `
                    : ''
                }
              `
            : ''
        }
      `;


      document
        .getElementById(
          'v44AddItem'
        )
        ?.addEventListener(
          'click',
          ()=>addOrEditItem()
        );


      main
        .querySelectorAll(
          '[data-v44-request]'
        )
        .forEach(
          button=>{

            button.onclick =
              ()=>{

                const item =
                  itemRows.find(
                    row=>
                      row.id ===
                      button.dataset
                        .v44Request
                  );


                if(item){
                  requestItem(item);
                }
              };
          }
        );


      main
        .querySelectorAll(
          '[data-v44-edit]'
        )
        .forEach(
          button=>{

            button.onclick =
              ()=>{

                const item =
                  itemRows.find(
                    row=>
                      row.id ===
                      button.dataset
                        .v44Edit
                  );


                if(item){
                  addOrEditItem(item);
                }
              };
          }
        );


      main
        .querySelectorAll(
          '[data-v44-buy]'
        )
        .forEach(
          button=>{

            button.onclick =
              ()=>{

                const item =
                  itemRows.find(
                    row=>
                      row.id ===
                      button.dataset
                        .v44Buy
                  );


                if(item){
                  purchaseItem(item);
                }
              };
          }
        );


      main
        .querySelectorAll(
          '[data-v44-approve]'
        )
        .forEach(
          button=>{

            button.onclick =
              ()=>{

                const request =
                  pending.find(
                    row=>
                      row.id ===
                      button.dataset
                        .v44Approve
                  );


                if(request){
                  reviewRequest(
                    request,
                    'approve'
                  );
                }
              };
          }
        );


      main
        .querySelectorAll(
          '[data-v44-reject]'
        )
        .forEach(
          button=>{

            button.onclick =
              ()=>{

                const request =
                  pending.find(
                    row=>
                      row.id ===
                      button.dataset
                        .v44Reject
                  );


                if(request){
                  reviewRequest(
                    request,
                    'reject'
                  );
                }
              };
          }
        );


      main
        .querySelectorAll(
          '[data-v44-purchase-request]'
        )
        .forEach(
          button=>{

            button.onclick =
              ()=>{

                const request =
                  approved.find(
                    row=>
                      row.id ===
                      button.dataset
                        .v44PurchaseRequest
                  );


                const item =
                  itemRows.find(
                    row=>
                      row.id ===
                      request?.item_id
                  );


                if(
                  request
                  &&
                  item
                ){

                  purchaseItem(
                    item,
                    request
                  );
                }
              };
          }
        );


      await updateLogisticsBadge();
    };


  // =========================================================
  // REALTIME
  // =========================================================

  function installRealtime(){

    if(
      window
        .__clinicV44LogisticsRealtime
    ){
      return;
    }


    window
      .__clinicV44LogisticsRealtime =
        C.sb
          .channel(
            `clinic-v44-logistics-${
              C.user?.id
              ||
              'user'
            }`
          )

          .on(
            'postgres_changes',
            {
              event:'*',
              schema:'public',
              table:
                'clinic_inventory_items'
            },
            ()=>{
              updateLogisticsBadge();

              if(
                C.currentPage ===
                  'logistics'
              ){
                C.route(
                  'logistics'
                );
              }
            }
          )

          .on(
            'postgres_changes',
            {
              event:'*',
              schema:'public',
              table:
                'clinic_inventory_requests'
            },
            ()=>{
              updateLogisticsBadge();

              if(
                C.currentPage ===
                  'logistics'
              ){
                C.route(
                  'logistics'
                );
              }
            }
          )

          .subscribe();
  }


  const wait =
    setInterval(
      ()=>{

        if(
          C.user?.id
        ){

          clearInterval(
            wait
          );


          installRealtime();


          updateLogisticsBadge();
        }

      },
      300
    );


  setInterval(
    updateLogisticsBadge,
    30000
  );


  // =========================================================
  // STYLES
  // =========================================================

  const style =
    document.createElement(
      'style'
    );


  style.textContent = `
    [data-page="logistics"] {
      position: relative;
    }

    .v44-logistics-alert {
      width: 24px;
      min-width: 24px;
      height: 24px;
      display: inline-grid;
      place-items: center;
      margin-inline-start: auto;
      padding: 0;
      border-radius: 999px;
      background: #f59e0b;
      color: #ffffff;
      font-size: 12px;
      font-weight: 900;
      box-shadow:
        0 0 0 3px
        rgba(
          245,
          158,
          11,
          .13
        );
    }

    .v44-alert-strip {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 14px;
      padding: 11px 13px;
      border: 1px solid #f5c76f;
      border-radius: 12px;
      background: #fff8e8;
      color: #9a5a00;
    }

    .v44-orange-dot,
    .v44-card-alert {
      width: 12px;
      height: 12px;
      display: block;
      border-radius: 999px;
      background: #f59e0b;
      box-shadow:
        0 0 0 4px
        rgba(
          245,
          158,
          11,
          .14
        );
    }

    .v44-items-grid {
      display: grid;
      grid-template-columns:
        repeat(
          auto-fill,
          minmax(
            250px,
            1fr
          )
        );
      gap: 14px;
      margin-bottom: 16px;
    }

    .v44-item-card {
      overflow: hidden;
      border: 1px solid #dce5eb;
      border-radius: 15px;
      background: white;
    }

    .v44-item-card.urgent {
      border-color: #efc06b;
    }

    .v44-image-box {
      position: relative;
      height: 165px;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #f5f8fa;
    }

    .v44-image-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .v44-placeholder {
      font-size: 48px;
      opacity: .55;
    }

    .v44-card-alert {
      position: absolute;
      top: 12px;
      right: 12px;
    }

    .v44-item-body {
      display: grid;
      gap: 10px;
      padding: 13px;
    }

    .v44-item-title {
      display: grid;
      gap: 2px;
    }

    .v44-item-title strong {
      font-size: 15px;
      color: #10233c;
    }

    .v44-item-title span {
      color: #7a8798;
      font-size: 10px;
    }

    .v44-stock-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 11px;
      border-radius: 10px;
      background: #f7f9fb;
    }

    .v44-stock-row span {
      color: #68778a;
      font-size: 10px;
      font-weight: 700;
    }

    .v44-stock-row strong {
      min-width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      background: #e8f5f2;
      color: #087260;
      font-size: 18px;
    }

    .v44-stock-row strong.low {
      background: #fff1dc;
      color: #b86a00;
    }

    .v44-request-state {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .v44-request-state span {
      padding: 4px 7px;
      border-radius: 999px;
      background: #fff3df;
      color: #a45f00;
      font-size: 8px;
      font-weight: 900;
    }

    .v44-request-state span.approved {
      background: #e9f7f3;
      color: #087260;
    }

    .v44-item-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .v44-owner-requests {
      margin-top: 16px;
    }

    .v44-request-card {
      align-items: center;
    }

    .v44-request-main {
      display: flex;
      align-items: center;
      gap: 11px;
      min-width: 0;
    }

    .v44-request-main img,
    .v44-small-placeholder {
      width: 52px;
      height: 52px;
      flex: 0 0 52px;
      border-radius: 11px;
      object-fit: contain;
      display: grid;
      place-items: center;
      background: #f4f7f9;
    }

    .v44-request-main p {
      margin: 5px 0 0;
      color: #66768a;
      font-size: 10px;
    }

    .v44-review-actions {
      display: flex;
      gap: 7px;
      flex-wrap: wrap;
    }

    .v44-item-modal {
      width: min(
        900px,
        calc(
          100vw - 30px
        )
      );
    }

    .v44-item-form {
      display: grid;
      grid-template-columns:
        repeat(
          2,
          minmax(
            0,
            1fr
          )
        );
      gap: 13px;
      padding: 16px;
    }

    .v44-item-form label {
      display: grid;
      gap: 6px;
      font-weight: 800;
    }

    .v44-image-field {
      grid-column: 1 / -1;
    }

    .v44-form-preview {
      width: 150px;
      height: 110px;
      object-fit: contain;
      border: 1px solid #dce5eb;
      border-radius: 11px;
      background: white;
    }

    .v44-full {
      grid-column: 1 / -1;
    }

    .v44-request-item,
    .v44-purchase-summary {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 11px;
      border-radius: 11px;
      background: #f6f9fa;
    }

    .v44-request-item img {
      width: 70px;
      height: 70px;
      object-fit: contain;
      border-radius: 10px;
      background: white;
    }

    .v44-request-item > div:last-child,
    .v44-purchase-summary {
      display: grid;
      gap: 3px;
    }

    @media (max-width: 700px) {

      .v44-items-grid {
        grid-template-columns: 1fr;
      }

      .v44-item-form {
        grid-template-columns: 1fr;
      }

      .v44-image-field,
      .v44-full {
        grid-column: 1;
      }

      .v44-item-actions > button {
        flex: 1 1 auto;
      }

      .v44-request-card {
        align-items: stretch;
        flex-direction: column;
      }

      .v44-review-actions button {
        flex: 1;
      }
    }
  `;


  document.head.appendChild(
    style
  );

})();

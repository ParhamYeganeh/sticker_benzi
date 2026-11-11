// ===== کارت محصول (مشترک بین صفحه اصلی، صفحه دسته‌بندی و محصولات مرتبط) =====
// هر تغییری در ظاهر کارت فقط اینجا انجام می‌شود.
(function () {
  const fmtNum = (n) => Number(n).toLocaleString("fa-IR");
  const productUrl = (p) => "./product.html?id=" + encodeURIComponent(p.id);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(cls) {
    const i = el("i", cls);
    i.setAttribute("aria-hidden", "true");
    return i;
  }

  function waLink(p) {
    const msg = `سلام، می‌خواستم این استیکر رو سفارش بدم:\n${p.name}\nکد: ${p.id}\nقیمت: ${fmtNum(p.price)} تومان`;
    return window.SiteLinks ? window.SiteLinks.whatsapp(msg) : '';
  }

  function make(p) {
    const art = el("article", "product");

    // عکس (لینک به صفحه محصول)
    const media = el("a", "product-media");
    media.href = productUrl(p);
    media.setAttribute("aria-label", p.name);
    const src = p.img || (Array.isArray(p.images) && p.images[0]);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = p.name;
      img.loading = "lazy";
      img.width = 400;
      img.height = 400;
      media.appendChild(img);
    } else {
      media.appendChild(icon(p.icon || "ri-sticky-note-line"));
    }

    const body = el("div", "product-body");
    const h = el("h3", "product-name");
    const nameLink = el("a", null, p.name);
    nameLink.href = productUrl(p);
    h.appendChild(nameLink);
    body.appendChild(h);
    if (p.desc) body.appendChild(el("p", "product-desc", p.desc));
    body.appendChild(el("div", "product-price", fmtNum(p.price) + " تومان"));

    // دو مسیر سفارش کنار هم + افزودن به سبد
    const actions = el("div", "product-actions");
    const channels = el("div", "product-channel-actions");

    const order = el("a", "btn btn-yellow product-btn product-whatsapp-btn");
    const orderUrl = waLink(p);
    if (orderUrl) {
      order.href = orderUrl;
      order.target = "_blank";
      order.rel = "noopener noreferrer";
      order.addEventListener('click', async (event) => {
        event.preventDefault();
        const popup = window.open('about:blank', '_blank');
        if (popup) popup.opener = null;
        try {
          const latest = window.StoreAPI ? await window.StoreAPI.refreshProducts() : (window.PRODUCTS || []);
          const current = latest.find((item) => item.id === p.id && item.available);
          if (!current) {
            if (popup) popup.close();
            window.alert('این محصول در حال حاضر در فروشگاه فعال نیست.');
            return;
          }
          const url = waLink(current);
          if (!url) throw new Error('لینک واتساپ فروشگاه تنظیم نشده است.');
          if (popup) popup.location.href = url;
          else window.location.href = url;
        } catch (error) {
          if (popup) popup.close();
          window.alert('بررسی اطلاعات محصول انجام نشد. لطفاً صفحه را تازه‌سازی و دوباره تلاش کنید.');
        }
      });
    } else {
      order.hidden = true;
    }
    order.append(icon("ri-whatsapp-line"), " واتساپ");

    const baleOrder = el("button", "btn btn-ghost product-btn product-bale-btn");
    baleOrder.type = "button";
    baleOrder.append(icon("ri-message-3-line"), " بله");
    baleOrder.hidden = !(window.SiteLinks && window.SiteLinks.bale());
    baleOrder.addEventListener("click", async () => {
      baleOrder.disabled = true;
      try {
        const latest = window.StoreAPI ? await window.StoreAPI.refreshProducts() : (window.PRODUCTS || []);
        const current = latest.find((item) => item.id === p.id && item.available);
        if (!current) {
          window.alert('این محصول در حال حاضر در فروشگاه فعال نیست.');
          return;
        }
        const message = `سلام، می‌خواستم این محصول رو سفارش بدم:\n${current.name}\nکد: ${current.id}\nقیمت: ${fmtNum(current.price)} تومان`;
        if (!window.BaleOrder || !window.BaleOrder.open(message, 'سفارش محصول در بله')) {
          window.alert('امکان آماده‌سازی پیام بله وجود ندارد. لطفاً تنظیمات ارتباطی فروشگاه را بررسی کن.');
        }
      } catch (error) {
        window.alert('بررسی اطلاعات محصول انجام نشد. لطفاً صفحه را تازه‌سازی و دوباره تلاش کن.');
      } finally {
        baleOrder.disabled = false;
      }
    });

    channels.append(order, baleOrder);

    const add = el("button", "product-add");
    add.type = "button";
    add.title = "افزودن به سبد";
    add.setAttribute("aria-label", "افزودن " + p.name + " به سبد");
    const addIcon = icon("ri-shopping-bag-3-line");
    add.appendChild(addIcon);
    let timer;
    add.addEventListener("click", () => {
      if (!window.Cart || !window.Cart.add(p.id)) return;
      add.classList.add("added");
      addIcon.className = "ri-check-line";
      clearTimeout(timer);
      timer = setTimeout(() => {
        add.classList.remove("added");
        addIcon.className = "ri-shopping-bag-3-line";
      }, 1200);
    });

    actions.append(channels, add);
    body.appendChild(actions);

    art.append(media, body);
    return art;
  }

  window.ProductCard = { make, productUrl, fmtNum };
})();

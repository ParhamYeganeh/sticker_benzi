// ===== صفحه محصول: سکشن ۱ (گالری و اطلاعات اصلی) =====
// فعلاً با آدرس /product?id=J01 کار می‌کند. در مرحله بک‌اند به /product/نام-محصول (رندر سمت سرور) تبدیل می‌شود.
(function () {
window.StoreDataReady.then(() => {
  const id = new URLSearchParams(location.search).get("id");
  // محصول ناموجود (available: false) مثل محصول حذف‌شده رفتار می‌کند
  let p = (window.PRODUCTS || []).find((x) => x.id === id && x.available);
  const cats = window.CATEGORIES || [];

  const $ = (s) => document.getElementById(s);
  const fmtNum = (n) => Number(n).toLocaleString("fa-IR");
  const storeName = String(window.SITE_CONFIG.storeName || 'استیکر بنزی');

  // ---------- محصول پیدا نشد ----------
  if (!p) {
    document.title = `محصول پیدا نشد | ${storeName}`;
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    $("bc-name").textContent = "پیدا نشد";
    $("bc-cat").remove();
    const sep = document.querySelectorAll(".breadcrumb > i");
    if (sep[2]) sep[2].remove();
    $("prod-missing").hidden = false;
    return;
  }

  let cat = cats.find((c) => c.id === p.cat);

  document.dispatchEvent(new CustomEvent('stickerbenzi:analytics', {
    detail: { eventType: 'view_item', productId: p.id }
  }));

  // ---------- عنوان صفحه و متاتگ‌ها ----------
  const title = `${p.name} | ${storeName}`;
  const desc =
    (p.desc ? p.desc + "؛ " : "") +
    "قیمت " +
    fmtNum(p.price) +
    " تومان. سفارش آسان در واتساپ و بله.";
  document.title = title;
  const setMeta = (sel, val) => {
    const m = document.querySelector(sel);
    if (m) m.setAttribute("content", val);
  };
  setMeta('meta[name="description"]', desc);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', desc);

  // ---------- مسیر صفحه ----------
  const bcCat = $("bc-cat");
  bcCat.textContent = cat ? cat.name : "همه محصولات";
  bcCat.href = cat ? "./category.html?c=" + encodeURIComponent(cat.id) : "./category.html";
  $("bc-name").textContent = p.name;

  // ---------- اطلاعات ----------
  const pc = $("p-cat");
  pc.textContent = cat ? cat.name : "همه محصولات";
  pc.href = bcCat.href;
  $("p-name").textContent = p.name;
  $("p-code").textContent = p.id;
  $("p-price").textContent = fmtNum(p.price) + " تومان";
  $("p-desc").textContent = p.desc || "";
  $("p-desc").hidden = !p.desc;

  // مشخصات اختیاری: در داده محصول می‌شود نوشت specs: [['ابعاد','۸ سانتی‌متر'], ['جنس','ضدآب']]
  if (Array.isArray(p.specs) && p.specs.length) {
    const ul = $("p-specs");
    p.specs.forEach(([k, v]) => {
      const li = document.createElement("li");
      const s = document.createElement("span");
      s.textContent = k;
      const b = document.createElement("b");
      b.textContent = v;
      li.append(s, b);
      ul.appendChild(li);
    });
    ul.hidden = false;
  }

  // ---------- گالری ----------
  const main = $("g-main");
  const thumbs = $("g-thumbs");

  function renderGallery(product) {
    const images = Array.isArray(product.images) && product.images.length
      ? product.images
      : product.img ? [product.img] : [];
    thumbs.replaceChildren();
    main.replaceChildren();
    main.removeAttribute("role");
    main.removeAttribute("aria-label");

    function showImage(index) {
      main.replaceChildren();
      const image = document.createElement("img");
      image.src = images[index];
      image.alt = product.name;
      image.width = 800;
      image.height = 800;
      image.fetchPriority = "high";
      main.appendChild(image);
      thumbs.querySelectorAll(".thumb").forEach((thumb, thumbIndex) => {
        thumb.classList.toggle("active", thumbIndex === index);
        thumb.setAttribute("aria-current", String(thumbIndex === index));
      });
    }

    if (images.length) {
      if (images.length > 1) {
        images.forEach((src, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "thumb";
          button.setAttribute("aria-label", "نمایش عکس " + fmtNum(index + 1));
          const image = document.createElement("img");
          image.src = src;
          image.alt = "";
          image.loading = "lazy";
          image.width = 72;
          image.height = 72;
          button.appendChild(image);
          button.addEventListener("click", () => showImage(index));
          thumbs.appendChild(button);
        });
      }
      showImage(0);
      return;
    }

    const imageIcon = document.createElement("i");
    imageIcon.className = product.icon || "ri-sticky-note-line";
    imageIcon.setAttribute("aria-hidden", "true");
    main.appendChild(imageIcon);
    main.setAttribute("role", "img");
    main.setAttribute("aria-label", product.name);
  }

  renderGallery(p);

  // ---------- دکمه سفارش (واتساپ) ----------
  function orderMessage(product) {
    return `سلام، می‌خواستم این محصول رو سفارش بدم:\n${product.name}\nکد: ${product.id}\nقیمت: ${fmtNum(product.price)} تومان\n${location.href}`;
  }

  function updateVisibleProduct(product) {
    p = product;
    cat = cats.find((item) => item.id === p.cat);
    const categoryHref = cat ? "./category.html?c=" + encodeURIComponent(cat.id) : "./category.html";
    $("bc-cat").textContent = cat ? cat.name : "همه محصولات";
    $("bc-cat").href = categoryHref;
    $("bc-name").textContent = p.name;
    $("p-cat").textContent = cat ? cat.name : "همه محصولات";
    $("p-cat").href = categoryHref;
    $("p-name").textContent = p.name;
    $("p-code").textContent = p.id;
    $("p-price").textContent = fmtNum(p.price) + " تومان";
    $("p-desc").textContent = p.desc || "";
    $("p-desc").hidden = !p.desc;
    document.title = `${p.name} | ${storeName}`;
    const description = (p.desc ? p.desc + "؛ " : "") + "قیمت " + fmtNum(p.price) + " تومان. سفارش آسان در واتساپ و بله.";
    const metaDescription = document.querySelector('meta[name="description"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (metaDescription) metaDescription.content = description;
    if (ogTitle) ogTitle.content = document.title;
    if (ogDescription) ogDescription.content = description;
    renderGallery(p);
  }

  async function getLatestProduct(popup) {
    const products = window.StoreAPI ? await window.StoreAPI.refreshProducts() : (window.PRODUCTS || []);
    const latest = products.find((item) => item.id === id && item.available);
    if (!latest) {
      if (popup) popup.close();
      window.alert('این محصول دیگر در فروشگاه فعال نیست. به صفحه محصولات منتقل می‌شوی.');
      window.location.href = './category.html';
      return null;
    }
    updateVisibleProduct(latest);
    return latest;
  }

  const whatsappOrder = $("p-order");
  const initialWhatsappUrl = window.SiteLinks ? window.SiteLinks.whatsapp(orderMessage(p)) : '';
  if (initialWhatsappUrl) {
    whatsappOrder.href = initialWhatsappUrl;
    whatsappOrder.target = "_blank";
    whatsappOrder.rel = "noopener noreferrer";
    whatsappOrder.addEventListener('click', async (event) => {
      event.preventDefault();
      const popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
      try {
        const latest = await getLatestProduct(popup);
        if (!latest) return;
        const url = window.SiteLinks.whatsapp(orderMessage(latest));
        if (popup) popup.location.href = url;
        else window.location.href = url;
      } catch (error) {
        if (popup) popup.close();
        window.alert('بررسی اطلاعات محصول انجام نشد. لطفاً صفحه را تازه‌سازی و دوباره تلاش کن.');
      }
    });
  } else {
    whatsappOrder.hidden = true;
  }

  // سفارش در بله: قبل از باز کردن پروفایل، محصول از دیتابیس دوباره بررسی می‌شود.
  const baleOrder = $("p-order-bale");
  const initialBaleUrl = window.SiteLinks ? window.SiteLinks.bale() : '';
  if (baleOrder && initialBaleUrl) {
    baleOrder.href = initialBaleUrl;
    baleOrder.hidden = false;
    baleOrder.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        const latest = await getLatestProduct(null);
        if (!latest) return;
        if (!window.BaleOrder || !window.BaleOrder.open(orderMessage(latest), 'سفارش این محصول در بله')) {
          window.alert('امکان آماده‌سازی پیام بله وجود ندارد. تنظیمات ارتباطی فروشگاه را بررسی کن.');
        }
      } catch (error) {
        window.alert('بررسی اطلاعات محصول انجام نشد. لطفاً صفحه را تازه‌سازی و دوباره تلاش کن.');
      }
    });
  }

  document.addEventListener('storeproductsrefreshed', (event) => {
    const latest = event.detail.products.find((item) => item.id === id && item.available);
    if (latest) updateVisibleProduct(latest);
  });

  // ---------- اشتراک‌گذاری ----------
  const shareBtn = $("p-share");
  shareBtn.addEventListener("click", async () => {
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      const label = shareBtn.querySelector("span");
      label.textContent = "لینک کپی شد ✓";
      setTimeout(() => {
        label.textContent = "اشتراک‌گذاری";
      }, 2000);
    } catch (e) {
      /* کاربر انصراف داد یا مرورگر اجازه نداد */
    }
  });

  // ---------- سکشن ۲: محصولات مرتبط ----------
  // اول محصولات هم‌دسته، و اگر کم بودند از بقیه دسته‌ها تکمیل می‌شود (حداکثر ۴ عدد)
  const relGrid = $("related-grid");
  if (relGrid) {
    const rest = window.PRODUCTS.filter((x) => x.available && x.id !== p.id);
    const related = rest
      .filter((x) => x.cat === p.cat)
      .concat(rest.filter((x) => x.cat !== p.cat))
      .slice(0, 4);
    if (related.length) {
      relGrid.replaceChildren(...related.map((x) => ProductCard.make(x)));
      $("related-all").href = bcCat.href;
      $("related").hidden = false;
    }
  }

  // ---------- افزودن به سبد ----------
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn btn-ghost prod-add";
  const addIcon = document.createElement("i");
  addIcon.className = "ri-shopping-bag-3-line";
  const addLabel = document.createElement("span");
  addLabel.textContent = "افزودن به سبد";
  addBtn.append(addIcon, " ", addLabel);
  addBtn.addEventListener("click", () => {
    if (!window.Cart || !window.Cart.add(p.id)) return;
    addLabel.textContent = "اضافه شد ✓";
    setTimeout(() => {
      addLabel.textContent = "افزودن به سبد";
    }, 1800);
  });
  $("p-share").before(addBtn);

  $("prod-view").hidden = false;
}).catch(() => {
  // خطای دریافت اطلاعات در پیام عمومی store-data.js نمایش داده می‌شود.
});
})();

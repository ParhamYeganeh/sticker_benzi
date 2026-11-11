// ===== سبد سفارش =====
// سبد فقط در مرورگر خود مشتری ذخیره می‌شود (localStorage). فقط «کد محصول و تعداد» ذخیره می‌شود
// و قیمت و نام هر بار از اطلاعات تازه دریافت‌شده از API خوانده می‌شود تا هیچ‌وقت قدیمی نشود.
(function () {
  if (window.Cart) return;

  const KEY = "sb_cart_v1";
  const MAX_QTY = 99;
  const fmt = (n) => Number(n).toLocaleString("fa-IR");

  let data = {}; // { کدمحصول: تعداد }
  let ui = {}; // المان‌های رابط کاربری
  let lastFocus = null;
  let clearTimer = null;
  let toastTimer = null;

  // ---------- ذخیره‌سازی ----------
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || "{}");
      const out = {};
      Object.keys(o).forEach((id) => {
        const q = Math.floor(Number(o[id]));
        if (typeof id === "string" && q >= 1) out[id] = Math.min(q, MAX_QTY);
      });
      return out;
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* حالت خصوصی یا غیرفعال */
    }
  }

  const product = (id) =>
    (window.PRODUCTS || []).find((p) => p.id === id && p.available);

  // محصولاتی که حذف یا ناموجود شده‌اند از سبد برداشته می‌شوند
  function prune() {
    let changed = false;
    Object.keys(data).forEach((id) => {
      if (!product(id)) {
        delete data[id];
        changed = true;
      }
    });
    if (changed) save();
  }

  // ---------- API ----------
  function items() {
    prune();
    return Object.keys(data).map((id) => ({ p: product(id), qty: data[id] }));
  }
  const count = () => items().reduce((s, it) => s + it.qty, 0);
  const total = () => items().reduce((s, it) => s + it.p.price * it.qty, 0);

  function commit() {
    save();
    render();
    document.dispatchEvent(new CustomEvent("cartchange"));
  }

  function add(id, qty) {
    if (!product(id)) return false;
    data[id] = Math.min((data[id] || 0) + (qty || 1), MAX_QTY);
    commit();
    document.dispatchEvent(new CustomEvent('stickerbenzi:analytics', {
      detail: { eventType: 'add_to_cart', productId: id }
    }));
    bump();
    toast("به سبد اضافه شد");
    return true;
  }
  function setQty(id, qty) {
    if (!data[id]) return;
    if (qty < 1) delete data[id];
    else data[id] = Math.min(qty, MAX_QTY);
    commit();
  }
  const remove = (id) => {
    delete data[id];
    commit();
  };
  const clear = () => {
    data = {};
    commit();
  };

  // ---------- متن سفارش ----------
  function message() {
    const list = items();
    const lines = list.map(
      (it, i) =>
        `${fmt(i + 1)}. ${it.p.name} (${it.p.id}) × ${fmt(it.qty)} = ${fmt(it.p.price * it.qty)} تومان`,
    );
    return (
      "سلام، می‌خواستم این محصولات رو سفارش بدم:\n\n" +
      lines.join("\n") +
      `\n\nجمع کل: ${fmt(total())} تومان`
    );
  }

  // ---------- رابط کاربری ----------
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

  function build() {
    // دکمه سبد در هدر
    const actions = document.querySelector(".header-actions");
    ui.btn = el("button", "cart-btn");
    ui.btn.type = "button";
    ui.btn.setAttribute("aria-label", "سبد سفارش");
    ui.btn.setAttribute("aria-haspopup", "dialog");
    ui.badge = el("span", "cart-count");
    ui.badge.hidden = true;
    ui.btn.append(icon("ri-shopping-bag-3-line"), ui.badge);
    ui.btn.addEventListener("click", open);
    if (actions) actions.prepend(ui.btn);

    // پس‌زمینه تیره و پنل
    ui.overlay = el("div", "cart-overlay");
    ui.overlay.addEventListener("click", close);

    ui.drawer = el("aside", "cart-drawer");
    ui.drawer.setAttribute("role", "dialog");
    ui.drawer.setAttribute("aria-modal", "true");
    ui.drawer.setAttribute("aria-labelledby", "cart-title");
    ui.drawer.setAttribute("tabindex", "-1");

    const head = el("div", "cart-head");
    const title = el("h2", null, "سبد سفارش");
    title.id = "cart-title";
    ui.close = el("button", "cart-close");
    ui.close.type = "button";
    ui.close.setAttribute("aria-label", "بستن سبد");
    ui.close.appendChild(icon("ri-close-line"));
    ui.close.addEventListener("click", close);
    head.append(title, ui.close);

    ui.list = el("div", "cart-list");
    ui.empty = el("div", "cart-empty");
    const ei = icon("ri-shopping-bag-3-line");
    const et = el("p", null, "سبد سفارشت خالیه");
    const ea = el("a", "btn btn-yellow", "دیدن محصولات");
    ea.href = "./category.html";
    ui.empty.append(ei, et, ea);

    ui.foot = el("div", "cart-foot");
    const totalRow = el("div", "cart-total");
    totalRow.append(el("span", null, "جمع کل"));
    ui.total = el("b");
    totalRow.appendChild(ui.total);
    const note = el(
      "p",
      "cart-note",
      "هزینه ارسال و مبلغ نهایی توی گفتگو مشخص می‌شه.",
    );
    ui.send = el("a", "btn btn-yellow cart-send");
    ui.send.target = "_blank";
    ui.send.rel = "noopener noreferrer";
    ui.send.append(icon("ri-whatsapp-line"), " ارسال سفارش در واتساپ");
    ui.send.addEventListener('click', (event) => {
      event.preventDefault();
      submitOrder('whatsapp');
    });
    ui.sendBale = el("button", "btn btn-ghost cart-send cart-send-bale");
    ui.sendBale.type = "button";
    ui.sendBale.append(icon("ri-message-3-line"), " سفارش در بله");
    ui.sendBale.addEventListener("click", (event) => {
      event.preventDefault();
      submitOrder('bale');
    });
    ui.clear = el("button", "cart-clear", "خالی کردن سبد");
    ui.clear.type = "button";
    ui.clear.addEventListener("click", () => {
      // برای جلوگیری از حذف اشتباهی، کلیک دوم لازم است
      if (ui.clear.dataset.confirm) {
        clearTimeout(clearTimer);
        clear();
        return;
      }
      ui.clear.dataset.confirm = "1";
      ui.clear.textContent = "مطمئنی؟ دوباره بزن";
      clearTimer = setTimeout(resetClear, 3000);
    });
    ui.foot.append(totalRow, note, ui.send, ui.sendBale, ui.clear);

    ui.drawer.append(head, ui.list, ui.empty, ui.foot);

    // پیام کوتاه «به سبد اضافه شد»
    ui.toast = el("div", "cart-toast");
    ui.toast.setAttribute("role", "status");
    ui.toast.setAttribute("aria-live", "polite");

    document.body.append(ui.overlay, ui.drawer, ui.toast);
    // Esc پنل را می‌بندد و Tab فقط داخل پنل می‌چرخد
    document.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const f = Array.from(
        ui.drawer.querySelectorAll("a[href], button:not(:disabled)"),
      ).filter((x) => x.getClientRects().length);
      if (!f.length) return;
      const first = f[0],
        last = f[f.length - 1];
      if (
        !ui.drawer.contains(document.activeElement) ||
        (e.shiftKey && document.activeElement === first) ||
        (!e.shiftKey && document.activeElement === last)
      ) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    });
  }

  async function submitOrder(channel) {
    // پنجره واتساپ باید در همان کلیک کاربر باز شود تا popup blocker آن را مسدود نکند.
    const popup = channel === 'whatsapp' ? window.open('about:blank', '_blank') : null;
    if (popup) popup.opener = null;
    try {
      const oldIds = Object.keys(data);
      const latest = window.StoreAPI ? await window.StoreAPI.refreshProducts() : (window.PRODUCTS || []);
      const latestIds = new Set(latest.filter((p) => p.available).map((p) => p.id));
      const removed = oldIds.filter((id) => !latestIds.has(id));
      prune();
      render();

      if (!items().length) {
        if (popup) popup.close();
        toast(removed.length ? 'محصولات غیرفعال از سبد حذف شدند؛ سبد خالی است' : 'سبد خرید خالی است');
        return;
      }
      if (removed.length) {
        if (popup) popup.close();
        toast('برخی محصولات غیرفعال شده‌اند و از سبد حذف شدند؛ سفارش را دوباره بررسی کن');
        return;
      }

      const orderText = message();
      document.dispatchEvent(new CustomEvent('stickerbenzi:analytics', {
        detail: { eventType: 'begin_checkout' }
      }));
      if (channel === 'whatsapp') {
        const url = window.SiteLinks ? window.SiteLinks.whatsapp(orderText) : '';
        if (!url) throw new Error('شماره واتساپ فروشگاه تنظیم نشده است.');
        if (popup) popup.location.href = url;
        else window.location.href = url;
        return;
      }

      const baleUrl = window.SiteLinks ? window.SiteLinks.bale() : '';
      if (!baleUrl) throw new Error('لینک بله فروشگاه تنظیم نشده است.');
      if (!window.BaleOrder || !window.BaleOrder.open(orderText, 'سفارش سبد خرید در بله')) {
        throw new Error('امکان آماده‌سازی پیام بله وجود ندارد.');
      }
    } catch (error) {
      if (popup) popup.close();
      toast(error && error.message ? error.message : 'بررسی سفارش ناموفق بود؛ اتصال اینترنت و سرور را بررسی کن');
    }
  }

  function resetClear() {
    delete ui.clear.dataset.confirm;
    ui.clear.textContent = "خالی کردن سبد";
  }

  function row(it) {
    const { p, qty } = it;
    const r = el("div", "cart-item");

    const thumb = el("a", "cart-thumb");
    thumb.href = "./product.html?id=" + encodeURIComponent(p.id);
    thumb.setAttribute("aria-label", p.name);
    if (p.img || (p.images && p.images[0])) {
      const im = document.createElement("img");
      im.src = p.img || p.images[0];
      im.alt = "";
      im.width = 56;
      im.height = 56;
      im.loading = "lazy";
      thumb.appendChild(im);
    } else thumb.appendChild(icon(p.icon || "ri-sticky-note-line"));

    const info = el("div", "cart-info");
    const name = el("a", "cart-name", p.name);
    name.href = thumb.href;
    const price = el("div", "cart-price", fmt(p.price) + " تومان");
    const step = el("div", "cart-step");
    const minus = el("button", null);
    minus.type = "button";
    minus.setAttribute("aria-label", "کم کردن تعداد " + p.name);
    minus.appendChild(
      icon(qty > 1 ? "ri-subtract-line" : "ri-delete-bin-6-line"),
    );
    minus.addEventListener("click", () => setQty(p.id, qty - 1));
    const num = el("span", null, fmt(qty));
    num.setAttribute("aria-label", "تعداد");
    const plus = el("button", null);
    plus.type = "button";
    plus.setAttribute("aria-label", "زیاد کردن تعداد " + p.name);
    plus.appendChild(icon("ri-add-line"));
    plus.disabled = qty >= MAX_QTY;
    plus.addEventListener("click", () => setQty(p.id, qty + 1));
    step.append(minus, num, plus);
    info.append(name, price, step);

    const sub = el("div", "cart-sub", fmt(p.price * qty));
    const del = el("button", "cart-del");
    del.type = "button";
    del.setAttribute("aria-label", "حذف " + p.name);
    del.appendChild(icon("ri-close-line"));
    del.addEventListener("click", () => remove(p.id));

    r.append(thumb, info, sub, del);
    return r;
  }

  function render() {
    if (!ui.list) return;
    const list = items();
    const n = list.reduce((s, it) => s + it.qty, 0);

    ui.badge.hidden = n === 0;
    ui.badge.textContent = n > 99 ? "+۹۹" : fmt(n);
    ui.btn.setAttribute(
      "aria-label",
      n ? `سبد سفارش، ${fmt(n)} محصول` : "سبد سفارش",
    );

    ui.list.replaceChildren(...list.map(row));
    ui.empty.hidden = list.length > 0;
    ui.list.hidden = list.length === 0;
    ui.foot.hidden = list.length === 0;

    if (list.length) {
      ui.total.textContent = fmt(total()) + " تومان";
      const whatsappUrl = window.SiteLinks ? window.SiteLinks.whatsapp(message()) : '';
      ui.send.hidden = !whatsappUrl;
      if (whatsappUrl) {
        ui.send.href = whatsappUrl;
      } else {
        ui.send.removeAttribute("href");
      }
      const baleUrl = window.SiteLinks ? window.SiteLinks.bale() : '';
      ui.sendBale.hidden = !baleUrl;
    }
    resetClear();
  }

  // ---------- باز و بسته کردن ----------
  const isOpen = () => ui.drawer && ui.drawer.classList.contains("open");
  function open() {
    lastFocus = document.activeElement;
    render();
    ui.overlay.classList.add("open");
    ui.drawer.classList.add("open");
    document.body.style.overflow = "hidden";
    // پنل در ابتدای انیمیشن هنوز مخفی است؛ کمی صبر می‌کنیم تا کانون بگیرد
    setTimeout(() => ui.close.focus(), 60);
  }
  function close() {
    ui.overlay.classList.remove("open");
    ui.drawer.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function bump() {
    ui.btn.classList.remove("bump");
    void ui.btn.offsetWidth;
    ui.btn.classList.add("bump");
  }
  function toast(text) {
    ui.toast.textContent = text;
    ui.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2000);
  }

  // ---------- راه‌اندازی ----------
  window.Cart = {
    add,
    remove,
    setQty,
    clear,
    items,
    count,
    total,
    open,
    close,
    message,
  };

  let started = false;
  function start() {
    if (started) return;
    started = true;
    const go = () => {
      data = load();
      build();
      render();
      // همگام‌سازی بین تب‌های باز
      window.addEventListener("storage", (e) => {
        if (e.key === KEY) {
          data = load();
          render();
        }
      });
    };
    // سبد پس از دریافت محصولات و تنظیمات از API فعال می‌شود.
    // اگر API موقتاً در دسترس نباشد، داده محلی سبد پاک نمی‌شود.
    if (window.StoreDataReady && typeof window.StoreDataReady.then === 'function') {
      window.StoreDataReady.then(go).catch(() => {
        // تا زمان اتصال مجدد API هیچ محصولی از localStorage حذف نمی‌شود.
      });
      return;
    }
    if (Array.isArray(window.PRODUCTS)) go();
  }

  // آغاز سبد پس از آماده شدن سند و بارگذاری StoreDataReady
  if (document.readyState === "complete") start();
  else {
    document.addEventListener("DOMContentLoaded", start);
    window.addEventListener("load", start);
  }
})();

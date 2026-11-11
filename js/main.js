// ===== استیکر بنزی | تنظیمات عمومی و اسکریپت اصلی =====
// تنظیمات تماس در شروع صفحه از API و جدول settings خوانده می‌شوند.
window.SITE_CONFIG = { whatsappNumber: '', instagramUrl: '', baleUrl: '', storeName: 'استیکر بنزی' };

window.SiteLinks = Object.freeze({
  whatsapp(message) {
    const number = String(window.SITE_CONFIG.whatsappNumber || '').replace(/\D/g, '');
    if (!/^[1-9]\d{7,14}$/.test(number)) return '';
    return `https://wa.me/${number}?text=${encodeURIComponent(message || '')}`;
  },
  bale() {
    const value = String(window.SITE_CONFIG.baleUrl || '').trim();
    try {
      const url = new URL(value);
      // فقط لینک پروفایل عمومی بله پذیرفته می‌شود؛ لینک‌های ناشناس/نامعتبر رد می‌شوند.
      if (url.protocol !== 'https:' || url.hostname !== 'ble.ir') return '';
      if (!/^\/[a-z0-9_]{5,32}\/?$/i.test(url.pathname)) return '';
      return `https://ble.ir${url.pathname.replace(/\/$/, '')}`;
    } catch (error) {
      return '';
    }
  },
  isExternalProfileUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch (error) {
      return false;
    }
  },
  async copyMessage(message) {
    const text = String(message || '');
    if (!text) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // در ادامه از روش جایگزین استفاده می‌شود.
    }
    try {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      return copied;
    } catch (error) {
      return false;
    }
  }
});

// بله در لینک پروفایل، متن سفارش را به‌صورت خودکار وارد گفتگو یا ارسال نمی‌کند.
// برای جلوگیری از گم‌شدن متن، ابتدا یک پنجره آماده‌سازی سفارش نمایش می‌دهیم:
// مشتری متن را با یک کلیک کپی می‌کند و سپس گفت‌وگوی فروشگاه را باز می‌کند.
window.BaleOrder = Object.freeze({
  open(message, title = 'متن آماده سفارش') {
    const text = String(message || '').trim();
    const storeName = String(window.SITE_CONFIG.storeName || 'استیکر بنزی');
    const profileUrl = window.SiteLinks.bale();
    if (!text || !profileUrl) return false;

    const existing = document.querySelector('.bale-order-backdrop');
    if (existing) existing.remove();

    const make = (tag, className, value) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (value != null) node.textContent = value;
      return node;
    };

    const backdrop = make('div', 'bale-order-backdrop');
    backdrop.setAttribute('role', 'presentation');
    const dialog = make('section', 'bale-order-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'bale-order-title');

    const header = make('div', 'bale-order-header');
    const headingWrap = make('div', 'bale-order-heading');
    const icon = make('i', 'ri-message-3-line');
    icon.setAttribute('aria-hidden', 'true');
    const heading = make('h2', '', title);
    heading.id = 'bale-order-title';
    headingWrap.append(icon, heading);
    const close = make('button', 'bale-order-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'بستن پنجره');
    header.append(headingWrap, close);

    const instruction = make(
      'p',
      'bale-order-instruction',
      `ابتدا متن سفارش را کپی کن، سپس گفت‌وگوی ${storeName} را در بله باز کن و متن را در کادر پیام Paste و ارسال کن.`
    );
    const note = make(
      'p',
      'bale-order-note',
      'نکته: لینک پروفایل بله فقط گفتگو را باز می‌کند؛ به‌دلیل محدودیت لینک عمومی بله، متن از طریق این لینک خودکار ارسال یا وارد کادر پیام نمی‌شود.'
    );
    const textarea = make('textarea', 'bale-order-message');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute('aria-label', 'متن سفارش برای کپی کردن');
    textarea.rows = Math.min(10, Math.max(4, text.split('\n').length));

    const status = make('p', 'bale-order-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const actions = make('div', 'bale-order-actions');
    const copy = make('button', 'btn btn-yellow bale-order-copy', 'کپی متن سفارش');
    copy.type = 'button';
    const copyIcon = make('i', 'ri-file-copy-line');
    copy.prepend(copyIcon);
    const open = make('a', 'btn btn-ghost bale-order-open', 'باز کردن گفت‌وگوی بله');
    const openIcon = make('i', 'ri-external-link-line');
    open.prepend(openIcon);
    open.href = profileUrl;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    actions.append(copy, open);

    dialog.append(header, instruction, textarea, note, status, actions);
    backdrop.append(dialog);
    document.body.append(backdrop);

    const closeDialog = () => {
      backdrop.remove();
      document.removeEventListener('keydown', onKeydown);
    };
    const onKeydown = (event) => {
      if (event.key === 'Escape') closeDialog();
    };
    close.addEventListener('click', closeDialog);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeDialog();
    });
    document.addEventListener('keydown', onKeydown);

    copy.addEventListener('click', async () => {
      copy.disabled = true;
      const original = copy.textContent;
      const copied = await window.SiteLinks.copyMessage(text);
      if (copied) {
        copy.textContent = 'متن کپی شد';
        status.textContent = 'متن سفارش کپی شد. حالا گفت‌وگوی بله را باز کن و آن را Paste و ارسال کن.';
        status.classList.add('is-success');
      } else {
        textarea.focus();
        textarea.select();
        status.textContent = 'کپی خودکار ممکن نشد؛ متن انتخاب شده است. کلیدهای Ctrl+C را بزن.';
        status.classList.remove('is-success');
        copy.textContent = original;
      }
      copy.disabled = false;
    });

    open.addEventListener('click', () => {
      status.textContent = 'گفت‌وگوی بله در زبانه جدید باز می‌شود؛ متن کپی‌شده را در کادر پیام Paste کن.';
    });
    copy.focus();
    return true;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // لینک‌های ارتباطی بعد از دریافت تنظیمات از دیتابیس مقداردهی می‌شوند.
  const initializeContactLinks = () => {
    const storeName = String(window.SITE_CONFIG.storeName || 'استیکر بنزی').trim() || 'استیکر بنزی';
    document.querySelectorAll('[data-store-name]').forEach((node) => {
      const words = storeName.split(/\s+/).filter(Boolean);
      const highlighted = words.pop() || storeName;
      const prefix = words.length ? `${words.join(' ')} ` : '';
      const strong = document.createElement('b');
      strong.textContent = highlighted;
      node.replaceChildren(document.createTextNode(prefix), strong);
    });
    document.querySelectorAll('[data-store-name-copy]').forEach((node) => {
      node.textContent = storeName;
    });
    document.querySelectorAll('[data-store-brand]').forEach((node) => {
      node.setAttribute('aria-label', storeName);
    });
    document.title = document.title.replace(/استیکر بنزی/g, storeName);

    const setLink = (element, url, disabledMessage) => {
      if (url) {
        element.href = url;
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
        element.removeAttribute('aria-disabled');
        element.classList.remove('is-disabled');
      } else {
        element.removeAttribute('href');
        element.setAttribute('aria-disabled', 'true');
        element.classList.add('is-disabled');
        element.title = disabledMessage;
      }
    };

    document.querySelectorAll('[data-instagram]').forEach((el) => {
      const raw = String(window.SITE_CONFIG.instagramUrl || '').trim();
      let url = '';
      try {
        const parsed = new URL(raw);
        if (parsed.protocol === 'https:' && ['instagram.com', 'www.instagram.com'].includes(parsed.hostname)) url = parsed.href;
      } catch (error) {}
      setLink(el, url, 'لینک اینستاگرام فروشگاه هنوز تنظیم نشده است');
    });

    document.querySelectorAll('[data-whatsapp]').forEach((el) => {
      const url = window.SiteLinks.whatsapp(`سلام، می‌خواستم از ${storeName} سفارش بدم 🌟`);
      setLink(el, url, 'شماره واتساپ فروشگاه هنوز تنظیم نشده است');
    });

    document.querySelectorAll('[data-bale]').forEach((el) => {
      const url = window.SiteLinks.bale();
      setLink(el, url, 'لینک بله فروشگاه هنوز تنظیم نشده است');
      if (url && el.dataset.baleOrderBound !== 'true') {
        el.dataset.baleOrderBound = 'true';
        el.addEventListener('click', (event) => {
          event.preventDefault();
          const message = `سلام، وقت بخیر. برای دریافت راهنمایی و ثبت سفارش از فروشگاه ${storeName} پیام می‌دهم. لطفاً راهنمایی‌ام کنید. 🌟`;
          if (!window.BaleOrder || !window.BaleOrder.open(message, `ارتباط با ${storeName} در بله`)) {
            window.alert('امکان آماده‌سازی پیام بله وجود ندارد. لطفاً تنظیمات ارتباطی فروشگاه را بررسی کن.');
          }
        });
      }
    });
  };

  if (window.StoreDataReady && typeof window.StoreDataReady.then === 'function') {
    window.StoreDataReady.then(initializeContactLinks).catch(initializeContactLinks);
  } else {
    initializeContactLinks();
  }

  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');

  // هدر: با اسکرول شیشه‌ای‌تر می‌شود.
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // منوی موبایل
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      const icon = toggle.querySelector('i');
      if (icon) icon.className = open ? 'ri-close-line' : 'ri-menu-line';
    });

    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      const icon = toggle.querySelector('i');
      if (icon) icon.className = 'ri-menu-line';
    }));
  }

  // سال شمسی فوتر
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().toLocaleDateString('fa-IR', { year: 'numeric' });

  // انیمیشن ظاهر شدن هنگام اسکرول؛ در صورت پشتیبانی مرورگر.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
  }
});

// سبد سفارش در همه صفحات بارگذاری می‌شود و رابط آن را خودش می‌سازد.
(function loadCartAssets() {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = './css/cart.css';
  document.head.appendChild(css);
  const baleCss = document.createElement('link');
  baleCss.rel = 'stylesheet';
  baleCss.href = './css/bale-order.css';
  document.head.appendChild(baleCss);

  const js = document.createElement('script');
  js.src = './js/cart.js';
  js.defer = true;
  document.head.appendChild(js);
})();

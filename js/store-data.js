// داده‌های عمومی فروشگاه از API و دیتابیس دریافت می‌شوند.
// این فایل باید بعد از main.js و قبل از اسکریپت‌های صفحه بارگذاری شود.
(function () {
  'use strict';

  const API_BASE = '/api';
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = './css/store-data.css';
  document.head.appendChild(style);

  async function requestJson(path) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('پاسخ سرور قابل خواندن نیست.');
    }
    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error(payload && payload.message ? payload.message : 'دریافت اطلاعات فروشگاه ناموفق بود.');
    }
    return payload.data;
  }

  function showLoadError(error) {
    if (!document.body || document.getElementById('store-data-error')) return;
    const panel = document.createElement('section');
    panel.id = 'store-data-error';
    panel.className = 'store-data-error';
    panel.setAttribute('role', 'alert');
    const title = document.createElement('strong');
    title.textContent = 'بارگذاری فروشگاه با مشکل مواجه شد';
    const message = document.createElement('p');
    message.textContent = 'ارتباط با پایگاه داده برقرار نشد. اتصال سرور و MySQL را بررسی کنید و دوباره تلاش کنید.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'تلاش مجدد';
    retry.addEventListener('click', () => window.location.reload());
    panel.append(title, message, retry);
    document.body.appendChild(panel);
    console.error('[Sticker Benzi] Store data could not be loaded:', error);
  }

  async function loadInitialData() {
    const [products, categories, settings] = await Promise.all([
      requestJson('/products'),
      requestJson('/categories'),
      requestJson('/settings')
    ]);

    if (!Array.isArray(products) || !Array.isArray(categories) || !settings || typeof settings !== 'object') {
      throw new Error('ساختار اطلاعات دریافتی از سرور معتبر نیست.');
    }

    window.PRODUCTS = products;
    window.CATEGORIES = categories;
    window.SITE_CONFIG = {
      whatsappNumber: settings.whatsappNumber || '',
      baleUrl: settings.baleUrl || '',
      instagramUrl: settings.instagramUrl || '',
      storeName: settings.storeName || 'استیکر بنزی',
      heroImages: settings.heroImages || {}
    };

    const heroImageTargets = {
      center: '.hero-visual .tile.big',
      left1: '.hero-visual .tile.t3',
      left2: '.hero-visual .tile.t4',
      left3: '.hero-visual .tile.t5',
      left4: '.hero-visual .tile.t6'
    };
    if (typeof document.querySelector === 'function') Object.entries(heroImageTargets).forEach(([slot, selector]) => {
      const tile = document.querySelector(selector);
      const imageUrl = window.SITE_CONFIG.heroImages[slot];
      if (!tile || !imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('./uploads/hero/')) return;
      const image = document.createElement('img');
      image.className = 'hero-tile-image';
      image.src = imageUrl;
      image.alt = '';
      image.decoding = 'async';
      image.loading = 'eager';
      tile.replaceChildren(image);
      tile.classList.add('has-custom-image');
    });

    window.STORE_DATA_LOADED = true;
    document.dispatchEvent(new CustomEvent('storedataready', {
      detail: { products, categories, settings: window.SITE_CONFIG }
    }));
    return { products, categories, settings: window.SITE_CONFIG };
  }

  async function refreshProducts() {
    const products = await requestJson('/products');
    if (!Array.isArray(products)) throw new Error('فهرست محصولات دریافتی معتبر نیست.');
    window.PRODUCTS = products;
    document.dispatchEvent(new CustomEvent('storeproductsrefreshed', { detail: { products } }));
    return products;
  }

  window.StoreAPI = Object.freeze({
    refreshProducts,
    async getProduct(id) {
      const product = await requestJson(`/products/${encodeURIComponent(String(id))}`);
      return product;
    }
  });

  window.StoreDataReady = loadInitialData().catch((error) => {
    window.PRODUCTS = [];
    window.CATEGORIES = [];
    window.SITE_CONFIG = { whatsappNumber: '', baleUrl: '', instagramUrl: '', storeName: 'استیکر بنزی', heroImages: {} };
    showLoadError(error);
    throw error;
  });
  // جلوگیری از unhandled rejection؛ مصرف‌کننده‌ها همچنان می‌توانند Promise را catch کنند.
  window.StoreDataReady.catch(() => {});
})();

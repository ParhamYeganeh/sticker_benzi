(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { username: '', products: [], categories: [], settings: {}, editingId: null, editingCategoryId: null, editingIcon: 'ri-sticky-note-line', uploadedFileName: '', toastTimer: null, analyticsRange: '30d', analyticsLoading: false };
  const screens = { loading: $('#loading-screen'), login: $('#login-screen'), dashboard: $('#dashboard-screen') };
  const dialog = $('#product-dialog');


  // Product Image Cropper
  const cropperDialog = $('#image-cropper-dialog');
  const cropperImage = $('#image-cropper-source');

  let productImageCropper = null;
  let cropperObjectUrl = null;



  // Clean up Cropper resources
  function cleanupImageCropper() {
    if (productImageCropper) {
      productImageCropper.destroy();
      productImageCropper = null;
    }

    if (cropperObjectUrl) {
      URL.revokeObjectURL(cropperObjectUrl);
      cropperObjectUrl = null;
    }

    cropperImage.onload = null;
    cropperImage.onerror = null;
    cropperImage.removeAttribute('src');

    $('#product-image').value = '';
  }

  // Open Image Cropper
  async function openImageCropper(file) {
    if (!file) return;

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error('فقط تصاویر JPG، PNG و WebP مجاز هستند.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('حجم تصویر نباید بیشتر از ۵ مگابایت باشد.');
    }

    if (typeof window.Cropper !== 'function') {
      throw new Error('ابزار برش تصویر بارگذاری نشده است. صفحه را دوباره بارگذاری کنید.');
    }

    cleanupImageCropper();

    showFormMessage($('#cropper-message'), '');

    cropperObjectUrl = URL.createObjectURL(file);

    await new Promise((resolve, reject) => {
      cropperImage.onload = () => {
        try {
          cropperDialog.showModal();

          requestAnimationFrame(() => {
            try {
              productImageCropper = new window.Cropper(
                cropperImage,
                {
                  aspectRatio: 1,
                  viewMode: 1,
                  dragMode: 'move',

                  autoCropArea: 0.85,

                  responsive: true,
                  restore: false,

                  guides: true,
                  center: true,
                  highlight: false,
                  background: false,

                  movable: true,
                  zoomable: true,
                  zoomOnTouch: true,
                  zoomOnWheel: true,

                  rotatable: true,
                  scalable: false,

                  cropBoxMovable: true,
                  cropBoxResizable: true,

                  toggleDragModeOnDblclick: false
                }
              );

              resolve();
            } catch (error) {
              reject(error);
            }
          });

        } catch (error) {
          reject(error);
        }
      };

      cropperImage.onerror = () => {
        reject(new Error('خواندن تصویر انتخاب‌شده امکان‌پذیر نیست.'));
      };

      cropperImage.src = cropperObjectUrl;
    });
  }

  // Apply Crop and Upload
  async function applyImageCrop() {
    if (!productImageCropper) {
      showFormMessage(
        $('#cropper-message'),
        'ابتدا یک تصویر انتخاب کنید.'
      );
      return;
    }

    const button = $('#apply-cropper');

    button.disabled = true;

    try {
      const canvas = productImageCropper.getCroppedCanvas({
        width: 1000,
        height: 1000,

        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });

      if (!canvas) {
        throw new Error('ساخت تصویر برش‌خورده ناموفق بود.');
      }

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error('تبدیل تصویر ناموفق بود.'));
              return;
            }

            resolve(result);
          },
          'image/webp',
          0.88
        );
      });

      if (blob.type !== 'image/webp') {
        throw new Error('مرورگر نتوانست تصویر را به WebP تبدیل کند.');
      }

      if (blob.size > 5 * 1024 * 1024) {
        throw new Error('حجم خروجی تصویر بیشتر از ۵ مگابایت است.');
      }

      const croppedFile = new File(
        [blob],
        'product-image.webp',
        {
          type: 'image/webp',
          lastModified: Date.now()
        }
      );

      // Upload through the existing API
      await uploadSelectedImage(croppedFile);

      // Close Cropper after successful upload
      cropperDialog.close();

    } catch (error) {
      showFormMessage(
        $('#cropper-message'),
        error.message
      );
    } finally {
      button.disabled = false;
    }
  }



  function showScreen(name) {
    Object.entries(screens).forEach(([key, node]) => { node.hidden = key !== name; });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    let payload;
    try { payload = await response.json(); } catch (error) { payload = {}; }
    if (!response.ok) {
      const message = payload.message || (response.status === 401 ? 'نشست شما معتبر نیست؛ دوباره وارد شوید.' : `خطای سرور (${response.status})`);
      if (response.status === 401 && !url.endsWith('/login')) {
        state.username = '';
        showScreen('login');
      }
      const err = new Error(message);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }
    return payload;
  }

  function notify(message, type = 'success') {
    const box = $('#global-message');
    box.textContent = message;
    box.classList.toggle('error', type === 'error');
    box.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => { box.hidden = true; }, 4200);
  }

  function showFormMessage(node, message, type = 'error') {
    node.textContent = message;
    node.classList.toggle('success', type === 'success');
    node.hidden = !message;
  }

  function formatPrice(value) {
    return `${Number(value || 0).toLocaleString('fa-IR')} تومان`;
  }

  function categoryName(id) {
    return state.categories.find((category) => category.id === id)?.name || id || '—';
  }

  async function checkSession() {
    try {
      const result = await request('/api/admin/session');
      if (result.authenticated) {
        state.username = result.username || 'مدیر';
        await enterDashboard();
      } else {
        showScreen('login');
      }
    } catch (error) {
      showScreen('login');
      showFormMessage($('#login-message'), error.message);
    }
  }

  async function enterDashboard() {
    $('#admin-username').textContent = state.username;
    showScreen('dashboard');
    try {
      await Promise.all([loadCategories(), loadDashboard(), loadProducts(), loadSettings()]);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function loadCategories() {
    const result = await request('/api/admin/categories');
    state.categories = result.data || [];
    $('#category-filter').innerHTML = '<option value="">همه دسته‌بندی‌ها</option>';
    const allOptions = state.categories.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}${item.active ? '' : ' (غیرفعال)'}</option>`).join('');
    const activeOptions = state.categories.filter((item) => item.active).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
    $('#category-filter').insertAdjacentHTML('beforeend', allOptions);
    $('#product-category').innerHTML = activeOptions || '<option value="">دسته‌بندی فعال موجود نیست</option>';
    renderCategories();
  }

  async function loadDashboard() {
    const result = await request('/api/admin/dashboard');
    const stats = result.data || {};
    $('#stat-total').textContent = Number(stats.totalProducts || 0).toLocaleString('fa-IR');
    $('#stat-active').textContent = Number(stats.activeProducts || 0).toLocaleString('fa-IR');
    $('#stat-inactive').textContent = Number(stats.inactiveProducts || 0).toLocaleString('fa-IR');
  }

  async function loadProducts() {
    const params = new URLSearchParams();
    const query = $('#product-search').value.trim();
    const category = $('#category-filter').value;
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    const result = await request(`/api/admin/products${params.size ? `?${params}` : ''}`);
    state.products = result.data || [];
    renderProducts();
    renderCategories();
    renderRecentProducts();
  }

  function productImage(product, className = 'product-thumb') {
    if (product.img) return `<img class="${className}" src="${escapeHtml(product.img)}" alt="${escapeHtml(product.name)}" loading="lazy">`;
    return `<div class="${className}" aria-label="بدون تصویر">✦</div>`;
  }

  function renderProducts() {
    const status = $('#status-filter').value;
    const rows = state.products.filter((product) => status === '' || (status === 'active' ? product.available : !product.available));
    $('#products-table-body').innerHTML = rows.length ? rows.map((product) => `
      <tr>
        <td><div class="product-cell">${productImage(product)}<div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.desc || 'بدون توضیحات')}</small></div></div></td>
        <td>${escapeHtml(product.id)}</td>
        <td>${escapeHtml(categoryName(product.cat))}</td>
        <td><strong class="price-text">${formatPrice(product.price)}</strong></td>
        <td><span class="status-pill ${product.available ? 'active' : 'inactive'}">${product.available ? '● فعال' : '● غیرفعال'}</span></td>
        <td><div class="row-actions"><button class="action-btn" type="button" data-action="edit" data-id="${escapeHtml(product.id)}">ویرایش</button><button class="action-btn" type="button" data-action="toggle" data-id="${escapeHtml(product.id)}">${product.available ? 'غیرفعال' : 'فعال‌سازی'}</button><button class="action-btn delete" type="button" data-action="delete" data-id="${escapeHtml(product.id)}">حذف</button></div></td>
      </tr>`).join('') : '<tr><td colspan="6" class="empty-state">محصولی با این مشخصات پیدا نشد.</td></tr>';
    $('#products-count').textContent = `${rows.length.toLocaleString('fa-IR')} محصول نمایش داده می‌شود`;
  }

  function renderRecentProducts() {
    const recent = state.products.slice(0, 5);
    $('#recent-products').innerHTML = recent.length ? recent.map((product) => `
      <div class="recent-item">${productImage(product)}<div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.id)} · ${escapeHtml(categoryName(product.cat))}</small></div><span class="price-text">${formatPrice(product.price)}</span></div>`).join('') : '<div class="empty-state">هنوز محصولی ثبت نشده است.</div>';
  }

  async function loadSettings() {
    const result = await request('/api/admin/settings');
    state.settings = result.data || {};
    $('#setting-store-name').value = state.settings.storeName || 'استیکر بنزی';
    $('#setting-whatsapp').value = state.settings.whatsappNumber || '';
    $('#setting-bale').value = state.settings.baleUrl || '';
    $('#setting-instagram').value = state.settings.instagramUrl || '';
    state.settings.heroImages = state.settings.heroImages || {};
    ['center', 'left1', 'left2', 'left3', 'left4'].forEach((slot) => {
      renderHeroImagePreview(slot, state.settings.heroImages[slot] || '');
    });
  }

  function renderHeroImagePreview(slot, imageUrl) {
    const preview = $(`[data-hero-preview="${slot}"]`);
    const clearButton = $(`[data-clear-hero-slot="${slot}"]`);
    if (!preview) return;
    preview.replaceChildren();
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('../uploads/hero/')) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = `پیش‌نمایش تصویر ${slot}`;
      image.loading = 'lazy';
      preview.appendChild(image);
      if (clearButton) clearButton.disabled = false;
    } else {
      const placeholder = document.createElement('span');
      placeholder.textContent = 'بدون تصویر';
      preview.appendChild(placeholder);
      if (clearButton) clearButton.disabled = true;
    }
  }

  async function uploadHeroImage(slot, file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('فقط تصویر JPG، PNG یا WebP مجاز است.');
    }
    if (file.size > 5 * 1024 * 1024) throw new Error('حجم تصویر نباید بیشتر از ۵ مگابایت باشد.');
    const formData = new FormData();
    formData.append('image', file);
    const status = $(`[data-hero-status="${slot}"]`);
    status.textContent = 'در حال بارگذاری و ذخیره...';
    const result = await request(`/api/admin/hero-images/${encodeURIComponent(slot)}`, {
      method: 'POST',
      body: formData
    });
    const imageUrl = result.data && result.data.url ? result.data.url : '';
    state.settings.heroImages = state.settings.heroImages || {};
    state.settings.heroImages[slot] = imageUrl;
    renderHeroImagePreview(slot, imageUrl);
    status.textContent = 'تصویر ذخیره شد.';
    notify('تصویر هیرو با موفقیت تغییر کرد.');
  }

  async function clearHeroImage(slot) {
    const status = $(`[data-hero-status="${slot}"]`);
    status.textContent = 'در حال حذف تصویر...';
    try {
      await request(`/api/admin/hero-images/${encodeURIComponent(slot)}`, { method: 'DELETE' });
      state.settings.heroImages = state.settings.heroImages || {};
      state.settings.heroImages[slot] = '';
      renderHeroImagePreview(slot, '');
      status.textContent = 'تصویر حذف شد.';
      notify('تصویر از هیرو حذف شد.');
    } catch (error) {
      status.textContent = '';
      notify(error.message, 'error');
    }
  }

  function formatAnalyticsNumber(value) {
    return Number(value || 0).toLocaleString('fa-IR');
  }

  function renderAnalyticsList(selector, items, getLabel, getValue, emptyText) {
    const container = $(selector);
    if (!items || !items.length) {
      container.innerHTML = `<p class="analytics-empty">${escapeHtml(emptyText)}</p>`;
      return;
    }
    const max = Math.max(1, ...items.map((item) => Number(getValue(item) || 0)));
    container.innerHTML = items.map((item) => {
      const value = Number(getValue(item) || 0);
      const percent = Math.max(0, Math.min(100, (value / max) * 100));
      return `<div class="analytics-list-item"><div class="analytics-list-line"><span class="analytics-list-name" title="${escapeHtml(getLabel(item))}">${escapeHtml(getLabel(item))}</span><strong>${formatAnalyticsNumber(value)}</strong></div><div class="analytics-progress"><span style="width:${percent.toFixed(1)}%"></span></div></div>`;
    }).join('');
  }

  function renderAnalyticsTimeline(items) {
    const container = $('#analytics-timeline');
    if (!items || !items.length || items.every((item) => !Number(item.pageViews))) {
      container.innerHTML = '<p class="analytics-empty">در این بازه هنوز بازدیدی ثبت نشده است.</p>';
      return;
    }
    const max = Math.max(1, ...items.map((item) => Number(item.pageViews || 0)));
    container.innerHTML = `<div class="analytics-bars">${items.map((item) => {
      const value = Number(item.pageViews || 0);
      const height = Math.max(value > 0 ? 4 : 0, (value / max) * 100);
      const date = String(item.day || '');
      const label = date ? new Date(`${date}T12:00:00`).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }) : '—';
      return `<div class="analytics-bar-column" title="${escapeHtml(label)}: ${formatAnalyticsNumber(value)} بازدید"><span class="analytics-bar-value">${formatAnalyticsNumber(value)}</span><div class="analytics-bar-track"><i style="height:${height.toFixed(1)}%"></i></div><small>${escapeHtml(label)}</small></div>`;
    }).join('')}</div>`;
  }

  async function loadAnalytics() {
    if (state.analyticsLoading) return;
    state.analyticsLoading = true;
    const status = $('#analytics-status');
    const refresh = $('#analytics-refresh');
    status.textContent = 'در حال دریافت گزارش‌ها...';
    status.classList.remove('error');
    refresh.disabled = true;
    try {
      const result = await request(`/api/admin/analytics?range=${encodeURIComponent(state.analyticsRange)}`);
      const data = result.data || {};
      const summary = data.summary || {};
      $('#analytics-page-views').textContent = formatAnalyticsNumber(summary.pageViews);
      $('#analytics-product-views').textContent = formatAnalyticsNumber(summary.productViews);
      $('#analytics-add-to-cart').textContent = formatAnalyticsNumber(summary.addToCart);
      $('#analytics-contact-clicks').textContent = formatAnalyticsNumber(summary.contactClicks);
      $('#analytics-checkout-starts').textContent = formatAnalyticsNumber(summary.checkoutStarts);
      renderAnalyticsTimeline(data.timeline || []);
      renderAnalyticsList('#analytics-top-pages', data.topPages || [], (item) => item.title || item.path, (item) => item.views, 'هنوز بازدید صفحه‌ای ثبت نشده است.');
      renderAnalyticsList('#analytics-top-products', data.topProducts || [], (item) => `${item.name || item.productId} (${item.productId})`, (item) => item.views, 'هنوز مشاهده محصولی ثبت نشده است.');
      const deviceLabels = { mobile: 'موبایل', tablet: 'تبلت', desktop: 'دسکتاپ', unknown: 'نامشخص' };
      renderAnalyticsList('#analytics-devices', data.devices || [], (item) => deviceLabels[item.device] || item.device, (item) => item.visits, 'هنوز داده دستگاهی ثبت نشده است.');
      renderAnalyticsList('#analytics-sources', data.sources || [], (item) => item.source === 'direct' ? 'ورود مستقیم' : item.source, (item) => item.visits, 'هنوز منبع ورودی ثبت نشده است.');
      status.textContent = `گزارش ${state.analyticsRange === '7d' ? '۷ روز' : state.analyticsRange === '30d' ? '۳۰ روز' : '۹۰ روز'} گذشته بروزرسانی شد.`;
    } catch (error) {
      status.textContent = `دریافت آمار با خطا مواجه شد: ${error.message}`;
      status.classList.add('error');
      $('#analytics-timeline').innerHTML = '<p class="analytics-empty">امکان دریافت نمودار وجود ندارد.</p>';
    } finally {
      state.analyticsLoading = false;
      refresh.disabled = false;
    }
  }

  function changeView(view) {
    const titleMap = { overview: 'نمای کلی', products: 'مدیریت محصولات', analytics: 'آمار و گزارش‌ها', categories: 'مدیریت دسته‌بندی‌ها', settings: 'تنظیمات فروشگاه' };
    Object.keys(titleMap).forEach((key) => { $(`#view-${key}`).hidden = key !== view; });
    $$('[data-view]').forEach((button) => {
      if (button.classList.contains('nav-link')) button.classList.toggle('active', button.dataset.view === view);
    });
    $('#page-title').textContent = titleMap[view] || 'پنل مدیریت';
    $('#sidebar').classList.remove('open');
    $('#mobile-menu-button').setAttribute('aria-expanded', 'false');
    if (view === 'products') loadProducts().catch((error) => notify(error.message, 'error'));
    if (view === 'categories') Promise.all([loadCategories(), loadProducts()]).catch((error) => notify(error.message, 'error'));
    if (view === 'overview') Promise.all([loadDashboard(), loadProducts()]).catch((error) => notify(error.message, 'error'));
    if (view === 'analytics') loadAnalytics();
  }

  function renderCategories() {
    const counts = new Map();
    state.products.forEach((product) => counts.set(product.cat, (counts.get(product.cat) || 0) + 1));
    $('#categories-table-body').innerHTML = state.categories.length ? state.categories.map((category) => `
      <tr><td>${escapeHtml(category.id)}</td><td><strong>${escapeHtml(category.name)}</strong><small>${escapeHtml(category.desc || 'بدون توضیحات')}</small></td><td><i class="${escapeHtml(category.icon)}" aria-hidden="true"></i> ${escapeHtml(category.icon)}</td><td>${Number(counts.get(category.id) || 0).toLocaleString('fa-IR')}</td><td><span class="status-pill ${category.active ? 'active' : 'inactive'}">${category.active ? '● فعال' : '● غیرفعال'}</span></td><td><div class="row-actions"><button class="action-btn" type="button" data-category-action="edit" data-id="${escapeHtml(category.id)}">ویرایش</button><button class="action-btn" type="button" data-category-action="toggle" data-id="${escapeHtml(category.id)}">${category.active ? 'غیرفعال' : 'فعال‌سازی'}</button><button class="action-btn delete" type="button" data-category-action="delete" data-id="${escapeHtml(category.id)}">حذف</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="empty-state">هنوز دسته‌بندی ثبت نشده است.</td></tr>';
    $('#categories-count').textContent = `${state.categories.length.toLocaleString('fa-IR')} دسته‌بندی`;
  }

  function openCategoryDialog(category = null) {
    state.editingCategoryId = category ? category.id : null;
    $('#category-form').reset();
    $('#category-id-input').disabled = Boolean(category);
    $('#category-id-input').value = category ? category.id : '';
    $('#category-name-input').value = category ? category.name : '';
    $('#category-icon-input').value = category ? category.icon : 'ri-apps-line';
    $('#category-desc-input').value = category ? category.desc : '';
    $('#category-dialog-title').textContent = category ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید';
    $('#save-category-button').textContent = category ? 'ذخیره تغییرات' : 'ثبت دسته‌بندی';
    showFormMessage($('#category-form-message'), '');
    $('#category-dialog').showModal();
  }

  async function saveCategory(event) {
    event.preventDefault();
    const payload = { id: $('#category-id-input').value.trim(), name: $('#category-name-input').value.trim(), icon: $('#category-icon-input').value.trim(), desc: $('#category-desc-input').value.trim() };
    const button = $('#save-category-button');
    button.disabled = true;
    try {
      await request(state.editingCategoryId ? `/api/admin/categories/${encodeURIComponent(state.editingCategoryId)}` : '/api/admin/categories', { method: state.editingCategoryId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      $('#category-dialog').close();
      await Promise.all([loadCategories(), loadProducts()]);
      notify(state.editingCategoryId ? 'دسته‌بندی ویرایش شد.' : 'دسته‌بندی اضافه شد.');
    } catch (error) { showFormMessage($('#category-form-message'), error.message); }
    finally { button.disabled = false; }
  }

  async function categoryAction(id, action) {
    const category = state.categories.find((item) => item.id === id);
    if (!category) return;
    try {
      if (action === 'edit') return openCategoryDialog(category);
      if (action === 'toggle') {
        await request(`/api/admin/categories/${encodeURIComponent(id)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !category.active }) });
        await Promise.all([loadCategories(), loadProducts()]);
        return notify(category.active ? 'دسته‌بندی غیرفعال شد.' : 'دسته‌بندی فعال شد.');
      }
      if (action === 'delete') {
        if (!confirm(`دسته‌بندی «${category.name}» حذف شود؟ حذف فقط وقتی ممکن است که هیچ محصولی به آن متصل نباشد.`)) return;
        await request(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
        await Promise.all([loadCategories(), loadProducts()]);
        notify('دسته‌بندی حذف شد.');
      }
    } catch (error) { notify(error.message, 'error'); }
  }

  async function cleanupUnattachedUpload() {
    if (!state.uploadedFileName) return;
    const fileName = state.uploadedFileName;
    state.uploadedFileName = '';
    try { await request(`/api/admin/upload/${encodeURIComponent(fileName)}`, { method: 'DELETE' }); }
    catch (error) { /* فایل استفاده‌نشده در صورت خطا بعداً قابل پاک‌سازی است. */ }
  }

  function resetProductForm() {
    $('#product-form').reset();
    $('#product-id').disabled = false;
    $('#product-active').checked = true;
    $('#product-image-path').value = '';
    $('#image-preview').innerHTML = '<span>بدون تصویر</span>';
    $('#image-upload-status').textContent = '';
    $('#product-image').value = '';
    state.uploadedFileName = '';
    state.editingIcon = 'ri-sticky-note-line';
    showFormMessage($('#product-form-message'), '');
  }

  function openProductDialog(product = null) {
    resetProductForm();
    state.editingId = product ? product.id : null;
    state.editingIcon = product && product.icon ? String(product.icon) : 'ri-sticky-note-line';
    $('#product-dialog-title').textContent = product ? 'ویرایش محصول' : 'افزودن محصول جدید';
    $('#save-product-button').textContent = product ? 'ذخیره تغییرات' : 'ثبت محصول';
    if (product) {
      $('#product-id').value = product.id;
      $('#product-id').disabled = true;
      $('#product-name').value = product.name || '';
      $('#product-category').value = product.cat || '';
      $('#product-price').value = product.price ?? 0;
      $('#product-description').value = product.desc || '';
      $('#product-image-path').value = product.img || '';
      $('#product-active').checked = Boolean(product.available);
      if (product.img) $('#image-preview').innerHTML = `<img src="${escapeHtml(product.img)}" alt="پیش‌نمایش تصویر محصول">`;
    }
    dialog.showModal();
  }


async function uploadSelectedImage(file) {
  if (!file) return;

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('فقط تصویر JPG، PNG یا WebP مجاز است.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('حجم تصویر نباید بیشتر از ۵ مگابایت باشد.');
  }

  // Remember the previous temporary upload
  const previousUploadedFileName = state.uploadedFileName;

  const formData = new FormData();
  formData.append('image', file);

  $('#image-upload-status').textContent = 'در حال بارگذاری تصویر...';

  // Upload the new image first
  const result = await request('/api/admin/upload', {
    method: 'POST',
    body: formData
  });

  // Update the product form with the new image
  const newFileName = result.data.fileName;

  $('#product-image-path').value = result.data.url;
  state.uploadedFileName = newFileName;

  $('#image-preview').innerHTML = `
    <img
      src="${escapeHtml(result.data.url)}"
      alt="پیش‌نمایش تصویر جدید"
    >
  `;

  $('#image-upload-status').textContent =
    'تصویر با موفقیت بارگذاری شد.';

  // Remove the previous temporary upload
  if (
    previousUploadedFileName &&
    previousUploadedFileName !== newFileName
  ) {
    try {
      await request(
        `/api/admin/upload/${encodeURIComponent(previousUploadedFileName)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      console.warn(
        'Temporary image cleanup failed:',
        error
      );

      $('#image-upload-status').textContent =
        'تصویر جدید بارگذاری شد؛ پاک‌سازی فایل موقت قبلی ناموفق بود.';
    }
  }
}


  async function saveProduct(event) {
    event.preventDefault();
    const button = $('#save-product-button');
    const message = $('#product-form-message');
    const product = {
      id: $('#product-id').value.trim(),
      cat: $('#product-category').value,
      name: $('#product-name').value.trim(),
      price: Number($('#product-price').value),
      desc: $('#product-description').value.trim(),
      icon: state.editingIcon || 'ri-sticky-note-line',
      img: $('#product-image-path').value,
      available: $('#product-active').checked
    };
    if (!product.id || !product.name || !product.cat || !Number.isSafeInteger(product.price) || product.price < 0) {
      showFormMessage(message, 'کد، نام، دسته‌بندی و قیمت معتبر را وارد کنید.');
      return;
    }
    button.disabled = true;
    button.textContent = 'در حال ذخیره...';
    try {
      await request(state.editingId ? `/api/admin/products/${encodeURIComponent(state.editingId)}` : '/api/admin/products', {
        method: state.editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      state.uploadedFileName = '';
      dialog.close();
      notify(state.editingId ? 'تغییرات محصول ذخیره شد.' : 'محصول جدید ثبت شد.');
      await Promise.all([loadProducts(), loadDashboard()]);
    } catch (error) {
      showFormMessage(message, error.message);
    } finally {
      button.disabled = false;
      button.textContent = state.editingId ? 'ذخیره تغییرات' : 'ثبت محصول';
    }
  }

  async function toggleProduct(id) {
    const product = state.products.find((item) => item.id === id);
    if (!product) return;
    try {
      await request(`/api/admin/products/${encodeURIComponent(id)}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: !product.available })
      });
      notify(product.available ? 'محصول غیرفعال شد.' : 'محصول فعال شد.');
      await Promise.all([loadProducts(), loadDashboard()]);
    } catch (error) { notify(error.message, 'error'); }
  }

  function askDelete(product) {
    $('#confirm-message').textContent = `محصول «${product.name}» با کد ${product.id} حذف شود؟ این عملیات قابل بازگشت نیست.`;
    $('#confirm-dialog').hidden = false;
    $('#confirm-accept').onclick = async () => {
      $('#confirm-accept').disabled = true;
      try {
        await request(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' });
        $('#confirm-dialog').hidden = true;
        notify('محصول حذف شد.');
        await Promise.all([loadProducts(), loadDashboard()]);
      } catch (error) { notify(error.message, 'error'); }
      finally { $('#confirm-accept').disabled = false; }
    };
  }

  async function saveSettings(event) {
    event.preventDefault();
    const button = $('#save-settings-button');
    button.disabled = true;
    button.textContent = 'در حال ذخیره...';
    try {
      const payload = {
        storeName: $('#setting-store-name').value.trim(),
        whatsappNumber: $('#setting-whatsapp').value.trim(),
        baleUrl: $('#setting-bale').value.trim(),
        instagramUrl: $('#setting-instagram').value.trim()
      };
      await request('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      notify('تنظیمات فروشگاه ذخیره شد.');
    } catch (error) { notify(error.message, 'error'); }
    finally { button.disabled = false; button.textContent = 'ذخیره تنظیمات'; }
  }

  async function logout() {
    try { await request('/api/admin/logout', { method: 'POST' }); }
    catch (error) { /* نشست ممکن است قبلاً منقضی شده باشد. */ }
    state.username = '';
    $('#login-form').reset();
    showFormMessage($('#login-message'), '');
    showScreen('login');
  }

  const loginPassword = $('#login-password');
  const passwordToggle = $('#password-toggle');

  passwordToggle.addEventListener('click', () => {
    const shouldShowPassword = loginPassword.type === 'password';
    loginPassword.type = shouldShowPassword ? 'text' : 'password';
    passwordToggle.innerHTML = shouldShowPassword
      ? '<i class="ri-eye-off-line" aria-hidden="true"></i>'
      : '<i class="ri-eye-line" aria-hidden="true"></i>';
    passwordToggle.setAttribute('aria-label', shouldShowPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور');
    passwordToggle.setAttribute('aria-pressed', String(shouldShowPassword));
  });

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#login-submit');
    button.disabled = true;
    button.textContent = 'در حال ورود...';
    showFormMessage($('#login-message'), '');
    try {
      const result = await request('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: $('#login-username').value.trim(), password: $('#login-password').value })
      });
      state.username = result.username || $('#login-username').value.trim();
      $('#login-password').value = '';
      await enterDashboard();
    } catch (error) { showFormMessage($('#login-message'), error.message); }
    finally { button.disabled = false; button.textContent = 'ورود به پنل'; }
  });

  $('#analytics-range').addEventListener('change', (event) => {
    state.analyticsRange = ['7d', '30d', '90d'].includes(event.target.value) ? event.target.value : '30d';
    loadAnalytics();
  });
  $('#analytics-refresh').addEventListener('click', loadAnalytics);
  $('#logout-button').addEventListener('click', logout);
  $('#settings-form').addEventListener('submit', saveSettings);
  $$('.hero-image-input').forEach((input) => {
    input.addEventListener('change', async (event) => {
      const slot = input.dataset.heroSlot;
      const file = event.target.files && event.target.files[0];
      try { await uploadHeroImage(slot, file); }
      catch (error) {
        const status = $(`[data-hero-status="${slot}"]`);
        if (status) status.textContent = '';
        notify(error.message, 'error');
      } finally {
        input.value = '';
      }
    });
  });
  $$('[data-clear-hero-slot]').forEach((button) => {
    button.addEventListener('click', () => clearHeroImage(button.dataset.clearHeroSlot));
  });
  $('#product-form').addEventListener('submit', saveProduct);

  // Product Image Selection
  $('#product-image').addEventListener('change', async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    try {
      await openImageCropper(file);
    } catch (error) {
      cleanupImageCropper();

      showFormMessage(
        $('#product-form-message'),
        error.message
      );
    }
  });

  // Zoom In
  $('#cropper-zoom-in').addEventListener('click', () => {
    productImageCropper?.zoom(0.1);
  });

  // Zoom Out
  $('#cropper-zoom-out').addEventListener('click', () => {
    productImageCropper?.zoom(-0.1);
  });

  // Rotate Left
  $('#cropper-rotate-left').addEventListener('click', () => {
    productImageCropper?.rotate(-90);
  });

  // Reset Cropper
  $('#cropper-reset').addEventListener('click', () => {
    productImageCropper?.reset();
  });

  // Apply Crop
  $('#apply-cropper').addEventListener('click', applyImageCrop);

  // Close Cropper
  $('#close-cropper-dialog').addEventListener('click', () => {
    cropperDialog.close();
  });

  $('#cancel-cropper').addEventListener('click', () => {
    cropperDialog.close();
  });

  // Cleanup on close / Escape
  cropperDialog.addEventListener('close', cleanupImageCropper);

  $('#close-product-dialog').addEventListener('click', () => dialog.close());
  $('#cancel-product-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', cleanupUnattachedUpload);
  $('#confirm-cancel').addEventListener('click', () => { $('#confirm-dialog').hidden = true; });
  $('#category-filter').addEventListener('change', () => loadProducts().catch((error) => notify(error.message, 'error')));
  $('#status-filter').addEventListener('change', renderProducts);
  let searchTimer;
  $('#product-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadProducts().catch((error) => notify(error.message, 'error')), 250);
  });
  $('#add-category-button').addEventListener('click', () => openCategoryDialog());
  $('#category-form').addEventListener('submit', saveCategory);
  $('#close-category-dialog').addEventListener('click', () => $('#category-dialog').close());
  $('#cancel-category-dialog').addEventListener('click', () => $('#category-dialog').close());
  $('#categories-table-body').addEventListener('click', (event) => { const button = event.target.closest('button[data-category-action]'); if (button) categoryAction(button.dataset.id, button.dataset.categoryAction); });
  $$('[data-view]').forEach((button) => button.addEventListener('click', () => changeView(button.dataset.view)));
  $$('[data-action="add-product"]').forEach((button) => button.addEventListener('click', () => openProductDialog()));
  $('#products-table-body').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const product = state.products.find((item) => item.id === button.dataset.id);
    if (!product) return;
    if (button.dataset.action === 'edit') openProductDialog(product);
    if (button.dataset.action === 'toggle') toggleProduct(product.id);
    if (button.dataset.action === 'delete') askDelete(product);
  });
  $('#mobile-menu-button').addEventListener('click', () => {
    const open = $('#sidebar').classList.toggle('open');
    $('#mobile-menu-button').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') $('#confirm-dialog').hidden = true;
  });

  checkSession();
})();

// ===== صفحه دسته‌بندی =====
// فعلاً با آدرس /category?c=jelly کار می‌کند. در مرحله بک‌اند به /category/jelly (رندر سمت سرور) تبدیل می‌شود.
(function () {
window.StoreDataReady.then(() => {
  const params = new URLSearchParams(location.search);
  const catId = params.get('c') || 'all';
  const cats = window.CATEGORIES;
  const current = cats.find(c => c.id === catId) ||
    { id: 'all', name: 'همه محصولات', icon: 'ri-apps-2-line', desc: 'همه استیکرهای استیکر بنزی؛ دسته مورد علاقه‌ات رو انتخاب کن.' };

  const fmtNum = n => Number(n).toLocaleString('fa-IR');
  const storeName = String(window.SITE_CONFIG.storeName || 'استیکر بنزی');

  // ---------- سکشن ۱: هدر صفحه ----------
  document.title = `${current.name} | ${storeName}`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = current.desc;
  document.getElementById('cat-crumb').textContent = current.name;
  document.getElementById('cat-title').textContent = current.name;
  document.getElementById('cat-desc').textContent = current.desc;
  document.getElementById('cat-icon').querySelector('i').className = current.icon;

  const box = document.getElementById('cat-switch');
  [{ id: 'all', name: 'همه', icon: 'ri-apps-2-line' }, ...cats].forEach(c => {
    const a = document.createElement('a');
    a.className = 'chip' + (c.id === current.id ? ' active' : '');
    a.href = c.id === 'all' ? './category.html' : './category.html?c=' + encodeURIComponent(c.id);
    if (c.id === current.id) a.setAttribute('aria-current', 'page');
    const i = document.createElement('i'); i.className = c.icon; i.setAttribute('aria-hidden', 'true');
    a.append(i, ' ' + c.name);
    box.appendChild(a);
  });

  // ---------- سکشن ۲: جستجو و مرتب‌سازی ----------
  const searchEl = document.getElementById('cat-search');
  const sortEl = document.getElementById('cat-sort');
  const countEl = document.getElementById('cat-count');

  // یکسان‌سازی متن فارسی برای جستجو: ی/ک عربی، نیم‌فاصله، اعداد فارسی و عربی
  const normalize = s => String(s || '')
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[‌‏‎]/g, ' ')
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/\s+/g, ' ').trim().toLowerCase();

  const SORTS = {
    default: null,
    cheap: (a, b) => a.price - b.price,
    expensive: (a, b) => b.price - a.price
  };

  const state = {
    q: params.get('q') || '',
    sort: SORTS.hasOwnProperty(params.get('sort')) ? params.get('sort') : 'default'
  };
  searchEl.value = state.q;
  sortEl.value = state.sort;

  // لیست محصولات این دسته بعد از اعمال جستجو و مرتب‌سازی
  function getList() {
    const q = normalize(state.q);
    let list = window.PRODUCTS.filter(p =>
      p.available &&                                   // محصول ناموجود اصلاً نمایش داده نمی‌شود
      (current.id === 'all' || p.cat === current.id) &&
      (!q || normalize(p.name + ' ' + (p.desc || '') + ' ' + p.id).replace(/ /g, '').includes(q.replace(/ /g, '')))
    );
    if (SORTS[state.sort]) list = list.slice().sort(SORTS[state.sort]);
    return list;
  }

  function update() {
    const list = getList();
    countEl.textContent = list.length
      ? fmtNum(list.length) + ' محصول' + (state.q ? ' برای «' + state.q.trim() + '»' : '')
      : (state.q ? 'محصولی برای «' + state.q.trim() + '» پیدا نشد.' : 'فعلاً محصولی در این دسته نداریم.');

    // ذخیره در آدرس تا لینک قابل اشتراک باشد
    const p = new URLSearchParams(location.search);
    state.q.trim() ? p.set('q', state.q.trim()) : p.delete('q');
    state.sort !== 'default' ? p.set('sort', state.sort) : p.delete('sort');
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));

    // سکشن گرید محصولات (مرحله بعد) به همین رویداد گوش می‌دهد
    document.dispatchEvent(new CustomEvent('catchange', { detail: { list, state, category: current } }));
  }

  let timer;
  searchEl.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = searchEl.value; update(); }, 200);
  });
  sortEl.addEventListener('change', () => { state.sort = sortEl.value; update(); });

  // ---------- سکشن ۳: گرید محصولات ----------
  const PAGE_SIZE = 12;
  const grid = document.getElementById('product-grid');
  const pagination = document.getElementById('product-pagination');
  let currentPage = 1;
  let lastList = [];

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderGrid() {
    const totalPages = Math.max(1, Math.ceil(lastList.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    grid.replaceChildren(...lastList.slice(start, start + PAGE_SIZE).map(p => ProductCard.make(p)));
    pagination.replaceChildren(); pagination.hidden = totalPages <= 1;
    if (totalPages <= 1) return;
    const addButton = (label, page, options = {}) => {
      const button = el('button', 'pagination-button' + (options.active ? ' active' : '') + (options.ellipsis ? ' ellipsis' : ''), label);
      button.type = 'button'; button.disabled = Boolean(options.disabled || options.ellipsis);
      if (options.active) button.setAttribute('aria-current', 'page');
      if (!options.disabled && !options.ellipsis) button.addEventListener('click', () => { currentPage = page; renderGrid(); grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      pagination.appendChild(button);
    };
    addButton('قبلی', currentPage - 1, { disabled: currentPage === 1 });
    let pages = totalPages <= 7 ? Array.from({ length: totalPages }, (_, i) => i + 1) : [1, ...(currentPage > 3 ? ['…'] : []), ...Array.from({ length: Math.min(totalPages - 2, 3) }, (_, i) => Math.max(2, Math.min(totalPages - 2, currentPage - 1)) + i).filter(page => page < totalPages), ...(currentPage < totalPages - 2 ? ['…'] : []), totalPages];
    pages = [...new Set(pages)];
    pages.forEach(page => page === '…' ? addButton('…', 0, { ellipsis: true }) : addButton(String(page), page, { active: page === currentPage }));
    addButton('بعدی', currentPage + 1, { disabled: currentPage === totalPages });
  }

  document.addEventListener('catchange', e => {
    lastList = e.detail.list;
    currentPage = 1;
    renderGrid();
  });



  update();
  document.addEventListener('storeproductsrefreshed', update);
}).catch(() => {
  // خطای دریافت اطلاعات در پیام عمومی store-data.js نمایش داده می‌شود.
});
})();

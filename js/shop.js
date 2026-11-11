// صفحه‌بندی عددی محصولات سکشن فروشگاه صفحه اصلی
(function () {
  'use strict';
  window.StoreDataReady.then(() => {
    const PAGE_SIZE = 12;
    let activeCat = 'all';
    let currentPage = 1;
    const grid = document.getElementById('product-grid');
    const tabs = document.getElementById('cat-tabs');
    const pagination = document.getElementById('product-pagination');
    const empty = document.getElementById('shop-empty');
    if (!grid || !tabs || !pagination) return;

    function el(tag, cls, text) { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; }

    function renderPagination(totalPages) {
      pagination.replaceChildren();
      pagination.hidden = totalPages <= 1;
      if (totalPages <= 1) return;
      const addButton = (label, page, options = {}) => {
        const button = el('button', 'pagination-button' + (options.active ? ' active' : '') + (options.ellipsis ? ' ellipsis' : ''), label);
        button.type = 'button'; button.disabled = Boolean(options.disabled || options.ellipsis);
        if (options.active) button.setAttribute('aria-current', 'page');
        if (!options.ellipsis && !options.disabled) button.addEventListener('click', () => { currentPage = page; render(); grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        pagination.appendChild(button);
      };
      addButton('قبلی', currentPage - 1, { disabled: currentPage === 1 });
      let pages = [];
      if (totalPages <= 7) pages = Array.from({ length: totalPages }, (_, i) => i + 1);
      else {
        pages = [1];
        const start = Math.max(2, currentPage - 1), end = Math.min(totalPages - 1, currentPage + 1);
        if (start > 2) pages.push('…');
        for (let p = start; p <= end; p++) pages.push(p);
        if (end < totalPages - 1) pages.push('…');
        pages.push(totalPages);
      }
      pages.forEach(page => page === '…' ? addButton('…', 0, { ellipsis: true }) : addButton(String(page), page, { active: page === currentPage }));
      addButton('بعدی', currentPage + 1, { disabled: currentPage === totalPages });
    }

    function render() {
      const list = window.PRODUCTS.filter(product => product.available && (activeCat === 'all' || product.cat === activeCat));
      const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      currentPage = Math.min(currentPage, totalPages);
      const start = (currentPage - 1) * PAGE_SIZE;
      grid.replaceChildren(...list.slice(start, start + PAGE_SIZE).map(product => ProductCard.make(product)));
      empty.hidden = list.length > 0;
      renderPagination(totalPages);
    }

    function buildTabs() {
      const all = [{ id: 'all', name: 'همه', icon: 'ri-apps-2-line' }, ...window.CATEGORIES];
      all.forEach(category => {
        const button = el('button', 'chip' + (category.id === 'all' ? ' active' : ''));
        button.type = 'button'; button.dataset.cat = category.id;
        button.setAttribute('aria-pressed', String(category.id === 'all'));
        const icon = el('i', category.icon); icon.setAttribute('aria-hidden', 'true');
        button.append(icon, ' ' + category.name); tabs.appendChild(button);
      });
    }

    tabs.addEventListener('click', event => {
      const button = event.target.closest('.chip'); if (!button) return;
      activeCat = button.dataset.cat; currentPage = 1;
      tabs.querySelectorAll('.chip').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
      render();
    });
    buildTabs(); render();
    document.addEventListener('storeproductsrefreshed', () => { currentPage = 1; render(); });
  }).catch(() => {});
})();

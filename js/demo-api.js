/* Sticker Benzi — GitHub Pages demo API (no backend, no real persistence) */
(function () {
  'use strict';
  const STORAGE_KEY = 'sticker-benzi-demo-state-v1';
  const SESSION_KEY = 'sticker-benzi-demo-session-v1';
  const initial = window.SB_DEMO_DATA || {products:[],categories:[],settings:{}};
  const clone = value => JSON.parse(JSON.stringify(value));
  function load() {
    try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) return JSON.parse(saved); } catch (_) {}
    return clone(initial);
  }
  let state = load();
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} }
  const isAdmin = () => /\/admin\//.test(location.pathname);
  const asset = value => {
    if (!value) return '';
    const clean = String(value).replace(/^\.\.\//,'').replace(/^\.\//,'').replace(/^\//,'');
    return (isAdmin() ? '../' : './') + clean;
  };
  const productOut = p => ({...p, img:asset(p.img), images:Array.isArray(p.images)?p.images.map(asset):[]});
  const categoryOut = c => ({...c});
  const settingsOut = () => ({...state.settings, heroImages:Object.fromEntries(Object.entries(state.settings.heroImages||{}).map(([k,v])=>[k,asset(v)]))});
  const ok = (data, status=200) => new Response(JSON.stringify({ok:true,data}), {status,headers:{'Content-Type':'application/json; charset=utf-8'}});
  const fail = (message,status=400) => new Response(JSON.stringify({ok:false,message}), {status,headers:{'Content-Type':'application/json; charset=utf-8'}});
  async function bodyOf(options) { if (!options || !options.body || typeof options.body !== 'string') return {}; try { return JSON.parse(options.body); } catch (_) { return {}; } }
  function analyticsData() {
    const today = new Date();
    const timeline = Array.from({length:14},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-(13-i));return {day:d.toISOString().slice(0,10),pageViews:18+(i*7)%31};});
    return {summary:{pageViews:426,productViews:138,addToCart:47,contactClicks:32,checkoutStarts:19},timeline,topPages:[{path:'/',title:'صفحه اصلی',views:186},{path:'/category',title:'فروشگاه',views:112},{path:'/about',title:'درباره ما',views:64}],topProducts:state.products.slice(0,4).map((p,i)=>({productId:p.id,name:p.name,views:35-i*5})),devices:[{device:'mobile',visits:312},{device:'desktop',visits:94},{device:'tablet',visits:20}],sources:[{source:'direct',visits:210},{source:'instagram.com',visits:124},{source:'google.com',visits:92}]};
  }
  async function handle(url, options={}) {
    const u = new URL(url, location.href); const path=u.pathname; const method=(options.method||'GET').toUpperCase();
    if (path.endsWith('/api/analytics/events') && method==='POST') return ok({accepted:true},202);
    if (path.endsWith('/api/products') && method==='GET') return ok(state.products.filter(p=>p.available).map(productOut));
    if (path.endsWith('/api/categories') && method==='GET') return ok(state.categories.filter(c=>c.active).map(categoryOut));
    if (path.endsWith('/api/settings') && method==='GET') return ok(settingsOut());
    const publicProduct=path.match(/\/api\/products\/([^/]+)$/);
    if (publicProduct && method==='GET') { const p=state.products.find(x=>x.id===decodeURIComponent(publicProduct[1])&&x.available); return p?ok(productOut(p)):fail('محصول پیدا نشد.',404); }
    if (path.endsWith('/api/admin/session') && method==='GET') return ok({authenticated:localStorage.getItem(SESSION_KEY)==='1',username:'demo'});
    if (path.endsWith('/api/admin/login') && method==='POST') { const b=await bodyOf(options); if(b.username==='demo'&&b.password==='demo1234'){localStorage.setItem(SESSION_KEY,'1');return ok({username:'demo'});} return fail('برای نسخه دمو از نام کاربری demo و رمز عبور demo1234 استفاده کنید.',401); }
    if (path.endsWith('/api/admin/logout') && method==='POST') { localStorage.removeItem(SESSION_KEY); return ok({loggedOut:true}); }
    if (path.endsWith('/api/admin/categories') && method==='GET') return ok(state.categories.map(categoryOut));
    if (path.endsWith('/api/admin/dashboard') && method==='GET') return ok({totalProducts:state.products.length,activeProducts:state.products.filter(p=>p.available).length,inactiveProducts:state.products.filter(p=>!p.available).length});
    if (path.endsWith('/api/admin/products') && method==='GET') { const q=(u.searchParams.get('q')||'').toLowerCase(),cat=u.searchParams.get('category')||''; return ok(state.products.filter(p=>(!q||p.name.toLowerCase().includes(q)||p.id.toLowerCase().includes(q))&&(!cat||p.cat===cat)).map(productOut)); }
    if (path.endsWith('/api/admin/settings') && method==='GET') return ok(settingsOut());
    if (path.endsWith('/api/admin/settings') && method==='PUT') { const b=await bodyOf(options); state.settings={...state.settings,...b}; save(); return ok(settingsOut()); }
    if (path.endsWith('/api/admin/analytics') && method==='GET') return ok(analyticsData());
    const hero=path.match(/\/api\/admin\/hero-images\/([^/]+)$/);
    if(hero && method==='POST'){const slot=decodeURIComponent(hero[1]);const file=Object.keys(initial.settings.heroImages||{})[0];const original=initial.settings.heroImages[slot]||initial.settings.heroImages.center;state.settings.heroImages=state.settings.heroImages||{};state.settings.heroImages[slot]=original;save();return ok({url:asset(original)});}
    if(hero && method==='DELETE'){const slot=decodeURIComponent(hero[1]);state.settings.heroImages[slot]='';save();return ok({deleted:true});}
    if(path.endsWith('/api/admin/upload')&&method==='POST'){const first=Object.values(initial.products).find(p=>p.img);return ok({fileName:'demo-image.webp',url:asset(first?first.img:'/uploads/products/72b8e33e-7d6c-4428-8b17-3ecd9e64bbc9.webp')});}
    if(path.includes('/api/admin/upload/')&&method==='DELETE') return ok({deleted:true});
    const adminProduct=path.match(/\/api\/admin\/products\/([^/]+)(?:\/status)?$/);
    if(path.endsWith('/api/admin/products')&&method==='POST'){const b=await bodyOf(options);if(state.products.some(p=>p.id===b.id))return fail('کد محصول تکراری است.');state.products.unshift({...b,img:(b.img||'').replace(/^\.\.\//,'/').replace(/^\.\//,'/'),available:b.available!==false});save();return ok({product:b},201);}
    if(adminProduct){const id=decodeURIComponent(adminProduct[1]);const idx=state.products.findIndex(p=>p.id===id);if(idx<0)return fail('محصول پیدا نشد.',404);if(path.endsWith('/status')&&method==='PATCH'){const b=await bodyOf(options);state.products[idx].available=Boolean(b.available);save();return ok({product:productOut(state.products[idx])});}if(method==='PUT'){const b=await bodyOf(options);state.products[idx]={...state.products[idx],...b,img:(b.img||'').replace(/^\.\.\//,'/').replace(/^\.\//,'/')};save();return ok({product:productOut(state.products[idx])});}if(method==='DELETE'){state.products.splice(idx,1);save();return ok({deleted:true});}}
    if(path.endsWith('/api/admin/categories')&&method==='POST'){const b=await bodyOf(options);if(state.categories.some(c=>c.id===b.id))return fail('شناسه دسته‌بندی تکراری است.');state.categories.push({...b,active:true});save();return ok({category:b},201);}
    const adminCategory=path.match(/\/api\/admin\/categories\/([^/]+)(?:\/status)?$/);
    if(adminCategory){const id=decodeURIComponent(adminCategory[1]);const idx=state.categories.findIndex(c=>c.id===id);if(idx<0)return fail('دسته‌بندی پیدا نشد.',404);if(path.endsWith('/status')&&method==='PATCH'){const b=await bodyOf(options);state.categories[idx].active=Boolean(b.active);save();return ok({category:state.categories[idx]});}if(method==='PUT'){const b=await bodyOf(options);state.categories[idx]={...state.categories[idx],...b};save();return ok({category:state.categories[idx]});}if(method==='DELETE'){if(state.products.some(p=>p.cat===id))return fail('ابتدا محصولات این دسته‌بندی را به دسته دیگری منتقل کنید.');state.categories.splice(idx,1);save();return ok({deleted:true});}}
    return fail('این قابلیت در نسخه نمایشی فعال نیست.',501);
  }
  const originalFetch=window.fetch.bind(window);
  window.fetch=function(input,options={}){
    const url=typeof input==='string'?input:(input&&input.url)||String(input);
    if(url.includes('/api/')) return handle(url,options).catch(()=>fail('خطا در شبیه‌سازی API.',500));
    return originalFetch(input,options);
  };
  window.SB_DEMO_MODE=true;
})();

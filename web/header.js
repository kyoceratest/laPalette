(function(){
  if (window.__lpHeaderInit) return;
  window.__lpHeaderInit = true;
  'use strict';
  function ready(fn){ if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',fn);} else { fn(); } }

  function buildHeaderHtml(){
    return ''+
      '<header id="lp-shared-header" style="background:#e0001a;color:#fff;padding:0.75rem 1.25rem;display:flex;justify-content:space-between;align-items:center;font-weight:600;letter-spacing:0.03em;position:relative;">'+
      '  <div style="display:flex;align-items:center;gap:0.5rem;">La Palette – Dev Shop</div>'+
      '  <div id="cart-header">'+
      '    <select id="role-header-select" style="margin-right:0.75rem; font-size:0.8rem; padding:0.15rem 0.35rem; border-radius:4px; border:none;">'+
      '      <option value="">Choisir un espace  (rôle démo)</option>'+
      '      <option value="CLIENT">Client</option>'+
      '      <option value="SHOP">Magasin (Shop)</option>'+
      '      <option value="ADMIN">Administration</option>'+
      '      <option value="DELIVERY">Livraison</option>'+
      '    </select>'+
      '    <button id="presentation-header-btn" type="button" style="margin-right:0.5rem;">Présentation</button>'+
      '    <button id="myorders-header-btn" type="button" style="margin-right:0.5rem;">Mes commandes</button>'+
      '    <button id="profile-header-btn" type="button" style="margin-right:0.5rem;">Mon profil</button>'+
      '    <button id="login-header-btn" type="button">Login</button>'+
      '  </div>'+
      '  <button type="button" id="lp-mobile-menu-toggle" class="lp-mobile-menu-toggle" aria-label="Ouvrir le menu">☰</button>'+
      '</header>'+
      '<div class="lp-mobile-menu-overlay" id="lp-mobile-menu-overlay"></div>'+
      '<div class="lp-mobile-menu-panel" id="lp-mobile-menu-panel">'+
      '  <select id="lp-role-select-mobile" aria-label="Choisir un espace" class="lp-mobile-input">'+
      '    <option value="">Choisir un espace  (rôle démo)</option>'+
      '    <option value="CLIENT">Client</option>'+
      '    <option value="SHOP">Magasin (Shop)</option>'+
      '    <option value="ADMIN">Administration</option>'+
      '    <option value="DELIVERY">Livraison</option>'+
      '  </select>'+
      '  <button type="button" id="lp-btn-presentation-mobile" class="lp-mobile-input">Présentation</button>'+
      '  <button type="button" id="lp-btn-myorders-mobile" class="lp-mobile-input">Mes commandes</button>'+
      '  <button type="button" id="lp-btn-profile-mobile" class="lp-mobile-input">Mon profil</button>'+
      '  <button type="button" id="lp-btn-login-mobile" class="lp-mobile-input">Login</button>'+
      '</div>';}

  function injectStyles(){
    var css = ''+
      '.lp-mobile-menu-toggle{display:none;margin-left:auto;background:transparent;border:none;color:#fff;font-size:1.25rem;line-height:1;cursor:pointer;}\n'+
      '.lp-mobile-menu-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:1000;}\n'+
      '.lp-mobile-menu-panel{display:none;position:fixed;left:0;right:0;background:#e0001a;color:#fff;padding:0.5rem 1rem 0.75rem;z-index:2000;}\n'+
      '.lp-mobile-menu-panel .lp-mobile-input{width:100%;margin-bottom:0.45rem;font-size:0.95rem;padding:0.45rem 0.6rem;color:#333;background:#fff;border:none;border-radius:4px;}\n'+
      /* Top bar action buttons */
      '#cart-header button{border:none;background:#0070f3;color:#fff;padding:0.35rem 0.75rem;border-radius:4px;cursor:pointer;font-size:0.85rem;}\n'+
      '#cart-header button:hover{background:#005bd1;}\n'+
      'body.menu-open .lp-mobile-menu-panel{display:block;}\n'+
      'body.menu-open .lp-mobile-menu-overlay{display:block;}\n'+
      '@media (max-width:768px){#cart-header{display:none}.lp-mobile-menu-toggle{display:inline-block}}\n'+
      '@media (min-width:769px){.lp-mobile-menu-toggle{display:none}}\n';
    var style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function ensureMount(){
    var mount = document.getElementById('lp-header-root');
    if (!mount){
      mount = document.createElement('div');
      mount.id = 'lp-header-root';
      document.body.insertBefore(mount, document.body.firstChild || null);
    }
    return mount;
  }

  function hideExistingNativeHeaders(){
    try{
      var headers = document.getElementsByTagName('header');
      for (var i=0;i<headers.length;i++){
        var h = headers[i];
        if (h && h.id !== 'lp-shared-header'){
          h.style.display = 'none';
        }
      }
    }catch(e){}
  }

  function wireNav(){
    function isLoggedIn(){
      try { return !!(window.localStorage.getItem('lp_auth_token') || window.localStorage.getItem('lp_auth_user')); } catch(e) { return false; }
    }

    function doLogout(){
      try{ window.localStorage.removeItem('lp_auth_token'); }catch(e){}
      try{ window.localStorage.removeItem('lp_auth_user'); }catch(e){}
      try{ var rs = document.getElementById('role-header-select'); if (rs) rs.value = ''; }catch(e){}
      try{ var rsm = document.getElementById('lp-role-select-mobile'); if (rsm) rsm.value = ''; }catch(e){}
      try{ window.dispatchEvent(new Event('lp-auth-changed')); }catch(e){}
      window.location.href = 'index.html';
    }

    function updateAuthButtons(){
      var loginBtn = document.getElementById('login-header-btn');
      if (loginBtn){
        if (isLoggedIn()){
          try{ loginBtn.textContent = 'Logout'; }catch(e){}
          loginBtn.onclick = doLogout;
        } else {
          try{ loginBtn.textContent = 'Login'; }catch(e){}
          loginBtn.onclick = function(){ window.location.href = 'login.html'; };
        }
      }

      var btnLoginM = document.getElementById('lp-btn-login-mobile');
      if (btnLoginM){
        if (isLoggedIn()){
          try{ btnLoginM.textContent = 'Logout'; }catch(e){}
          btnLoginM.onclick = function(){ doLogout(); };
        } else {
          try{ btnLoginM.textContent = 'Login'; }catch(e){}
          btnLoginM.onclick = function(){ closeMenu(); window.location.href = 'login.html'; };
        }
      }
    }

    updateAuthButtons();
    try { window.addEventListener('storage', updateAuthButtons); } catch(e){}
    try { window.addEventListener('lp-auth-changed', updateAuthButtons); } catch(e){}

    var roleSelect = document.getElementById('role-header-select');
    if (roleSelect){
      try{
        var rawUser = window.localStorage.getItem('lp_auth_user');
        if (rawUser){
          var u = JSON.parse(rawUser) || {};
          if (u.role){
            var r = String(u.role).toUpperCase();
            roleSelect.value = (r==='CLIENT'||r==='SHOP'||r==='ADMIN'||r==='DELIVERY')?r:'';
          }
        }
      }catch(e){}
      roleSelect.addEventListener('change', function(){
        var v = roleSelect.value;
        if (!v) { window.location.href='index.html'; return; }
        if (v==='CLIENT') window.location.href='index.html';
        else if (v==='SHOP' || v==='ADMIN') window.location.href='orders.html';
        else if (v==='DELIVERY') window.location.href='delivery-list.html';
      });
    }

    var presentationBtn = document.getElementById('presentation-header-btn');
    if (presentationBtn){ presentationBtn.addEventListener('click', function(){ window.location.href = 'presentation.html'; }); }

    var myOrdersBtn = document.getElementById('myorders-header-btn');
    if (myOrdersBtn){ myOrdersBtn.addEventListener('click', function(){
      try{ window.dispatchEvent(new CustomEvent('lp-myorders-requested')); }catch(e){}
      try{ if (typeof window.setView === 'function'){ window.setView('myOrders'); } }catch(e){}
      if (!/index\.html$/i.test(location.pathname)){
        try { window.localStorage.setItem('lp_open_myorders', '1'); } catch(e) {}
        window.location.href = 'index.html';
      }
    }); }

    var profileBtn = document.getElementById('profile-header-btn');
    if (profileBtn){ profileBtn.addEventListener('click', function(){ window.location.href = 'profile.html'; }); }

    var toggle = document.getElementById('lp-mobile-menu-toggle');
    var overlay = document.getElementById('lp-mobile-menu-overlay');
    function setPanelTop(){
      try{
        var header = document.getElementById('lp-shared-header');
        var panel = document.getElementById('lp-mobile-menu-panel');
        if (header && panel){ panel.style.top = header.offsetHeight + 'px'; }
      }catch(e){}
    }
    function openMenu(){ document.body.classList.add('menu-open'); setPanelTop(); }
    function closeMenu(){ document.body.classList.remove('menu-open'); }
    if (toggle){ toggle.addEventListener('click', function(){ if (document.body.classList.contains('menu-open')) closeMenu(); else openMenu(); }); }
    if (overlay){ overlay.addEventListener('click', closeMenu); }
    window.addEventListener('resize', setPanelTop);
    setPanelTop();

    // On first visit on mobile, auto-open the menu so actions are visible
    try {
      if (window.innerWidth <= 768 && !window.localStorage.getItem('lp_mobile_menu_seen')) {
        openMenu();
        window.localStorage.setItem('lp_mobile_menu_seen', '1');
      }
    } catch (e) {}

    function go(url){ closeMenu(); window.location.href = url; }
    var btnPresM = document.getElementById('lp-btn-presentation-mobile'); if (btnPresM) btnPresM.addEventListener('click', function(){ go('presentation.html'); });
    var btnMyM = document.getElementById('lp-btn-myorders-mobile'); if (btnMyM) btnMyM.addEventListener('click', function(){ closeMenu(); try{ window.dispatchEvent(new CustomEvent('lp-myorders-requested')); }catch(e){} if (!/index\.html$/i.test(location.pathname)) { try { window.localStorage.setItem('lp_open_myorders','1'); } catch(e) {} window.location.href='index.html'; } window.scrollTo(0,0); });
    var btnProfM = document.getElementById('lp-btn-profile-mobile'); if (btnProfM) btnProfM.addEventListener('click', function(){ go('profile.html'); });
    // Auth buttons are now handled by updateAuthButtons()

    var roleSelM = document.getElementById('lp-role-select-mobile');
    try {
      if (roleSelM && roleSelect && roleSelect.value) {
        roleSelM.value = roleSelect.value;
      }
    } catch (e) {}
    if (roleSelM){
      roleSelM.addEventListener('change', function(){
        var v = roleSelM.value;
        if (roleSelect) { roleSelect.value = v; }
        closeMenu();
        if (!v) { go('index.html'); return; }
        if (v==='CLIENT') go('index.html');
        else if (v==='SHOP' || v==='ADMIN') go('orders.html');
        else if (v==='DELIVERY') go('delivery-list.html');
      });
    }
  }

  ready(function(){
    injectStyles();
    var mount = ensureMount();
    if (mount) { mount.innerHTML = buildHeaderHtml(); }
    hideExistingNativeHeaders();
    wireNav();
    try {
      var t = document.getElementById('lp-mobile-menu-toggle');
      function updateToggleVisibility(){
        if (!t) return;
        if (window.innerWidth <= 768) {
          if (getComputedStyle(t).display === 'none') {
            t.style.display = 'inline-block';
          }
        } else {
          t.style.display = '';
        }
      }
      updateToggleVisibility();
      window.addEventListener('resize', updateToggleVisibility);
    } catch (e) {}
  });
})();

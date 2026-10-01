/*
 * Ecosystem Fire V5 click-through prototype (review artifact, NOT production code).
 * Source of truth: flow-spec.json (embedded copy in flow-data.js as window.FLOW_SPEC).
 * All navigation is simulated with static screenshots; no backend, no data.
 */
(function () {
  'use strict';

  var SRC_W = 1920, SRC_H = 1080;
  var HOVER_DELAY = 400;       // ms before a "hover" hotspot auto-advances
  var DIM_DELAY = 2000;        // ms of pointer inactivity before chrome dims
  var FLASH_MS = 600;
  var TOAST_MS = 2000;
  var SUBMIT_TOAST = 'הבקשה נשלחה (אין מסך יעד בעיצוב)';
  // f2 special rule: on f2-02, clicking outside this card region returns to f2-01.
  var F2_CARD = { x: 1075, y: 293, w: 255, h: 132 };

  var GROUPS = [
    { title: 'אופציות תצוגה', ids: ['f1', 'f2', 'f3', 'f4'] },
    { title: 'טופס דרישת חימוש נוסף', ids: ['f5', 'f6', 'f7'] }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    index: $('index-view'), groups: $('index-groups'),
    player: $('player-view'), stage: $('stage'), img: $('screen-img'), hotspots: $('hotspots'),
    chrome: $('chrome'), title: $('flow-title'), step: $('step'), ab: $('ab-switch'),
    home: $('btn-home'), prev: $('btn-prev'), next: $('btn-next'), toggle: $('btn-hotspots'),
    toast: $('toast')
  };

  var flows = [];              // enriched flow objects
  var byId = {};
  var cur = null;              // { flow, idx } or null when on index
  var timers = { hover: 0, flash: 0, toast: 0, dim: 0, submit: 0 };
  var preloaded = {};

  function screenUrl(name) { return 'screens/' + encodeURIComponent(name); }
  function isChapter(name) { return name.indexOf('-chapter') !== -1; }

  // ---------- Data prep ----------
  function prepare(spec) {
    flows = spec.flows.map(function (f) {
      var variantGroup = (f.variants && f.variants.group) || [];
      // Logical steps: variant alternates collapse into a single step.
      var steps = [];
      var variantStep = -1;
      f.screens.forEach(function (name, i) {
        if (variantGroup.indexOf(name) !== -1) {
          if (variantStep === -1) { variantStep = steps.length; steps.push([]); }
          steps[variantStep].push(i);
        } else {
          steps.push([i]);
        }
      });
      var thumb = f.screens.filter(function (n) { return !isChapter(n); })[0] || f.screens[0];
      var o = { spec: f, steps: steps, thumb: thumb };
      byId[f.id] = o;
      return o;
    });
  }

  function stepOf(flow, idx) {
    for (var s = 0; s < flow.steps.length; s++) {
      if (flow.steps[s].indexOf(idx) !== -1) return s;
    }
    return 0;
  }

  function hotspotsFor(flow, name) {
    var f = flow.spec, list = [];
    (f.transitions || []).forEach(function (t) {
      if (t.from === name) list.push({ kind: 'fwd', to: t.to, rect: t.hotspot, hover: !!t.hover, label: t.trigger });
    });
    (f.back || []).forEach(function (b) {
      if (b.on === name) list.push({ kind: 'back', to: b.to, rect: b.hotspot, label: 'חזרה' });
    });
    if (f.submit && f.submit.on === name) {
      list.push({ kind: 'submit', rect: f.submit.hotspot, label: 'שליחה' });
    }
    return list;
  }

  // ---------- Routing (hash is the single source of truth) ----------
  function parseHash() {
    var m = /^#(f\d+)\/(\d+)$/.exec(location.hash);
    if (!m || !byId[m[1]]) return null;
    var flow = byId[m[1]];
    var idx = Math.min(parseInt(m[2], 10), flow.spec.screens.length - 1);
    return { flow: flow, idx: idx };
  }

  function go(flowId, idx) {
    var h = '#' + flowId + '/' + idx;
    if (location.hash === h) render(); else location.hash = h;
  }

  function goIndex() {
    if (location.hash && location.hash !== '#') {
      history.pushState(null, '', location.pathname + location.search);
    }
    render();
  }

  function goToScreen(name) {
    var i = cur.flow.spec.screens.indexOf(name);
    if (i !== -1) go(cur.flow.spec.id, i);
  }

  function next() {
    if (!cur) return;
    var s = stepOf(cur.flow, cur.idx);
    if (s + 1 < cur.flow.steps.length) go(cur.flow.spec.id, cur.flow.steps[s + 1][0]);
    else goIndex(); // end of flow -> index
  }

  function prev() {
    if (!cur) return;
    var s = stepOf(cur.flow, cur.idx);
    if (s > 0) go(cur.flow.spec.id, cur.flow.steps[s - 1][0]);
  }

  // ---------- Rendering ----------
  function clearTimers() {
    clearTimeout(timers.hover);
    clearTimeout(timers.flash);
    clearTimeout(timers.submit);
    els.hotspots.classList.remove('flash');
  }

  function render() {
    clearTimers();
    cur = parseHash();
    if (!cur) { renderIndex(); return; }
    renderPlayer();
  }

  function renderIndex() {
    els.player.hidden = true;
    els.index.hidden = false;
    document.title = 'Ecosystem Fire · V5 – פרוטוטייפ';
    if (els.groups.childElementCount) return;
    GROUPS.forEach(function (g) {
      var sec = document.createElement('section');
      sec.className = 'group';
      var h = document.createElement('h2');
      h.textContent = g.title;
      var grid = document.createElement('div');
      grid.className = 'cards';
      g.ids.forEach(function (id) {
        var fl = byId[id];
        if (fl) grid.appendChild(card(fl));
      });
      sec.appendChild(h);
      sec.appendChild(grid);
      els.groups.appendChild(sec);
    });
  }

  function card(fl) {
    var f = fl.spec;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'card';
    b.innerHTML =
      '<img loading="lazy" alt="">' +
      '<div class="card-body"><div class="card-title"></div><div class="card-sub"></div>' +
      '<div class="card-meta"><span class="card-count"></span><span class="card-id"></span></div></div>';
    b.querySelector('img').src = screenUrl(fl.thumb);
    b.querySelector('.card-title').textContent = f.title;
    b.querySelector('.card-sub').textContent = f.subtitle;
    b.querySelector('.card-count').textContent = f.screens.length + ' מסכים';
    b.querySelector('.card-id').textContent = f.id;
    b.addEventListener('click', function () { go(f.id, 0); });
    return b;
  }

  function renderPlayer() {
    var flow = cur.flow, f = flow.spec, name = f.screens[cur.idx];
    els.index.hidden = true;
    els.player.hidden = false;
    document.title = f.title + ' · Ecosystem Fire V5';

    preload(flow);
    els.img.src = screenUrl(name);
    els.img.alt = name;

    // Hotspots
    els.hotspots.textContent = '';
    hotspotsFor(flow, name).forEach(function (h) { els.hotspots.appendChild(hotspotEl(h)); });

    // Chrome
    var s = stepOf(flow, cur.idx);
    els.title.textContent = f.title;
    els.step.textContent = (s + 1) + ' / ' + flow.steps.length;
    els.prev.disabled = s === 0;
    els.next.textContent = s === flow.steps.length - 1 ? 'לאינדקס ←' : 'הבא ←';
    renderAB(flow, name);
    wake();
  }

  function hotspotEl(h) {
    var r = h.rect, b = document.createElement('button');
    b.type = 'button';
    b.className = 'hotspot ' + h.kind + (r.w >= SRC_W && r.h >= SRC_H ? ' full' : '');
    b.style.left = (r.x / SRC_W * 100) + '%';
    b.style.top = (r.y / SRC_H * 100) + '%';
    b.style.width = (r.w / SRC_W * 100) + '%';
    b.style.height = (r.h / SRC_H * 100) + '%';
    b.setAttribute('aria-label', h.label);
    b.title = h.label;
    b.addEventListener('click', function (e) { e.stopPropagation(); activate(h); });
    if (h.hover) {
      b.addEventListener('mouseenter', function () {
        clearTimeout(timers.hover);
        timers.hover = setTimeout(function () { activate(h); }, HOVER_DELAY);
      });
      b.addEventListener('mouseleave', function () { clearTimeout(timers.hover); });
    }
    return b;
  }

  function activate(h) {
    clearTimeout(timers.hover);
    if (h.kind === 'submit') {
      // Simulated submit: no destination screen exists in the design.
      showToast(SUBMIT_TOAST);
      var flowId = cur.flow.spec.id;
      clearTimeout(timers.submit);
      timers.submit = setTimeout(function () { go(flowId, 1); }, TOAST_MS);
      return;
    }
    goToScreen(h.to);
  }

  function renderAB(flow, name) {
    var v = flow.spec.variants;
    if (!v || v.group.indexOf(name) === -1) { els.ab.hidden = true; return; }
    els.ab.hidden = false;
    els.ab.textContent = '';
    v.group.forEach(function (vn, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(vn === name));
      b.textContent = (v.labels && v.labels[i]) || String.fromCharCode(65 + i);
      b.addEventListener('click', function () { if (vn !== name) goToScreen(vn); });
      els.ab.appendChild(b);
    });
  }

  function preload(flow) {
    flow.spec.screens.forEach(function (n) {
      if (preloaded[n]) return;
      var im = new Image();
      im.src = screenUrl(n);
      preloaded[n] = im;
    });
  }

  // ---------- Feedback ----------
  function flash() {
    clearTimeout(timers.flash);
    els.hotspots.classList.remove('flash');
    void els.hotspots.offsetWidth; // restart animation
    els.hotspots.classList.add('flash');
    timers.flash = setTimeout(function () { els.hotspots.classList.remove('flash'); }, FLASH_MS);
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(timers.toast);
    timers.toast = setTimeout(function () { els.toast.hidden = true; }, TOAST_MS);
  }

  function wake() {
    els.chrome.classList.remove('dim');
    clearTimeout(timers.dim);
    timers.dim = setTimeout(function () { els.chrome.classList.add('dim'); }, DIM_DELAY);
  }

  function setHighlight(on) {
    document.body.classList.toggle('show-hotspots', on);
    els.toggle.setAttribute('aria-pressed', String(on));
  }

  // ---------- Events ----------
  function bind() {
    window.addEventListener('hashchange', render);
    window.addEventListener('popstate', render);

    els.stage.addEventListener('click', function (e) {
      if (!cur) return;
      var name = cur.flow.spec.screens[cur.idx];
      var rect = els.stage.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width * SRC_W;
      var y = (e.clientY - rect.top) / rect.height * SRC_H;
      if (cur.flow.spec.id === 'f2' && name.indexOf('f2-02') === 0) {
        var c = F2_CARD;
        var inside = x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h;
        if (!inside) { goToScreen(cur.flow.spec.screens[1]); return; }
      }
      flash(); // misclick feedback
    });

    els.home.addEventListener('click', goIndex);
    els.prev.addEventListener('click', prev);
    els.next.addEventListener('click', next);
    els.toggle.addEventListener('click', function () {
      setHighlight(!document.body.classList.contains('show-hotspots'));
    });

    document.addEventListener('mousemove', function () { if (cur) wake(); });

    document.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var k = e.key;
      if (k === 'Escape') { if (cur) { e.preventDefault(); goIndex(); } return; }
      if (!cur) return;
      // RTL: reading/progress direction is right-to-left, so ArrowLeft = forward.
      if (k === 'ArrowLeft') { e.preventDefault(); next(); wake(); }
      else if (k === 'ArrowRight') { e.preventDefault(); prev(); wake(); }
      else if (k === 'h' || k === 'H' || k === 'י') { // 'י' = H key on Hebrew layout
        e.preventDefault();
        setHighlight(!document.body.classList.contains('show-hotspots'));
      }
    });
  }

  // ---------- Boot ----------
  function boot(spec) {
    prepare(spec);
    bind();
    render();
  }

  if (window.FLOW_SPEC) {
    boot(window.FLOW_SPEC);
  } else {
    fetch('flow-spec.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(boot)
      .catch(function (err) {
        document.body.textContent = 'שגיאה בטעינת flow-spec.json: ' + err;
      });
  }
})();

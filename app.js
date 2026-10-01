/* Ecosystem Fire – interactive prototype (PROTOTYPE, not production).
 * Plain JS, no build step. All data is mocked (data.js); "sending" the form
 * is simulated locally (no network).
 */
(function () {
  'use strict';
  var D = window.EF_DATA;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function h(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k]);
    }
    if (html !== undefined) el.innerHTML = html;
    return el;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------------- persistent options ---------------- */
  var OPT_KEY = 'ef-proto-options-v1';
  var DEFAULT_OPTS = { expand: 'card', cell: 'default', rows: 'auto' };
  function loadOpts() {
    try {
      var o = JSON.parse(localStorage.getItem(OPT_KEY) || 'null');
      if (o && typeof o === 'object') return {
        expand: /^(card|none)$/.test(o.expand) ? o.expand : 'card',
        cell: /^(default|ca|cb)$/.test(o.cell) ? o.cell : 'default',
        rows: /^(auto|manual)$/.test(o.rows) ? o.rows : 'auto'
      };
    } catch (e) { /* storage unavailable */ }
    return Object.assign({}, DEFAULT_OPTS);
  }
  function saveOpts() { try { localStorage.setItem(OPT_KEY, JSON.stringify(S.opts)); } catch (e) { /* ignore */ } }

  /* ---------------- state ---------------- */
  var rowSeq = 1;
  function newRow() { return { id: rowSeq++, ammo: null, type: null, qty: '' }; }
  function freshForm() {
    return {
      start: null, end: null, calOpen: false, calY: 2026, calM: 7, hover: null,
      shift: null, manual: '', manualEditing: false, manualDraft: '', manualInvalid: false,
      rows: [newRow()], reason: '', sending: false
    };
  }
  var S = {
    opts: loadOpts(),
    view: 'bars',
    modes: {},
    order: D.groups.map(function (g) { return g.id; }),
    day: 0, shift: 0,
    selected: null,
    panelOpen: false,
    form: freshForm()
  };
  function resetModes() { D.groups.forEach(function (g) { S.modes[g.id] = S.view; }); }
  resetModes();

  /* ---------------- stage scaling ---------------- */
  var stage = $('#stage'), scale = 1;
  function fit() {
    var w = window.innerWidth, hh = window.innerHeight;
    scale = Math.min(w / 1920, hh / 1080);
    var x = (w - 1920 * scale) / 2, y = (hh - 1080 * scale) / 2;
    stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
    if (S.selected) positionCard();
  }
  // Keep the prototype options bar on a single row: shrink it to fit narrow windows.
  function fitOptbar() {
    var ob = document.getElementById('optbar'); if (!ob) return;
    ob.style.setProperty('--ob-scale', '1');
    var s = Math.min(1, (window.innerWidth - 16) / ob.scrollWidth);
    ob.style.setProperty('--ob-scale', s.toFixed(3));
  }
  window.addEventListener('resize', fitOptbar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitOptbar);
  setTimeout(fitOptbar, 0);
  window.addEventListener('resize', fit);
  function stageRect(el) {
    var r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    return { left: (r.left - s.left) / scale, top: (r.top - s.top) / scale, width: r.width / scale, height: r.height / scale,
      right: (r.right - s.left) / scale, bottom: (r.bottom - s.top) / scale };
  }

  /* ---------------- deterministic mock data ---------------- */
  function hash(str) { var h1 = 2166136261; for (var i = 0; i < str.length; i++) { h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 16777619); } return h1 >>> 0; }
  function rng(seed) { var a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var colIndex = {};
  D.groups.forEach(function (g) { g.columns.forEach(function (c) { colIndex[c.id] = { g: g, c: c }; }); });
  var WARN = { 'art-il:1': 1, 'art-hxl:2': 2, 'art-sg:4': 3, 'nmd-rm:1': 2, 'nmd-mk:2': 2, 'nmd-pg:3': 1 };

  function baseShifts(colId, r) {
    var key = colId + ':' + r;
    if (D.shiftOverrides[key]) return D.shiftOverrides[key].map(function (p) { return p.slice(); });
    var vc = colIndex[colId].c.rows[r], V = vc[0], C = vc[1], R = V / C;
    var rnd = rng(hash(key));
    var w = [0.7 + rnd() * 0.3, 0.6 + rnd() * 0.4, 0.65 + rnd() * 0.35], ws = w[0] + w[1] + w[2];
    var caps = w.map(function (x) { return Math.round(C * x / ws); });
    caps[2] = C - caps[0] - caps[1];
    var spread = R > 0.75 ? 0.05 : 0.3;
    var m = [1 - spread + rnd() * spread * 2, 1 - spread + rnd() * spread * 2, 1 - spread + rnd() * spread * 2];
    var den = caps[0] * m[0] + caps[1] * m[1] + caps[2] * m[2];
    var vals = caps.map(function (c, i) { return Math.round(V * c * m[i] / den); });
    vals[2] = Math.max(0, V - vals[0] - vals[1]);
    return [[vals[0], caps[0]], [vals[1], caps[1]], [vals[2], caps[2]]];
  }
  var cache = {};
  function cell(colId, r) {
    var ck = colId + ':' + r + ':' + S.day;
    if (cache[ck]) return cache[ck];
    var key = colId + ':' + r;
    var sh, flagged = !!D.shiftOverrides[key];
    if (r === 0) {
      // Ugda (summary) row = per-shift sum of all unit rows beneath it.
      sh = [[0, 0], [0, 0], [0, 0]];
      for (var ur = 1; ur < D.units.length; ur++) {
        cell(colId, ur).shifts.forEach(function (p, i) { sh[i][0] += p[0]; sh[i][1] += p[1]; });
      }
    } else {
      sh = baseShifts(colId, r);
    }
    if (r !== 0 && S.day !== 0) {
      var rnd = rng(hash(key + '@' + S.day));
      sh = sh.map(function (p) {
        var f = flagged ? 0.97 + rnd() * 0.06 : 0.7 + rnd() * 0.4;
        var v = Math.round(p[0] * f);
        if (!flagged) v = Math.min(v, p[1]);
        return [v, p[1]];
      });
    }
    var out = {
      key: key, colId: colId, row: r, shifts: sh,
      v: sh[0][0] + sh[1][0] + sh[2][0], c: sh[0][1] + sh[1][1] + sh[2][1],
      warn: WARN[key] || 0,
      over: sh.map(function (p) { return p[0] > p[1]; })
    };
    out.alert = out.over.some(Boolean);
    cache[ck] = out;
    return out;
  }
  function shown(d) { return S.shift ? { v: d.shifts[S.shift - 1][0], c: d.shifts[S.shift - 1][1] } : { v: d.v, c: d.c }; }
  function colHasAlert(colId) { for (var r = 0; r < 5; r++) if (cell(colId, r).alert) return true; return false; }
  function unitHasAlert(r) { var any = false; D.groups.forEach(function (g) { g.columns.forEach(function (c) { if (cell(c.id, r).alert) any = true; }); }); return any; }

  /* ---------------- table rendering ---------------- */
  var DESIGNS = {
    default: { cw: 112, rh: 52, gap1: 10, gap: 5, tableH: 371 },
    ca:      { cw: 155, rh: 44, gap1: 9,  gap: 4, tableH: 325 },
    cb:      { cw: 92,  rh: 52, gap1: 9,  gap: 5, tableH: 370 }
  };
  var tableEl = $('#table'), groupsEl = $('#groups'), vp = $('#groupsViewport'), sidebar = $('#sidebar');

  function applyGeometry() {
    var g = DESIGNS[S.opts.cell];
    tableEl.style.setProperty('--rh', g.rh + 'px');
    tableEl.style.setProperty('--cwb', g.cw + 'px');
    tableEl.style.setProperty('--gap1', g.gap1 + 'px');
    tableEl.style.setProperty('--gap', g.gap + 'px');
    tableEl.style.height = g.tableH + 'px';
    var bgH = 28 + g.rh * 5 + g.gap1 + g.gap * 3 + 7;
    sidebar.style.height = bgH + 'px';
    var tlTop = 109 + g.tableH + 7;
    $('#sliceTimeline').style.top = tlTop + 'px';
    $('#frameTop').style.height = (tlTop + 169 - 61) + 'px';
  }

  function vbarsHTML(d) {
    var maxC = Math.max(d.shifts[0][1], d.shifts[1][1], d.shifts[2][1]) || 1, out = '';
    [3, 2, 1].forEach(function (s) {
      var p = d.shifts[s - 1], tr = Math.max(6, p[1] / maxC * 32), fl = Math.min(p[0], p[1]) / maxC * 32;
      var ov = p[0] > p[1] ? Math.max(4, Math.min(32 - tr, (p[0] - p[1]) / maxC * 32)) : 0;
      if (ov && tr + ov > 32) tr = 32 - ov;
      if (p[0] > p[1]) fl = tr;
      out += '<div class="vb fade' + (d.warn === s ? ' warn' : '') + '" data-s="' + s + '"><i class="tr" style="height:' + tr.toFixed(1) + 'px"></i><i class="fl" style="height:' + fl.toFixed(1) + 'px"></i>' +
        (ov ? '<i class="ov" style="bottom:' + tr.toFixed(1) + 'px;height:' + ov.toFixed(1) + 'px"></i>' : '') + '</div>' +
        '<span class="vl fade" data-s="' + s + '">' + s + '</span>';
    });
    return out;
  }
  function segWidths(d, total, minW) {
    var C = d.c || 1, ws = d.shifts.map(function (p) { return Math.max(minW, p[1] / C * total); });
    var sum = ws[0] + ws[1] + ws[2];
    return ws.map(function (w) { return w * total / sum; });
  }
  function qHTML(sv) { return '<div class="q"><div class="qv">' + sv.v + '</div><div class="qd"></div><div class="qc">' + sv.c + '</div></div>'; }
  function caHTML(d, sv) {
    var ws = segWidths(d, 88, 14), x = 53, segs = '', labels = '';
    [3, 2, 1].forEach(function (s) {
      var p = d.shifts[s - 1], w = ws[s - 1], ratio = Math.min(1, p[0] / (p[1] || 1));
      var cls = 'hs' + (d.warn === s ? ' warn' : '') + (p[0] > p[1] ? ' over' : '');
      segs += '<div class="' + cls + '" data-s="' + s + '" style="left:' + x.toFixed(1) + 'px;width:' + w.toFixed(1) + 'px"><i class="fl" style="width:' + (ratio * 100).toFixed(1) + '%"></i></div>';
      labels += '<span class="hl" data-s="' + s + '" style="left:' + x.toFixed(1) + 'px;width:' + w.toFixed(1) + 'px">' + s + '</span>';
      x += w + 3;
    });
    return '<div class="ca"><div class="qa"><span class="qv">' + sv.v + '</span><span class="qc">' + sv.c + '</span></div>' + labels + segs + '</div>';
  }
  function cbHTML(d, sv) {
    var ws = segWidths(d, 68, 12), x = 9, segs = '';
    [3, 2, 1].forEach(function (s) {
      var p = d.shifts[s - 1], w = ws[s - 1], ratio = Math.min(1, p[0] / (p[1] || 1));
      segs += '<div class="sb' + (d.warn === s ? ' warn' : '') + (p[0] > p[1] ? ' over' : '') + '" data-s="' + s + '" style="left:' + x.toFixed(1) + 'px;width:' + w.toFixed(1) + 'px"><i class="fl" style="width:' + (ratio * 100).toFixed(1) + '%"></i></div>';
      x += w + 3;
    });
    return '<div class="cb"><div class="strip"><span class="qv">' + sv.v + '</span><span class="sl">/</span><span class="qc">' + sv.c + '</span></div>' + segs + '</div>';
  }
  function cellFaces(d) {
    var sv = shown(d), design = S.opts.cell;
    if (design === 'default') return '<div class="fb" style="width:112px">' + qHTML(sv) + vbarsHTML(d) + '</div>';
    var w = DESIGNS[design].cw;
    return '<div class="fb fb-c" style="width:' + w + 'px">' + (design === 'ca' ? caHTML(d, sv) : cbHTML(d, sv)) + '</div><div class="fc">' + qHTML(sv) + '</div>';
  }
  function cellHTML(col, r) {
    var d = cell(col.id, r), sv = shown(d), unit = D.units[r];
    var cls = 'cell' + (r === 0 ? ' sum' : '') + (d.alert ? ' alert' : '') + (S.selected === d.key ? ' selected' : '');
    var interactive = S.opts.expand === 'card';
    return '<div class="' + cls + '" data-key="' + d.key + '"' + (interactive ? ' tabindex="0" role="button"' : '') +
      ' aria-label="' + esc(unit.name + ', ' + col.label + ': ' + sv.v + ' מתוך ' + sv.c + (d.alert ? ', חריגה' : '')) + '">' +
      '<div class="cell-in"><div class="faces">' + cellFaces(d) + '</div></div>' +
      (r === 0 && colHasAlert(col.id) ? '<i class="rdot" aria-hidden="true"></i>' : '') + '</div>';
  }
  function groupHTML(g) {
    var compact = S.modes[g.id] === 'compact';
    var icon = g.icon ? '<img class="ic-n" src="' + g.icon + '" alt=""><img class="ic-h" src="' + (g.iconHover || g.icon) + '" alt="">' : '';
    var cols = g.columns.map(function (c) {
      var cells = '';
      for (var r = 0; r < 5; r++) cells += cellHTML(c, r);
      return '<div class="col" data-col="' + c.id + '"><div class="col-label" data-l="' + esc(c.label) + '" data-s="' + esc(c.short) + '">' + esc(compact ? c.short : c.label) + '</div>' + cells + '</div>';
    }).join('');
    return '<div class="group' + (compact ? ' compact' : '') + '" data-g="' + g.id + '">' +
      '<div class="g-head"><div class="g-hwrap">' +
      '<img class="g-drag" src="assets/drag.svg" alt="" draggable="true" title="גרירה לשינוי סדר">' +
      '<div class="g-title" style="--isz:' + (g.iconSize || 16) + 'px">' + icon + '<span>' + esc(g.title) + '</span></div>' +
      '<button class="g-expand" aria-label="' + (compact ? 'הרחב את ' : 'צמצם את ') + esc(g.title) + '" aria-pressed="' + (compact ? 'false' : 'true') + '"><img src="assets/expand-minimize.svg" alt=""></button>' +
      '</div></div><div class="g-body">' + cols + '</div></div>';
  }
  function renderSidebar() {
    var units = D.units.map(function (u, r) {
      var ind = r > 0 && unitHasAlert(r) ? '<img class="u-ind" src="assets/c-0631a.svg" alt="" title="קיימת חריגה">' : '';
      if (u.kind === 'ugda') return '<div class="unit ugda"><span class="u-ic"><img src="assets/t-b3e32.svg" alt=""><img src="assets/t-b3e32.svg" alt=""></span><img class="u-chev" src="assets/t-b5a01.svg" alt=""><span class="u-name">' + u.name + '</span><span class="u-sub">' + u.sub + '</span></div>';
      return '<div class="unit"><span class="u-ic"><img src="assets/t-e20fc.svg" alt=""></span><span class="u-name">' + u.name + '</span><span class="u-sub" title="' + esc(u.sub) + '">' + u.sub + '</span>' + ind + '</div>';
    }).join('');
    sidebar.innerHTML = '<span class="sb-label">יחידה</span><div class="units">' + units + '</div>';
  }
  function renderTable() {
    var keepScroll = vp.scrollLeft;
    applyGeometry();
    tableEl.classList.toggle('expand-on', S.opts.expand === 'card');
    groupsEl.className = S.shift ? 'shift-focus-' + S.shift : '';
    groupsEl.innerHTML = S.order.map(function (id) { return groupHTML(D.groups.filter(function (g) { return g.id === id; })[0]); }).join('');
    renderSidebar();
    vp.scrollLeft = keepScroll;
    updateScrollbar();
  }
  // Update only the numbers/bars inside existing cells (date / shift changes)
  function refreshCells() {
    groupsEl.className = S.shift ? 'shift-focus-' + S.shift : '';
    groupsEl.classList.add('num-swap');
    setTimeout(function () {
      $$('.cell', groupsEl).forEach(function (el) {
        var k = el.getAttribute('data-key').split(':'), d = cell(k[0], +k[1]);
        $('.faces', el).innerHTML = cellFaces(d);
        var sv = shown(d), c = colIndex[k[0]].c;
        el.setAttribute('aria-label', D.units[+k[1]].name + ', ' + c.label + ': ' + sv.v + ' מתוך ' + sv.c + (d.alert ? ', חריגה' : ''));
      });
      groupsEl.classList.remove('num-swap');
      if (S.selected) fillCard();
    }, 120);
  }

  /* horizontal scroll */
  var hScroll = $('#hScroll'), hThumb = $('#hThumb');
  function updateScrollbar() {
    var sw = vp.scrollWidth, cw = vp.clientWidth;
    var over = sw - cw > 2;
    hScroll.classList.toggle('show', over);
    if (!over) return;
    var track = hScroll.clientWidth, tw = Math.max(40, track * cw / sw);
    var frac = Math.min(1, Math.abs(vp.scrollLeft) / (sw - cw));
    hThumb.style.width = tw + 'px';
    hThumb.style.right = (frac * (track - tw)) + 'px';
  }
  vp.addEventListener('scroll', function () { updateScrollbar(); if (S.selected) positionCard(); }, { passive: true });
  vp.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && vp.scrollWidth > vp.clientWidth) {
      vp.scrollLeft -= e.deltaY; e.preventDefault();
    }
  }, { passive: false });
  // drag the thumb
  hThumb.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var startX = e.clientX, startS = vp.scrollLeft, track = hScroll.clientWidth, tw = hThumb.clientWidth, range = vp.scrollWidth - vp.clientWidth;
    function mv(ev) { vp.scrollLeft = startS + (ev.clientX - startX) / scale * range / Math.max(1, track - tw); }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
  hScroll.style.pointerEvents = 'auto';

  // Track layout animations (width transitions) to keep card + scrollbar in sync
  var animUntil = 0;
  function followLayout(ms) {
    animUntil = performance.now() + (ms || 320);
    (function loop() {
      updateScrollbar();
      if (S.selected) positionCard();
      if (performance.now() < animUntil) requestAnimationFrame(loop);
    })();
  }

  groupsEl.addEventListener('transitionend', function (e) { if (e.propertyName === 'width' || e.propertyName === 'gap') { updateScrollbar(); if (S.selected) positionCard(); } });
  function setGroupMode(gid, mode) {
    S.modes[gid] = mode;
    var gEl = $('.group[data-g="' + gid + '"]', groupsEl);
    if (!gEl) return;
    var compact = mode === 'compact';
    gEl.classList.toggle('compact', compact);
    $$('.col-label', gEl).forEach(function (l) { l.textContent = compact ? l.getAttribute('data-s') : l.getAttribute('data-l'); });
    var b = $('.g-expand', gEl), title = D.groups.filter(function (g) { return g.id === gid; })[0].title;
    b.setAttribute('aria-label', (compact ? 'הרחב את ' : 'צמצם את ') + title);
    b.setAttribute('aria-pressed', compact ? 'false' : 'true');
    followLayout(320);
  }

  /* group header interactions (event delegation) */
  groupsEl.addEventListener('click', function (e) {
    var exp = e.target.closest('.g-expand');
    if (exp) {
      var gid = exp.closest('.group').getAttribute('data-g');
      setGroupMode(gid, S.modes[gid] === 'compact' ? 'bars' : 'compact');
      return;
    }
    var c = e.target.closest('.cell');
    if (c) onCellActivate(c);
  });
  groupsEl.addEventListener('keydown', function (e) {
    var c = e.target.closest && e.target.closest('.cell');
    if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onCellActivate(c); }
  });
  // drag & drop reorder of groups (via the drag handle)
  var dragId = null;
  groupsEl.addEventListener('dragstart', function (e) {
    var hnd = e.target.closest && e.target.closest('.g-drag');
    if (!hnd) { e.preventDefault(); return; }
    var g = hnd.closest('.group'); dragId = g.getAttribute('data-g');
    g.classList.add('dragging');
    try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setDragImage(g.querySelector('.g-title'), 20, 12); } catch (er) { /* ignore */ }
  });
  groupsEl.addEventListener('dragover', function (e) {
    if (!dragId) return;
    var g = e.target.closest('.group'); if (!g) return;
    e.preventDefault();
    $$('.group.drop-target', groupsEl).forEach(function (x) { if (x !== g) x.classList.remove('drop-target'); });
    if (g.getAttribute('data-g') !== dragId) g.classList.add('drop-target');
  });
  groupsEl.addEventListener('drop', function (e) {
    var g = e.target.closest('.group'); if (!g || !dragId) return;
    e.preventDefault();
    var to = g.getAttribute('data-g');
    if (to !== dragId) {
      var from = S.order.indexOf(dragId), ti = S.order.indexOf(to);
      S.order.splice(from, 1); S.order.splice(ti, 0, dragId);
      renderTable();
      toast('סדר הקבוצות עודכן', 'info');
    }
  });
  groupsEl.addEventListener('dragend', function () {
    dragId = null;
    $$('.group', groupsEl).forEach(function (x) { x.classList.remove('dragging', 'drop-target'); });
  });

  /* ---------------- expanded cell card ---------------- */
  var card = $('#cellCard'), cardHideT = null;
  function onCellActivate(c) {
    if (S.opts.expand !== 'card') return;
    var key = c.getAttribute('data-key');
    if (S.selected === key) { closeCard(); return; }
    openCard(key);
  }
  function openCard(key) {
    var prev = $('.cell.selected', groupsEl);
    if (prev) prev.classList.remove('selected');
    S.selected = key;
    var el = cellEl(key); if (el) el.classList.add('selected');
    clearTimeout(cardHideT);
    fillCard();
    card.hidden = false;
    positionCard();
    requestAnimationFrame(function () { if (S.selected === key) card.classList.add('open'); });
  }
  function closeCard() {
    if (!S.selected) return;
    var el = cellEl(S.selected); if (el) el.classList.remove('selected');
    S.selected = null;
    card.classList.remove('open');
    cardHideT = setTimeout(function () { card.hidden = true; }, 160);
  }
  function cellEl(key) { return $('.cell[data-key="' + key + '"]', groupsEl); }
  function fillCard() {
    var k = S.selected.split(':'), d = cell(k[0], +k[1]), col = colIndex[k[0]].c, unit = D.units[+k[1]], sv = shown(d);
    var rows = d.shifts.map(function (p, i) {
      var cls = 'cc-row' + (d.warn === i + 1 ? ' warn' : '') + (p[0] > p[1] ? ' over' : '');
      return '<div class="' + cls + '"><span class="ix">' + (i + 1) + '</span><span class="bar"><i style="width:' + Math.min(100, p[0] / (p[1] || 1) * 100).toFixed(1) + '%"></i></span>' +
        '<span class="val"><b>' + p[0] + '</b><span>/' + p[1] + '</span></span></div>';
    }).join('');
    var icon = +k[1] === 0
      ? '<span class="cc-ic ugda"><img src="assets/t-b3e32.svg" alt=""><img src="assets/t-b3e32.svg" alt=""></span>'
      : '<span class="cc-ic"><img src="assets/card-command.svg" alt=""></span>';
    card.innerHTML = '<div class="cc-head">' + icon +
      '<div class="cc-title">' + esc(unit.name) + '<span>' + esc(col.label) + '</span></div><div class="cc-sub">' + esc(unit.sub) + '</div>' +
      '<div class="cc-pill"><b>' + sv.v + '</b><span>/ ' + sv.c + '</span></div></div><div class="cc-rows">' + rows + '</div>';
    card.setAttribute('aria-label', unit.name + ' ' + col.label);
  }
  function positionCard() {
    var el = S.selected && cellEl(S.selected); if (!el) return;
    var r = stageRect(el);
    var left = r.left + r.width / 2 - 129, top = r.bottom + 3;
    left = Math.max(8, Math.min(1920 - 266, left));
    if (top + 140 > 1070) top = r.top - 143;
    card.style.left = left + 'px'; card.style.top = top + 'px';
  }

  /* ---------------- date bar ---------------- */
  var dbText = $('#dbText'), dbInd = $('#dbIndicator');
  function fmtD(dt) { return dt.getDate() + '/' + (dt.getMonth() + 1); }
  function renderDate() {
    var a = new Date(2026, 5, 21 + S.day), b = new Date(2026, 5, 22 + S.day);
    dbText.innerHTML = '<b>' + fmtD(a) + '</b> <i>06:00</i> - <b>' + fmtD(b) + '</b> <i>06:00</i>';
    $('#datebar').setAttribute('aria-label', 'חלון זמן ' + fmtD(a) + ' – ' + fmtD(b));
  }
  function moveIndicator() {
    var t = $('.db-tab[data-shift="' + S.shift + '"]');
    dbInd.style.left = t.offsetLeft + 'px'; dbInd.style.width = t.offsetWidth + 'px';
    $$('.db-tab').forEach(function (x) { x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
  }
  function changeDay(delta) {
    S.day += delta;
    dbText.classList.add('swap');
    setTimeout(function () { renderDate(); dbText.classList.remove('swap'); }, 110);
    refreshCells();
  }
  function selectShift(s) {
    if (S.shift === s) return;
    S.shift = s; moveIndicator(); refreshCells();
  }
  $('#dayNext').addEventListener('click', function (e) { e.stopPropagation(); changeDay(1); });
  $('#dayPrev').addEventListener('click', function (e) { e.stopPropagation(); changeDay(-1); });
  $$('.db-tab').forEach(function (t) {
    t.addEventListener('click', function () { selectShift(+t.getAttribute('data-shift')); });
    t.addEventListener('keydown', function (e) {
      if (e.target !== t) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectShift(+t.getAttribute('data-shift')); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        var order = [0, 1, 2, 3], i = order.indexOf(+t.getAttribute('data-shift'));
        i = (i + (e.key === 'ArrowLeft' ? 1 : -1) + 4) % 4;
        var n = $('.db-tab[data-shift="' + order[i] + '"]'); n.focus(); selectShift(order[i]);
      }
    });
  });

  /* ---------------- view toggle ---------------- */
  var vtPill = $('#vtPill');
  function renderToggle() {
    var idx = S.view === 'bars' ? 2 : 1;
    vtPill.style.width = 'calc((100% - 4px) / 3)';
    vtPill.style.left = '2px';
    vtPill.style.transform = 'translateX(' + (idx * 100) + '%)';
    $$('.vt-seg').forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-view') === S.view ? 'true' : 'false'); });
  }
  $$('.vt-seg').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-view');
      if (v === 'dot') { toast('תצוגה זו לא הוגדרה בעיצוב', 'info'); return; }
      S.view = v; renderToggle();
      D.groups.forEach(function (g) { setGroupMode(g.id, v); });
    });
  });

  /* ---------------- toolbar ---------------- */
  var btnAdd = $('#btnAdd');
  btnAdd.addEventListener('click', function () { S.panelOpen ? closePanel(false) : openPanel(); });
  ['#btnEdit', '#btnFilter', '#btnSearch'].forEach(function (id) {
    $(id).addEventListener('click', function () { toast('פעולה זו אינה פעילה באב-הטיפוס', 'info'); });
  });

  /* ---------------- toast ---------------- */
  var toastEl = $('#toast'), toastT = null;
  function toast(msg, kind) {
    toastEl.innerHTML = (kind === 'info'
      ? '<span class="ok info"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="2" r="1" fill="#fff"/><path d="M5 4.5v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg></span>'
      : '<span class="ok"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5.2 4.2 7.3 8 3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>') + '<span>' + esc(msg) + '</span>';
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, kind === 'info' ? 1800 : 2600);
  }

  /* ================= FORM PANEL ================= */
  var panel = $('#panel'), panelHideT = null;
  var P = {}; // refs to panel parts
  var ICON_X = '<svg viewBox="0 0 10 10"><path d="M5 1.5v7M1.5 5h7" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var ICON_MINUS = '<svg viewBox="0 0 10 10"><path d="M2 5h6" stroke="#cfd4da" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function openPanel() {
    S.panelOpen = true;
    clearTimeout(panelHideT);
    buildPanel();
    panel.hidden = false;
    btnAdd.classList.add('is-on'); btnAdd.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { if (S.panelOpen) panel.classList.add('open'); });
  }
  function closePanel(reset) {
    if (!S.panelOpen) return;
    S.panelOpen = false;
    closeDropdown(); closeCal();
    if (S.form.manualEditing) cancelManual();
    panel.classList.remove('open');
    btnAdd.classList.remove('is-on'); btnAdd.setAttribute('aria-expanded', 'false');
    panelHideT = setTimeout(function () { panel.hidden = true; panel.innerHTML = ''; }, 210);
    if (reset) S.form = freshForm();
  }

  function fmtDate(dt) { return ('0' + dt.getDate()).slice(-2) + '/' + ('0' + (dt.getMonth() + 1)).slice(-2) + '/' + String(dt.getFullYear()).slice(-2); }
  function hasRange() { return !!(S.form.start && S.form.end); }
  function rowComplete(r) { return !!(r.ammo && r.type && +r.qty > 0); }
  function shiftOK() { var f = S.form; return f.shift === 1 || f.shift === 2 || f.shift === 3 || f.shift === 'full' || (f.shift === 'manual' && !!f.manual); }
  function canSend() { return hasRange() && shiftOK() && S.form.rows.some(rowComplete) && !S.form.sending; }

  function buildPanel() {
    var f = S.form;
    panel.innerHTML = '';
    var head = h('div', { class: 'p-head' },
      '<div class="p-title" id="panelTitle">דרישת חימוש נוסף</div>' +
      '<button class="p-close" aria-label="סגירה"><img src="assets/cal-18fe6.svg" alt=""></button>');
    panel.appendChild(head);
    $('.p-close', head).addEventListener('click', function () { closePanel(false); });

    // Day section
    var day = h('section', { class: 'sec sec-day', 'aria-label': 'יום וחלון הקצאה' },
      '<span class="lbl lbl-date" id="lblDate">יום הקצאה</span>' +
      '<div class="df" role="button" tabindex="0" aria-haspopup="dialog" aria-labelledby="lblDate"><span class="df-text"></span>' +
      '<button class="df-btn" tabindex="-1" aria-hidden="true"><img src="assets/cal-9ccc8.svg" alt=""></button></div>' +
      '<span class="lbl lbl-win" id="lblWin">חלון הקצאה</span><span class="win-err" role="alert"></span>' +
      '<div class="chips" role="radiogroup" aria-labelledby="lblWin">' +
      '<button class="chip" role="radio" data-v="1"><span>06:00 - 14:00</span><i class="badge">1</i></button>' +
      '<button class="chip" role="radio" data-v="3"><span>19:01 - 06:00</span><i class="badge">3</i></button>' +
      '<button class="chip" role="radio" data-v="2"><span>14:01 - 19:00</span><i class="badge">2</i></button>' +
      '<button class="chip manual" role="radio" data-v="manual"><span class="mt"></span></button>' +
      '<button class="chip full" role="radio" data-v="full"><span>יום מלא</span></button>' +
      '</div>');
    panel.appendChild(day);
    P.df = $('.df', day); P.dfText = $('.df-text', day); P.chips = $('.chips', day);
    P.df.addEventListener('click', function () { S.form.calOpen ? closeCal() : openCal(); });
    P.df.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openCal(true); } });
    P.chips.addEventListener('click', onChipClick);

    // calendar (inside panel so it moves with it)
    P.cal = h('div', { class: 'cal', role: 'dialog', 'aria-label': 'בחירת טווח תאריכים' });
    panel.appendChild(P.cal);

    // Option B label + add button
    P.secLabel = h('div', { class: 'sec-label' }, '<span class="lbl">סוגי חימוש</span><button class="add-row" aria-label="הוספת שורת חימוש">' + ICON_X + '</button>');
    $('.add-row', P.secLabel).addEventListener('click', function () { addRow(true); });
    panel.appendChild(P.secLabel);

    // Ammo section
    P.ammo = h('section', { class: 'sec sec-ammo', 'aria-label': 'סוגי חימוש' });
    P.rowsEl = h('div', { class: 'rows' });
    P.ammo.appendChild(P.rowsEl);
    panel.appendChild(P.ammo);
    f.rows.forEach(function (r) { P.rowsEl.appendChild(buildRow(r, false)); });

    // Reason
    P.reasonSec = h('section', { class: 'sec sec-reason' },
      '<label class="lbl" for="reasonTa">טובת הדרישה</label><textarea id="reasonTa" class="reason" placeholder="פרט..." maxlength="400"></textarea>');
    panel.appendChild(P.reasonSec);
    P.reason = $('textarea', P.reasonSec);
    P.reason.value = f.reason;
    P.reason.addEventListener('input', function () { S.form.reason = P.reason.value; });

    // Footer
    var foot = h('div', { class: 'p-foot' },
      '<button class="btn btn-send" aria-disabled="true">שליחה</button><button class="btn btn-cancel">ביטול</button>');
    panel.appendChild(foot);
    P.send = $('.btn-send', foot);
    P.send.addEventListener('click', submit);
    $('.btn-cancel', foot).addEventListener('click', function () { closePanel(true); });

    syncPanel();
    if (f.calOpen) { f.calOpen = false; openCal(); }
  }

  function syncPanel() {
    if (!S.panelOpen || !P.df) return;
    var f = S.form;
    // date field
    if (hasRange()) { P.dfText.textContent = fmtDate(f.start) + '  -  ' + fmtDate(f.end); P.dfText.classList.remove('ph'); }
    else { P.dfText.textContent = '--/--/--  -  --/--/--'; P.dfText.classList.add('ph'); }
    P.df.classList.toggle('active', f.calOpen);
    P.df.setAttribute('aria-expanded', f.calOpen ? 'true' : 'false');
    // chips
    $$('.chip', P.chips).forEach(function (c) {
      var v = c.getAttribute('data-v'), sel = String(f.shift) === v && (v !== 'manual' || !!f.manual);
      c.classList.toggle('sel', sel && !(v === 'manual' && f.manualEditing));
      c.setAttribute('aria-checked', sel ? 'true' : 'false');
    });
    var mc = $('.chip.manual', P.chips);
    if (!f.manualEditing) {
      $('.mt', mc).textContent = f.manual || 'הזן טווח שעות';
      mc.style.direction = f.manual ? 'ltr' : 'rtl';
    }
    // enable/disable dependent sections
    var en = hasRange();
    [P.secLabel, P.ammo, P.reasonSec].forEach(function (s) {
      s.classList.toggle('disabled', !en);
      if (en) s.removeAttribute('inert'); else s.setAttribute('inert', '');
    });
    P.secLabel.style.display = S.opts.rows === 'manual' ? '' : 'none';
    $('.add-row', P.secLabel).disabled = f.rows.length >= 8;
    // rows: remove buttons visible only in manual mode with >1 rows
    $$('.row-wrap', P.rowsEl).forEach(function (w) {
      var rm = $('.rm-row', w);
      rm.style.display = S.opts.rows === 'manual' && f.rows.length > 1 ? '' : 'none';
    });
    // send
    var ok = canSend();
    P.send.classList.toggle('on', ok);
    P.send.setAttribute('aria-disabled', ok ? 'false' : 'true');
  }

  /* ---- shift chips ---- */
  function onChipClick(e) {
    var c = e.target.closest('.chip'); if (!c) return;
    if (e.target.closest('.chip-input')) return;
    var v = c.getAttribute('data-v');
    if (v === 'manual') { startManual(); return; }
    if (S.form.manualEditing) finishManualSilently();
    S.form.shift = v === 'full' ? 'full' : +v;
    syncPanel();
  }
  function startManual() {
    var f = S.form; if (f.manualEditing) return;
    f.manualEditing = true; f.prevShift = f.shift; f.shift = null;
    var mc = $('.chip.manual', P.chips);
    mc.classList.remove('sel');
    var inp = h('input', { class: 'chip-input', type: 'text', inputmode: 'numeric', placeholder: '00:00 - 00:00', 'aria-label': 'טווח שעות (HH:MM - HH:MM)', maxlength: '13', autocomplete: 'off' });
    inp.value = f.manual || '';
    mc.appendChild(inp);
    syncPanel();
    inp.focus(); inp.select();
    inp.addEventListener('input', function (ev) {
      var t = ev.inputType || '';
      if (t.indexOf('insert') === 0) {
        var d = inp.value.replace(/\D/g, '').slice(0, 8), out = d.slice(0, 2);
        if (d.length > 2) out += ':' + d.slice(2, 4);
        if (d.length > 4 || (d.length === 4 && t === 'insertText')) out += ' - ';
        if (d.length > 4) out += d.slice(4, 6);
        if (d.length > 6) out += ':' + d.slice(6, 8);
        inp.value = out;
      }
      if (inp.classList.contains('invalid')) { inp.classList.remove('invalid'); setWinErr(''); }
    });
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); commitManual(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cancelManual(); }
    });
    inp.addEventListener('blur', function () { setTimeout(function () { if (S.form.manualEditing && document.activeElement !== inp) commitManual(false); }, 0); });
  }
  function parseRange(s) {
    var m = String(s).trim().match(/^(\d{1,2}):?(\d{2})\s*-\s*(\d{1,2}):?(\d{2})$/) || String(s).replace(/\s/g, '').match(/^(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (!m) return null;
    var a = +m[1], b = +m[2], c = +m[3], d = +m[4];
    if (a > 23 || c > 23 || b > 59 || d > 59) return null;
    if (a === c && b === d) return null;
    var p = function (n) { return ('0' + n).slice(-2); };
    return p(a) + ':' + p(b) + ' - ' + p(c) + ':' + p(d);
  }
  function commitManual(fromEnter) {
    var f = S.form, mc = $('.chip.manual', P.chips), inp = $('.chip-input', mc);
    if (!inp) return;
    var raw = inp.value.trim();
    if (!raw) { cancelManual(true); return; }
    var norm = parseRange(raw);
    if (!norm) {
      inp.classList.add('invalid');
      setWinErr('פורמט נדרש: 10:00 - 11:00');
      if (fromEnter) { mc.classList.remove('shake'); void mc.offsetWidth; mc.classList.add('shake'); }
      f.shift = null; syncPanel();
      return;
    }
    f.manual = norm; f.shift = 'manual'; f.manualEditing = false;
    inp.remove(); setWinErr('');
    syncPanel();
    if (fromEnter) mc.focus();
  }
  function cancelManual(clear) {
    var f = S.form; if (!f.manualEditing) return;
    f.manualEditing = false;
    if (clear) { f.manual = ''; f.shift = f.prevShift === 'manual' ? null : f.prevShift; }
    else f.shift = f.prevShift;
    if (f.shift === 'manual' && !f.manual) f.shift = null;
    if (P.chips) {
      var mc = $('.chip.manual', P.chips), inp = $('.chip-input', mc);
      if (inp) inp.remove(); setWinErr('');
      syncPanel();
      mc.focus();
    }
  }
  function finishManualSilently() {
    var f = S.form, mc = $('.chip.manual', P.chips), inp = $('.chip-input', mc);
    var norm = inp && parseRange(inp.value);
    f.manualEditing = false;
    if (norm) f.manual = norm; else if (inp && !parseRange(f.manual || '')) f.manual = '';
    if (inp) inp.remove(); setWinErr('');
  }
  function setWinErr(msg) { var e = $('.win-err', panel); if (e) e.textContent = msg; }

  /* ---- calendar ---- */
  var HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var HE_WD = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function openCal(focus) {
    var f = S.form; if (f.calOpen) return;
    closeDropdown();
    f.calOpen = true; f.pick = null; f.hover = null;
    if (f.start) { f.calY = f.start.getFullYear(); f.calM = f.start.getMonth(); }
    renderCal();
    requestAnimationFrame(function () { if (!S.form.calOpen || !P.cal) return; P.cal.classList.add('open'); if (focus) { var d = $('.cal-day', P.cal); if (d) d.focus(); } });
    syncPanel();
  }
  function closeCal() {
    var f = S.form; if (!f.calOpen) return;
    f.calOpen = false; f.pick = null; f.hover = null;
    if (P.cal) P.cal.classList.remove('open');
    syncPanel();
  }
  function renderCal() {
    var f = S.form, y = f.calY, m = f.calM;
    var first = new Date(y, m, 1), startOff = first.getDay();
    var days = new Date(y, m + 1, 0).getDate(), cells = Math.ceil((startOff + days) / 7) * 7;
    var grid = '';
    var today = new Date();
    for (var i = 0; i < cells; i++) {
      var dt = new Date(y, m, 1 - startOff + i);
      grid += '<div class="cal-day' + (dt.getMonth() !== m ? ' out' : '') + (sameDay(dt, today) ? ' today' : '') + '" role="gridcell" tabindex="-1" data-t="' + dt.getTime() + '" aria-label="' + dt.getDate() + ' ' + HE_MONTHS[dt.getMonth()] + ' ' + dt.getFullYear() + '"><span>' + dt.getDate() + '</span></div>';
    }
    P.cal.innerHTML =
      '<button class="cal-x" aria-label="סגירת לוח שנה"><img src="assets/cal-9bc19.svg" alt=""></button>' +
      '<div class="cal-head"><button class="cal-nav" data-d="-1" aria-label="החודש הקודם"><img src="assets/cal-a7ff5.svg" alt=""></button>' +
      '<span class="cal-title" aria-live="polite">' + HE_MONTHS[m] + ' ' + y + '</span>' +
      '<button class="cal-nav" data-d="1" aria-label="החודש הבא"><img src="assets/cal-63c93.svg" alt=""></button></div>' +
      '<div class="cal-wd">' + HE_WD.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
      '<div class="cal-grid" role="grid">' + grid + '</div>' +
      '<div class="cal-hint">' + (f.pick ? 'בחר תאריך סיום' : 'בחר תאריך התחלה') + '</div>';
    $('.cal-x', P.cal).addEventListener('click', function (e) { e.stopPropagation(); closeCal(); P.df.focus(); });
    $$('.cal-nav', P.cal).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var d = new Date(f.calY, f.calM + (+b.getAttribute('data-d')), 1);
        f.calY = d.getFullYear(); f.calM = d.getMonth(); renderCal();
      });
    });
    var gridEl = $('.cal-grid', P.cal);
    gridEl.addEventListener('click', function (e) { var c = e.target.closest('.cal-day'); if (c) pickDay(new Date(+c.getAttribute('data-t')), false); });
    gridEl.addEventListener('mouseover', function (e) { var c = e.target.closest('.cal-day'); if (c && f.pick) { f.hover = new Date(+c.getAttribute('data-t')); paintRange(); } });
    gridEl.addEventListener('mouseleave', function () { f.hover = null; paintRange(); });
    gridEl.addEventListener('keydown', function (e) {
      var c = e.target.closest('.cal-day'); if (!c) return;
      var all = $$('.cal-day', gridEl), i = all.indexOf(c), step = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
      if (step) { e.preventDefault(); var n = all[i + step]; if (n) { n.focus(); if (f.pick) { f.hover = new Date(+n.getAttribute('data-t')); paintRange(); } } }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickDay(new Date(+c.getAttribute('data-t')), true); }
    });
    paintRange();
  }
  function paintRange() {
    var f = S.form, a, b, preview = false;
    if (f.pick) { a = f.pick; b = f.hover || f.pick; preview = !!f.hover && !sameDay(f.hover, f.pick); }
    else if (f.start && f.end) { a = f.start; b = f.end; }
    if (a && b && b < a) { var t = a; a = b; b = t; }
    $$('.cal-day', P.cal).forEach(function (el) {
      var dt = new Date(+el.getAttribute('data-t'));
      var isA = a && sameDay(dt, a), isB = b && sameDay(dt, b), inr = a && b && dt > a && dt < b;
      el.classList.toggle('rs', !!isA); el.classList.toggle('re', !!isB); el.classList.toggle('inr', !!inr);
      var pv = preview && !(f.pick && sameDay(dt, f.pick));
      el.classList.toggle('preview', !!(pv && (inr || isA || isB)));
      el.setAttribute('aria-selected', isA || isB || inr ? 'true' : 'false');
    });
    var hint = $('.cal-hint', P.cal); if (hint) hint.textContent = f.pick ? 'בחר תאריך סיום' : 'בחר תאריך התחלה';
  }
  function pickDay(dt, kb) {
    var f = S.form;
    if (dt.getMonth() !== f.calM) { f.calY = dt.getFullYear(); f.calM = dt.getMonth(); }
    if (!f.pick) {
      f.pick = dt; f.hover = null; renderCal();
      if (kb) { var el = $('.cal-day[data-t="' + dt.getTime() + '"]', P.cal); if (el) el.focus(); }
      return;
    }
    var a = f.pick, b = dt;
    if (b < a) { var t = a; a = b; b = t; }
    f.start = a; f.end = b; f.pick = null; f.hover = null;
    paintRange();
    syncPanel();
    setTimeout(function () { closeCal(); if (kb) P.df.focus(); }, 180);
  }

  /* ---- ammo rows ---- */
  var openDD = null;
  function closeDropdown() { if (openDD) { openDD.close(); openDD = null; } }
  function makeDropdown(opts) {
    // opts: { label, getItems(), getValue(), onChange(v), placeholder, icon(v) }
    var root = h('div', { class: 'dd' });
    var id = 'dd' + Math.random().toString(36).slice(2, 8);
    var btn = h('button', { class: 'dd-btn', type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': id, 'aria-label': opts.label });
    var menu = h('ul', { class: 'dd-menu', role: 'listbox', id: id, tabindex: '-1' });
    root.appendChild(btn); root.appendChild(menu);
    var active = -1, api;
    function paintBtn() {
      var v = opts.getValue(), ic = v && opts.icon ? opts.icon(v) : null;
      btn.innerHTML = (ic ? '<img class="ic" src="' + ic + '" alt="">' : '') +
        '<span class="v' + (v ? '' : ' ph') + '">' + esc(v ? opts.labelOf(v) : opts.placeholder) + '</span>' +
        '<img class="chev" src="assets/cal-14ad8.svg" alt="">';
      btn.setAttribute('aria-label', opts.label + ': ' + (v ? opts.labelOf(v) : 'לא נבחר'));
    }
    function paintMenu() {
      var items = opts.getItems(), v = opts.getValue();
      menu.innerHTML = items.map(function (it, i) {
        return '<li class="dd-opt' + (i === active ? ' active' : '') + '" role="option" id="' + id + '-' + i + '" data-i="' + i + '" aria-selected="' + (it.value === v ? 'true' : 'false') + '">' +
          (it.icon ? '<img src="' + it.icon + '" alt="">' : '') + '<span>' + esc(it.label) + '</span></li>';
      }).join('');
      if (active >= 0) btn.setAttribute('aria-activedescendant', id + '-' + active); else btn.removeAttribute('aria-activedescendant');
    }
    function open() {
      if (openDD && openDD !== api) closeDropdown();
      closeCal();
      var items = opts.getItems(), v = opts.getValue();
      active = Math.max(0, items.map(function (x) { return x.value; }).indexOf(v));
      paintMenu();
      root.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
      openDD = api;
    }
    function close() { root.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.removeAttribute('aria-activedescendant'); if (openDD === api) openDD = null; }
    function choose(i) { var it = opts.getItems()[i]; if (!it) return; close(); opts.onChange(it.value); paintBtn(); btn.focus(); }
    btn.addEventListener('click', function () { root.classList.contains('open') ? close() : open(); });
    btn.addEventListener('keydown', function (e) {
      var isOpen = root.classList.contains('open'), n = opts.getItems().length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) { open(); return; }
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; paintMenu();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isOpen && active >= 0) choose(active); else open();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault(); e.stopPropagation(); close();
      } else if (e.key === 'Tab' && isOpen) close();
      else if (e.key === 'Home' && isOpen) { e.preventDefault(); active = 0; paintMenu(); }
      else if (e.key === 'End' && isOpen) { e.preventDefault(); active = n - 1; paintMenu(); }
    });
    menu.addEventListener('mousemove', function (e) { var li = e.target.closest('.dd-opt'); if (li && +li.getAttribute('data-i') !== active) { active = +li.getAttribute('data-i'); paintMenu(); } });
    menu.addEventListener('mousedown', function (e) { e.preventDefault(); });
    menu.addEventListener('click', function (e) { var li = e.target.closest('.dd-opt'); if (li) choose(+li.getAttribute('data-i')); });
    api = { el: root, close: close, paint: paintBtn, root: root };
    paintBtn();
    return api;
  }
  function ammoById(id) { return D.ammo.filter(function (a) { return a.id === id; })[0]; }
  function buildRow(r, animate) {
    var wrap = h('div', { class: 'row-wrap' + (animate ? ' enter' : ''), 'data-id': r.id });
    var row = h('div', { class: 'arow', role: 'group', 'aria-label': 'שורת חימוש' });
    wrap.appendChild(row);
    var ammoDD = makeDropdown({
      label: 'תחמושת', placeholder: 'בחר',
      getItems: function () { return D.ammo.map(function (a) { return { value: a.id, label: a.label, icon: a.icon }; }); },
      getValue: function () { return r.ammo; },
      labelOf: function (v) { return ammoById(v).label; },
      icon: function (v) { return ammoById(v).icon; },
      onChange: function (v) {
        if (r.ammo !== v) { r.ammo = v; if (!(D.ammoTypes[v] || []).some(function (t) { return t.label === r.type; })) r.type = null; typeDD.paint(); }
        onRowsChanged();
      }
    });
    var typeDD = makeDropdown({
      label: 'סוג חימוש', placeholder: 'בחר',
      getItems: function () { return r.ammo ? D.ammoTypes[r.ammo].map(function (t) { return { value: t.label, label: t.label }; }) : [{ value: null, label: 'בחר תחמושת תחילה' }]; },
      getValue: function () { return r.type; },
      labelOf: function (v) { return v; },
      onChange: function (v) { if (v) { r.type = v; onRowsChanged(); } }
    });
    var f1 = h('div', { class: 'fld fld-ammo' }, '<span class="flbl" aria-hidden="true">תחמושת</span>');
    var f2 = h('div', { class: 'fld fld-type' }, '<span class="flbl" aria-hidden="true">סוג חימוש</span>');
    var f3 = h('div', { class: 'fld fld-qty' }, '<label class="flbl">כמות</label>');
    f1.appendChild(ammoDD.el); f2.appendChild(typeDD.el);
    var qty = h('input', { class: 'qty', type: 'text', inputmode: 'numeric', placeholder: '-', maxlength: '5', 'aria-label': 'כמות' });
    qty.value = r.qty;
    qty.addEventListener('input', function () {
      var v = qty.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 5);
      if (qty.value !== v) qty.value = v;
      r.qty = v; onRowsChanged();
    });
    f3.appendChild(qty);
    var rm = h('button', { class: 'rm-row', type: 'button', 'aria-label': 'הסרת שורה' }, ICON_MINUS);
    rm.addEventListener('click', function () { removeRow(r.id); });
    row.appendChild(f1); row.appendChild(f2); row.appendChild(f3); row.appendChild(rm);
    if (animate) requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.remove('enter'); }); });
    return wrap;
  }
  function addRow(focusIt) {
    var f = S.form; if (f.rows.length >= 8) return;
    var r = newRow(); f.rows.push(r);
    var w = buildRow(r, true);
    P.rowsEl.appendChild(w);
    syncPanel();
    if (focusIt) setTimeout(function () { var b = $('.dd-btn', w); if (b) b.focus(); }, 60);
  }
  function removeRow(id) {
    var f = S.form; if (f.rows.length <= 1) return;
    f.rows = f.rows.filter(function (r) { return r.id !== id; });
    var w = $('.row-wrap[data-id="' + id + '"]', P.rowsEl);
    if (w) {
      closeDropdown();
      w.style.height = w.offsetHeight + 'px'; void w.offsetHeight;
      w.classList.add('leave'); w.style.height = '';
      var done = function () { if (w.parentNode) w.parentNode.removeChild(w); };
      w.addEventListener('transitionend', function te(e) { if (e.propertyName === 'height') { w.removeEventListener('transitionend', te); done(); } });
      setTimeout(done, 400);
    }
    syncPanel();
    var anyBtn = $('.row-wrap:not(.leave) .dd-btn', P.rowsEl); if (anyBtn) anyBtn.focus();
  }
  function onRowsChanged() {
    var f = S.form;
    if (S.opts.rows === 'auto' && rowComplete(f.rows[f.rows.length - 1])) addRow(false);
    syncPanel();
  }

  /* ---- submit ---- */
  function submit() {
    if (!canSend()) {
      if (!S.form.sending) {
        var why = !hasRange() ? 'יש לבחור יום הקצאה' : !shiftOK() ? 'יש לבחור חלון הקצאה' : 'יש למלא לפחות שורת חימוש אחת';
        toast(why, 'info');
      }
      return;
    }
    var f = S.form;
    f.sending = true;
    P.send.innerHTML = '<span class="spin" aria-label="שולח"></span>';
    P.send.classList.add('on');
    var cols = [];
    f.rows.filter(rowComplete).forEach(function (r) {
      var t = D.ammoTypes[r.ammo].filter(function (x) { return x.label === r.type; })[0];
      if (t && cols.indexOf(t.col) < 0) cols.push(t.col);
    });
    // SIMULATED backend – no network request is made.
    setTimeout(function () {
      closePanel(true);
      toast('הדרישה נשלחה');
      pulseColumns(cols);
    }, 600);
  }
  function pulseColumns(cols) {
    if (!cols.length) return;
    var firstCol = $('.col[data-col="' + cols[0] + '"]', groupsEl);
    if (firstCol) {
      var vr = vp.getBoundingClientRect(), cr = firstCol.getBoundingClientRect();
      if (cr.left < vr.left || cr.right > vr.right) {
        vp.scrollBy({ left: (cr.left - vr.left - 40) , behavior: 'smooth' });
      }
    }
    setTimeout(function () {
      cols.forEach(function (cid) {
        $$('.col[data-col="' + cid + '"] .cell', groupsEl).forEach(function (el) {
          el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
          setTimeout(function () { el.classList.remove('pulse'); }, 3000);
        });
      });
    }, 250);
  }

  /* ---------------- global pointer / keyboard ---------------- */
  document.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (openDD && !openDD.root.contains(t)) closeDropdown();
    if (S.form.calOpen && P.cal && !P.cal.contains(t) && !(P.df && P.df.contains(t))) closeCal();
    if (S.selected && !card.contains(t) && !t.closest('.cell')) closeCard();
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (openDD) { closeDropdown(); e.preventDefault(); return; }
    if (S.form.manualEditing) { cancelManual(); e.preventDefault(); return; }
    if (S.form.calOpen) { closeCal(); if (P.df) P.df.focus(); e.preventDefault(); return; }
    if (S.selected) { var k = S.selected; closeCard(); var el = cellEl(k); if (el) el.focus(); e.preventDefault(); return; }
    if (S.panelOpen) { closePanel(false); btnAdd.focus(); e.preventDefault(); }
  });

  /* ---------------- design options bar ---------------- */
  function renderOptbar() {
    $$('#optbar .ob-group').forEach(function (g) {
      var k = g.getAttribute('data-opt');
      $$('button', g).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-val') === S.opts[k] ? 'true' : 'false'); });
    });
  }
  $$('#optbar .ob-group').forEach(function (g) {
    var k = g.getAttribute('data-opt');
    $$('button', g).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-val'); if (S.opts[k] === v) return;
        S.opts[k] = v; saveOpts(); renderOptbar();
        if (k === 'expand') {
          if (v === 'none') closeCard();
          tableEl.classList.toggle('expand-on', v === 'card');
          $$('.cell', groupsEl).forEach(function (el) {
            if (v === 'card') { el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); }
            else { el.removeAttribute('tabindex'); el.removeAttribute('role'); }
          });
        } else if (k === 'cell') {
          var sel = S.selected; closeCard();
          groupsEl.style.opacity = '0';
          setTimeout(function () {
            renderTable(); groupsEl.style.opacity = '';
            if (sel && S.opts.expand === 'card') openCard(sel);
          }, 120);
        } else if (k === 'rows') {
          if (S.panelOpen) {
            if (v === 'auto') { var f = S.form; if (rowComplete(f.rows[f.rows.length - 1])) addRow(false); }
            syncPanel();
          }
        }
      });
    });
  });
  /* ---------------- change log ---------------- */
  var logPanel = $('#logPanel'), btnLog = $('#btnLog'), logHideT = null;
  function renderLog() {
    var list = window.EF_CHANGELOG || [];
    logPanel.innerHTML = '<div class="lg-head"><span class="lg-title">יומן שינויים</span><button class="lg-x" aria-label="סגירה">✕</button></div>' +
      '<ol class="lg-list">' + list.map(function (e) {
        var other = e.by && e.by.indexOf('ראשית') < 0;
        return '<li class="lg-entry"><div class="lg-meta"><span class="lg-date">' + esc(e.date) + '</span>' +
          '<span class="lg-by' + (other ? ' other' : '') + '">' + esc(e.by || '') + '</span></div>' +
          '<ul>' + e.items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
          (e.note ? '<div class="lg-note">' + esc(e.note) + '</div>' : '') + '</li>';
      }).join('') + '</ol>';
    $('.lg-x', logPanel).addEventListener('click', function () { toggleLog(false); btnLog.focus(); });
  }
  function toggleLog(open) {
    clearTimeout(logHideT);
    btnLog.setAttribute('aria-expanded', open ? 'true' : 'false');
    btnLog.classList.toggle('on', open);
    if (open) { renderLog(); logPanel.hidden = false; requestAnimationFrame(function () { if (btnLog.classList.contains('on')) logPanel.classList.add('open'); }); }
    else { logPanel.classList.remove('open'); logHideT = setTimeout(function () { logPanel.hidden = true; }, 160); }
  }
  if (btnLog) {
    btnLog.addEventListener('click', function () { toggleLog(!btnLog.classList.contains('on')); });
    document.addEventListener('pointerdown', function (e) {
      if (btnLog.classList.contains('on') && !logPanel.contains(e.target) && !btnLog.contains(e.target)) toggleLog(false);
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btnLog.classList.contains('on')) { toggleLog(false); btnLog.focus(); e.stopImmediatePropagation(); }
    }, true);
  }

  groupsEl.style.transition = 'opacity 120ms ease-out';
  $('#btnReset').addEventListener('click', function () {
    closeCard(); closePanel(true);
    S.view = 'bars'; resetModes(); S.day = 0; S.shift = 0; S.order = D.groups.map(function (g) { return g.id; });
    S.form = freshForm(); cache = {};
    renderDate(); moveIndicator(); renderToggle(); renderTable();
    vp.scrollLeft = 0; updateScrollbar();
    toast('המצב אופס', 'info');
  });

  /* ---------------- init ---------------- */
  fit();
  renderDate();
  renderToggle();
  renderTable();
  renderOptbar();
  moveIndicator();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveIndicator(); updateScrollbar(); });
  // expose for QA in devtools only
  window.__EF = { state: S };
})();

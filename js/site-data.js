/* ericwu.co.nz — Listings & Recently Sold
 * One file used twice:
 *   1. by the daily publishing helper (scripts/build-data.js) to write the cards into the HTML,
 *      so search engines and AI crawlers can read them without running JavaScript;
 *   2. in visitors' browsers, to swap in the very latest data from the 管理后台 as soon as the page opens.
 * Both use the same render functions below, so the two versions always look identical.
 */
(function (root) {
  'use strict';

  var SB_URL = 'https://lvdmqgyrgkzywoqvmjlh.supabase.co';
  var SB_KEY = 'sb_publishable_DpiOMXxxnYckRosCz1lAgw_DUBO7EBF';
  var HOME_SOLD_COUNT = 15;

  var QUERY = {
    listings: '/rest/v1/listings?select=*&order=created_at.desc',
    sold: '/rest/v1/sold?select=*&published=eq.true&order=created_at.desc'
  };

  /* ---------- helpers ---------- */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function txt(v) { return v == null ? '' : String(v).trim(); }
  function safeUrl(v) {
    var u = txt(v);
    if (/^https?:\/\//i.test(u) || /^images\/[\w.\-\/ %]+$/i.test(u)) return u;
    return '';
  }
  function slug(v) {
    return txt(v).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function hash(list) {
    var s = JSON.stringify(list || []), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + '-' + (list ? list.length : 0);
  }
  function uniqueSuburbs(list) {
    var seen = {}, out = [];
    list.forEach(function (r) {
      var s = txt(r.suburb), k = slug(s);
      if (s && !seen[k]) { seen[k] = 1; out.push(s); }
    });
    return out;
  }
  function priceShown(r) { return !!(r.show_price && txt(r.sale_price)); }
  function schemaType(address) { return /\//.test(address) ? 'Apartment' : 'SingleFamilyResidence'; }

  /* ---------- Recently Sold: sold.html ---------- */
  function soldFeatures(features) {
    var lines = txt(features).split(/\r?\n/).map(txt).filter(Boolean);
    if (!lines.length) return '';
    return '<ul class="feature-list">' + lines.map(function (l) {
      var i = l.indexOf(':');
      if (i > 0 && i < 60) {
        return '<li><strong>' + esc(l.slice(0, i + 1)) + '</strong> ' + esc(l.slice(i + 1).trim()) + '</li>';
      }
      return '<li>' + esc(l) + '</li>';
    }).join('') + '</ul>';
  }

  function renderSoldItems(list) {
    if (!list.length) return '<p class="sold-empty">New results are on their way — check back soon.</p>';
    return list.map(function (r, i) {
      var addr = txt(r.address), sub = txt(r.suburb), img = safeUrl(r.image_url), rw = safeUrl(r.raywhite_url);
      var stats = [];
      if (priceShown(r)) stats.push(['Sale Price', r.sale_price]);
      if (txt(r.land_area)) stats.push(['Land Size', r.land_area]);
      if (txt(r.floor_area)) stats.push(['Floor Area', r.floor_area]);
      if (txt(r.over_cv)) stats.push(['Over CV', r.over_cv]);
      if (txt(r.time_on_market)) stats.push(['Time on Market', r.time_on_market]);
      return '\n        <div class="property-item" data-suburb="' + esc(slug(sub)) + '">' +
        '\n            <div class="property-img-wrap">' +
        (txt(r.badge) ? '\n                <div class="sold-badge">' + esc(r.badge) + '</div>' : '') +
        (img ? '\n                <img src="' + esc(img) + '" alt="' + esc(addr + (sub ? ', ' + sub : '') + ' – Sold by Eric Wu, Team Eric Wu Ray White') + '"' + (i > 1 ? ' loading="lazy"' : '') + '>' : '\n                <div class="property-img-placeholder"></div>') +
        '\n            </div>' +
        '\n            <div class="property-info">' +
        '\n                <h3>' + esc(addr) + '</h3>' +
        (sub ? '\n                <span class="suburb-tag">' + esc(sub) + '</span>' : '') +
        (stats.length ? '\n                <div class="stats-grid">' + stats.map(function (s) {
          return '<div class="stat-box"><span>' + esc(s[0]) + '</span><strong>' + esc(s[1]) + '</strong></div>';
        }).join('') + '</div>' : '') +
        (txt(r.summary) ? '\n                <p class="property-summary">' + esc(r.summary) + '</p>' : '') +
        (txt(r.features) ? '\n                ' + soldFeatures(r.features) : '') +
        (rw ? '\n                <a class="property-link" href="' + esc(rw) + '" target="_blank" rel="noopener">View on Ray White &rarr;</a>' : '') +
        '\n            </div>' +
        '\n        </div>';
    }).join('\n') + '\n        ';
  }

  function renderSoldFilters(list) {
    return '\n                <button class="sub-filter-btn active" onclick="filterSuburb(\'all\',this)">All Suburbs</button>' +
      uniqueSuburbs(list).map(function (s) {
        return '\n                <button class="sub-filter-btn" onclick="filterSuburb(\'' + esc(slug(s)) + '\',this)">' + esc(s) + '</button>';
      }).join('') + '\n            ';
  }

  function soldSchema(list) {
    return JSON.stringify({
      '@context': 'https://schema.org', '@type': 'ItemList',
      'name': 'Recently Sold Properties – Eric Wu, Team Eric Wu, Ray White Botany',
      'description': 'Recent property sales by Eric Wu and Team Eric Wu across East Auckland and beyond, including East Tāmaki, Dannemora, Flat Bush, Botany Downs and surrounding suburbs.',
      'numberOfItems': list.length,
      'itemListElement': list.map(function (r, i) {
        return { '@type': 'ListItem', 'position': i + 1, 'item': {
          '@type': schemaType(txt(r.address)), 'name': txt(r.address),
          'address': { '@type': 'PostalAddress', 'streetAddress': txt(r.address), 'addressLocality': txt(r.suburb), 'addressRegion': 'Auckland', 'addressCountry': 'NZ' }
        } };
      })
    });
  }

  /* ---------- Recently Sold: homepage carousel ---------- */
  function renderHomeSold(list) {
    var top = list.slice(0, HOME_SOLD_COUNT);
    if (!top.length) return '';
    return top.map(function (r) {
      var addr = txt(r.address), sub = txt(r.suburb), img = safeUrl(r.image_url);
      var size = txt(r.land_area) ? txt(r.land_area) + ' land' : (txt(r.floor_area) ? txt(r.floor_area) + ' floor' : '');
      return '\n                <a class="rs-card" href="sold.html">' +
        '<div class="rs-img">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(addr + (sub ? ', ' + sub : '') + ' – sold by Team Eric Wu, Ray White Botany') + '" loading="lazy">' : '') +
        (txt(r.badge) ? '<span class="rs-badge">' + esc(r.badge) + '</span>' : '') + '</div>' +
        '<div class="rs-body">' + (sub ? '<span class="rs-suburb">' + esc(sub) + '</span>' : '') +
        '<h3 class="rs-addr">' + esc(addr) + '</h3>' +
        '<div class="rs-meta"><span>' + (priceShown(r) ? 'Sold <strong>' + esc(r.sale_price) + '</strong>' : '<strong>SOLD</strong>') + '</span>' +
        (size ? '<span>' + esc(size) + '</span>' : '') + '</div></div></a>';
    }).join('') + '\n            ';
  }

  /* ---------- Listings: listings.html ---------- */
  function renderListings(list) {
    if (!list.length) {
      return '<div class="listings-empty"><h3>No listings at this time</h3><p>Check back soon or contact us about off-market opportunities.</p></div>';
    }
    return list.map(function (l, i) {
      var addr = txt(l.address) || 'Address on request', sub = txt(l.suburb), img = safeUrl(l.image_url), rw = safeUrl(l.raywhite_url);
      var bed = num(l.bedrooms), bath = num(l.bathrooms), car = num(l.garages), desc = txt(l.description);
      return '\n      <article class="listing-card" data-suburb="' + esc(slug(sub)) + '">' +
        '<div class="listing-img-wrap">' +
        (img ? '<img src="' + esc(img) + '" alt="' + esc(addr) + '" loading="' + (i < 4 ? 'eager' : 'lazy') + '">' : '<div class="listing-img-placeholder">🏠</div>') +
        (sub ? '<span class="suburb-badge">' + esc(sub) + '</span>' : '') +
        (txt(l.price) ? '<span class="price-badge">' + esc(l.price) + '</span>' : '') +
        '</div>' +
        '<div class="listing-body">' +
        '<h2 class="listing-address">' + esc(addr) + '</h2>' +
        '<div class="listing-suburb-text">' + esc(sub ? sub + ', Auckland' : 'Auckland') + '</div>' +
        '<div class="listing-stats">' +
        (bed ? '<div class="stat">🛏 ' + bed + ' Bed' + (bed > 1 ? 's' : '') + '</div>' : '') +
        (bath ? '<div class="stat">🚿 ' + bath + ' Bath' + (bath > 1 ? 's' : '') + '</div>' : '') +
        (car ? '<div class="stat">🚗 ' + car + ' Car' + (car > 1 ? 's' : '') + '</div>' : '') +
        '</div>' +
        (txt(l.land_area) || txt(l.building_area) ? '<div class="listing-areas">' +
          (txt(l.land_area) ? '<span>Land: ' + esc(l.land_area) + '</span>' : '') +
          (txt(l.building_area) ? '<span>Floor: ' + esc(l.building_area) + '</span>' : '') + '</div>' : '') +
        (desc ? '<p class="listing-desc">' + esc(desc.length > 160 ? desc.substring(0, 160) + '...' : desc) + '</p>' : '') +
        (rw ? '<a href="' + esc(rw) + '" target="_blank" rel="noopener noreferrer" class="listing-cta">View Full Listing &rarr;</a>' : '') +
        '</div></article>';
    }).join('') + '\n    ';
  }

  function renderListingFilters(list) {
    return '\n  <button class="filter-btn active" onclick="filterListings(\'all\',this)">All Properties</button>' +
      uniqueSuburbs(list).map(function (s) {
        return '\n  <button class="filter-btn" onclick="filterListings(\'' + esc(slug(s)) + '\',this)">' + esc(s) + '</button>';
      }).join('') + '\n';
  }

  function listingCount(list) {
    return list.length ? 'Showing <strong>' + list.length + '</strong> propert' + (list.length === 1 ? 'y' : 'ies') : '';
  }

  function listingsSchema(list) {
    return JSON.stringify({
      '@context': 'https://schema.org', '@type': 'ItemList',
      'name': 'Current Property Listings – Team Eric Wu',
      'numberOfItems': list.length,
      'itemListElement': list.map(function (l, i) {
        var item = { '@type': schemaType(txt(l.address)), 'name': txt(l.address),
          'address': { '@type': 'PostalAddress', 'streetAddress': txt(l.address), 'addressLocality': txt(l.suburb), 'addressRegion': 'Auckland', 'addressCountry': 'NZ' } };
        if (num(l.bedrooms)) item.numberOfBedrooms = num(l.bedrooms);
        if (safeUrl(l.raywhite_url)) item.url = safeUrl(l.raywhite_url);
        return { '@type': 'ListItem', 'position': i + 1, 'item': item };
      })
    });
  }

  /* Each block = an HTML region between <!-- KEY:START --> and <!-- KEY:END --> */
  function blocks(kind, list) {
    if (kind === 'sold') return {
      'SOLD-SCHEMA': '\n    <script type="application/ld+json">' + soldSchema(list) + '</script>\n    ',
      'SOLD-FILTERS': renderSoldFilters(list),
      'SOLD-LIST': renderSoldItems(list)
    };
    if (kind === 'home') return { 'HOME-SOLD': renderHomeSold(list) };
    if (kind === 'listings') return {
      'LISTINGS-SCHEMA': '\n<script type="application/ld+json">' + listingsSchema(list) + '</script>\n',
      'LISTINGS-FILTERS': renderListingFilters(list),
      'LISTINGS-COUNT': listingCount(list),
      'LISTINGS-GRID': renderListings(list)
    };
    return {};
  }

  function inject(html, key, content) {
    var re = new RegExp('(<!-- ' + key + ':START -->)[\\s\\S]*?(<!-- ' + key + ':END -->)');
    if (!re.test(html)) return null;
    return html.replace(re, function (m, a, b) { return a + content + b; });
  }

  var api = {
    SB_URL: SB_URL, SB_KEY: SB_KEY, QUERY: QUERY, HOME_SOLD_COUNT: HOME_SOLD_COUNT,
    esc: esc, slug: slug, hash: hash, blocks: blocks, inject: inject,
    renderSoldItems: renderSoldItems, renderHomeSold: renderHomeSold, renderListings: renderListings
  };

  /* ---------- browser: live refresh ---------- */
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    var tableOf = { sold: 'sold', home: 'sold', listings: 'listings' };

    function fetchTable(table) {
      return fetch(SB_URL + QUERY[table], { headers: { apikey: SB_KEY } })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) { if (!Array.isArray(d)) throw new Error('bad data'); return d; });
    }

    // Replace the content between two comment markers inside a live element
    function replaceBetween(container, key, html) {
      if (!container) return false;
      var start = null, end = null, n, it = document.createNodeIterator(container, NodeFilter.SHOW_COMMENT);
      while ((n = it.nextNode())) {
        if (n.nodeValue.trim() === key + ':START') start = n;
        else if (n.nodeValue.trim() === key + ':END') { end = n; break; }
      }
      if (!start || !end) return false;
      while (start.nextSibling && start.nextSibling !== end) start.parentNode.removeChild(start.nextSibling);
      var tpl = document.createElement('template');
      tpl.innerHTML = html;
      end.parentNode.insertBefore(tpl.content, end);
      return true;
    }

    api.refresh = function (kind, done) {
      var holder = document.querySelector('[data-sitedata="' + kind + '"]');
      if (!holder) return;
      var baked = holder.getAttribute('data-hash');
      fetchTable(tableOf[kind]).then(function (list) {
        if (kind === 'sold' && !list.length && baked) return;   // never blank the page on an empty answer
        var h = hash(list);
        if (h === baked) return;                                 // already up to date
        var b = blocks(kind, list);
        Object.keys(b).forEach(function (key) {
          if (/SCHEMA$/.test(key)) return;                       // structured data stays as published
          replaceBetween(document.body, key, b[key]);
        });
        holder.setAttribute('data-hash', h);
        if (done) done(list);
      }).catch(function () { /* keep the published version */ });
    };

    /* Homepage carousel: slow continuous flow, seamless loop. Mouse over it = slows right down (the strip is full
     * width, so a full stop on hover meant it almost never moved on computers). Finger on it / dragging = stops. */
    api.carousel = function (viewportId, trackId) {
      var vp = document.getElementById(viewportId), track = document.getElementById(trackId);
      if (!vp || !track) return;
      var state = vp._rs || (vp._rs = { pos: 0, last: 0, hover: false, touching: false, resumeAt: 0, down: false, moved: false, startX: 0, startPos: 0, setWidth: 0, n: 0, bound: false });
      Array.prototype.slice.call(track.querySelectorAll('[data-clone]')).forEach(function (c) { c.parentNode.removeChild(c); });
      var originals = Array.prototype.slice.call(track.querySelectorAll('.rs-card'));
      state.n = originals.length;
      if (!state.n) return;
      originals.forEach(function (c) {
        var k = c.cloneNode(true);
        k.setAttribute('data-clone', '1'); k.setAttribute('aria-hidden', 'true'); k.setAttribute('tabindex', '-1');
        track.appendChild(k);
      });
      function measure() {
        var cards = track.querySelectorAll('.rs-card');
        state.setWidth = cards[state.n] ? cards[state.n].offsetLeft - cards[0].offsetLeft : 0;
      }
      measure(); state.pos = 0; vp.scrollLeft = 0;
      if (state.bound) return;
      state.bound = true;
      // Keeps moving even when the computer's "animation effects" setting is off (JY's decision, 2026-10-14),
      // same as the reviews strip on the homepage.
      var SPEED = 32;
      function wrap() { if (!state.setWidth) return; if (state.pos >= state.setWidth) state.pos -= state.setWidth; if (state.pos < 0) state.pos += state.setWidth; }
      function tick(t) {
        var dt = state.last ? Math.min(t - state.last, 64) : 0; state.last = t;
        var paused = state.touching || state.down || t < state.resumeAt || document.hidden || !state.setWidth;
        if (!paused) { state.pos += SPEED * (state.hover ? 0.3 : 1) * dt / 1000; wrap(); vp.scrollLeft = state.pos; }
        else if (!state.down && state.setWidth) { state.pos = vp.scrollLeft; if (state.pos >= state.setWidth || state.pos <= 0) { wrap(); vp.scrollLeft = state.pos; } }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      window.addEventListener('resize', measure);
      window.addEventListener('load', measure);
      vp.addEventListener('mouseenter', function () { state.hover = true; });
      vp.addEventListener('mouseleave', function () { state.hover = false; state.down = false; vp.classList.remove('dragging'); });
      vp.addEventListener('touchstart', function () { state.touching = true; }, { passive: true });
      vp.addEventListener('touchend', function () { state.touching = false; state.resumeAt = performance.now() + 2500; }, { passive: true });
      vp.addEventListener('mousedown', function (e) { state.down = true; state.moved = false; state.startX = e.pageX; state.startPos = vp.scrollLeft; vp.classList.add('dragging'); e.preventDefault(); });
      window.addEventListener('mouseup', function () { if (state.down) { state.down = false; vp.classList.remove('dragging'); state.pos = vp.scrollLeft; } });
      vp.addEventListener('mousemove', function (e) {
        if (!state.down) return;
        var dx = e.pageX - state.startX; if (Math.abs(dx) > 4) state.moved = true;
        state.pos = state.startPos - dx; wrap(); vp.scrollLeft = state.pos;
      });
      vp.addEventListener('click', function (e) { if (state.moved) { e.preventDefault(); state.moved = false; } }, true);
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SiteData = api;
})(typeof window !== 'undefined' ? window : this);

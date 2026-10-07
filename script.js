/* ==========================================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   ตรวจจับหน้าจาก element ที่มีอยู่ ไม่ผูกกับชื่อไฟล์
     - product.html : #filter-bar, #product-list
     - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
     - admin.html   : #ordersTable tbody
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Config
     ------------------------------------------------------------------------ */
  var PRODUCTS_URL = 'products.json';

  var ORDER_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbzbZ3LMrv0uk3kk82EN9OEqindURXMrAeQJ9-zvS8JsCXp1h_ktrgi6T8FThO7VG1JmzA/exec';

  var ORDERS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vR5jILiLfXjn9Wmohlvdb6gFpWSZwYJwggTRvDWwxBh3zquafJ2ijjpMNSRmMILkfYoUTXeHwtnRfO3/pub?gid=0&single=true&output=csv';

  var MOODS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' }
  ];

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */

  // สร้าง element โดยใช้ textContent เสมอ (กัน XSS จากข้อมูลที่ผู้ใช้กรอก)
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n.toLocaleString('th-TH') : String(value);
  }

  function moodLabel(key) {
    for (var i = 0; i < MOODS.length; i++) {
      if (MOODS[i].key === key) return MOODS[i].label;
    }
    return key;
  }

  /* ========================================================================
     1) หน้า product.html
     ======================================================================== */

  function initProductPage() {
    var filterBar = document.getElementById('filter-bar');
    var list = document.getElementById('product-list');
    if (!filterBar || !list) return;

    list.textContent = 'กำลังโหลดสินค้า...';

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (products) {
        list.textContent = '';
        products.forEach(function (p) {
          list.appendChild(buildProductCard(p));
        });

        buildFilterBar(filterBar, list);

        // กรองอัตโนมัติจาก ?mood=xxx
        var param = new URLSearchParams(window.location.search).get('mood');
        var initial = (param || 'all').toLowerCase();
        applyFilter(filterBar, list, isValidMood(initial) ? initial : 'all', false);
      })
      .catch(function (error) {
        console.error(error);
        list.textContent = 'ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง';
      });
  }

  function isValidMood(key) {
    return MOODS.some(function (m) { return m.key === key; });
  }

  function buildProductCard(p) {
    var card = el('article', 'product-card');
    card.setAttribute('data-mood', p.mood);
    card.setAttribute('data-type', p.type);

    // รูป
    var media = el('div', 'product-card__media');
    var img = document.createElement('img');
    img.src = p.image;
    img.alt = p.name;
    img.loading = 'lazy';
    img.addEventListener('error', function () { img.style.visibility = 'hidden'; });
    media.appendChild(img);

    // เนื้อหา
    var body = el('div', 'product-card__body');
    body.appendChild(el('div', 'product-card__mood', moodLabel(p.mood)));
    body.appendChild(el('h3', 'product-card__name', p.name));
    if (p.description) body.appendChild(el('p', 'product-card__desc', p.description));

    // ไซส์ + ราคา (โรลออนไม่มี size ใน JSON จึงแสดงเป็น "โรลออน")
    var meta = el('div', 'product-card__meta');
    meta.appendChild(el('span', 'product-card__size', p.size || 'โรลออน'));
    var price = el('span', 'product-card__price', formatNumber(p.price));
    price.appendChild(el('small', null, 'บาท'));
    meta.appendChild(price);
    body.appendChild(meta);

    // ปุ่มสั่งซื้อ -> order.html?item=...&price=...
    var itemName = p.size ? p.name + ' ' + p.size : p.name;
    var query = new URLSearchParams({ item: itemName, price: String(p.price) });
    var buy = el('a', 'btn btn--gold btn--block', 'สั่งซื้อ');
    buy.href = 'order.html?' + query.toString();
    body.appendChild(buy);

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function buildFilterBar(bar, list) {
    bar.textContent = '';
    bar.classList.add('filters');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'กรองตามกลิ่น');

    MOODS.forEach(function (m) {
      var btn = el('button', 'filter' + (m.key === 'all' ? ' filter--all' : ''), m.label);
      btn.type = 'button';
      btn.setAttribute('data-filter', m.key);
      if (m.key !== 'all') btn.setAttribute('data-mood', m.key); // ให้ CSS ใส่จุดสี mood
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', function () {
        applyFilter(bar, list, m.key, true);
      });
      bar.appendChild(btn);
    });
  }

  function applyFilter(bar, list, mood, updateUrl) {
    var buttons = bar.querySelectorAll('[data-filter]');
    Array.prototype.forEach.call(buttons, function (btn) {
      var active = btn.getAttribute('data-filter') === mood;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.classList.toggle('is-active', active);
    });

    var cards = list.querySelectorAll('.product-card');
    Array.prototype.forEach.call(cards, function (card) {
      card.hidden = !(mood === 'all' || card.getAttribute('data-mood') === mood);
    });

    if (updateUrl) {
      try {
        var url = new URL(window.location.href);
        if (mood === 'all') url.searchParams.delete('mood');
        else url.searchParams.set('mood', mood);
        window.history.replaceState(null, '', url.toString());
      } catch (e) { /* ไม่สำคัญ */ }
    }
  }

  /* ========================================================================
     2) หน้า order.html
     ======================================================================== */

  function initOrderPage() {
    var form = document.getElementById('orderForm');
    if (!form) return;

    // เติมค่าจาก URL parameter ลงทั้งช่อง items และ total
    var params = new URLSearchParams(window.location.search);
    var itemField = document.getElementById('items');
    var totalField = document.getElementById('total');
    var item = params.get('item');
    var price = params.get('price');

    if (itemField && item !== null) itemField.value = item;
    if (totalField && price !== null) totalField.value = price;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

      var payload = {
        customerName: valueOf('customerName'),
        contact: valueOf('contact'),
        items: valueOf('items'),
        total: valueOf('total'),
        note: valueOf('note')
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true; // กันกดซ้ำ

      fetch(ORDER_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(() => { window.location.href = 'thankyou.html'; })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  function valueOf(id) {
    var node = document.getElementById(id);
    return node ? node.value.trim() : '';
  }

  /* ========================================================================
     3) หน้า admin.html
     ======================================================================== */

  function initAdminPage() {
    var tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    var COLS = 6;
    showMessageRow(tbody, COLS, 'กำลังโหลดรายการสั่งซื้อ...');

    // ต่อ timestamp ท้าย URL กัน browser cache
    var url = ORDERS_CSV_URL + '&_=' + Date.now();

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text).filter(function (r) {
          return r.some(function (cell) { return cell.trim() !== ''; });
        });

        // ข้ามแถวหัวตาราง (ถ้าคอลัมน์แรกไม่ใช่วันที่)
        if (rows.length && !looksLikeDate(rows[0][0])) rows.shift();

        rows = sortLatestFirst(rows);

        if (!rows.length) {
          showMessageRow(tbody, COLS, 'ยังไม่มีรายการสั่งซื้อ');
          return;
        }

        tbody.textContent = '';
        rows.forEach(function (r) {
          var tr = document.createElement('tr');
          // ลำดับคอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
          tr.appendChild(el('td', null, formatDateCell(r[0])));
          tr.appendChild(el('td', null, r[1] || ''));
          tr.appendChild(el('td', null, r[2] || ''));
          tr.appendChild(el('td', null, r[3] || ''));
          tr.appendChild(el('td', null, formatTotalCell(r[4])));
          tr.appendChild(el('td', null, r[5] || ''));
          tbody.appendChild(tr);
        });
      })
      .catch(function (error) {
        console.error(error);
        showMessageRow(tbody, COLS, 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      });
  }

  function showMessageRow(tbody, colspan, message) {
    tbody.textContent = '';
    var tr = document.createElement('tr');
    var td = el('td', null, message);
    td.colSpan = colspan;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  /* ---- CSV parser (ไม่ใช้ library) -----------------------------------------
     รองรับ: ช่องที่ครอบด้วย "...", "" แทนเครื่องหมายคำพูด,
     ขึ้นบรรทัดใหม่/คอมมาในช่องที่ครอบด้วยเครื่องหมายคำพูด, CRLF/LF, BOM
     ------------------------------------------------------------------------ */
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // ตัด BOM

    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }  // "" -> "
          else inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;    // CRLF
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }

    // แถวสุดท้ายที่ไม่มี newline ปิดท้าย
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  /* ---- วันที่ / การเรียงลำดับ ---------------------------------------------- */

  function looksLikeDate(value) {
    if (!value) return false;
    // ISO (2026-10-07...) หรือรูปแบบ d/m/y, m/d/y ที่ขึ้นต้นด้วยตัวเลข
    return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/.test(value);
  }

  function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}/.test(value || '') && !isNaN(Date.parse(value));
  }

  // เรียงล่าสุดก่อน:
  //  - ถ้าทุกแถวเป็นวันที่แบบ ISO (ไม่กำกวม) -> เรียงตามเวลาจริง
  //  - ถ้าไม่ใช่ (เช่น 7/10/2026 ที่ d/m หรือ m/d ขึ้นกับ locale ของชีต)
  //    -> กลับลำดับแถวของชีต เพราะข้อมูลถูกเพิ่มต่อท้ายตามเวลาเสมอ
  function sortLatestFirst(rows) {
    var allIso = rows.length > 0 && rows.every(function (r) { return isIsoDate(r[0]); });
    if (allIso) {
      return rows.slice().sort(function (a, b) {
        return Date.parse(b[0]) - Date.parse(a[0]);
      });
    }
    return rows.slice().reverse();
  }

  function formatDateCell(value) {
    if (isIsoDate(value)) {
      return new Date(value).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    }
    return value || ''; // รูปแบบอื่นแสดงตามที่ชีตให้มา
  }

  function formatTotalCell(value) {
    if (value === undefined || value === '') return '';
    var cleaned = String(value).replace(/,/g, '').trim();
    return cleaned !== '' && isFinite(Number(cleaned))
      ? formatNumber(cleaned) + ' บาท'
      : value;
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

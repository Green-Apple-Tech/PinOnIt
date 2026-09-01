// Paste this entire file into Apps Script, then Save.
// Deploy: Manage deployments, web app, New version (Execute as Me, Anyone).
// Reload the spreadsheet, then use menu Scout2 -> Split into 5 tabs.
const SECRET = 'REPLACE_ME';
const VERSION = 2;
const OLD_TAB = 'Scout2 Leads';
const TABS = ['Calendly users', 'Emails and phones', 'Emails', 'Phones', 'Blanks'];
const CHUNK = 400;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Scout2')
    .addItem('Split into 5 tabs', 'menuSplitIntoFiveTabs')
    .addToUi();
}

function menuSplitIntoFiveTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const headers = sheetHeaders_();
  const counts = splitWithOverlay_(ss, headers, []);
  const lines = TABS.map(function (t) { return t + ': ' + counts[t]; });
  SpreadsheetApp.getUi().alert('Split complete\n\n' + lines.join('\n'));
}

function doPost(e) {
  const out = ContentService.createTextOutput;
  const json = function (obj) {
    return out(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  };
  try {
    const body = JSON.parse(e.postData.contents);
    if (!body || body.secret !== SECRET) {
      return json({ ok: false, error: 'denied' });
    }
    if (body.ping) {
      return json({ ok: true, version: VERSION });
    }
    const headers = body.headers && body.headers.length ? body.headers : sheetHeaders_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mode = body.mode || '';
    if (mode === 'split_existing' || mode === 'reorganize') {
      const overlay = body.rows || [];
      const counts = splitWithOverlay_(ss, headers, overlay);
      var total = 0;
      TABS.forEach(function (t) { total += counts[t]; });
      return json({ ok: true, version: VERSION, mode: mode, tabs: counts, total: total });
    }
    const items = normalizeItems_(headers, body);
    const result = upsertItems_(ss, headers, items);
    return json({
      ok: true,
      version: VERSION,
      mode: 'upsert',
      updated: result.updated,
      appended: result.appended,
      tabs: result.tabs,
      total: items.length,
    });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function sheetHeaders_() {
  return [
    'domain', 'email', 'email_rank', 'niche', 'employees_bucket', 'practice_type',
    'scheduler_name', 'booking_url', 'calendly_url', 'email_provider', 'zoom_links',
    'teams_links', 'phone_only', 'lead_score', 'segment', 'source', 'phone', 'city',
    'state', 'category', 'calendly_detected', 'mx_valid', 'status', 'created_at', 'updated_at',
  ];
}

function filled_(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  const low = s.toLowerCase();
  return low !== 'false' && low !== 'none' && low !== 'null' && low !== 'n/a' && low !== '-' && low !== 'no';
}

function isCalendly_(obj) {
  const det = obj.calendly_detected;
  if (det === true) return true;
  const d = String(det || '').trim().toLowerCase();
  if (d === 'yes' || d === 'true' || d === '1') return true;
  if (String(obj.scheduler_name || '').trim().toLowerCase() === 'calendly') return true;
  const url = String(obj.calendly_url || '') + ' ' + String(obj.booking_url || '');
  return url.toLowerCase().indexOf('calendly.com') !== -1;
}

function sheetBucket_(obj) {
  if (isCalendly_(obj)) return 'Calendly users';
  const em = filled_(obj.email);
  const ph = filled_(obj.phone);
  if (em && ph) return 'Emails and phones';
  if (em) return 'Emails';
  if (ph) return 'Phones';
  return 'Blanks';
}

function rowObject_(headers, values) {
  const o = {};
  for (var i = 0; i < headers.length; i++) {
    o[headers[i]] = values[i];
  }
  return o;
}

function valuesFromRecord_(headers, rec) {
  return headers.map(function (h) {
    const v = rec[h];
    return v == null ? '' : v;
  });
}

function recordsFromSheet_(sh) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const data = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const hdrs = data[0].map(function (h) { return String(h || '').trim(); });
  const out = [];
  for (var i = 1; i < data.length; i++) {
    const rec = {};
    for (var c = 0; c < hdrs.length; c++) {
      if (hdrs[c]) rec[hdrs[c]] = data[i][c];
    }
    const note = String(rec.domain || '').trim();
    if (!note || note.toLowerCase() === 'moved') continue;
    out.push(rec);
  }
  return out;
}

function ensureSize_(sh, rows, cols) {
  const needRows = rows + 10;
  const needCols = cols + 2;
  if (sh.getMaxRows() < needRows) {
    sh.insertRowsAfter(sh.getMaxRows(), needRows - sh.getMaxRows());
  }
  if (sh.getMaxColumns() < needCols) {
    sh.insertColumnsAfter(sh.getMaxColumns(), needCols - sh.getMaxColumns());
  }
}

function sheetByName_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  ensureSize_(sh, Math.max(sh.getMaxRows(), 2000), headers.length);
  const a1 = String(sh.getRange(1, 1).getValue() || '').trim().toLowerCase();
  if (a1 !== 'domain') {
    if (a1) sh.insertRowBefore(1);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

function rewriteTab_(ss, name, headers, rows) {
  const sh = sheetByName_(ss, name, headers);
  const last = Math.max(sh.getLastRow(), 1);
  if (last > 1) {
    sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), headers.length)).clearContent();
  }
  ensureSize_(sh, rows.length + 5, headers.length);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  for (var i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    sh.getRange(2 + i, 1, part.length, headers.length).setValues(part);
  }
}

function splitWithOverlay_(ss, headers, overlayRows) {
  const map = {};
  const names = [OLD_TAB].concat(TABS);
  names.forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    recordsFromSheet_(sh).forEach(function (rec) {
      const d = String(rec.domain || '').trim().toLowerCase();
      if (d) map[d] = rec;
    });
  });
  (overlayRows || []).forEach(function (values) {
    const d = String(values[0] || '').trim().toLowerCase();
    if (!d) return;
    map[d] = rowObject_(headers, values);
  });
  const buckets = {};
  TABS.forEach(function (t) { buckets[t] = []; });
  Object.keys(map).forEach(function (d) {
    const rec = map[d];
    rec.domain = d;
    buckets[sheetBucket_(rec)].push(valuesFromRecord_(headers, rec));
  });
  TABS.forEach(function (t) {
    rewriteTab_(ss, t, headers, buckets[t]);
  });
  const mixed = Object.keys(map).map(function (d) {
    return valuesFromRecord_(headers, map[d]);
  });
  rewriteTab_(ss, OLD_TAB, headers, mixed);
  const counts = {};
  TABS.forEach(function (t) { counts[t] = buckets[t].length; });
  counts[OLD_TAB] = mixed.length;
  return counts;
}

function normalizeItems_(headers, body) {
  if (body.items && body.items.length) {
    return body.items.map(function (it) {
      const values = it.values || it;
      const obj = rowObject_(headers, values);
      return { tab: it.tab || sheetBucket_(obj), values: values };
    });
  }
  return (body.rows || []).map(function (values) {
    return { tab: sheetBucket_(rowObject_(headers, values)), values: values };
  });
}

function upsertItems_(ss, headers, items) {
  const domains = {};
  items.forEach(function (it) {
    const values = it.values;
    const domain = String(values[0] || '').trim().toLowerCase();
    if (!domain) return;
    domains[domain] = { tab: it.tab, values: values };
  });
  TABS.forEach(function (t) {
    sheetByName_(ss, t, headers);
  });
  TABS.forEach(function (t) {
    const sh = ss.getSheetByName(t);
    const last = sh.getLastRow();
    if (last < 2) return;
    const colA = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = colA.length - 1; i >= 0; i--) {
      const d = String(colA[i][0] || '').trim().toLowerCase();
      if (domains[d]) sh.deleteRow(i + 2);
    }
  });
  const tabs = {};
  TABS.forEach(function (t) { tabs[t] = 0; });
  var appended = 0;
  TABS.forEach(function (t) {
    const rows = [];
    Object.keys(domains).forEach(function (d) {
      if (domains[d].tab === t) rows.push(domains[d].values);
    });
    if (!rows.length) return;
    const sh = ss.getSheetByName(t);
    ensureSize_(sh, sh.getLastRow() + rows.length, headers.length);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    tabs[t] = rows.length;
    appended += rows.length;
  });
  return { updated: 0, appended: appended, tabs: tabs };
}

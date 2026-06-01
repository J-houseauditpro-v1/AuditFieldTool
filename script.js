// ============================================================
// AUDIT FIELD TOOL v3 — COMPLETE REWRITE
// ============================================================

// ── STATE ────────────────────────────────────────────────────
var S = {
  name: '', address: '', date: '', year: '', sqft: '', coop: '',
  dump: '',
  photos: [],       // [{id, dataUrl, note, ts}]
  auditId: null,
  tcSignature: null
};

// ── STORAGE ──────────────────────────────────────────────────
function load() {
  try {
    var d = localStorage.getItem('aft_current');
    if (d) Object.assign(S, JSON.parse(d));
  } catch(e) {}
}
function save() {
  try { localStorage.setItem('aft_current', JSON.stringify(S)); } catch(e) {}
}
function getSaved() {
  try { return JSON.parse(localStorage.getItem('aft_saved') || '[]'); } catch(e) { return []; }
}
function setSaved(arr) {
  try { localStorage.setItem('aft_saved', JSON.stringify(arr)); } catch(e) {}
}

// ── TOAST ────────────────────────────────────────────────────
var toastTimer;
function toast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { el.style.display = 'none'; }, 2500);
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  load();
  fillFields();
  renderHeader();
  renderVoiceDump();
  renderPhotoList();
  renderAuditsList();
  // Weekly batches render on tab open
  renderCurrentAuditLabel();
  initTabs();
  initCustomerFields();
  initCheatsheet();
  initVoice();
  initPhotoInput();
  initModal();
  initAuditsTab();
  initExportTab();
  var btnResetVoice = document.getElementById('btn-reset-voice');
  if (btnResetVoice) {
    btnResetVoice.addEventListener('click', function() {
      if (confirm('Reset current audit? Export first — this cannot be undone.')) clearCurrent();
    });
  }
  initTCTab();
  renderTCInfo();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
});

// ── TABS ─────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.tabpanel').forEach(function(p) { p.style.display = 'none'; });
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
      if (btn.dataset.tab === 'export') renderWeeklyBatches();
      if (btn.dataset.tab === 'tc') renderTCInfo();
      if (btn.dataset.tab === 'audits') { renderAuditsList(); renderCurrentAuditLabel(); }
    });
  });
}

// ── CUSTOMER FIELDS ───────────────────────────────────────────
var fieldMap = [
  ['f-name','name'], ['f-address','address'], ['f-date','date'],
  ['f-year','year'], ['f-sqft','sqft'], ['f-coop','coop']
];

function fillFields() {
  fieldMap.forEach(function(pair) {
    var el = document.getElementById(pair[0]);
    if (el) el.value = S[pair[1]] || '';
  });
}

function initCustomerFields() {
  fieldMap.forEach(function(pair) {
    var el = document.getElementById(pair[0]);
    if (!el) return;
    el.addEventListener('input', function() {
      S[pair[1]] = el.value;
      save();
      renderHeader();
    });
    el.addEventListener('change', function() {
      S[pair[1]] = el.value;
      save();
      renderHeader();
    });
  });
}

function renderHeader() {
  var el = document.getElementById('header-sub');
  el.textContent = S.name ? S.name + (S.address ? ' — ' + S.address : '') : 'No customer loaded';
}

// ── CHEAT SHEET ───────────────────────────────────────────────
function initCheatsheet() {
  document.getElementById('cheat-toggle').addEventListener('click', function() {
    var body = document.getElementById('cheat-body');
    var arrow = document.getElementById('cheat-arrow');
    var open = body.classList.toggle('open');
    arrow.textContent = open ? '▲' : '▼';
  });
}

// ── VOICE RECORDING ───────────────────────────────────────────
var rec = null;
var recActive = false;

function initVoice() {
  var btn = document.getElementById('record-btn');
  var label = document.getElementById('record-label');
  var status = document.getElementById('record-status');
  var dumpEl = document.getElementById('voice-dump');

  dumpEl.addEventListener('input', function() { S.dump = dumpEl.value; save(); });

  document.getElementById('voice-clear-btn').addEventListener('click', function() {
    if (!S.dump) return;
    if (confirm('Clear the entire voice dump? This cannot be undone.')) {
      S.dump = ''; dumpEl.value = ''; save();
    }
  });

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    status.textContent = 'Voice recording not supported — type notes manually.';
    btn.disabled = true; btn.style.opacity = '0.4';
    return;
  }

  btn.addEventListener('click', function() {
    recActive ? stopRec() : startRec();
  });

  function startRec() {
    rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = function() {
      recActive = true;
      btn.classList.add('recording');
      label.textContent = 'Tap to Pause';
      status.textContent = '🔴 Recording — speak your notes';
    };

    rec.onresult = function(e) {
      var final = '', interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      if (final) { S.dump += final; save(); }
      dumpEl.value = S.dump + interim;
      dumpEl.scrollTop = dumpEl.scrollHeight;
    };

    rec.onerror = function(e) {
      if (e.error !== 'aborted') status.textContent = 'Error: ' + e.error;
      stopRec();
    };

    rec.onend = function() {
      if (recActive) { try { rec.start(); } catch(e) {} }
    };

    try { rec.start(); } catch(e) { status.textContent = 'Cannot start: ' + e.message; }
  }

  function stopRec() {
    recActive = false;
    if (rec) { try { rec.stop(); } catch(e) {} rec = null; }
    btn.classList.remove('recording');
    label.textContent = 'Tap to Record';
    status.textContent = 'Paused — tap to continue';
    dumpEl.value = S.dump;
    save();
  }
}

function renderVoiceDump() {
  var el = document.getElementById('voice-dump');
  if (el) el.value = S.dump;
}

// ── PHOTOS ────────────────────────────────────────────────────
function compressImage(dataUrl, callback) {
  var img = new Image();
  img.onload = function() {
    var maxWidth = 1200;
    var quality = 0.75;
    var w = img.width;
    var h = img.height;

    if (w > maxWidth) {
      h = Math.round(h * maxWidth / w);
      w = maxWidth;
    }

    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    callback(canvas.toDataURL('image/jpeg', quality));
  };
  img.onerror = function() { callback(dataUrl); };
  img.src = dataUrl;
}

function initPhotoInput() {
  document.getElementById('photo-input').addEventListener('change', function(e) {
    var files = Array.from(e.target.files);
    var room = 33 - S.photos.length;
    if (files.length > room) { alert('Only ' + room + ' more photos allowed (33 max).'); files = files.slice(0, room); }
    var count = 0;
    files.forEach(function(f) {
      var r = new FileReader();
      r.onload = function(ev) {
        compressImage(ev.target.result, function(compressed) {
          S.photos.push({ id: Date.now() + Math.random(), dataUrl: compressed, note: '', ts: new Date().toISOString() });
          count++;
          if (count === files.length) { save(); renderPhotoList(); }
        });
      };
      r.readAsDataURL(f);
    });
    e.target.value = '';
  });
}

function renderPhotoList() {
  var list = document.getElementById('photo-list');
  var countEl = document.getElementById('photo-count');
  var warnEl = document.getElementById('photo-warn');
  var n = S.photos.length;

  countEl.textContent = n + ' / 33 photos';
  countEl.className = 'photo-count-display' + (n >= 30 ? ' danger' : n >= 25 ? ' warn' : '');
  warnEl.style.display = n >= 25 ? 'block' : 'none';

  if (!n) {
    list.innerHTML = '<div class="empty-msg">No photos yet — tap Add Photo</div>';
    return;
  }

  list.innerHTML = '';
  S.photos.forEach(function(p, i) {
    var card = document.createElement('div');
    card.className = 'photo-card';
    var t = new Date(p.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    card.innerHTML =
      '<img src="' + p.dataUrl + '" loading="lazy" alt="Photo ' + (i+1) + '">' +
      '<div class="photo-card-body">' +
        '<div class="photo-card-meta">Photo ' + (i+1) + ' · ' + t + '</div>' +
        '<div class="photo-card-note' + (p.note ? '' : ' empty') + '">' + (p.note || 'No note — tap Edit to add') + '</div>' +
        '<div class="photo-card-actions">' +
          '<button class="btn-sm edit-photo-btn" data-id="' + p.id + '">✏️ Edit Note</button>' +
          '<button class="btn-danger-sm del-photo-btn" data-id="' + p.id + '">🗑 Delete</button>' +
        '</div>' +
      '</div>';
    list.appendChild(card);
  });

  list.querySelectorAll('.edit-photo-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { openModal(parseFloat(btn.dataset.id)); });
  });
  list.querySelectorAll('.del-photo-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (confirm('Delete this photo?')) {
        S.photos = S.photos.filter(function(p) { return p.id !== parseFloat(btn.dataset.id); });
        save(); renderPhotoList();
      }
    });
  });
}

// ── PHOTO MODAL ───────────────────────────────────────────────
var modalPhotoId = null;
var noteRec = null;
var noteRecActive = false;

function stopNoteRec() {
  noteRecActive = false;
  if (noteRec) { try { noteRec.stop(); } catch(e) {} noteRec = null; }
  var voiceBtn = document.getElementById('note-voice-btn');
  if (voiceBtn) {
    voiceBtn.classList.remove('listening');
    voiceBtn.textContent = '🎙 Tap to Voice Note';
  }
}

function initModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);

  document.getElementById('modal-save').addEventListener('click', function() {
    if (modalPhotoId !== null) {
      var p = S.photos.find(function(x) { return x.id === modalPhotoId; });
      if (p) { p.note = document.getElementById('modal-note').value; save(); renderPhotoList(); }
    }
    closeModal();
  });

  document.getElementById('modal-delete').addEventListener('click', function() {
    if (modalPhotoId !== null && confirm('Delete this photo?')) {
      S.photos = S.photos.filter(function(p) { return p.id !== modalPhotoId; });
      save(); renderPhotoList(); closeModal();
    }
  });

  var voiceBtn = document.getElementById('note-voice-btn');
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { voiceBtn.textContent = '🎙 Voice not supported'; voiceBtn.disabled = true; return; }

  voiceBtn.addEventListener('click', function() {
    noteRecActive ? stopNoteRec() : startNoteRec();
  });

  function startNoteRec() {
    noteRec = new SR();
    noteRec.continuous = true;
    noteRec.interimResults = false;
    noteRec.lang = 'en-US';
    noteRec.onstart = function() {
      noteRecActive = true;
      voiceBtn.classList.add('listening');
      voiceBtn.textContent = '⏹ Tap to Stop Recording';
    };
    noteRec.onresult = function(e) {
      var noteEl = document.getElementById('modal-note');
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          noteEl.value += (noteEl.value ? ' ' : '') + e.results[i][0].transcript;
        }
      }
    };
    noteRec.onerror = function() { stopNoteRec(); };
    noteRec.onend = function() { stopNoteRec(); };
    try { noteRec.start(); } catch(e) { toast('Cannot start voice'); }
  }
}

function openModal(id) {
  var p = S.photos.find(function(x) { return x.id === id; });
  if (!p) return;
  modalPhotoId = id;
  document.getElementById('modal-img').src = p.dataUrl;
  document.getElementById('modal-note').value = p.note || '';
  document.getElementById('photo-modal').style.display = 'flex';
}

function closeModal() {
  stopNoteRec();
  document.getElementById('photo-modal').style.display = 'none';
  modalPhotoId = null;
}

// ── AUDITS TAB ────────────────────────────────────────────────
function initAuditsTab() {
  document.getElementById('save-btn').addEventListener('click', saveAudit);
  var newBtn = document.getElementById('new-btn');
  if (newBtn) newBtn.addEventListener('click', function() {
    if (!S.name && !S.dump && !S.photos.length) { toast('Nothing to save — add info first'); return; }
    if (confirm('Save current audit and start a fresh one?')) { saveAudit(); clearCurrent(); }
  });
}

function saveAudit() {
  if (!S.name && !S.dump && !S.photos.length) { toast('Nothing to save'); return; }
  var id = S.auditId || ('audit-' + Date.now());
  S.auditId = id;
  var saved = getSaved();
  saveTCSignature();
  var rec = {
    id: id,
    customer: { name: S.name, address: S.address, date: S.date, yearBuilt: S.year, sqFt: S.sqft, coop: S.coop },
    tcSignature: S.tcSignature || null,
    voiceDump: S.dump,
    photos: S.photos.slice(),
    savedAt: new Date().toISOString(),
    source: 'AuditFieldTool'
  };
  var idx = saved.findIndex(function(a) { return a.id === id; });
  if (idx >= 0) saved[idx] = rec; else saved.unshift(rec);
  setSaved(saved);
  save();
  renderAuditsList();
  renderCurrentAuditLabel();
  toast('Saved: ' + (S.name || 'Unnamed audit'));
}

function clearCurrent() {
  S.name = ''; S.address = ''; S.date = ''; S.year = ''; S.sqft = ''; S.coop = '';
  S.dump = ''; S.photos = []; S.auditId = null; S.tcSignature = null;
  save();
  fillFields();
  renderHeader();
  renderVoiceDump();
  renderPhotoList();
  renderCurrentAuditLabel();
  renderExportSummary();
  toast('New audit started');
}

function loadAudit(id) {
  var saved = getSaved();
  var rec = saved.find(function(a) { return a.id === id; });
  if (!rec) return;
  S.name = rec.customer.name || '';
  S.address = rec.customer.address || '';
  S.date = rec.customer.date || '';
  S.year = rec.customer.yearBuilt || '';
  S.sqft = rec.customer.sqFt || '';
  S.coop = rec.customer.coop || '';
  S.dump = rec.voiceDump || '';
  S.photos = rec.photos || [];
  S.auditId = rec.id;
  S.tcSignature = rec.tcSignature || null;
  save();
  fillFields();
  renderHeader();
  renderVoiceDump();
  renderPhotoList();
  renderCurrentAuditLabel();
  document.querySelectorAll('.tab').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tabpanel').forEach(function(p) { p.style.display = 'none'; });
  document.querySelector('[data-tab="voice"]').classList.add('active');
  document.getElementById('tab-voice').style.display = 'block';
  toast('Loaded: ' + (S.name || 'audit'));
}

function deleteAudit(id) {
  setSaved(getSaved().filter(function(a) { return a.id !== id; }));
  if (S.auditId === id) { S.auditId = null; save(); }
  renderAuditsList();
  toast('Audit deleted');
}

function renderCurrentAuditLabel() {
  var el = document.getElementById('current-audit-label');
  if (!el) return;
  el.textContent = S.name ? S.name + (S.address ? ' — ' + S.address : '') : 'Fill in customer info on the Voice tab';
}

function renderAuditsList() {
  var list = document.getElementById('audits-list');
  var saved = getSaved();
  if (!saved.length) { list.innerHTML = '<div class="empty-msg">No saved audits yet</div>'; return; }
  list.innerHTML = '';
  saved.forEach(function(a) {
    var card = document.createElement('div');
    card.className = 'audit-card' + (a.id === S.auditId ? ' is-current' : '');
    var when = new Date(a.savedAt).toLocaleDateString();
    var words = (a.voiceDump || '').trim().split(/\s+/).filter(Boolean).length;
    var photos = (a.photos || []).length;
    card.innerHTML =
      '<div class="audit-name">' + (a.customer.name || 'Unnamed') + (a.id === S.auditId ? ' <span style="color:var(--gold);font-size:0.75rem;">(current)</span>' : '') + '</div>' +
      '<div class="audit-meta">' + (a.customer.address || 'No address') + '<br>' + when + ' · ' + words + ' words · ' + photos + ' photos</div>' +
      '<div class="audit-actions">' +
        '<button class="btn-sm load-btn" data-id="' + a.id + '">↩ Load</button>' +
        '<button class="btn-danger-sm del-btn" data-id="' + a.id + '">🗑 Delete</button>' +
      '</div>';
    list.appendChild(card);
  });
  list.querySelectorAll('.load-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { loadAudit(btn.dataset.id); });
  });
  list.querySelectorAll('.del-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (confirm('Delete this saved audit?')) deleteAudit(btn.dataset.id);
    });
  });
}

// ── EXPORT TAB ────────────────────────────────────────────────
function initExportTab() {
  var btnReset = document.getElementById('btn-reset');
  if (btnReset) btnReset.addEventListener('click', function() {
    if (confirm('Reset current audit? Export first — this cannot be undone.')) clearCurrent();
  });
}

function renderExportSummary() {
  // No longer used — export tab uses weekly batch view
}

function buildRecord() {
  var id = S.auditId || ('audit-' + Date.now());
  S.auditId = id; save();
  return {
    id: id,
    customer: {
      name: S.name,
      address: S.address,
      date: S.date,
      yearBuilt: S.year,
      sqFt: S.sqft,
      coop: S.coop
    },
    voiceDump: S.dump,
    exportedAt: new Date().toISOString(),
    source: 'AuditFieldTool'
  };
}

function exportCurrent() {
  if (!S.name && !S.dump && !S.photos.length) { toast('Nothing to export — add data first'); return; }
  var rec = buildRecord();
  var name = (S.name || 'audit').replace(/[^a-zA-Z0-9]/g,'-');
  var date = S.date || new Date().toISOString().split('T')[0];
  dlJSON(rec, date + '_' + name + '.json');
  toast('Exported: ' + name);
}

function exportSavedAudit(id) {
  var saved = getSaved();
  var audit = saved.find(function(a) { return a.id === id; });
  if (!audit) { toast('Not found'); return; }

  // Export only what Jarvis needs — no photos or signature
  var lean = {
    id: audit.id,
    customer: audit.customer,
    voiceDump: audit.voiceDump,
    exportedAt: new Date().toISOString(),
    source: 'AuditFieldTool'
  };

  var name = (audit.customer.name || 'audit').replace(/[^a-zA-Z0-9]/g, '-');
  var date = audit.customer.date || new Date().toISOString().split('T')[0];
  dlJSON(lean, date + '_' + name + '.json');
  toast('Exported: ' + name);
}

function exportAll() {
  var saved = getSaved();
  if (!saved.length) { toast('No saved audits to export'); return; }

  var leanAudits = saved.map(function(a) {
    return {
      id: a.id,
      customer: a.customer,
      voiceDump: a.voiceDump,
      exportedAt: new Date().toISOString(),
      source: 'AuditFieldTool'
    };
  });

  var bundle = {
    exportedAt: new Date().toISOString(),
    source: 'AuditFieldTool',
    auditCount: leanAudits.length,
    audits: leanAudits
  };

  dlJSON(bundle, new Date().toISOString().split('T')[0] + '_all-audits.json');
  toast('Exported ' + leanAudits.length + ' audits');
}

function dlJSON(data, filename) {
  var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportHTML() {
  var name = S.name || 'Unknown';
  var date = new Date().toISOString().split('T')[0];
  var photosHtml = S.photos.map(function(p, i) {
    var t = new Date(p.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    return '<div class="pe"><div class="pm">Photo '+(i+1)+' · '+t+'</div><img src="'+p.dataUrl+'"><div class="pn">'+(p.note||'<em>No note</em>')+'</div></div>';
  }).join('');
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+name+'</title><style>'+
    'body{font-family:Arial,sans-serif;color:#222;margin:24px;max-width:800px}'+
    'h1{color:#c9a84c;border-bottom:2px solid #c9a84c;padding-bottom:8px;margin-bottom:16px}'+
    'h2{color:#c9a84c;margin:20px 0 8px;font-size:.95rem;text-transform:uppercase;letter-spacing:.05em}'+
    '.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:20px;font-size:.88rem;color:#555}'+
    '.dump{background:#f9f9f9;border:1px solid #ddd;border-radius:6px;padding:14px;white-space:pre-wrap;font-size:.88rem;line-height:1.6}'+
    '.pe{margin-bottom:20px;border:1px solid #ddd;border-radius:8px;overflow:hidden;page-break-inside:avoid}'+
    '.pm{background:#f5f5f5;padding:6px 12px;font-size:.78rem;color:#888}'+
    '.pe img{width:100%;max-height:400px;object-fit:cover;display:block}'+
    '.pn{padding:10px 12px;font-size:.88rem;line-height:1.5}'+
    '.ft{margin-top:24px;border-top:1px solid #ddd;padding-top:8px;font-size:.72rem;color:#aaa;text-align:center}'+
    '</style></head><body>'+
    '<h1>'+name+'</h1>'+
    '<div class="meta">'+
      '<div><b>Address:</b> '+(S.address||'—')+'</div>'+
      '<div><b>Date:</b> '+(S.date||date)+'</div>'+
      '<div><b>Co-op:</b> '+(S.coop||'—')+'</div>'+
      '<div><b>Year Built:</b> '+(S.year||'—')+'</div>'+
      '<div><b>Sq Ft:</b> '+(S.sqft||'—')+'</div>'+
      '<div><b>Photos:</b> '+S.photos.length+'</div>'+
    '</div>'+
    '<h2>Voice Dump</h2><div class="dump">'+(S.dump||'No voice dump recorded')+'</div>'+
    (S.photos.length ? '<h2>Photos ('+S.photos.length+')</h2>'+photosHtml : '')+
    '<div class="ft">Audit Field Tool — Jarvis / Project Brain — '+new Date().toLocaleString()+'</div>'+
    '</body></html>';
  var blob = new Blob([html],{type:'text/html'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = date+'_'+(S.name||'audit').replace(/[^a-zA-Z0-9]/g,'-')+'-field.html';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportPhotoPDF() {
  if (!S.photos.length) { toast('No photos to export'); return; }

  var genMsg = document.getElementById('pdf-generating-msg');
  if (genMsg) genMsg.style.display = 'block';

  setTimeout(function() {
    try {
      var jsPDF = window.jspdf && window.jspdf.jsPDF;
      if (!jsPDF) { toast('PDF library not loaded — check internet connection'); if (genMsg) genMsg.style.display = 'none'; return; }

      var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var pageW = 210;
      var pageH = 297;
      var margin = 14;
      var contentW = pageW - margin * 2;

      doc.setFillColor(17, 17, 17);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setTextColor(238, 238, 238);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(S.name || 'Field Audit Photos', margin, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 200, 200);
      var metaLine = (S.address || '') + (S.date ? '  ·  ' + S.date : '') + (S.coop ? '  ·  ' + S.coop : '');
      doc.text(metaLine, margin, 20);
      doc.setTextColor(150, 150, 150);
      doc.text('Generated by Audit Field Tool  ·  ' + new Date().toLocaleDateString(), margin, 26);

      S.photos.forEach(function(photo, index) {
        // Every photo starts on a fresh page except the first
        if (index > 0) {
          doc.addPage();
        }

        // Fixed layout — everything fits on one page
        var pageMargin = 14;
        var headerH = 28; // height of black header on page 1
        var startY = (index === 0) ? headerH + 8 : pageMargin;
        var availH = pageH - startY - pageMargin - 30; // 30 reserved for note at bottom

        // Photo number + timestamp label
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('PHOTO ' + (index + 1) + ' OF ' + S.photos.length, pageMargin, startY + 5);

        var t = new Date(photo.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(t, pageMargin, startY + 10);

        var imgY = startY + 14;

        // Image — scaled to fill available height, never overflow
        try {
          var imgProps = doc.getImageProperties(photo.dataUrl);
          var maxImgW = contentW;
          var maxImgH = availH;
          var ratio = imgProps.width / imgProps.height;
          var imgW = maxImgW;
          var imgH = imgW / ratio;
          if (imgH > maxImgH) {
            imgH = maxImgH;
            imgW = imgH * ratio;
          }
          doc.addImage(photo.dataUrl, 'JPEG', pageMargin, imgY, imgW, imgH, '', 'MEDIUM');
          var noteY = imgY + imgH + 4;
        } catch(e) {
          doc.setTextColor(255, 100, 100);
          doc.setFontSize(8);
          doc.text('[Image could not be embedded]', pageMargin, imgY + 8);
          var noteY = imgY + 16;
        }

        // Note box at bottom of page
        if (photo.note) {
          doc.setFillColor(30, 30, 30);
          doc.setDrawColor(51, 51, 51);
          var noteLines = doc.splitTextToSize(photo.note, contentW - 8);
          var noteH = Math.min(noteLines.length * 5 + 6, 35); // cap note box height
          doc.roundedRect(pageMargin, noteY, contentW, noteH, 2, 2, 'FD');
          doc.setTextColor(204, 204, 204);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(noteLines, pageMargin + 4, noteY + 5);
        } else {
          doc.setTextColor(100, 100, 100);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          doc.text('No note attached', pageMargin, noteY + 3);
        }
      });

      var totalPages = doc.getNumberOfPages();
      for (var i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('Page ' + i + ' of ' + totalPages, pageW - margin, pageH - 6, { align: 'right' });
      }

      var name = (S.name || 'audit').replace(/[^a-zA-Z0-9]/g, '-');
      var date = S.date || new Date().toISOString().split('T')[0];
      doc.save(date + '_' + name + '-photos.pdf');
      toast('Photo PDF exported: ' + S.photos.length + ' photos');

    } catch(e) {
      toast('PDF error: ' + e.message);
      console.error('PDF generation error:', e);
    }

    if (genMsg) genMsg.style.display = 'none';
  }, 100);
}

// ============================================================
// EXPORT TAB — WEEKLY BATCH VIEW
// ============================================================

function getWeekStart(dateStr) {
  var d;
  if (dateStr) {
    var parts = dateStr.split('-');
    d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else {
    d = new Date();
  }
  var day = d.getDay();
  var diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function getWeekLabel(mondayDate) {
  var sunday = new Date(mondayDate);
  sunday.setDate(sunday.getDate() + 6);
  var opts = { month: 'numeric', day: 'numeric', year: '2-digit' };
  return 'Week of ' + mondayDate.toLocaleDateString('en-US', opts) + ' – ' + sunday.toLocaleDateString('en-US', opts);
}

function groupAuditsByWeek(audits) {
  var weeks = {};
  audits.forEach(function(a) {
    var dateStr = a.customer && a.customer.date ? a.customer.date : null;
    var monday = getWeekStart(dateStr);
    var key = monday.toISOString();
    if (!weeks[key]) {
      weeks[key] = { monday: monday, label: getWeekLabel(monday), audits: [] };
    }
    weeks[key].audits.push(a);
  });
  return Object.values(weeks).sort(function(a, b) { return b.monday - a.monday; });
}

function renderWeeklyBatches() {
  var container = document.getElementById('weekly-batches-container');
  if (!container) return;

  var saved = getSaved();

  if (!saved.length) {
    container.innerHTML = '<div class="export-empty-msg">No saved audits yet.<br>Complete an audit on the Voice tab, then save it on the Audits tab.</div>';
    return;
  }

  var weeks = groupAuditsByWeek(saved);
  container.innerHTML = '';

  weeks.forEach(function(week) {
    var group = document.createElement('div');
    group.className = 'week-group';

    var auditRows = week.audits.map(function(a) {
      var name = a.customer.name || 'Unnamed';
      var date = a.customer.date || '—';
      var photos = (a.photos || []).length;
      var words = (a.voiceDump || '').trim().split(/\s+/).filter(Boolean).length;
      return '<div class="week-audit-row">' +
        '<div class="week-audit-info">' +
          '<div class="week-audit-name">' + escapeHtml(name) + '</div>' +
          '<div class="week-audit-meta">' + date + ' · ' + words + ' words · ' + photos + ' photos</div>' +
        '</div>' +
        '<div class="week-audit-btns">' +
          '<button class="btn-xs row-json-btn" data-id="' + a.id + '">📦 JSON</button>' +
          '<button class="btn-xs-gold row-pdf-btn" data-id="' + a.id + '">📷 PDF</button>' +
          '<button class="btn-xs row-tc-btn" data-id="' + a.id + '">📋 T&C</button>' +
        '</div>' +
      '</div>';
    }).join('');

    group.innerHTML =
      '<div class="week-group-header">' +
        '<span class="week-group-title">' + week.label + '</span>' +
        '<span class="week-group-count">' + week.audits.length + ' audit' + (week.audits.length !== 1 ? 's' : '') + '</span>' +
      '</div>' +
      '<div class="week-batch-btns">' +
        '<button class="btn-outline week-json-btn">📦 Export Week JSON</button>' +
        '<button class="btn-gold week-pdf-btn">📷 Export Week Photo PDFs</button>' +
        '<button class="btn-outline week-tc-btn">📋 Export Week T&C PDFs</button>' +
      '</div>' +
      '<div class="pdf-progress week-pdf-progress">Generating PDFs...</div>' +
      auditRows;

    container.appendChild(group);

    group.querySelector('.week-json-btn').addEventListener('click', function() {
      var leanAudits = week.audits.map(function(a) {
        return {
          id: a.id,
          customer: a.customer,
          voiceDump: a.voiceDump,
          exportedAt: new Date().toISOString(),
          source: 'AuditFieldTool'
        };
      });
      var bundle = {
        exportedAt: new Date().toISOString(),
        source: 'AuditFieldTool',
        week: week.label,
        auditCount: leanAudits.length,
        audits: leanAudits
      };
      var weekStr = week.monday.toISOString().split('T')[0];
      dlJSON(bundle, weekStr + '_week-bundle.json');
      toast('Exported ' + leanAudits.length + ' audits for ' + week.label);
    });

    group.querySelector('.week-pdf-btn').addEventListener('click', function() {
      var progress = group.querySelector('.week-pdf-progress');
      exportWeekPhotoPDFs(week.audits, progress);
    });

    group.querySelector('.week-tc-btn').addEventListener('click', function() {
      var progress = group.querySelector('.week-pdf-progress');
      exportWeekTCPDFs(week.audits, progress);
    });

    group.querySelectorAll('.row-json-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { exportSavedAudit(btn.dataset.id); });
    });

    group.querySelectorAll('.row-pdf-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var audit = saved.find(function(a) { return a.id === btn.dataset.id; });
        if (audit) exportSavedPhotoPDF(audit);
        else toast('Audit not found');
      });
    });

    group.querySelectorAll('.row-tc-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var audit = saved.find(function(a) { return a.id === btn.dataset.id; });
        if (audit) generateTCPDFFromRecord(audit, null);
        else toast('Audit not found');
      });
    });
  });
}

function exportWeekPhotoPDFs(audits, progressEl) {
  var auditsWithPhotos = audits.filter(function(a) { return (a.photos || []).length > 0; });
  if (!auditsWithPhotos.length) { toast('No photos found in this week\'s audits'); return; }

  if (progressEl) {
    progressEl.style.display = 'block';
    progressEl.textContent = 'Generating ' + auditsWithPhotos.length + ' PDFs...';
  }

  var index = 0;
  function next() {
    if (index >= auditsWithPhotos.length) {
      if (progressEl) progressEl.style.display = 'none';
      toast('Exported ' + auditsWithPhotos.length + ' photo PDFs');
      return;
    }
    var audit = auditsWithPhotos[index];
    if (progressEl) progressEl.textContent = 'Generating ' + (index + 1) + ' of ' + auditsWithPhotos.length + ': ' + (audit.customer.name || 'Unnamed');
    index++;
    setTimeout(function() {
      exportSavedPhotoPDF(audit, next);
    }, 300);
  }
  next();
}

function exportSavedPhotoPDF(audit, callback) {
  var photos = audit.photos || [];
  if (!photos.length) {
    toast('No photos for ' + (audit.customer.name || 'this audit'));
    if (callback) callback();
    return;
  }

  try {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) { toast('PDF library not loaded'); if (callback) callback(); return; }

    var c = audit.customer || {};
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageW = 210;
    var pageH = 297;
    var margin = 14;
    var contentW = pageW - margin * 2;

    doc.setFillColor(17, 17, 17);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(238, 238, 238);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(c.name || 'Field Audit Photos', margin, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    var metaLine = (c.address || '') + (c.date ? '  ·  ' + c.date : '') + (c.coop ? '  ·  ' + c.coop : '');
    doc.text(metaLine, margin, 20);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Audit Field Tool  ·  ' + new Date().toLocaleDateString(), margin, 26);

    photos.forEach(function(photo, index) {
      // Every photo starts on a fresh page except the first
      if (index > 0) {
        doc.addPage();
      }

      // Fixed layout — everything fits on one page
      var pageMargin = 14;
      var headerH = 28; // height of black header on page 1
      var startY = (index === 0) ? headerH + 8 : pageMargin;
      var availH = pageH - startY - pageMargin - 30; // 30 reserved for note at bottom

      // Photo number + timestamp label
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('PHOTO ' + (index + 1) + ' OF ' + photos.length, pageMargin, startY + 5);

      var ts = photo.ts || photo.timestamp;
      var t = new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(t, pageMargin, startY + 10);

      var imgY = startY + 14;

      // Image — scaled to fill available height, never overflow
      try {
        var imgProps = doc.getImageProperties(photo.dataUrl);
        var maxImgW = contentW;
        var maxImgH = availH;
        var ratio = imgProps.width / imgProps.height;
        var imgW = maxImgW;
        var imgH = imgW / ratio;
        if (imgH > maxImgH) {
          imgH = maxImgH;
          imgW = imgH * ratio;
        }
        doc.addImage(photo.dataUrl, 'JPEG', pageMargin, imgY, imgW, imgH, '', 'MEDIUM');
        var noteY = imgY + imgH + 4;
      } catch(e) {
        doc.setTextColor(255, 100, 100);
        doc.setFontSize(8);
        doc.text('[Image could not be embedded]', pageMargin, imgY + 8);
        var noteY = imgY + 16;
      }

      // Note box at bottom of page
      if (photo.note) {
        doc.setFillColor(30, 30, 30);
        doc.setDrawColor(51, 51, 51);
        var noteLines = doc.splitTextToSize(photo.note, contentW - 8);
        var noteH = Math.min(noteLines.length * 5 + 6, 35); // cap note box height
        doc.roundedRect(pageMargin, noteY, contentW, noteH, 2, 2, 'FD');
        doc.setTextColor(204, 204, 204);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(noteLines, pageMargin + 4, noteY + 5);
      } else {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text('No note attached', pageMargin, noteY + 3);
      }
    });

    var totalPages = doc.getNumberOfPages();
    for (var i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setTextColor(150,150,150);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Page ' + i + ' of ' + totalPages, pageW - margin, pageH - 6, {align:'right'});
    }

    var name = (c.name || 'audit').replace(/[^a-zA-Z0-9]/g, '-');
    var date = c.date || new Date().toISOString().split('T')[0];
    doc.save(date + '_' + name + '-photos.pdf');

    if (callback) setTimeout(callback, 200);

  } catch(e) {
    toast('PDF error: ' + e.message);
    if (callback) callback();
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


// ============================================================
// T&C MODULE
// ============================================================

var tcSigCanvas = null;
var tcSigCtx = null;
var tcDrawing = false;
var tcStrokes = [];
var tcCurrentStroke = [];
var tcHasSig = false;

function initTCTab() {
  tcSigCanvas = document.getElementById('tc-sig-canvas');
  if (!tcSigCanvas) return;

  // Open signature overlay
  document.getElementById('tc-open-sig-btn').addEventListener('click', function() {
    document.getElementById('sig-overlay').style.display = 'flex';
    setupSigCanvas();
  });

  // Save signature button
  document.getElementById('tc-sig-save-btn').addEventListener('click', function() {
    if (tcStrokes.length === 0) {
      alert('Please draw your signature first.');
      return;
    }
    // Save signature as data URL
    S.tcSignature = tcSigCanvas.toDataURL('image/png');
    save();

    // Show preview
    var preview = document.getElementById('tc-sig-preview');
    var previewImg = document.getElementById('tc-sig-preview-img');
    var noSigMsg = document.getElementById('tc-no-sig-msg');
    var clearBtn = document.getElementById('tc-sig-clear');
    if (preview) preview.style.display = 'block';
    if (previewImg) previewImg.src = S.tcSignature;
    if (noSigMsg) noSigMsg.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'inline-block';
    tcHasSig = true;

    // Close overlay
    document.getElementById('sig-overlay').style.display = 'none';
    toast('Signature saved');
  });

  // Clear button (on T&C card)
  document.getElementById('tc-sig-clear').addEventListener('click', function() {
    tcStrokes = []; tcCurrentStroke = []; tcHasSig = false;
    S.tcSignature = null; save();
    var preview = document.getElementById('tc-sig-preview');
    var noSigMsg = document.getElementById('tc-no-sig-msg');
    var clearBtn = document.getElementById('tc-sig-clear');
    if (preview) preview.style.display = 'none';
    if (noSigMsg) noSigMsg.style.display = 'block';
    if (clearBtn) clearBtn.style.display = 'none';
    toast('Signature cleared');
  });

  // Undo button (in overlay)
  document.getElementById('tc-sig-undo').addEventListener('click', function() {
    if (!tcStrokes.length) return;
    tcStrokes.pop();
    redrawStrokes();
  });

  // Clear button (in overlay)
  document.getElementById('tc-sig-redo-clear').addEventListener('click', function() {
    tcStrokes = []; tcCurrentStroke = [];
    if (tcSigCtx) {
      var rect = tcSigCanvas.getBoundingClientRect();
      tcSigCtx.clearRect(0, 0, tcSigCanvas.width, tcSigCanvas.height);
      // Refill white background
      tcSigCtx.fillStyle = '#ffffff';
      tcSigCtx.fillRect(0, 0, rect.width, rect.height);
    }
  });

  var genBtn = document.getElementById('tc-generate-btn');
  if (genBtn) genBtn.addEventListener('click', function() {
    generateTCPDF(null, null);
  });
}

function setupSigCanvas() {
  tcSigCanvas = document.getElementById('tc-sig-canvas');
  if (!tcSigCanvas) return;

  var rect = tcSigCanvas.getBoundingClientRect();
  tcSigCanvas.width = rect.width * window.devicePixelRatio;
  tcSigCanvas.height = rect.height * window.devicePixelRatio;
  tcSigCtx = tcSigCanvas.getContext('2d');
  tcSigCtx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // White background — critical for signature visibility
  tcSigCtx.fillStyle = '#ffffff';
  tcSigCtx.fillRect(0, 0, rect.width, rect.height);

  // Black ink
  tcSigCtx.strokeStyle = '#000000';
  tcSigCtx.lineWidth = 2.5;
  tcSigCtx.lineCap = 'round';
  tcSigCtx.lineJoin = 'round';

  // Redraw existing strokes if any
  redrawStrokes();

  // Remove old listeners by cloning
  var newCanvas = tcSigCanvas.cloneNode(true);
  tcSigCanvas.parentNode.replaceChild(newCanvas, tcSigCanvas);
  tcSigCanvas = newCanvas;
  tcSigCtx = tcSigCanvas.getContext('2d');
  tcSigCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  tcSigCtx.fillStyle = '#ffffff';
  tcSigCtx.fillRect(0, 0, rect.width, rect.height);
  tcSigCtx.strokeStyle = '#000000';
  tcSigCtx.lineWidth = 2.5;
  tcSigCtx.lineCap = 'round';
  tcSigCtx.lineJoin = 'round';
  redrawStrokes();

  function getPos(e) {
    var r = tcSigCanvas.getBoundingClientRect();
    var touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - r.left, y: touch.clientY - r.top };
  }

  function startDraw(e) {
    e.preventDefault();
    tcDrawing = true;
    tcCurrentStroke = [];
    var pos = getPos(e);
    tcCurrentStroke.push(pos);
    tcSigCtx.beginPath();
    tcSigCtx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    e.preventDefault();
    if (!tcDrawing) return;
    var pos = getPos(e);
    tcCurrentStroke.push(pos);
    tcSigCtx.lineTo(pos.x, pos.y);
    tcSigCtx.stroke();
  }

  function endDraw(e) {
    if (!tcDrawing) return;
    tcDrawing = false;
    if (tcCurrentStroke.length > 0) {
      tcStrokes.push(tcCurrentStroke.slice());
    }
    tcCurrentStroke = [];
  }

  tcSigCanvas.addEventListener('mousedown', startDraw);
  tcSigCanvas.addEventListener('mousemove', draw);
  tcSigCanvas.addEventListener('mouseup', endDraw);
  tcSigCanvas.addEventListener('mouseleave', endDraw);
  tcSigCanvas.addEventListener('touchstart', startDraw, {passive:false});
  tcSigCanvas.addEventListener('touchmove', draw, {passive:false});
  tcSigCanvas.addEventListener('touchend', endDraw);
}

function redrawStrokes() {
  if (!tcSigCtx || !tcSigCanvas) return;
  var rect = tcSigCanvas.getBoundingClientRect();
  tcSigCtx.fillStyle = '#ffffff';
  tcSigCtx.fillRect(0, 0, rect.width, rect.height);
  tcSigCtx.strokeStyle = '#000000';
  tcSigCtx.lineWidth = 2.5;
  tcSigCtx.lineCap = 'round';
  tcSigCtx.lineJoin = 'round';
  tcStrokes.forEach(function(stroke) {
    if (stroke.length < 2) return;
    tcSigCtx.beginPath();
    tcSigCtx.moveTo(stroke[0].x, stroke[0].y);
    for (var i = 1; i < stroke.length; i++) {
      tcSigCtx.lineTo(stroke[i].x, stroke[i].y);
    }
    tcSigCtx.stroke();
  });
}

function renderTCInfo() {
  var nameEl = document.getElementById('tc-name-display');
  var addrEl = document.getElementById('tc-address-display');
  var dateEl = document.getElementById('tc-date-display');
  var warnEl = document.getElementById('tc-no-customer-msg');
  if (nameEl) nameEl.textContent = S.name || '—';
  if (addrEl) addrEl.textContent = S.address || '—';
  if (dateEl) dateEl.textContent = S.date || '—';
  if (warnEl) warnEl.style.display = (!S.name && !S.address) ? 'block' : 'none';

  // Restore signature preview if exists
  var preview = document.getElementById('tc-sig-preview');
  var previewImg = document.getElementById('tc-sig-preview-img');
  var noSigMsg = document.getElementById('tc-no-sig-msg');
  var clearBtn = document.getElementById('tc-sig-clear');
  if (S.tcSignature) {
    if (preview) preview.style.display = 'block';
    if (previewImg) previewImg.src = S.tcSignature;
    if (noSigMsg) noSigMsg.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'inline-block';
    tcHasSig = true;
  } else {
    if (preview) preview.style.display = 'none';
    if (noSigMsg) noSigMsg.style.display = 'block';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

function saveTCSignature() {
  if (tcHasSig && tcSigCanvas) {
    S.tcSignature = tcSigCanvas.toDataURL('image/png');
    save();
  }
}

function generateTCPDF(auditData, callback) {
  var name, address, date, sigDataUrl;

  if (auditData && auditData.customer) {
    name = auditData.customer.name || '';
    address = auditData.customer.address || '';
    date = auditData.customer.date || '';
    sigDataUrl = auditData.tcSignature || null;
  } else {
    name = S.name || '';
    address = S.address || '';
    date = S.date || '';
    sigDataUrl = tcHasSig ? tcSigCanvas.toDataURL('image/png') : null;
  }

  if (!name) {
    toast('No customer name — fill in customer info first');
    if (callback) callback();
    return;
  }

  if (!sigDataUrl && !auditData) {
    if (!confirm('No signature captured. Generate T&C without signature?')) {
      if (callback) callback();
      return;
    }
  }

  var genMsg = document.getElementById('tc-generating-msg');
  if (genMsg) genMsg.style.display = 'block';

  overlayTCPDF(name, address, date, sigDataUrl, genMsg, callback);
}

async function overlayTCPDF(name, address, date, sigDataUrl, genMsg, callback) {
  try {
    var PDFLib = window.PDFLib;
    if (!PDFLib) {
      toast('PDF library not loaded — check internet connection');
      if (genMsg) genMsg.style.display = 'none';
      if (callback) callback();
      return;
    }

    // Load blank T&C PDF
    var pdfBytes;
    try {
      var response = await fetch('blank-tc.pdf');
      if (!response.ok) throw new Error('blank-tc.pdf not found');
      var arrayBuffer = await response.arrayBuffer();
      pdfBytes = new Uint8Array(arrayBuffer);
    } catch(e) {
      toast('Could not load blank-tc.pdf — make sure it is in the app folder');
      if (genMsg) genMsg.style.display = 'none';
      if (callback) callback();
      return;
    }

    var pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    var pages = pdfDoc.getPages();
    var page2 = pages[1]; // Page 2 — signature block

    var size = page2.getSize();
    var height = size.height;

    // Embed standard font
    var font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    var fontSize = 10;
    var textColor = PDFLib.rgb(0, 0, 0);

    // ── COORDINATES for page 2 signature block ──
    // pdf-lib uses bottom-left origin (0,0 = bottom left)
    // These coordinates are tuned to match the blank T&C form lines

    // Signature image — above the signature line
    if (sigDataUrl) {
      try {
        // Convert canvas dataUrl to bytes
        var sigBase64 = sigDataUrl.split(',')[1];
        var sigBytes = Uint8Array.from(atob(sigBase64), function(c) { return c.charCodeAt(0); });
        var sigImage = await pdfDoc.embedPng(sigBytes);
        var sigDims = sigImage.scale(0.3);
        // Position signature above the signature line
        page2.drawImage(sigImage, {
          x: 380,
          y: height - 385,
          width: Math.min(sigDims.width, 180),
          height: Math.min(sigDims.height, 35),
        });
      } catch(e) {
        console.error('Sig embed error:', e);
      }
    }

    // Print name — on the print name line
    if (name) {
      page2.drawText(name, {
        x: 320,
        y: height - 400,
        size: fontSize,
        font: font,
        color: textColor,
      });
    }

    // Address line 1
    if (address) {
      page2.drawText(address, {
        x: 320,
        y: height - 435,
        size: fontSize,
        font: font,
        color: textColor,
      });
    }

    // Date
    if (date) {
      page2.drawText(date, {
        x: 320,
        y: height - 480,
        size: fontSize,
        font: font,
        color: textColor,
      });
    }

    // Save and download
    var savedBytes = await pdfDoc.save();
    var blob = new Blob([savedBytes], { type: 'application/pdf' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var safeName = (name || 'customer').replace(/[^a-zA-Z0-9]/g, '-');
    a.download = safeName + '-TC.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast('T&C PDF: ' + (name || 'customer'));

  } catch(e) {
    toast('PDF error: ' + e.message);
    console.error('T&C PDF error:', e);
  }

  if (genMsg) genMsg.style.display = 'none';
  if (callback) setTimeout(callback, 300);
}

function generateTCPDFFromRecord(audit, callback) {
  if (!audit.tcSignature) {
    toast('No signature for ' + (audit.customer.name || 'this audit') + ' — skipping');
    if (callback) setTimeout(callback, 100);
    return;
  }
  generateTCPDF(audit, callback);
}

function exportWeekTCPDFs(audits, progressEl) {
  var withSig = audits.filter(function(a) { return a.tcSignature; });
  if (!withSig.length) { toast('No T&C signatures found for this week'); return; }
  if (audits.length > withSig.length) {
    toast('Note: ' + (audits.length - withSig.length) + ' audit(s) have no signature — skipping');
  }
  if (progressEl) { progressEl.style.display = 'block'; progressEl.textContent = 'Generating ' + withSig.length + ' T&C PDFs...'; }
  var index = 0;
  function next() {
    if (index >= withSig.length) {
      if (progressEl) progressEl.style.display = 'none';
      toast('Exported ' + withSig.length + ' T&C PDFs');
      return;
    }
    var audit = withSig[index];
    if (progressEl) progressEl.textContent = 'Generating ' + (index+1) + ' of ' + withSig.length + ': ' + (audit.customer.name || 'Unnamed');
    index++;
    setTimeout(function() { generateTCPDFFromRecord(audit, next); }, 400);
  }
  next();
}
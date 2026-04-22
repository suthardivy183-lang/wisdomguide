/* ============================================================
   WisdomGuide — app.js
   ============================================================ */

// ── STATE ──
let problems   = JSON.parse(localStorage.getItem('wg2_probs')  || '[]');
let planChecks = JSON.parse(localStorage.getItem('wg2_checks') || '{}');
let notes      = JSON.parse(localStorage.getItem('wg2_notes')  || '{}');
let cache      = JSON.parse(localStorage.getItem('wg2_cache')  || '{}');

let activePid  = null;
let activeWid  = null;   // source id  OR  "council_X"
let activeTab  = 'guidance';

let nextPid = Math.max(0, ...problems.map(p => p.id || 0)) + 1;
let nextSid = 1;
try {
  nextSid = Math.max(
    1,
    ...problems.flatMap(p => [
      ...(p.sources  || []).map(s => s.id || 0),
      ...(p.councils || []).map(c => c.id || 0)
    ])
  ) + 1;
} catch (e) {}

// ── PERSIST ──
const save = () => {
  localStorage.setItem('wg2_probs',   JSON.stringify(problems));
  localStorage.setItem('wg2_checks',  JSON.stringify(planChecks));
  localStorage.setItem('wg2_notes',   JSON.stringify(notes));
  localStorage.setItem('wg2_cache',   JSON.stringify(cache));
};

// ── CONSTANTS ──
const TC = {
  life:         { label: 'Life / Personal',   icon: '🌱' },
  business:     { label: 'Business / Career', icon: '💼' },
  relationship: { label: 'Relationship',      icon: '🤝' },
  professional: { label: 'Professional',      icon: '🎯' },
  other:        { label: 'Other',             icon: '◦'  },
};

const SRC_ICONS = {
  holy:        '📖',
  person:      '👤',
  book:        '📚',
  philosophy:  '🧠',
  mentor:      '🎓',
  other:       '✦',
};

// ── UTILITIES ──
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loading(msg) {
  return `<div class="loading"><div class="spin"></div><span>${msg}</span></div>`;
}

// ── SIDEBAR ──
function renderSidebar() {
  const el = document.getElementById('probList');
  if (!problems.length) {
    el.innerHTML = '<div class="sb-empty">No problems yet.<br>Click <strong>+ New Problem</strong> to begin.</div>';
    return;
  }
  el.innerHTML = problems.map(p => {
    const tc   = TC[p.type] || TC.other;
    const srcN = (p.sources?.length || 0) + (p.councils?.length || 0);
    return `
      <div class="prob-item${p.id === activePid ? ' active' : ''}${p.resolved ? ' resolved' : ''}"
           onclick="selProb(${p.id})">
        <div class="prob-type tc-${p.type}">${tc.icon} ${tc.label}</div>
        <div class="prob-title">${esc(p.title)}</div>
        <div class="prob-meta">
          <span class="prob-dot"></span>
          ${srcN} source${srcN !== 1 ? 's' : ''}
        </div>
        ${p.resolved
          ? '<div style="font-size:0.65rem;color:var(--green);margin-top:3px;font-family:\'JetBrains Mono\',monospace;">✔ Resolved</div>'
          : ''}
      </div>`;
  }).join('');
}

// ── SELECT PROBLEM ──
function selProb(id) {
  activePid  = id;
  const p    = problems.find(x => x.id === id);
  const srcs = [...(p.sources || []), ...(p.councils || [])];
  activeWid  = srcs.length
    ? (srcs[0].ctype === 'council' ? 'council_' + srcs[0].id : srcs[0].id)
    : null;
  activeTab  = 'guidance';
  renderSidebar();
  renderDetail();
}

// ── SELECT WORKSPACE (source or council) ──
function selWid(wid) {
  activeWid = wid;
  activeTab = 'guidance';
  renderDetail();
}

// ── RENDER MAIN DETAIL ──
function renderDetail() {
  document.getElementById('welcomeView').style.display = 'none';
  document.getElementById('detailView').style.display  = 'block';

  const p = problems.find(x => x.id === activePid);
  if (!p) return;
  const tc = TC[p.type] || TC.other;

  const allSrcs = [
    ...(p.sources  || []).map(s => ({ ...s, ctype: 'source'  })),
    ...(p.councils || []).map(c => ({ ...c, ctype: 'council' })),
  ];
  const activeW = allSrcs.find(w =>
    w.ctype === 'council' ? 'council_' + w.id === activeWid : w.id === activeWid
  );

  document.getElementById('detailView').innerHTML = `
    <div class="detail">

      <!-- HEADER -->
      <div class="det-header">
        <div style="flex:1">
          <div class="det-badge tbg-${p.type}">
            ${tc.icon} ${tc.label}
            ${p.urgency === 'urgent' ? ' · 🔴 Urgent' : p.urgency === 'soon' ? ' · 🟡 Soon' : ''}
          </div>
          <div class="det-title">${esc(p.title)}</div>
          ${p.desc ? `<div class="det-desc">${esc(p.desc)}</div>` : ''}
        </div>
        <div class="det-acts">
          <button class="ibt res" title="${p.resolved ? 'Unresolve' : 'Mark Resolved'}"
                  onclick="toggleResolve(${p.id})">${p.resolved ? '↺' : '✔'}</button>
          <button class="ibt del" title="Delete" onclick="delProb(${p.id})">✕</button>
        </div>
      </div>

      <!-- INDIVIDUAL SOURCES -->
      <div>
        <div class="sec-label">Individual Sources</div>
        <div class="sources-chips">
          ${(p.sources || []).map(s => `
            <div class="src-chip${activeWid === s.id ? ' active' : ''}" onclick="selWid(${s.id})">
              <span class="src-chip-del" onclick="event.stopPropagation();delSrc(${p.id},${s.id})">✕</span>
              <span class="src-icon">${s.icon || SRC_ICONS[s.type] || '✦'}</span>
              <div>
                <div class="src-name">${esc(s.name)}</div>
                <div class="src-type">${s.type}</div>
              </div>
            </div>`).join('')}
          <button class="add-src-btn" onclick="openSrcModal()">＋ Add Source</button>
        </div>
      </div>

      <!-- COMPOSITE COUNCILS -->
      <div>
        <div class="sec-label">Composite Councils</div>
        ${(p.councils || []).map(c => {
          const members = (p.sources || []).filter(s => c.memberIds.includes(s.id));
          return `
            <div class="council-banner${activeWid === 'council_' + c.id ? ' active' : ''}"
                 onclick="selWid('council_${c.id}')"
                 style="${activeWid === 'council_' + c.id ? 'border-color:rgba(201,168,76,0.45);' : ''}">
              <div class="council-avatar">${c.icon || '⚡'}</div>
              <div class="council-info">
                <h3>${esc(c.name)}</h3>
                <p>A synthesis of: ${members.map(m => m.name).join(', ')}</p>
              </div>
              <div class="council-faces">
                ${members.slice(0, 4).map(m =>
                  `<div class="council-face">${m.icon || SRC_ICONS[m.type] || '✦'}</div>`
                ).join('')}
              </div>
              <div class="council-arrow">→</div>
            </div>`;
        }).join('')}
        ${(p.sources || []).length >= 2
          ? `<button class="add-src-btn" style="margin-top:8px" onclick="openCouncilModal()">⚡ Build Composite Council</button>`
          : `<div style="font-size:0.8rem;color:var(--text3);padding:4px 0;">Add at least 2 sources to build a composite council.</div>`}
      </div>

      <!-- WORKSPACE -->
      ${activeW
        ? renderWorkspace(p, activeW)
        : `<div style="text-align:center;padding:40px;color:var(--text3);font-size:0.85rem;">
             Select a source or council above to see guidance.
           </div>`}
    </div>`;

  // Re-bind tab buttons
  document.querySelectorAll('.ws-tab').forEach(t => {
    t.addEventListener('click', () => { activeTab = t.dataset.tab; renderDetail(); });
  });

  // Re-bind QA
  const qaSnd = document.getElementById('qa-snd');
  const qaIn  = document.getElementById('qa-in');
  if (qaSnd) qaSnd.addEventListener('click', () => sendQ(p, activeW));
  if (qaIn)  qaIn.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQ(p, activeW); }
  });

  // Re-bind note save
  const ns = document.getElementById('note-save');
  if (ns) ns.addEventListener('click', () => saveNote(p, activeW));

  // Re-bind plan checkboxes
  document.querySelectorAll('.plan-chk').forEach(el => {
    el.addEventListener('click', () => {
      const k = el.dataset.key;
      planChecks[k] = !planChecks[k];
      el.classList.toggle('checked', planChecks[k]);
      el.innerHTML = planChecks[k] ? '✔' : '';
      const txt = el.nextElementSibling;
      if (txt) txt.classList.toggle('checked', planChecks[k]);
      save();
    });
  });
}

// ── WORKSPACE SHELL ──
function renderWorkspace(p, w) {
  const tabs   = ['guidance', 'plan', 'ask', 'notes'];
  const labels = { guidance: 'Guidance', plan: 'Action Plan', ask: 'Ask Questions', notes: 'My Notes' };
  const isCouncil = w.ctype === 'council';
  const cacheKey  = isCouncil ? `${p.id}_council_${w.id}` : `${p.id}_src_${w.id}`;

  return `
    <div class="workspace">
      <div class="ws-hd">
        <div class="ws-title">
          ${w.icon || (isCouncil ? '⚡' : SRC_ICONS[w.type] || '✦')} ${esc(w.name)}
          ${isCouncil
            ? `<span style="font-family:JetBrains Mono,monospace;font-size:0.62rem;color:var(--violet);
                            background:var(--violet-dim);padding:2px 8px;border-radius:10px;margin-left:6px;">
                COUNCIL</span>`
            : ''}
        </div>
        <div class="ws-tabs">
          ${tabs.map(t =>
            `<button class="ws-tab${activeTab === t ? ' active' : ''}" data-tab="${t}">${labels[t]}</button>`
          ).join('')}
        </div>
      </div>
      <div class="ws-body">${renderTab(p, w, cacheKey, isCouncil)}</div>
    </div>`;
}

// ── TAB CONTENT ──
function renderTab(p, w, cacheKey, isCouncil) {
  const c = cache[cacheKey];

  if (activeTab === 'guidance') {
    if (!c?.guidance) {
      setTimeout(() => fetchGuidance(p, w, cacheKey, isCouncil), 50);
      return loading(isCouncil ? 'Council is convening…' : `Asking ${w.name}…`);
    }
    return `<div class="g-content">${c.guidance}</div>
            <button class="regen-btn" onclick="regen('${cacheKey}','guidance')">↺ Regenerate</button>`;
  }

  if (activeTab === 'plan') {
    if (!c?.plan) {
      setTimeout(() => fetchPlan(p, w, cacheKey, isCouncil), 50);
      return loading('Building your action plan…');
    }
    return renderPlan(c.plan, cacheKey);
  }

  if (activeTab === 'ask') {
    const qa = c?.qa || [];
    return `
      <div class="qa-msgs" id="qa-msgs">
        ${!qa.length
          ? `<div style="color:var(--text3);font-size:0.84rem;padding:8px 0;">
               Ask ${isCouncil ? 'your council' : '<em>' + esc(w.name) + '</em>'} anything about your problem.
             </div>`
          : ''}
        ${qa.map(m => `
          <div class="qa-msg ${m.role}">
            <div class="qa-av ${m.role}">${m.role === 'user' ? 'You' : (w.icon || '✦')}</div>
            <div class="qa-bub">
              <div class="qa-who">${m.role === 'user' ? 'You' : esc(w.name)}</div>
              <div class="qa-txt">${m.role === 'source' ? m.text : esc(m.text)}</div>
            </div>
          </div>`).join('')}
        ${c?.qaLoading ? loading(isCouncil ? 'Council is deliberating…' : `${esc(w.name)} is reflecting…`) : ''}
      </div>
      <div class="qa-row">
        <input class="qa-in" id="qa-in" placeholder="Ask a question…" />
        <button class="qa-snd" id="qa-snd">Send →</button>
      </div>`;
  }

  if (activeTab === 'notes') {
    const nk      = cacheKey;
    const myNotes = notes[nk] || [];
    return `
      <div>
        ${myNotes.map(n => `
          <div class="note-card">
            <div class="note-q">"${esc(n.quote)}"</div>
            <div class="note-r">${esc(n.reflection)}</div>
            <div class="note-m">${n.date}</div>
          </div>`).join('')}
        <div class="note-form">
          <input id="note-q" placeholder="Quote / Verse / Passage…" />
          <textarea id="note-r" placeholder="Your reflection on how this applies to you…"></textarea>
          <button class="note-save" id="note-save">Save Note</button>
        </div>
      </div>`;
  }

  return '';
}

// ── PLAN RENDER ──
function renderPlan(steps, cacheKey) {
  if (!Array.isArray(steps) || !steps.length)
    return '<p style="color:var(--text3)">No steps generated.</p>';

  return steps.map((s, i) => {
    const k   = `${cacheKey}_${i}`;
    const chk = !!planChecks[k];
    return `
      <div class="plan-item">
        <div class="plan-chk${chk ? ' checked' : ''}" data-key="${k}">${chk ? '✔' : ''}</div>
        <div>
          <div class="plan-txt${chk ? ' checked' : ''}">
            ${s.action}
            ${s.src ? `<span class="plan-src-badge">${esc(s.src)}</span>` : ''}
          </div>
          ${s.ref ? `<div class="plan-ref">${esc(s.ref)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── MISC ACTIONS ──
function regen(cacheKey, field) {
  if (cache[cacheKey]) cache[cacheKey][field] = null;
  save();
  renderDetail();
}

function toggleResolve(id) {
  const p = problems.find(x => x.id === id);
  if (p) { p.resolved = !p.resolved; save(); renderSidebar(); renderDetail(); }
}

function delProb(id) {
  if (!confirm('Delete this problem? This cannot be undone.')) return;
  problems = problems.filter(x => x.id !== id);
  save();
  if (activePid === id) {
    activePid = null;
    document.getElementById('detailView').style.display  = 'none';
    document.getElementById('welcomeView').style.display = '';
  }
  renderSidebar();
}

function delSrc(pid, sid) {
  const p = problems.find(x => x.id === pid);
  if (!p) return;
  p.sources  = p.sources.filter(s => s.id !== sid);
  p.councils = (p.councils || [])
    .map(c => ({ ...c, memberIds: c.memberIds.filter(id => id !== sid) }))
    .filter(c => c.memberIds.length >= 2);
  save();
  if (activeWid === sid) {
    const srcs = [...(p.sources || []), ...(p.councils || [])];
    activeWid  = srcs.length ? (srcs[0].ctype === 'council' ? 'council_' + srcs[0].id : srcs[0].id) : null;
  }
  renderSidebar();
  renderDetail();
}

function saveNote(p, w) {
  const q  = document.getElementById('note-q')?.value?.trim();
  const r  = document.getElementById('note-r')?.value?.trim();
  if (!q && !r) return;
  const nk = w.ctype === 'council' ? `${p.id}_council_${w.id}` : `${p.id}_src_${w.id}`;
  if (!notes[nk]) notes[nk] = [];
  notes[nk].push({
    quote:      q || '',
    reflection: r || '',
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
  });
  save();
  renderDetail();
}

// ── MODAL HELPERS ──
function openSrcModal() {
  ['sm-name', 'sm-icon', 'sm-ctx'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('srcModal').classList.add('open');
  setTimeout(() => document.getElementById('sm-name').focus(), 80);
}

function openCouncilModal() {
  const p = problems.find(x => x.id === activePid);
  if (!p) return;
  document.getElementById('councilSrcList').innerHTML = (p.sources || []).map(s => `
    <div class="csl-item" data-id="${s.id}" onclick="toggleCouncilSrc(this)">
      <div class="csl-chk"></div>
      <span class="csl-icon">${s.icon || SRC_ICONS[s.type] || '✦'}</span>
      <div>
        <div class="csl-name">${esc(s.name)}</div>
        <div class="csl-type">${s.type}</div>
      </div>
    </div>`).join('');
  document.getElementById('cm-name').value = '';
  document.getElementById('cm-icon').value = '';
  document.getElementById('councilModal').classList.add('open');
}

function toggleCouncilSrc(el) { el.classList.toggle('selected'); }

// ── MODAL EVENT BINDINGS  (called from index.html after DOM ready) ──
function initModalEvents() {

  // New Problem
  document.getElementById('btnNew').addEventListener('click', () => {
    ['pm-title', 'pm-desc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('probModal').classList.add('open');
    setTimeout(() => document.getElementById('pm-title').focus(), 80);
  });

  document.getElementById('pm-x').addEventListener('click', () =>
    document.getElementById('probModal').classList.remove('open'));

  document.getElementById('pm-ok').addEventListener('click', () => {
    const title = document.getElementById('pm-title').value.trim();
    if (!title) { document.getElementById('pm-title').focus(); return; }
    const p = {
      id:       nextPid++,
      title,
      type:     document.getElementById('pm-type').value,
      urgency:  document.getElementById('pm-urgency').value,
      desc:     document.getElementById('pm-desc').value.trim(),
      sources:  [],
      councils: [],
      resolved: false,
    };
    problems.push(p);
    save();
    document.getElementById('probModal').classList.remove('open');
    renderSidebar();
    selProb(p.id);
  });

  // Add Source
  document.getElementById('sm-x').addEventListener('click', () =>
    document.getElementById('srcModal').classList.remove('open'));

  document.getElementById('sm-ok').addEventListener('click', () => {
    const name = document.getElementById('sm-name').value.trim();
    if (!name) { document.getElementById('sm-name').focus(); return; }
    const p = problems.find(x => x.id === activePid);
    if (!p) return;
    if (!p.sources) p.sources = [];
    const typeVal = document.getElementById('sm-type').value;
    const s = {
      id:   nextSid++,
      name,
      type: typeVal,
      icon: document.getElementById('sm-icon').value.trim() || SRC_ICONS[typeVal] || '✦',
      ctx:  document.getElementById('sm-ctx').value.trim(),
    };
    p.sources.push(s);
    save();
    activeWid = s.id;
    activeTab = 'guidance';
    document.getElementById('srcModal').classList.remove('open');
    renderSidebar();
    renderDetail();
  });

  // Build Council
  document.getElementById('cm-x').addEventListener('click', () =>
    document.getElementById('councilModal').classList.remove('open'));

  document.getElementById('cm-ok').addEventListener('click', () => {
    const selected = [...document.querySelectorAll('.csl-item.selected')]
      .map(el => parseInt(el.dataset.id));
    if (selected.length < 2) { alert('Select at least 2 sources for a council.'); return; }
    const p = problems.find(x => x.id === activePid);
    if (!p) return;
    if (!p.councils) p.councils = [];
    const members     = (p.sources || []).filter(s => selected.includes(s.id));
    const defaultName = members.map(m => m.name.split(' ')[0]).join(' × ') + ' Council';
    const c = {
      id:        nextSid++,
      ctype:     'council',
      memberIds: selected,
      name:      document.getElementById('cm-name').value.trim() || defaultName,
      icon:      document.getElementById('cm-icon').value.trim() || '⚡',
    };
    p.councils.push(c);
    save();
    activeWid = 'council_' + c.id;
    activeTab = 'guidance';
    document.getElementById('councilModal').classList.remove('open');
    renderSidebar();
    renderDetail();
  });

  // Close overlays on backdrop click
  ['probModal', 'srcModal', 'councilModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });
  });
}
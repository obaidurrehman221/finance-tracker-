/* ===========================================================
   Avocado DevOps — Finance Tracker  |  App Logic
   ===========================================================
   Requires: Firebase module script loaded before this file.
   window.cloud must be defined by the Firebase module.
   =========================================================== */

/* ---------------------------------------------------------
   DEFAULT DATA
--------------------------------------------------------- */
const DEFAULT_CATEGORIES = [
  { id:'sales', name:'Sales / Revenue', type:'income', color:'#10b981' },
  { id:'services', name:'Services rendered', type:'income', color:'#34d399' },
  { id:'other-income', name:'Other income', type:'income', color:'#6ee7b7' },
  { id:'rent', name:'Rent & utilities', type:'expense', color:'#f43f5e' },
  { id:'payroll', name:'Payroll', type:'expense', color:'#fb7185' },
  { id:'supplies', name:'Supplies & materials', type:'expense', color:'#f59e0b' },
  { id:'marketing', name:'Marketing', type:'expense', color:'#a78bfa' },
  { id:'software', name:'Software & subscriptions', type:'expense', color:'#60a5fa' },
  { id:'travel', name:'Travel', type:'expense', color:'#fb923c' },
  { id:'other-expense', name:'Other expense', type:'expense', color:'#94a3b8' },
];

const PARTNER_COLORS = ['#10b981','#f59e0b','#60a5fa','#f43f5e'];
const DEFAULT_PARTNERS = [
  { id:'p1', name:'Obaid', stake:25 },
  { id:'p2', name:'Aziz', stake:25 },
  { id:'p3', name:'Talha', stake:25 },
  { id:'p4', name:'Roni', stake:25 },
];

function defaultState() {
  return { businessName:'', transactions:[], categories:DEFAULT_CATEGORIES, partners:DEFAULT_PARTNERS, contributions:[] };
}

let state = defaultState();

async function loadState() {
  try {
    const raw = await window.cloud.load();
    if(raw) state = Object.assign(defaultState(), JSON.parse(raw));
  } catch(e) {
    console.log('No saved data yet — starting fresh.', e);
  }
  if(!state.categories || !state.categories.length) state.categories = DEFAULT_CATEGORIES;
  if(!state.transactions) state.transactions = [];
  if(!state.partners || !state.partners.length) state.partners = DEFAULT_PARTNERS;
  if(!state.contributions) state.contributions = [];
}

async function saveState() {
  try {
    await window.cloud.save(state);
  } catch(e) {
    console.error('Save failed', e);
    showToast('Could not save — check your connection');
  }
}

/* ---------------------------------------------------------
   UTIL
--------------------------------------------------------- */
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function fmtMoney(n) {
  const sign = n < 0 ? '-' : '';
  return sign + 'Rs ' + Math.abs(n).toLocaleString('en-PK',{minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtDate(d) {
  const dt = new Date(d+'T00:00:00');
  return dt.toLocaleDateString(undefined,{month:'short', day:'numeric', year:'numeric'});
}
function catById(id) { return state.categories.find(c=>c.id===id); }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>t.classList.remove('show'), 2400);
}

/* ---------------------------------------------------------
   THEME TOGGLE
--------------------------------------------------------- */
function initTheme() {
  const saved = localStorage.getItem('avocado-theme');
  if(saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
  // Default is dark (set in HTML)
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('avocado-theme', next);
  // Update chart colors for new theme
  updateChartColors();
}
function updateChartColors() {
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.06)';
  if(window.Chart) {
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
  }
}

/* ---------------------------------------------------------
   NAVIGATION
--------------------------------------------------------- */
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', ()=> switchPage(btn.dataset.page));
});
// Mobile nav
document.querySelectorAll('.mobile-nav-btn[data-page]').forEach(btn => {
  btn.addEventListener('click', ()=> switchPage(btn.dataset.page));
});

function switchPage(name) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelector(`.nav-btn[data-page="${name}"]`)?.classList.add('active');
  document.querySelector(`.mobile-nav-btn[data-page="${name}"]`)?.classList.add('active');
  if(name==='dashboard') renderDashboard();
  if(name==='transactions') renderTransactions();
  if(name==='categories') renderCategories();
  if(name==='partners') renderPartners();
  if(name==='reports') renderReports();
  // Scroll to top on page switch
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Business name */
const bizInput = document.getElementById('bizNameInput');
bizInput.addEventListener('input', ()=>{ state.businessName = bizInput.value; saveState(); });

/* ---------------------------------------------------------
   TRANSACTION DRAWER
--------------------------------------------------------- */
let currentTxType = 'income';
function setTxType(type) {
  currentTxType = type;
  document.getElementById('typeIncomeBtn').classList.toggle('active', type==='income');
  document.getElementById('typeExpenseBtn').classList.toggle('active', type==='expense');
  populateCategorySelect(type);
}
function populateCategorySelect(type) {
  const sel = document.getElementById('txCategory');
  sel.innerHTML = '';
  state.categories.filter(c=>c.type===type).forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
}

function openDrawer(editId) {
  document.getElementById('txOverlay').classList.add('open');
  const todayStr = new Date().toISOString().slice(0,10);
  if(editId) {
    const tx = state.transactions.find(t=>t.id===editId);
    document.getElementById('drawerTitle').textContent = 'Edit transaction';
    setTxType(tx.type);
    document.getElementById('txAmount').value = tx.amount;
    document.getElementById('txDate').value = tx.date;
    populateCategorySelect(tx.type);
    document.getElementById('txCategory').value = tx.category;
    document.getElementById('txDescription').value = tx.description || '';
    document.getElementById('txParty').value = tx.party || '';
    document.getElementById('txMethod').value = tx.method || 'Bank transfer';
    document.getElementById('txNotes').value = tx.notes || '';
    document.getElementById('txId').value = tx.id;
  } else {
    document.getElementById('drawerTitle').textContent = 'Add transaction';
    setTxType('income');
    document.getElementById('txAmount').value = '';
    document.getElementById('txDate').value = todayStr;
    document.getElementById('txDescription').value = '';
    document.getElementById('txParty').value = '';
    document.getElementById('txMethod').value = 'Bank transfer';
    document.getElementById('txNotes').value = '';
    document.getElementById('txId').value = '';
  }
}
function closeDrawer() { document.getElementById('txOverlay').classList.remove('open'); }

function saveTransaction() {
  const amount = parseFloat(document.getElementById('txAmount').value);
  const date = document.getElementById('txDate').value;
  const category = document.getElementById('txCategory').value;
  const description = document.getElementById('txDescription').value.trim();

  if(!amount || amount <= 0){ showToast('Enter an amount greater than zero'); return; }
  if(!date){ showToast('Pick a date'); return; }
  if(!description){ showToast('Add a short description'); return; }

  const id = document.getElementById('txId').value;
  const record = {
    id: id || uid(),
    type: currentTxType,
    amount: amount,
    date: date,
    category: category,
    description: description,
    party: document.getElementById('txParty').value.trim(),
    method: document.getElementById('txMethod').value,
    notes: document.getElementById('txNotes').value.trim(),
  };

  if(id) {
    const idx = state.transactions.findIndex(t=>t.id===id);
    state.transactions[idx] = record;
    showToast('Entry updated');
  } else {
    state.transactions.push(record);
    showToast('Entry added to the ledger');
  }
  saveState();
  closeDrawer();
  renderAll();
}

function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t=>t.id!==id);
  saveState();
  renderAll();
  showToast('Entry removed');
}

/* ---------------------------------------------------------
   CATEGORY DRAWER
--------------------------------------------------------- */
let currentCatType = 'income';
function setCatType(type) {
  currentCatType = type;
  document.getElementById('catTypeIncomeBtn').classList.toggle('active', type==='income');
  document.getElementById('catTypeExpenseBtn').classList.toggle('active', type==='expense');
}
function openCategoryDrawer() {
  document.getElementById('catOverlay').classList.add('open');
  setCatType('income');
  document.getElementById('catName').value = '';
  document.getElementById('catColor').value = '#10b981';
}
function closeCategoryDrawer() { document.getElementById('catOverlay').classList.remove('open'); }
function saveCategory() {
  const name = document.getElementById('catName').value.trim();
  if(!name){ showToast('Give the category a name'); return; }
  state.categories.push({
    id: uid(),
    name: name,
    type: currentCatType,
    color: document.getElementById('catColor').value,
  });
  saveState();
  closeCategoryDrawer();
  renderCategories();
  showToast('Category added');
}
function deleteCategory(id) {
  const inUse = state.transactions.some(t=>t.category===id);
  if(inUse){ showToast('Category is in use by existing entries'); return; }
  state.categories = state.categories.filter(c=>c.id!==id);
  saveState();
  renderCategories();
}

/* ---------------------------------------------------------
   CONTRIBUTION DRAWER
--------------------------------------------------------- */
function populateContribPartnerSelect() {
  const sel = document.getElementById('contribPartner');
  sel.innerHTML = '';
  state.partners.forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.name;
    sel.appendChild(opt);
  });
}
function openContribDrawer() {
  populateContribPartnerSelect();
  document.getElementById('contribAmount').value = '';
  document.getElementById('contribDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('contribNote').value = '';
  document.getElementById('contribOverlay').classList.add('open');
}
function closeContribDrawer() { document.getElementById('contribOverlay').classList.remove('open'); }
function saveContribution() {
  const amount = parseFloat(document.getElementById('contribAmount').value);
  const date = document.getElementById('contribDate').value;
  if(!amount || amount <= 0){ showToast('Enter an amount greater than zero'); return; }
  if(!date){ showToast('Pick a date'); return; }
  state.contributions.push({
    id: uid(),
    partnerId: document.getElementById('contribPartner').value,
    amount: amount,
    date: date,
    note: document.getElementById('contribNote').value.trim(),
  });
  saveState();
  closeContribDrawer();
  renderPartners();
  renderDashboard();
  showToast('Contribution added to the fund');
}
function deleteContribution(id) {
  state.contributions = state.contributions.filter(c=>c.id!==id);
  saveState();
  renderPartners();
  renderDashboard();
  showToast('Contribution removed');
}
function updatePartnerName(id, name) {
  const p = state.partners.find(p=>p.id===id);
  if(p){ p.name = name.trim() || p.name; saveState(); renderPartners(); }
}
function partnerById(id) { return state.partners.find(p=>p.id===id); }
function partnerInitials(name) {
  return name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
}

/* ---------------------------------------------------------
   RENDER: PARTNERS
--------------------------------------------------------- */
function renderPartners() {
  const totalExpense = state.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const totalContrib = state.contributions.reduce((s,c)=>s+c.amount,0);
  const totalIncome = state.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const fundBalance = totalContrib - totalExpense;

  document.getElementById('statContrib').textContent = fmtMoney(totalContrib);
  document.getElementById('statContribExpense').textContent = fmtMoney(totalExpense);
  const balEl = document.getElementById('statFundBalance');
  balEl.textContent = fmtMoney(fundBalance);
  balEl.className = 'card-value ' + (fundBalance >= 0 ? 'pos' : 'neg');

  const grid = document.getElementById('partnerGrid');
  grid.innerHTML = '';
  state.partners.forEach((p, i)=>{
    const color = PARTNER_COLORS[i % PARTNER_COLORS.length];
    const total = state.contributions.filter(c=>c.partnerId===p.id).reduce((s,c)=>s+c.amount,0);
    const share = totalContrib > 0 ? (total/totalContrib*100) : 0;
    const count = state.contributions.filter(c=>c.partnerId===p.id).length;
    const stake = p.stake || 25;
    const fairShare = totalExpense * (stake/100);
    const diff = total - fairShare;
    const diffLabel = diff >= 0
      ? `<span style="color:var(--positive); font-weight:600;">+${fmtMoney(diff)} ahead of ${stake}% share</span>`
      : `<span style="color:var(--negative); font-weight:600;">-${fmtMoney(Math.abs(diff))} behind ${stake}% share</span>`;
    const card = document.createElement('div');
    card.className = 'partner-card';
    card.innerHTML = `
      <div class="partner-head">
        <div class="partner-avatar" style="background:${color}">${partnerInitials(p.name)}</div>
        <input class="partner-name-field" value="${escapeHtml(p.name)}" onchange="updatePartnerName('${p.id}', this.value)">
      </div>
      <div class="partner-contrib-total">${fmtMoney(total)}</div>
      <div class="partner-contrib-sub">${share.toFixed(1)}% of fund · ${count} ${count===1?'contribution':'contributions'}</div>
      <div class="partner-share-track"><div class="partner-share-fill" style="width:${Math.min(share,100)}%; background:${color}"></div></div>
      <div class="partner-contrib-sub" style="margin-top:2px;">${diffLabel}</div>
    `;
    grid.appendChild(card);
  });

  // contribution history table
  const body = document.getElementById('contribBody');
  body.innerHTML = '';
  const sorted = [...state.contributions].sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('contribEmpty').style.display = sorted.length ? 'none' : 'block';
  sorted.forEach(c=>{
    const p = partnerById(c.partnerId);
    const idx = state.partners.findIndex(pp=>pp.id===c.partnerId);
    const color = PARTNER_COLORS[idx % PARTNER_COLORS.length] || '#999';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(c.date)}</td>
      <td><span class="tag" style="background:${color}18; color:${color}"><span class="dot" style="background:${color}"></span>${p ? escapeHtml(p.name) : 'Unknown'}</span></td>
      <td>${escapeHtml(c.note||'—')}</td>
      <td class="amt pos">+${fmtMoney(c.amount)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn danger" title="Delete" onclick="deleteContribution('${c.id}')" aria-label="Delete contribution">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

/* ---------------------------------------------------------
   RENDER: DASHBOARD
--------------------------------------------------------- */
const CHART_TEXT = '#94a3b8';
const CHART_GRID = 'rgba(148,163,184,0.08)';

let trendChartInstance, reportChartInstance, pieChartInstance;

function renderDashboard() {
  const totalIncome = state.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const totalExpense = state.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const net = totalIncome - totalExpense;

  document.getElementById('statIncome').textContent = fmtMoney(totalIncome);
  document.getElementById('statExpense').textContent = fmtMoney(totalExpense);
  const netEl = document.getElementById('statNet');
  netEl.textContent = fmtMoney(net);
  netEl.className = 'card-value ' + (net >= 0 ? 'pos' : 'neg');

  const now = new Date();
  const monthKey = now.toISOString().slice(0,7);
  const monthTx = state.transactions.filter(t=>t.date.slice(0,7)===monthKey);
  const monthNet = monthTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0) - monthTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const monthEl = document.getElementById('statMonth');
  monthEl.textContent = fmtMoney(monthNet);
  monthEl.className = 'card-value ' + (monthNet >= 0 ? 'pos' : 'neg');

  const totalContrib = state.contributions.reduce((s,c)=>s+c.amount,0);
  const fundBalance = totalContrib - totalExpense;
  const fundEl = document.getElementById('statFundBalanceDash');
  fundEl.textContent = fmtMoney(fundBalance);
  fundEl.className = 'card-value ' + (fundBalance >= 0 ? 'pos' : 'neg');

  // recent activity
  const recent = [...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  const body = document.getElementById('recentTxBody');
  body.innerHTML = '';
  document.getElementById('recentEmpty').style.display = recent.length ? 'none' : 'block';
  recent.forEach(t=>{
    const cat = catById(t.category);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(t.date)}</td>
      <td>${escapeHtml(t.description)}</td>
      <td>${cat ? `<span class="tag" style="background:${cat.color}18; color:${cat.color}"><span class="dot" style="background:${cat.color}"></span>${escapeHtml(cat.name)}</span>` : '—'}</td>
      <td class="amt ${t.type==='income'?'pos':'neg'}">${t.type==='income'?'+':'-'}${fmtMoney(t.amount)}</td>
    `;
    body.appendChild(tr);
  });

  renderTopExpenses();
  renderTrendChart();
}

function renderTopExpenses() {
  const byCat = {};
  state.transactions.filter(t=>t.type==='expense').forEach(t=>{
    byCat[t.category] = (byCat[t.category]||0) + t.amount;
  });
  const entries = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const max = entries.length ? entries[0][1] : 1;
  const container = document.getElementById('topExpenseList');
  container.innerHTML = '';
  if(!entries.length) {
    container.innerHTML = `<div class="empty-state" style="padding:24px 0;"><div class="glyph">§</div><p>No expenses logged yet.</p></div>`;
    return;
  }
  entries.forEach(([catId, amt])=>{
    const cat = catById(catId);
    const row = document.createElement('div');
    row.className = 'breakdown-row';
    row.innerHTML = `
      <div class="breakdown-name">${cat ? escapeHtml(cat.name) : 'Uncategorized'}</div>
      <div class="breakdown-bar-track"><div class="breakdown-bar-fill" style="width:${(amt/max*100)}%; background:${cat?cat.color:'#999'}"></div></div>
      <div class="breakdown-val">${fmtMoney(amt)}</div>
    `;
    container.appendChild(row);
  });
}

function getMonthKeys(count) {
  const keys = [];
  const d = new Date();
  d.setDate(1);
  for(let i=count-1;i>=0;i--) {
    const dt = new Date(d.getFullYear(), d.getMonth()-i, 1);
    keys.push(dt.toISOString().slice(0,7));
  }
  return keys;
}
function monthLabel(key) {
  const [y,m] = key.split('-');
  return new Date(y, m-1, 1).toLocaleDateString(undefined,{month:'short', year:'2-digit'});
}

function renderTrendChart() {
  const keys = getMonthKeys(6);
  const income = keys.map(k=>state.transactions.filter(t=>t.type==='income' && t.date.slice(0,7)===k).reduce((s,t)=>s+t.amount,0));
  const expense = keys.map(k=>state.transactions.filter(t=>t.type==='expense' && t.date.slice(0,7)===k).reduce((s,t)=>s+t.amount,0));

  const ctx = document.getElementById('trendChart');
  if(trendChartInstance) trendChartInstance.destroy();
  trendChartInstance = new Chart(ctx, {
    type:'bar',
    data:{
      labels: keys.map(monthLabel),
      datasets:[
        { label:'Income', data:income, backgroundColor:'#10b981', borderRadius:6, maxBarThickness:28 },
        { label:'Expenses', data:expense, backgroundColor:'#f43f5e', borderRadius:6, maxBarThickness:28 },
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12, color:CHART_TEXT, font:{ family:'Inter', size:12 }, padding:16 } } },
      scales:{
        y:{ beginAtZero:true, grid:{ color:CHART_GRID }, ticks:{ color:CHART_TEXT, callback:v=>'Rs '+v.toLocaleString(), font:{family:'JetBrains Mono', size:11} } },
        x:{ grid:{ display:false }, ticks:{ color:CHART_TEXT, font:{family:'Inter', size:12} } }
      }
    }
  });
}

/* ---------------------------------------------------------
   RENDER: TRANSACTIONS
--------------------------------------------------------- */
function populateFilterCategories() {
  const sel = document.getElementById('filterCategory');
  const current = sel.value;
  sel.innerHTML = '<option value="all">All categories</option>';
  state.categories.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    sel.appendChild(opt);
  });
  sel.value = current || 'all';
}

function renderTransactions() {
  populateFilterCategories();
  const search = document.getElementById('searchInput').value.toLowerCase();
  const typeFilter = document.getElementById('filterType').value;
  const catFilter = document.getElementById('filterCategory').value;
  const sort = document.getElementById('sortOrder').value;

  let list = state.transactions.filter(t=>{
    if(typeFilter!=='all' && t.type!==typeFilter) return false;
    if(catFilter!=='all' && t.category!==catFilter) return false;
    if(search) {
      const hay = (t.description+' '+(t.party||'')).toLowerCase();
      if(!hay.includes(search)) return false;
    }
    return true;
  });

  list.sort((a,b)=>{
    if(sort==='date-desc') return b.date.localeCompare(a.date);
    if(sort==='date-asc') return a.date.localeCompare(b.date);
    if(sort==='amount-desc') return b.amount-a.amount;
    if(sort==='amount-asc') return a.amount-b.amount;
  });

  const body = document.getElementById('txBody');
  body.innerHTML = '';
  document.getElementById('txEmpty').style.display = list.length ? 'none' : 'block';

  list.forEach(t=>{
    const cat = catById(t.category);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(t.date)}</td>
      <td>${escapeHtml(t.description)}</td>
      <td>${cat ? `<span class="tag" style="background:${cat.color}18; color:${cat.color}"><span class="dot" style="background:${cat.color}"></span>${escapeHtml(cat.name)}</span>` : '—'}</td>
      <td>${escapeHtml(t.method||'')}</td>
      <td>${escapeHtml(t.party||'—')}</td>
      <td class="amt ${t.type==='income'?'pos':'neg'}">${t.type==='income'?'+':'-'}${fmtMoney(t.amount)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit" onclick="openDrawer('${t.id}')" aria-label="Edit transaction">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="icon-btn danger" title="Delete" onclick="deleteTransaction('${t.id}')" aria-label="Delete transaction">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
          </button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

/* ---------------------------------------------------------
   RENDER: CATEGORIES
--------------------------------------------------------- */
function renderCategories() {
  const incomeGrid = document.getElementById('incomeCatGrid');
  const expenseGrid = document.getElementById('expenseCatGrid');
  incomeGrid.innerHTML = '';
  expenseGrid.innerHTML = '';
  state.categories.forEach(c=>{
    const count = state.transactions.filter(t=>t.category===c.id).length;
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `
      <div class="left">
        <span class="cat-swatch" style="background:${c.color}"></span>
        <div>
          <div class="cat-name">${escapeHtml(c.name)}</div>
          <div class="cat-meta">${count} ${count===1?'entry':'entries'}</div>
        </div>
      </div>
      <button class="icon-btn danger" title="Delete category" onclick="deleteCategory('${c.id}')" aria-label="Delete category">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
      </button>
    `;
    (c.type==='income' ? incomeGrid : expenseGrid).appendChild(card);
  });
}

/* ---------------------------------------------------------
   RENDER: REPORTS
--------------------------------------------------------- */
function renderReports() {
  const rangeVal = document.getElementById('reportRange').value;
  let keys;
  if(rangeVal==='all') {
    const dates = state.transactions.map(t=>t.date.slice(0,7));
    const uniq = [...new Set(dates)].sort();
    keys = uniq.length ? uniq : getMonthKeys(6);
  } else {
    keys = getMonthKeys(parseInt(rangeVal));
  }

  const incomeByMonth = keys.map(k=>state.transactions.filter(t=>t.type==='income' && t.date.slice(0,7)===k).reduce((s,t)=>s+t.amount,0));
  const expenseByMonth = keys.map(k=>state.transactions.filter(t=>t.type==='expense' && t.date.slice(0,7)===k).reduce((s,t)=>s+t.amount,0));
  const netByMonth = keys.map((k,i)=>incomeByMonth[i]-expenseByMonth[i]);

  const ctx = document.getElementById('reportChart');
  if(reportChartInstance) reportChartInstance.destroy();
  reportChartInstance = new Chart(ctx, {
    type:'line',
    data:{
      labels: keys.map(monthLabel),
      datasets:[{
        label:'Net profit', data:netByMonth,
        borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,0.12)',
        fill:true, tension:0.35, pointRadius:4, pointBackgroundColor:'#f59e0b',
        pointBorderColor:'#f59e0b', borderWidth:2.5,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        y:{ grid:{ color:CHART_GRID }, ticks:{ color:CHART_TEXT, callback:v=>'Rs '+v.toLocaleString(), font:{family:'JetBrains Mono', size:11} } },
        x:{ grid:{ display:false }, ticks:{ color:CHART_TEXT, font:{family:'Inter', size:12} } }
      }
    }
  });

  // pie chart: expense by category over range
  const inRange = new Set(keys);
  const byCat = {};
  state.transactions.filter(t=>t.type==='expense' && inRange.has(t.date.slice(0,7))).forEach(t=>{
    byCat[t.category] = (byCat[t.category]||0)+t.amount;
  });
  const catEntries = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const pieCtx = document.getElementById('pieChart');
  if(pieChartInstance) pieChartInstance.destroy();
  pieChartInstance = new Chart(pieCtx, {
    type:'doughnut',
    data:{
      labels: catEntries.map(([id])=> (catById(id)||{}).name || 'Uncategorized'),
      datasets:[{
        data: catEntries.map(([,v])=>v),
        backgroundColor: catEntries.map(([id])=> (catById(id)||{}).color || '#999'),
        borderColor:'var(--surface-solid)', borderWidth:3, hoverOffset:8,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      cutout:'65%',
      plugins:{ legend:{ position:'bottom', labels:{ boxWidth:12, color:CHART_TEXT, font:{family:'Inter', size:12}, padding:14 } } }
    }
  });

  // monthly summary table
  const body = document.getElementById('monthlySummaryBody');
  body.innerHTML = '';
  keys.slice().reverse().forEach((k,i)=>{
    const idx = keys.length-1-i;
    const inc = incomeByMonth[idx], exp = expenseByMonth[idx], net = netByMonth[idx];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${monthLabel(k)}</td>
      <td class="amt pos">${fmtMoney(inc)}</td>
      <td class="amt neg">${fmtMoney(exp)}</td>
      <td class="amt ${net>=0?'pos':'neg'}">${fmtMoney(net)}</td>
    `;
    body.appendChild(tr);
  });
}

/* ---------------------------------------------------------
   CSV EXPORT
--------------------------------------------------------- */
function exportCSV() {
  const rows = [['Date','Type','Category','Description','Client/Vendor','Method','Amount','Notes']];
  [...state.transactions].sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>{
    const cat = catById(t.category);
    rows.push([t.date, t.type, cat?cat.name:'', t.description, t.party||'', t.method||'', t.amount.toFixed(2), t.notes||'']);
  });
  const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `avocado-devops-finance-export-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported');
}

/* ---------------------------------------------------------
   RENDER ALL
--------------------------------------------------------- */
function renderAll() {
  renderDashboard();
  renderTransactions();
  renderCategories();
  renderPartners();
  renderReports();
}

/* ---------------------------------------------------------
   AUTH / CLOUD WIRING
--------------------------------------------------------- */
let liveSyncStarted = false;

function showScreen(name) {
  document.getElementById('loadingOverlay').style.display = name==='loading' ? 'flex' : 'none';
  document.getElementById('setupRequired').style.display = name==='setup' ? 'flex' : 'none';
  document.getElementById('loginScreen').style.display = name==='login' ? 'flex' : 'none';
  document.getElementById('appRoot').style.display = name==='app' ? 'grid' : 'none';
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  if(!email || !password){ errEl.textContent = 'Enter your email and password.'; errEl.style.display='block'; return; }
  try {
    await window.cloud.login(email, password);
  } catch(e) {
    errEl.textContent = 'Sign-in failed — check your email and password.';
    errEl.style.display = 'block';
  }
}
async function handleLogout() {
  liveSyncStarted = false;
  await window.cloud.logout();
}

async function enterApp() {
  showScreen('loading');
  await loadState();
  bizInput.value = state.businessName || '';
  const userEl = document.getElementById('currentUserLabel');
  if(userEl && window.cloud.user) userEl.textContent = window.cloud.user.email;
  const syncEl = document.getElementById('syncStatus');
  if(syncEl) {
    syncEl.textContent = '● Live-synced with your partners';
    syncEl.style.color = 'var(--positive)';
  }
  setTxType('income');
  renderAll();
  showScreen('app');

  if(!liveSyncStarted) {
    liveSyncStarted = true;
    window.cloud.subscribe((raw)=>{
      if(!raw) return;
      try {
        state = Object.assign(defaultState(), JSON.parse(raw));
        bizInput.value = state.businessName || '';
        renderAll();
      } catch(e) { console.error('Live update failed to parse', e); }
    });
  }
}

window.addEventListener('cloud-config-missing', ()=> showScreen('setup'));
window.addEventListener('cloud-auth-changed', (e)=>{
  if(e.detail.user) enterApp();
  else showScreen('login');
});

/* if Firebase module hasn't reported in shortly, assume config is missing */
setTimeout(()=>{
  if(typeof window.cloud === 'undefined' || (!window.cloud.ready && !window.cloud.login)) showScreen('setup');
}, 4000);

/* ---------------------------------------------------------
   INIT
--------------------------------------------------------- */
document.getElementById('loginPassword').addEventListener('keydown', (e)=>{ if(e.key==='Enter') handleLogin(); });
document.getElementById('loginEmail').addEventListener('keydown', (e)=>{ if(e.key==='Enter') document.getElementById('loginPassword').focus(); });

// Initialize theme on load
initTheme();

/* ---------------------------------------------------------
   EXPOSE TO WINDOW — required for onclick handlers in module scope
--------------------------------------------------------- */
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.toggleTheme = toggleTheme;
window.switchPage = switchPage;
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.saveTransaction = saveTransaction;
window.setTxType = setTxType;
window.openCategoryDrawer = openCategoryDrawer;
window.closeCategoryDrawer = closeCategoryDrawer;
window.setCatType = setCatType;
window.saveCategory = saveCategory;
window.openContribDrawer = openContribDrawer;
window.closeContribDrawer = closeContribDrawer;
window.saveContribution = saveContribution;
window.deleteTransaction = deleteTransaction;
window.deleteCategory = deleteCategory;
window.deleteContribution = deleteContribution;
window.updatePartnerName = updatePartnerName;
window.renderTransactions = renderTransactions;
window.renderReports = renderReports;
window.exportCSV = exportCSV;

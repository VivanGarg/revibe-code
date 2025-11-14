
const API = '/api';
function $(s){return document.querySelector(s)}
function $all(s){return Array.from(document.querySelectorAll(s))}
let TOKEN = null;

// nav wiring
$all('[data-view]').forEach(btn=>btn.addEventListener('click', ()=>{ $all('[data-view]').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderView(btn.dataset.view); }));
$all('.side-btn').forEach(btn=>btn.addEventListener('click', ()=>{ renderView(btn.dataset.view); }));

// login modal
$('#btnOpenLogin').addEventListener('click', ()=>$('#loginModal').classList.add('show'));
$('#loginClose').addEventListener('click', ()=>$('#loginModal').classList.remove('show'));
$('#btnRegister').addEventListener('click', async ()=>{ const u=$('#loginUser').value, p=$('#loginPass').value; if(!u||!p){$('#loginMsg').textContent='Enter username & password';return;} const r=await fetch(API+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})}); const j=await r.json(); $('#loginMsg').textContent = j.error || 'Registered — login now.'; });
$('#btnLogin').addEventListener('click', async ()=>{ const u=$('#loginUser').value, p=$('#loginPass').value; if(!u||!p){$('#loginMsg').textContent='Enter username & password';return;} const r=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})}); const j=await r.json(); if(j.token){ TOKEN=j.token; localStorage.setItem('ehrms_token',TOKEN); $('#loginMsg').textContent='Logged in'; $('#loginModal').classList.remove('show'); $('#btnOpenLogin').style.display='none'; $('#btnLogout').style.display='inline-block'; } else { $('#loginMsg').textContent = j.error || 'Login failed'; } });

// restore token
window.addEventListener('DOMContentLoaded', ()=>{ const t=localStorage.getItem('ehrms_token'); if(t){ TOKEN=t; $('#btnOpenLogin').style.display='none'; $('#btnLogout').style.display='inline-block'; } renderView('dashboard'); seedDemo(); });

$('#btnLogout').addEventListener('click', ()=>{ TOKEN=null; localStorage.removeItem('ehrms_token'); $('#btnOpenLogin').style.display='inline-block'; $('#btnLogout').style.display='none'; alert('Logged out'); });

// chat
$('#sendChat').addEventListener('click', ()=>{ const t=$('#chatInput').value; if(!t) return; addUserMsg(t); sendChatToServer(t); $('#chatInput').value=''; });
$('#chatInput').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#sendChat').click(); });

async function seedDemo(){ try{ await fetch(API + '/seed',{method:'POST'}); }catch(e){ console.warn('seed failed', e) } }

async function renderView(view){
  const main = $('#main'); main.innerHTML = '<div class="muted">Loading...</div>';
  if(view==='dashboard') return renderDashboard();
  if(view==='payroll') return renderPayroll();
  if(view==='employees') return renderEmployees();
  if(view==='profiles') return renderProfiles();
  if(view==='promotions') return renderPromotions();
  if(view==='chat') return renderChat();
  main.innerHTML = '<div class="muted">Unknown view</div>';
}

async function renderDashboard(){
  const main = $('#main');
  const stats = await (await fetch(API + '/stats')).json();
  main.innerHTML = ''
    + '<div class="dashboard-container">'
    + '<div class="dashboard-header"><h1>Employee HRMS Dashboard</h1><p>Manage your HR operations</p></div>'
    + '<div class="dashboard-grid-circular">'
    + '<div class="circle-card" onclick="renderView(\'payroll\')"><i class="icon ri-wallet-3-fill"></i><h3>Payroll</h3></div>'
    + '<div class="circle-card" onclick="renderView(\'profiles\')"><i class="icon ri-file-list-3-fill"></i><h3>Salary Slips</h3></div>'
    + '<div class="circle-card" onclick="renderView(\'profiles\')"><i class="icon ri-user-settings-fill"></i><h3>Job Profiles</h3></div>'
    + '<div class="circle-card" onclick="renderView(\'promotions\')"><i class="icon ri-bar-chart-fill"></i><h3>Promotions</h3></div>'
    + '<div class="circle-card" onclick="renderView(\'chat\')"><i class="icon ri-robot-fill"></i><h3>Chatbot</h3></div>'
    + '</div></div>';
}

async function renderPayroll(){
  const main = $('#main');
  main.innerHTML = '<h2>Payroll Management</h2><div class="muted">Generate payroll runs and view details</div><div style="display:flex;gap:12px;margin-top:12px"><div style="flex:1" id="payrollList"></div><div style="width:360px" class="card"><h4>Generate Payroll</h4><label class="muted">Month</label><input id="payMonth" type="month"><div style="display:flex;justify-content:flex-end;margin-top:8px"><button id="genBtn" class="btn primary">Generate</button></div></div></div>';
  document.getElementById('genBtn').addEventListener('click', async ()=>{ const m=document.getElementById('payMonth').value; if(!m) return alert('Select month'); const r=await authFetch('/payrolls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month:m})}); renderPayroll(); });
  const res = await fetch(API + '/payrolls'); const data = await res.json();
  var table = '<table><thead><tr><th>Month</th><th>#</th><th>Total Net</th><th>Actions</th></tr></thead><tbody>';
  data.forEach(function(p){ var total=0; p.items.forEach(function(i){ total+=i.net; }); table += '<tr><td>' + p.month + '</td><td>' + p.items.length + '</td><td>' + total + '</td><td><button class="btn ghost" onclick="previewPayroll(\'' + p.month + '\')">Preview</button></td></tr>'; });
  table += '</tbody></table>';
  document.getElementById('payrollList').innerHTML = table;
}

async function renderEmployees(){ const main = $('#main'); main.innerHTML = '<h2>Employees</h2><div class="muted">Employee directory</div><div id="empList" style="margin-top:12px"></div>'; const res = await fetch(API + '/employees'); const list = await res.json(); var table = '<table><thead><tr><th>Name</th><th>Role</th><th>Grade</th><th>Actions</th></tr></thead><tbody>'; list.forEach(function(e){ table += '<tr><td>' + e.name + '<div class="muted">' + e.id + '</div></td><td>' + e.role + '</td><td>' + e.grade + '</td><td><button class="btn ghost" onclick="viewEmployee(\'' + e.id + '\')">View</button></td></tr>'; }); table += '</tbody></table>'; document.getElementById('empList').innerHTML = table; }

async function renderProfiles(){ const main = $('#main'); main.innerHTML = '<h2>Job Profiles</h2><div class="muted">Edit profiles</div><div id="profileArea" style="margin-top:12px"></div>'; const res = await fetch(API + '/employees'); const list = await res.json(); var out = ''; list.forEach(function(e){ out += '<div class="card" style="margin-bottom:8px"><strong>' + e.name + ' (' + e.id + ')</strong><div class="muted">' + e.role + ' • ' + e.dept + '</div><div style="margin-top:8px"><button class="btn ghost" onclick="editProfile(\'' + e.id + '\')">Edit</button></div></div>'; }); document.getElementById('profileArea').innerHTML = out; }

async function renderPromotions(){ const main = $('#main'); main.innerHTML = '<h2>Promotion Management</h2><div class="muted">Propose and review promotions</div><div style="display:flex;gap:12px;margin-top:12px"><div style="flex:1" id="promoList"></div><div style="width:360px" class="card"><h4>New Proposal</h4><label class="muted">Employee</label><select id="promoEmp"></select><label class="muted">New Grade</label><input id="promoGrade"><div style="display:flex;justify-content:flex-end;margin-top:8px"><button id="createPromo" class="btn primary">Propose</button></div></div></div>'; const res = await fetch(API + '/promotions'); const promos = await res.json(); const emps = await (await fetch(API + '/employees')).json(); var table = '<table><thead><tr><th>Emp</th><th>Proposed</th><th>Status</th></tr></thead><tbody>'; promos.forEach(function(p){ table += '<tr><td>' + p.name + ' <div class="muted">' + p.emp + '</div></td><td>' + p.newGrade + '</td><td>' + p.status + '</td></tr>'; }); table += '</tbody></table>'; document.getElementById('promoList').innerHTML = table; var opts = ''; emps.forEach(function(e){ opts += '<option value="' + e.id + '">' + e.name + ' (' + e.id + ')</option>'; }); document.getElementById('promoEmp').innerHTML = opts; document.getElementById('createPromo').addEventListener('click', async ()=>{ const emp = document.getElementById('promoEmp').value; const g = document.getElementById('promoGrade').value; if(!g) return alert('Enter grade'); await authFetch('/promotions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emp,newGrade:g})}); renderPromotions(); }); }

function renderChat(){ const main = $('#main'); main.innerHTML = '<h2>Chat</h2><div class="muted">Use the chat on the right to ask questions</div>'; }

// helper functions triggered from UI
window.previewPayroll = async (month)=>{ try{ const res = await fetch(API + '/payrolls/' + month); const p = await res.json(); var rows = '<table><thead><tr><th>Employee</th><th>Gross</th><th>Ded</th><th>Net</th></tr></thead><tbody>'; p.items.forEach(function(i){ rows += '<tr><td>' + i.name + ' (' + i.emp + ')</td><td>' + i.gross + '</td><td>' + i.ded + '</td><td>' + i.net + '</td></tr>'; }); rows += '</tbody></table>'; showModal('Payroll: ' + month, rows); }catch(e){ alert('Failed to fetch payroll'); } };

window.viewEmployee = async (id)=>{ const res = await fetch(API + '/employees/' + id); const e = await res.json(); showModal(e.name, '<div><strong>' + e.name + ' (' + e.id + ')</strong><div class="muted">' + e.role + ' • ' + e.dept + '</div><div style="margin-top:8px">Salary: ' + e.salary + '</div><div style="margin-top:8px">Leave balance: ' + e.leave_balance + ' days</div></div>'); };

window.editProfile = async (id)=>{ const res = await fetch(API + '/employees/' + id); const e = await res.json(); showModal('Edit: ' + e.name, '<div><label class="muted">Role</label><input id="editRole" value="' + e.role + '"><label class="muted">Grade</label><input id="editGrade" value="' + e.grade + '"><label class="muted">Salary</label><input id="editSalary" value="' + e.salary + '" type="number"><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn primary" onclick="saveProfile(\'' + e.id + '\')">Save</button></div></div>'); };

window.saveProfile = async (id)=>{ const role = document.getElementById('editRole').value; const grade = document.getElementById('editGrade').value; const salary = Number(document.getElementById('editSalary').value); await authFetch('/employees/' + id, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({role,grade,salary})}); closeModal(); renderView('profiles'); };

function showModal(title, html){ document.getElementById('modalContent').innerHTML = '<h3>' + title + '</h3>' + html; document.getElementById('modal').classList.add('show'); }
function closeModal(){ document.getElementById('modal').classList.remove('show'); document.getElementById('modalContent').innerHTML = ''; }
function addUserMsg(text){ const w = document.getElementById('chatWindow'); const d = document.createElement('div'); d.className='msg user'; d.textContent = text; w.appendChild(d); w.scrollTop = w.scrollHeight; }
function addBotMsg(text){ const w = document.getElementById('chatWindow'); const d = document.createElement('div'); d.className='msg bot'; d.textContent = text; w.appendChild(d); w.scrollTop = w.scrollHeight; }

async function sendChatToServer(text){
  addUserMsg(text);
  try{
    const res = await fetch(API + '/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text})});
    const data = await res.json();
    addBotMsg(data.reply);
  }catch(e){ addBotMsg('Chat failed: ' + e.message); }
}

// authFetch helper attaches JWT
async function authFetch(path, opts={}){
  opts.headers = opts.headers || {};
  const token = TOKEN || localStorage.getItem('ehrms_token');
  if(token) opts.headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, opts);
  if(res.status===401){ alert('Not authorized — please login'); return null; }
  return res.json ? res : res;
}

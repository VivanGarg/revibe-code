// Simple frontend payroll manager using localStorage
// Data structures: employees[], attendance[], payslips[]

/* ---------- Persistence helpers ---------- */
const LS_EMP = "pay_employees_v1";
const LS_ATT = "pay_attendance_v1";
const LS_PAY = "pay_payslips_v1";

function loadData(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("load error", e);
    return fallback;
  }
}
function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/* ---------- In-memory data (backed by localStorage) ---------- */
let employees = loadData(LS_EMP, []);
let attendance = loadData(LS_ATT, []);
let payslips = loadData(LS_PAY, []);

/* ---------- DOM elements ---------- */
const empSelect = document.getElementById("attEmpSelect");
const paySelect = document.getElementById("payEmpSelect");
const empListEl = document.getElementById("employeeList");
const payslipListEl = document.getElementById("payslipList");
const totalEmployeesEl = document.getElementById("totalEmployees");
const totalPayrollEl = document.getElementById("totalPayroll");
const pendingPayslipsEl = document.getElementById("pendingPayslips");

/* ---------- Init UI ---------- */
function initUI() {
  populateEmployeeSelects();
  renderEmployeeList();
  renderPayslipList();
  updateSummaries();
  renderChart();
}
initUI();

/* ---------- Employee management ---------- */
function saveEmployee() {
  const name = document.getElementById("empName").value.trim();
  const id = document.getElementById("empId").value.trim();
  const basic = Number(document.getElementById("basic").value) || 0;
  const hra = Number(document.getElementById("hra").value) || 0;
  const allowance = Number(document.getElementById("allowance").value) || 0;
  const pfApplicable = document.getElementById("pfApplicable").value === "yes";

  if (!name || !id) {
    alert("Please provide name and employee id");
    return;
  }

  // upsert by id
  const existing = employees.find(e => e.id === id);
  if (existing) {
    existing.name = name;
    existing.basic = basic;
    existing.hra = hra;
    existing.allowance = allowance;
    existing.pfApplicable = pfApplicable;
  } else {
    employees.push({ id, name, basic, hra, allowance, pfApplicable });
  }

  saveData(LS_EMP, employees);
  populateEmployeeSelects();
  renderEmployeeList();
  updateSummaries();
  clearEmployeeForm();
  alert("Employee saved.");
}

function clearEmployeeForm() {
  document.getElementById("empName").value = "";
  document.getElementById("empId").value = "";
  document.getElementById("basic").value = "";
  document.getElementById("hra").value = "";
  document.getElementById("allowance").value = "";
}

function populateEmployeeSelects() {
  const makeOptions = (sel) => {
    sel.innerHTML = "";
    const empty = document.createElement("option");
    empty.textContent = "-- Select employee --";
    empty.value = "";
    sel.appendChild(empty);
    employees.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = `${e.name} (${e.id})`;
      sel.appendChild(opt);
    });
  };
  makeOptions(empSelect);
  makeOptions(paySelect);
}

/* ---------- Attendance ---------- */
function saveAttendance() {
  const empId = document.getElementById("attEmpSelect").value;
  const present = Number(document.getElementById("presentDays").value) || 0;
  const overtime = Number(document.getElementById("overtimeAmt").value) || 0;

  if (!empId) { alert("Select employee"); return; }
  const emp = employees.find(e => e.id === empId);
  if (!emp) { alert("Employee not found"); return; }

  // upsert attendance by empId
  const existing = attendance.find(a => a.empId === empId);
  if (existing) {
    existing.present = present;
    existing.overtime = overtime;
    existing.timestamp = Date.now();
  } else {
    attendance.push({ empId, present, overtime, timestamp: Date.now() });
  }
  saveData(LS_ATT, attendance);
  renderAttendanceList();
  updateSummaries();
  clearAttendanceForm();
  alert("Attendance recorded.");
}

function clearAttendanceForm() {
  document.getElementById("presentDays").value = "";
  document.getElementById("overtimeAmt").value = "";
  document.getElementById("attEmpSelect").selectedIndex = 0;
}

function renderAttendanceList() {
  // not a visible dedicated list, but employee list shows attendance info
  renderEmployeeList();
}

/* ---------- Payroll logic ---------- */
/*
 Basic approach:
 - Calculate per-day basic = basic / 30
 - Earned basic = per-day-basic * presentDays
 - Gross = earnedBasic + hra + allowance + overtime
 - PF = (pfApplicable ? earnedBasic * 0.12 : 0)
 - ESI = gross < 21000 ? gross * 0.0075 : 0
 - TDS omitted for simplicity (front-end only)
 - Net = gross - (PF + ESI)
*/

function calculatePayroll(emp, att) {
  const perDay = (emp.basic || 0) / 30;
  const earnedBasic = perDay * ((att && att.present) || 0);
  const gross = earnedBasic + (emp.hra || 0) + (emp.allowance || 0) + ((att && att.overtime) || 0);
  const pf = emp.pfApplicable ? earnedBasic * 0.12 : 0;
  const esi = gross < 21000 ? gross * 0.0075 : 0;
  const deductions = pf + esi;
  const net = gross - deductions;
  return {
    earnedBasic, gross, pf, esi, deductions, net
  };
}

function generatePayslip() {
  const empId = document.getElementById("payEmpSelect").value;
  if (!empId) { alert("Select employee"); return; }
  const emp = employees.find(e => e.id === empId);
  const att = attendance.find(a => a.empId === empId) || { present: 0, overtime: 0 };

  const calc = calculatePayroll(emp, att);
  const payslip = {
    id: `${empId}-${Date.now()}`,
    empId: emp.id,
    name: emp.name,
    period: new Date().toLocaleString(),
    basic: emp.basic,
    hra: emp.hra,
    allowance: emp.allowance,
    present: att.present,
    overtime: att.overtime,
    earnedBasic: calc.earnedBasic,
    gross: calc.gross,
    pf: calc.pf,
    esi: calc.esi,
    deductions: calc.deductions,
    net: calc.net
  };

  // save payslip
  payslips.unshift(payslip);
  saveData(LS_PAY, payslips);

  // render preview and provide download button
  renderPayslipPreview(payslip);
  renderPayslipList();
  updateSummaries();
}

function generateAllPayslips() {
  // For all employees with attendance, generate payslips
  const generated = [];
  employees.forEach(emp => {
    const att = attendance.find(a => a.empId === emp.id);
    if (!att) return;
    const calc = calculatePayroll(emp, att);
    const payslip = {
      id: `${emp.id}-${Date.now() + Math.floor(Math.random()*1000)}`,
      empId: emp.id, name: emp.name,
      period: new Date().toLocaleString(),
      basic: emp.basic, hra: emp.hra, allowance: emp.allowance,
      present: att.present, overtime: att.overtime,
      earnedBasic: calc.earnedBasic, gross: calc.gross,
      pf: calc.pf, esi: calc.esi, deductions: calc.deductions, net: calc.net
    };
    payslips.unshift(payslip);
    generated.push(payslip);
  });
  saveData(LS_PAY, payslips);
  renderPayslipList();
  updateSummaries();
  alert(`Generated ${generated.length} payslip(s).`);
}

/* ---------- Render UI pieces ---------- */
function renderEmployeeList() {
  empListEl.innerHTML = "";
  employees.forEach(e => {
    const att = attendance.find(a => a.empId === e.id);
    const container = document.createElement("div");
    container.className = "item";
    container.innerHTML = `<div><strong>${e.name}</strong><br><small>ID: ${e.id}</small></div>
      <div style="text-align:right">
        <div>${e.basic ? '₹' + e.basic.toFixed(0) : '-'}</div>
        <div style="font-size:0.82rem;color:#666">${att ? `${att.present}d` : 'No attendance'}</div>
        <div style="margin-top:6px">
          <button onclick="prefillEmployee('${e.id}')" style="margin-right:6px">Edit</button>
          <button onclick="deleteEmployee('${e.id}')" class="muted">Delete</button>
        </div>
      </div>`;
    empListEl.appendChild(container);
  });
}

function renderPayslipList() {
  payslipListEl.innerHTML = "";
  payslips.slice(0, 12).forEach(p => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `<div><strong>${p.name}</strong><br><small>${p.empId}</small></div>
      <div style="text-align:right">
        <div>${p.net ? '₹' + p.net.toFixed(2) : '-'}</div>
        <div style="font-size:0.82rem;color:#666">${new Date(p.id.split('-').slice(-1)[0] - 0).toLocaleDateString()}</div>
        <div style="margin-top:6px">
          <button onclick='downloadPayslip("${p.id}")'>Download</button>
        </div>
      </div>`;
    payslipListEl.appendChild(el);
  });
}

function renderPayslipPreview(p) {
  const container = document.getElementById("payslipPreview");
  container.classList.remove("hidden");
  container.innerHTML = payslipHTML(p) + `<div style="margin-top:8px"><button onclick='downloadPayslip("${p.id}")'>Download PDF</button></div>`;
  // Save the HTML snapshot in DOM so pdf can render
}

/* ---------- Employee helpers ---------- */
function prefillEmployee(empId) {
  const e = employees.find(x => x.id === empId);
  if (!e) return;
  document.getElementById("empName").value = e.name;
  document.getElementById("empId").value = e.id;
  document.getElementById("basic").value = e.basic;
  document.getElementById("hra").value = e.hra;
  document.getElementById("allowance").value = e.allowance;
  document.getElementById("pfApplicable").value = e.pfApplicable ? "yes" : "no";
}

function deleteEmployee(empId) {
  if (!confirm("Delete this employee?")) return;
  employees = employees.filter(e => e.id !== empId);
  attendance = attendance.filter(a => a.empId !== empId);
  payslips = payslips.filter(p => p.empId !== empId);
  saveData(LS_EMP, employees);
  saveData(LS_ATT, attendance);
  saveData(LS_PAY, payslips);
  populateEmployeeSelects();
  renderEmployeeList();
  renderPayslipList();
  updateSummaries();
}

/* ---------- Payslip HTML template + PDF ---------- */
function payslipHTML(p) {
  return `
  <div id="payslip-${p.id}" style="width:800px;padding:20px;font-family:Arial;border:1px solid #ddd;background:#fff">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div>
        <h2 style="margin:0">Payslip</h2>
        <div style="color:#666">${p.period}</div>
      </div>
      <div style="text-align:right">
        <img src="/mnt/data/73cc13d6-d4cd-491a-8ce8-2750d26ff415.png" style="height:60px;object-fit:cover" alt="banner"/>
      </div>
    </div>

    <div style="display:flex;gap:20px;margin-top:8px">
      <div style="flex:1">
        <strong>${p.name}</strong><br/>
        <small>ID: ${p.empId}</small><br/>
      </div>
      <div style="width:220px">
        <table style="width:100%;font-size:0.95rem">
          <tr><td>Basic</td><td style="text-align:right">₹${p.basic.toFixed(2)}</td></tr>
          <tr><td>HRA</td><td style="text-align:right">₹${p.hra.toFixed(2)}</td></tr>
          <tr><td>Allowance</td><td style="text-align:right">₹${p.allowance.toFixed(2)}</td></tr>
          <tr><td>Overtime</td><td style="text-align:right">₹${p.overtime.toFixed(2)}</td></tr>
          <tr style="border-top:1px solid #eee"><td><strong>Gross</strong></td><td style="text-align:right"><strong>₹${p.gross.toFixed(2)}</strong></td></tr>
        </table>
      </div>
    </div>

    <div style="display:flex;gap:20px;margin-top:12px">
      <div style="flex:1">
        <table style="width:100%;font-size:0.95rem">
          <tr><td>PF</td><td style="text-align:right">₹${p.pf.toFixed(2)}</td></tr>
          <tr><td>ESI</td><td style="text-align:right">₹${p.esi.toFixed(2)}</td></tr>
          <tr style="border-top:1px solid #eee"><td><strong>Deductions</strong></td><td style="text-align:right"><strong>₹${p.deductions.toFixed(2)}</strong></td></tr>
        </table>
      </div>
      <div style="width:220px">
        <div style="background:#fafafa;padding:10px;border-radius:6px;text-align:center">
          <div style="color:#666;font-size:0.9rem">Net Pay</div>
          <div style="font-size:1.3rem;font-weight:700">₹${p.net.toFixed(2)}</div>
        </div>
      </div>
    </div>
  </div>
  `;
}

async function downloadPayslip(payslipId) {
  const p = payslips.find(x => x.id === payslipId);
  if (!p) {
    alert("Payslip not found.");
    return;
  }
  // Create DOM node for html2canvas
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-9999px";
  wrapper.innerHTML = payslipHTML(p);
  document.body.appendChild(wrapper);

  await html2canvas(wrapper, { scale: 2 }).then(canvas => {
    const imgData = canvas.toDataURL("image/png");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: [canvas.width, canvas.height]
    });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`payslip_${p.empId}.pdf`);
  }).catch(err=>{
    console.error(err);
    alert("PDF generation failed.");
  }).finally(()=>{
    document.body.removeChild(wrapper);
  });
}

/* ---------- Summary and chart ---------- */
function updateSummaries() {
  totalEmployeesEl.textContent = employees.length;
  const currentPayroll = payslips.reduce((s,p)=> s + (p.net||0), 0);
  totalPayrollEl.textContent = `₹${currentPayroll.toFixed(2)}`;
  pendingPayslipsEl.textContent = attendance.length;
  renderEmployeeList();
  renderPayslipList();
  renderChart();
}

let chartInstance = null;
function renderChart() {
  const ctx = document.getElementById('payChart').getContext('2d');
  const labels = employees.map(e => e.name);
  const data = employees.map(e=>{
    const att = attendance.find(a=>a.empId===e.id);
    if (!att) return 0;
    const calc = calculatePayroll(e, att);
    return Number(calc.net.toFixed(2));
  });

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Net Salary (₹)',
        data: data
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero:true } }
    }
  });
}

/* ---------- Utilities ---------- */
function renderPayslipList() { /* replaced earlier, ensure consistency */ 
  payslipListEl.innerHTML = "";
  payslips.slice(0, 12).forEach(p => {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `<div><strong>${p.name}</strong><br><small>${p.empId}</small></div>
      <div style="text-align:right">
        <div>${p.net ? '₹' + p.net.toFixed(2) : '-'}</div>
        <div style="font-size:0.82rem;color:#666">${new Date(pillDateFromId(p.id)).toLocaleString()}</div>
        <div style="margin-top:6px">
          <button onclick='downloadPayslip("${p.id}")'>Download</button>
        </div>
      </div>`;
    payslipListEl.appendChild(el);
  });
}
function pillDateFromId(id) {
  const parts = id.split('-');
  return Number(parts[parts.length-1]) || Date.now();
}

/* ensure initial UI updated */
updateSummaries();

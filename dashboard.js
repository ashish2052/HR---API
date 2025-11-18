/* ============================================================
   CONFIG
============================================================ */

const API_URL = "https://hr-api.ashishoct34.workers.dev/";

/* Stable FX values (local, no API needed) */
let FX = {
  "NPR": 1,
  "USD": 135,
  "AUD": 90,
  "INR": 1.6
};

/* GLOBAL DATA */
let EMPLOYEES = [];

/* ============================================================
   MAIN LOAD FUNCTION
============================================================ */

window.addEventListener("DOMContentLoaded", async () => {
  console.log("Loading HR dashboard…");

  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    EMPLOYEES = data.employees.map(e => normalizeEmployee(e));

    console.log("Loaded employees:", EMPLOYEES.length);

    /* Render everything */
    renderKPIs(data);
    renderTenure();
    renderCharts(data);
    renderProbationTable();
    renderPeopleTable(EMPLOYEES);
    populateFilters(EMPLOYEES);
    renderCompensation(EMPLOYEES);

    initTabs();
    initCardClicks();
    initSearchFilter();

  } catch (err) {
    console.error("Dashboard load error:", err);
  }
});

/* ============================================================
   EMPLOYEE NORMALIZATION
============================================================ */
function normalizeEmployee(e) {
  const joining = e.joining_date ? new Date(e.joining_date) : null;
  const probEnd = e.probation_end ? new Date(e.probation_end) : null;

  /* Tenure months */
  let tenureMonths = 0;
  if (joining) {
    const now = new Date();
    tenureMonths = (now.getFullYear() - joining.getFullYear()) * 12 +
                   (now.getMonth() - joining.getMonth());
  }

  /* Birthday helpers */
  let dob = e.dob ? new Date(e.dob) : null;
  let birthdayMonth = dob ? dob.getMonth() + 1 : null;
  let birthdayDay = dob ? dob.getDate() : null;

  /* Probation logic */
  let status = e.status;
  if (e.probation_end) {
    const today = new Date();
    if (new Date(e.probation_end) > today && e.status === "Active") {
      status = "Probation";
    }
  }

  return {
    ...e,
    tenureMonths,
    birthdayMonth,
    birthdayDay,
    status,
    salary_npr: e.last_salary * (FX[e.salary_fx] || 1)
  };
}

/* ============================================================
   RENDER KPIs
============================================================ */
function renderKPIs(api) {
  const employees = EMPLOYEES;
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const total = employees.length;
  const active = employees.filter(e => e.status === "Active" || e.status === "Probation").length;
  const inactive = employees.filter(e => e.status === "Inactive").length;

  const probation = employees.filter(e => e.status === "Probation").length;

  const probationEndingMonth = employees.filter(e =>
    e.status === "Probation" &&
    e.probation_end &&
    new Date(e.probation_end).getMonth() + 1 === month
  ).length;

  const birthdaysToday = employees.filter(e =>
    e.birthdayMonth === month && e.birthdayDay === day
  ).length;

  const birthdaysThisMonth = employees.filter(e =>
    e.birthdayMonth === month
  ).length;

  /* Fill UI */
  setText("kpiTotal", total);
  setText("kpiActive", active);
  setText("kpiInactive", inactive);
  setText("kpiAttr", ((inactive / total) * 100).toFixed(1) + "%");
  setText("kpiProbation", probation);
  setText("kpiProbEndingMonth", probationEndingMonth);

  /* Birthday combined card */
  setText("kpiBdayTotal", birthdaysThisMonth);
  setText("kpiBdayToday", birthdaysToday);
  setText("kpiBdayMonth", birthdaysThisMonth);
}

/* ============================================================
   TENURE SUMMARY
============================================================ */
function renderTenure() {
  const t0_3 = EMPLOYEES.filter(e => e.tenureMonths < 3).length;
  const t3_12 = EMPLOYEES.filter(e => e.tenureMonths >= 3 && e.tenureMonths < 12).length;
  const t12_24 = EMPLOYEES.filter(e => e.tenureMonths >= 12 && e.tenureMonths < 24).length;
  const t24p = EMPLOYEES.filter(e => e.tenureMonths >= 24).length;

  setText("tenure0_3", t0_3);
  setText("tenure3_12", t3_12);
  setText("tenure12_24", t12_24);
  setText("tenure24p", t24p);
}

/* ============================================================
   TENURE CHART + OTHERS
============================================================ */
function renderCharts(api) {
  /* Department */
  const dept = api.breakdowns.by_department;
  new Chart(document.getElementById("deptChart"), {
    type: "bar",
    data: {
      labels: Object.keys(dept),
      datasets: [{
        data: Object.values(dept)
      }]
    }
  });

  /* Gender */
  const gender = api.breakdowns.by_gender;
  new Chart(document.getElementById("genderChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(gender),
      datasets: [{
        data: Object.values(gender)
      }]
    }
  });

  /* Age */
  const ageBuckets = groupAges(EMPLOYEES);
  new Chart(document.getElementById("ageChart"), {
    type: "bar",
    data: {
      labels: Object.keys(ageBuckets),
      datasets: [{
        data: Object.values(ageBuckets)
      }]
    }
  });

  /* Tenure */
  const t0_3 = EMPLOYEES.filter(e => e.tenureMonths < 3).length;
  const t3_12 = EMPLOYEES.filter(e => e.tenureMonths >= 3 && e.tenureMonths < 12).length;
  const t12_24 = EMPLOYEES.filter(e => e.tenureMonths >= 12 && e.tenureMonths < 24).length;
  const t24p = EMPLOYEES.filter(e => e.tenureMonths >= 24).length;

  new Chart(document.getElementById("tenureChart"), {
    type: "bar",
    data: {
      labels: ["0–3m", "3–12m", "12–24m", "24m+"],
      datasets: [{
        data: [t0_3, t3_12, t12_24, t24p]
      }]
    }
  });
}

/* ============================================================
   PROBATION TABLE
============================================================ */
function renderProbationTable() {
  const now = new Date();
  const tbody = document.getElementById("probationTableBody");
  tbody.innerHTML = "";

  EMPLOYEES.filter(e => e.status === "Probation").forEach(e => {
    const end = new Date(e.probation_end);
    const daysLeft = Math.round((end - now) / (1000 * 60 * 60 * 24));

    const row = `
      <tr>
        <td>${e.name}</td>
        <td>${e.department}</td>
        <td>${formatDate(e.probation_end)}</td>
        <td>${daysLeft}</td>
      </tr>
    `;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

/* ============================================================
   PEOPLE TABLE
============================================================ */
function renderPeopleTable(list) {
  const tbody = document.getElementById("employeeTableBody");
  tbody.innerHTML = "";

  list.forEach(e => {
    const row = `
      <tr>
        <td>${e.id}</td>
        <td>${e.name}</td>
        <td>${e.designation}</td>
        <td>${e.department}</td>
        <td>${e.country}</td>
        <td><span class="status-pill status-${e.status.toLowerCase()}">${e.status}</span></td>
        <td>${formatDate(e.joining_date)}</td>
        <td>${formatDate(e.probation_end)}</td>
        <td>${formatNumber(e.salary_npr)}</td>
        <td>${e.salary_fx}</td>
      </tr>
    `;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

/* ============================================================
   FILTER POPULATION
============================================================ */
function populateFilters(list) {
  const deptFilter = document.getElementById("filterDept");
  const countryFilter = document.getElementById("filterCountry");

  const depts = [...new Set(list.map(e => e.department))];
  const countries = [...new Set(list.map(e => e.country))];

  depts.forEach(d => deptFilter.insertAdjacentHTML("beforeend", `<option>${d}</option>`));
  countries.forEach(c => countryFilter.insertAdjacentHTML("beforeend", `<option>${c}</option>`));
}

/* ============================================================
   SEARCH + FILTERS
============================================================ */
function initSearchFilter() {
  const searchInput = document.getElementById("searchInput");
  const filterStatus = document.getElementById("filterStatus");
  const filterDept = document.getElementById("filterDept");
  const filterCountry = document.getElementById("filterCountry");

  function applyFilters() {
    let filtered = EMPLOYEES;

    /* Search */
    const s = searchInput.value.toLowerCase();
    if (s) {
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(s) ||
        e.id.toLowerCase().includes(s) ||
        e.designation.toLowerCase().includes(s)
      );
    }

    /* Status */
    if (filterStatus.value) {
      filtered = filtered.filter(e => e.status === filterStatus.value);
    }

    /* Department */
    if (filterDept.value) {
      filtered = filtered.filter(e => e.department === filterDept.value);
    }

    /* Country */
    if (filterCountry.value) {
      filtered = filtered.filter(e => e.country === filterCountry.value);
    }

    renderPeopleTable(filtered);
  }

  searchInput.addEventListener("input", applyFilters);
  filterStatus.addEventListener("change", applyFilters);
  filterDept.addEventListener("change", applyFilters);
  filterCountry.addEventListener("change", applyFilters);
}

/* ============================================================
   CARD CLICKS (Go to People tab + filter automatically)
============================================================ */
function initCardClicks() {
  const showPeopleTab = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

    document.querySelector('[data-tab="people"]').classList.add("active");
    document.getElementById("tab-people").classList.add("active");
  };

  /* KPI: Active */
  document.getElementById("kpiActiveCard").onclick = () => {
    showPeopleTab();
    document.getElementById("filterStatus").value = "Active";
    document.getElementById("filterStatus").dispatchEvent(new Event("change"));
  };

  /* KPI: Probation */
  document.getElementById("kpiProbCard").onclick = () => {
    showPeopleTab();
    document.getElementById("filterStatus").value = "Probation";
    document.getElementById("filterStatus").dispatchEvent(new Event("change"));
  };

  /* Tenure filters */
  const tenureMap = {
    "tenure0_3_card": (e) => e.tenureMonths < 3,
    "tenure3_12_card": (e) => e.tenureMonths >= 3 && e.tenureMonths < 12,
    "tenure12_24_card": (e) => e.tenureMonths >= 12 && e.tenureMonths < 24,
    "tenure24p_card": (e) => e.tenureMonths >= 24
  };

  Object.keys(tenureMap).forEach(id => {
    document.getElementById(id).onclick = () => {
      showPeopleTab();
      const filtered = EMPLOYEES.filter(tenureMap[id]);
      renderPeopleTable(filtered);
    };
  });
}

/* ============================================================
   COMPENSATION SUMMARY
============================================================ */
function renderCompensation(list) {
  const totalPayroll = list.reduce((a, e) => a + e.salary_npr, 0);
  const avgSalary = Math.round(totalPayroll / list.length);

  setText("totalPayrollNPR", formatNumber(totalPayroll));
  setText("avgSalaryNPR", formatNumber(avgSalary));

  /* Country wise */
  const map = {};
  list.forEach(e => {
    if (!map[e.country]) map[e.country] = { count: 0, payroll: 0 };
    map[e.country].count++;
    map[e.country].payroll += e.salary_npr;
  });

  const tbody = document.getElementById("countryPayrollBody");
  tbody.innerHTML = "";

  Object.keys(map).forEach(country => {
    tbody.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${country}</td>
        <td>${map[country].count}</td>
        <td>${formatNumber(map[country].payroll)}</td>
      </tr>
    `);
  });
}

/* ============================================================
   HELPERS
============================================================ */
function formatDate(dt) {
  if (!dt) return "-";
  return new Date(dt).toISOString().split("T")[0];
}

function formatNumber(n) {
  return Number(n).toLocaleString("en-IN");
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function groupAges(list) {
  const b = { "<25": 0, "25-34": 0, "35-44": 0, "45+": 0 };
  list.forEach(e => {
    if (!e.dob) return;
    const age = new Date().getFullYear() - new Date(e.dob).getFullYear();

    if (age < 25) b["<25"]++;
    else if (age < 35) b["25-34"]++;
    else if (age < 45) b["35-44"]++;
    else b["45+"]++;
  });
  return b;
}

/* ============================================================
   TABS
============================================================ */
function initTabs() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.onclick = () => {
      const selected = tab.getAttribute("data-tab");

      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(`tab-${selected}`).classList.add("active");
    };
  });
}

// Income, Expense, Savings & Smart Budget Tracker - Pure Vanilla JS (Clean Start Version)
(function () {
  'use strict';

  const STORAGE_KEY = 'income_expense_tracker_clean_v4';

  const CATEGORIES = {
    income: [
      'Salary / Payroll',
      'Business Income',
      'Freelance / Side Hustle',
      'Bonus / Commission',
      'Remittance / Transfer',
      'Other Income'
    ],
    expense: [
      'Food & Groceries',
      'Utilities & Internet',
      'Transport & Fuel',
      'Rent & Housing',
      'Education & Allowance',
      'Healthcare & Medicine',
      'Bills & Loan Payments',
      'Savings Deposit / Transfer',
      'Other Expenses'
    ]
  };

  const ESSENTIAL_CATEGORIES = [
    'Food & Groceries',
    'Utilities & Internet',
    'Transport & Fuel',
    'Rent & Housing',
    'Education & Allowance',
    'Healthcare & Medicine',
    'Bills & Loan Payments'
  ];

  // Optional sample data ONLY loaded when the user clicks "Load Sample Data"
  const SAMPLE_RECORDS = [
    {
      id: 'rec-101',
      date: '2026-11-01',
      type: 'income',
      category: 'Salary / Payroll',
      description: 'First bi-monthly salary (November)',
      amount: 18500,
      account: 'Bank / ATM'
    },
    {
      id: 'rec-102',
      date: '2026-11-03',
      type: 'expense',
      category: 'Food & Groceries',
      description: 'Weekly supermarket groceries and produce',
      amount: 3250,
      account: 'Cash'
    },
    {
      id: 'rec-103',
      date: '2026-11-05',
      type: 'expense',
      category: 'Utilities & Internet',
      description: 'Electricity and fiber internet bill',
      amount: 3890,
      account: 'E-Wallet'
    }
  ];

  const SAMPLE_SAVINGS_GOALS = [
    {
      id: 'goal-1',
      name: 'Emergency Fund',
      purpose: '3 months safety buffer for unexpected bills or medical needs',
      targetAmount: 30000,
      savedAmount: 3700,
      targetDate: '2027-05-15',
      priority: 'High'
    }
  ];

  const SAMPLE_SAVINGS_RECORDS = [
    {
      id: 'srec-1',
      date: '2026-11-01',
      goalId: 'goal-1',
      goalName: 'Emergency Fund',
      type: 'deposit',
      amount: 3700,
      note: '20% allocation from salary'
    }
  ];

  const PAGE_TITLES = {
    'tab-home': 'Home Overview',
    'tab-records': 'Records & Transactions',
    'tab-savings': 'Savings Goals & Ledger',
    'tab-calculator': 'Built-in Calculator & Goal Planner',
    'tab-recommendations': 'Smart Budgeting Recommendations',
    'tab-summary': 'Monthly & Weekly Reports',
    'tab-files': 'Save & Load Files',
    'tab-history': 'Activity History'
  };

  const state = {
    records: [],
    savingsGoals: [],
    savingsRecords: [],
    history: [],
    lastDeletedRecord: null,
    editingId: null,
    editingGoalId: null,
    selectedType: 'income',
    activeTab: 'tab-home',
    chartMode: 'monthly',
    pendingConfirmAction: null,
    calcExpression: '',
    calcDisplay: '0',
    calcTape: []
  };

  function getTodayIso() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function safeLoadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state.records = Array.isArray(parsed.records) ? parsed.records : [];
        state.savingsGoals = Array.isArray(parsed.savingsGoals) ? parsed.savingsGoals : [];
        state.savingsRecords = Array.isArray(parsed.savingsRecords) ? parsed.savingsRecords : [];
        state.history = Array.isArray(parsed.history) ? parsed.history : [];
        return;
      }
    } catch (err) {
      // Ignore storage read errors
    }
    // Start completely empty by default (no automatic dummy data)
    state.records = [];
    state.savingsGoals = [];
    state.savingsRecords = [];
    state.history = [];
  }

  function safeSaveStorage() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          records: state.records,
          savingsGoals: state.savingsGoals,
          savingsRecords: state.savingsRecords,
          history: state.history,
          updatedAt: new Date().toISOString()
        })
      );
    } catch (err) {
      // Ignore storage restrictions
    }
  }

  function logHistory(action, details) {
    const now = new Date();
    const pad = function (n) { return String(n).padStart(2, '0'); };
    const stamp =
      now.getFullYear() + '-' +
      pad(now.getMonth() + 1) + '-' +
      pad(now.getDate()) + ' ' +
      pad(now.getHours()) + ':' +
      pad(now.getMinutes());
    state.history.unshift({
      id: 'hist-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: stamp,
      action: action,
      details: details
    });
    if (state.history.length > 120) {
      state.history.length = 120;
    }
    safeSaveStorage();
  }

  function formatCurrency(val) {
    const num = Number(val) || 0;
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    return sign + '₱' + abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
  }

  function getWeekStartAndEnd(dateStr) {
    const fallback = getTodayIso();
    const parts = (dateStr || fallback).split('-').map(Number);
    const d = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = function (dt) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const dayNum = String(dt.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + dayNum;
    };
    return {
      weekKey: fmt(monday),
      start: fmt(monday),
      end: fmt(sunday),
      label: fmt(monday) + ' to ' + fmt(sunday)
    };
  }

  function getMonthLabel(ym) {
    const names = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const parts = (ym || '').split('-');
    if (parts.length < 2) return ym;
    const mIdx = parseInt(parts[1], 10) - 1;
    return (names[mIdx] || parts[1]) + ' ' + parts[0];
  }

  function populateCategoryOptions() {
    const selectEl = document.getElementById('recordCategory');
    const filterCatEl = document.getElementById('filterCategory');
    if (selectEl) {
      const list = CATEGORIES[state.selectedType] || CATEGORIES.income;
      const currentVal = selectEl.value;
      selectEl.innerHTML = '';
      list.forEach(function (cat) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        selectEl.appendChild(opt);
      });
      if (list.indexOf(currentVal) !== -1) {
        selectEl.value = currentVal;
      }
    }
    if (filterCatEl) {
      const prev = filterCatEl.value || 'all';
      const allCats = CATEGORIES.income.concat(CATEGORIES.expense);
      filterCatEl.innerHTML = '<option value="all">All Categories</option>';
      allCats.forEach(function (cat) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterCatEl.appendChild(opt);
      });
      filterCatEl.value = prev;
    }
  }

  function setTransactionType(type) {
    state.selectedType = type === 'expense' ? 'expense' : 'income';
    const btnInc = document.getElementById('typeBtnIncome');
    const btnExp = document.getElementById('typeBtnExpense');
    if (btnInc && btnExp) {
      btnInc.className = 'type-radio-btn ' + (state.selectedType === 'income' ? 'active-income' : '');
      btnExp.className = 'type-radio-btn ' + (state.selectedType === 'expense' ? 'active-expense' : '');
    }
    populateCategoryOptions();
  }

  function getFilteredRecords() {
    const searchVal = (document.getElementById('filterSearch')?.value || '').trim().toLowerCase();
    const typeVal = document.getElementById('filterType')?.value || 'all';
    const catVal = document.getElementById('filterCategory')?.value || 'all';
    const monthVal = document.getElementById('filterMonth')?.value || '';
    const sortVal = document.getElementById('filterSort')?.value || 'date-desc';

    const filtered = state.records.filter(function (r) {
      if (typeVal !== 'all' && r.type !== typeVal) return false;
      if (catVal !== 'all' && r.category !== catVal) return false;
      if (monthVal && (!r.date || !r.date.startsWith(monthVal))) return false;
      if (searchVal) {
        const hay = ((r.description || '') + ' ' + (r.category || '') + ' ' + (r.account || '') + ' ' + (r.date || '')).toLowerCase();
        if (hay.indexOf(searchVal) === -1) return false;
      }
      return true;
    });

    filtered.sort(function (a, b) {
      if (sortVal === 'date-asc') return (a.date || '').localeCompare(b.date || '');
      if (sortVal === 'amount-desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (sortVal === 'amount-asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      return (b.date || '').localeCompare(a.date || '');
    });

    return filtered;
  }

  function computeAggregates() {
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    const refDateInput = document.getElementById('referenceDateInput');
    const refDate = (refDateInput && refDateInput.value) ? refDateInput.value : getTodayIso();
    const refMonth = refDate.slice(0, 7);
    const refWeek = getWeekStartAndEnd(refDate);

    let weekIncome = 0;
    let weekExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;

    const monthlyMap = {};
    const weeklyMap = {};
    const categoryExpenseMap = {};

    state.records.forEach(function (r) {
      const amt = Number(r.amount) || 0;
      const isInc = r.type === 'income';
      if (isInc) {
        totalIncome += amt;
        incomeCount += 1;
      } else {
        totalExpense += amt;
        expenseCount += 1;
        categoryExpenseMap[r.category] = (categoryExpenseMap[r.category] || 0) + amt;
      }

      const dStr = r.date || refDate;
      const ym = dStr.slice(0, 7);
      if (!monthlyMap[ym]) {
        monthlyMap[ym] = { month: ym, income: 0, expense: 0, count: 0 };
      }
      if (isInc) monthlyMap[ym].income += amt;
      else monthlyMap[ym].expense += amt;
      monthlyMap[ym].count += 1;

      if (ym === refMonth) {
        if (isInc) monthIncome += amt;
        else monthExpense += amt;
      }

      const wk = getWeekStartAndEnd(dStr);
      if (!weeklyMap[wk.weekKey]) {
        weeklyMap[wk.weekKey] = {
          weekKey: wk.weekKey,
          label: wk.label,
          income: 0,
          expense: 0,
          count: 0
        };
      }
      if (isInc) weeklyMap[wk.weekKey].income += amt;
      else weeklyMap[wk.weekKey].expense += amt;
      weeklyMap[wk.weekKey].count += 1;

      if (wk.weekKey === refWeek.weekKey) {
        if (isInc) weekIncome += amt;
        else weekExpense += amt;
      }
    });

    const monthlyList = Object.keys(monthlyMap)
      .sort(function (a, b) { return b.localeCompare(a); })
      .map(function (k) { return monthlyMap[k]; });

    const weeklyList = Object.keys(weeklyMap)
      .sort(function (a, b) { return b.localeCompare(a); })
      .map(function (k) { return weeklyMap[k]; });

    let totalSavedGoals = 0;
    let totalTargetGoals = 0;
    state.savingsGoals.forEach(function (g) {
      totalSavedGoals += Number(g.savedAmount) || 0;
      totalTargetGoals += Number(g.targetAmount) || 0;
    });

    return {
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      netBalance: totalIncome - totalExpense,
      incomeCount: incomeCount,
      expenseCount: expenseCount,
      totalSavedGoals: totalSavedGoals,
      totalTargetGoals: totalTargetGoals,
      refDate: refDate,
      refMonth: refMonth,
      refWeek: refWeek,
      weekIncome: weekIncome,
      weekExpense: weekExpense,
      weekNet: weekIncome - weekExpense,
      monthIncome: monthIncome,
      monthExpense: monthExpense,
      monthNet: monthIncome - monthExpense,
      monthlyList: monthlyList,
      weeklyList: weeklyList,
      categoryExpenseMap: categoryExpenseMap
    };
  }

  function renderSummaryKPIs(agg) {
    const elInc = document.getElementById('kpiTotalIncome');
    const elExp = document.getElementById('kpiTotalExpense');
    const elBal = document.getElementById('kpiNetBalance');
    const elSav = document.getElementById('kpiTotalSavings');
    const elSavCount = document.getElementById('kpiSavingsGoalsCount');
    const elIncCount = document.getElementById('kpiIncomeCount');
    const elExpCount = document.getElementById('kpiExpenseCount');
    const elSavingsRate = document.getElementById('kpiSavingsRate');

    if (elInc) elInc.textContent = formatCurrency(agg.totalIncome);
    if (elExp) elExp.textContent = formatCurrency(agg.totalExpense);
    if (elBal) {
      elBal.textContent = formatCurrency(agg.netBalance);
      elBal.className = 'kpi-amount ' + (agg.netBalance >= 0 ? 'amount-balance' : 'amount-expense');
    }
    if (elSav) elSav.textContent = formatCurrency(agg.totalSavedGoals);
    if (elSavCount) elSavCount.textContent = state.savingsGoals.length + ' active goals';
    if (elIncCount) elIncCount.textContent = agg.incomeCount + ' income records';
    if (elExpCount) elExpCount.textContent = agg.expenseCount + ' expense records';
    if (elSavingsRate) {
      const rate = agg.totalIncome > 0
        ? (((agg.totalIncome - agg.totalExpense) / agg.totalIncome) * 100).toFixed(1) + '%'
        : '0.0%';
      elSavingsRate.textContent = 'Net Rate: ' + rate;
    }

    const wkRangeEl = document.getElementById('stripWeekRange');
    const wkIncEl = document.getElementById('stripWeekIncome');
    const wkExpEl = document.getElementById('stripWeekExpense');
    const wkNetEl = document.getElementById('stripWeekNet');

    if (wkRangeEl) wkRangeEl.textContent = agg.refWeek.label;
    if (wkIncEl) wkIncEl.textContent = formatCurrency(agg.weekIncome);
    if (wkExpEl) wkExpEl.textContent = formatCurrency(agg.weekExpense);
    if (wkNetEl) wkNetEl.textContent = formatCurrency(agg.weekNet);

    const moRangeEl = document.getElementById('stripMonthRange');
    const moIncEl = document.getElementById('stripMonthIncome');
    const moExpEl = document.getElementById('stripMonthExpense');
    const moNetEl = document.getElementById('stripMonthNet');

    if (moRangeEl) moRangeEl.textContent = getMonthLabel(agg.refMonth);
    if (moIncEl) moIncEl.textContent = formatCurrency(agg.monthIncome);
    if (moExpEl) moExpEl.textContent = formatCurrency(agg.monthExpense);
    if (moNetEl) moNetEl.textContent = formatCurrency(agg.monthNet);

    const recentBody = document.getElementById('homeRecentTableBody');
    if (recentBody) {
      const sorted = state.records.slice().sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      }).slice(0, 5);

      if (sorted.length === 0) {
        recentBody.innerHTML = '<tr><td colspan="5" class="empty-state">No records yet. Go to the Records page to add your first transaction.</td></tr>';
      } else {
        recentBody.innerHTML = '';
        sorted.forEach(function (rec) {
          const isInc = rec.type === 'income';
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td data-label="Date"><strong>' + escapeHtml(rec.date) + '</strong></td>' +
            '<td data-label="Type"><span class="badge ' + (isInc ? 'badge-income' : 'badge-expense') + '">' +
            (isInc ? 'INCOME' : 'EXPENSE') + '</span></td>' +
            '<td data-label="Category">' + escapeHtml(rec.category) + '</td>' +
            '<td data-label="Description">' + escapeHtml(rec.description || '—') + '</td>' +
            '<td data-label="Amount" class="text-right"><strong class="' + (isInc ? 'amount-income' : 'amount-expense') + '">' +
            (isInc ? '+' : '-') + formatCurrency(rec.amount) + '</strong></td>';
          recentBody.appendChild(tr);
        });
      }
    }
  }

  function renderRecordsTable() {
    const tbody = document.getElementById('recordsTableBody');
    const countLabel = document.getElementById('filteredRecordsCount');
    const filteredSummary = document.getElementById('filteredSummaryText');
    if (!tbody) return;

    const list = getFilteredRecords();
    let fInc = 0;
    let fExp = 0;
    list.forEach(function (r) {
      if (r.type === 'income') fInc += Number(r.amount) || 0;
      else fExp += Number(r.amount) || 0;
    });

    if (countLabel) {
      countLabel.textContent = list.length + ' of ' + state.records.length + ' records';
    }
    if (filteredSummary) {
      filteredSummary.textContent =
        'Filtered — Income: ' + formatCurrency(fInc) +
        ' | Expenses: ' + formatCurrency(fExp) +
        ' | Remaining: ' + formatCurrency(fInc - fExp);
    }

    if (list.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="empty-state">No records found. Add a new transaction on the left to get started.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    list.forEach(function (rec) {
      const tr = document.createElement('tr');
      const isInc = rec.type === 'income';
      tr.innerHTML =
        '<td data-label="Date"><strong>' + escapeHtml(rec.date) + '</strong></td>' +
        '<td data-label="Type"><span class="badge ' + (isInc ? 'badge-income' : 'badge-expense') + '">' +
        (isInc ? 'INCOME' : 'EXPENSE') + '</span></td>' +
        '<td data-label="Category">' + escapeHtml(rec.category) + '<div style="font-size:0.74rem;color:#64748b;">' + escapeHtml(rec.account || 'Cash') + '</div></td>' +
        '<td data-label="Description">' + escapeHtml(rec.description || '—') + '</td>' +
        '<td data-label="Amount" class="text-right"><strong class="' + (isInc ? 'amount-income' : 'amount-expense') + '">' +
        (isInc ? '+' : '-') + formatCurrency(rec.amount) + '</strong></td>' +
        '<td data-label="Actions" class="text-right">' +
        '<div class="row-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" data-action="edit" data-id="' + escapeHtml(rec.id) + '">Edit</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="' + escapeHtml(rec.id) + '">Delete</button>' +
        '</div>' +
        '</td>';
      tbody.appendChild(tr);
    });
  }

  // Savings Goals & Savings Ledger Logic
  function computeGoalSchedule(targetAmount, savedAmount, targetDateStr) {
    const remaining = Math.max(0, (Number(targetAmount) || 0) - (Number(savedAmount) || 0));
    const today = new Date(getTodayIso() + 'T00:00:00');
    const target = targetDateStr ? new Date(targetDateStr + 'T00:00:00') : new Date('2027-05-15T00:00:00');
    const diffMs = target.getTime() - today.getTime();
    const daysLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const weeksLeft = Math.max(1, daysLeft / 7);
    const monthsLeft = Math.max(0.5, daysLeft / 30.44);
    const biMonthlyLeft = Math.max(1, monthsLeft * 2);

    return {
      remaining: remaining,
      daysLeft: daysLeft,
      weeksLeft: Math.ceil(weeksLeft),
      monthsLeft: Number(monthsLeft.toFixed(1)),
      perDay: remaining / daysLeft,
      perWeek: remaining / weeksLeft,
      perBiMonthly: remaining / biMonthlyLeft,
      perMonth: remaining / monthsLeft
    };
  }

  function renderSavingsPage(agg) {
    const savTotalEl = document.getElementById('savPageTotalSaved');
    const savTargetEl = document.getElementById('savPageTotalTarget');
    const savRemainingEl = document.getElementById('savPageRemainingNeeded');
    const savProgressEl = document.getElementById('savPageOverallPct');

    const remGoal = Math.max(0, agg.totalTargetGoals - agg.totalSavedGoals);
    const pctOverall = agg.totalTargetGoals > 0
      ? Math.min(100, (agg.totalSavedGoals / agg.totalTargetGoals) * 100)
      : 0;

    if (savTotalEl) savTotalEl.textContent = formatCurrency(agg.totalSavedGoals);
    if (savTargetEl) savTargetEl.textContent = formatCurrency(agg.totalTargetGoals);
    if (savRemainingEl) savRemainingEl.textContent = formatCurrency(remGoal);
    if (savProgressEl) savProgressEl.textContent = pctOverall.toFixed(1) + '% of Total Goal';

    const goalSelect = document.getElementById('depositGoalSelect');
    if (goalSelect) {
      const prev = goalSelect.value;
      goalSelect.innerHTML = '';
      if (state.savingsGoals.length === 0) {
        goalSelect.innerHTML = '<option value="">No active goals — create one below first</option>';
      } else {
        state.savingsGoals.forEach(function (g) {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = g.name + ' (Saved: ' + formatCurrency(g.savedAmount) + ' / ' + formatCurrency(g.targetAmount) + ')';
          goalSelect.appendChild(opt);
        });
        if (prev && state.savingsGoals.some(function (g) { return g.id === prev; })) {
          goalSelect.value = prev;
        }
      }
    }

    updatePaydayAllocatorHint();

    const goalsGrid = document.getElementById('savingsGoalsGrid');
    if (goalsGrid) {
      if (state.savingsGoals.length === 0) {
        goalsGrid.innerHTML = '<div class="empty-state card">No savings goals yet. Use the "Create Savings Goal" form on the left to add your first goal!</div>';
      } else {
        goalsGrid.innerHTML = '';
        state.savingsGoals.forEach(function (goal) {
          const pct = goal.targetAmount > 0
            ? Math.min(100, ((Number(goal.savedAmount) || 0) / Number(goal.targetAmount)) * 100)
            : 0;
          const sched = computeGoalSchedule(goal.targetAmount, goal.savedAmount, goal.targetDate);
          const card = document.createElement('div');
          card.className = 'goal-card';
          card.innerHTML =
            '<div class="goal-card-top">' +
              '<div>' +
                '<div class="goal-title">' + escapeHtml(goal.name) + '</div>' +
                '<div class="goal-purpose">' + escapeHtml(goal.purpose || 'Personal savings goal') + '</div>' +
              '</div>' +
              '<span class="badge badge-savings">' + escapeHtml(goal.priority || 'Medium') + '</span>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:0.82rem;font-weight:700;">' +
              '<span class="amount-savings">' + formatCurrency(goal.savedAmount) + ' saved</span>' +
              '<span>Target: ' + formatCurrency(goal.targetAmount) + ' (' + pct.toFixed(1) + '%)</span>' +
            '</div>' +
            '<div class="goal-progress-wrap">' +
              '<div class="goal-progress-bar" style="width:' + pct.toFixed(1) + '%;"></div>' +
            '</div>' +
            '<div style="font-size:0.76rem;color:#475569;display:flex;justify-content:space-between;">' +
              '<span>Target Date: <strong>' + escapeHtml(goal.targetDate) + '</strong> (' + sched.daysLeft + ' days left)</span>' +
              '<span>Still Needed: <strong>' + formatCurrency(sched.remaining) + '</strong></span>' +
            '</div>' +
            '<div class="goal-schedule-box">' +
              '<div>Per Month: <strong>' + formatCurrency(sched.perMonth) + '</strong></div>' +
              '<div>Per Kinsenas (15/30): <strong>' + formatCurrency(sched.perBiMonthly) + '</strong></div>' +
              '<div>Per Week: <strong>' + formatCurrency(sched.perWeek) + '</strong></div>' +
              '<div>Per Day: <strong>' + formatCurrency(sched.perDay) + '</strong></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap;">' +
              '<button type="button" class="btn btn-outline btn-sm" data-goal-action="quick-deposit" data-goal-id="' + escapeHtml(goal.id) + '">+ Deposit</button>' +
              '<button type="button" class="btn btn-outline btn-sm" data-goal-action="edit-goal" data-goal-id="' + escapeHtml(goal.id) + '">Edit</button>' +
              '<button type="button" class="btn btn-danger btn-sm" data-goal-action="delete-goal" data-goal-id="' + escapeHtml(goal.id) + '">Delete</button>' +
            '</div>';
          goalsGrid.appendChild(card);
        });
      }
    }

    const savBody = document.getElementById('savingsRecordsTableBody');
    if (savBody) {
      if (state.savingsRecords.length === 0) {
        savBody.innerHTML = '<tr><td colspan="6" class="empty-state">No savings deposits or withdrawals recorded yet.</td></tr>';
      } else {
        savBody.innerHTML = '';
        state.savingsRecords.forEach(function (sr) {
          const isDep = sr.type !== 'withdrawal';
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td data-label="Date"><strong>' + escapeHtml(sr.date) + '</strong></td>' +
            '<td data-label="Goal"><strong>' + escapeHtml(sr.goalName) + '</strong></td>' +
            '<td data-label="Type"><span class="badge ' + (isDep ? 'badge-income' : 'badge-expense') + '">' +
              (isDep ? 'DEPOSIT' : 'WITHDRAWAL') + '</span></td>' +
            '<td data-label="Notes">' + escapeHtml(sr.note || '—') + '</td>' +
            '<td data-label="Amount" class="text-right"><strong class="' + (isDep ? 'amount-income' : 'amount-expense') + '">' +
              (isDep ? '+' : '-') + formatCurrency(sr.amount) + '</strong></td>' +
            '<td data-label="Action" class="text-right">' +
              '<button type="button" class="btn btn-danger btn-sm" data-srec-delete="' + escapeHtml(sr.id) + '">Remove</button>' +
            '</td>';
          savBody.appendChild(tr);
        });
      }
    }
  }

  function updatePaydayAllocatorHint() {
    const salaryVal = parseFloat(document.getElementById('paydaySalaryInput')?.value || '0') || 0;
    const pctVal = parseFloat(document.getElementById('paydaySavePctInput')?.value || '20') || 0;
    const hintBox = document.getElementById('paydaySuggestedSummary');
    const depositAmtEl = document.getElementById('depositAmountInput');
    const computedSave = Math.round(salaryVal * (pctVal / 100) * 100) / 100;

    if (hintBox) {
      if (salaryVal <= 0) {
        hintBox.innerHTML = 'Enter your received salary above (or tap <strong>Use Latest Income</strong>) to see suggested 10%, 20%, and 30% savings splits.';
      } else {
        const s10 = formatCurrency(salaryVal * 0.10);
        const s20 = formatCurrency(salaryVal * 0.20);
        const s30 = formatCurrency(salaryVal * 0.30);
        hintBox.innerHTML =
          'From a paycheck of <strong>' + formatCurrency(salaryVal) + '</strong>: ' +
          '10% Starter = <strong>' + s10 + '</strong> | ' +
          '20% Recommended = <strong>' + s20 + '</strong> | ' +
          '30% Aggressive = <strong>' + s30 + '</strong>';
      }
    }
    if (depositAmtEl && salaryVal > 0 && document.activeElement !== depositAmtEl) {
      depositAmtEl.value = computedSave > 0 ? computedSave : '';
    }
  }

  // Built-in Calculator & Goal Planner Logic
  function updateCalcDisplay() {
    const exprEl = document.getElementById('calcExprDisplay');
    const valEl = document.getElementById('calcMainDisplay');
    if (exprEl) exprEl.textContent = state.calcExpression || 'Ready';
    if (valEl) valEl.textContent = state.calcDisplay || '0';
  }

  function evalSafeArithmetic(expr) {
    const cleaned = String(expr || '')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/[^0-9+\-*/.%() ]/g, '');
    if (!cleaned.trim()) return 0;
    const pctResolved = cleaned.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
    // eslint-disable-next-line no-new-func
    const fn = new Function('return (' + pctResolved + ');');
    const res = Number(fn());
    if (!isFinite(res) || isNaN(res)) return 0;
    return Math.round(res * 100) / 100;
  }

  function handleCalcKey(key) {
    if (key === 'C') {
      state.calcExpression = '';
      state.calcDisplay = '0';
      updateCalcDisplay();
      return;
    }
    if (key === 'BACK') {
      state.calcExpression = state.calcExpression.slice(0, -1);
      state.calcDisplay = state.calcExpression || '0';
      updateCalcDisplay();
      return;
    }
    if (key === '=') {
      if (!state.calcExpression) return;
      try {
        const ans = evalSafeArithmetic(state.calcExpression);
        state.calcTape.unshift({
          expr: state.calcExpression,
          result: ans
        });
        if (state.calcTape.length > 10) state.calcTape.length = 10;
        state.calcDisplay = String(ans);
        state.calcExpression = String(ans);
        updateCalcDisplay();
        renderCalcTape();
      } catch (e) {
        state.calcDisplay = 'Error';
        updateCalcDisplay();
      }
      return;
    }

    state.calcExpression += key;
    state.calcDisplay = state.calcExpression;
    updateCalcDisplay();
  }

  function renderCalcTape() {
    const tapeEl = document.getElementById('calcHistoryTapeList');
    if (!tapeEl) return;
    if (state.calcTape.length === 0) {
      tapeEl.innerHTML = '<div style="font-size:0.8rem;color:#64748b;">No calculations yet. Tap "=" to log results here.</div>';
      return;
    }
    tapeEl.innerHTML = '';
    state.calcTape.forEach(function (item) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;padding:6px 8px;background:#ffffff;border:1px solid #cbd5e1;border-radius:6px;font-size:0.82rem;margin-bottom:6px;';
      row.innerHTML =
        '<span>' + escapeHtml(item.expr) + ' =</span>' +
        '<strong>' + formatCurrency(item.result) + '</strong>';
      tapeEl.appendChild(row);
    });
  }

  function runSavingsGoalEstimator() {
    const purpose = (document.getElementById('estGoalPurpose')?.value || 'Savings Goal').trim();
    const targetAmt = parseFloat(document.getElementById('estTargetAmount')?.value || '0') || 0;
    const currentAmt = parseFloat(document.getElementById('estCurrentSaved')?.value || '0') || 0;
    const targetDate = document.getElementById('estTargetDate')?.value || '2027-05-15';
    const monthlyIncome = parseFloat(document.getElementById('estMonthlyIncome')?.value || '0') || 0;
    const customPerMonth = parseFloat(document.getElementById('estCustomPerMonth')?.value || '0') || 0;

    const sched = computeGoalSchedule(targetAmt, currentAmt, targetDate);

    const outRemaining = document.getElementById('estOutRemaining');
    const outTimeline = document.getElementById('estOutTimeline');
    const outPerMonth = document.getElementById('estOutPerMonth');
    const outPerBiMonthly = document.getElementById('estOutPerBiMonthly');
    const outPerWeek = document.getElementById('estOutPerWeek');
    const outPerDay = document.getElementById('estOutPerDay');
    const outAdvice = document.getElementById('estOutFeasibility');

    if (outRemaining) outRemaining.textContent = formatCurrency(sched.remaining);
    if (outTimeline) outTimeline.textContent = sched.daysLeft + ' days (' + sched.monthsLeft + ' months)';
    if (outPerMonth) outPerMonth.textContent = formatCurrency(sched.perMonth);
    if (outPerBiMonthly) outPerBiMonthly.textContent = formatCurrency(sched.perBiMonthly);
    if (outPerWeek) outPerWeek.textContent = formatCurrency(sched.perWeek);
    if (outPerDay) outPerDay.textContent = formatCurrency(sched.perDay);

    if (outAdvice) {
      if (targetAmt <= 0) {
        outAdvice.innerHTML = 'Enter a <strong>Target Goal Amount</strong> and <strong>Target Date</strong> above to calculate your exact savings plan.';
        return;
      }
      let msg = 'For "' + escapeHtml(purpose) + '", set aside <strong>' + formatCurrency(sched.perBiMonthly) + '</strong> every payday (15th & 30th) or <strong>' + formatCurrency(sched.perWeek) + '</strong> per week to reach ' + formatCurrency(targetAmt) + ' by ' + escapeHtml(targetDate) + '.';
      if (monthlyIncome > 0) {
        const sharePct = (sched.perMonth / monthlyIncome) * 100;
        msg += ' This equals <strong>' + sharePct.toFixed(1) + '%</strong> of your monthly income (' +
          (sharePct <= 25 ? 'Realistic & Healthy' : 'High Share — consider extending target date if tight') + ').';
      }
      if (customPerMonth > 0 && sched.remaining > 0) {
        const monthsNeeded = sched.remaining / customPerMonth;
        const estDays = Math.ceil(monthsNeeded * 30.44);
        const finishDate = new Date(getTodayIso() + 'T00:00:00');
        finishDate.setDate(finishDate.getDate() + estDays);
        const fStr = finishDate.toISOString().slice(0, 10);
        msg += '<br/>If you save <strong>' + formatCurrency(customPerMonth) + '/month</strong>, you will reach your goal in <strong>' +
          monthsNeeded.toFixed(1) + ' months</strong> (around <strong>' + fStr + '</strong>).';
      }
      outAdvice.innerHTML = msg;
    }
  }

  // Smart Budgeting & Spending Recommendations Engine
  function renderSmartRecommendations(agg) {
    const periodSelect = document.getElementById('recPeriodSelect');
    const ruleSelect = document.getElementById('recRuleSelect');

    if (periodSelect) {
      const prevVal = periodSelect.value;
      periodSelect.innerHTML = '<option value="all">All Recorded Transactions</option>';
      agg.monthlyList.forEach(function (m) {
        const opt = document.createElement('option');
        opt.value = 'month:' + m.month;
        opt.textContent = 'Month: ' + getMonthLabel(m.month);
        periodSelect.appendChild(opt);
      });
      agg.weeklyList.forEach(function (w) {
        const opt = document.createElement('option');
        opt.value = 'week:' + w.weekKey;
        opt.textContent = 'Week: ' + w.label;
        periodSelect.appendChild(opt);
      });
      if (prevVal && Array.from(periodSelect.options).some(function (o) { return o.value === prevVal; })) {
        periodSelect.value = prevVal;
      } else if (agg.monthlyList.length > 0) {
        periodSelect.value = 'month:' + agg.monthlyList[0].month;
      }
    }

    const selectedPeriod = periodSelect ? periodSelect.value : 'all';
    const selectedRule = ruleSelect ? ruleSelect.value : 'auto';

    const scopedRecords = state.records.filter(function (r) {
      if (selectedPeriod.startsWith('month:')) {
        const ym = selectedPeriod.slice(6);
        return (r.date || '').startsWith(ym);
      }
      if (selectedPeriod.startsWith('week:')) {
        const wkKey = selectedPeriod.slice(5);
        return getWeekStartAndEnd(r.date).weekKey === wkKey;
      }
      return true;
    });

    let pIncome = 0;
    let pExpense = 0;
    let needsSpent = 0;
    let wantsSpent = 0;
    const catMap = {};

    scopedRecords.forEach(function (r) {
      const amt = Number(r.amount) || 0;
      if (r.type === 'income') {
        pIncome += amt;
      } else {
        pExpense += amt;
        catMap[r.category] = (catMap[r.category] || 0) + amt;
        if (ESSENTIAL_CATEGORIES.indexOf(r.category) !== -1) {
          needsSpent += amt;
        } else {
          wantsSpent += amt;
        }
      }
    });

    const baseIncome = pIncome > 0 ? pIncome : (agg.totalIncome > 0 ? agg.totalIncome : 0);
    const netRemaining = pIncome - pExpense;
    const actualSavingsRate = pIncome > 0 ? ((netRemaining / pIncome) * 100) : 0;
    const essentialRatio = pIncome > 0 ? ((needsSpent / pIncome) * 100) : 0;

    let activeRuleKey = selectedRule;
    if (activeRuleKey === 'auto') {
      if (essentialRatio > 60) activeRuleKey = '70-20-10';
      else if (state.savingsGoals.length > 0 && actualSavingsRate < 18) activeRuleKey = '60-20-20';
      else activeRuleKey = '50-30-20';
    }

    const RULES = {
      '50-30-20': {
        name: '50 / 30 / 20 Balanced Rule',
        needsPct: 50,
        wantsPct: 30,
        savingsPct: 20,
        desc: 'Ideal balanced method: 50% Essential Needs, 30% Personal/Flexible Wants, and 20% Savings Goals.'
      },
      '70-20-10': {
        name: '70 / 20 / 10 Essential-First Rule',
        needsPct: 70,
        wantsPct: 10,
        savingsPct: 20,
        desc: 'Best when rent, food, and utilities take a larger share: 70% Living & Essentials, 20% Savings, 10% Flexible/Buffer.'
      },
      '60-20-20': {
        name: '60 / 20 / 20 Pay-Yourself-First Rule',
        needsPct: 60,
        wantsPct: 20,
        savingsPct: 20,
        desc: 'Locks 20% into Savings immediately on payday, 60% for Fixed & Essential Bills, and 20% for Flexible Spending.'
      },
      '80-20': {
        name: '80 / 20 Simple Payday Split',
        needsPct: 65,
        wantsPct: 15,
        savingsPct: 20,
        desc: 'No-stress rule: Put 20% into Savings first, then spend the remaining 80% freely without overdrafting.'
      }
    };

    const chosenRule = RULES[activeRuleKey] || RULES['50-30-20'];
    const targetNeeds = baseIncome * (chosenRule.needsPct / 100);
    const targetWants = baseIncome * (chosenRule.wantsPct / 100);
    const targetSavings = baseIncome * (chosenRule.savingsPct / 100);
    const weeklySpendAllowance = (targetNeeds + targetWants) / 4.33;
    const dailySpendAllowance = (targetNeeds + targetWants) / 30;

    const recRuleBadge = document.getElementById('recRecommendedRuleName');
    const recRuleDesc = document.getElementById('recRecommendedRuleDesc');
    const recScoreText = document.getElementById('recHealthScoreText');
    const recPeriodSummary = document.getElementById('recPeriodSummaryLine');

    if (recRuleBadge) recRuleBadge.textContent = chosenRule.name;
    if (recRuleDesc) recRuleDesc.textContent = chosenRule.desc;
    if (recPeriodSummary) {
      recPeriodSummary.textContent =
        'Analyzed Income: ' + formatCurrency(pIncome) +
        ' | Expenses: ' + formatCurrency(pExpense) +
        ' | Net Saved/Left: ' + formatCurrency(netRemaining) +
        ' (' + actualSavingsRate.toFixed(1) + '%)';
    }
    if (recScoreText) {
      if (scopedRecords.length === 0) {
        recScoreText.innerHTML =
          '<div style="font-size:0.76rem;color:#cbd5e1;text-transform:uppercase;">Financial Status</div>' +
          '<div style="font-size:1.1rem;font-weight:800;color:#5eead4;margin:2px 0;">Awaiting Your Records</div>' +
          '<div style="font-size:0.8rem;color:#e2e8f0;">Add your income and expense records on the Records page to generate personalized peso limits.</div>';
      } else {
        let grade = 'Good Balance';
        if (actualSavingsRate >= 25) grade = 'Excellent Saver (A+)';
        else if (actualSavingsRate >= 15) grade = 'Healthy Cashflow (B+)';
        else if (actualSavingsRate > 0) grade = 'Tight Margin (C)';
        else grade = 'Overspending Alert (Needs Adjustment)';
        recScoreText.innerHTML =
          '<div style="font-size:0.76rem;color:#cbd5e1;text-transform:uppercase;">Financial Status</div>' +
          '<div style="font-size:1.2rem;font-weight:800;color:#5eead4;margin:2px 0;">' + grade + '</div>' +
          '<div style="font-size:0.8rem;color:#e2e8f0;">Next Period Safe Spend Limit: <strong>' + formatCurrency(weeklySpendAllowance) + '/week</strong> (' + formatCurrency(dailySpendAllowance) + '/day)</div>';
      }
    }

    const elNeedsCap = document.getElementById('recNextNeedsCap');
    const elWantsCap = document.getElementById('recNextWantsCap');
    const elSavingsCap = document.getElementById('recNextSavingsCap');
    if (elNeedsCap) elNeedsCap.textContent = formatCurrency(targetNeeds) + ' (' + chosenRule.needsPct + '%)';
    if (elWantsCap) elWantsCap.textContent = formatCurrency(targetWants) + ' (' + chosenRule.wantsPct + '%)';
    if (elSavingsCap) elSavingsCap.textContent = formatCurrency(targetSavings) + ' (' + chosenRule.savingsPct + '%)';

    const rulesBody = document.getElementById('recRulesComparisonBody');
    if (rulesBody) {
      rulesBody.innerHTML = '';
      Object.keys(RULES).forEach(function (rKey) {
        const rObj = RULES[rKey];
        const isCurrent = rKey === activeRuleKey;
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td data-label="Method"><strong>' + escapeHtml(rObj.name) + '</strong> ' +
            (isCurrent ? '<span class="badge badge-income">Recommended</span>' : '') +
            '<div style="font-size:0.75rem;color:#64748b;">' + escapeHtml(rObj.desc) + '</div></td>' +
          '<td data-label="Essential Needs" class="text-right"><strong>' + formatCurrency(baseIncome * (rObj.needsPct / 100)) + '</strong> (' + rObj.needsPct + '%)</td>' +
          '<td data-label="Flexible / Buffer" class="text-right"><strong>' + formatCurrency(baseIncome * (rObj.wantsPct / 100)) + '</strong> (' + rObj.wantsPct + '%)</td>' +
          '<td data-label="Savings Target" class="text-right amount-savings"><strong>' + formatCurrency(baseIncome * (rObj.savingsPct / 100)) + '</strong> (' + rObj.savingsPct + '%)</td>';
        rulesBody.appendChild(tr);
      });
    }

    const tipsContainer = document.getElementById('recActionableTipsList');
    if (tipsContainer) {
      const tips = [];
      if (scopedRecords.length === 0) {
        tips.push({
          type: 'normal',
          title: 'Record Your Income & Expenses First',
          body: 'Once you log your salary and expenses on the <strong>Records</strong> page, this advisor will automatically compute your personalized payday savings split, top expense category trims, and weekly spending limits.'
        });
      } else {
        const perKinsenasSave = targetSavings / 2;
        tips.push({
          type: 'good',
          title: 'Pay-Yourself-First Rule on Payday',
          body: 'As soon as you receive your salary, immediately transfer <strong>' + formatCurrency(perKinsenasSave) + ' per bi-monthly payday</strong> (or <strong>' + formatCurrency(targetSavings) + '/month</strong>) into your Savings Goal before spending on bills or shopping.'
        });

        const sortedCats = Object.keys(catMap).map(function (k) {
          return { category: k, amount: catMap[k] };
        }).sort(function (a, b) { return b.amount - a.amount; });

        if (sortedCats.length > 0) {
          const top = sortedCats[0];
          const topPct = pExpense > 0 ? ((top.amount / pExpense) * 100) : 0;
          const suggestedTrim = top.amount * 0.90;
          tips.push({
            type: topPct > 45 ? 'warn' : 'normal',
            title: 'Top Expense Category: ' + top.category + ' (' + topPct.toFixed(1) + '% of spending)',
            body: 'You spent <strong>' + formatCurrency(top.amount) + '</strong> on <strong>' + escapeHtml(top.category) + '</strong> in this period. Trimming this category by just 10% next month caps it at <strong>' + formatCurrency(suggestedTrim) + '</strong> and frees up an extra <strong>' + formatCurrency(top.amount * 0.10) + '</strong> for your savings goals.'
          });
        }

        tips.push({
          type: 'normal',
          title: 'Weekly & Daily Spending Cap Method',
          body: 'To prevent running out of cash before the next payday, cap your total non-savings expenses at <strong>' + formatCurrency(weeklySpendAllowance) + ' per week</strong> (or <strong>' + formatCurrency(dailySpendAllowance) + ' per day</strong>).'
        });

        if (state.savingsGoals.length > 0) {
          let totalMonthlyGoalReq = 0;
          state.savingsGoals.forEach(function (g) {
            const s = computeGoalSchedule(g.targetAmount, g.savedAmount, g.targetDate);
            totalMonthlyGoalReq += s.perMonth;
          });
          tips.push({
            type: totalMonthlyGoalReq <= targetSavings ? 'good' : 'warn',
            title: 'Savings Goal Alignment Check',
            body: 'Your ' + state.savingsGoals.length + ' active savings goal(s) require <strong>' + formatCurrency(totalMonthlyGoalReq) + '/month</strong> to finish on schedule. Your recommended ' + chosenRule.savingsPct + '% savings budget provides <strong>' + formatCurrency(targetSavings) + '/month</strong> — ' +
              (totalMonthlyGoalReq <= targetSavings
                ? 'you are 100% on track to hit your goals on time!'
                : 'consider adding ' + formatCurrency(totalMonthlyGoalReq - targetSavings) + '/month from side income or extending your target date slightly.')
          });
        }
      }

      tipsContainer.innerHTML = '';
      tips.forEach(function (t) {
        const div = document.createElement('div');
        div.className = 'rec-tip-card ' + (t.type === 'warn' ? 'tip-warn' : (t.type === 'good' ? 'tip-good' : ''));
        div.innerHTML =
          '<div style="font-weight:700;margin-bottom:4px;">' + escapeHtml(t.title) + '</div>' +
          '<div>' + t.body + '</div>';
        tipsContainer.appendChild(div);
      });
    }

    const catCapBody = document.getElementById('recCategoryCapsBody');
    if (catCapBody) {
      const sortedCats = Object.keys(catMap).map(function (k) {
        return { category: k, amount: catMap[k] };
      }).sort(function (a, b) { return b.amount - a.amount; });

      if (sortedCats.length === 0) {
        catCapBody.innerHTML = '<tr><td colspan="4" class="empty-state">No category expenses recorded in this period.</td></tr>';
      } else {
        catCapBody.innerHTML = '';
        sortedCats.forEach(function (c) {
          const share = pExpense > 0 ? ((c.amount / pExpense) * 100) : 0;
          const recNextCap = share > 35 ? (c.amount * 0.90) : (c.amount * 0.95);
          const weeklyCap = recNextCap / 4.33;
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td data-label="Category"><strong>' + escapeHtml(c.category) + '</strong></td>' +
            '<td data-label="Past Spend" class="text-right amount-expense">' + formatCurrency(c.amount) + ' (' + share.toFixed(1) + '%)</td>' +
            '<td data-label="Next Month Limit" class="text-right amount-balance"><strong>' + formatCurrency(recNextCap) + '</strong></td>' +
            '<td data-label="Suggested Weekly Cap" class="text-right">' + formatCurrency(weeklyCap) + '/wk</td>';
          catCapBody.appendChild(tr);
        });
      }
    }
  }

  function renderMonthlyWeeklyTables(agg) {
    const monthlyBody = document.getElementById('monthlyBreakdownBody');
    const weeklyBody = document.getElementById('weeklyBreakdownBody');

    if (monthlyBody) {
      if (agg.monthlyList.length === 0) {
        monthlyBody.innerHTML = '<tr><td colspan="5" class="empty-state">No monthly data available yet.</td></tr>';
      } else {
        monthlyBody.innerHTML = '';
        agg.monthlyList.forEach(function (m) {
          const net = m.income - m.expense;
          const rate = m.income > 0 ? ((net / m.income) * 100).toFixed(1) + '%' : '0.0%';
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td data-label="Month"><strong>' + escapeHtml(getMonthLabel(m.month)) + '</strong> <span style="font-size:0.75rem;color:#64748b;">(' + m.count + ' items)</span></td>' +
            '<td data-label="Total Income" class="text-right amount-income"><strong>' + formatCurrency(m.income) + '</strong></td>' +
            '<td data-label="Total Expenses" class="text-right amount-expense"><strong>' + formatCurrency(m.expense) + '</strong></td>' +
            '<td data-label="Remaining" class="text-right ' + (net >= 0 ? 'amount-balance' : 'amount-expense') + '"><strong>' + formatCurrency(net) + '</strong></td>' +
            '<td data-label="Savings %" class="text-right">' + rate + '</td>';
          monthlyBody.appendChild(tr);
        });
      }
    }

    if (weeklyBody) {
      if (agg.weeklyList.length === 0) {
        weeklyBody.innerHTML = '<tr><td colspan="4" class="empty-state">No weekly data available yet.</td></tr>';
      } else {
        weeklyBody.innerHTML = '';
        agg.weeklyList.forEach(function (w) {
          const net = w.income - w.expense;
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td data-label="Week Range"><strong>' + escapeHtml(w.label) + '</strong> <span style="font-size:0.75rem;color:#64748b;">(' + w.count + ' items)</span></td>' +
            '<td data-label="Weekly Income" class="text-right amount-income"><strong>' + formatCurrency(w.income) + '</strong></td>' +
            '<td data-label="Weekly Expenses" class="text-right amount-expense"><strong>' + formatCurrency(w.expense) + '</strong></td>' +
            '<td data-label="Weekly Remaining" class="text-right ' + (net >= 0 ? 'amount-balance' : 'amount-expense') + '"><strong>' + formatCurrency(net) + '</strong></td>';
          weeklyBody.appendChild(tr);
        });
      }
    }

    renderCategoryBars(agg);
    renderCanvasChart(agg);
  }

  function renderCategoryBars(agg) {
    const container = document.getElementById('categoryBreakdownList');
    if (!container) return;
    const entries = Object.keys(agg.categoryExpenseMap).map(function (k) {
      return { category: k, amount: agg.categoryExpenseMap[k] };
    }).sort(function (a, b) { return b.amount - a.amount; });

    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state">No expenses recorded for category breakdown.</div>';
      return;
    }

    container.innerHTML = '';
    entries.forEach(function (item) {
      const pct = agg.totalExpense > 0 ? ((item.amount / agg.totalExpense) * 100) : 0;
      const div = document.createElement('div');
      div.className = 'cat-bar-item';
      div.innerHTML =
        '<div class="cat-bar-top">' +
        '<span>' + escapeHtml(item.category) + '</span>' +
        '<span>' + formatCurrency(item.amount) + ' (' + pct.toFixed(1) + '%)</span>' +
        '</div>' +
        '<div class="cat-bar-track">' +
        '<div class="cat-bar-fill" style="width:' + Math.min(100, Math.max(4, pct)) + '%;background:#0f766e;"></div>' +
        '</div>';
      container.appendChild(div);
    });
  }

  function renderCanvasChart(agg) {
    const canvas = document.getElementById('summaryChartCanvas');
    if (!canvas || !canvas.getContext) return;
    const wrap = canvas.parentElement;
    const width = (wrap && wrap.clientWidth) ? wrap.clientWidth : 320;
    const height = 240;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const sourceList = state.chartMode === 'weekly'
      ? agg.weeklyList.slice(0, 6).reverse()
      : agg.monthlyList.slice(0, 6).reverse();

    if (sourceList.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No chart data yet — add transactions to see trends.', width / 2, height / 2);
      return;
    }

    let maxVal = 1000;
    sourceList.forEach(function (item) {
      if (item.income > maxVal) maxVal = item.income;
      if (item.expense > maxVal) maxVal = item.expense;
    });
    maxVal = maxVal * 1.15;

    const padLeft = 56;
    const padRight = 14;
    const padTop = 28;
    const padBottom = 38;
    const chartW = Math.max(100, width - padLeft - padRight);
    const chartH = height - padTop - padBottom;

    ctx.strokeStyle = '#e2e8f0';
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padTop + (chartH / steps) * i;
      const val = maxVal - (maxVal / steps) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillText('₱' + Math.round(val / 1000) + 'k', padLeft - 6, y + 4);
    }

    const groupW = chartW / sourceList.length;
    const barW = Math.min(26, Math.max(8, (groupW - 16) / 2));

    sourceList.forEach(function (item, idx) {
      const groupX = padLeft + idx * groupW;
      const centerX = groupX + groupW / 2;

      const incH = (item.income / maxVal) * chartH;
      const expH = (item.expense / maxVal) * chartH;

      ctx.fillStyle = '#15803d';
      ctx.fillRect(centerX - barW - 2, padTop + chartH - incH, barW, incH);

      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(centerX + 2, padTop + chartH - expH, barW, expH);

      ctx.fillStyle = '#334155';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const shortLabel = state.chartMode === 'weekly'
        ? (item.weekKey ? item.weekKey.slice(5) : '')
        : (item.month || '');
      ctx.fillText(shortLabel, centerX, height - 14);
    });

    ctx.fillStyle = '#15803d';
    ctx.fillRect(padLeft, 6, 11, 11);
    ctx.fillStyle = '#0f172a';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Income', padLeft + 16, 15);

    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(padLeft + 78, 6, 11, 11);
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Expenses', padLeft + 94, 15);
  }

  function renderHistoryLog() {
    const listEl = document.getElementById('historyLogList');
    const undoBtn = document.getElementById('undoDeleteBtn');
    if (undoBtn) {
      undoBtn.style.display = state.lastDeletedRecord ? 'inline-flex' : 'none';
    }
    if (!listEl) return;

    if (state.history.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No activity history recorded yet.</div>';
      return;
    }

    listEl.innerHTML = '';
    state.history.forEach(function (h) {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML =
        '<div><strong>' + escapeHtml(h.action) + ':</strong> ' + escapeHtml(h.details) + '</div>' +
        '<div class="history-time">' + escapeHtml(h.timestamp) + '</div>';
      listEl.appendChild(div);
    });
  }

  function renderAll() {
    const agg = computeAggregates();
    renderSummaryKPIs(agg);
    renderRecordsTable();
    renderSavingsPage(agg);
    runSavingsGoalEstimator();
    renderSmartRecommendations(agg);
    renderMonthlyWeeklyTables(agg);
    renderHistoryLog();
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function resetForm() {
    state.editingId = null;
    const formTitle = document.getElementById('formCardTitle');
    const submitBtn = document.getElementById('submitRecordBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (formTitle) formTitle.textContent = 'Add New Record';
    if (submitBtn) submitBtn.textContent = 'Save Record';
    if (cancelBtn) cancelBtn.style.display = 'none';

    const dateEl = document.getElementById('recordDate');
    const descEl = document.getElementById('recordDescription');
    const amtEl = document.getElementById('recordAmount');
    const accEl = document.getElementById('recordAccount');
    if (dateEl && !dateEl.value) dateEl.value = getTodayIso();
    if (descEl) descEl.value = '';
    if (amtEl) amtEl.value = '';
    if (accEl) accEl.value = 'Cash';
    setTransactionType('income');
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const dateVal = document.getElementById('recordDate')?.value || getTodayIso();
    const catVal = document.getElementById('recordCategory')?.value || 'Other';
    const descVal = (document.getElementById('recordDescription')?.value || '').trim();
    const amtRaw = parseFloat(document.getElementById('recordAmount')?.value || '0');
    const accVal = document.getElementById('recordAccount')?.value || 'Cash';

    if (!amtRaw || amtRaw <= 0) {
      showToast('Please enter a valid amount greater than zero.');
      return;
    }

    if (state.editingId) {
      const idx = state.records.findIndex(function (r) { return r.id === state.editingId; });
      if (idx !== -1) {
        state.records[idx] = {
          id: state.editingId,
          date: dateVal,
          type: state.selectedType,
          category: catVal,
          description: descVal || catVal,
          amount: Math.round(amtRaw * 100) / 100,
          account: accVal
        };
        logHistory(
          'Edited Record',
          (state.selectedType === 'income' ? 'Income' : 'Expense') + ' — ' + catVal + ' (' + formatCurrency(amtRaw) + ')'
        );
        showToast('Record updated!');
      }
    } else {
      const newRec = {
        id: 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        date: dateVal,
        type: state.selectedType,
        category: catVal,
        description: descVal || catVal,
        amount: Math.round(amtRaw * 100) / 100,
        account: accVal
      };
      state.records.unshift(newRec);
      logHistory(
        'Added Record',
        (state.selectedType === 'income' ? 'Income' : 'Expense') + ' — ' + catVal + ' (' + formatCurrency(amtRaw) + ')'
      );
      showToast('New record saved!');
    }

    safeSaveStorage();
    resetForm();
    renderAll();
  }

  function startEditRecord(id) {
    const rec = state.records.find(function (r) { return r.id === id; });
    if (!rec) return;
    state.editingId = rec.id;
    setTransactionType(rec.type);
    const dateEl = document.getElementById('recordDate');
    const catEl = document.getElementById('recordCategory');
    const descEl = document.getElementById('recordDescription');
    const amtEl = document.getElementById('recordAmount');
    const accEl = document.getElementById('recordAccount');

    if (dateEl) dateEl.value = rec.date;
    if (catEl) catEl.value = rec.category;
    if (descEl) descEl.value = rec.description;
    if (amtEl) amtEl.value = rec.amount;
    if (accEl) accEl.value = rec.account || 'Cash';

    const formTitle = document.getElementById('formCardTitle');
    const submitBtn = document.getElementById('submitRecordBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (formTitle) formTitle.textContent = 'Edit Record';
    if (submitBtn) submitBtn.textContent = 'Update Record';
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    switchTab('tab-records');
  }

  function deleteRecordById(id) {
    const idx = state.records.findIndex(function (r) { return r.id === id; });
    if (idx === -1) return;
    const removed = state.records.splice(idx, 1)[0];
    state.lastDeletedRecord = removed;
    logHistory(
      'Deleted Record',
      (removed.type === 'income' ? 'Income' : 'Expense') + ' — ' + removed.category + ' (' + formatCurrency(removed.amount) + ')'
    );
    safeSaveStorage();
    renderAll();
    showToast('Record deleted. You can undo this from the History page.');
  }

  function undoLastDelete() {
    if (!state.lastDeletedRecord) return;
    state.records.unshift(state.lastDeletedRecord);
    logHistory(
      'Restored Deleted Record',
      state.lastDeletedRecord.category + ' (' + formatCurrency(state.lastDeletedRecord.amount) + ')'
    );
    state.lastDeletedRecord = null;
    safeSaveStorage();
    renderAll();
    showToast('Deleted record restored!');
  }

  // Savings Goal Form Handlers
  function handleGoalFormSubmit(e) {
    e.preventDefault();
    const nameVal = (document.getElementById('goalNameInput')?.value || '').trim();
    const purposeVal = (document.getElementById('goalPurposeInput')?.value || '').trim();
    const targetAmt = parseFloat(document.getElementById('goalTargetAmountInput')?.value || '0') || 0;
    const savedAmt = parseFloat(document.getElementById('goalSavedAmountInput')?.value || '0') || 0;
    const targetDate = document.getElementById('goalTargetDateInput')?.value || '2027-05-15';
    const priorityVal = document.getElementById('goalPriorityInput')?.value || 'Medium';

    if (!nameVal || targetAmt <= 0) {
      showToast('Please enter a goal name and a target amount greater than zero.');
      return;
    }

    if (state.editingGoalId) {
      const idx = state.savingsGoals.findIndex(function (g) { return g.id === state.editingGoalId; });
      if (idx !== -1) {
        state.savingsGoals[idx] = {
          id: state.editingGoalId,
          name: nameVal,
          purpose: purposeVal,
          targetAmount: Math.round(targetAmt * 100) / 100,
          savedAmount: Math.round(savedAmt * 100) / 100,
          targetDate: targetDate,
          priority: priorityVal
        };
        logHistory('Updated Savings Goal', nameVal + ' (Target: ' + formatCurrency(targetAmt) + ')');
        showToast('Savings goal updated!');
      }
    } else {
      state.savingsGoals.push({
        id: 'goal-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        name: nameVal,
        purpose: purposeVal,
        targetAmount: Math.round(targetAmt * 100) / 100,
        savedAmount: Math.round(savedAmt * 100) / 100,
        targetDate: targetDate,
        priority: priorityVal
      });
      logHistory('Created Savings Goal', nameVal + ' — Target ' + formatCurrency(targetAmt) + ' by ' + targetDate);
      showToast('New savings goal created!');
    }

    resetGoalForm();
    safeSaveStorage();
    renderAll();
  }

  function resetGoalForm() {
    state.editingGoalId = null;
    const titleEl = document.getElementById('goalFormTitle');
    const btnEl = document.getElementById('saveGoalBtn');
    const cancelEl = document.getElementById('cancelGoalEditBtn');
    if (titleEl) titleEl.textContent = 'Create Savings Goal';
    if (btnEl) btnEl.textContent = 'Save Goal';
    if (cancelEl) cancelEl.style.display = 'none';

    const n = document.getElementById('goalNameInput');
    const p = document.getElementById('goalPurposeInput');
    const t = document.getElementById('goalTargetAmountInput');
    const s = document.getElementById('goalSavedAmountInput');
    if (n) n.value = '';
    if (p) p.value = '';
    if (t) t.value = '';
    if (s) s.value = '0';
  }

  function handleSavingsDepositSubmit(e) {
    e.preventDefault();
    const goalId = document.getElementById('depositGoalSelect')?.value || '';
    const typeVal = document.getElementById('depositTypeSelect')?.value || 'deposit';
    const amtRaw = parseFloat(document.getElementById('depositAmountInput')?.value || '0') || 0;
    const dateVal = document.getElementById('depositDateInput')?.value || getTodayIso();
    const noteVal = (document.getElementById('depositNoteInput')?.value || '').trim();
    const syncToExpenses = document.getElementById('syncDepositToCashflow')?.checked;

    const goal = state.savingsGoals.find(function (g) { return g.id === goalId; });
    if (!goal) {
      showToast('Please select or create a savings goal first.');
      return;
    }
    if (amtRaw <= 0) {
      showToast('Please enter a valid deposit/withdrawal amount.');
      return;
    }

    if (typeVal === 'withdrawal') {
      goal.savedAmount = Math.max(0, (Number(goal.savedAmount) || 0) - amtRaw);
    } else {
      goal.savedAmount = (Number(goal.savedAmount) || 0) + amtRaw;
    }

    state.savingsRecords.unshift({
      id: 'srec-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: dateVal,
      goalId: goal.id,
      goalName: goal.name,
      type: typeVal,
      amount: Math.round(amtRaw * 100) / 100,
      note: noteVal || (typeVal === 'deposit' ? 'Savings deposit' : 'Savings withdrawal')
    });

    if (syncToExpenses && typeVal === 'deposit') {
      state.records.unshift({
        id: 'rec-sav-' + Date.now(),
        date: dateVal,
        type: 'expense',
        category: 'Savings Deposit / Transfer',
        description: 'Savings transfer to ' + goal.name + (noteVal ? ' (' + noteVal + ')' : ''),
        amount: Math.round(amtRaw * 100) / 100,
        account: 'Bank / ATM'
      });
    }

    logHistory(
      typeVal === 'deposit' ? 'Logged Savings Deposit' : 'Logged Savings Withdrawal',
      goal.name + ' — ' + formatCurrency(amtRaw)
    );

    const amtInput = document.getElementById('depositAmountInput');
    const noteInput = document.getElementById('depositNoteInput');
    if (amtInput) amtInput.value = '';
    if (noteInput) noteInput.value = '';

    safeSaveStorage();
    renderAll();
    showToast('Savings record logged for ' + goal.name + '!');
  }

  async function exportJsonFile() {
    const payload = {
      appName: 'Income, Expense & Savings Offline Tracker',
      version: '4.0',
      exportedAt: new Date().toISOString(),
      summary: computeAggregates(),
      records: state.records,
      savingsGoals: state.savingsGoals,
      savingsRecords: state.savingsRecords,
      history: state.history
    };
    const jsonString = JSON.stringify(payload, null, 2);
    const defaultName = 'income-expense-records-' + (new Date().toISOString().slice(0, 10)) + '.json';

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: 'JSON Backup File',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        logHistory('Saved Backup File (JSON)', 'Saved ' + state.records.length + ' records and ' + state.savingsGoals.length + ' savings goals.');
        renderHistoryLog();
        showToast('JSON backup file saved!');
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    triggerBlobDownload(jsonString, defaultName, 'application/json;charset=utf-8');
    logHistory('Exported File (JSON)', 'Downloaded ' + defaultName + ' (' + state.records.length + ' records).');
    renderHistoryLog();
    showToast('Downloaded JSON backup file!');
  }

  function exportCsvFile() {
    const headers = ['id', 'date', 'type', 'category', 'description', 'amount', 'account'];
    const rows = [headers.join(',')];
    state.records.forEach(function (r) {
      const row = headers.map(function (h) {
        const val = String(r[h] == null ? '' : r[h]).replace(/"/g, '""');
        return '"' + val + '"';
      });
      rows.push(row.join(','));
    });
    const csvContent = rows.join('\n');
    const fileName = 'income-expense-records-' + (new Date().toISOString().slice(0, 10)) + '.csv';
    triggerBlobDownload(csvContent, fileName, 'text/csv;charset=utf-8');
    logHistory('Exported File (CSV)', 'Downloaded CSV spreadsheet (' + state.records.length + ' records).');
    renderHistoryLog();
    showToast('Downloaded CSV file for Excel/Spreadsheets!');
  }

  function triggerBlobDownload(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function handleImportedFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      const text = String(ev.target?.result || '');
      const isCsv = file.name.toLowerCase().endsWith('.csv');
      try {
        let importedRecords = [];
        let importedGoals = [];
        let importedSavingsRecords = [];
        if (isCsv) {
          importedRecords = parseCsvRecords(text);
        } else {
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.records) ? parsed.records : []);
          importedRecords = arr.map(normalizeRecord).filter(Boolean);
          if (Array.isArray(parsed.savingsGoals)) importedGoals = parsed.savingsGoals;
          if (Array.isArray(parsed.savingsRecords)) importedSavingsRecords = parsed.savingsRecords;
        }

        if (importedRecords.length === 0 && importedGoals.length === 0) {
          showToast('No valid records found in the selected file.');
          return;
        }

        const modeEl = document.querySelector('input[name="importModeRadio"]:checked');
        const mode = modeEl ? modeEl.value : 'merge';

        if (mode === 'replace') {
          state.records = importedRecords;
          state.savingsGoals = importedGoals;
          state.savingsRecords = importedSavingsRecords;
        } else {
          const existingIds = {};
          state.records.forEach(function (r) { existingIds[r.id] = true; });
          importedRecords.forEach(function (r) {
            if (existingIds[r.id]) {
              r.id = 'rec-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
            }
            state.records.push(r);
          });
          if (importedGoals.length > 0) {
            importedGoals.forEach(function (g) {
              if (!state.savingsGoals.some(function (eg) { return eg.id === g.id; })) {
                state.savingsGoals.push(g);
              }
            });
          }
          if (importedSavingsRecords.length > 0) {
            importedSavingsRecords.forEach(function (sr) {
              if (!state.savingsRecords.some(function (esr) { return esr.id === sr.id; })) {
                state.savingsRecords.push(sr);
              }
            });
          }
        }

        logHistory(
          'Loaded File (' + file.name + ')',
          (mode === 'replace' ? 'Replaced with ' : 'Merged ') + importedRecords.length + ' records from file.'
        );
        safeSaveStorage();
        renderAll();
        showToast('Loaded ' + importedRecords.length + ' records from ' + file.name + '!');
      } catch (err) {
        showToast('Unable to read file. Please select a valid JSON or CSV file.');
      }
    };
    reader.readAsText(file);
  }

  function normalizeRecord(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;
    const amt = parseFloat(raw.amount);
    if (isNaN(amt) || amt <= 0) return null;
    const rawType = String(raw.type || '').toLowerCase();
    const type = (rawType === 'expense' || rawType === 'gastos') ? 'expense' : 'income';
    return {
      id: String(raw.id || ('rec-imp-' + Date.now() + '-' + (idx || 0))),
      date: String(raw.date || getTodayIso()).slice(0, 10),
      type: type,
      category: String(raw.category || (type === 'income' ? 'Other Income' : 'Other Expenses')),
      description: String(raw.description || raw.category || ''),
      amount: Math.round(amt * 100) / 100,
      account: String(raw.account || 'Cash')
    };
  }

  function parseCsvRecords(csvText) {
    const lines = csvText.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
    if (lines.length < 2) return [];
    const headers = splitCsvLine(lines[0]).map(function (h) { return h.trim().toLowerCase(); });
    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      const obj = {};
      headers.forEach(function (h, cIdx) {
        obj[h] = cols[cIdx] != null ? cols[cIdx].trim() : '';
      });
      const norm = normalizeRecord(obj, i);
      if (norm) results.push(norm);
    }
    return results;
  }

  function splitCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function openNavDrawer() {
    document.getElementById('navDrawer')?.classList.add('open');
    document.getElementById('navBackdrop')?.classList.add('open');
  }

  function closeNavDrawer() {
    document.getElementById('navDrawer')?.classList.remove('open');
    document.getElementById('navBackdrop')?.classList.remove('open');
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === tabId);
    });
    const pageTitleEl = document.getElementById('currentPageTitle');
    if (pageTitleEl) {
      pageTitleEl.textContent = PAGE_TITLES[tabId] || 'Home Overview';
    }
    closeNavDrawer();
    if (tabId === 'tab-summary') {
      renderCanvasChart(computeAggregates());
    }
  }

  function openConfirmModal(title, message, onConfirm) {
    state.pendingConfirmAction = onConfirm;
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (modal) modal.classList.add('open');
  }

  function closeConfirmModal() {
    state.pendingConfirmAction = null;
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('open');
  }

  function initEvents() {
    document.getElementById('menuToggleBtn')?.addEventListener('click', openNavDrawer);
    document.getElementById('drawerCloseBtn')?.addEventListener('click', closeNavDrawer);
    document.getElementById('navBackdrop')?.addEventListener('click', closeNavDrawer);

    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = btn.getAttribute('data-tab');
        if (target) switchTab(target);
      });
    });

    document.getElementById('typeBtnIncome')?.addEventListener('click', function () {
      setTransactionType('income');
    });
    document.getElementById('typeBtnExpense')?.addEventListener('click', function () {
      setTransactionType('expense');
    });

    document.getElementById('recordForm')?.addEventListener('submit', handleFormSubmit);
    document.getElementById('cancelEditBtn')?.addEventListener('click', resetForm);

    document.getElementById('recordsTableBody')?.addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (action === 'edit') startEditRecord(id);
      if (action === 'delete') deleteRecordById(id);
    });

    // Savings Goals & Deposit Events
    document.getElementById('savingsGoalForm')?.addEventListener('submit', handleGoalFormSubmit);
    document.getElementById('cancelGoalEditBtn')?.addEventListener('click', resetGoalForm);
    document.getElementById('savingsDepositForm')?.addEventListener('submit', handleSavingsDepositSubmit);
    document.getElementById('paydaySalaryInput')?.addEventListener('input', updatePaydayAllocatorHint);
    document.getElementById('paydaySavePctInput')?.addEventListener('input', updatePaydayAllocatorHint);

    document.getElementById('useLatestSalaryBtn')?.addEventListener('click', function () {
      const latestInc = state.records.find(function (r) { return r.type === 'income'; });
      const salaryInput = document.getElementById('paydaySalaryInput');
      if (latestInc && salaryInput) {
        salaryInput.value = latestInc.amount;
        updatePaydayAllocatorHint();
        showToast('Filled latest income (' + formatCurrency(latestInc.amount) + ')!');
      } else {
        showToast('No income record found yet.');
      }
    });

    document.getElementById('savingsGoalsGrid')?.addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-goal-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-goal-action');
      const goalId = btn.getAttribute('data-goal-id');
      const goal = state.savingsGoals.find(function (g) { return g.id === goalId; });
      if (!goal) return;

      if (action === 'quick-deposit') {
        const sel = document.getElementById('depositGoalSelect');
        const amtIn = document.getElementById('depositAmountInput');
        if (sel) sel.value = goal.id;
        const sched = computeGoalSchedule(goal.targetAmount, goal.savedAmount, goal.targetDate);
        if (amtIn) {
          amtIn.value = Math.round(sched.perBiMonthly * 100) / 100;
          amtIn.focus();
        }
        showToast('Pre-filled suggested payday deposit for ' + goal.name + '!');
      } else if (action === 'edit-goal') {
        state.editingGoalId = goal.id;
        const n = document.getElementById('goalNameInput');
        const p = document.getElementById('goalPurposeInput');
        const t = document.getElementById('goalTargetAmountInput');
        const s = document.getElementById('goalSavedAmountInput');
        const d = document.getElementById('goalTargetDateInput');
        const pr = document.getElementById('goalPriorityInput');
        if (n) n.value = goal.name;
        if (p) p.value = goal.purpose || '';
        if (t) t.value = goal.targetAmount;
        if (s) s.value = goal.savedAmount;
        if (d) d.value = goal.targetDate;
        if (pr) pr.value = goal.priority || 'Medium';

        const titleEl = document.getElementById('goalFormTitle');
        const btnEl = document.getElementById('saveGoalBtn');
        const cancelEl = document.getElementById('cancelGoalEditBtn');
        if (titleEl) titleEl.textContent = 'Edit Savings Goal';
        if (btnEl) btnEl.textContent = 'Update Goal';
        if (cancelEl) cancelEl.style.display = 'inline-flex';
      } else if (action === 'delete-goal') {
        state.savingsGoals = state.savingsGoals.filter(function (g) { return g.id !== goalId; });
        logHistory('Deleted Savings Goal', goal.name);
        safeSaveStorage();
        renderAll();
        showToast('Savings goal removed.');
      }
    });

    document.getElementById('savingsRecordsTableBody')?.addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-srec-delete]');
      if (!btn) return;
      const srecId = btn.getAttribute('data-srec-delete');
      const idx = state.savingsRecords.findIndex(function (sr) { return sr.id === srecId; });
      if (idx === -1) return;
      const removed = state.savingsRecords.splice(idx, 1)[0];
      const goal = state.savingsGoals.find(function (g) { return g.id === removed.goalId; });
      if (goal) {
        if (removed.type === 'withdrawal') {
          goal.savedAmount = (Number(goal.savedAmount) || 0) + (Number(removed.amount) || 0);
        } else {
          goal.savedAmount = Math.max(0, (Number(goal.savedAmount) || 0) - (Number(removed.amount) || 0));
        }
      }
      logHistory('Removed Savings Entry', removed.goalName + ' (' + formatCurrency(removed.amount) + ')');
      safeSaveStorage();
      renderAll();
      showToast('Savings entry removed.');
    });

    // Built-In Calculator Events
    document.getElementById('calcKeypadGrid')?.addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-calc-key]');
      if (!btn) return;
      handleCalcKey(btn.getAttribute('data-calc-key'));
    });

    document.getElementById('calcSendToRecordBtn')?.addEventListener('click', function () {
      const val = parseFloat(state.calcDisplay);
      if (!val || val <= 0) {
        showToast('Calculate a positive number first.');
        return;
      }
      const amtEl = document.getElementById('recordAmount');
      if (amtEl) amtEl.value = val;
      switchTab('tab-records');
      showToast('Sent ' + formatCurrency(val) + ' to Record Amount!');
    });

    document.getElementById('calcSendToSavingsBtn')?.addEventListener('click', function () {
      const val = parseFloat(state.calcDisplay);
      if (!val || val <= 0) {
        showToast('Calculate a positive number first.');
        return;
      }
      const depEl = document.getElementById('depositAmountInput');
      if (depEl) depEl.value = val;
      switchTab('tab-savings');
      showToast('Sent ' + formatCurrency(val) + ' to Savings Deposit!');
    });

    ['estGoalPurpose', 'estTargetAmount', 'estCurrentSaved', 'estTargetDate', 'estMonthlyIncome', 'estCustomPerMonth'].forEach(function (id) {
      document.getElementById(id)?.addEventListener('input', runSavingsGoalEstimator);
      document.getElementById(id)?.addEventListener('change', runSavingsGoalEstimator);
    });

    document.getElementById('estCreateGoalFromCalcBtn')?.addEventListener('click', function () {
      const purpose = (document.getElementById('estGoalPurpose')?.value || 'New Savings Goal').trim();
      const targetAmt = parseFloat(document.getElementById('estTargetAmount')?.value || '0') || 0;
      const currentAmt = parseFloat(document.getElementById('estCurrentSaved')?.value || '0') || 0;
      const targetDate = document.getElementById('estTargetDate')?.value || '2027-05-15';

      if (targetAmt <= 0) {
        showToast('Enter a target amount greater than zero.');
        return;
      }
      state.savingsGoals.push({
        id: 'goal-' + Date.now(),
        name: purpose,
        purpose: 'Created from Goal Calculator',
        targetAmount: Math.round(targetAmt * 100) / 100,
        savedAmount: Math.round(currentAmt * 100) / 100,
        targetDate: targetDate,
        priority: 'High'
      });
      logHistory('Added Goal from Calculator', purpose + ' (' + formatCurrency(targetAmt) + ')');
      safeSaveStorage();
      renderAll();
      switchTab('tab-savings');
      showToast('Added "' + purpose + '" to your active Savings Goals!');
    });

    // Smart Recommendations Controls
    document.getElementById('recPeriodSelect')?.addEventListener('change', function () {
      renderSmartRecommendations(computeAggregates());
    });
    document.getElementById('recRuleSelect')?.addEventListener('change', function () {
      renderSmartRecommendations(computeAggregates());
    });

    // Filters
    ['filterSearch', 'filterType', 'filterCategory', 'filterMonth', 'filterSort'].forEach(function (id) {
      document.getElementById(id)?.addEventListener('input', renderRecordsTable);
      document.getElementById(id)?.addEventListener('change', renderRecordsTable);
    });

    document.getElementById('clearFiltersBtn')?.addEventListener('click', function () {
      const s = document.getElementById('filterSearch');
      const t = document.getElementById('filterType');
      const c = document.getElementById('filterCategory');
      const m = document.getElementById('filterMonth');
      const so = document.getElementById('filterSort');
      if (s) s.value = '';
      if (t) t.value = 'all';
      if (c) c.value = 'all';
      if (m) m.value = '';
      if (so) so.value = 'date-desc';
      renderRecordsTable();
    });

    document.getElementById('referenceDateInput')?.addEventListener('change', renderAll);

    // Chart mode toggle
    document.getElementById('chartModeMonthlyBtn')?.addEventListener('click', function () {
      state.chartMode = 'monthly';
      document.getElementById('chartModeMonthlyBtn')?.classList.add('btn-primary');
      document.getElementById('chartModeMonthlyBtn')?.classList.remove('btn-outline');
      document.getElementById('chartModeWeeklyBtn')?.classList.add('btn-outline');
      document.getElementById('chartModeWeeklyBtn')?.classList.remove('btn-primary');
      renderCanvasChart(computeAggregates());
    });

    document.getElementById('chartModeWeeklyBtn')?.addEventListener('click', function () {
      state.chartMode = 'weekly';
      document.getElementById('chartModeWeeklyBtn')?.classList.add('btn-primary');
      document.getElementById('chartModeWeeklyBtn')?.classList.remove('btn-outline');
      document.getElementById('chartModeMonthlyBtn')?.classList.add('btn-outline');
      document.getElementById('chartModeMonthlyBtn')?.classList.remove('btn-primary');
      renderCanvasChart(computeAggregates());
    });

    // Top bar & File Save/Load actions
    document.getElementById('topSaveJsonBtn')?.addEventListener('click', exportJsonFile);
    document.getElementById('topOpenFileBtn')?.addEventListener('click', function () {
      document.getElementById('hiddenFileInput')?.click();
    });
    document.getElementById('exportJsonBtn')?.addEventListener('click', exportJsonFile);
    document.getElementById('exportCsvBtn')?.addEventListener('click', exportCsvFile);

    const fileInput = document.getElementById('hiddenFileInput');
    fileInput?.addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (file) handleImportedFile(file);
      fileInput.value = '';
    });

    const dropZone = document.getElementById('fileDropZone');
    if (dropZone) {
      dropZone.addEventListener('click', function () {
        fileInput?.click();
      });
      dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
      dropZone.addEventListener('dragleave', function () {
        dropZone.classList.remove('dragover');
      });
      dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer?.files && e.dataTransfer.files[0];
        if (file) handleImportedFile(file);
      });
    }

    // Load Sample Data & Clear All
    document.getElementById('loadSampleBtn')?.addEventListener('click', function () {
      state.records = JSON.parse(JSON.stringify(SAMPLE_RECORDS));
      state.savingsGoals = JSON.parse(JSON.stringify(SAMPLE_SAVINGS_GOALS));
      state.savingsRecords = JSON.parse(JSON.stringify(SAMPLE_SAVINGS_RECORDS));
      logHistory('Loaded Sample Data', 'Loaded optional sample records and savings goal.');
      safeSaveStorage();
      renderAll();
      closeNavDrawer();
      showToast('Sample data loaded!');
    });

    document.getElementById('clearAllRecordsBtn')?.addEventListener('click', function () {
      openConfirmModal(
        'Clear All Data?',
        'Are you sure you want to permanently clear all records, savings goals, and savings entries? They will stay empty even after refreshing the page.',
        function () {
          state.records = [];
          state.savingsGoals = [];
          state.savingsRecords = [];
          state.lastDeletedRecord = null;
          try {
            localStorage.removeItem('income_expense_tracker_en_v3');
            localStorage.removeItem('income_expense_tracker_en_v2');
            localStorage.removeItem('kita_gastos_offline_v1');
          } catch (e) {}
          logHistory('Cleared All Data', 'Reset all records and savings goals to empty.');
          safeSaveStorage();
          renderAll();
          showToast('All data cleared permanently.');
        }
      );
    });

    // History actions
    document.getElementById('undoDeleteBtn')?.addEventListener('click', undoLastDelete);
    document.getElementById('clearHistoryBtn')?.addEventListener('click', function () {
      state.history = [];
      safeSaveStorage();
      renderHistoryLog();
      showToast('Activity history cleared.');
    });

    // Modal buttons
    document.getElementById('confirmModalCancel')?.addEventListener('click', closeConfirmModal);
    document.getElementById('confirmModalOk')?.addEventListener('click', function () {
      if (typeof state.pendingConfirmAction === 'function') {
        state.pendingConfirmAction();
      }
      closeConfirmModal();
    });

    window.addEventListener('resize', function () {
      if (state.activeTab === 'tab-summary') {
        renderCanvasChart(computeAggregates());
      }
    });
  }

  window.addEventListener('DOMContentLoaded', function () {
    const today = getTodayIso();
    ['referenceDateInput', 'recordDate', 'depositDateInput'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = today;
    });
    safeLoadStorage();
    populateCategoryOptions();
    resetForm();
    initEvents();
    renderCalcTape();
    renderAll();
  });
})();

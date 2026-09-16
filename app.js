(() => {
  'use strict';

  const START_KEY = '2026-10-12';
  const START_MONTH = START_KEY.slice(0, 7);
  const STORAGE_KEY = 'chixx-plan-records-v2-start-20260917';
  const TEMPLATES_KEY = 'chixx-plan-templates-v7';
  const LEGACY_TEMPLATE_KEY = 'chixx-growth-daily-template-v1';
  const REMINDER_KEY = 'chixx-reminder-settings-v1';
  const PERIODS = ['day', 'week', 'month', 'year'];
  const TEMPLATE_PERIODS = ['day', 'week', 'month'];
  const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
  const LEGACY_YEAR_TASK_RENAMES = {
    '回顾过去一年的经验': '复盘过去一年真正有效的经验',
    '定义今年最重要的3个主题': '定义今年最重要的三个增长主题',
    '选择不超过5个年度成果': '选出不超过五个年度结果',
    '把成果分配到季度检查点': '把年度结果拆进季度检查点',
  };
  const META = {
    day: {
      label: '日计划',
      eyebrow: 'TODAY · 今天必须推进',
      templateLabel: '每日',
      focusLabel: '今天只做能改变结果的事',
      focusPlaceholder: '写下今天最值钱的一件事',
      taskHelp: '别堆事项，只留下真正推动结果的动作。',
      reflectionLabel: '今天拿到了什么结果？',
      reflectionPlaceholder: '做对了什么、浪费了什么、明天怎么做得更准。',
      tasks: [],
    },
    week: {
      label: '周计划',
      eyebrow: 'WEEKLY · 一周必须有结果',
      templateLabel: '每周',
      focusLabel: '这周你到底要赢什么？',
      focusPlaceholder: '一周结束时，什么结果能证明你没白忙？',
      taskHelp: '把目标拆成动作，不要把愿望当计划。',
      reflectionLabel: '这周哪些动作真的值钱？',
      reflectionPlaceholder: '结果从哪里来，问题卡在哪里，下周保留什么、砍掉什么。',
      tasks: [],
    },
    month: {
      label: '月计划',
      eyebrow: 'MONTHLY · 本月必须升级',
      templateLabel: '每月',
      focusLabel: '这个月必须拿下什么？',
      focusPlaceholder: '写下本月最能提升能力、收入或选择权的结果。',
      taskHelp: '别堆事项，只留下真正推动结果的动作。',
      reflectionLabel: '这个月，你完成了什么升级？',
      reflectionPlaceholder: '能力增加了吗？资源增加了吗？选择权增加了吗？',
      tasks: [],
    },
    year: {
      label: '年计划',
      eyebrow: 'YEARLY · 一年只做重要的事',
      focusLabel: '用一年，把自己推到下一层。',
      focusPlaceholder: '年底回头看，什么结果能证明这一年没有白过？',
      taskHelp: '别堆事项，只留下真正推动结果的动作。',
      reflectionLabel: '这一年，你的能力、资产和选择权增加了吗？',
      reflectionPlaceholder: '不要只写经历了什么，要写最终留下了什么。',
      tasks: [
        '复盘过去一年真正有效的经验',
        '定义今年最重要的三个增长主题',
        '选出不超过五个年度结果',
        '把年度结果拆进季度检查点',
      ],
    },
  };

  const app = document.querySelector('#app');
  const toastNode = document.querySelector('#toast');
  const compactQuery = window.matchMedia('(max-width: 619px)');
  let toastTimer;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDate(key) {
    const [year, month, day = 1] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function shiftDay(key, amount) {
    const date = parseDate(key);
    date.setDate(date.getDate() + amount);
    return dateKey(date);
  }

  function shiftMonth(key, amount) {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, month - 1 + amount, 1);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function weekStart(date) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
    return result;
  }

  function periodKey(period, date) {
    if (period === 'day') return dateKey(date);
    if (period === 'week') return dateKey(weekStart(date));
    if (period === 'month') return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    return String(date.getFullYear());
  }

  function displayDate(period, key) {
    if (period === 'day') {
      const date = parseDate(key);
      const names = ['日', '一', '二', '三', '四', '五', '六'];
      return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 周${names[date.getDay()]}`;
    }
    if (period === 'week') {
      const start = parseDate(key);
      const end = parseDate(shiftDay(key, 6));
      return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日—${end.getMonth() + 1}月${end.getDate()}日`;
    }
    if (period === 'month') {
      const [year, month] = key.split('-');
      return `${year}年${Number(month)}月`;
    }
    return `${key}年`;
  }

  function id() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    })[char]);
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      showToast('保存失败，请检查浏览器存储权限');
      return false;
    }
  }

  function showToast(message) {
    toastNode.textContent = message;
    toastNode.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastNode.classList.remove('show'), 1800);
  }

  function normalizeTemplate(input) {
    if (!Array.isArray(input)) return [];
    return input
      .map((item) => ({
        id: String(item && typeof item === 'object' && item.id ? item.id : id()),
        text: String(typeof item === 'string' ? item : item?.text || '').trim(),
      }))
      .filter((item) => item.text);
  }

  function loadTemplates() {
    const saved = readJSON(TEMPLATES_KEY, null);
    if (saved && typeof saved === 'object') {
      return {
        day: normalizeTemplate(saved.day),
        week: normalizeTemplate(saved.week),
        month: normalizeTemplate(saved.month),
      };
    }
    return {
      day: normalizeTemplate(readJSON(LEGACY_TEMPLATE_KEY, [])),
      week: [],
      month: [],
    };
  }

  function normalizeRecords(input) {
    if (!Array.isArray(input)) return [];
    return input
      .filter(
        (record) =>
          PERIODS.includes(record?.period) &&
          typeof record?.periodKey === 'string' &&
          record?.plan,
      )
      .map((record) => ({
        id: `${record.period}:${record.periodKey}`,
        period: record.period,
        periodKey: record.periodKey,
        updatedAt: Number(record.updatedAt) || 0,
        plan: {
          focus: String(record.plan.focus || ''),
          reflection: String(record.plan.reflection || ''),
          tasks: Array.isArray(record.plan.tasks)
            ? record.plan.tasks
                .map((task) => ({
                  id: String(task?.id || id()),
                  text:
                    record.period === 'year'
                      ? LEGACY_YEAR_TASK_RENAMES[
                          String(task?.text || '').trim()
                        ] || String(task?.text || '').trim()
                      : String(task?.text || '').trim(),
                  done: Boolean(task?.done),
                }))
                .filter((task) => task.text)
            : [],
        },
      }))
      .filter(
        (record) => record.period !== 'day' || record.periodKey >= START_KEY,
      );
  }

  function normalizeReminder(input) {
    const source = input && typeof input === 'object' ? input : {};
    return {
      enabled: Boolean(source.enabled),
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(source.time)
        ? source.time
        : '20:00',
      lastShownKey:
        typeof source.lastShownKey === 'string' ? source.lastShownKey : '',
    };
  }

  function makeTask(text) {
    return { id: id(), text, done: false };
  }

  const startDate = parseDate(START_KEY);
  const startWeekKey = periodKey('week', startDate);
  const now = new Date();
  const todayKey = dateKey(now);
  const dayHomeKey = todayKey < START_KEY ? START_KEY : todayKey;
  const planHomeDate = todayKey < START_KEY ? startDate : now;
  const state = {
    period: 'day',
    todayKey,
    dayHomeKey,
    currentKeys: {
      day: dayHomeKey,
      week: periodKey('week', planHomeDate),
      month: periodKey('month', planHomeDate),
      year: periodKey('year', now),
    },
    selectedKeys: {},
    records: normalizeRecords(readJSON(STORAGE_KEY, [])),
    templates: loadTemplates(),
    reminder: normalizeReminder(readJSON(REMINDER_KEY, null)),
    statsMonth: dayHomeKey.slice(0, 7),
    editingTemplate: false,
    folds: { execution: true, data: false, settings: false },
  };
  state.selectedKeys = { ...state.currentKeys };

  function defaultPlan(period) {
    const prompts =
      period === 'year'
        ? META.year.tasks
        : state.templates[period].map((item) => item.text);
    return { focus: '', reflection: '', tasks: prompts.map(makeTask) };
  }

  function recordId(period, key) {
    return `${period}:${key}`;
  }

  function findRecord(period, key) {
    return state.records.find(
      (record) => record.period === period && record.periodKey === key,
    );
  }

  function getPlan(period = state.period, key = state.selectedKeys[period]) {
    const record = findRecord(period, key);
    return record ? clone(record.plan) : defaultPlan(period);
  }

  function savePlan(plan, rerender = true) {
    const period = state.period;
    const key = state.selectedKeys[period];
    const record = findRecord(period, key);
    if (record) {
      record.plan = clone(plan);
      record.updatedAt = Date.now();
    } else {
      state.records.push({
        id: recordId(period, key),
        period,
        periodKey: key,
        plan: clone(plan),
        updatedAt: Date.now(),
      });
    }
    writeJSON(STORAGE_KEY, state.records);
    if (rerender) render();
  }

  function saveTemplates() {
    writeJSON(TEMPLATES_KEY, state.templates);
  }

  function saveReminder() {
    writeJSON(REMINDER_KEY, state.reminder);
  }

  function ensureCurrentPlans() {
    let changed = false;
    ['week', 'month', 'year'].forEach((period) => {
      const key = state.currentKeys[period];
      if (!findRecord(period, key)) {
        state.records.push({
          id: recordId(period, key),
          period,
          periodKey: key,
          plan: defaultPlan(period),
          updatedAt: 0,
        });
        changed = true;
      }
    });
    if (changed) writeJSON(STORAGE_KEY, state.records);
  }

  function checkedKeys() {
    return state.records
      .filter(
        (record) =>
          record.period === 'day' &&
          record.periodKey >= START_KEY &&
          record.periodKey <= state.todayKey &&
          record.plan.tasks.length > 0 &&
          record.plan.tasks.every((task) => task.done),
      )
      .map((record) => record.periodKey)
      .sort();
  }

  function streaks(keys) {
    const set = new Set(keys);
    let cursor = set.has(state.todayKey)
      ? state.todayKey
      : shiftDay(state.todayKey, -1);
    let current = 0;
    while (cursor >= START_KEY && set.has(cursor)) {
      current += 1;
      cursor = shiftDay(cursor, -1);
    }
    let longest = 0;
    let run = 0;
    let previous = '';
    keys.forEach((key) => {
      run = previous && key === shiftDay(previous, 1) ? run + 1 : 1;
      longest = Math.max(longest, run);
      previous = key;
    });
    return { current, longest };
  }

  function eligibleDays(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    const days = new Date(year, month, 0).getDate();
    let result = 0;
    for (let day = 1; day <= days; day += 1) {
      const key = `${monthKey}-${pad(day)}`;
      if (key >= START_KEY && key <= state.todayKey) result += 1;
    }
    return result;
  }

  function dayMap() {
    return Object.fromEntries(
      state.records
        .filter(
          (record) =>
            record.period === 'day' && record.periodKey >= START_KEY,
        )
        .map((record) => [record.periodKey, record]),
    );
  }

  function dayStatus(key, records, checkedSet) {
    const record = records[key];
    const total = record?.plan.tasks.length || 0;
    const completed =
      record?.plan.tasks.filter((task) => task.done).length || 0;
    const progress = total ? Math.round((completed / total) * 100) : 0;
    return {
      record,
      total,
      completed,
      progress,
      checked: checkedSet.has(key),
      beforeStart: key < START_KEY,
      future: key > state.todayKey,
      today: key === state.todayKey,
      selected: key === state.selectedKeys.day,
    };
  }

  function weekOverview(records, checkedSet) {
    const startKey = periodKey('week', parseDate(state.selectedKeys.day));
    const days = WEEKDAYS.map((weekday, index) => {
      const key = shiftDay(startKey, index);
      const status = dayStatus(key, records, checkedSet);
      let label = '未记录';
      if (status.beforeStart) label = '未启用';
      else if (status.checked) label = '兑现';
      else if (status.progress > 0)
        label = `${status.completed}/${status.total}`;
      else if (status.future) label = '待开始';
      else if (status.record && status.total > 0)
        label = `0/${status.total}`;
      else if (status.record) label = '无清单';
      const classes = [
        status.selected ? 'selected' : '',
        status.today ? 'today' : '',
        status.checked ? 'checked' : '',
        status.progress > 0 && !status.checked ? 'partial' : '',
        status.beforeStart ? 'disabled' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<button class="week-day ${classes}" data-action="select-day" data-key="${key}" ${status.beforeStart ? 'disabled' : ''}><span class="week-day-label">周${weekday}</span><span class="week-day-number">${Number(key.slice(-2))}</span><span class="week-day-status">${label}</span></button>`;
    }).join('');
    const endKey = shiftDay(startKey, 6);
    return {
      label: `${Number(startKey.slice(5, 7))}.${Number(startKey.slice(8, 10))}—${Number(endKey.slice(5, 7))}.${Number(endKey.slice(8, 10))}`,
      html: days,
    };
  }

  function calendar(records, checkedSet) {
    const [year, month] = state.statsMonth.split('-').map(Number);
    const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const count = new Date(year, month, 0).getDate();
    const cells = Array.from(
      { length: offset },
      () => '<div class="calendar-empty"></div>',
    );
    for (let day = 1; day <= count; day += 1) {
      const key = `${state.statsMonth}-${pad(day)}`;
      const status = dayStatus(key, records, checkedSet);
      const classes = [
        status.selected ? 'selected' : '',
        status.today ? 'today' : '',
        status.checked ? 'checked' : '',
        status.future ? 'future' : '',
        status.beforeStart ? 'disabled' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const progress =
        status.total && !status.checked
          ? `<span class="cell-progress"><span style="width:${status.progress}%"></span></span>`
          : '';
      cells.push(`<button class="calendar-cell ${classes}" data-action="select-day" data-key="${key}" ${status.beforeStart ? 'disabled' : ''} aria-label="${esc(displayDate('day', key))}${status.today ? '，今天' : ''}${status.checked ? '，已兑现' : ''}"><span class="calendar-number">${day}</span>${status.today ? '<span class="today-tag">今</span>' : ''}${status.checked ? '<span class="check-dot">✓</span>' : ''}${progress}</button>`);
    }
    return cells.join('');
  }

  function taskRows(plan) {
    if (!plan.tasks.length) {
      return '<div class="empty-state">没有清单，就没有执行。先把第一步写下来。</div>';
    }
    return `<div class="task-list">${plan.tasks
      .map(
        (task) => `<div class="task-row ${task.done ? 'done' : ''}"><button class="task-toggle" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.done ? '标记未完成' : '标记完成'}：${esc(task.text)}"><span class="check-box" aria-hidden="true">${task.done ? '✓' : ''}</span><span class="task-text">${esc(task.text)}</span></button>${task.done ? '<span class="done-mark" aria-hidden="true">✓</span>' : `<button class="edit-button" data-action="edit-task" data-id="${esc(task.id)}" aria-label="修改任务">改</button><button class="delete-button" data-action="delete-task" data-id="${esc(task.id)}" aria-label="删除任务">删</button>`}</div>`,
      )
      .join('')}</div>`;
  }

  function statsCard() {
    const records = dayMap();
    const checked = checkedKeys();
    const checkedSet = new Set(checked);
    const streak = streaks(checked);
    const monthCount = checked.filter((key) =>
      key.startsWith(state.statsMonth),
    ).length;
    const eligible = eligibleDays(state.statsMonth);
    const rate = eligible ? Math.round((monthCount / eligible) * 100) : 0;
    const overview = weekOverview(records, checkedSet);
    const [year, month] = state.statsMonth.split('-');
    return `<section class="card stats-card">
      <div class="card-head"><div><h2 class="card-title">兑现记录</h2><div class="help">感觉会骗人，数据不会。完成全部关键动作，才算兑现一天。</div></div><div class="month-nav"><button class="arrow-button" data-action="prev-month" ${state.statsMonth <= START_MONTH ? 'disabled' : ''} aria-label="上个月">‹</button><span class="month-label">${year}年${Number(month)}月</span><button class="arrow-button" data-action="next-month" aria-label="下个月">›</button></div></div>
      <div class="month-summary"><div class="month-summary-top"><div><div class="summary-label">本月兑现率</div><div class="summary-value">${rate}<span>%</span></div></div><div class="summary-copy">已兑现${monthCount}天<br>有效天数${eligible}天</div></div><div class="month-progress" role="progressbar" aria-label="本月兑现率" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${rate}"><div class="progress-fill" style="width:${rate}%"></div></div></div>
      <div class="stats-grid">
        <div class="stat-box"><span class="stat-icon">月</span><div><div class="stat-label">本月兑现</div><div class="stat-value">${monthCount}<span>天</span></div></div></div>
        <div class="stat-box"><span class="stat-icon">总</span><div><div class="stat-label">累计兑现</div><div class="stat-value">${checked.length}<span>天</span></div></div></div>
        <div class="stat-box"><span class="stat-icon">连</span><div><div class="stat-label">连续兑现</div><div class="stat-value">${streak.current}<span>天</span></div></div></div>
        <div class="stat-box"><span class="stat-icon">最</span><div><div class="stat-label">最长纪录</div><div class="stat-value">${streak.longest}<span>天</span></div></div></div>
      </div>
      <div class="stats-divider"></div>
      <div class="subsection-head"><div><div class="subsection-title">本周战绩</div><div class="help">${overview.label}</div></div><span class="selected-hint">点击日期切换</span></div>
      <div class="week-overview">${overview.html}</div>
      <div class="calendar-title-row"><div class="subsection-title">本月兑现进度</div><div class="calendar-legend"><span class="legend-item"><i class="legend-dot today"></i>今天</span><span class="legend-item"><i class="legend-dot done"></i>兑现</span><span class="legend-item"><i class="legend-dot partial"></i>推进中</span><span class="legend-item"><i class="legend-dot"></i>未记录</span><span class="legend-item"><i class="legend-dot future"></i>未来</span></div></div>
      <div class="week-labels">${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}</div>
      <div class="calendar-grid">${calendar(records, checkedSet)}</div>
      <button class="today-button" data-action="go-home-day">${state.todayKey < START_KEY ? '前往开始日' : '回到今天'}</button>
      <div class="calendar-tip">从2026年10月12日开始记录。黄色不是装饰，是你兑现承诺的进度；完成当天全部关键动作，才算兑现一天。</div>
    </section>`;
  }

  function templateCard() {
    const period = state.period;
    if (!TEMPLATE_PERIODS.includes(period)) return '';
    const template = state.templates[period];
    const title = '高价值动作模板';
    let content;
    if (!state.editingTemplate) {
      content = `<div class="template-summary">${template.length ? `共${template.length}项。新建计划时自动生成同一套有效动作，勾选状态重新开始。` : '你还没有固定打法。把那些真正有效的动作留下来。'}</div>`;
    } else {
      const rows = template.length
        ? `<div class="template-list">${template
            .map(
              (task, index) => `<div class="template-row"><div class="template-main"><span class="template-index">${index + 1}</span><span class="template-text">${esc(task.text)}</span></div><div class="template-actions"><button data-action="edit-template" data-id="${esc(task.id)}">编辑</button><button data-action="move-template" data-index="${index}" data-step="-1" ${index === 0 ? 'disabled' : ''}>上移</button><button data-action="move-template" data-index="${index}" data-step="1" ${index === template.length - 1 ? 'disabled' : ''}>下移</button><button class="danger" data-action="delete-template" data-id="${esc(task.id)}">删除</button></div></div>`,
            )
            .join('')}</div>`
        : '<div class="empty-state compact">你还没有固定打法。把那些真正有效的动作留下来。</div>';
      content = `${rows}<div class="add-row"><label class="sr-only" for="template-task-input">添加有效动作</label><input id="template-task-input" class="text-input" maxlength="100" placeholder="添加有效动作"><button class="primary-button" data-action="add-template">添加</button></div><button class="secondary-button" data-action="apply-template">直接套用</button>`;
    }
    return `<section class="card template-card"><div class="card-head"><h2 class="card-title">☷ ${title}</h2><button class="manage-button" data-action="toggle-template">${state.editingTemplate ? '完成' : '调整模板'}</button></div><div class="help template-help">把被验证过的有效动作固化下来，别每天重新发明自己。</div>${content}</section>`;
  }

  function historyCard() {
    if (state.period === 'day') return '';
    const records = state.records
      .filter((record) => {
        if (record.period !== state.period) return false;
        if (record.period === 'week') return record.periodKey >= startWeekKey;
        if (record.period === 'month') return record.periodKey >= START_MONTH;
        return true;
      })
      .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
    const rows = records
      .map((record) => {
        const done = record.plan.tasks.filter((task) => task.done).length;
        return `<button class="history-row ${record.periodKey === state.selectedKeys[state.period] ? 'selected' : ''}" data-action="select-history" data-key="${esc(record.periodKey)}"><span><span class="history-title">${esc(displayDate(state.period, record.periodKey))}</span><span class="help">${done}/${record.plan.tasks.length}拿下</span></span><span class="history-arrow">›</span></button>`;
      })
      .join('');
    return `<section class="card history-card"><h2 class="card-title">◷ ${META[state.period].label}战绩</h2><div class="history-list">${rows || '<div class="empty-state">暂无战绩</div>'}</div></section>`;
  }

  function reminderCard() {
    return `<section class="card reminder-card"><h2 class="card-title">兑现提醒</h2><div class="setting-row"><div><h3 class="section-title">未完成时提醒我</h3><div class="help">到时间后，打开网页会检查当天进度。你不来，它不会替你努力。</div></div><button class="toggle ${state.reminder.enabled ? 'on' : ''}" data-action="toggle-reminder" role="switch" aria-checked="${state.reminder.enabled}" aria-label="未完成时提醒我"><span aria-hidden="true"></span></button></div>${state.reminder.enabled ? `<label class="time-row" for="reminder-time"><span>提醒时间</span><input id="reminder-time" type="time" value="${state.reminder.time}"></label>` : ''}</section>`;
  }

  function localCard() {
    return `<section class="card local-only"><span class="local-label">无需登录 · 只存在本机</span><div class="local-copy">数据只保存在当前设备。你的目标不必让别人知道，但你必须对结果负责。清理浏览器或更换设备后，记录可能无法恢复。</div></section>`;
  }

  function foldSection(key, title, content) {
    const open = !compactQuery.matches || state.folds[key];
    const contentId = `fold-${key}-content`;
    return `<section class="mobile-fold ${open ? 'open' : 'collapsed'}" data-fold-section="${key}">
      <div class="fold-heading"><button class="fold-toggle" data-action="toggle-fold" data-fold="${key}" aria-expanded="${open}" aria-controls="${contentId}"><span>${title}</span><span class="fold-chevron" aria-hidden="true">⌄</span></button></div>
      <div id="${contentId}" class="fold-content" ${open ? '' : 'hidden'}>${content}</div>
    </section>`;
  }

  function syncFoldVisibility() {
    document.querySelectorAll('[data-fold-section]').forEach((section) => {
      const key = section.dataset.foldSection;
      const open = !compactQuery.matches || state.folds[key];
      const button = section.querySelector('.fold-toggle');
      const content = section.querySelector('.fold-content');
      section.classList.toggle('open', open);
      section.classList.toggle('collapsed', !open);
      if (button) button.setAttribute('aria-expanded', String(open));
      if (content) content.hidden = !open;
    });
  }

  function render() {
    const period = state.period;
    const meta = META[period];
    const plan = getPlan();
    const completed = plan.tasks.filter((task) => task.done).length;
    const progress = plan.tasks.length
      ? Math.round((completed / plan.tasks.length) * 100)
      : 0;
    const reflectionBlock = period === 'month' || period === 'year'
      ? `<div class="reflection-block"><label class="section-title" for="reflection-input">${meta.reflectionLabel}</label><div class="help">不要只记录经历，要复盘真正留下了什么。</div><textarea id="reflection-input" class="reflection-input" maxlength="2000" placeholder="${meta.reflectionPlaceholder}">${esc(plan.reflection)}</textarea></div>`
      : '';
    const planCard = `<section class="card plan-card">
      <div class="plan-head"><div class="plan-copy"><div class="eyebrow">${meta.eyebrow}</div><h2 class="plan-date">${esc(displayDate(period, state.selectedKeys[period]))}</h2><label class="focus-label" for="focus-input">${meta.focusLabel}</label></div><div class="head-actions"><span class="completion-pill" role="status" aria-live="polite">${completed}/${plan.tasks.length}拿下</span><button class="icon-button" data-action="reset-plan" aria-label="恢复作战清单">↻</button></div></div>
      <textarea id="focus-input" class="focus-input" maxlength="500" placeholder="${meta.focusPlaceholder}">${esc(plan.focus)}</textarea>
      <div class="divider"></div>
      <div class="section-head"><div><h3 class="section-title">执行清单</h3><div class="help">${meta.taskHelp}</div></div><span class="progress-number">${progress}%</span></div>
      <div class="progress-track" role="progressbar" aria-label="执行清单完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="progress-fill" style="width:${progress}%"></div></div>
      ${taskRows(plan)}
      <div class="add-row"><label class="sr-only" for="new-task-input">下一步具体做什么？</label><input id="new-task-input" class="text-input" maxlength="100" placeholder="下一步具体做什么？"><button class="primary-button" data-action="add-task">加入行动</button></div>
      ${reflectionBlock}
    </section>`;
    const dataCards = period === 'day' ? statsCard() : historyCard();
    const settingsCards = `${templateCard()}${reminderCard()}${localCard()}`;
    const executionTitle = period === 'day' ? '今日执行' : period === 'week' ? '本周执行' : period === 'month' ? '本月执行' : '年度执行';
    const dataTitle = period === 'day' ? '数据与日历' : '历史战绩';
    app.innerHTML = `<header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">芽</span><div class="brand-copy"><h1 class="brand-title">生长计划</h1><span class="brand-subtitle">别拿忙碌感动自己，人生最终只认结果。</span></div></div><div class="top-actions"><span class="saved">只存在本机</span></div></header>
      <main class="content">
        <section class="intro"><time class="today-line" datetime="${state.todayKey}">${esc(displayDate('day', state.todayKey))}</time></section>
        <nav class="period-tabs" aria-label="计划周期">${PERIODS.map((key) => `<button class="period-tab ${period === key ? 'active' : ''}" data-action="switch-period" data-period="${key}" ${period === key ? 'aria-current="page"' : ''}>${META[key].label}</button>`).join('')}</nav>
        ${foldSection('execution', executionTitle, planCard)}
        ${foldSection('data', dataTitle, dataCards)}
        ${foldSection('settings', '模板与设置', settingsCards)}
      </main>`;
  }

  function planFromDOM() {
    const plan = getPlan();
    const focus = document.querySelector('#focus-input');
    const reflection = document.querySelector('#reflection-input');
    if (focus) plan.focus = focus.value;
    if (reflection) plan.reflection = reflection.value;
    return plan;
  }

  function addTask() {
    const input = document.querySelector('#new-task-input');
    const text = input?.value.trim();
    if (!text) return;
    const plan = planFromDOM();
    plan.tasks.push(makeTask(text));
    savePlan(plan);
  }

  function editTask(taskId) {
    const plan = planFromDOM();
    const task = plan.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const text = window.prompt('修改执行清单项目', task.text);
    if (text === null) return;
    const next = text.trim().slice(0, 100);
    if (!next) {
      showToast('内容不能为空');
      return;
    }
    task.text = next;
    savePlan(plan);
  }

  function addTemplateTask() {
    const input = document.querySelector('#template-task-input');
    const text = input?.value.trim();
    if (!text || !TEMPLATE_PERIODS.includes(state.period)) return;
    state.templates[state.period].push({ id: id(), text });
    saveTemplates();
    render();
  }

  function editTemplateTask(taskId) {
    const template = state.templates[state.period];
    const task = template?.find((item) => item.id === taskId);
    if (!task) return;
    const text = window.prompt('编辑模板项目', task.text);
    if (text === null) return;
    const next = text.trim().slice(0, 100);
    if (!next) {
      showToast('内容不能为空');
      return;
    }
    task.text = next;
    saveTemplates();
    render();
  }

  function checkReminder() {
    if (
      !state.reminder.enabled ||
      state.todayKey < START_KEY ||
      state.reminder.lastShownKey === state.todayKey
    )
      return;
    const current = new Date();
    const currentTime = `${pad(current.getHours())}:${pad(current.getMinutes())}`;
    if (currentTime < state.reminder.time) return;
    const record = findRecord('day', state.todayKey);
    const tasks = record?.plan.tasks || state.templates.day;
    if (!tasks.length || (record && tasks.every((task) => task.done))) return;
    state.reminder.lastShownKey = state.todayKey;
    saveReminder();
    if (window.confirm('今天的关键动作还没有全部完成。现在回到今天继续吗？')) {
      state.period = 'day';
      state.selectedKeys.day = state.todayKey;
      state.statsMonth = state.todayKey.slice(0, 7);
      state.editingTemplate = false;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  app.addEventListener('input', (event) => {
    if (
      event.target.id !== 'focus-input' &&
      event.target.id !== 'reflection-input'
    )
      return;
    savePlan(planFromDOM(), false);
  });

  app.addEventListener('change', (event) => {
    if (event.target.id !== 'reminder-time') return;
    state.reminder.time = event.target.value || '20:00';
    state.reminder.lastShownKey = '';
    saveReminder();
    showToast('提醒时间已保存');
  });

  app.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    if (event.target.id === 'new-task-input') {
      event.preventDefault();
      addTask();
    }
    if (event.target.id === 'template-task-input') {
      event.preventDefault();
      addTemplateTask();
    }
  });

  app.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'toggle-fold') {
      const key = target.dataset.fold;
      if (!Object.prototype.hasOwnProperty.call(state.folds, key)) return;
      state.folds[key] = !state.folds[key];
      syncFoldVisibility();
    } else if (action === 'switch-period') {
      state.period = target.dataset.period;
      state.editingTemplate = false;
      render();
    } else if (action === 'add-task') {
      addTask();
    } else if (action === 'toggle-task') {
      const plan = planFromDOM();
      const task = plan.tasks.find((item) => item.id === target.dataset.id);
      if (task) task.done = !task.done;
      savePlan(plan);
    } else if (action === 'edit-task') {
      editTask(target.dataset.id);
    } else if (action === 'delete-task') {
      if (!window.confirm('删除后无法撤销，是否继续？')) return;
      const plan = planFromDOM();
      plan.tasks = plan.tasks.filter(
        (task) => task.id !== target.dataset.id,
      );
      savePlan(plan);
    } else if (action === 'reset-plan') {
      if (window.confirm('当前页面的作战清单和填写内容会重新开始，是否继续？'))
        savePlan(defaultPlan(state.period));
    } else if (action === 'select-day') {
      const key = target.dataset.key;
      if (!key || key < START_KEY) return;
      state.period = 'day';
      state.selectedKeys.day = key;
      state.statsMonth = key.slice(0, 7);
      state.editingTemplate = false;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'prev-month') {
      if (state.statsMonth <= START_MONTH) return;
      state.statsMonth = shiftMonth(state.statsMonth, -1);
      const first = `${state.statsMonth}-01`;
      state.selectedKeys.day = first < START_KEY ? START_KEY : first;
      render();
    } else if (action === 'next-month') {
      state.statsMonth = shiftMonth(state.statsMonth, 1);
      state.selectedKeys.day = `${state.statsMonth}-01`;
      render();
    } else if (action === 'go-home-day') {
      state.period = 'day';
      state.selectedKeys.day = state.dayHomeKey;
      state.statsMonth = state.dayHomeKey.slice(0, 7);
      state.editingTemplate = false;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'toggle-template') {
      state.editingTemplate = !state.editingTemplate;
      render();
    } else if (action === 'add-template') {
      addTemplateTask();
    } else if (action === 'edit-template') {
      editTemplateTask(target.dataset.id);
    } else if (action === 'move-template') {
      const list = state.templates[state.period];
      const index = Number(target.dataset.index);
      const nextIndex = index + Number(target.dataset.step);
      if (!list || nextIndex < 0 || nextIndex >= list.length) return;
      [list[index], list[nextIndex]] = [list[nextIndex], list[index]];
      saveTemplates();
      render();
    } else if (action === 'delete-template') {
      if (!window.confirm('删除后不会影响已经保存的计划，是否继续？'))
        return;
      state.templates[state.period] = state.templates[state.period].filter(
        (task) => task.id !== target.dataset.id,
      );
      saveTemplates();
      render();
    } else if (action === 'apply-template') {
      if (!window.confirm('当前计划的作战清单会被替换，是否继续？'))
        return;
      const plan = planFromDOM();
      plan.tasks = state.templates[state.period].map((task) =>
        makeTask(task.text),
      );
      savePlan(plan);
    } else if (action === 'select-history') {
      state.selectedKeys[state.period] = target.dataset.key;
      state.editingTemplate = false;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'toggle-reminder') {
      state.reminder.enabled = !state.reminder.enabled;
      state.reminder.lastShownKey = '';
      saveReminder();
      render();
      showToast(state.reminder.enabled ? '兑现提醒已开启' : '兑现提醒已关闭');
      if (state.reminder.enabled) window.setTimeout(checkReminder, 0);
    }
  });

  ensureCurrentPlans();
  saveTemplates();
  render();
  if (compactQuery.addEventListener) {
    compactQuery.addEventListener('change', syncFoldVisibility);
  } else {
    compactQuery.addListener(syncFoldVisibility);
  }
  window.setTimeout(checkReminder, 0);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();

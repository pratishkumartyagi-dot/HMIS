const api = window.taskAPI;

const state = {
  tasks: [],
  filter: 'all',
  search: ''
};

const els = {
  form: document.getElementById('addForm'),
  title: document.getElementById('newTitle'),
  priority: document.getElementById('newPriority'),
  due: document.getElementById('newDue'),
  list: document.getElementById('taskList'),
  empty: document.getElementById('emptyState'),
  counts: document.getElementById('counts'),
  filters: Array.from(document.querySelectorAll('.filter')),
  search: document.getElementById('search'),
  clearCompleted: document.getElementById('clearCompleted'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn')
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizeTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    title,
    completed: Boolean(raw.completed),
    priority: ['low', 'normal', 'high'].includes(raw.priority) ? raw.priority : 'normal',
    due: typeof raw.due === 'string' ? raw.due : '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    completedAt: typeof raw.completedAt === 'number' ? raw.completedAt : null
  };
}

function persist() {
  api.save(state.tasks);
}

function formatDue(due) {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const overdue = d < today;
  return { text: d.toLocaleDateString(), overdue };
}

function visibleTasks() {
  const q = state.search.trim().toLowerCase();
  return state.tasks.filter((t) => {
    if (state.filter === 'active' && t.completed) return false;
    if (state.filter === 'completed' && !t.completed) return false;
    if (q && !t.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

function makeButton(label, className, onClick, title) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  if (title) btn.title = title;
  btn.addEventListener('click', onClick);
  return btn;
}

function renderTask(task) {
  const li = document.createElement('li');
  li.className = 'task priority-' + task.priority + (task.completed ? ' completed' : '');
  li.dataset.id = task.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.completed;
  checkbox.title = 'Toggle complete';
  checkbox.addEventListener('change', () => toggleTask(task.id));
  li.appendChild(checkbox);

  const main = document.createElement('div');
  main.className = 'task-main';

  const titleEl = document.createElement('div');
  titleEl.className = 'task-title';
  titleEl.textContent = task.title;
  titleEl.title = 'Double-click to edit';
  titleEl.addEventListener('dblclick', () => startEdit(task.id, titleEl));
  main.appendChild(titleEl);

  const due = formatDue(task.due);
  if (due) {
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    const span = document.createElement('span');
    span.textContent = (due.overdue && !task.completed ? 'Overdue: ' : 'Due: ') + due.text;
    if (due.overdue && !task.completed) span.className = 'overdue';
    meta.appendChild(span);
    main.appendChild(meta);
  }

  li.appendChild(main);

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  actions.appendChild(makeButton('Edit', 'icon-btn', () => startEdit(task.id, titleEl), 'Edit'));
  actions.appendChild(makeButton('Delete', 'icon-btn danger', () => deleteTask(task.id), 'Delete'));
  li.appendChild(actions);

  return li;
}

function render() {
  els.list.innerHTML = '';
  const items = visibleTasks().sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const rank = { high: 0, normal: 1, low: 2 };
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return a.createdAt - b.createdAt;
  });

  for (const task of items) els.list.appendChild(renderTask(task));

  const total = state.tasks.length;
  const done = state.tasks.filter((t) => t.completed).length;
  els.counts.textContent = total === 0
    ? '0 tasks'
    : `${total - done} active / ${done} done / ${total} total`;

  const noneVisible = items.length === 0;
  els.empty.hidden = !noneVisible;
  if (noneVisible) {
    els.empty.querySelector('p').textContent =
      total === 0 ? 'No tasks yet. Add your first task above.' : 'No tasks match this view.';
  }

  els.clearCompleted.disabled = done === 0;
}

function startEdit(id, titleEl) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-title-input';
  input.value = task.title;
  input.maxLength = 240;

  const commit = () => {
    const next = input.value.trim();
    if (next) {
      task.title = next;
      persist();
    }
    render();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') render();
  });
  input.addEventListener('blur', commit);

  titleEl.replaceWith(input);
  input.focus();
  input.select();
}

function addTask(title, priority, due) {
  state.tasks.push({
    id: uid(),
    title,
    completed: false,
    priority,
    due: due || '',
    createdAt: Date.now(),
    completedAt: null
  });
  persist();
  render();
}

function toggleTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? Date.now() : null;
  persist();
  render();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  persist();
  render();
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = els.title.value.trim();
  if (!title) return;
  addTask(title, els.priority.value, els.due.value);
  els.title.value = '';
  els.due.value = '';
  els.priority.value = 'normal';
  els.title.focus();
});

els.filters.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    els.filters.forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });
});

els.search.addEventListener('input', () => {
  state.search = els.search.value;
  render();
});

els.clearCompleted.addEventListener('click', () => {
  const done = state.tasks.filter((t) => t.completed).length;
  if (done === 0) return;
  if (!window.confirm(`Remove ${done} completed task${done === 1 ? '' : 's'}?`)) return;
  state.tasks = state.tasks.filter((t) => !t.completed);
  persist();
  render();
});

els.exportBtn.addEventListener('click', async () => {
  const res = await api.exportTasks(state.tasks);
  if (res && res.ok) window.alert('Exported to:\n' + res.filePath);
  else if (res && res.error) window.alert('Export failed: ' + res.error);
});

els.importBtn.addEventListener('click', async () => {
  const res = await api.importTasks();
  if (!res || !res.ok) {
    if (res && res.error) window.alert('Import failed: ' + res.error);
    return;
  }
  const incoming = res.tasks.map(normalizeTask).filter(Boolean);
  const existing = new Set(state.tasks.map((t) => t.id));
  let added = 0;
  for (const task of incoming) {
    if (existing.has(task.id)) task.id = uid();
    state.tasks.push(task);
    added += 1;
  }
  persist();
  render();
  window.alert(`Imported ${added} task${added === 1 ? '' : 's'}.`);
});

async function init() {
  const stored = await api.load();
  state.tasks = Array.isArray(stored) ? stored.map(normalizeTask).filter(Boolean) : [];
  render();
  els.title.focus();
}

init();

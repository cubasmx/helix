/* ════════════════════════════════════════════════════════
   CONFIG & STATE
════════════════════════════════════════════════════════ */
const YEAR          = 2026;
const STORAGE_TASKS = 'gantt2026_tasks';
const STORAGE_THEME = 'gantt2026_theme';
const MONTH_NAMES   = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                       "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const TOTAL_WEEKS   = 53;

// 16-colour palette
const COLOR_PALETTE = [
    '#ef4444','#f97316','#f59e0b','#eab308',
    '#84cc16','#22c55e','#10b981','#14b8a6',
    '#06b6d4','#3b82f6','#6366f1','#8b5cf6',
    '#a855f7','#ec4899','#64748b','#1e293b'
];

let weeksData      = [];
let currentIsoWeek = 0;
let activeView     = 'cards';
const BASE_URL     = (window.__ENV__.SERVICE_URL).replace(/\/$/, '');
const API_URL      = BASE_URL + '/tasks';
let tasksList      = [];

/* ════════════════════════════════════════════════════════
   THEME
════════════════════════════════════════════════════════ */
function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(STORAGE_THEME, t);
    document.querySelectorAll('.theme-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.themeVal === t)
    );
}
function loadTheme() { setTheme(localStorage.getItem(STORAGE_THEME) || 'light'); }

/* ════════════════════════════════════════════════════════
   VIEW TOGGLE (mobile)
════════════════════════════════════════════════════════ */
function switchView(view) {
    activeView = view;
    const isCards = view === 'cards';
    document.getElementById('cardView').style.display  = isCards ? 'flex' : 'none';
    document.getElementById('tableView').style.display = isCards ? 'none' : 'block';
    document.getElementById('btnCards').classList.toggle('active', isCards);
    document.getElementById('btnTable').classList.toggle('active', !isCards);
}

/* ════════════════════════════════════════════════════════
   TASKS API
════════════════════════════════════════════════════════ */
async function loadTasks() {
    try {
        const res = await fetch(API_URL);
        if (res.ok) { tasksList = await res.json(); renderAll(); }
        else showToast('⚠️ Error al cargar tareas', 'warn');
    } catch(e) { showToast('⚠️ No se pudo conectar al servidor.', 'warn'); }
}

async function updateTask(task) {
    try {
        const res = await fetch(`${API_URL}/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
        if (!res.ok) showToast('⚠️ Error guardando cambios', 'warn');
    } catch(e) { showToast('⚠️ Error de conexión', 'warn'); }
}

/* ════════════════════════════════════════════════════════
   CALENDAR DATA BUILD
════════════════════════════════════════════════════════ */
function buildCalendarData() {
    const today = new Date();
    let d = new Date(YEAR, 0, 1);
    let weekNum = 1;
    let mc = Array.from({length: 12}, (_,i) => [i, 0]);
    let monthCount = Object.fromEntries(mc);

    while (d.getFullYear() === YEAR) {
        monthCount[d.getMonth()]++;
        if (d.getDay() === 0 || (d.getMonth() === 11 && d.getDate() === 31)) {
            const dom = +Object.keys(monthCount).reduce((a,b) =>
                monthCount[a] > monthCount[b] ? a : b);
            const ws = new Date(d); ws.setDate(d.getDate() - 6);
            weeksData.push({ weekNum, monthIndex: dom });
            if (today >= ws && today <= d) currentIsoWeek = weekNum;
            weekNum++;
            monthCount = Object.fromEntries(mc);
        }
        d.setDate(d.getDate() + 1);
    }
    const sub = document.getElementById('weekInfo');
    sub.textContent = currentIsoWeek > 0
        ? `Semana ${currentIsoWeek} de ${YEAR}`
        : `Planificador ${YEAR}`;
}

/* ════════════════════════════════════════════════════════
   CARD VIEW RENDERER (Mobile)
════════════════════════════════════════════════════════ */
function renderCards() {
    const section = document.getElementById('cardView');
    section.innerHTML = '';
    if (!tasksList.length) {
        section.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No hay tareas. Agrega una arriba.</p></div>`;
        return;
    }
    tasksList.forEach(task => {
        const card = document.createElement('article');
        card.className = 'task-card';
        card.style.setProperty('--task-color', task.color);
        const endWeek  = Math.min(task.start + task.duration - 1, TOTAL_WEEKS);
        const pctStart = ((task.start - 1) / TOTAL_WEEKS * 100).toFixed(1);
        const pctWidth = (task.duration / TOTAL_WEEKS * 100).toFixed(1);
        const todayPct = currentIsoWeek > 0 ? ((currentIsoWeek - 1) / TOTAL_WEEKS * 100).toFixed(1) : null;
        const isActive = currentIsoWeek >= task.start && currentIsoWeek < task.start + task.duration;
        card.innerHTML = `
            <div class="card-header">
                <span class="card-name">${escHtml(task.name)}</span>
                <div class="card-actions">
                    <button class="card-color-btn" style="background:${task.color}" title="Cambiar color" data-id="${task.id}">
                    </button>
                    <button class="card-delete" data-id="${task.id}" title="Eliminar">×</button>
                </div>
            </div>
            <div class="card-timeline">
                <div class="timeline-track">
                    <div class="timeline-fill" style="left:${pctStart}%;width:${pctWidth}%;background:${task.color};opacity:.85;"></div>
                    ${todayPct !== null ? `<div class="timeline-today-marker" style="left:${todayPct}%"></div>` : ''}
                </div>
            </div>
            <div class="card-meta">
                <span>S${task.start} → S${endWeek}</span>
                <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
                    <span class="card-badge">⏱ ${task.duration} sem.</span>
                    ${isActive ? `<span class="card-badge" style="color:var(--accent);border-color:var(--accent)">● Activa</span>` : ''}
                </div>
            </div>`;
        card.querySelector('.card-color-btn').addEventListener('click', (e) => {
            openColorPicker(e.currentTarget, task.color, (c) => {
                task.color = c;
                card.style.setProperty('--task-color', c);
                card.querySelector('.card-color-btn').style.background = c;
                card.querySelector('.timeline-fill').style.background = c;
                updateTask(task);
            });
        });
        card.querySelector('.card-delete').addEventListener('click', () => deleteTask(task.id));
        section.appendChild(card);
    });
}

/* ════════════════════════════════════════════════════════
   GANTT TABLE RENDERER (Desktop)
════════════════════════════════════════════════════════ */
function renderHeaders() {
    const thead = document.getElementById('ganttHead');
    thead.innerHTML = '';
    const trM = document.createElement('tr');
    const trW = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'task-name-col'; corner.rowSpan = 2;
    corner.textContent = 'Hito / Tarea'; trM.appendChild(corner);
    let curMonth = weeksData[0].monthIndex, span = 0;
    function flush(m, s) {
        const th = document.createElement('th');
        th.className = 'month-header'; th.colSpan = s;
        th.textContent = MONTH_NAMES[m];
        th.style.backgroundColor = `var(--m${m})`; trM.appendChild(th);
    }
    weeksData.forEach((w, i) => {
        const thW = document.createElement('th');
        thW.className = 'week-header';
        if (w.weekNum === currentIsoWeek) thW.classList.add('is-today');
        thW.textContent = w.weekNum;
        thW.style.backgroundColor = `var(--m${w.monthIndex})`;
        trW.appendChild(thW);
        if (w.monthIndex === curMonth) { span++; }
        else { flush(curMonth, span); curMonth = w.monthIndex; span = 1; }
        if (i === weeksData.length - 1) flush(curMonth, span);
    });
    thead.appendChild(trM); thead.appendChild(trW);
}

function renderGrid() {
    const tbody = document.getElementById('ganttBody');
    tbody.innerHTML = '';
    if (!tasksList.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = weeksData.length + 1;
        td.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No hay tareas.</p></div>`;
        tr.appendChild(td); tbody.appendChild(tr); return;
    }
    tasksList.forEach(task => {
        const tr = document.createElement('tr');
        const tdN = document.createElement('td');
        tdN.className = 'task-name-col';
        const cell = document.createElement('div');
        cell.className = 'task-cell-content';
        const swatch = document.createElement('span');
        swatch.className = 'tbl-color-swatch';
        swatch.style.backgroundColor = task.color; swatch.title = 'Cambiar color';
        swatch.addEventListener('click', (e) => {
            openColorPicker(e.currentTarget, task.color, (c) => {
                task.color = c;
                swatch.style.backgroundColor = c;
                Array.from(tr.querySelectorAll('.task-bar')).forEach(b => b.style.backgroundColor = c);
                updateTask(task);
            });
        });
        const lbl = document.createElement('span');
        lbl.className = 'task-label'; lbl.textContent = task.name; lbl.title = task.name;
        const del = document.createElement('button');
        del.className = 'delete-btn'; del.textContent = '×'; del.title = 'Eliminar';
        del.onclick = () => deleteTask(task.id);
        cell.append(swatch, lbl, del); tdN.appendChild(cell); tr.appendChild(tdN);
        weeksData.forEach(w => {
            const td = document.createElement('td');
            if (w.weekNum === currentIsoWeek) td.classList.add('is-today');
            if (w.weekNum >= task.start && w.weekNum < task.start + task.duration) {
                const bar = document.createElement('div');
                bar.className = 'task-bar'; bar.style.backgroundColor = task.color;
                td.appendChild(bar);
            } else {
                td.style.backgroundColor = `var(--m${w.monthIndex})`; td.style.opacity = '.35';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function renderAll() { renderCards(); renderGrid(); }

/* ════════════════════════════════════════════════════════
   GANTT CRUD
════════════════════════════════════════════════════════ */
async function addTask() {
    const name     = document.getElementById('taskName').value.trim();
    const start    = parseInt(document.getElementById('startWeek').value);
    const duration = parseInt(document.getElementById('duration').value);
    const color    = document.getElementById('taskColor').dataset.value || '#4f46e5';
    if (!name)                return showToast('⚠️ Escribe el nombre de la tarea.', 'warn');
    if (!start || start<1 || start>53) return showToast('⚠️ Semana inicio inválida (1–53).', 'warn');
    if (!duration || duration<1)       return showToast('⚠️ La duración debe ser ≥ 1 semana.', 'warn');
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, start, duration, color })
        });
        if (res.ok) {
            tasksList.push(await res.json());
            renderAll();
            document.getElementById('taskName').value = '';
            document.getElementById('startWeek').value = '';
            document.getElementById('duration').value = '';
            showToast(`✅ "${name}" agregada.`);
        } else showToast('⚠️ Error al guardar tarea', 'warn');
    } catch(e) { showToast('⚠️ Error de conexión', 'warn'); }
}

async function deleteTask(id) {
    const t = tasksList.find(x => x.id === id);
    if (!t) return;
    tasksList = tasksList.filter(x => x.id !== id);
    renderAll();
    try {
        const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (res.ok) { showToast(`🗑️ "${t.name}" eliminada.`); }
        else { tasksList.push(t); renderAll(); showToast('⚠️ Error al eliminar tarea', 'warn'); }
    } catch(e) { tasksList.push(t); renderAll(); showToast('⚠️ Error de conexión', 'warn'); }
}

/* ════════════════════════════════════════════════════════
   COLOR PALETTE PICKER
════════════════════════════════════════════════════════ */
let _colorPickerCallback = null;
let _colorPickerEl = null;

function openColorPicker(anchorEl, currentColor, callback) {
    closeColorPicker();
    _colorPickerCallback = callback;
    const palette = document.createElement('div');
    palette.className = 'color-palette';
    palette.id = '_globalColorPalette';
    COLOR_PALETTE.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch-pick';
        if (c === currentColor) sw.classList.add('selected');
        sw.style.background = c;
        sw.title = c;
        sw.addEventListener('click', (e) => {
            e.stopPropagation();
            if (_colorPickerCallback) _colorPickerCallback(c);
            closeColorPicker();
        });
        palette.appendChild(sw);
    });
    // Position near anchor
    document.body.appendChild(palette);
    const rect = anchorEl.getBoundingClientRect();
    const pw = 220, ph = 90;
    let top  = rect.bottom + window.scrollY + 6;
    let left = rect.left  + window.scrollX;
    if (left + pw > window.innerWidth) left = window.innerWidth - pw - 10;
    if (top + ph > window.scrollY + window.innerHeight) top = rect.top + window.scrollY - ph - 6;
    palette.style.top  = top + 'px';
    palette.style.left = left + 'px';
    _colorPickerEl = palette;
    setTimeout(() => document.addEventListener('click', closeColorPicker, { once: true }), 0);
}

function closeColorPicker() {
    if (_colorPickerEl) { _colorPickerEl.remove(); _colorPickerEl = null; }
}

/* ════════════════════════════════════════════════════════
   TOAST
════════════════════════════════════════════════════════ */
function showToast(msg, type = 'info') {
    const wrap  = document.getElementById('toastWrap');
    const toast = document.createElement('div');
    toast.className = 'toast'; toast.textContent = msg;
    if (type === 'warn') toast.style.borderLeftColor = 'var(--danger)';
    wrap.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity .28s';
        toast.style.opacity    = '0';
        setTimeout(() => toast.remove(), 320);
    }, 2800);
}
function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && ['taskName','startWeek','duration'].includes(e.target.id)) addTask();
    if (e.key === 'Escape') { closeColorPicker(); closeAllModals(); }
});

function closeAllModals() {
    ['kanbanCardModal','eventModal','usersModal','convertToGanttModal','convertToCalendarModal','convertToKanbanModal']
        .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

/* ════════════════════════════════════════════════════════
   KANBAN & CALENDAR DATA & APIS
════════════════════════════════════════════════════════ */
let usersList  = [];
let kanbanCols = [];
let calendarObj = null;

const USERS_API   = BASE_URL + '/users';
const K_COLS_API  = BASE_URL + '/kanban/columns';
const K_CARDS_API = BASE_URL + '/kanban/cards';
const EVENTS_API  = BASE_URL + '/calendar/events';

async function loadInitialData() {
    try {
        const uRes = await fetch(USERS_API);
        if (uRes.ok) usersList = await uRes.json();
    } catch(e) {}
    populateAssigneeSelects();
    await loadKanban();
    initCalendar();
}

function populateAssigneeSelects() {
    ['kcAssignee','evAssignee','ctgAssignee'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">Sin asignar</option>';
        usersList.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id; opt.textContent = u.name;
            sel.appendChild(opt);
        });
    });
}

/* ════════════════════════════════════════════════════════
   KANBAN — DRAG & DROP COLUMNS
════════════════════════════════════════════════════════ */
let draggedColEl = null;
let draggedColId  = null;

function handleColDragStart(e) {
    draggedColEl = this;
    draggedColId = parseInt(this.dataset.colId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedColId);
    setTimeout(() => this.classList.add('col-dragging'), 0);
}
function handleColDragEnd() {
    this.classList.remove('col-dragging');
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('col-drag-over'));
    draggedColEl = null;
}
function handleColDragOver(e) {
    if (!draggedColEl || this === draggedColEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('col-drag-over'));
    this.classList.add('col-drag-over');
}
async function handleColDrop(e) {
    e.preventDefault();
    if (!draggedColEl || this === draggedColEl) return;
    const board = document.getElementById('kanbanBoard');
    const cols = [...board.querySelectorAll('.kanban-col')];
    const fromIdx = cols.indexOf(draggedColEl);
    const toIdx   = cols.indexOf(this);
    if (fromIdx === toIdx) return;
    // Reorder DOM
    if (fromIdx < toIdx) board.insertBefore(draggedColEl, this.nextSibling);
    else board.insertBefore(draggedColEl, this);
    this.classList.remove('col-drag-over');
    // Sync data array
    const moved = kanbanCols.splice(fromIdx, 1)[0];
    kanbanCols.splice(toIdx, 0, moved);
    // Persist
    const order = kanbanCols.map(c => c.id);
    try {
        await fetch(`${K_COLS_API}-reorder`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ order })
        });
    } catch(err) { showToast('⚠️ Error al reordenar columnas', 'warn'); }
}

/* ════════════════════════════════════════════════════════
   KANBAN — DRAG & DROP CARDS
════════════════════════════════════════════════════════ */
let draggedCardEl = null;

function handleCardDragStart(e) {
    draggedCardEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.cardId);
    setTimeout(() => this.classList.add('card-dragging'), 0);
}
function handleCardDragEnd() {
    this.classList.remove('card-dragging');
    document.querySelectorAll('.kanban-drop-placeholder').forEach(p => p.remove());
    draggedCardEl = null;
}
function handleAreaDragOver(e) {
    if (!draggedCardEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    let existing = this.querySelector('.kanban-drop-placeholder');
    if (!existing) {
        existing = document.createElement('div');
        existing.className = 'kanban-drop-placeholder';
    }
    const afterEl = getDragAfterElement(this, e.clientY);
    if (!afterEl) this.appendChild(existing);
    else this.insertBefore(existing, afterEl);
}
function handleAreaDragLeave() {
    this.querySelectorAll('.kanban-drop-placeholder').forEach(p => p.remove());
}
async function handleCardDrop(e) {
    e.preventDefault();
    document.querySelectorAll('.kanban-drop-placeholder').forEach(p => p.remove());
    if (!draggedCardEl) return;
    const targetColDiv = this.closest('.kanban-col');
    if (!targetColDiv) return;
    const newColId = parseInt(targetColDiv.dataset.colId);
    const cardId   = parseInt(draggedCardEl.dataset.cardId);
    const oldColId = parseInt(draggedCardEl.dataset.colId);
    const cardsArea = targetColDiv.querySelector('.kanban-cards-area');
    const afterEl = getDragAfterElement(cardsArea, e.clientY);
    let newPos = 0;
    const colFrom = kanbanCols.find(c => c.id === oldColId);
    const colTo   = kanbanCols.find(c => c.id === newColId);
    if (!colFrom || !colTo) return;
    const cardIdx  = colFrom.cards.findIndex(c => c.id === cardId);
    const cardData = colFrom.cards.splice(cardIdx, 1)[0];
    if (!afterEl) {
        cardsArea.appendChild(draggedCardEl);
        newPos = colTo.cards.length;
        colTo.cards.push(cardData);
    } else {
        cardsArea.insertBefore(draggedCardEl, afterEl);
        const afterId = parseInt(afterEl.dataset.cardId);
        newPos = colTo.cards.findIndex(c => c.id === afterId);
        if (newPos === -1) newPos = colTo.cards.length;
        colTo.cards.splice(newPos, 0, cardData);
    }
    draggedCardEl.dataset.colId = newColId;
    cardData.column_id = newColId;
    colTo.cards.forEach((c, i) => c.position = i);
    if (calendarObj) calendarObj.refetchEvents();
    try {
        await fetch(`${K_CARDS_API}/${cardId}/move`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ column_id: newColId, position: newPos })
        });
    } catch(err) { showToast('⚠️ Error al mover tarjeta', 'warn'); loadKanban(); }
}
function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll('.kanban-card:not(.card-dragging)')];
    return els.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* ════════════════════════════════════════════════════════
   KANBAN — RENDER
════════════════════════════════════════════════════════ */
async function loadKanban() {
    try {
        const res = await fetch(K_COLS_API);
        if (res.ok) { kanbanCols = await res.json(); renderKanban(); if (calendarObj) calendarObj.refetchEvents(); }
    } catch(e) { console.error('Kanban load error', e); }
}

function renderKanban() {
    const board = document.getElementById('kanbanBoard');
    board.innerHTML = '';
    kanbanCols.forEach(col => {
        const cDiv = document.createElement('div');
        cDiv.className = 'kanban-col';
        cDiv.style.setProperty('--col-color', col.color || '#64748b');
        cDiv.dataset.colId = col.id;
        cDiv.draggable = true;
        cDiv.addEventListener('dragstart', handleColDragStart);
        cDiv.addEventListener('dragend',   handleColDragEnd);
        cDiv.addEventListener('dragover',  handleColDragOver);
        cDiv.addEventListener('drop',      handleColDrop);

        // Header
        const header = document.createElement('div');
        header.className = 'kanban-col-header';
        header.innerHTML = `
            <div class="kanban-col-title">
                <div class="color-preview-btn" style="background:${col.color||'#64748b'};width:18px;height:18px;border-radius:50%;border:2px solid var(--border);cursor:pointer;flex-shrink:0;" 
                     data-col-id="${col.id}" title="Cambiar color columna"></div>
                <span ondblclick="renameColumn(${col.id}, this)" title="Doble clic para renombrar">${escHtml(col.name)}</span>
                <span class="col-badge">${col.cards.length}</span>
            </div>
            <div class="kanban-col-actions">
                <button class="col-action-btn" title="Agregar tarjeta" onclick="createKanbanCard(${col.id})">＋</button>
                <button class="col-action-btn danger" title="Eliminar columna" onclick="deleteKanbanColumn(${col.id})">×</button>
            </div>`;
        header.querySelector('.color-preview-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openColorPicker(e.currentTarget, col.color, async (c) => {
                col.color = c;
                e.currentTarget.style.background = c;
                cDiv.style.setProperty('--col-color', c);
                await fetch(`${K_COLS_API}/${col.id}`, {
                    method: 'PUT', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ name: col.name, color: c })
                });
            });
        });

        // Cards area
        const area = document.createElement('div');
        area.className = 'kanban-cards-area';
        area.dataset.colId = col.id;
        area.addEventListener('dragover',   handleAreaDragOver);
        area.addEventListener('dragleave',  handleAreaDragLeave);
        area.addEventListener('drop',       handleCardDrop);

        col.cards.sort((a,b) => a.position - b.position).forEach(card => {
            area.appendChild(buildKanbanCard(col, card));
        });

        cDiv.appendChild(header);
        cDiv.appendChild(area);
        board.appendChild(cDiv);
    });
}

function buildKanbanCard(col, card) {
    const kCard = document.createElement('div');
    kCard.className = 'kanban-card';
    kCard.style.setProperty('--card-color', card.color || '#6366f1');
    kCard.draggable = true;
    kCard.dataset.cardId = card.id;
    kCard.dataset.colId  = col.id;
    kCard.addEventListener('dragstart', handleCardDragStart);
    kCard.addEventListener('dragend',   handleCardDragEnd);

    let badgeHtml = '';
    if (card.assignee_id) {
        const u = usersList.find(x => x.id == card.assignee_id);
        if (u) badgeHtml = `<div class="assignee-badge" style="background:${u.avatar_color}" title="${escHtml(u.name)}">${escHtml(u.name.charAt(0).toUpperCase())}</div>`;
    }
    const dateHtml = card.due_date
        ? `<span title="Fecha límite">📅 ${new Date(card.due_date).toLocaleDateString()}</span>`
        : '';

    kCard.innerHTML = `
        <div class="kanban-card-title">${escHtml(card.title)}</div>
        ${card.description ? `<div class="kanban-card-desc">${escHtml(card.description.substring(0,60))}${card.description.length>60?'…':''}</div>` : ''}
        <div class="kanban-card-meta">
            ${dateHtml}
            ${badgeHtml}
            <div class="kanban-card-actions">
                <button class="card-action-btn" title="Cambiar color" data-card-color="${card.color}">🎨</button>
                <button class="card-action-btn" title="Editar" onclick="openCardModal(${col.id}, ${card.id})">✎</button>
                <button class="card-action-btn danger" title="Eliminar" onclick="deleteKanbanCard(${col.id}, ${card.id})">×</button>
            </div>
        </div>`;

    kCard.querySelector('[title="Cambiar color"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openColorPicker(e.currentTarget, card.color, async (c) => {
            card.color = c;
            kCard.style.setProperty('--card-color', c);
            await fetch(`${K_CARDS_API}/${card.id}`, {
                method: 'PUT', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ color: c })
            });
        });
    });
    return kCard;
}

async function renameColumn(colId, spanEl) {
    const current = spanEl.textContent.trim();
    const name = prompt('Nuevo nombre de columna:', current);
    if (!name || name === current) return;
    const col = kanbanCols.find(c => c.id === colId);
    if (!col) return;
    try {
        await fetch(`${K_COLS_API}/${colId}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ name, color: col.color })
        });
        col.name = name;
        spanEl.textContent = name;
        showToast('✅ Columna renombrada');
    } catch(e) { showToast('⚠️ Error', 'warn'); }
}

async function createKanbanColumn() {
    const name = prompt('Nombre de la nueva columna:');
    if (!name) return;
    const color = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    try {
        const res = await fetch(K_COLS_API, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ name, color })
        });
        if (res.ok) { showToast('✅ Columna creada'); loadKanban(); }
    } catch(e) { showToast('⚠️ Error al crear columna', 'warn'); }
}

async function deleteKanbanColumn(id) {
    if (!confirm('¿Eliminar esta columna y TODAS sus tarjetas?')) return;
    try {
        const res = await fetch(`${K_COLS_API}/${id}`, { method: 'DELETE' });
        if (res.ok) { showToast('🗑️ Columna eliminada'); loadKanban(); }
    } catch(e) { showToast('⚠️ Error', 'warn'); }
}

/* ════════════════════════════════════════════════════════
   KANBAN CARD MODAL
════════════════════════════════════════════════════════ */
let _currentCardColor = '#6366f1';

function createKanbanCard(colId) {
    document.getElementById('kcModalTitle').textContent = 'Nueva Tarjeta';
    document.getElementById('kcId').value    = '';
    document.getElementById('kcColId').value = colId;
    document.getElementById('kcTitle').value = '';
    document.getElementById('kcDesc').value  = '';
    document.getElementById('kcAssignee').value  = '';
    document.getElementById('kcDueDate').value   = '';
    _currentCardColor = '#6366f1';
    document.getElementById('kcColorPreview').style.background = _currentCardColor;
    document.getElementById('kcColorPreview').dataset.value = _currentCardColor;
    document.getElementById('convertActions').style.display = 'none';
    document.getElementById('kanbanCardModal').style.display = 'flex';
}

function openCardModal(colId, cardId) {
    const col  = kanbanCols.find(c => c.id === colId);
    if (!col) return;
    const card = col.cards.find(c => c.id === cardId);
    if (!card) return;
    document.getElementById('kcModalTitle').textContent = 'Editar Tarjeta';
    document.getElementById('kcId').value    = card.id;
    document.getElementById('kcColId').value = colId;
    document.getElementById('kcTitle').value = card.title;
    document.getElementById('kcDesc').value  = card.description || '';
    document.getElementById('kcAssignee').value  = card.assignee_id || '';
    document.getElementById('kcDueDate').value   = card.due_date ? card.due_date.split('T')[0] : '';
    _currentCardColor = card.color || '#6366f1';
    document.getElementById('kcColorPreview').style.background = _currentCardColor;
    document.getElementById('kcColorPreview').dataset.value = _currentCardColor;
    document.getElementById('convertActions').style.display = 'flex';
    // Store card data for conversions
    document.getElementById('kanbanCardModal').dataset.cardTitle = card.title;
    document.getElementById('kanbanCardModal').dataset.cardColor = card.color;
    document.getElementById('kanbanCardModal').dataset.cardId    = card.id;
    document.getElementById('kanbanCardModal').style.display = 'flex';
}

async function saveKanbanCard() {
    const id    = document.getElementById('kcId').value;
    const colId = document.getElementById('kcColId').value;
    const payload = {
        title:       document.getElementById('kcTitle').value,
        description: document.getElementById('kcDesc').value,
        color:       _currentCardColor,
        assignee_id: document.getElementById('kcAssignee').value || null,
        due_date:    document.getElementById('kcDueDate').value || null
    };
    if (!payload.title) return showToast('⚠️ El título es requerido', 'warn');
    try {
        const uri = id ? `${K_CARDS_API}/${id}` : K_CARDS_API;
        if (!id) payload.column_id = colId;
        const res = await fetch(uri, {
            method: id ? 'PUT' : 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast('✅ Tarjeta guardada');
            document.getElementById('kanbanCardModal').style.display = 'none';
            loadKanban();
        } else showToast('⚠️ Error al guardar', 'warn');
    } catch(e) { showToast('⚠️ Error de red', 'warn'); }
}

async function deleteKanbanCard(colId, cardId) {
    if (!confirm('¿Eliminar tarjeta?')) return;
    try {
        const res = await fetch(`${K_CARDS_API}/${cardId}`, { method: 'DELETE' });
        if (res.ok) { showToast('🗑️ Tarjeta eliminada'); loadKanban(); }
    } catch(e) { showToast('⚠️ Error', 'warn'); }
}

/* ════════════════════════════════════════════════════════
   CONVERT KANBAN → GANTT
════════════════════════════════════════════════════════ */
function openConvertKanbanToGantt() {
    const modal = document.getElementById('kanbanCardModal');
    const title = modal.dataset.cardTitle || document.getElementById('kcTitle').value;
    const color = modal.dataset.cardColor || _currentCardColor;
    document.getElementById('ctgName').value  = title;
    document.getElementById('ctgStart').value = '';
    document.getElementById('ctgDur').value   = '';
    document.getElementById('ctgColorPreview').style.background = color;
    document.getElementById('ctgColorPreview').dataset.value = color;
    document.getElementById('kanbanCardModal').style.display = 'none';
    document.getElementById('convertToGanttModal').style.display = 'flex';
}

async function saveConvertToGantt() {
    const name     = document.getElementById('ctgName').value.trim();
    const start    = parseInt(document.getElementById('ctgStart').value);
    const duration = parseInt(document.getElementById('ctgDur').value);
    const color    = document.getElementById('ctgColorPreview').dataset.value || '#4f46e5';
    if (!name)                        return showToast('⚠️ Nombre requerido', 'warn');
    if (!start || start<1||start>53)  return showToast('⚠️ Semana de inicio inválida', 'warn');
    if (!duration || duration<1)      return showToast('⚠️ Duración inválida', 'warn');
    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ name, start, duration, color })
        });
        if (res.ok) {
            tasksList.push(await res.json());
            renderAll();
            document.getElementById('convertToGanttModal').style.display = 'none';
            showToast(`✅ "${name}" agregada al Gantt 📊`);
        } else showToast('⚠️ Error al convertir', 'warn');
    } catch(e) { showToast('⚠️ Error de conexión', 'warn'); }
}

/* ════════════════════════════════════════════════════════
   CONVERT KANBAN → CALENDAR
════════════════════════════════════════════════════════ */
function openConvertKanbanToCalendar() {
    const modal = document.getElementById('kanbanCardModal');
    const title = modal.dataset.cardTitle || document.getElementById('kcTitle').value;
    const color = modal.dataset.cardColor || _currentCardColor;
    document.getElementById('ctcTitle').value = title;
    document.getElementById('ctcStart').value = '';
    document.getElementById('ctcEnd').value   = '';
    document.getElementById('ctcColorPreview').style.background = color;
    document.getElementById('ctcColorPreview').dataset.value = color;
    document.getElementById('kanbanCardModal').style.display = 'none';
    document.getElementById('convertToCalendarModal').style.display = 'flex';
}

async function saveConvertToCalendar() {
    const title = document.getElementById('ctcTitle').value.trim();
    const start = document.getElementById('ctcStart').value;
    const end   = document.getElementById('ctcEnd').value;
    const color = document.getElementById('ctcColorPreview').dataset.value || '#10b981';
    if (!title || !start) return showToast('⚠️ Título y fecha requeridos', 'warn');
    try {
        const res = await fetch(EVENTS_API, {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ title, start_datetime: start, end_datetime: end||start, color })
        });
        if (res.ok) {
            document.getElementById('convertToCalendarModal').style.display = 'none';
            if (calendarObj) calendarObj.refetchEvents();
            showToast(`✅ "${title}" agregada al calendario 📅`);
        } else showToast('⚠️ Error al convertir', 'warn');
    } catch(e) { showToast('⚠️ Error de conexión', 'warn'); }
}

/* ════════════════════════════════════════════════════════
   CALENDAR
════════════════════════════════════════════════════════ */
function initCalendar() {
    const calEl = document.getElementById('fullCalendarRoot');
    if (typeof FullCalendar === 'undefined') { setTimeout(initCalendar, 200); return; }
    calendarObj = new FullCalendar.Calendar(calEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: {
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek,timeGridDay,multiMonthYear'
        },
        buttonText: { today:'Hoy', month:'Mes', week:'Semana', day:'Día', year:'Año' },
        height: 680,
        editable: true,
        selectable: true,
        events: async (info, successCb, failureCb) => {
            try {
                let evs = [];
                const res = await fetch(EVENTS_API);
                if (res.ok) {
                    const data = await res.json();
                    evs = data.map(e => {
                        const priority = e.priority ? e.priority.toLowerCase() : null;
                        return {
                            id: 'ev_' + e.id,
                            title: (priority && priority !== 'media' ? `[${priority.toUpperCase()}] ` : '') + e.title,
                            start: e.start_datetime,
                            end:   e.end_datetime,
                            backgroundColor: e.color,
                            borderColor:     e.color,
                            extendedProps: { ...e, isNative: true }
                        };
                    });
                }
                kanbanCols.forEach(col => col.cards.forEach(card => {
                    if (card.due_date) evs.push({
                        id: 'kc_' + card.id,
                        title: '📋 ' + card.title,
                        start: card.due_date,
                        allDay: true,
                        backgroundColor: card.color,
                        borderColor:     card.color,
                        extendedProps: { ...card, isKanban: true }
                    });
                }));
                successCb(evs);
            } catch(e) { failureCb(e); }
        },
        dateClick: (info) => openEventModal(null, info.dateStr),
        eventClick: (info) => {
            if (info.event.extendedProps.isKanban)
                openCardModal(info.event.extendedProps.column_id, info.event.extendedProps.id);
            else
                openEventModal(info.event.extendedProps, null);
        },
        eventDrop: async (info) => {
            const p = info.event.extendedProps;
            if (p.isKanban) {
                try {
                    await fetch(`${K_CARDS_API}/${p.id}`, {
                        method:'PUT', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({ due_date: info.event.start.toISOString().split('T')[0] })
                    });
                    loadKanban(); showToast('✅ Fecha de tarjeta actualizada');
                } catch(e) { info.revert(); }
            } else {
                try {
                    await fetch(`${EVENTS_API}/${p.id}`, {
                        method:'PUT', headers:{'Content-Type':'application/json'},
                        body: JSON.stringify({
                            start_datetime: info.event.start.toISOString(),
                            end_datetime:   info.event.end ? info.event.end.toISOString() : null
                        })
                    });
                    showToast('✅ Evento reprogramado');
                } catch(e) { info.revert(); }
            }
        },
        eventResize: async (info) => {
            const p = info.event.extendedProps;
            if (!p.isNative) return;
            try {
                await fetch(`${EVENTS_API}/${p.id}`, {
                    method:'PUT', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ end_datetime: info.event.end.toISOString() })
                });
            } catch(e) { info.revert(); }
        }
    });
    calendarObj.render();
}

/* ════════════════════════════════════════════════════════
   EVENT MODAL
════════════════════════════════════════════════════════ */
let _currentEventColor = '#10b981';

function openEventModal(evData, defaultDateStr) {
    document.getElementById('eventModal').style.display = 'flex';
    if (evData) {
        document.getElementById('evModalTitle').textContent = 'Editar Evento';
        document.getElementById('evId').value      = evData.id;
        document.getElementById('evTitle').value   = evData.title;
        const sd = new Date(evData.start_datetime);
        document.getElementById('evStart').value   = toLocalInput(sd);
        const ed = evData.end_datetime ? new Date(evData.end_datetime) : null;
        document.getElementById('evEnd').value     = ed ? toLocalInput(ed) : '';
        document.getElementById('evAssignee').value = evData.assignee_id || '';
        document.getElementById('evPriority').value = evData.priority || 'media';
        _currentEventColor = evData.color || '#10b981';
        document.getElementById('evColorPreview').style.background = _currentEventColor;
        document.getElementById('evColorPreview').dataset.value = _currentEventColor;
        document.getElementById('evDeleteBtn').style.display = 'inline-flex';
        document.getElementById('evConvertActions').style.display = 'flex';
        document.getElementById('eventModal').dataset.eventId    = evData.id;
        document.getElementById('eventModal').dataset.eventTitle = evData.title;
        document.getElementById('eventModal').dataset.eventColor = evData.color;
    } else {
        document.getElementById('evModalTitle').textContent = 'Nuevo Evento';
        document.getElementById('evId').value      = '';
        document.getElementById('evTitle').value   = '';
        const sd = defaultDateStr ? new Date(defaultDateStr) : new Date();
        document.getElementById('evStart').value   = toLocalInput(sd);
        document.getElementById('evEnd').value     = '';
        document.getElementById('evAssignee').value = '';
        document.getElementById('evPriority').value = 'media';
        _currentEventColor = '#10b981';
        document.getElementById('evColorPreview').style.background = _currentEventColor;
        document.getElementById('evColorPreview').dataset.value = _currentEventColor;
        document.getElementById('evDeleteBtn').style.display = 'none';
        document.getElementById('evConvertActions').style.display = 'none';
    }
}
function toLocalInput(d) {
    return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
}

async function saveEvent() {
    const id = document.getElementById('evId').value;
    const payload = {
        title:          document.getElementById('evTitle').value,
        start_datetime: document.getElementById('evStart').value,
        end_datetime:   document.getElementById('evEnd').value || document.getElementById('evStart').value,
        assignee_id:    document.getElementById('evAssignee').value || null,
        priority:       document.getElementById('evPriority').value,
        color:          _currentEventColor
    };
    if (!payload.title || !payload.start_datetime) return showToast('⚠️ Título y fecha requeridos', 'warn');
    try {
        const res = await fetch(id ? `${EVENTS_API}/${id}` : EVENTS_API, {
            method: id ? 'PUT' : 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast('✅ Evento guardado');
            document.getElementById('eventModal').style.display = 'none';
            if (calendarObj) calendarObj.refetchEvents();
        } else showToast('⚠️ Error al guardar', 'warn');
    } catch(e) { showToast('⚠️ Error de conexión', 'warn'); }
}

async function deleteEvent() {
    const id = document.getElementById('evId').value;
    if (!id || !confirm('¿Eliminar evento?')) return;
    try {
        await fetch(`${EVENTS_API}/${id}`, { method:'DELETE' });
        showToast('🗑️ Evento eliminado');
        document.getElementById('eventModal').style.display = 'none';
        if (calendarObj) calendarObj.refetchEvents();
    } catch(e) { showToast('⚠️ Error', 'warn'); }
}

/* ════════════════════════════════════════════════════════
   CONVERT EVENT → GANTT
════════════════════════════════════════════════════════ */
function openConvertEventToGantt() {
    const modal = document.getElementById('eventModal');
    const title = modal.dataset.eventTitle || document.getElementById('evTitle').value;
    const color = modal.dataset.eventColor || _currentEventColor;
    document.getElementById('ctgName').value  = title;
    document.getElementById('ctgStart').value = '';
    document.getElementById('ctgDur').value   = '';
    document.getElementById('ctgColorPreview').style.background = color;
    document.getElementById('ctgColorPreview').dataset.value = color;
    document.getElementById('eventModal').style.display = 'none';
    document.getElementById('convertToGanttModal').style.display = 'flex';
}

/* ════════════════════════════════════════════════════════
   CONVERT EVENT → KANBAN
════════════════════════════════════════════════════════ */
function openConvertEventToKanban() {
    const modal = document.getElementById('eventModal');
    const title = modal.dataset.eventTitle || document.getElementById('evTitle').value;
    const color = modal.dataset.eventColor || _currentEventColor;
    document.getElementById('ctkTitle').value = title;
    document.getElementById('ctkColorPreview').style.background = color;
    document.getElementById('ctkColorPreview').dataset.value = color;
    // Populate column selector
    const sel = document.getElementById('ctkColumn');
    sel.innerHTML = '';
    kanbanCols.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.name;
        sel.appendChild(opt);
    });
    document.getElementById('eventModal').style.display = 'none';
    document.getElementById('convertToKanbanModal').style.display = 'flex';
}

async function saveConvertToKanban() {
    const title  = document.getElementById('ctkTitle').value.trim();
    const colId  = document.getElementById('ctkColumn').value;
    const color  = document.getElementById('ctkColorPreview').dataset.value || '#6366f1';
    if (!title) return showToast('⚠️ Título requerido', 'warn');
    if (!colId) return showToast('⚠️ Selecciona una columna', 'warn');
    try {
        const res = await fetch(K_CARDS_API, {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ column_id: colId, title, color })
        });
        if (res.ok) {
            document.getElementById('convertToKanbanModal').style.display = 'none';
            loadKanban();
            showToast(`✅ "${title}" agregada al Kanban 📋`);
        } else showToast('⚠️ Error al convertir', 'warn');
    } catch(e) { showToast('⚠️ Error de conexión', 'warn'); }
}

/* ════════════════════════════════════════════════════════
   USERS PANEL
════════════════════════════════════════════════════════ */
let _newUserColor = '#6366f1';

function openUsersModal() {
    document.getElementById('usersModal').style.display = 'flex';
    renderUsersList();
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPass').value = '';
    document.getElementById('newUserRole').value = 'member';
    _newUserColor = '#6366f1';
    document.getElementById('newUserColorPreview').style.background = _newUserColor;
    document.getElementById('newUserColorPreview').dataset.value = _newUserColor;
}

function renderUsersList() {
    const list = document.getElementById('usersListEl');
    list.innerHTML = '';
    if (!usersList.length) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">No hay usuarios.</p>';
        return;
    }
    usersList.forEach(u => {
        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `
            <div class="user-avatar" style="background:${u.avatar_color}">${escHtml(u.name.charAt(0).toUpperCase())}</div>
            <div class="user-info">
                <div class="user-name">${escHtml(u.name)}</div>
                <div class="user-email">${escHtml(u.email)}</div>
            </div>
            <span class="user-role-badge ${u.role === 'admin' ? 'admin' : ''}">${u.role}</span>
            <button class="delete-btn" title="Eliminar usuario" onclick="deleteUser(${u.id})">×</button>`;
        list.appendChild(item);
    });
}

async function createUser() {
    const name  = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const pass  = document.getElementById('newUserPass').value;
    const role  = document.getElementById('newUserRole').value;
    const color = _newUserColor;
    if (!name || !email || !pass) return showToast('⚠️ Nombre, email y contraseña requeridos', 'warn');
    try {
        const res = await fetch(USERS_API, {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ name, email, password: pass, role, avatar_color: color })
        });
        if (res.ok) {
            const u = await res.json();
            usersList.push(u);
            renderUsersList();
            populateAssigneeSelects();
            document.getElementById('newUserName').value  = '';
            document.getElementById('newUserEmail').value = '';
            document.getElementById('newUserPass').value  = '';
            showToast(`✅ Usuario "${name}" creado`);
        } else {
            const err = await res.json();
            showToast('⚠️ ' + (err.error || 'Error'), 'warn');
        }
    } catch(e) { showToast('⚠️ Error de conexión', 'warn'); }
}

async function deleteUser(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
        const res = await fetch(`${USERS_API}/${id}`, { method:'DELETE' });
        if (res.ok) {
            usersList = usersList.filter(u => u.id !== id);
            renderUsersList();
            populateAssigneeSelects();
            showToast('🗑️ Usuario eliminado');
        }
    } catch(e) { showToast('⚠️ Error', 'warn'); }
}

/* ════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════ */
loadTheme();
buildCalendarData();
renderHeaders();
loadTasks();
loadInitialData();

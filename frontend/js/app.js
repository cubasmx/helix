/* ════════════════════════════════════════════════════════
   CONFIG & STATE
════════════════════════════════════════════════════════ */
const YEAR         = 2026;
const STORAGE_TASKS = 'gantt2026_tasks';
const STORAGE_THEME = 'gantt2026_theme';
const MONTH_NAMES   = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                       "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const TOTAL_WEEKS   = 53;

let weeksData      = [];
let currentIsoWeek = 0;
let activeView     = 'cards';   // 'cards' | 'table'
const API_URL      = (window.__ENV__.SERVICE_URL).replace(/\/$/, '') + '/tasks';
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
function loadTheme() {
    setTheme(localStorage.getItem(STORAGE_THEME) || 'light');
}

/* ════════════════════════════════════════════════════════
   VIEW TOGGLE
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
   PERSISTENCE (API)
════════════════════════════════════════════════════════ */
async function loadTasks() {
    try {
        const res = await fetch(API_URL);
        if(res.ok) {
            tasksList = await res.json();
            renderAll();
        } else {
            showToast('⚠️ Error al cargar tareas desde el servidor', 'warn');
        }
    } catch(e) {
        showToast('⚠️ No se pudo conectar al servidor.', 'warn');
        console.error("Error fetching tasks:", e);
    }
}

async function updateTask(task) {
    try {
        const res = await fetch(`${API_URL}/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
        if (!res.ok) showToast('⚠️ Error guardando cambios', 'warn');
    } catch (e) {
        showToast('⚠️ Error de conexión', 'warn');
    }
}

/* ════════════════════════════════════════════════════════
   CALENDAR LOGIC
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
        section.innerHTML = `
            <div class="empty-state">
                <div class="icon">📋</div>
                <p>No hay tareas. Agrega una arriba.</p>
            </div>`;
        return;
    }

    tasksList.forEach(task => {
        const card = document.createElement('article');
        card.className = 'task-card';
        card.style.setProperty('--task-color', task.color);

        const endWeek  = Math.min(task.start + task.duration - 1, TOTAL_WEEKS);
        const pctStart = ((task.start - 1) / TOTAL_WEEKS * 100).toFixed(1);
        const pctWidth = (task.duration / TOTAL_WEEKS * 100).toFixed(1);
        const todayPct = currentIsoWeek > 0
            ? ((currentIsoWeek - 1) / TOTAL_WEEKS * 100).toFixed(1) : null;

        // Is task active right now?
        const isActive = currentIsoWeek >= task.start && currentIsoWeek < task.start + task.duration;

        card.innerHTML = `
            <div class="card-header">
                <span class="card-name">${escHtml(task.name)}</span>
                <div class="card-actions">
                    <span class="card-color-btn" style="background:${task.color}" title="Cambiar color">
                        <input type="color" value="${task.color}" data-id="${task.id}">
                    </span>
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
            </div>
        `;

        // Color picker
        const colorInput = card.querySelector('input[type="color"]');
        colorInput.addEventListener('input', e => {
            task.color = e.target.value;
            card.style.setProperty('--task-color', task.color);
            e.target.closest('.card-color-btn').style.background = task.color;
            card.querySelector('.timeline-fill').style.background = task.color;
        });
        colorInput.addEventListener('change', () => updateTask(task));

        // Delete
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
        const cp = document.createElement('input'); cp.type = 'color'; cp.value = task.color;
        cp.addEventListener('input', e => {
            task.color = e.target.value;
            swatch.style.backgroundColor = task.color;
            // Visually update the bars without re-rendering everything
            Array.from(tr.querySelectorAll('.task-bar')).forEach(b => b.style.backgroundColor = task.color);
        });
        cp.addEventListener('change', () => {
            updateTask(task);
        });
        swatch.appendChild(cp);

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
   CRUD
════════════════════════════════════════════════════════ */
async function addTask() {
    const name     = document.getElementById('taskName').value.trim();
    const start    = parseInt(document.getElementById('startWeek').value);
    const duration = parseInt(document.getElementById('duration').value);
    const color    = document.getElementById('taskColor').value;

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
            const newTask = await res.json();
            tasksList.push(newTask);
            renderAll();
            document.getElementById('taskName').value  = '';
            document.getElementById('startWeek').value = '';
            document.getElementById('duration').value  = '';
            showToast(`✅ "${name}" agregada.`);
        } else {
             showToast('⚠️ Error al guardar tarea', 'warn');
        }
    } catch (e) {
        showToast('⚠️ Error de conexión', 'warn');
        console.error(e);
    }
}

async function deleteTask(id) {
    const t = tasksList.find(x => x.id === id);
    if (!t) return;
    
    // Optimistic UI update
    tasksList = tasksList.filter(x => x.id !== id);
    renderAll();
    
    try {
        const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast(`🗑️ "${t.name}" eliminada.`);
        } else {
            // Revert UI on failure
            tasksList.push(t);
            renderAll();
            showToast('⚠️ Error al eliminar tarea', 'warn');
        }
    } catch (e) {
        tasksList.push(t);
        renderAll();
        showToast('⚠️ Error de conexión', 'warn');
        console.error(e);
    }
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

/* ════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════ */
function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Enter key shortcut
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && ['taskName','startWeek','duration'].includes(e.target.id)) addTask();
});

/* ════════════════════════════════════════════════════════
   KANBAN Y CALENDAR DATA & APIs
════════════════════════════════════════════════════════ */
let usersList = [];
let kanbanCols = [];
let kanbanCards = [];
let calendarObj = null;

const USERS_API = (window.__ENV__.SERVICE_URL).replace(/\/$/, '') + '/users';
const K_COLS_API = (window.__ENV__.SERVICE_URL).replace(/\/$/, '') + '/kanban/columns';
const K_CARDS_API = (window.__ENV__.SERVICE_URL).replace(/\/$/, '') + '/kanban/cards';
const EVENTS_API = (window.__ENV__.SERVICE_URL).replace(/\/$/, '') + '/calendar/events';

async function loadInitialData() {
    try {
        const uRes = await fetch(USERS_API);
        if(uRes.ok) usersList = await uRes.json();
    } catch(e) {}
    
    // Poblar selects
    const assigneeSelects = [document.getElementById('kcAssignee'), document.getElementById('evAssignee')];
    assigneeSelects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">Sin asignar</option>';
        usersList.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id; opt.textContent = u.name;
            sel.appendChild(opt);
        });
    });

    await loadKanban();
    initCalendar();
}

/* ════════════════════════════════════════════════════════
   KANBAN LOGIC
════════════════════════════════════════════════════════ */
async function loadKanban() {
    try {
        const res = await fetch(K_COLS_API);
        if(res.ok) {
            kanbanCols = await res.json();
            renderKanban();
            if(calendarObj) calendarObj.refetchEvents();
        }
    } catch(e) { console.error('Kanban load error', e); }
}

function renderKanban() {
    const board = document.getElementById('kanbanBoard');
    board.innerHTML = '';
    
    kanbanCols.forEach(col => {
        const cDiv = document.createElement('div');
        cDiv.className = 'kanban-col';
        cDiv.style.setProperty('--col-color', col.color || 'var(--border)');
        cDiv.dataset.colId = col.id;
        
        let header = document.createElement('div');
        header.className = 'kanban-col-header';
        header.innerHTML = `<span>${escHtml(col.name)} <span style="font-size:10px; color:var(--text-muted)">(${col.cards.length})</span></span>
                            <div style="display:flex;gap:4px;">
                              <button class="delete-btn" title="Add Card" onclick="createKanbanCard(${col.id})">＋</button>
                              <button class="delete-btn" title="Delete Col" onclick="deleteKanbanColumn(${col.id})">×</button>
                            </div>`;
        
        let area = document.createElement('div');
        area.className = 'kanban-cards-area';
        area.dataset.colId = col.id;
        area.addEventListener('dragover', handleDragOver);
        area.addEventListener('drop', handleDrop);
        
        col.cards.sort((a,b) => a.position - b.position).forEach(card => {
            let kCard = document.createElement('div');
            kCard.className = 'kanban-card';
            kCard.style.setProperty('--card-color', card.color);
            kCard.draggable = true;
            kCard.dataset.cardId = card.id;
            kCard.dataset.colId = col.id;
            kCard.addEventListener('dragstart', handleDragStart);
            kCard.addEventListener('dragend', handleDragEnd);
            
            // Assignee badge
            let badgeHtml = '';
            if(card.assignee_id) {
                let u = usersList.find(x => x.id == card.assignee_id);
                if(u) badgeHtml = `<div class="assignee-badge" style="background:${u.avatar_color}" title="${escHtml(u.name)}">${escHtml(u.name.charAt(0).toUpperCase())}</div>`;
            }
            let dateHtml = card.due_date ? `<span style="display:flex;align-items:center;gap:3px;"><span style="font-size:12px">📅</span> ${new Date(card.due_date).toLocaleDateString()}</span>` : '';
            
            kCard.innerHTML = `<div class="kanban-card-title">${escHtml(card.title)}</div>
                               ${card.description ? `<div style="font-size:11px; margin-bottom:5px; color:var(--text-muted)">${escHtml(card.description.substring(0,40))}...</div>` : ''}
                               <div class="kanban-card-meta">
                                    ${dateHtml}
                                    ${badgeHtml}
                                    <div style="margin-left:auto; display:flex; gap:4px;">
                                        <button class="delete-btn" title="Edit" onclick="openCardModal(${col.id}, ${card.id})">✎</button>
                                        <button class="delete-btn" title="Delete" onclick="deleteKanbanCard(${col.id}, ${card.id})">×</button>
                                    </div>
                               </div>`;
            area.appendChild(kCard);
        });
        
        cDiv.appendChild(header);
        cDiv.appendChild(area);
        board.appendChild(cDiv);
    });
}

// Drag & Drop
let draggedCardEl = null;

function handleDragStart(e) {
    draggedCardEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.cardId);
    setTimeout(() => this.style.opacity = '0.5', 0);
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    draggedCardEl = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

async function handleDrop(e) {
    e.preventDefault();
    if (!draggedCardEl) return;
    
    let targetColDiv = this.closest('.kanban-col');
    if(!targetColDiv) return;
    
    let newColId = parseInt(targetColDiv.dataset.colId);
    let cardId = parseInt(draggedCardEl.dataset.cardId);
    let oldColId = parseInt(draggedCardEl.dataset.colId);
    
    // find correct insert pos
    let cardsArea = targetColDiv.querySelector('.kanban-cards-area');
    let afterEl = getDragAfterElement(cardsArea, e.clientY);
    
    // Optimistic UI update and Array sync
    let colFrom = kanbanCols.find(c => c.id === oldColId);
    let colTo = kanbanCols.find(c => c.id === newColId);
    let cardIdx = colFrom.cards.findIndex(c => c.id === cardId);
    let cardData = colFrom.cards.splice(cardIdx, 1)[0];
    
    let newPos = 0;
    if(afterEl == null) {
        cardsArea.appendChild(draggedCardEl);
        newPos = colTo.cards.length;
        colTo.cards.push(cardData);
    } else {
        cardsArea.insertBefore(draggedCardEl, afterEl);
        let afterId = parseInt(afterEl.dataset.cardId);
        newPos = colTo.cards.findIndex(c => c.id === afterId);
        if(newPos === -1) newPos = colTo.cards.length;
        colTo.cards.splice(newPos, 0, cardData);
    }
    
    draggedCardEl.dataset.colId = newColId;
    cardData.column_id = newColId;
    
    // Re-index pos 
    colTo.cards.forEach((c, i) => c.position = i);
    
    renderKanban(); 
    if(calendarObj) calendarObj.refetchEvents();
    
    // API
    try {
        await fetch(`${K_CARDS_API}/${cardId}/move`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ column_id: newColId, position: newPos })
        });
    } catch(err) { showToast('⚠️ Error al mover tarjeta', 'warn'); loadKanban(); }
}

function getDragAfterElement(container, y) {
    let draggableEls = [...container.querySelectorAll('.kanban-card:not([style*="opacity: 0.5"])')];
    return draggableEls.reduce((closest, child) => {
        let box = child.getBoundingClientRect();
        let offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function createKanbanColumn() {
    let name = prompt("Nombre de la nueva columna:");
    if(!name) return;
    let color = prompt("Color en HEX (ej. #3b82f6):", "#64748b");
    if(!color) color = "#64748b";
    try {
        let res = await fetch(K_COLS_API, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, color })
        });
        if(res.ok) { showToast('✅ Columna creada'); loadKanban(); }
    } catch(e) { showToast('⚠️ Error al crear columna', 'warn'); }
}

async function deleteKanbanColumn(id) {
    if(!confirm('¿Eliminar esta columna y TODAS sus tarjetas?')) return;
    try {
        let res = await fetch(`${K_COLS_API}/${id}`, { method: 'DELETE' });
        if(res.ok) { showToast('🗑️ Columna eliminada'); loadKanban(); }
    } catch(e) { showToast('⚠️ Error', 'warn'); }
}

async function createKanbanCard(colId) {
    document.getElementById('kcModalTitle').textContent = 'Nueva Tarjeta';
    document.getElementById('kcId').value = '';
    document.getElementById('kcColId').value = colId;
    document.getElementById('kcTitle').value = '';
    document.getElementById('kcDesc').value = '';
    document.getElementById('kcColor').value = '#6366f1';
    document.getElementById('kcAssignee').value = '';
    document.getElementById('kcDueDate').value = '';
    document.getElementById('kanbanCardModal').style.display = 'flex';
}

function openCardModal(colId, cardId) {
    let col = kanbanCols.find(c => c.id === colId);
    let card = col.cards.find(c => c.id === cardId);
    if(!card) return;
    
    document.getElementById('kcModalTitle').textContent = 'Editar Tarjeta';
    document.getElementById('kcId').value = card.id;
    document.getElementById('kcColId').value = colId;
    document.getElementById('kcTitle').value = card.title;
    document.getElementById('kcDesc').value = card.description || '';
    document.getElementById('kcColor').value = card.color;
    document.getElementById('kcAssignee').value = card.assignee_id || '';
    document.getElementById('kcDueDate').value = card.due_date ? card.due_date.split('T')[0] : '';
    document.getElementById('kanbanCardModal').style.display = 'flex';
}

async function saveKanbanCard() {
    let id = document.getElementById('kcId').value;
    let colId = document.getElementById('kcColId').value;
    let payload = {
        title: document.getElementById('kcTitle').value,
        description: document.getElementById('kcDesc').value,
        color: document.getElementById('kcColor').value,
        assignee_id: document.getElementById('kcAssignee').value || null,
        due_date: document.getElementById('kcDueDate').value || null
    };
    
    if(!payload.title) return showToast('⚠️ El título es requerido', 'warn');
    
    try {
        let uri = id ? `${K_CARDS_API}/${id}` : K_CARDS_API;
        if(!id) payload.column_id = colId;
        
        let res = await fetch(uri, {
            method: id ? 'PUT' : 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            showToast('✅ Tarjeta guardada');
            document.getElementById('kanbanCardModal').style.display = 'none';
            loadKanban();
        } else {
            showToast('⚠️ Error al guardar', 'warn');
        }
    } catch(e) { showToast('⚠️ Error de red', 'warn'); }
}

async function deleteKanbanCard(colId, cardId) {
    if(!confirm('¿Eliminar tarjeta?')) return;
    try {
        let res = await fetch(`${K_CARDS_API}/${cardId}`, { method: 'DELETE' });
        if(res.ok) { showToast('🗑️ Tarjeta eliminada'); loadKanban(); }
    } catch(e) { showToast('⚠️ Error', 'warn'); }
}


/* ════════════════════════════════════════════════════════
   CALENDAR LOGIC
════════════════════════════════════════════════════════ */
function initCalendar() {
    let calEl = document.getElementById('fullCalendarRoot');
    if(typeof FullCalendar === 'undefined'){
       setTimeout(initCalendar, 200);   
       return;
    }
    calendarObj = new FullCalendar.Calendar(calEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        height: 650,
        editable: true,
        selectable: true,
        buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana' },
        events: async function(info, successCallback, failureCallback) {
            try {
                // 1. Fetch Calendar Events
                let evs = [];
                let res = await fetch(EVENTS_API); 
                if(res.ok) {
                    let data = await res.json();
                    evs = data.map(e => ({
                        id: 'ev_' + e.id,
                        title: (e.priority ? `[${e.priority.toUpperCase()}] ` : '') + e.title,
                        start: e.start_datetime,
                        end: e.end_datetime,
                        backgroundColor: e.color,
                        borderColor: e.color,
                        extendedProps: { ...e, isNative: true }
                    }));
                }
                
                // 2. Map Kanban cards with due_date
                kanbanCols.forEach(col => {
                    col.cards.forEach(card => {
                        if(card.due_date) {
                            evs.push({
                                id: 'kc_' + card.id,
                                title: '📋 ' + card.title,
                                start: card.due_date,
                                allDay: true,
                                backgroundColor: card.color,
                                borderColor: card.color,
                                extendedProps: { ...card, isKanban: true }
                            });
                        }
                    });
                });
                
                successCallback(evs);
            } catch(e) { failureCallback(e); }
        },
        dateClick: function(info) {
            openEventModal(null, info.dateStr);
        },
        eventClick: function(info) {
            if(info.event.extendedProps.isKanban) {
                openCardModal(info.event.extendedProps.column_id, info.event.extendedProps.id);
            } else {
                openEventModal(info.event.extendedProps, null);
            }
        },
        eventDrop: async function(info) {
            if(info.event.extendedProps.isKanban) {
                let cardId = info.event.extendedProps.id;
                let isoDate = info.event.start.toISOString().split('T')[0];
                try {
                    await fetch(`${K_CARDS_API}/${cardId}`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ due_date: isoDate })
                    });
                    loadKanban();
                    showToast('✅ Fecha de tarjeta actualizada');
                } catch(e) { info.revert(); }
            } else {
                let evId = info.event.extendedProps.id;
                try {
                    await fetch(`${EVENTS_API}/${evId}`, {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            start_datetime: info.event.start.toISOString(),
                            end_datetime: info.event.end ? info.event.end.toISOString() : null
                        })
                    });
                    showToast('✅ Evento reprogramado');
                } catch(e) { info.revert(); }
            }
        }
    });
    calendarObj.render();
}

function openEventModal(evData, defaultDateStr) {
    document.getElementById('eventModal').style.display = 'flex';
    if(evData) {
        document.getElementById('evModalTitle').textContent = 'Editar Evento';
        document.getElementById('evId').value = evData.id;
        document.getElementById('evTitle').value = evData.title;
        let sd = new Date(evData.start_datetime);
        document.getElementById('evStart').value = new Date(sd.getTime() - sd.getTimezoneOffset() * 60000).toISOString().slice(0,16);
        document.getElementById('evAssignee').value = evData.assignee_id || '';
        document.getElementById('evPriority').value = evData.priority || 'media';
        document.getElementById('evColor').value = evData.color || '#10b981';
        document.getElementById('evDeleteBtn').style.display = 'inline-block';
    } else {
        document.getElementById('evModalTitle').textContent = 'Nuevo Evento';
        document.getElementById('evId').value = '';
        document.getElementById('evTitle').value = '';
        let sd = defaultDateStr ? new Date(defaultDateStr) : new Date();
        document.getElementById('evStart').value = new Date(sd.getTime() - sd.getTimezoneOffset() * 60000).toISOString().slice(0,16);
        document.getElementById('evAssignee').value = '';
        document.getElementById('evPriority').value = 'media';
        document.getElementById('evColor').value = '#10b981';
        document.getElementById('evDeleteBtn').style.display = 'none';
    }
}

async function saveEvent() {
    let id = document.getElementById('evId').value;
    let payload = {
        title: document.getElementById('evTitle').value,
        start_datetime: document.getElementById('evStart').value,
        assignee_id: document.getElementById('evAssignee').value || null,
        priority: document.getElementById('evPriority').value,
        color: document.getElementById('evColor').value
    };
    if(!payload.title || !payload.start_datetime) return showToast('⚠️ Título y fecha requeridos', 'warn');
    
    try {
        let uri = id ? `${EVENTS_API}/${id}` : EVENTS_API;
        let res = await fetch(uri, {
            method: id ? 'PUT' : 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            showToast('✅ Evento guardado');
            document.getElementById('eventModal').style.display = 'none';
            if(calendarObj) calendarObj.refetchEvents();
        } else showToast('⚠️ Error al guardar', 'warn');
    } catch(e) { showToast('⚠️ Error de conexión', 'warn'); }
}

async function deleteEvent() {
    let id = document.getElementById('evId').value;
    if(!id || !confirm('¿Eliminar evento?')) return;
    try {
        let res = await fetch(`${EVENTS_API}/${id}`, { method: 'DELETE' });
        if(res.ok) {
            showToast('🗑️ Evento eliminado');
            document.getElementById('eventModal').style.display = 'none';
            if(calendarObj) calendarObj.refetchEvents();
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

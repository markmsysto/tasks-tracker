// Kanban App Logic
document.addEventListener('DOMContentLoaded', () => {
    // State
    let tasks = [];
    let currentUser = null;
    let viewMode = 'board'; // 'board' or 'list'
    let activeFilter = 'all';

    const TURSO_URL = "https://systotaskmanager-systoadmin.aws-ap-northeast-1.turso.io";
    const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzAyNTY4MTQsImlkIjoiMGM3NjlhYTUtNTg2Mi00YzhhLWI2NGUtMDYyOTVkMzlkN2YwIiwicmlkIjoiNmY0ZGNkMjEtOWJiNS00ODYzLWIyOTYtZDhhMTc0Zjc1ZTg2In0.3cpyKulKom-5FrI6-TU2Ei8UsvjD6jPN0WMfNABXZkjKjTLf7ku1wqw8ryOjInICIByg5egYWk9CNP9EnL6ACg";

    async function tursoExecute(sql, args = []) {
        try {
            const response = await fetch(`${TURSO_URL}/v2/pipeline`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${TURSO_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: [
                        { type: 'execute', stmt: { sql, args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : { value: a?.toString() || "" }) } },
                        { type: 'close' }
                    ]
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            return data.results[0].response.result;
        } catch (err) {
            console.error("Turso Error:", err);
            return null;
        }
    }

    // DOM Elements
    const elements = {
        auth: {
            overlay: document.getElementById('auth-overlay'),
            form: document.getElementById('auth-form'),
            username: document.getElementById('auth-username'),
            toggle: document.getElementById('toggle-auth-mode')
        },
        user: {
            section: document.getElementById('user-profile-section'),
            nameDisplay: document.getElementById('display-username'),
            avatar: document.getElementById('user-avatar-initials'),
            signoutBtn: document.getElementById('btn-signout')
        },
        lists: {
            todo: document.getElementById('list-todo'),
            inprogress: document.getElementById('list-inprogress'),
            completed: document.getElementById('list-completed')
        },
        counts: {
            active: document.getElementById('count-active'),
            inprogress: document.getElementById('count-inprogress'),
            due: document.getElementById('count-due'),
            overdue: document.getElementById('count-overdue'),
            completed: document.getElementById('count-completed'),
            headerTodo: document.getElementById('count-header-todo'),
            headerInProgress: document.getElementById('count-header-inprogress'),
            headerCompleted: document.getElementById('count-header-completed')
        },
        modal: {
            backdrop: document.getElementById('modal-backdrop'),
            title: document.getElementById('modal-title'),
            closeBtn: document.getElementById('btn-close-modal'),
            form: document.getElementById('task-form'),
            inputs: {
                id: document.getElementById('task-id'),
                status: document.getElementById('task-status'),
                title: document.getElementById('title-input'),
                desc: document.getElementById('desc-input'),
                deadline: document.getElementById('deadline-input'),
                category: document.getElementById('category-input'),
                notes: document.getElementById('notes-input')
            }
        },
        search: document.getElementById('search-input'),
        navigation: {
            header: document.getElementById('list-nav-header'),
            title: document.getElementById('list-view-title'),
            backBtn: document.getElementById('btn-back-board')
        },
        board: document.getElementById('kanban-board'),
        listView: {
            container: document.getElementById('focused-list-view'),
            list: document.getElementById('filtered-tasks-list')
        },
        filterCards: {
            todo: document.getElementById('card-filter-todo'),
            inprogress: document.getElementById('card-filter-inprogress'),
            due: document.getElementById('card-filter-due'),
            overdue: document.getElementById('card-filter-overdue'),
            completed: document.getElementById('card-filter-completed')
        }
    };

    // --- Icons ---
    const Icons = {
        calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
        attach: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>',
        comment: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
        trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
        note: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>'
    };

    // --- Data Management ---
    async function init() {
        const loggedInUser = localStorage.getItem('systo_kanban_user');
        if (loggedInUser) {
            currentUser = loggedInUser;
            showApp();
            await loadUserTasks();
        } else {
            showLogin();
        }
    }

    function showLogin() {
        elements.auth.overlay.style.display = 'flex';
        elements.user.section.style.display = 'none';
    }

    function showApp() {
        elements.auth.overlay.style.display = 'none';
        elements.user.section.style.display = 'flex';
        elements.user.nameDisplay.textContent = currentUser;
        elements.user.avatar.textContent = currentUser.charAt(0).toUpperCase();
    }

    async function loadUserTasks() {
        const result = await tursoExecute("SELECT * FROM tasks WHERE username = ?", [currentUser]);
        if (result && result.rows) {
            tasks = result.rows.map(row => {
                const task = {};
                result.cols.forEach((col, i) => {
                    task[col.name] = row[i].value;
                });
                // Fix types
                task.id = parseInt(task.id);
                task.comments = parseInt(task.comments) || 0;
                task.attachments = parseInt(task.attachments) || 0;
                return task;
            });
            if (tasks.length === 0) {
                await seedData();
            }
        } else {
            await seedData();
        }
        renderBoard();
        updateStats();
    }

    async function seedData() {
        const currentYear = new Date().getFullYear();
        const initialTasks = [
            { id: 1, title: 'Update API documentation', desc: 'Write comprehensive API documentation with examples and integration guides.', notes: 'Check the Confluence page for initial drafts.', status: 'todo', category: 'work', deadline: `${currentYear}-02-03`, comments: 2, attachments: 0 },
            { id: 2, title: 'Setup database migrations', desc: 'Create and test all database migration scripts for the new schema version.', notes: 'Ensure all scripts are idempotent.', status: 'todo', category: 'work', deadline: `${currentYear}-02-18`, comments: 1, attachments: 1 },
            { id: 3, title: 'Design responsive mobile UI', desc: 'Ensure all components are mobile-responsive and touch-friendly on small devices.', notes: '', status: 'todo', category: 'personal', deadline: `${currentYear}-02-20`, comments: 1, attachments: 0 },
            { id: 4, title: 'Design new dashboard layout', desc: 'Create mockups and wireframes for the new analytics dashboard.', notes: 'Get feedback from the UX team.', status: 'inprogress', category: 'work', deadline: `${currentYear}-02-15`, comments: 3, attachments: 2 },
            { id: 5, title: 'Implement authentication flow', desc: 'Add OAuth integration and secure password reset functionality.', notes: 'Use the latest security libraries.', status: 'inprogress', category: 'work', deadline: `${currentYear}-02-08`, comments: 5, attachments: 1 },
            { id: 6, title: 'Refactor authentication module', desc: 'Clean up legacy code and optimize the authentication module.', notes: '', status: 'inprogress', category: 'personal', deadline: `${currentYear}-02-12`, comments: 4, attachments: 0 },
            { id: 7, title: 'Complete Q1 planning document', desc: 'Finalize roadmap and feature prioritization for the first quarter.', notes: 'Presented and approved on Jan 25.', status: 'completed', category: 'work', deadline: `${currentYear}-01-31`, comments: 6, attachments: 2 }
        ];

        for (const task of initialTasks) {
            await saveTaskToTurso(task);
        }
        tasks = initialTasks;
    }

    async function saveTaskToTurso(task) {
        await tursoExecute(
            "INSERT INTO tasks (id, username, title, desc, notes, status, category, deadline, comments, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, desc=excluded.desc, notes=excluded.notes, status=excluded.status, category=excluded.category, deadline=excluded.deadline, comments=excluded.comments, attachments=excluded.attachments",
            [task.id, currentUser, task.title, task.desc, task.notes, task.status, task.category, task.deadline, task.comments, task.attachments]
        );
    }

    async function saveTasks() {
        // Individual tasks are saved during creation/move
        updateStats();
    }

    // --- Rendering ---
    function renderBoard() {
        if (viewMode === 'board') {
            renderKanban();
        } else {
            renderList();
        }
        updateStats();
    }

    function renderKanban() {
        elements.board.style.display = 'grid';
        elements.listView.container.style.display = 'none';
        elements.navigation.header.style.display = 'none';

        // Clear all columns
        Object.values(elements.lists).forEach(el => el.innerHTML = '');

        const sortedTasks = getSortedTasks();
        const filter = elements.search.value.toLowerCase().trim();

        sortedTasks.forEach(task => {
            const matchesSearch = !filter ||
                (task.title && task.title.toLowerCase().includes(filter)) ||
                (task.desc && task.desc.toLowerCase().includes(filter)) ||
                (task.category && task.category.toLowerCase().includes(filter)) ||
                (task.notes && task.notes.toLowerCase().includes(filter));

            if (!matchesSearch) {
                return;
            }

            const card = createCard(task);
            if (elements.lists[task.status]) {
                elements.lists[task.status].appendChild(card);
            }
        });
    }

    function renderList() {
        elements.board.style.display = 'none';
        elements.listView.container.style.display = 'block';
        elements.navigation.header.style.display = 'flex';

        elements.listView.list.innerHTML = '';
        const sortedTasks = getSortedTasks();
        const searchQuery = elements.search.value.toLowerCase().trim();

        const filtered = sortedTasks.filter(task => {
            const matchesSearch = !searchQuery ||
                (task.title && task.title.toLowerCase().includes(searchQuery)) ||
                (task.desc && task.desc.toLowerCase().includes(searchQuery)) ||
                (task.category && task.category.toLowerCase().includes(searchQuery)) ||
                (task.notes && task.notes.toLowerCase().includes(searchQuery));
            if (!matchesSearch) return false;

            const today = new Date().toISOString().split('T')[0];
            const now = new Date();
            const deadline = new Date(task.deadline);

            switch (activeFilter) {
                case 'active': return task.status !== 'completed';
                case 'todo': return task.status === 'todo';
                case 'inprogress': return task.status === 'inprogress';
                case 'completed': return task.status === 'completed';
                case 'dueToday': return task.status !== 'completed' && task.deadline === today;
                case 'overdue': return task.status !== 'completed' && deadline < now && task.deadline !== today;
                default: return true;
            }
        });

        filtered.forEach(task => {
            elements.listView.list.appendChild(createCard(task));
        });

        // Set Title
        const titles = {
            active: 'Active Tasks',
            todo: 'To Do Tasks',
            inprogress: 'In Progress Tasks',
            completed: 'Completed Tasks',
            dueToday: 'Due Today',
            overdue: 'Overdue Tasks'
        };
        elements.navigation.title.textContent = `Viewing: ${titles[activeFilter] || 'Tasks'}`;
    }

    function getSortedTasks() {
        return [...tasks].sort((a, b) => {
            const dateA = new Date(a.deadline || '9999-12-31');
            const dateB = new Date(b.deadline || '9999-12-31');
            return dateA - dateB;
        });
    }

    function createCard(task) {
        const div = document.createElement('div');
        div.className = `task-card card-status-${task.status}`;
        div.draggable = true;
        div.dataset.id = task.id;

        // Drag Events
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', task.id);
            div.style.opacity = '0.5';
        });
        div.addEventListener('dragend', () => {
            div.style.opacity = '1';
        });

        // Click handling
        div.addEventListener('click', (e) => {
            // Delete button check
            if (e.target.closest('.btn-delete-card')) {
                e.stopPropagation();
                if (confirm('Delete this task?')) {
                    deleteTask(task.id);
                }
                return;
            }
            openModal(null, task.id);
        });

        const badgeClass = task.status === 'todo' ? 'badge-todo' : (task.status === 'inprogress' ? 'badge-progress' : 'badge-completed');
        const badgeText = task.status === 'todo' ? 'To Do' : (task.status === 'inprogress' ? 'In Progress' : 'Completed');

        // Check overdue
        const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
        const dateClass = isOverdue ? 'due-date overdue' : 'due-date';

        // Format Date
        const dateObj = new Date(task.deadline);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        div.innerHTML = `
            <div class="card-header">
                <div class="card-badges">
                    <span class="status-badge ${badgeClass}">${badgeText}</span>
                    <span class="category-badge badge-${task.category || 'work'}">${task.category ? task.category.charAt(0).toUpperCase() + task.category.slice(1) : 'Work'}</span>
                </div>
                <button class="btn-delete-card" title="Delete Task">${Icons.trash}</button>
            </div>
            <div class="card-title">${escapeHtml(task.title)}</div>
            <div class="card-desc">${escapeHtml(task.desc)}</div>
            <div class="card-footer">
                <div class="${dateClass}">
                    ${Icons.calendar} <span>${dateStr}</span>
                </div>
                <div class="card-meta">
                    ${task.notes ? `<div class="meta-item" title="Has Notes">${Icons.note}</div>` : ''}
                    ${task.attachments > 0 ? `<div class="meta-item">${Icons.attach} <span>${task.attachments}</span></div>` : ''}
                    ${task.comments > 0 ? `<div class="meta-item">${Icons.comment} <span>${task.comments}</span></div>` : ''}
                </div>
            </div>
        `;
        return div;
    }

    function updateStats() {
        const counts = { todo: 0, inprogress: 0, completed: 0, dueToday: 0, overdue: 0 };
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        tasks.forEach(t => {
            if (counts[t.status] !== undefined) counts[t.status]++;

            // Check due today vs overdue
            if (t.status !== 'completed') {
                const deadline = new Date(t.deadline);
                if (t.deadline === today) {
                    counts.dueToday++;
                } else if (deadline < now) {
                    counts.overdue++;
                }
            }
        });

        // Update Overview Cards
        elements.counts.inprogress.textContent = counts.inprogress;
        elements.counts.due.textContent = counts.dueToday;
        elements.counts.overdue.textContent = counts.overdue;
        elements.counts.completed.textContent = counts.completed;

        // Update Column Headers
        elements.counts.headerTodo.textContent = counts.todo;
        elements.counts.headerInProgress.textContent = counts.inprogress;
        elements.counts.headerCompleted.textContent = counts.completed;

        // Update Overdue Overview Card
        const todoOverview = document.getElementById('count-header-todo-overview');
        if (todoOverview) todoOverview.textContent = counts.todo;
    }

    // --- Drag and Drop Global Handlers ---
    window.allowDrop = (e) => {
        e.preventDefault();
    };

    window.drop = (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');

        let target = e.target;
        // Traverse up to find the column ID
        while (target && !target.classList?.contains('kanban-column')) {
            target = target.parentElement;
        }

        if (target && id) {
            const newStatus = target.id.replace('col-', '');
            updateTaskStatus(parseInt(id), newStatus);
        }
    };

    async function deleteTask(id) {
        tasks = tasks.filter(t => t.id !== id);
        await tursoExecute("DELETE FROM tasks WHERE id = ?", [id]);
        renderBoard();
        updateStats();
    }

    async function updateTaskStatus(id, newStatus) {
        const task = tasks.find(t => t.id === id);
        if (task && task.status !== newStatus) {
            task.status = newStatus;
            await tursoExecute("UPDATE tasks SET status = ? WHERE id = ?", [newStatus, id]);
            renderBoard();
        }
    }

    // --- Modal & Form ---
    window.openModal = (status = 'todo', editId = null) => {
        elements.modal.backdrop.classList.add('active');

        if (editId) {
            const task = tasks.find(t => t.id === editId);
            elements.modal.title.textContent = 'Edit Task';
            elements.modal.inputs.id.value = task.id;
            elements.modal.inputs.status.value = task.status;
            elements.modal.inputs.title.value = task.title;
            elements.modal.inputs.desc.value = task.desc;
            elements.modal.inputs.deadline.value = task.deadline;
            elements.modal.inputs.category.value = task.category || 'work';
            elements.modal.inputs.notes.value = task.notes || '';
        } else {
            elements.modal.title.textContent = 'New Task';
            elements.modal.form.reset();
            elements.modal.inputs.id.value = '';
            elements.modal.inputs.status.value = typeof status === 'string' ? status : 'todo';
            // Default date tomorrow
            const tmrw = new Date();
            tmrw.setDate(tmrw.getDate() + 1);
            elements.modal.inputs.deadline.valueAsDate = tmrw;
        }
    };

    window.closeModal = () => {
        elements.modal.backdrop.classList.remove('active');
    };

    elements.modal.form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const idVal = elements.modal.inputs.id.value;
        const taskData = {
            id: idVal ? parseInt(idVal) : Date.now(),
            title: elements.modal.inputs.title.value,
            desc: elements.modal.inputs.desc.value,
            deadline: elements.modal.inputs.deadline.value,
            status: elements.modal.inputs.status.value,
            category: elements.modal.inputs.category.value,
            notes: elements.modal.inputs.notes.value,
            comments: idVal ? (tasks.find(t => t.id == idVal)?.comments || 0) : 0,
            attachments: idVal ? (tasks.find(t => t.id == idVal)?.attachments || 0) : 0
        };

        if (idVal) {
            const idx = tasks.findIndex(t => t.id == idVal);
            if (idx !== -1) tasks[idx] = taskData;
        } else {
            tasks.push(taskData);
        }

        await saveTaskToTurso(taskData);
        renderBoard();
        closeModal();
    });

    // Close modal on backdrop click
    elements.modal.backdrop.addEventListener('click', (e) => {
        if (e.target === elements.modal.backdrop) closeModal();
    });

    // Close modal on close button click
    if (elements.modal.closeBtn) {
        elements.modal.closeBtn.addEventListener('click', closeModal);
    }

    // Search Listener
    elements.search.addEventListener('input', () => {
        renderBoard();
    });

    // Auth Handlers
    elements.auth.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = elements.auth.username.value.trim();
        if (username) {
            currentUser = username;

            // Check/Create user in Turso
            const userExists = await tursoExecute("SELECT username FROM users WHERE username = ?", [username]);
            if (!userExists || userExists.rows.length === 0) {
                await tursoExecute("INSERT INTO users (username) VALUES (?)", [username]);
            }

            localStorage.setItem('systo_kanban_user', currentUser);
            showApp();
            await loadUserTasks();
            elements.auth.username.value = '';
        }
    });

    elements.user.signoutBtn.addEventListener('click', () => {
        localStorage.removeItem('systo_kanban_user');
        currentUser = null;
        tasks = [];
        showLogin();
        renderBoard();
        updateStats();
    });

    elements.auth.toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const title = elements.auth.overlay.querySelector('.auth-title');
        const btn = elements.auth.overlay.querySelector('button');
        const toggleText = elements.auth.toggle;

        if (btn.textContent === 'Sign In') {
            title.textContent = 'Create an Account';
            btn.textContent = 'Sign Up';
            toggleText.textContent = 'Sign In';
        } else {
            title.textContent = 'Welcome back';
            btn.textContent = 'Sign In';
            toggleText.textContent = 'Sign Up';
        }
    });

    // View Navigation
    elements.filterCards.todo.addEventListener('click', () => switchView('list', 'todo'));
    elements.filterCards.inprogress.addEventListener('click', () => switchView('list', 'inprogress'));
    elements.filterCards.due.addEventListener('click', () => switchView('list', 'dueToday'));
    elements.filterCards.overdue.addEventListener('click', () => switchView('list', 'overdue'));
    elements.filterCards.completed.addEventListener('click', () => switchView('list', 'completed'));

    elements.navigation.backBtn.addEventListener('click', () => switchView('board'));

    function switchView(mode, filter = 'all') {
        viewMode = mode;
        activeFilter = filter;
        renderBoard();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Add Task Button in Header
    document.getElementById('btn-add-task').addEventListener('click', () => openModal('todo'));

    // Helper
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Init
    init();
});

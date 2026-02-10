// ============================================================
// Dashboard JS - Manager Panel
// ============================================================

let currentUser = null;

// ---- Utility Functions ----
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.querySelector('div').textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Make closeModal available globally for onclick handlers
window.closeModal = closeModal;

function roleLabel(role) {
    const labels = { manager: 'مدير', supervisor: 'ضابط', operator: 'منفذ' };
    return labels[role] || role;
}

function roleBadge(role) {
    const colors = {
        manager: 'bg-purple-100 text-purple-700',
        supervisor: 'bg-blue-100 text-blue-700',
        operator: 'bg-gray-100 text-gray-700',
    };
    return `<span class="px-2 py-0.5 rounded-lg text-xs font-medium ${colors[role] || ''}">${roleLabel(role)}</span>`;
}

function statusBadge(status) {
    const map = {
        pending: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-700' },
        approved: { label: 'معتمدة', color: 'bg-green-100 text-green-700' },
        rejected: { label: 'مرفوضة', color: 'bg-red-100 text-red-700' },
    };
    const s = map[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return `<span class="px-2 py-0.5 rounded-lg text-xs font-medium ${s.color}">${s.label}</span>`;
}

async function apiCall(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'حدث خطأ');
    return data;
}

// ---- Auth ----
async function checkAuth() {
    try {
        const data = await apiCall('/api/auth/me');
        currentUser = data.user;
        if (currentUser.role !== 'manager') {
            window.location.href = '/employee.html';
            return;
        }
        document.getElementById('userName').textContent = currentUser.name;
    } catch {
        window.location.href = '/';
    }
}

// ---- Navigation ----
function setupNavigation() {
    const links = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;

            // Update active link
            links.forEach(l => l.classList.remove('bg-emerald-50', 'text-emerald-700'));
            link.classList.add('bg-emerald-50', 'text-emerald-700');

            // Show section
            sections.forEach(s => s.classList.add('hidden'));
            document.getElementById(`section-${section}`).classList.remove('hidden');

            // Load data
            loadSection(section);

            // Close mobile sidebar
            document.getElementById('sidebar').classList.add('translate-x-full');
            document.getElementById('sidebarOverlay').classList.add('hidden');
        });
    });

    // Default to stats section
    links[0].click();

    // Auto update badge every 30 seconds
    setInterval(updateBadge, 30000);
}

// ---- Stats & Activity ----
async function loadStats() {
    try {
        const stats = await apiCall('/api/stats');

        // Update cards
        document.getElementById('statTotalEmployees').textContent = stats.totalEmployees;
        document.getElementById('statPendingLeaves').textContent = stats.pendingLeaves;
        document.getElementById('statTotalCourses').textContent = stats.totalCourses;
        document.getElementById('statTotalMandates').textContent = stats.totalMandates;

        // Shift Stats
        const shiftContainer = document.getElementById('shiftStats');
        shiftContainer.innerHTML = stats.byShift.map(s => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span class="font-medium text-gray-700">المناوبة ${s.shift}</span>
                <span class="bg-white px-3 py-1 rounded-lg text-sm font-bold shadow-sm text-gray-600">${s.count}</span>
            </div>
        `).join('');

        // Recent Leaves
        const leavesContainer = document.getElementById('recentLeaves');
        if (stats.recentLeaves.length === 0) {
            leavesContainer.innerHTML = '<p class="text-gray-500 text-center py-4">لا توجد طلبات حديثة</p>';
        } else {
            leavesContainer.innerHTML = stats.recentLeaves.map(l => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border-r-4 ${getStatusColor(l.status)}">
                    <div>
                        <p class="font-bold text-gray-800">${l.employee_name}</p>
                        <p class="text-xs text-gray-500">${l.start_date} - ${l.end_date}</p>
                    </div>
                    ${statusBadge(l.status)}
                </div>
            `).join('');
        }

    } catch (err) {
        showToast('فشل تحميل الإحصائيات');
    }
}

async function loadActivity() {
    try {
        const activities = await apiCall('/api/stats/activity');
        const tbody = document.getElementById('activityTable');

        if (activities.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">لا يوجد نشاطات مسجلة</td></tr>';
            return;
        }

        tbody.innerHTML = activities.map(a => `
            <tr class="hover:bg-gray-50/50 transition">
                <td class="px-4 py-3 text-right text-gray-600" dir="ltr">${new Date(a.created_at).toLocaleString('ar-EG')}</td>
                <td class="px-4 py-3 text-right font-medium text-gray-800">${a.user_name}</td>
                <td class="px-4 py-3 text-right">
                    <span class="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">${a.target_type}</span>
                </td>
                <td class="px-4 py-3 text-right font-medium text-emerald-600">${a.action}</td>
                <td class="px-4 py-3 text-right text-gray-600">${a.target_name || '-'}</td>
                <td class="px-4 py-3 text-right text-gray-500 text-sm truncate max-w-xs" title="${a.details || ''}">${a.details || '-'}</td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('فشل تحميل سجل النشاطات');
    }
}

async function updateBadge() {
    try {
        const stats = await apiCall('/api/stats');
        const badge = document.getElementById('pendingBadge');
        if (stats.pendingLeaves > 0) {
            badge.textContent = stats.pendingLeaves;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (err) {
        console.error('Failed to update badge');
    }
}

function getStatusColor(status) {
    if (status === 'approved') return 'border-emerald-500';
    if (status === 'rejected') return 'border-red-500';
    return 'border-yellow-500';
}

function loadSection(section) {
    // Auto-update badge logic
    updateBadge();

    switch (section) {
        case 'stats': loadStats(); break;
        case 'activity': loadActivity(); break;
        case 'employees': loadEmployees(); break;
        case 'leaves': loadLeaves(); break;
        case 'courses': loadCourses(); break;
        case 'mandates': loadMandates(); break;
    }
}

// ---- Mobile Menu ----
function setupMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('translate-x-full');
        overlay.classList.toggle('hidden');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    });
}

// ---- Employees ----
let allEmployees = [];

async function loadEmployees() {
    try {
        const employees = await apiCall('/api/employees');
        allEmployees = employees;
        renderEmployees(allEmployees);
    } catch (err) {
        showToast('خطأ في تحميل الموظفين');
    }
}

function renderEmployees(list) {
    const tbody = document.getElementById('employeesTable');
    const empty = document.getElementById('employeesEmpty');

    if (list.length === 0) {
        tbody.innerHTML = '';
        if (allEmployees.length === 0) {
            empty.textContent = 'لا يوجد موظفين بعد';
        } else {
            empty.textContent = 'لا يوجد نتائج للبحث';
        }
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = list.map((emp, i) => `
      <tr class="hover:bg-gray-50/50 transition">
        <td class="px-4 py-3 text-gray-500">${i + 1}</td>
        <td class="px-4 py-3 font-medium text-gray-800">${emp.name}</td>
        <td class="px-4 py-3 text-gray-600" dir="ltr">${emp.username}</td>
        <td class="px-4 py-3">${roleBadge(emp.role)}</td>
        <td class="px-4 py-3 text-gray-600">${emp.shift || '—'}</td>
        <td class="px-4 py-3 text-gray-600">${emp.join_date}</td>
        <td class="px-4 py-3">
          ${emp.role !== 'manager' ? `
            <div class="flex gap-1">
              <button onclick="editEmployee(${emp.id})" class="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition" title="تعديل">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button onclick="deleteEmployee(${emp.id}, '${emp.name}')" class="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition" title="حذف">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          ` : '<span class="text-gray-300 text-xs">—</span>'}
        </td>
      </tr>
    `).join('');
}

// Search
document.getElementById('employeeSearchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allEmployees.filter(emp => emp.name.toLowerCase().includes(q) || emp.username.toLowerCase().includes(q));
    renderEmployees(filtered);
});

// Add Employee
document.getElementById('addEmployeeBtn').addEventListener('click', () => {
    document.getElementById('employeeModalTitle').textContent = 'إضافة موظف جديد';
    document.getElementById('employeeForm').reset();
    document.getElementById('employeeId').value = '';
    document.getElementById('empPassword').required = true;
    document.getElementById('empPasswordHint').classList.add('hidden');
    document.getElementById('employeeModal').classList.remove('hidden');
});

// Edit Employee
window.editEmployee = async function (id) {
    try {
        const employees = await apiCall('/api/employees');
        const emp = employees.find(e => e.id === id);
        if (!emp) return;

        document.getElementById('employeeModalTitle').textContent = 'تعديل بيانات الموظف';
        document.getElementById('employeeId').value = emp.id;
        document.getElementById('empName').value = emp.name;
        document.getElementById('empUsername').value = emp.username;
        document.getElementById('empPassword').value = '';
        document.getElementById('empPassword').required = false;
        document.getElementById('empPasswordHint').classList.remove('hidden');
        document.getElementById('empRole').value = emp.role;
        document.getElementById('empShift').value = emp.shift || 'أ';
        document.getElementById('empJoinDate').value = emp.join_date;
        document.getElementById('employeeModal').classList.remove('hidden');
    } catch (err) {
        showToast('خطأ في تحميل بيانات الموظف');
    }
};

// Delete Employee
window.deleteEmployee = async function (id, name) {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    try {
        await apiCall(`/api/employees/${id}`, { method: 'DELETE' });
        showToast('تم حذف الموظف بنجاح');
        loadEmployees();
    } catch (err) {
        showToast(err.message);
    }
};

// Employee Form Submit
document.getElementById('employeeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('employeeId').value;
    const payload = {
        name: document.getElementById('empName').value,
        username: document.getElementById('empUsername').value,
        role: document.getElementById('empRole').value,
        shift: document.getElementById('empShift').value,
        join_date: document.getElementById('empJoinDate').value,
    };

    const password = document.getElementById('empPassword').value;
    if (password) payload.password = password;

    try {
        if (id) {
            await apiCall(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            showToast('تم تعديل الموظف بنجاح');
        } else {
            payload.password = password;
            await apiCall('/api/employees', { method: 'POST', body: JSON.stringify(payload) });
            showToast('تم إضافة الموظف بنجاح');
        }
        closeModal('employeeModal');
        loadEmployees();
    } catch (err) {
        showToast(err.message);
    }
});

// ---- Leaves ----
let allLeaves = [];

async function loadLeaves() {
    try {
        allLeaves = await apiCall('/api/leaves');
        renderLeaves();
    } catch (err) {
        showToast('خطأ في تحميل الإجازات');
    }
}

function renderLeaves() {
    const shiftFilter = document.getElementById('leavesShiftFilter').value;
    const statusFilter = document.getElementById('leavesStatusFilter').value;

    let filtered = allLeaves;
    if (shiftFilter) filtered = filtered.filter(l => l.employee_shift === shiftFilter);
    if (statusFilter) filtered = filtered.filter(l => l.status === statusFilter);

    const tbody = document.getElementById('leavesTable');
    const empty = document.getElementById('leavesEmpty');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = filtered.map(l => `
    <tr class="hover:bg-gray-50/50 transition">
      <td class="px-4 py-3 font-medium text-gray-800">${l.employee_name}</td>
      <td class="px-4 py-3">${roleBadge(l.employee_role)}</td>
      <td class="px-4 py-3 text-gray-600">${l.employee_shift || '—'}</td>
      <td class="px-4 py-3 text-gray-600">${l.start_date}</td>
      <td class="px-4 py-3 text-gray-600">${l.end_date}</td>
      <td class="px-4 py-3">${statusBadge(l.status)}</td>
      <td class="px-4 py-3">
        <div class="flex gap-1">
          ${l.status === 'pending' ? `
            <button onclick="approveLeave(${l.id})" class="p-1.5 hover:bg-green-50 rounded-lg text-green-600 transition" title="موافقة">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </button>
            <button onclick="rejectLeave(${l.id})" class="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition" title="رفض">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          ` : ''}
          <button onclick="deleteLeave(${l.id})" class="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition" title="حذف">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

document.getElementById('leavesShiftFilter').addEventListener('change', renderLeaves);
document.getElementById('leavesStatusFilter').addEventListener('change', renderLeaves);

window.approveLeave = async function (id) {
    try {
        await apiCall(`/api/leaves/${id}/approve`, { method: 'PUT' });
        showToast('تمت الموافقة على الإجازة');
        loadLeaves();
    } catch (err) { showToast(err.message); }
};

window.rejectLeave = async function (id) {
    try {
        await apiCall(`/api/leaves/${id}/reject`, { method: 'PUT' });
        showToast('تم رفض الإجازة');
        loadLeaves();
    } catch (err) { showToast(err.message); }
};

window.deleteLeave = async function (id) {
    if (!confirm('هل أنت متأكد من حذف هذه الإجازة؟')) return;
    try {
        await apiCall(`/api/leaves/${id}`, { method: 'DELETE' });
        showToast('تم حذف الإجازة');
        loadLeaves();
    } catch (err) { showToast(err.message); }
};

// ---- Courses ----
async function loadCourses() {
    try {
        const courses = await apiCall('/api/courses');
        const tbody = document.getElementById('coursesTable');
        const empty = document.getElementById('coursesEmpty');

        if (courses.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        tbody.innerHTML = courses.map(c => `
      <tr class="hover:bg-gray-50/50 transition">
        <td class="px-4 py-3 font-medium text-gray-800">${c.title}</td>
        <td class="px-4 py-3 text-gray-600">${c.location}</td>
        <td class="px-4 py-3 text-gray-600">${c.date}</td>
        <td class="px-4 py-3">${c.employee_name} ${roleBadge(c.employee_role)}</td>
        <td class="px-4 py-3">
          <button onclick="deleteCourse(${c.id})" class="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition" title="حذف">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
    } catch (err) {
        showToast('خطأ في تحميل الدورات');
    }
}

// Course nomination
async function loadCourseNominations(role = '') {
    try {
        const url = role ? `/api/courses/nominations?role=${role}` : '/api/courses/nominations';
        const nominees = await apiCall(url);
        const list = document.getElementById('courseNominationList');

        list.innerHTML = nominees.map((n, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            const lastDate = n.last_course_date || 'لم يخرج أبداً';
            const isSelected = document.getElementById('courseEmployeeId').value == n.id;
            return `
        <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-0 transition ${isSelected ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''}"
             onclick="selectCourseNominee(${n.id}, this)">
          <span class="text-lg w-8 text-center">${medal}</span>
          <div class="flex-1">
            <p class="font-medium text-gray-800 text-sm">${n.name}</p>
            <p class="text-xs text-gray-500">${roleLabel(n.role)} — مناوبة ${n.shift} — تعيين: ${n.join_date}</p>
          </div>
          <span class="text-xs ${n.last_course_date ? 'text-gray-400' : 'text-amber-600 font-medium'}">${lastDate}</span>
        </div>
      `;
        }).join('');
    } catch (err) {
        showToast('خطأ في تحميل قائمة الترشيح');
    }
}

window.selectCourseNominee = function (id, el) {
    document.getElementById('courseEmployeeId').value = id;
    // Highlight selected
    el.parentElement.querySelectorAll('div').forEach(d => {
        d.classList.remove('bg-emerald-50', 'ring-1', 'ring-emerald-300');
    });
    el.classList.add('bg-emerald-50', 'ring-1', 'ring-emerald-300');
};

document.getElementById('addCourseBtn').addEventListener('click', () => {
    document.getElementById('courseForm').reset();
    document.getElementById('courseEmployeeId').value = '';
    document.getElementById('courseModal').classList.remove('hidden');
    loadCourseNominations();
});

document.getElementById('courseRoleFilter').addEventListener('change', (e) => {
    loadCourseNominations(e.target.value);
});

document.getElementById('courseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const employee_id = document.getElementById('courseEmployeeId').value;
    if (!employee_id) { showToast('يرجى اختيار موظف'); return; }

    try {
        await apiCall('/api/courses', {
            method: 'POST',
            body: JSON.stringify({
                title: document.getElementById('courseTitle').value,
                location: document.getElementById('courseLocation').value,
                date: document.getElementById('courseDate').value,
                employee_id,
            }),
        });
        showToast('تم إسناد الدورة بنجاح');
        closeModal('courseModal');
        loadCourses();
    } catch (err) { showToast(err.message); }
});

window.deleteCourse = async function (id) {
    if (!confirm('هل أنت متأكد من حذف هذه الدورة؟')) return;
    try {
        await apiCall(`/api/courses/${id}`, { method: 'DELETE' });
        showToast('تم حذف الدورة');
        loadCourses();
    } catch (err) { showToast(err.message); }
};

// ---- Mandates ----
async function loadMandates() {
    try {
        const mandates = await apiCall('/api/mandates');
        const tbody = document.getElementById('mandatesTable');
        const empty = document.getElementById('mandatesEmpty');

        if (mandates.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        tbody.innerHTML = mandates.map(m => `
      <tr class="hover:bg-gray-50/50 transition">
        <td class="px-4 py-3 font-medium text-gray-800">${m.title}</td>
        <td class="px-4 py-3 text-gray-600">${m.location}</td>
        <td class="px-4 py-3 text-gray-600">${m.date}</td>
        <td class="px-4 py-3">${m.employee_name} ${roleBadge(m.employee_role)}</td>
        <td class="px-4 py-3">
          <button onclick="deleteMandate(${m.id})" class="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition" title="حذف">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
    } catch (err) {
        showToast('خطأ في تحميل الانتدابات');
    }
}

// Mandate nomination
async function loadMandateNominations(role = '') {
    try {
        const url = role ? `/api/mandates/nominations?role=${role}` : '/api/mandates/nominations';
        const nominees = await apiCall(url);
        const list = document.getElementById('mandateNominationList');

        list.innerHTML = nominees.map((n, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            const lastDate = n.last_mandate_date || 'لم يخرج أبداً';
            const isSelected = document.getElementById('mandateEmployeeId').value == n.id;
            return `
        <div class="flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-0 transition ${isSelected ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''}"
             onclick="selectMandateNominee(${n.id}, this)">
          <span class="text-lg w-8 text-center">${medal}</span>
          <div class="flex-1">
            <p class="font-medium text-gray-800 text-sm">${n.name}</p>
            <p class="text-xs text-gray-500">${roleLabel(n.role)} — مناوبة ${n.shift} — تعيين: ${n.join_date}</p>
          </div>
          <span class="text-xs ${n.last_mandate_date ? 'text-gray-400' : 'text-amber-600 font-medium'}">${lastDate}</span>
        </div>
      `;
        }).join('');
    } catch (err) {
        showToast('خطأ في تحميل قائمة الترشيح');
    }
}

window.selectMandateNominee = function (id, el) {
    document.getElementById('mandateEmployeeId').value = id;
    el.parentElement.querySelectorAll('div').forEach(d => {
        d.classList.remove('bg-emerald-50', 'ring-1', 'ring-emerald-300');
    });
    el.classList.add('bg-emerald-50', 'ring-1', 'ring-emerald-300');
};

document.getElementById('addMandateBtn').addEventListener('click', () => {
    document.getElementById('mandateForm').reset();
    document.getElementById('mandateEmployeeId').value = '';
    document.getElementById('mandateModal').classList.remove('hidden');
    loadMandateNominations();
});

document.getElementById('mandateRoleFilter').addEventListener('change', (e) => {
    loadMandateNominations(e.target.value);
});

document.getElementById('mandateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const employee_id = document.getElementById('mandateEmployeeId').value;
    if (!employee_id) { showToast('يرجى اختيار موظف'); return; }

    try {
        await apiCall('/api/mandates', {
            method: 'POST',
            body: JSON.stringify({
                title: document.getElementById('mandateTitle').value,
                location: document.getElementById('mandateLocation').value,
                date: document.getElementById('mandateDate').value,
                employee_id,
            }),
        });
        showToast('تم إسناد الانتداب بنجاح');
        closeModal('mandateModal');
        loadMandates();
    } catch (err) { showToast(err.message); }
});

window.deleteMandate = async function (id) {
    if (!confirm('هل أنت متأكد من حذف هذا الانتداب؟')) return;
    try {
        await apiCall(`/api/mandates/${id}`, { method: 'DELETE' });
        showToast('تم حذف الانتداب');
        loadMandates();
    } catch (err) { showToast(err.message); }
};

// ---- Logout ----
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await apiCall('/api/auth/logout', { method: 'POST' });
    } catch (e) { }
    window.location.href = '/';
});

// ---- Initialize ----
(async () => {
    await checkAuth();
    setupNavigation();
    setupMobileMenu();
})();

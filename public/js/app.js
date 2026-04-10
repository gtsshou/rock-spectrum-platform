// app.js - 主应用逻辑（集成权限和上传功能）

// 全局变量
let rockData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 12;
let rockTypes = new Set();
let locations = new Set();
let compareList = [];
let currentUser = null;

// API 基础路径
const API_BASE = '/api';

// 等待所有内容加载完成
window.addEventListener('load', function() {
    console.log('页面加载完成');
    initApp();
});

async function initApp() {
    console.log('初始化应用');
    
    // 检查认证状态
    await checkAuth();
    
    // 加载数据
    await loadRockData();
    
    // 初始化事件监听
    initEventListeners();
    
    // 初始化图表
    if (typeof initSpectrumChart === 'function') {
        initSpectrumChart();
        initChartControls();
    }
    
    // 重置筛选
    resetFilters();
}

// 检查认证状态
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/check-auth`);
        const data = await response.json();
        if (data.authenticated) {
            currentUser = data.user;
            updateUIForUser();
        } else {
            currentUser = null;
            updateUIForUser();
            // 显示登录提示
            showAlert('请登录以使用完整功能', 'info');
        }
    } catch (error) {
        console.error('检查认证失败:', error);
    }
}

// 更新UI根据用户角色
function updateUIForUser() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');
    const adminPanel = document.getElementById('admin-panel');
    
    if (currentUser) {
        userInfo.innerHTML = `<span class="badge bg-${currentUser.role === 'admin' ? 'danger' : 'secondary'}">
            <i class="fas fa-${currentUser.role === 'admin' ? 'user-shield' : 'user'}"></i> ${currentUser.username} (${currentUser.role === 'admin' ? '管理员' : '游客'})
        </span>`;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        
        if (currentUser.role === 'admin') {
            adminPanel.style.display = 'block';
        } else {
            adminPanel.style.display = 'none';
        }
    } else {
        userInfo.innerHTML = '';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        adminPanel.style.display = 'none';
    }
}

// 登录
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.success) {
            currentUser = data.user;
            updateUIForUser();
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            showAlert(`欢迎回来，${username}！`, 'success');
            // 刷新数据
            await loadRockData();
            resetFilters();
        } else {
            showAlert(data.error || '登录失败', 'error');
        }
    } catch (error) {
        console.error('登录失败:', error);
        showAlert('登录失败，请检查网络', 'error');
    }
}

// 登出
async function logout() {
    try {
        await fetch(`${API_BASE}/logout`, { method: 'POST' });
        currentUser = null;
        updateUIForUser();
        showAlert('已安全登出', 'info');
        await loadRockData();
        resetFilters();
    } catch (error) {
        console.error('登出失败:', error);
    }
}

// 加载岩石数据
async function loadRockData() {
    try {
        console.log('加载岩石数据...');
        const response = await fetch(`${API_BASE}/rocks`);
        if (!response.ok) throw new Error('加载失败');
        rockData = await response.json();
        console.log(`成功加载 ${rockData.length} 条数据`);
        
        filteredData = [...rockData];
        processRockData(rockData);
        updateFilterOptions();
        
        const sampleCountEl = document.getElementById('sample-count');
        if (sampleCountEl) {
            sampleCountEl.innerHTML = `<i class="fas fa-database"></i> ${rockData.length} 个样本`;
        }
        
        displayResults();
        updateStats();
        
        return rockData;
    } catch (error) {
        console.error('加载数据失败:', error);
        showAlert('加载数据失败，请刷新页面', 'error');
        return [];
    }
}

// 处理岩石数据
function processRockData(data) {
    rockTypes.clear();
    locations.clear();
    
    data.forEach(rock => {
        if (rock.rock_type && rock.rock_type.trim()) rockTypes.add(rock.rock_type);
        if (rock.location && rock.location.trim()) locations.add(rock.location);
    });
}

// 更新筛选选项
function updateFilterOptions() {
    const rockTypeFilter = document.getElementById('rock-type-filter');
    const locationFilter = document.getElementById('location-filter');
    
    if (!rockTypeFilter || !locationFilter) return;
    
    rockTypeFilter.innerHTML = '';
    locationFilter.innerHTML = '<option value="">全部位置</option>';
    
    Array.from(rockTypes).sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        rockTypeFilter.appendChild(option);
    });
    
    Array.from(locations).sort().forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
}

// 显示结果
function displayResults() {
    const viewType = document.getElementById('toggle-view').dataset.view || 'grid';
    
    if (viewType === 'list') {
        displayListView();
    } else {
        displayGridView();
    }
    
    updatePagination();
}

// 网格视图
function displayGridView() {
    const container = document.getElementById('rock-grid');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    container.innerHTML = '';
    
    pageData.forEach(rock => {
        const card = createRockCard(rock);
        container.appendChild(card);
    });
}

// 创建岩石卡片
function createRockCard(rock) {
    const col = document.createElement('div');
    col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
    
    col.innerHTML = `
        <div class="card rock-card h-100" data-id="${rock.id}">
            <div class="position-relative">
                <img src="/images/rocks/${rock.image || 'default.jpg'}" 
                     class="card-img-top rock-image" 
                     alt="${rock.rock_type || '岩石样本'}"
                     onerror="this.src='/images/rocks/default.jpg'">
                <span class="rock-badge badge" 
                    style="background-color: ${getRockTypeColor(rock.rock_type)}; color: white;">
                    ${rock.rock_type || '未知'}
                </span>
            </div>
            <div class="card-body">
                <h6 class="card-title">${rock.id}</h6>
                <p class="card-text small">
                    <i class="fas fa-map-marker-alt"></i> ${rock.location || '未知位置'}<br>
                    <i class="fas fa-clock"></i> ${rock.formation_age || '未知时代'}
                </p>
            </div>
            <div class="card-footer bg-white border-0 pt-0">
                <div class="btn-group w-100">
                    <button class="btn btn-sm btn-outline-primary view-detail" data-id="${rock.id}">
                        <i class="fas fa-eye"></i> 详情
                    </button>
                    <button class="btn btn-sm btn-outline-success view-spectrum" data-id="${rock.id}">
                        <i class="fas fa-chart-line"></i> 光谱
                    </button>
                    <button class="btn btn-sm btn-outline-info add-compare" data-id="${rock.id}">
                        <i class="fas fa-plus"></i> 对比
                    </button>
                    ${currentUser?.role === 'admin' ? `
                        <button class="btn btn-sm btn-outline-warning edit-sample" data-id="${rock.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-sample" data-id="${rock.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    return col;
}

// 列表视图
function displayListView() {
    const container = document.getElementById('rock-table');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    container.innerHTML = '';
    
    pageData.forEach(rock => {
        const row = createTableRow(rock);
        container.appendChild(row);
    });
}

// 创建表格行
function createTableRow(rock) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td><strong>${rock.id}</strong></td>
        <td><span class="badge" style="background-color: ${getRockTypeColor(rock.rock_type)}; color: white;">${rock.rock_type || '未知'}</span></td>
        <td>${rock.location || '未知'}</td>
        <td>${rock.formation_age || '未知'}</td>
        <td><span class="badge bg-light text-dark"><i class="fas fa-wave-square"></i> ${rock.spectrum ? '有光谱' : '无光谱'}</span></td>
        <td>
            <button class="btn btn-sm btn-outline-primary view-detail" data-id="${rock.id}"><i class="fas fa-eye"></i></button>
            <button class="btn btn-sm btn-outline-success view-spectrum" data-id="${rock.id}"><i class="fas fa-chart-line"></i></button>
            <button class="btn btn-sm btn-outline-info add-compare" data-id="${rock.id}"><i class="fas fa-plus"></i></button>
            ${currentUser?.role === 'admin' ? `
                <button class="btn btn-sm btn-outline-warning edit-sample" data-id="${rock.id}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger delete-sample" data-id="${rock.id}"><i class="fas fa-trash"></i></button>
            ` : ''}
        </td>
    `;
    
    return row;
}

// 根据岩性获取颜色
function getRockTypeColor(rockType) {
    const colorMap = {
        '侵入岩': '#0d6efd',
        '喷出岩': '#6c757d',
        '碎屑岩': '#198754',
        '粘土岩': '#f326e9',
        '内源沉积岩': '#0dcaf0',
        '区域变质岩': '#ffa407',
        '接触变质岩': '#dc3545',
        '混合岩': '#e3f030',
        '动力变质岩': '#6610f2',
        '热液交代变质岩': '#10f232'
    };
    return colorMap[rockType] || '#212529';
}

// 更新分页
function updatePagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const container = document.getElementById('pagination-container');
    const ul = container.querySelector('.pagination');
    
    if (totalPages <= 1) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    ul.innerHTML = '';
    
    // 上一页
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}">上一页</a>`;
    ul.appendChild(prevLi);
    
    // 页码
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        ul.appendChild(li);
    }
    
    // 下一页
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}">下一页</a>`;
    ul.appendChild(nextLi);
    
    document.getElementById('result-count').textContent = `第 ${currentPage}/${totalPages} 页，共 ${filteredData.length} 个结果`;
}

// 更新统计信息
function updateStats() {
    const stats = document.getElementById('filter-stats');
    const rockTypeCount = new Set(filteredData.map(r => r.rock_type)).size;
    const locationCount = new Set(filteredData.map(r => r.location)).size;
    
    stats.innerHTML = `
        筛选结果: <strong>${filteredData.length}</strong> 个样本<br>
        岩性种类: <strong>${rockTypeCount}</strong> 种<br>
        采样位置: <strong>${locationCount}</strong> 处
    `;
}

// 保存样本（创建或更新）
async function saveSample(isEdit = false, rockId = null) {
    const form = document.getElementById('sample-form');
    const formData = new FormData();
    
    // 收集表单数据
    const formElements = form.elements;
    const rockData = {};
    for (let i = 0; i < formElements.length; i++) {
        const el = formElements[i];
        if (el.name && el.name !== 'image' && el.name !== 'spectrum') {
            rockData[el.name] = el.value;
        }
    }
    
    formData.append('data', JSON.stringify(rockData));
    
    // 添加文件
    const imageFile = document.querySelector('[name="image"]').files[0];
    const spectrumFile = document.querySelector('[name="spectrum"]').files[0];
    if (imageFile) formData.append('image', imageFile);
    if (spectrumFile) formData.append('spectrum', spectrumFile);
    
    try {
        let url = `${API_BASE}/rocks`;
        let method = 'POST';
        if (isEdit && rockId) {
            url = `${API_BASE}/rocks/${rockId}`;
            method = 'PUT';
        }
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        if (response.ok) {
            showAlert(isEdit ? '样本更新成功' : '样本添加成功', 'success');
            bootstrap.Modal.getInstance(document.getElementById('sampleModal')).hide();
            await loadRockData();
            resetFilters();
            form.reset();
            document.getElementById('image-preview').innerHTML = '';
        } else {
            const error = await response.json();
            showAlert(error.error || '操作失败', 'error');
        }
    } catch (error) {
        console.error('保存样本失败:', error);
        showAlert('保存失败，请检查网络', 'error');
    }
}

// 删除样本
async function deleteSample(rockId) {
    if (!confirm('确定要删除该样本吗？相关的图片和光谱文件也会被删除！')) return;
    
    try {
        const response = await fetch(`${API_BASE}/rocks/${rockId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showAlert('样本删除成功', 'success');
            await loadRockData();
            resetFilters();
            // 关闭详情模态框
            const detailModal = bootstrap.Modal.getInstance(document.getElementById('detailModal'));
            if (detailModal) detailModal.hide();
        } else {
            const error = await response.json();
            showAlert(error.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除样本失败:', error);
        showAlert('删除失败，请检查网络', 'error');
    }
}

// 编辑样本（加载数据到表单）
async function editSample(rockId) {
    const rock = rockData.find(r => r.id === rockId);
    if (!rock) return;
    
    const form = document.getElementById('sample-form');
    // 填充表单
    for (const key in rock) {
        const input = form.querySelector(`[name="${key}"]`);
        if (input && key !== 'image' && key !== 'spectrum' && key !== 'id') {
            input.value = rock[key] || '';
        }
    }
    document.getElementById('sample-id').value = rock.id;
    
    // 显示图片预览
    if (rock.image) {
        document.getElementById('image-preview').innerHTML = `<img src="/images/rocks/${rock.image}" class="image-preview-img" style="max-height:100px">`;
    }
    
    document.getElementById('sampleModalTitle').textContent = '编辑样本';
    const modal = new bootstrap.Modal(document.getElementById('sampleModal'));
    modal.show();
    
    // 保存按钮事件
    const saveBtn = document.getElementById('save-sample-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.addEventListener('click', () => saveSample(true, rockId));
}

// 初始化事件监听
function initEventListeners() {
    // 登录/登出
    document.getElementById('login-btn').addEventListener('click', () => {
        new bootstrap.Modal(document.getElementById('loginModal')).show();
    });
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // 登录表单提交
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        login(username, password);
    });
    
    // 搜索按钮
    document.getElementById('search-btn').addEventListener('click', applyFilters);
    document.getElementById('quick-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
    document.getElementById('apply-filter').addEventListener('click', applyFilters);
    document.getElementById('reset-filter').addEventListener('click', resetFilters);
    document.getElementById('toggle-view').addEventListener('click', toggleView);
    document.getElementById('clear-compare').addEventListener('click', () => {
        compareList = [];
        updateCompareList();
        document.getElementById('compare-btn').disabled = true;
        showAlert('已清空对比列表', 'info');
    });
    document.getElementById('compare-btn').addEventListener('click', () => {
        if (compareList.length < 2) {
            showAlert('请至少选择2个样本进行对比', 'warning');
            return;
        }
        compareSpectra();
    });
    
    // 添加样本按钮
    document.getElementById('add-sample-btn').addEventListener('click', () => {
        document.getElementById('sample-form').reset();
        document.getElementById('sample-id').value = '';
        document.getElementById('image-preview').innerHTML = '';
        document.getElementById('sampleModalTitle').textContent = '添加新样本';
        const modal = new bootstrap.Modal(document.getElementById('sampleModal'));
        modal.show();
        
        const saveBtn = document.getElementById('save-sample-btn');
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        newSaveBtn.addEventListener('click', () => saveSample(false));
    });
    
    // 图片预览
    document.querySelector('[name="image"]').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('image-preview').innerHTML = `<img src="${event.target.result}" class="image-preview-img" style="max-height:100px">`;
            };
            reader.readAsDataURL(file);
        }
    });
    
    // 分页
    document.getElementById('pagination-container').addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (page && page !== currentPage) {
                currentPage = page;
                displayResults();
            }
        }
    });
    
    // 委托事件
    document.addEventListener('click', (e) => {
        const target = e.target.closest('.view-detail');
        if (target) {
            const id = target.dataset.id;
            showDetail(id);
        }
        
        const spectrumTarget = e.target.closest('.view-spectrum');
        if (spectrumTarget) {
            const id = spectrumTarget.dataset.id;
            const rock = rockData.find(r => r.id === id);
            if (rock) loadSpectrumData(rock);
        }
        
        const compareTarget = e.target.closest('.add-compare');
        if (compareTarget) {
            const id = compareTarget.dataset.id;
            addToCompare(id);
        }
        
        const editTarget = e.target.closest('.edit-sample');
        if (editTarget && currentUser?.role === 'admin') {
            const id = editTarget.dataset.id;
            editSample(id);
        }
        
        const deleteTarget = e.target.closest('.delete-sample');
        if (deleteTarget && currentUser?.role === 'admin') {
            const id = deleteTarget.dataset.id;
            deleteSample(id);
        }
    });
}

// 显示提示信息
function showAlert(message, type = 'info') {
    const alertClass = {
        'info': 'alert-info',
        'success': 'alert-success',
        'warning': 'alert-warning',
        'error': 'alert-danger'
    }[type];
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = `top: 80px; right: 20px; z-index: 1050; min-width: 250px; max-width: 300px;`;
    alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
}

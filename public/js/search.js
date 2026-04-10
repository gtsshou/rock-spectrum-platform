// search.js - 筛选和对比功能

function applyFilters() {
    const searchText = document.getElementById('quick-search').value.toLowerCase();
    const rockTypeFilter = document.getElementById('rock-type-filter');
    const locationFilter = document.getElementById('location-filter');
    
    const selectedTypes = Array.from(rockTypeFilter.selectedOptions).map(opt => opt.value).filter(v => v);
    const selectedLocation = locationFilter.value;
    
    filteredData = rockData.filter(rock => {
        const textMatch = !searchText || 
            (rock.lithology && rock.lithology.toLowerCase().includes(searchText)) ||
            (rock.location && rock.location.toLowerCase().includes(searchText)) ||
            (rock.id && rock.id.toLowerCase().includes(searchText));
        const typeMatch = selectedTypes.length === 0 || (rock.rock_type && selectedTypes.includes(rock.rock_type));
        const locationMatch = !selectedLocation || rock.location === selectedLocation;
        return textMatch && typeMatch && locationMatch;
    });
    
    currentPage = 1;
    displayResults();
    updateStats();
}

function resetFilters() {
    const rockTypeFilter = document.getElementById('rock-type-filter');
    const locationFilter = document.getElementById('location-filter');
    const quickSearch = document.getElementById('quick-search');
    const minWave = document.getElementById('min-wave');
    const maxWave = document.getElementById('max-wave');
    
    if (quickSearch) quickSearch.value = '';
    if (rockTypeFilter && rockTypeFilter.multiple) {
        for (let i = 0; i < rockTypeFilter.options.length; i++) {
            rockTypeFilter.options[i].selected = false;
        }
    }
    if (locationFilter) locationFilter.selectedIndex = 0;
    if (minWave) minWave.value = '';
    if (maxWave) maxWave.value = '';
    
    filteredData = [...rockData];
    currentPage = 1;
    displayResults();
    updateStats();
}

function toggleView() {
    const toggleBtn = document.getElementById('toggle-view');
    const listView = document.getElementById('list-view');
    const gridView = document.getElementById('grid-view');
    
    if (toggleBtn.dataset.view === 'list') {
        toggleBtn.dataset.view = 'grid';
        toggleBtn.innerHTML = '<i class="fas fa-th"></i> 网格视图';
        listView.style.display = 'none';
        gridView.style.display = 'block';
    } else {
        toggleBtn.dataset.view = 'list';
        toggleBtn.innerHTML = '<i class="fas fa-list"></i> 列表视图';
        listView.style.display = 'block';
        gridView.style.display = 'none';
    }
    displayResults();
}

function showDetail(rockId) {
    const rock = rockData.find(r => r.id === rockId);
    if (!rock) return;
    
    document.getElementById('modal-title').textContent = `${rock.id} - ${rock.rock_type || '未知岩性'}`;
    
    const detailHtml = `
        <div class="row">
            <div class="col-md-6">
                <div class="text-center mb-3">
                    <img src="/images/rocks/${rock.image || 'default.jpg'}" class="img-fluid rounded" style="max-height: 300px;" onerror="this.src='/images/rocks/default.jpg'">
                </div>
                <div class="card mb-3">
                    <div class="card-header">样本信息</div>
                    <div class="card-body">
                        <table class="table table-sm">
                            <tr><th>岩性:</th><td><span class="badge" style="background-color: ${getRockTypeColor(rock.rock_type)}; color: white;">${rock.rock_type || '未知'}</span></td></tr>
                            <tr><th>具体岩性:</th><td>${rock.lithology || '未知'}</td></tr>
                            <tr><th>位置:</th><td>${rock.location || '未知'}</td></tr>
                            <tr><th>坐标:</th><td>${rock.coordinates || '未知'}</td></tr>
                            <tr><th>时代:</th><td>${rock.formation_age || '未知'}</td></tr>
                            <tr><th>采集人:</th><td>${rock.collector || '未知'}</td></tr>
                            <tr><th>采集日期:</th><td>${rock.collection_date || '未知'}</td></tr>
                        </table>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">光谱信息</div>
                    <div class="card-body">
                        ${rock.spectrum ? 
                            `<p><i class="fas fa-check text-success"></i> 有光谱数据</p>
                             <button class="btn btn-primary w-100 mb-2" onclick="loadSpectrumData(${JSON.stringify(rock).replace(/"/g, '&quot;')})">
                                 <i class="fas fa-chart-line"></i> 查看光谱
                             </button>
                             <button class="btn btn-info w-100" onclick="addToCompare('${rock.id}')">
                                 <i class="fas fa-plus"></i> 添加到对比
                             </button>` : 
                            '<p class="text-muted"><i class="fas fa-times text-danger"></i> 无光谱数据</p>'}
                    </div>
                </div>
                ${rock.description ? `<div class="card mt-3"><div class="card-header">描述</div><div class="card-body"><p>${rock.description}</p></div></div>` : ''}
                ${rock.mineral_composition ? `<div class="card mt-3"><div class="card-header">矿物组成</div><div class="card-body"><p>${rock.mineral_composition}</p></div></div>` : ''}
            </div>
        </div>
    `;
    
    document.getElementById('modal-body').innerHTML = detailHtml;
    
    // 显示管理员操作按钮
    const adminActionsDiv = document.getElementById('detail-admin-actions');
    if (currentUser?.role === 'admin') {
        adminActionsDiv.style.display = 'block';
        document.getElementById('detail-edit-btn').onclick = () => {
            bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
            editSample(rock.id);
        };
        document.getElementById('detail-delete-btn').onclick = () => {
            bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
            deleteSample(rock.id);
        };
    } else {
        adminActionsDiv.style.display = 'none';
    }
    
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

function addToCompare(rockId) {
    const rock = rockData.find(r => r.id === rockId);
    if (!rock) return;
    if (compareList.includes(rockId)) {
        showAlert('该样本已在对比列表中', 'warning');
        return;
    }
    if (!rock.spectrum) {
        showAlert('该样本没有光谱数据，无法对比', 'warning');
        return;
    }
    compareList.push(rockId);
    updateCompareList();
    document.getElementById('compare-btn').disabled = false;
    showAlert(`已添加 ${rock.id} 到对比列表`, 'success');
}

function updateCompareList() {
    const container = document.getElementById('compare-list');
    if (compareList.length === 0) {
        container.innerHTML = '<p class="text-muted small">点击样本的"对比"按钮添加</p>';
        return;
    }
    let html = '';
    compareList.forEach(rockId => {
        const rock = rockData.find(r => r.id === rockId);
        if (rock) {
            html += `<div class="compare-item"><span class="small">${rock.id}</span><button class="btn btn-sm btn-outline-danger" onclick="removeFromCompare('${rockId}')"><i class="fas fa-times"></i></button></div>`;
        }
    });
    container.innerHTML = html;
}

function removeFromCompare(rockId) {
    compareList = compareList.filter(id => id !== rockId);
    updateCompareList();
    if (compareList.length === 0) document.getElementById('compare-btn').disabled = true;
}
// 后台管理逻辑
let allData = [];
let charts = {};
let parsedCSVData = null;

// ===== 认证 =====
const ADMIN_PWD = 'paopao2025'; // 简单密码保护

function checkAuth() {
  const pwd = document.getElementById('authPassword').value;
  if (pwd === ADMIN_PWD) {
    sessionStorage.setItem('admin_auth', '1');
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('dashboard').classList.add('show');
    loadData();
  } else {
    document.getElementById('authError').style.display = 'block';
    document.getElementById('authPassword').value = '';
  }
}

// 自动登录
if (sessionStorage.getItem('admin_auth') === '1') {
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('dashboard').classList.add('show');
  loadData();
}

// ===== 加载数据 =====
async function loadData() {
  const sb = initSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from('survey_responses').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      allData = data || [];
    } catch (e) {
      console.error('Load error:', e);
      showToast('加载数据失败: ' + e.message);
      // Fallback to localStorage
      allData = JSON.parse(localStorage.getItem('survey_responses') || '[]');
    }
  } else {
    allData = JSON.parse(localStorage.getItem('survey_responses') || '[]');
  }

  updateStats();
  renderCharts();
  renderTable();
}

// ===== Tab 切换 =====
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
}

// ===== 统计卡片 =====
function updateStats() {
  document.getElementById('statTotal').textContent = allData.length;
  document.getElementById('statSurvey').textContent = allData.filter(d => d.source === 'survey').length;
  document.getElementById('statImport').textContent = allData.filter(d => d.source === 'csv_import').length;
  const maleCount = allData.filter(d => d.gender === '男').length;
  const total = allData.filter(d => d.gender).length;
  document.getElementById('statMale').textContent = total > 0 ? Math.round(maleCount / total * 100) + '%' : '-';
}

// ===== 图表 =====
const COLORS = ['#0071e3','#34c759','#ff9500','#ff3b30','#af52de','#5856d6','#007aff','#30b0c7','#ff2d55','#a2845e','#8e8e93','#64d2ff'];

function countField(field, split) {
  const counts = {};
  allData.forEach(d => {
    let val = d[field];
    if (!val || val === '') return;
    if (split) {
      val.split(/[,，、]/).forEach(v => {
        v = v.trim();
        if (v) counts[v] = (counts[v] || 0) + 1;
      });
    } else {
      val = val.trim();
      counts[val] = (counts[val] || 0) + 1;
    }
  });
  // 排序
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function makeChart(canvasId, type, field, options = {}) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  if (charts[canvasId]) charts[canvasId].destroy();

  const entries = countField(field, options.split);
  const limited = options.limit ? entries.slice(0, options.limit) : entries;
  const labels = limited.map(e => e[0]);
  const data = limited.map(e => e[1]);

  const config = {
    type: type,
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: COLORS.slice(0, data.length),
        borderWidth: type === 'bar' ? 0 : 2,
        borderColor: '#fff',
        borderRadius: type === 'bar' ? 6 : 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: ['pie', 'doughnut'].includes(type),
          position: 'bottom',
          labels: { font: { size: 11 }, padding: 12 }
        }
      },
      scales: ['bar'].includes(type) ? {
        y: { beginAtZero: true, grid: { display: false } },
        x: { grid: { display: false } }
      } : undefined
    }
  };

  // 横向柱状图
  if (type === 'bar' && options.horizontal) {
    config.options.indexAxis = 'y';
    config.options.scales = {
      x: { beginAtZero: true, grid: { display: false } },
      y: { grid: { display: false } }
    };
  }

  charts[canvasId] = new Chart(ctx, config);
}

function renderCharts() {
  makeChart('chartGender', 'pie', 'gender');
  makeChart('chartAge', 'bar', 'age_range');
  makeChart('chartCarType', 'doughnut', 'car_type', { split: true });
  makeChart('chartFrequency', 'bar', 'wash_frequency', { horizontal: true });
  makeChart('chartPrice', 'bar', 'single_wash_price', { split: true });
  makeChart('chartPriority', 'pie', 'first_priority', { split: true });
  makeChart('chartDissatisfaction', 'bar', 'dissatisfaction', { split: true, horizontal: true });
  makeChart('chartChannel', 'bar', 'how_first_know_shop', { split: true, horizontal: true });
  makeChart('chartSatisfaction', 'doughnut', 'supplier_attitude');
  makeChart('chartBrand', 'bar', 'brand', { split: true, limit: 10 });
}

// ===== 数据表格 =====
function renderTable(filter) {
  const tbody = document.getElementById('tableBody');
  let data = allData;

  if (filter) {
    const kw = filter.toLowerCase();
    data = data.filter(d =>
      (d.name || '').toLowerCase().includes(kw) ||
      (d.brand || '').toLowerCase().includes(kw) ||
      (d.region || '').toLowerCase().includes(kw) ||
      (d.occupation || '').toLowerCase().includes(kw)
    );
  }

  tbody.innerHTML = data.map((d, i) => `
    <tr onclick="showDetail(${allData.indexOf(d)})">
      <td>${d.name || '-'}</td>
      <td>${d.source === 'survey' ? '📋问卷' : d.source === 'csv_import' ? '📥导入' : '-'}</td>
      <td>${d.gender || '-'}</td>
      <td>${d.age || d.age_range || '-'}</td>
      <td>${d.car_type || '-'}</td>
      <td>${d.brand || '-'}</td>
      <td>${d.wash_frequency || '-'}</td>
      <td>${d.first_priority || '-'}</td>
      <td>${d.supplier_attitude || '-'}</td>
      <td>${d.single_wash_price || '-'}</td>
      <td>${d.region || '-'}</td>
    </tr>
  `).join('');
}

function filterTable() {
  renderTable(document.getElementById('searchInput').value.trim());
}

// ===== 详情侧边栏 =====
const DETAIL_SECTIONS = [
  { title: '基本信息', fields: [
    ['name', '姓名'], ['gender', '性别'], ['age', '年龄'], ['age_range', '年龄段'],
    ['driving_years', '驾龄'], ['car_age', '车龄'], ['car_type', '车类型'],
    ['brand', '品牌'], ['occupation', '职业'], ['family_info', '家庭'], ['region', '区域']
  ]},
  { title: '用户分类', fields: [
    ['user_category', '用户分类'], ['psm', 'PSM'], ['source', '数据来源'], ['interview_link', '访谈链接']
  ]},
  { title: '洗车习惯', fields: [
    ['first_reaction_dirty', '脏了第一反应'], ['dirty_description', '脏的描述'],
    ['wash_time_period', '洗车时间段'], ['trigger_scenario', '触发场景'],
    ['wash_frequency', '洗车频次'], ['recent_wash_description', '最近一次洗车']
  ]},
  { title: '信息与决策', fields: [
    ['how_first_learn', '了解洗车店渠道'], ['how_first_know_shop', '知道洗车店途径'],
    ['check_weather_before', '看天气预报'], ['weather_impact', '天气影响'],
    ['queue_habit', '排队习惯'], ['inhibit_scenario', '抑制场景']
  ]},
  { title: '偏好与满意度', fields: [
    ['has_fixed_shop', '固定洗车店'], ['fixed_shop_brand', '常去品牌'],
    ['supplier_attitude', '满意度'], ['dissatisfaction', '不满意的地方'],
    ['first_priority', '首要因素'], ['can_distinguish_quality', '区分清洁质量'],
    ['other_criteria', '其他筛选维度'], ['how_to_select', '如何筛选']
  ]},
  { title: '价格与服务', fields: [
    ['single_wash_price', '单次价格'], ['wash_project', '洗车项目']
  ]},
  { title: '其他', fields: [
    ['attitude_judgment', '态度判断'], ['notes', '备注'], ['parent_record', '父记录']
  ]}
];

function showDetail(index) {
  const d = allData[index];
  document.getElementById('detailTitle').textContent = d.name || '详情';

  let html = '';
  DETAIL_SECTIONS.forEach(section => {
    const rows = section.fields
      .filter(([key]) => d[key])
      .map(([key, label]) => `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${d[key]}</span></div>`)
      .join('');
    if (rows) {
      html += `<div class="detail-section"><div class="detail-section-title">${section.title}</div>${rows}</div>`;
    }
  });

  document.getElementById('detailBody').innerHTML = html;
  document.getElementById('detailOverlay').classList.add('show');
  document.getElementById('detailModal').classList.add('show');
}

function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('show');
  document.getElementById('detailModal').classList.remove('show');
}

// ===== CSV 导出 =====
function exportCSV() {
  if (allData.length === 0) { showToast('没有数据可导出'); return; }
  const headers = Object.keys(allData[0]);
  const csv = [
    headers.join(','),
    ...allData.map(d => headers.map(h => {
      let val = d[h] || '';
      val = String(val).replace(/"/g, '""');
      return val.includes(',') || val.includes('"') || val.includes('\n') ? `"${val}"` : val;
    }).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '泡泡星球调研数据_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ===== CSV 导入 =====
// 拖拽支持
const dropZone = document.getElementById('importDrop');
if (dropZone) {
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = '#0071e3'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#ddd'; });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '#ddd';
    if (e.dataTransfer.files.length) handleCSVFile(e.dataTransfer.files[0]);
  });
}

function handleCSVFile(file) {
  if (!file) return;
  if (!file.name.endsWith('.csv')) { showToast('请选择 CSV 文件'); return; }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      parsedCSVData = results.data.filter(row => {
        // 过滤空行
        const values = Object.values(row).filter(v => v && v.trim());
        return values.length > 3;
      });

      const preview = document.getElementById('importPreview');
      preview.classList.add('show');
      document.getElementById('importStats').textContent =
        `解析完成：${parsedCSVData.length} 条有效记录，${results.meta.fields.length} 个字段`;

      // 显示字段映射预览
      const mappedCount = results.meta.fields.filter(f => CSV_TO_DB_MAP[f]).length;
      document.getElementById('importLog').innerHTML =
        `<div>✅ 已匹配 ${mappedCount}/${results.meta.fields.length} 个字段</div>` +
        results.meta.fields.map(f =>
          CSV_TO_DB_MAP[f]
            ? `<div style="color:#34c759">✔ ${f} → ${CSV_TO_DB_MAP[f]}</div>`
            : `<div style="color:#ff9500">⚠ ${f} (未匹配，将跳过)</div>`
        ).join('');
    },
    error: function(err) {
      showToast('CSV 解析失败: ' + err.message);
    }
  });
}

async function doImport() {
  if (!parsedCSVData || parsedCSVData.length === 0) { showToast('没有数据可导入'); return; }

  const btn = document.getElementById('importBtn');
  btn.textContent = '导入中...';
  btn.disabled = true;

  const progressBar = document.getElementById('importProgressBar');
  const log = document.getElementById('importLog');

  // 映射数据
  const mappedRows = parsedCSVData.map(row => {
    const mapped = { source: 'csv_import' };
    Object.entries(row).forEach(([csvKey, val]) => {
      const dbKey = CSV_TO_DB_MAP[csvKey];
      if (dbKey && val && val.trim()) {
        if (dbKey === 'age') {
          mapped[dbKey] = parseInt(val) || null;
        } else {
          mapped[dbKey] = val.trim();
        }
      }
    });
    return mapped;
  });

  const sb = initSupabase();
  if (sb) {
    // 批量导入（每批 50 条）
    const batchSize = 50;
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < mappedRows.length; i += batchSize) {
      const batch = mappedRows.slice(i, i + batchSize);
      try {
        const { error } = await sb.from('survey_responses').insert(batch);
        if (error) {
          console.error('Batch insert error:', error);
          failed += batch.length;
          log.innerHTML += `<div style="color:#ff3b30">❌ 批次 ${Math.floor(i/batchSize)+1} 失败: ${error.message}</div>`;
        } else {
          imported += batch.length;
        }
      } catch (e) {
        failed += batch.length;
        log.innerHTML += `<div style="color:#ff3b30">❌ 网络错误: ${e.message}</div>`;
      }
      progressBar.style.width = Math.round((i + batch.length) / mappedRows.length * 100) + '%';
    }

    log.innerHTML += `<div style="color:#34c759;font-weight:600;margin-top:8px">✅ 导入完成：成功 ${imported} 条，失败 ${failed} 条</div>`;
  } else {
    // localStorage fallback
    const existing = JSON.parse(localStorage.getItem('survey_responses') || '[]');
    mappedRows.forEach(row => {
      row.id = Date.now().toString() + Math.random().toString(36).slice(2);
      row.created_at = new Date().toISOString();
    });
    localStorage.setItem('survey_responses', JSON.stringify([...existing, ...mappedRows]));
    progressBar.style.width = '100%';
    log.innerHTML += `<div style="color:#34c759;font-weight:600;margin-top:8px">✅ 已导入 ${mappedRows.length} 条到本地存储</div>`;
  }

  btn.textContent = '导入完成 ✓';
  setTimeout(() => {
    btn.textContent = '确认导入';
    btn.disabled = false;
    loadData(); // 刷新数据
  }, 2000);
}

// ===== Toast =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

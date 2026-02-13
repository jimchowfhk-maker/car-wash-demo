// 泡泡星球 - 排队预约系统

// ===== 全局状态 =====
let sb = null;
let currentUser = null; // { id, username }
let selectedProduct = null;
let selectedIndex = null;
let queueEntryId = null;
let countdownTimer = null;
let simulationTimer = null;
let realtimeSubscription = null;

// 产品数据（与 index.html 一致）
const products = [
  {
    name: '认真洗洗',
    subtitle: '脏的不行，认真洗洗',
    price: 48,
    originalPrice: 60,
    duration: 8,
    tag: '推荐',
    services: [
      '清除全车表层大面积脏污及树胶、鸟屎、虫尸等顽固污渍',
      '轮胎清洗',
      '全车极致干燥无残水'
    ]
  },
  {
    name: '快速冲冲',
    subtitle: '刚好有空，快速冲冲',
    price: 40,
    originalPrice: null,
    duration: 4,
    tag: '',
    services: [
      '清除全车表层大面积脏污',
      '轮胎清洗',
      '全车重点区域仿形风干'
    ]
  },
  {
    name: '亮亮洗洗',
    subtitle: '增护漆 亮亮洗洗',
    price: 80,
    originalPrice: null,
    duration: 12,
    tag: '',
    services: [
      '清除全车表层大面积脏污及树胶、鸟屎、虫尸等顽固污渍',
      '轮胎清洗',
      '全车极致干燥无残水',
      '漆面增亮 Pro'
    ]
  }
];

// 头像颜色池
const AVATAR_COLORS = [
  '#0071e3', '#34c759', '#ff9500', '#ff3b30', '#af52de',
  '#5856d6', '#007aff', '#30b0c7', '#ff2d55', '#a2845e',
  '#5ac8fa', '#ffcc00', '#4cd964', '#ff6482', '#8e8e93'
];

// 根据用户名生成固定颜色
function getUserColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// 获取用户名首字（用于头像显示）
function getUserInitial(name) {
  if (!name) return '?';
  return name.charAt(0);
}

// 生成头像HTML
function avatarHtml(name, size) {
  const color = getUserColor(name);
  const initial = getUserInitial(name);
  const s = size || 32;
  return `<div class="queue-item-avatar" style="width:${s}px;height:${s}px;background:${color};font-size:${Math.round(s*0.44)}px">${initial}</div>`;
}

// 模拟用户名池
const FAKE_NAMES = [
  '李明', '王芳', '张伟', '刘洋', '陈静', '杨磊', '赵敏', '黄强',
  '周杰', '吴婷', '郑浩', '孙丽', '马超', '朱红', '胡鹏', '林雪',
  '何勇', '高飞', '罗霞', '谢涛', '韩冰', '唐亮', '冯雨', '董燕',
  '程辉', '曹凯', '彭媛', '邓刚', '许欣', '傅峰'
];

// ===== 初始化 =====
function init() {
  sb = initSupabase();

  // 检查登录状态
  const savedUser = sessionStorage.getItem('queue_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showScreen('products');
    } catch (e) {
      sessionStorage.removeItem('queue_user');
    }
  }
}

// ===== Screen 管理 =====
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + name);
  if (target) target.classList.add('active');

  // 进入各 screen 时的初始化
  if (name === 'products') {
    renderProducts();
    if (currentUser) {
      document.getElementById('userBadge').textContent = currentUser.username;
      // 设置用户头像
      const avatarEl = document.getElementById('userAvatar');
      avatarEl.style.background = getUserColor(currentUser.username);
      avatarEl.textContent = getUserInitial(currentUser.username);
    }
    // 检查是否有正在排队的记录，显示入口横幅
    checkActiveQueue();
  }
  if (name === 'confirm') {
    loadQueueCount();
  }
  if (name === 'progress') {
    loadQueueAndSubscribe();
  }
}

// ===== Auth 模块 =====
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function doRegister() {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;

  if (!username || username.length < 2) {
    showAuthError('用户名至少2个字符');
    return;
  }
  if (!password || password.length < 4) {
    showAuthError('密码至少4位');
    return;
  }

  if (!sb) {
    showAuthError('数据库未连接，请检查配置');
    return;
  }

  try {
    const passwordHash = await hashPassword(password);

    // 检查用户名是否已存在
    const { data: existing } = await sb.from('queue_users').select('id').eq('username', username).single();
    if (existing) {
      showAuthError('用户名已被注册');
      return;
    }

    // 注册
    const displayName = username;
    const { data, error } = await sb.from('queue_users').insert([{
      username: username,
      password_hash: passwordHash,
      display_name: displayName
    }]).select().single();

    if (error) {
      console.error('Register error:', error);
      showAuthError('注册失败：' + error.message);
      return;
    }

    currentUser = { id: data.id, username: data.username };
    sessionStorage.setItem('queue_user', JSON.stringify(currentUser));
    showToast('注册成功！');
    showScreen('products');
  } catch (e) {
    console.error('Register error:', e);
    showAuthError('注册失败，请重试');
  }
}

async function doLogin() {
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;

  if (!username || !password) {
    showAuthError('请输入用户名和密码');
    return;
  }

  if (!sb) {
    showAuthError('数据库未连接，请检查配置');
    return;
  }

  try {
    const passwordHash = await hashPassword(password);

    const { data, error } = await sb.from('queue_users')
      .select('id, username')
      .eq('username', username)
      .eq('password_hash', passwordHash)
      .single();

    if (error || !data) {
      showAuthError('用户名或密码错误');
      return;
    }

    currentUser = { id: data.id, username: data.username };
    sessionStorage.setItem('queue_user', JSON.stringify(currentUser));
    showToast('登录成功！');
    showScreen('products');
  } catch (e) {
    console.error('Login error:', e);
    showAuthError('登录失败，请重试');
  }
}

function doLogout() {
  sessionStorage.removeItem('queue_user');
  currentUser = null;
  selectedProduct = null;
  selectedIndex = null;
  cleanupTimers();
  showScreen('auth');
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ===== 产品选择模块 =====
function renderProducts() {
  const list = document.getElementById('productList');
  let html = '';

  products.forEach((p, i) => {
    const isSelected = selectedIndex === i;
    html += `
      <div class="q-product-card ${isSelected ? 'selected' : ''}" onclick="selectProduct(${i})">
        ${isSelected ? '<div class="q-check-icon">✓</div>' : ''}
        <div class="q-card-top">
          <div>
            <div class="q-product-name">${p.name}${p.tag ? `<span class="q-tag">${p.tag}</span>` : ''}</div>
            <div class="q-product-subtitle">${p.subtitle}</div>
            <div class="q-product-duration">⏱ ${p.duration}min</div>
          </div>
          <div class="q-card-price">
            ${p.originalPrice ? `<span class="q-price-original">${p.originalPrice}元</span>` : ''}
            <span class="q-price-current">${p.price}</span>
            <span class="q-price-unit">元</span>
          </div>
        </div>
        <div class="q-service-list">
          ${p.services.map(s => `<div class="q-service-item"><span class="q-service-icon">✔</span><span>${s}</span></div>`).join('')}
        </div>
      </div>
    `;
  });

  list.innerHTML = html;
}

function selectProduct(index) {
  selectedIndex = index;
  selectedProduct = products[index];
  renderProducts();

  document.getElementById('summaryLabel').textContent = '已选：' + selectedProduct.name;
  document.getElementById('summaryPrice').textContent = '¥' + selectedProduct.price;
  document.getElementById('summaryPrice').style.display = 'block';
  document.getElementById('submitBtn').classList.remove('btn-disabled');
}

function goToConfirm() {
  if (!selectedProduct) {
    showToast('请先选择套餐');
    return;
  }

  document.getElementById('confirmProduct').textContent = selectedProduct.name;
  document.getElementById('confirmPrice').textContent = '¥' + selectedProduct.price;
  document.getElementById('confirmDuration').textContent = selectedProduct.duration + ' 分钟';
  showScreen('confirm');
}

// ===== 排队确认模块 =====
async function loadQueueCount() {
  if (!sb) return;

  try {
    const { data, error } = await sb.from('queue_entries')
      .select('id, product_duration, status, started_at')
      .in('status', ['waiting', 'serving'])
      .order('created_at', { ascending: true });

    if (error) throw error;

    const waitingCount = (data || []).filter(d => d.status === 'waiting').length;
    const servingEntry = (data || []).find(d => d.status === 'serving');

    document.getElementById('confirmQueueCount').textContent = waitingCount + ' 人';

    // 计算预计等待时间
    let totalWaitMinutes = 0;

    // 当前服务中的剩余时间
    if (servingEntry && servingEntry.started_at) {
      const elapsed = (Date.now() - new Date(servingEntry.started_at).getTime()) / 1000;
      // 加速模式下：1秒 = 1分钟
      const elapsedMinutes = elapsed; // 在加速模式下直接用秒数当分钟
      const remaining = Math.max(0, servingEntry.product_duration - elapsedMinutes);
      totalWaitMinutes += remaining;
    }

    // 排队中的每人用时
    (data || []).filter(d => d.status === 'waiting').forEach(d => {
      totalWaitMinutes += d.product_duration;
    });

    // 加上自己的服务时间
    totalWaitMinutes += selectedProduct.duration;

    if (totalWaitMinutes >= 60) {
      const h = Math.floor(totalWaitMinutes / 60);
      const m = Math.round(totalWaitMinutes % 60);
      document.getElementById('confirmWaitTime').textContent = h + ' 小时' + (m > 0 ? ' ' + m + ' 分钟' : '');
    } else {
      document.getElementById('confirmWaitTime').textContent = '约 ' + Math.round(totalWaitMinutes) + ' 分钟';
    }
  } catch (e) {
    console.error('Load queue count error:', e);
    document.getElementById('confirmQueueCount').textContent = '- 人';
    document.getElementById('confirmWaitTime').textContent = '计算中...';
  }
}

// ===== 加入排队 =====
async function joinQueue() {
  if (!sb || !currentUser || !selectedProduct) return;

  const btn = document.getElementById('confirmBtn');
  btn.textContent = '排队中...';
  btn.disabled = true;

  try {
    // 先清理该用户之前的 waiting/serving 记录
    await sb.from('queue_entries')
      .update({ status: 'cancelled' })
      .eq('user_id', currentUser.id)
      .in('status', ['waiting', 'serving']);

    // 获取当前最大 position
    const { data: maxPos } = await sb.from('queue_entries')
      .select('position')
      .in('status', ['waiting', 'serving'])
      .order('position', { ascending: false })
      .limit(1);

    const nextPos = (maxPos && maxPos.length > 0 && maxPos[0].position) ? maxPos[0].position + 1 : 1;

    // 生成模拟用户（在用户前面）
    await generateFakeUsers(nextPos);

    // 插入真实用户
    const { data: realPosData } = await sb.from('queue_entries')
      .select('position')
      .in('status', ['waiting', 'serving'])
      .order('position', { ascending: false })
      .limit(1);

    const realPos = (realPosData && realPosData.length > 0 && realPosData[0].position) ? realPosData[0].position + 1 : 1;

    const { data, error } = await sb.from('queue_entries').insert([{
      user_id: currentUser.id,
      username: currentUser.username,
      product_name: selectedProduct.name,
      product_price: selectedProduct.price,
      product_duration: selectedProduct.duration,
      status: 'waiting',
      position: realPos
    }]).select().single();

    if (error) throw error;

    queueEntryId = data.id;

    // 确保有"服务中"的用户，如果没有则让第一个 waiting 变为 serving
    await ensureServingEntry();

    // 开始模拟推进
    startSimulation();

    showScreen('progress');
  } catch (e) {
    console.error('Join queue error:', e);
    showToast('排队失败，请重试');
  } finally {
    btn.textContent = '确认排队';
    btn.disabled = false;
  }
}

// ===== 模拟用户生成 =====
async function generateFakeUsers(startPos) {
  if (!sb) return;

  const fakeCount = Math.floor(Math.random() * 3) + 2; // 2-4 个模拟用户
  const usedNames = new Set();
  const fakeEntries = [];

  for (let i = 0; i < fakeCount; i++) {
    // 随机选一个不重复的名字
    let name;
    do {
      name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    } while (usedNames.has(name));
    usedNames.add(name);

    // 随机选产品
    const product = products[Math.floor(Math.random() * products.length)];

    fakeEntries.push({
      user_id: null,
      username: name,
      product_name: product.name,
      product_price: product.price,
      product_duration: product.duration,
      status: 'waiting',
      position: startPos + i
    });
  }

  try {
    await sb.from('queue_entries').insert(fakeEntries);
  } catch (e) {
    console.error('Generate fake users error:', e);
  }
}

// ===== 确保有服务中的条目 =====
async function ensureServingEntry() {
  if (!sb) return;

  const { data: serving } = await sb.from('queue_entries')
    .select('id')
    .eq('status', 'serving')
    .limit(1);

  if (!serving || serving.length === 0) {
    // 找到第一个 waiting 的
    const { data: first } = await sb.from('queue_entries')
      .select('id')
      .eq('status', 'waiting')
      .order('position', { ascending: true })
      .limit(1);

    if (first && first.length > 0) {
      await sb.from('queue_entries')
        .update({ status: 'serving', started_at: new Date().toISOString() })
        .eq('id', first[0].id);
    }
  }
}

// ===== 模拟推进 =====
function startSimulation() {
  if (simulationTimer) clearInterval(simulationTimer);

  // 加速模式：每秒检查一次，1秒 ≈ 1分钟
  simulationTimer = setInterval(async () => {
    if (!sb) return;

    try {
      // 找到当前服务中的
      const { data: serving } = await sb.from('queue_entries')
        .select('*')
        .eq('status', 'serving')
        .limit(1)
        .single();

      if (!serving) {
        // 没有服务中的，找下一个 waiting
        await ensureServingEntry();
        return;
      }

      // 检查是否服务完成（加速模式：duration 秒 = duration 分钟）
      const elapsed = (Date.now() - new Date(serving.started_at).getTime()) / 1000;
      if (elapsed >= serving.product_duration) {
        // 完成服务
        await sb.from('queue_entries')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', serving.id)
          .eq('status', 'serving');

        // 如果完成的是当前用户，显示提示
        if (serving.id === queueEntryId) {
          showServiceComplete();
          stopSimulation();
          return;
        }

        // 下一个开始服务
        await ensureServingEntry();
      }
    } catch (e) {
      console.error('Simulation error:', e);
    }
  }, 1000);
}

function stopSimulation() {
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
}

// ===== 排队进度加载 + Realtime =====
async function loadQueueAndSubscribe() {
  await loadQueueList();
  startCountdown();
  subscribeRealtime();
}

async function loadQueueList() {
  if (!sb) return;

  try {
    const { data, error } = await sb.from('queue_entries')
      .select('*')
      .in('status', ['waiting', 'serving', 'completed'])
      .order('position', { ascending: true });

    if (error) throw error;

    renderQueueList(data || []);
    updateMyPosition(data || []);
    updateCountdown(data || []);
  } catch (e) {
    console.error('Load queue list error:', e);
  }
}

function renderQueueList(entries) {
  const list = document.getElementById('queueList');
  if (!entries || entries.length === 0) {
    list.innerHTML = '<div class="queue-loading">暂无排队信息</div>';
    return;
  }

  // 只显示 waiting 和 serving 的，completed 的显示最近3个
  const active = entries.filter(e => e.status === 'waiting' || e.status === 'serving');
  const completed = entries.filter(e => e.status === 'completed').slice(-2);
  const display = [...completed, ...active];

  let posCounter = 1;
  let html = '';

  display.forEach(entry => {
    const isMe = entry.id === queueEntryId;
    const isServing = entry.status === 'serving';
    const isCompleted = entry.status === 'completed';

    // 用户名脱敏
    let displayName = maskUsername(entry.username);
    if (isMe) displayName = entry.username;

    // 状态标签
    let statusHtml = '';
    let statusClass = '';
    if (isServing) {
      statusHtml = '服务中';
      statusClass = 'status-serving';
    } else if (isCompleted) {
      statusHtml = '已完成';
      statusClass = 'status-completed';
    } else {
      statusHtml = '排队中';
      statusClass = 'status-waiting';
    }

    // 预计时间
    let timeText = entry.product_duration + 'min';

    html += `
      <div class="queue-item ${isMe ? 'is-me' : ''} ${isServing ? 'is-serving' : ''} ${isCompleted ? 'completed' : ''}">
        ${avatarHtml(entry.username, 32)}
        <div class="queue-item-info">
          <div class="queue-item-name">
            ${displayName}
            ${isMe ? '<span class="me-tag">我</span>' : ''}
          </div>
          <div class="queue-item-detail">
            <span>${entry.product_name}</span>
            <span>·</span>
            <span>¥${entry.product_price}</span>
          </div>
        </div>
        <div class="queue-item-right">
          <div class="queue-item-time">${timeText}</div>
          <div class="queue-item-status ${statusClass}">${statusHtml}</div>
        </div>
      </div>
    `;

    if (!isCompleted) posCounter++;
  });

  list.innerHTML = html;
}

function maskUsername(name) {
  if (!name) return '***';
  if (name.length <= 1) return name + '**';
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

function updateMyPosition(entries) {
  const active = entries.filter(e => e.status === 'waiting' || e.status === 'serving');
  const myIndex = active.findIndex(e => e.id === queueEntryId);

  if (myIndex === -1) {
    document.getElementById('progressPosition').textContent = '排队信息加载中...';
    return;
  }

  // 我前面有多少人
  const beforeMe = active.slice(0, myIndex).filter(e => e.status === 'waiting' || e.status === 'serving').length;
  const myEntry = active[myIndex];

  if (myEntry.status === 'serving') {
    document.getElementById('progressPosition').textContent = '正在为您服务';
  } else if (beforeMe === 0) {
    document.getElementById('progressPosition').textContent = '您是下一位';
  } else {
    document.getElementById('progressPosition').textContent = '前面有 ' + beforeMe + ' 人';
  }
}

// ===== 倒计时 =====
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);

  countdownTimer = setInterval(async () => {
    await loadQueueList();
  }, 2000); // 每2秒刷新一次
}

function updateCountdown(entries) {
  const active = entries.filter(e => e.status === 'waiting' || e.status === 'serving');
  const myIndex = active.findIndex(e => e.id === queueEntryId);

  if (myIndex === -1) {
    document.getElementById('countdownTime').textContent = '--:--';
    document.getElementById('countdownSub').textContent = '排队信息加载中';
    return;
  }

  const myEntry = active[myIndex];

  if (myEntry.status === 'serving') {
    // 正在服务中，显示剩余服务时间
    const elapsed = (Date.now() - new Date(myEntry.started_at).getTime()) / 1000;
    const remaining = Math.max(0, myEntry.product_duration - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);

    document.getElementById('countdownTime').textContent =
      String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    document.getElementById('countdownSub').textContent = '正在为您服务';
    document.querySelector('.countdown-card').classList.add('countdown-serving');
    return;
  }

  document.querySelector('.countdown-card').classList.remove('countdown-serving');

  // 计算等待时间
  let waitSeconds = 0;

  // 当前服务中的剩余时间
  const servingEntry = active.find(e => e.status === 'serving');
  if (servingEntry && servingEntry.started_at) {
    const elapsed = (Date.now() - new Date(servingEntry.started_at).getTime()) / 1000;
    waitSeconds += Math.max(0, servingEntry.product_duration - elapsed);
  }

  // 我前面排队的人的总服务时间（加速模式：duration 秒）
  const beforeMe = active.slice(0, myIndex).filter(e => e.status === 'waiting');
  beforeMe.forEach(e => {
    waitSeconds += e.product_duration;
  });

  const mins = Math.floor(waitSeconds / 60);
  const secs = Math.floor(waitSeconds % 60);

  document.getElementById('countdownTime').textContent =
    String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  document.getElementById('countdownSub').textContent = '预计等待时间（演示加速模式）';
}

// ===== Supabase Realtime =====
function subscribeRealtime() {
  if (!sb || realtimeSubscription) return;

  try {
    realtimeSubscription = sb
      .channel('queue-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'queue_entries'
      }, (payload) => {
        // 收到变更时刷新列表
        loadQueueList();
      })
      .subscribe();
  } catch (e) {
    console.error('Realtime subscribe error:', e);
  }
}

// ===== 取消排队 =====
async function cancelQueue() {
  if (!sb || !queueEntryId) {
    showScreen('products');
    return;
  }

  try {
    await sb.from('queue_entries')
      .update({ status: 'cancelled' })
      .eq('id', queueEntryId);

    showToast('已取消排队');
  } catch (e) {
    console.error('Cancel error:', e);
  }

  cleanupTimers();
  queueEntryId = null;
  showScreen('products');
}

// ===== 服务完成 =====
function showServiceComplete() {
  document.getElementById('serviceComplete').classList.add('show');
}

function finishAndReturn() {
  document.getElementById('serviceComplete').classList.remove('show');
  cleanupTimers();
  queueEntryId = null;
  selectedProduct = null;
  selectedIndex = null;
  showScreen('products');

  // 重置底部栏
  document.getElementById('summaryLabel').textContent = '请选择洗车套餐';
  document.getElementById('summaryPrice').style.display = 'none';
  document.getElementById('submitBtn').classList.add('btn-disabled');
}

// ===== 清理 =====
function cleanupTimers() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  if (simulationTimer) { clearInterval(simulationTimer); simulationTimer = null; }
  if (realtimeSubscription) {
    try { sb.removeChannel(realtimeSubscription); } catch(e) {}
    realtimeSubscription = null;
  }
}

// ===== 检查活跃排队（产品页入口横幅）=====
async function checkActiveQueue() {
  const banner = document.getElementById('queueEntryBanner');
  if (!sb || !currentUser) {
    banner.style.display = 'none';
    return;
  }

  try {
    const { data } = await sb.from('queue_entries')
      .select('id, product_name, status, position')
      .eq('user_id', currentUser.id)
      .in('status', ['waiting', 'serving'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      queueEntryId = data[0].id;
      const info = document.getElementById('queueEntryInfo');
      if (data[0].status === 'serving') {
        info.textContent = data[0].product_name + ' · 正在服务中';
      } else {
        info.textContent = data[0].product_name + ' · 排队中，点击查看进度';
      }
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
      queueEntryId = null;
    }
  } catch (e) {
    banner.style.display = 'none';
  }
}

// 从产品页进入排队进度
function resumeProgress() {
  if (!queueEntryId) return;
  startSimulation();
  showScreen('progress');
}

// 从进度页返回产品页（不取消排队）
function backToProducts() {
  // 停止倒计时刷新（但保留模拟和realtime）
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  if (realtimeSubscription) {
    try { sb.removeChannel(realtimeSubscription); } catch(e) {}
    realtimeSubscription = null;
  }
  showScreen('products');
}

// ===== 刷新排队列表 =====
async function refreshQueue() {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('spinning');
  await loadQueueList();
  setTimeout(() => btn.classList.remove('spinning'), 500);
  showToast('已刷新');
}

// ===== Toast =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ===== 启动 =====
init();

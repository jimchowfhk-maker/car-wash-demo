// 问卷逻辑
let currentStep = 0;
const totalSteps = 5;
const formData = {};

// ===== 选项按钮点击 =====
document.querySelectorAll('.option-group').forEach(group => {
  const type = group.dataset.type; // 'radio' or 'multi'
  const field = group.dataset.field;
  const conditional = group.dataset.conditional;

  group.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (type === 'radio') {
        group.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.toggle('selected');
        formData[field] = btn.classList.contains('selected') ? btn.dataset.value : null;
      } else {
        btn.classList.toggle('selected');
        const selected = Array.from(group.querySelectorAll('.option-btn.selected')).map(b => b.dataset.value);
        formData[field] = selected.join(', ');
      }

      // 条件显示
      if (conditional) {
        const el = document.getElementById(conditional);
        if (el) {
          if (btn.dataset.value === '有' && btn.classList.contains('selected')) {
            el.classList.add('show');
          } else if (type === 'radio') {
            el.classList.remove('show');
          }
        }
      }

      saveDraft();
    });
  });
});

// ===== 步骤导航 =====
function updateProgress() {
  document.querySelectorAll('.progress-dot').forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i < currentStep) dot.classList.add('done');
    if (i === currentStep) dot.classList.add('active');
  });
  document.getElementById('progressLabel').textContent = (currentStep + 1) + ' / ' + totalSteps;
}

function showStep(step) {
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`.form-section[data-step="${step}"]`);
  if (target) target.classList.add('active');

  // 按钮状态
  document.getElementById('prevBtn').style.display = step === 0 ? 'none' : '';

  if (step === totalSteps - 1) {
    document.getElementById('nextBtn').textContent = '提交问卷';
  } else {
    document.getElementById('nextBtn').textContent = '下一步';
  }

  updateProgress();
  window.scrollTo(0, 0);
}

function nextStep() {
  // 验证当前步骤
  if (!validateStep(currentStep)) return;

  if (currentStep < totalSteps - 1) {
    currentStep++;
    showStep(currentStep);
  } else {
    submitSurvey();
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    showStep(currentStep);
  }
}

// ===== 验证 =====
function validateStep(step) {
  if (step === 0) {
    const name = document.getElementById('f_name').value.trim();
    if (!name) { showToast('请填写您的称呼'); return false; }
    if (!formData.f_gender) { showToast('请选择性别'); return false; }
  }
  if (step === 1) {
    if (!formData.f_frequency) { showToast('请选择洗车频次'); return false; }
  }
  if (step === 3) {
    if (!formData.f_first_priority) { showToast('请选择最看重的因素'); return false; }
  }
  if (step === 4) {
    if (!formData.f_price) { showToast('请选择洗车价格区间'); return false; }
  }
  return true;
}

// ===== 计算年龄段 =====
function getAgeRange(age) {
  if (!age) return '';
  age = parseInt(age);
  if (age < 20) return '20以下';
  if (age < 30) return '20-29';
  if (age < 40) return '30-39';
  if (age < 50) return '40-49';
  if (age < 60) return '50-59';
  return '60+';
}

// ===== 提交 =====
async function submitSurvey() {
  const btn = document.getElementById('nextBtn');
  btn.textContent = '提交中...';
  btn.disabled = true;

  // 收集所有数据
  const data = {
    source: 'survey',
    name: document.getElementById('f_name').value.trim(),
    gender: formData.f_gender || '',
    age: parseInt(document.getElementById('f_age').value) || null,
    age_range: getAgeRange(document.getElementById('f_age').value),
    driving_years: formData.f_driving_years || '',
    car_age: formData.f_car_age || '',
    car_type: formData.f_car_type || '',
    brand: document.getElementById('f_brand').value.trim(),
    occupation: document.getElementById('f_occupation').value.trim(),
    family_info: formData.f_family_info || '',
    region: document.getElementById('f_region').value,
    first_reaction_dirty: formData.f_first_reaction || '',
    dirty_description: formData.f_dirty_desc || '',
    wash_time_period: formData.f_wash_time || '',
    trigger_scenario: formData.f_trigger || '',
    wash_frequency: formData.f_frequency || '',
    recent_wash_description: document.getElementById('f_recent_wash').value.trim(),
    how_first_know_shop: formData.f_how_learn || '',
    check_weather_before: formData.f_check_weather || '',
    weather_impact: formData.f_weather_impact || '',
    queue_habit: formData.f_queue_habit || '',
    inhibit_scenario: document.getElementById('f_inhibit').value.trim(),
    has_fixed_shop: formData.f_has_fixed || '',
    fixed_shop_brand: document.getElementById('f_fixed_brand').value.trim(),
    supplier_attitude: formData.f_satisfaction || '',
    dissatisfaction: formData.f_dissatisfaction || '',
    first_priority: formData.f_first_priority || '',
    can_distinguish_quality: formData.f_distinguish || '',
    other_criteria: document.getElementById('f_other_criteria').value.trim(),
    single_wash_price: formData.f_price || '',
    wash_project: formData.f_project || '',
    notes: document.getElementById('f_notes').value.trim()
  };

  // 尝试提交到 Supabase
  const sb = initSupabase();
  if (sb) {
    try {
      const { error } = await sb.from('survey_responses').insert([data]);
      if (error) {
        console.error('Supabase error:', error);
        showToast('提交失败，请重试');
        btn.textContent = '提交问卷';
        btn.disabled = false;
        return;
      }
    } catch (e) {
      console.error('Submit error:', e);
      showToast('网络错误，请重试');
      btn.textContent = '提交问卷';
      btn.disabled = false;
      return;
    }
  } else {
    // Supabase 未配置，存到 localStorage
    const responses = JSON.parse(localStorage.getItem('survey_responses') || '[]');
    data.id = Date.now().toString();
    data.created_at = new Date().toISOString();
    responses.push(data);
    localStorage.setItem('survey_responses', JSON.stringify(responses));
  }

  // 显示成功
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.getElementById('formActions').style.display = 'none';
  document.getElementById('progressBar').style.display = 'none';
  document.getElementById('successPage').classList.add('show');

  // 清除草稿
  sessionStorage.removeItem('survey_draft');
}

// ===== Toast =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ===== 草稿保存/恢复 =====
function saveDraft() {
  const draft = {
    formData: { ...formData },
    inputs: {},
    step: currentStep
  };
  document.querySelectorAll('.form-input, .form-select').forEach(el => {
    if (el.id) draft.inputs[el.id] = el.value;
  });
  sessionStorage.setItem('survey_draft', JSON.stringify(draft));
}

function restoreDraft() {
  const saved = sessionStorage.getItem('survey_draft');
  if (!saved) return;
  try {
    const draft = JSON.parse(saved);

    // 恢复输入框
    if (draft.inputs) {
      Object.entries(draft.inputs).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });
    }

    // 恢复选项按钮
    if (draft.formData) {
      Object.assign(formData, draft.formData);
      document.querySelectorAll('.option-group').forEach(group => {
        const field = group.dataset.field;
        const type = group.dataset.type;
        const val = formData[field];
        if (!val) return;

        const values = type === 'multi' ? val.split(', ') : [val];
        group.querySelectorAll('.option-btn').forEach(btn => {
          if (values.includes(btn.dataset.value)) {
            btn.classList.add('selected');
          }
        });
      });
    }

    // 恢复步骤
    if (draft.step) {
      currentStep = draft.step;
      showStep(currentStep);
    }

    // 恢复条件显示
    if (formData.f_has_fixed === '有') {
      document.getElementById('fixedShopDetail').classList.add('show');
    }
  } catch (e) {
    console.warn('Draft restore failed:', e);
  }
}

// 输入框变化时保存草稿
document.querySelectorAll('.form-input, .form-select').forEach(el => {
  el.addEventListener('input', saveDraft);
  el.addEventListener('change', saveDraft);
});

// 初始化
showStep(0);
restoreDraft();

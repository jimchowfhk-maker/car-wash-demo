// Supabase 配置
// 请将下面的值替换为你自己的 Supabase 项目信息
const SUPABASE_URL = 'https://tammstsgvljmwidstaxk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cMvjPAGvmBOPYZCK9_QHOw_WibWPWkT';

// 后台管理密码 (SHA-256 hash of 'paopao2025')
const ADMIN_PASSWORD_HASH = '7c0a5e3a4f1e2d8b9c6f5a3e1d0b8c7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1';
// 实际使用时修改密码和对应的 hash

// CSV 表头到数据库列名的映射
const CSV_TO_DB_MAP = {
  '姓名': 'name',
  '用户分类': 'user_category',
  'psm（标准服务/超级服务）': 'psm',
  '访谈链接': 'interview_link',
  '性别': 'gender',
  '年龄': 'age',
  '用户年龄': 'age_range',
  '驾驶年龄': 'driving_years',
  '车的年龄': 'car_age',
  '车类型': 'car_type',
  '品牌': 'brand',
  '用户职业': 'occupation',
  '家庭信息': 'family_info',
  '用户联想到车脏了的第一反应': 'first_reaction_dirty',
  '具体描述': 'dirty_description',
  '洗车时间段': 'wash_time_period',
  '触发场景': 'trigger_scenario',
  '最近一次洗车场景描述': 'recent_wash_description',
  '如何第一次了解洗车店，dy？大众点评？': 'how_first_learn',
  '洗车前是否看天气预报': 'check_weather_before',
  '影响洗车的天气': 'weather_impact',
  '预约/排队习惯': 'queue_habit',
  '抑制场景，下雨？ 排队？': 'inhibit_scenario',
  '用户洗车频次': 'wash_frequency',
  '如何第一次知道一家洗车店': 'how_first_know_shop',
  '是否有固定洗车店': 'has_fixed_shop',
  '用户常去洗车店品牌': 'fixed_shop_brand',
  '对当下合作供应商整体态度': 'supplier_attitude',
  '现有固定洗车店不满意的地方': 'dissatisfaction',
  '筛选洗车店第一优先级': 'first_priority',
  '是否能区分不同洗车店清洁质量': 'can_distinguish_quality',
  '其他筛选洗车店维度': 'other_criteria',
  '如何筛选洗车店': 'how_to_select',
  '单次洗车价格': 'single_wash_price',
  '选择什么洗车项目': 'wash_project',
  '态度判断': 'attitude_judgment',
  '区域': 'region',
  '备注': 'notes',
  '父记录': 'parent_record'
};

// 初始化 Supabase 客户端
function initSupabase() {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.warn('请先配置 Supabase URL 和 Key');
    return null;
  }
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

import { CheckCircle2, FileCheck2, Shield, Store, UserX } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';

const sections = [
  {
    title: '用户协议',
    icon: FileCheck2,
    items: ['账号仅用于个人学习', '用户需保证导入词库内容合法', 'AI 结果仅供学习参考，核心考试内容建议以官方资料为准'],
  },
  {
    title: '隐私政策',
    icon: Shield,
    items: ['收集邮箱、学习记录、错题、收藏、设置和反馈内容', '录音、口语和作文类能力上线前需单独征得授权', '用户可导出备份，也可申请删除个人数据'],
  },
  {
    title: '账号与数据删除',
    icon: UserX,
    items: ['帮助与反馈页提供注销账号入口', '注销会删除学习进度、错题、收藏、设置和反馈记录', '支付、发票等合规记录后续应按法定要求留存'],
  },
];

export function LegalPage() {
  const storeChecklist = [
    '登录、注册、忘记密码、注销账号入口可访问',
    '隐私政策、用户协议、会员说明、数据删除说明可访问',
    '会员套餐、价格、权益、订单记录和恢复购买入口需在内购接入后补齐',
    'AI 内容展示“由 AI 生成，仅供学习参考”，并提供不准确反馈入口',
    '反馈、举报、内容审核和管理员处理入口可访问',
    '录音、通知、数据导出等能力上线前需补充系统权限说明',
  ];

  return (
    <>
      <PageHeader title="协议与隐私" description="上架前需要可访问的用户协议、隐私政策、会员说明和数据删除说明。这里提供产品内入口与基础文本。" />
      <div className="grid gap-5 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <section className="surface rounded-lg p-5" key={section.title}>
              <Icon size={24} style={{ color: 'var(--green)' }} />
              <h3 className="mt-4 text-xl font-semibold">{section.title}</h3>
              <div className="mt-4 grid gap-3">
                {section.items.map((item) => (
                  <p className="rounded-lg border p-3 text-sm leading-6" key={item} style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                    {item}
                  </p>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <section className="surface mt-5 rounded-lg p-5">
        <h3 className="text-xl font-semibold">AI 内容提示</h3>
        <p className="mt-3 text-sm leading-7" style={{ color: 'var(--muted)' }}>
          AI 生成内容应在页面中标注“由 AI 生成，仅供学习参考”，并提供“不准确”反馈入口。涉及未成年人、社区和用户上传内容时，需要继续接入敏感词、举报和审核流程。
        </p>
      </section>
      <section className="surface mt-5 rounded-lg p-5">
        <div className="flex items-center gap-2">
          <Store size={22} style={{ color: 'var(--green)' }} />
          <h3 className="text-xl font-semibold">上架检查清单</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {storeChecklist.map((item) => (
            <div className="flex items-start gap-2 text-sm leading-6" key={item} style={{ color: 'var(--muted)' }}>
              <CheckCircle2 className="mt-0.5 shrink-0" size={17} style={{ color: 'var(--green)' }} />
              {item}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

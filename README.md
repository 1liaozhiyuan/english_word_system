# AI English Learning System

一个全栈 AI 英语学习系统，围绕“词库选择 -> 单词学习 -> 智能复习 -> 测试练习 -> 错题分析 -> 学习报告”的学习闭环构建，并扩展了听力、口语、阅读、写作、语法、会员、内容审核和运营后台等商业化产品能力。

当前项目适合作为英语学习 App / Web App 的 MVP、毕业设计、作品集项目或商业化产品原型。

## 项目亮点

- 完整学习闭环：词库、单词学习、间隔复习、测试、错题本、收藏、学习统计、学习报告
- AI 学习能力：AI 单词讲解、AI 例句、AI 出题、AI 错因分析、AI 练习报告
- 错题智能沉淀：记录错误次数、错误类型、重点难词，并支持专项训练
- 词库内容增强：音标、释义、例句、词根词缀、搭配、同义词、反义词、派生词、易混词、考试标签
- AI 题目质量控制：题目不准确、答案错误、解析不好可反馈到后台审核
- 后台运营能力：用户、词库、反馈、内容审核、AI 使用记录、会员订单、操作日志
- 商业化基础：会员套餐、AI 次数限制、订单记录、权益说明、沙盒支付流程
- 合规基础：隐私政策、用户协议、AI 内容提示、反馈入口、账号注销和数据删除说明

## 技术栈

### Backend

- FastAPI
- SQLModel / SQLAlchemy
- PostgreSQL
- Alembic
- JWT 认证
- OpenAI-compatible AI API

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- lucide-react

### DevOps

- Docker Compose
- Vercel 配置
- Render 配置

## 目录结构

```text
english-word-system
├── backend                 # FastAPI 后端
│   ├── app
│   │   ├── main.py          # API 路由入口
│   │   ├── models.py        # SQLModel 数据模型
│   │   ├── schemas.py       # Pydantic/接口 schema
│   │   ├── services.py      # 核心业务逻辑
│   │   ├── ai_service.py    # AI Prompt 和调用逻辑
│   │   └── core             # 配置和安全工具
│   ├── alembic              # 数据库迁移
│   └── tests                # 后端测试
├── frontend
│   ├── src
│   │   ├── api              # 前端 API 封装
│   │   ├── components       # 通用组件
│   │   ├── pages            # 页面模块
│   │   ├── router           # 路由
│   │   └── types.ts         # 前端类型定义
│   └── vite.config.ts
├── docker-compose.yml
├── DEPLOYMENT.md
└── README.md
```

## 核心功能

### 用户与账号

- 注册、登录、退出
- 忘记密码、重置密码
- 新用户目标引导
- 学习偏好设置
- 账号注销和数据删除说明

### 词库与单词管理

- 官方词库
- 自定义词库
- CSV 导入预览
- CSV 导入 / 导出
- 单词新增、编辑、删除
- 批量删除、批量移动
- 词库搜索、分页、进度统计

单词支持字段：

```text
单词、音标、中文释义、英文释义、词性、例句、例句翻译、笔记、
词根词缀、常见搭配、同义词、反义词、派生词、易混词、考试标签、难度标签
```

### 学习与复习

- 新词学习
- 今日复习
- 认识 / 模糊 / 不认识
- 英译中、中译英、听力、拼写模式
- 基于掌握度、错误次数、复习间隔的复习调度
- 重点难词识别
- 学习中断后继续恢复

### 测试与 AI 练习

- 普通测试：选择题、拼写题、混合测试
- 测试来源：新词、复习、错题、收藏、综合
- 正式模式会写入复习和错题系统
- AI 生成结构化题目
- AI 题目难度选择：基础、考试、进阶
- AI 题型选择：混合、易混词、拼写、搭配、例句填空
- AI 考试计时：不限时、5 分钟、10 分钟、20 分钟
- 交卷、正确率、错题回放、解析、学习建议
- AI 失败时自动生成本地兜底题目

### 错题本

- 自动记录错题
- 错误次数统计
- 最近错误类型记录
- 重点难词标记
- 错题重练
- 批量安排重练
- 移出错题本
- AI 错因分析
- AI 错因分析历史保存

错误类型包括：

```text
词义混淆
中英转换错误
拼写错误
听音错误
```

### AI 能力

- AI 单词讲解
- AI 例句生成
- AI 出题
- AI 错因分析
- AI 练习报告
- AI 题目入库
- AI 题目反馈：
  - 题目不准确
  - 答案错误
  - 解析不好
- AI 内容反馈进入后台审核

### 能力训练

- 听力训练
- 口语跟读
- 阅读训练
- 写作训练
- 语法学习

### 数据统计与报告

- 累计学习词数
- 已掌握词数
- 待复习词数
- 错题数量
- 正确率
- 周正确率
- 连续学习天数
- 30 天活跃记录
- 薄弱词
- 薄弱题型
- 建议复习量
- 学习建议

### 会员与商业化

- 会员状态
- 会员套餐
- AI 每日额度
- 订单记录
- 沙盒支付 / 模拟支付流程
- 会员权益说明
- 取消订阅、恢复购买、自动续费说明入口

> 说明：当前支付仍是沙盒 / 模拟流程，正式上架前需要接入 App Store / Google Play 内购或合规支付方案。

### 后台管理

- 管理员登录和权限角色
- 用户管理
- 词库管理
- 反馈工单
- AI 使用记录
- AI 题库记录
- AI 错因分析记录
- 内容审核
- 会员订单
- 操作日志
- 数据概览

## 前端页面

```text
/login                 登录
/register              注册
/forgot-password       忘记密码
/reset-password        重置密码
/dashboard             首页学习看板
/today                 今日任务
/ability               能力训练导航
/review-data           复盘与数据导航
/services              设置与服务导航
/onboarding            新用户引导
/word-books            词库广场
/word-books/:id        词库详情
/words/:id             单词详情
/study                 新词学习
/review                今日复习
/mistakes              错题本
/favorites             收藏单词
/quiz                  测试与 AI 练习
/listening             听力训练
/speaking              口语训练
/reading               阅读训练
/writing               写作训练
/grammar               语法学习
/stats                 学习统计
/learning-report       学习报告
/learning-plan         学习计划
/check-in              打卡激励
/learning-settings     学习设置
/membership            会员中心
/notifications         消息通知
/support               帮助与反馈
/legal                 协议与隐私
/admin                 运营后台
```

## 快速启动

### 1. 启动数据库

```powershell
docker compose up -d postgres
```

默认数据库连接：

```text
postgresql+psycopg://postgres:postgres@localhost:5432/english_words
```

### 2. 启动后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

后端接口文档：

```text
http://127.0.0.1:8000/docs
```

### 3. 启动前端

```powershell
cd frontend
npm install
npm run dev
```

前端地址：

```text
http://127.0.0.1:5173
```

### 4. 构建前端

```powershell
cd frontend
npm run build
```

## 环境变量

后端环境变量文件：

```text
backend/.env
```

示例：

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/english_words
JWT_SECRET_KEY=change-this-secret-in-production
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
EXPOSE_RESET_TOKEN_IN_RESPONSE=true

OPENAI_API_KEY=your_api_key_here
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
AI_TIMEOUT_SECONDS=30
```

生产环境建议：

```env
EXPOSE_RESET_TOKEN_IN_RESPONSE=false
JWT_SECRET_KEY=use-a-strong-secret
```

## CSV 导入格式

必填字段：

```csv
word,meaning
```

推荐完整字段：

```csv
word,phonetic,meaning,part_of_speech,example_sentence,example_translation,note,english_definition,root_affix,collocations,synonyms,antonyms,word_family,confusing_words,exam_tags,difficulty_tag
abandon,/əˈbændən/,放弃,v.,He abandoned the plan.,他放弃了这个计划。,高频动词,to leave something or someone,ab + bandon,abandon a plan,give up,keep,abandoned / abandonment,abundant,四级;考研,B1
```

请保存为 UTF-8 CSV。

## 数据导出

系统支持：

- 用户学习数据 JSON 导出
- 用户学习数据 JSON 导入
- Anki TSV 导出
- 词库 CSV 导出

## 数据库迁移

执行迁移：

```powershell
cd backend
alembic upgrade head
```

创建迁移：

```powershell
alembic revision --autogenerate -m "describe change"
```

## 测试与验证

后端语法检查：

```powershell
cd backend
.\.venv\Scripts\python.exe -m py_compile app\main.py app\models.py app\schemas.py app\services.py app\ai_service.py
```

前端构建：

```powershell
cd frontend
npm run build
```

## 当前状态

当前系统已经具备较完整的英语学习产品 MVP 能力，适合：

- 本地演示
- 项目答辩
- 简历作品集
- 小范围内测
- 商业化产品原型验证

正式上架前仍建议补齐：

- 真实 App 内购 / 支付
- 正式隐私政策、用户协议、会员协议
- 真机移动端完整 QA
- 生产级日志、错误监控和告警
- AI 内容安全风控
- 核心词库人工校对
- 应用商店截图、图标、隐私标签和测试账号

## 后续规划

- 接入真实支付或应用内购买
- 增加 AI 作文批改
- 增加 AI 口语陪练
- 完善题库管理后台
- 增加题目人工修正和重新发布
- 增加学习小组和好友挑战
- 增加移动端 App 壳或小程序版本
- 增加生产环境错误监控


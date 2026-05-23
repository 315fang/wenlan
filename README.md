# 问兰大模型系统

一个给 Vercel 用的问兰前台工作台，负责承接客户咨询、官方素材搜索、宣传文案取用、语音转文字和后台知识库管理。

## 本地启动

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`

## 部署到 Vercel

1. 把这个目录推到 Git 仓库。
2. 在 Vercel 创建项目并导入仓库。
3. 填环境变量，至少二选一：
   - 直连 Dify：`DIFY_BASE_URL` + `DIFY_API_KEY`
   - 走你自己的后端：`ASSISTANT_BACKEND_URL`，可选再配 `ASSISTANT_BACKEND_API_KEY`
4. 如果要启用后台知识库管理，再配：`DIFY_KB_BASE_URL`、`DIFY_KB_DATASET_ID`、`DIFY_KB_API_KEY`
5. 后台知识库管理必须配置管理密码：`ADMIN_PASSWORD` 或 `KNOWLEDGE_ADMIN_PASSWORD`
   - 本地开发默认可用 `admin / admin`
6. 语音转文字需要：`MIMO_API_KEY`，官方 MiMo 线路默认走 `mimo-v2.5` 的音频理解接口；如果你接了自定义 ASR 网关，再配 `MIMO_TRANSCRIBE_URL`

## 关键接口

- `POST /api/chat`
- `POST /api/transcribe`
- `GET /api/config`
- `GET /api/admin/knowledge`
- `POST /api/admin/knowledge`
- `DELETE /api/admin/knowledge/:documentId`

## 环境变量

复制 `.env.example` 填写即可。

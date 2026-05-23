# 问兰 AI Portal

一个给 Vercel 用的深色 AI 工作台前端，负责承接问兰后台操作助手的聊天、语音转文字和配置状态展示。

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
4. 语音转文字需要：`MIMO_API_KEY`

## 关键接口

- `POST /api/chat`
- `POST /api/transcribe`
- `GET /api/config`

## 环境变量

复制 `.env.example` 填写即可。


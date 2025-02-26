## 目录结构

```textarea
config: // 代码配置目录
  constants.js // 定义常量
  config.js // process.env

middleware: // 插件目录

models:     //

prisma:     // DB模型

public:     // UI目录

routers:    // 路由目录
  - application
    /application
  - task
    /task
  - code-provider
    - github
      /github
  - auth
    /auth/login
    /auth/signin
    /auth/logout
    /auth/bind/github
    /auth/callback/github
  - user
    /user/
  - org
    /org
  - common
    /common

services:    // 处理业务

util:        // 公共方法

views:       // 前端 html 模版文件
```

## 项目启动

> PS: 如果需要使用`prisma`，则需要在目录下创建`.env`文件，内容需要有`DATABASE_URL`字段用于链接数据库.  
>  npx prisma migrate dev --name init 创建数据库  
>  npx prisma studio 管理数据库

```shell
# 启动一个终端，执行
npm install
npm run start

# 另起一个终端，执行
cd public
npm run start
```

## 讨论点

- 一个组织只能拥有一个owner，但是一个用户是多个组织的 owner
- 用户如果不是组织的`owner`，是不允许授权和取消代码仓库的`token`的。
- 用户如果不是`管理员权限`是不允许创建应用的。
- 通过admin项目操作应用，是需要获取的`组织owner`的`用户id`。

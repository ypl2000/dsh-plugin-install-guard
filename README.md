# dsh-plugin-install-guard

[![test](https://github.com/ypl2000/dsh-plugin-install-guard/actions/workflows/test.yml/badge.svg)](https://github.com/ypl2000/dsh-plugin-install-guard/actions/workflows/test.yml)

**会话内的插件安装闸。** 在 DeepSeek Harness 里，agent 每安装一个插件前，必须先完成安全审查并得到用户确认；否则安装命令在**执行前**被拒绝——Full access 会话也一样。

A DeepSeek Harness bundle that blocks agent-issued plugin installs until the package is reviewed and explicitly allowlisted. The denial happens before dispatch, so it also applies in Full access sessions.

[中文](#中文) · [English](#english)

---

## 中文

### 它解决什么问题

用 agent 装插件时，一句“帮我装 X”就可能直接执行 `dsh plugin add X`，插件代码随后在你的用户权限下运行。这个 bundle 把“先审查、再确认、后安装”变成可执行的步骤：

- 拦截 `dsh plugin … add/install/update`
- 拦截 `pnpm/npm/yarn/bun add|install` 且目标是 `dsh-*` / `@deepseek-ai/dsh-*`
- 拦截 `plugin_manager` 的 `install_bundle`
- 只放行允许清单里的包

它**不拦**普通项目依赖（`npm i react`），也**不拦**你自己在终端或 Web 插件页的操作——那些不经过 agent 的工具调用层。

### 安装

从本地目录安装到 profile：

```sh
dsh plugin --profile desktop add link:<仓库绝对路径>
```

或者把仓库打成 tarball：

```sh
npm pack
dsh plugin --profile desktop add ./dsh-plugin-install-guard-0.1.0.tgz
```

重启 Harness 后生效（HMR 开启时可能立即加载）。

### 配置（环境变量）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DSH_INSTALL_GUARD_ALLOW` | `$DSH_HOME/plugin-install-allow.txt`（缺省 `~/.dsh/plugin-install-allow.txt`） | 允许清单路径 |
| `DSH_INSTALL_GUARD_SCOPE` | `both` | `both` 拦 shell + `plugin_manager`；`cli` 只拦 shell；`manager` 只拦 `plugin_manager` |

如果想让 Web 插件市场的一键安装完全不受影响，把 scope 设为 `cli`——市场 UI 本来就不经过工具层，这个设置影响的是 agent 代装。

### 允许清单

一行一个包名，`#` 开头为注释，`*` 表示全部放行（不建议）：

```text
# 只有审查通过、用户确认要装的插件才加
dsh-context
```

命中规则是“包名包含清单项”，所以 `dsh-context` 也能放行 `dsh-context@0.83.1`。

### 推荐流程

1. agent 运行 `plugin-safety-audit`（或等价的人工审查），给出“能不能装 / 要关哪些设置”；
2. 用户确认要装；
3. 用户把包名写进允许清单；
4. agent 重试安装。

拒绝信息里会原样给出这个流程，agent 不需要猜。

### 局限

- 只拦工具调用路径；终端、Web 插件页、以及未来可能出现的、能直接触发安装的其它 agent 工具不在覆盖范围。
- 字符串匹配：把命令藏进脚本文件、或直接修改允许清单/本插件代码，都能绕过。它防的是“顺手直接装”，不是对抗性攻击。
- 命令里只是“提到”这些字符串（例如 `grep "dsh plugin add"`）也会被拦，属于已知误报。

### 开发

```sh
node --test test/
```

无运行时依赖；Node 22.19+ / 24+。

---

## English

### What it does

Agent-issued plugin installs are denied before execution until the package is on the allowlist:

- `dsh plugin … add/install/update`
- `pnpm/npm/yarn/bun add|install` targeting `dsh-*` or `@deepseek-ai/dsh-*`
- `plugin_manager` `install_bundle`

Ordinary project installs (`npm i react`) pass through. So do your own terminal commands and the Web Plugins page — those never reach the agent tool layer.

### Install

```sh
dsh plugin --profile desktop add link:<absolute repo path>
```

or `npm pack` and install the tarball. Restart Harness after installing.

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `DSH_INSTALL_GUARD_ALLOW` | `$DSH_HOME/plugin-install-allow.txt` | Allowlist path |
| `DSH_INSTALL_GUARD_SCOPE` | `both` | `both`: shell + `plugin_manager`; `cli`: shell only; `manager`: `plugin_manager` only |

### Allowlist

One package per line; `#` comments; `*` allows everything (not recommended). Matching is substring-based, so `dsh-context` also allows `dsh-context@0.83.1`.

### Limitations

- Guards the agent tool path only — not your terminal, the Web Plugins page, or any other tool that can trigger installs.
- String matching: hiding the command in a script, or editing the allowlist/this plugin, bypasses it. It is a guardrail against accidental installs, not an adversarial sandbox.
- Commands that merely mention the patterns (e.g. `grep "dsh plugin add"`) are denied; a known false positive.

### Development

```sh
node --test test/
```

No runtime dependencies. Node 22.19+ / 24+.

## License

[MIT](./LICENSE)

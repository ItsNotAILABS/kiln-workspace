function e(e){return`${(e||(typeof window<`u`?window.location.origin:`https://kiln.app`)).replace(/\/$/,``)}/api/mcp`}var t=[{id:`studio`,name:`Kiln Studio`,vendor:`kiln-labs`,kind:`native`,blurb:`The crew on this computer. One-shot a project, then the kernel owns the turn.`,protocol:`Native · MCP tools`,install:`Open Studio`,appId:`copilot`,installKln:0},{id:`cursor`,name:`Cursor`,vendor:`anysphere`,kind:`editor`,blurb:`Composer and agent mode against the sealed tree. Kiln is an MCP server.`,protocol:`MCP HTTP`,install:`Drop .cursor/mcp.json`,appId:`cursor`,installKln:0},{id:`continue`,name:`Continue`,vendor:`continue`,kind:`editor`,blurb:`Open-source autocomplete and chat in VS Code or JetBrains. Points at Kiln MCP + your model.`,protocol:`MCP · Continue config`,install:`Drop .continue/config.json`,appId:`continue`,installKln:0},{id:`claude-code`,name:`Claude Code`,vendor:`anthropic`,kind:`cli`,blurb:`Terminal agent. Reads CLAUDE.md, speaks MCP, commits on this computer.`,protocol:`MCP HTTP · CLAUDE.md`,install:`claude mcp add kiln`,appId:`claude-code`,installKln:0},{id:`github-copilot`,name:`GitHub Copilot`,vendor:`github`,kind:`editor`,blurb:`Inline complete in VS Code / JetBrains. Kiln MCP tools for repo, issues, and Actions.`,protocol:`VS Code MCP`,install:`Drop .vscode/mcp.json`,appId:`github-copilot`,installKln:0},{id:`aider`,name:`Aider`,vendor:`aider`,kind:`cli`,blurb:`Pair-program in the terminal. Map Grok or any connected model. Git commits stay on Kiln L1.`,protocol:`CLI · kiln clone`,install:`aider --model grok-4.6`,appId:`aider`,installKln:0},{id:`cline`,name:`Cline`,vendor:`cline`,kind:`editor`,blurb:`Autonomous VS Code agent. Kiln tools for read/write/search. Plan mode stays in the editor.`,protocol:`MCP · .clinerules`,install:`Drop .clinerules + MCP`,appId:`cline`,installKln:0},{id:`windsurf`,name:`Windsurf`,vendor:`codeium`,kind:`editor`,blurb:`Cascade agent with Kiln MCP. Memories live on the tree, not a sidecar.`,protocol:`MCP · Cascade`,install:`Drop .windsurf/mcp.json`,appId:`windsurf`,installKln:0},{id:`zed`,name:`Zed`,vendor:`zed`,kind:`editor`,blurb:`Native agent panel. HTTP MCP to this forge. Fast, local, sealed.`,protocol:`MCP HTTP`,install:`Drop .zed/settings.json`,appId:`zed`,installKln:0},{id:`cody`,name:`Cody`,vendor:`sourcegraph`,kind:`editor`,blurb:`Code search plus chat. Context is the Kiln working tree via MCP.`,protocol:`MCP · Cody`,install:`Drop .cody/mcp.json`,appId:`cody`,installKln:0},{id:`codex-cli`,name:`Codex CLI`,vendor:`openai`,kind:`cli`,blurb:`OpenAI Codex in the terminal. Clone kiln://, then let it edit. Commits settle here.`,protocol:`CLI · MCP`,install:`codex mcp add kiln`,appId:`codex-cli`,installKln:0},{id:`gemini-cli`,name:`Gemini CLI`,vendor:`google`,kind:`cli`,blurb:`Gemini from the shell. Same MCP surface Cursor and Claude Code use.`,protocol:`CLI · MCP`,install:`gemini mcp add kiln`,appId:`gemini-cli`,installKln:0},{id:`amazon-q`,name:`Amazon Q`,vendor:`amazon`,kind:`editor`,blurb:`Q Developer in VS Code. Kiln MCP for the sealed working tree and Actions.`,protocol:`VS Code MCP`,install:`Drop .vscode/mcp.json`,appId:`amazon-q`,installKln:0},{id:`tabnine`,name:`Tabnine`,vendor:`tabnine`,kind:`editor`,blurb:`Private autocomplete. Point it at the model vault on this repo.`,protocol:`Extension · model vault`,install:`Bind repo default model`,appId:`tabnine`,installKln:0}];function n(e){return t.find(t=>t.id===e||t.appId===e)}function r(t){return JSON.stringify({mcpServers:{kiln:{url:e(t)}}},null,2)}function i(t){return JSON.stringify({servers:{kiln:{type:`http`,url:e(t)}}},null,2)}function a(t){return JSON.stringify({name:`Kiln`,models:[{title:`Grok 4.6`,provider:`grok`,model:`grok-4.6`}],mcpServers:[{name:`kiln`,url:e(t)}],docs:[`kiln://`]},null,2)}function o(e){return`# Kiln

This working tree is a Kiln repository (${e}).

- Speak git: clone, commit, push, pull.
- Use MCP tools kiln_list_files, kiln_read_file, kiln_write_file, kiln_search, kiln_open_issue, kiln_pr_create.
- Do not invent secrets. Cipher Scan watches the tree.
- Capsule preview is index.html. Domain is kiln.app.
`}function s(e){return`model: grok-4.6
git: true
auto-commits: false
read:
  - README.md
map-tokens: 4096
# Clone first: kiln clone ${e}
# Then: aider --model grok-4.6
`}function c(e){return`Kiln repository ${e}.
Use Kiln MCP for files, issues, pulls, and Actions.
Commit with kiln_write_file. Do not leak keys.
`}function l(t,l,u){let d=n(t);if(!d)return[];switch(d.id){case`studio`:return[];case`cursor`:return[{path:`.cursor/mcp.json`,lang:`JSON`,body:r(l)+`
`},{path:`.cursor/rules/kiln.mdc`,lang:`Markdown`,body:o(u)}];case`continue`:return[{path:`.continue/config.json`,lang:`JSON`,body:a(l)+`
`}];case`claude-code`:return[{path:`.mcp.json`,lang:`JSON`,body:r(l)+`
`},{path:`CLAUDE.md`,lang:`Markdown`,body:o(u)}];case`github-copilot`:case`amazon-q`:return[{path:`.vscode/mcp.json`,lang:`JSON`,body:i(l)+`
`}];case`aider`:return[{path:`.aider.conf.yml`,lang:`YAML`,body:s(u)}];case`cline`:return[{path:`.clinerules`,lang:`Markdown`,body:c(u)},{path:`.vscode/mcp.json`,lang:`JSON`,body:i(l)+`
`}];case`windsurf`:return[{path:`.windsurf/mcp.json`,lang:`JSON`,body:r(l)+`
`}];case`zed`:return[{path:`.zed/settings.json`,lang:`JSON`,body:JSON.stringify({context_servers:{kiln:{command:`npx`,args:[`-y`,`mcp-remote`,e(l)]}}},null,2)+`
`}];case`cody`:return[{path:`.cody/mcp.json`,lang:`JSON`,body:r(l)+`
`}];case`codex-cli`:case`gemini-cli`:return[{path:`.mcp.json`,lang:`JSON`,body:r(l)+`
`},{path:`AGENTS.md`,lang:`Markdown`,body:o(u)}];case`tabnine`:return[{path:`.tabnine/config.json`,lang:`JSON`,body:JSON.stringify({model:`repo-default`,mcp:e(l)},null,2)+`
`}];default:return[{path:`.kiln/mcp.json`,lang:`JSON`,body:r(l)+`
`}]}}function u(t,i){let o=n(t);if(!o)return``;let s=e(i);switch(o.id){case`cursor`:return r(i);case`claude-code`:return`claude mcp add kiln --transport http ${s}`;case`aider`:return`kiln clone owner/name
cd name
aider --model grok-4.6`;case`codex-cli`:return`codex mcp add kiln --url ${s}`;case`gemini-cli`:return`gemini mcp add kiln --url ${s}`;case`continue`:return a(i);case`studio`:return`Open /studio — the crew is already on this computer.`;default:return r(i)}}export{t as ASSISTANTS,n as assistantById,l as assistantFiles,u as assistantSnippet,e as mcpUrl};
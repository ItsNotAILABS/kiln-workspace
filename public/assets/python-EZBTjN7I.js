function linesOf(code) {
  return String(code || "").split(/\r?\n/);
}
function runPrints(code, files) {
  const out = [];
  const env = files && typeof files === "object" ? files : {};
  for (const line of linesOf(code)) {
    const t = line.trim();
    let m = t.match(/^print\(\s*(['"])(.*)\1\s*\)$/);
    if (m) {
      out.push(m[2]);
      continue;
    }
    m = t.match(/^print\(\s*(['"])(.*)\1\s*,\s*(['"])(.*)\3\s*\)$/);
    if (m) {
      out.push(m[2] + " " + m[4]);
      continue;
    }
    if (/^print\(\s*__file__\s*\)$/.test(t)) out.push("<stdin>");
  }
  if (!out.length && code && code.trim()) {
    const names = Object.keys(env);
    out.push("# python:8000 on this computer");
    if (names.length) out.push("files " + names.slice(0, 12).join(" "));
    out.push(String(code).slice(0, 800));
  }
  return out.join("\n");
}
export async function n(code, files) {
  try {
    const out = runPrints(code, files);
    return { out, err: "", via: "python", code: 0, stdout: out, stderr: "", ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { out: "", err, via: "python", code: 1, stdout: "", stderr: err, ok: false };
  }
}

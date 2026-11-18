let token = "";
let job = "";
let url = "";
let timer = 0;
const status = document.querySelector("#status");
const reason = document.querySelector("#reason");
const skill = document.querySelector("#skill");
const frame = document.querySelector("#frame");
function say(text) { status.textContent = text; }
function describe(row) {
  if (row.error === "studio_generation_budget") {
    return "studio_generation_budget：生成达到本次输出预算，合格文件还没写完。请等下一个额度窗口再试，不要在同一小时里连续付费重试。";
  }
  if (row.status === "failed") return "failed " + (row.error || "");
  return row.status || "";
}
async function refresh() {
  if (!job) return;
  try {
    const row = await api("/api/studio/jobs/" + job);
    say(describe(row));
    if (row.status === "queued" || row.status === "running") timer = window.setTimeout(refresh, 2000);
  } catch (error) { say(error.message); }
}
function authHeaders() {
  const value = token.trim();
  if (!/^[A-Za-z0-9._~+\/=-]{32,256}$/.test(value)) throw Error("Token 格式不对");
  return { Authorization: "Bearer " + value };
}
async function api(path, options = {}) {
  const headers = { ...authHeaders(), ...(options.headers || {}) };
  const response = await fetch(path, { ...options, headers, credentials: "omit", cache: "no-store", redirect: "error" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(payload.detail || ("HTTP " + response.status));
  return payload;
}
async function loadSkills() {
  const data = await api("/api/studio/skills");
  skill.replaceChildren();
  for (const item of data.skills) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.id + (item.status === "enabled" ? "（可调用）" : "（blocked）");
    option.dataset.status = item.status;
    option.dataset.reason = item.reason || "";
    skill.append(option);
  }
  showReason();
}
function showReason() {
  const selected = skill.selectedOptions[0];
  reason.textContent = selected && selected.dataset.status !== "enabled"
    ? "blocked: " + selected.dataset.reason
    : "可调用。图片和 URL 抓取这一期没有。";
}
skill.addEventListener("change", showReason);
document.querySelector("#token").addEventListener("change", (event) => {
  token = event.target.value.trim();
  event.target.value = "";
  loadSkills().catch((error) => say(error.message));
});
document.querySelector("#send").addEventListener("click", async () => {
  try {
    const selected = skill.selectedOptions[0];
    if (!selected || selected.dataset.status !== "enabled") throw Error("这个技能是 blocked");
    const created = await api("/api/studio/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill: selected.value, brief: document.querySelector("#brief").value }),
    });
    job = created.id;
    window.clearTimeout(timer);
    say(describe(created));
    refresh();
  } catch (error) { say(error.message); }
});
document.querySelector("#stop").addEventListener("click", async () => {
  if (!job) return;
  try { say((await api("/api/studio/jobs/" + job + "/cancel", { method: "POST" })).status); }
  catch (error) { say(error.message); }
});
async function fileBlob() {
  const headers = authHeaders();
  const response = await fetch("/api/studio/jobs/" + job + "/files/preview.html", { headers, credentials: "omit", cache: "no-store", redirect: "error" });
  if (!response.ok) throw Error("下载失败");
  if ((response.headers.get("content-disposition") || "").indexOf("attachment") < 0) throw Error("产物不是附件");
  return response.blob();
}
document.querySelector("#download").addEventListener("click", async () => {
  try {
    const blob = await fileBlob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "preview.html";
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) { say(error.message); }
});
document.querySelector("#preview").addEventListener("click", async () => {
  try {
    if (url) URL.revokeObjectURL(url);
    const blob = await fileBlob();
    url = URL.createObjectURL(blob);
    frame.src = url;
  } catch (error) { say(error.message); }
});

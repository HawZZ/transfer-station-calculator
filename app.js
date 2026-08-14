const MODEL_PRICE_PER_M_TOKEN = 5;
const WORKBOOK_FALLBACK_RATE = 6.74;
const HISTORY_KEY = "transfer-station-calculator:records:v1";
const THEME_KEY = "transfer-station-theme";
const MAX_HISTORY_ITEMS = 100;

const state = {
  exchangeRate: WORKBOOK_FALLBACK_RATE,
  rateDate: "",
  rateSource: "参考表格",
  rateLoading: false,
  history: loadHistory(),
};

const elements = {
  calculatorForm: document.querySelector("#calculatorForm"),
  rechargeAmount: document.querySelector("#rechargeAmount"),
  equivalentUsd: document.querySelector("#equivalentUsd"),
  multiplier: document.querySelector("#multiplier"),
  websiteUrl: document.querySelector("#websiteUrl"),
  calculateButton: document.querySelector("#calculateButton"),
  refreshRate: document.querySelector("#refreshRate"),
  exchangeRate: document.querySelector("#exchangeRate"),
  rateStatus: document.querySelector("#rateStatus"),
  formError: document.querySelector("#formError"),
  resultPanel: document.querySelector("#resultPanel"),
  resultEmpty: document.querySelector("#resultEmpty"),
  resultContent: document.querySelector("#resultContent"),
  resultState: document.querySelector("#resultState"),
  tokensPerDollar: document.querySelector("#tokensPerDollar"),
  availableTokens: document.querySelector("#availableTokens"),
  effectiveCost: document.querySelector("#effectiveCost"),
  usedRate: document.querySelector("#usedRate"),
  formulaNote: document.querySelector("#formulaNote"),
  historyList: document.querySelector("#historyList"),
  historyEmpty: document.querySelector("#historyEmpty"),
  clearHistory: document.querySelector("#clearHistory"),
  themeToggle: document.querySelector("#themeToggle"),
};

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isValidRecord)
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function isValidRecord(record) {
  return Boolean(
    record &&
      typeof record === "object" &&
      Number.isFinite(Number(record.rechargeAmount)) &&
      Number.isFinite(Number(record.equivalentUsd)) &&
      Number.isFinite(Number(record.multiplier)) &&
      Number.isFinite(Number(record.exchangeRate)) &&
      Number.isFinite(Number(record.availableTokens)) &&
      Number.isFinite(Number(record.effectiveCostUsd)) &&
      Number.isFinite(Number(record.tokensPerDollar)) &&
      typeof record.updatedAt === "string"
  );
}

function formatNumber(value, maximumFractionDigits = 4) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits,
  }).format(value);
}

function formatUsd(value) {
  return `$${new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)}`;
}

function formatCny(value) {
  return `CNY ${new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatTimestamp(isoValue) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "时间未知";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function setThemeToggleLabel() {
  const isDark = document.documentElement.dataset.theme === "dark";
  elements.themeToggle.textContent = isDark ? "浅色模式" : "深色模式";
  elements.themeToggle.setAttribute("aria-label", isDark ? "切换到浅色模式" : "切换到深色模式");
  document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark ? "#181e1a" : "#f1f3ef");
}

function updateRateDisplay() {
  elements.exchangeRate.textContent = formatNumber(state.exchangeRate, 4);

  if (state.rateLoading) {
    elements.rateStatus.textContent = "正在获取 USD/CNY 汇率";
    return;
  }

  const datePart = state.rateDate ? `，日期 ${state.rateDate}` : "";
  elements.rateStatus.textContent = `${state.rateSource}，1 USD = ${formatNumber(state.exchangeRate, 4)} CNY${datePart}`;
}

function showFormError(message) {
  elements.formError.textContent = message;
  elements.formError.hidden = false;
}

function clearFormError() {
  elements.formError.textContent = "";
  elements.formError.hidden = true;
}

function getNumericInput(element, label) {
  const value = Number(element.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label}必须大于 0。`);
  }
  return value;
}

function normalizeWebsiteUrl(rawValue) {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("官网链接只支持 http 或 https 地址。");
  }

  url.username = "";
  url.password = "";
  url.hash = "";

  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return {
    display: url.href,
    key: url.href,
  };
}

function calculateValues(rechargeAmount, equivalentUsd, multiplier, exchangeRate) {
  const availableTokens = equivalentUsd / multiplier / MODEL_PRICE_PER_M_TOKEN;
  const effectiveCostUsd = rechargeAmount / exchangeRate;
  const tokensPerDollar = availableTokens / effectiveCostUsd;

  return {
    availableTokens,
    effectiveCostUsd,
    tokensPerDollar,
  };
}

function updateResult(values, statusText) {
  elements.resultEmpty.hidden = true;
  elements.resultContent.hidden = false;
  elements.resultState.textContent = statusText;
  elements.tokensPerDollar.textContent = formatNumber(values.tokensPerDollar, 4);
  elements.availableTokens.textContent = `${formatNumber(values.availableTokens, 4)} M`;
  elements.effectiveCost.textContent = formatUsd(values.effectiveCostUsd);
  elements.usedRate.textContent = formatNumber(values.exchangeRate, 4);
  elements.formulaNote.textContent = `可用 M Tokens ${formatNumber(values.availableTokens, 4)} = ${formatUsd(values.equivalentUsd)} / ${formatNumber(values.multiplier, 4)} / $${MODEL_PRICE_PER_M_TOKEN}`;

  elements.resultPanel.classList.remove("is-updating");
  void elements.resultPanel.offsetWidth;
  elements.resultPanel.classList.add("is-updating");
}

function createRecord(input, website, verification, rateSnapshot) {
  const values = calculateValues(input.rechargeAmount, input.equivalentUsd, input.multiplier, rateSnapshot.value);

  return {
    id: website?.key || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    websiteUrl: website?.display || "",
    websiteKey: website?.key || "",
    verificationStatus: verification.status,
    verificationDetail: verification.detail,
    rechargeAmount: input.rechargeAmount,
    equivalentUsd: input.equivalentUsd,
    multiplier: input.multiplier,
    exchangeRate: rateSnapshot.value,
    rateDate: rateSnapshot.date,
    availableTokens: values.availableTokens,
    effectiveCostUsd: values.effectiveCostUsd,
    tokensPerDollar: values.tokensPerDollar,
    updatedAt: new Date().toISOString(),
  };
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
    return true;
  } catch {
    return false;
  }
}

function saveRecord(record) {
  let overwritten = false;

  if (record.websiteKey) {
    overwritten = state.history.some((item) => item.websiteKey === record.websiteKey);
    state.history = state.history.filter((item) => item.websiteKey !== record.websiteKey);
  }

  state.history = [record, ...state.history].slice(0, MAX_HISTORY_ITEMS);
  return {
    overwritten,
    persisted: persistHistory(),
  };
}

function statusPresentation(record) {
  if (record.verificationStatus === "valid") {
    return { label: "官网可达", className: "status-valid" };
  }
  if (record.verificationStatus === "invalid") {
    return { label: "链接不可达", className: "status-invalid" };
  }
  return { label: "未提供官网", className: "status-unverified" };
}

function appendText(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function renderHistory() {
  elements.historyList.replaceChildren();
  const hasHistory = state.history.length > 0;
  elements.historyEmpty.hidden = hasHistory;
  elements.clearHistory.disabled = !hasHistory;
  if (!hasHistory) return;

  const fragment = document.createDocumentFragment();

  state.history.forEach((record) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const site = document.createElement("div");
    site.className = "history-site";
    if (record.websiteUrl) {
      const link = document.createElement("a");
      link.href = record.websiteUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = record.websiteUrl;
      site.append(link);
      appendText(site, "span", `${formatTimestamp(record.updatedAt)}${record.verificationDetail ? `，${record.verificationDetail}` : ""}`);
    } else {
      appendText(site, "strong", "未关联官网");
      appendText(site, "span", formatTimestamp(record.updatedAt));
    }

    const meta = document.createElement("div");
    meta.className = "record-meta";
    appendText(meta, "div", `${formatCny(record.rechargeAmount)} 充值`);
    appendText(meta, "div", `${formatUsd(record.equivalentUsd)} 等效，倍率 ${formatNumber(record.multiplier, 4)}`);
    appendText(meta, "div", `汇率 ${formatNumber(record.exchangeRate, 4)}`);

    const result = document.createElement("div");
    result.className = "record-result";
    appendText(result, "strong", formatNumber(record.tokensPerDollar, 4));
    appendText(result, "span", "M Tokens / $");

    const status = statusPresentation(record);
    const badge = appendText(item, "span", status.label, `status-badge ${status.className}`);
    badge.title = record.verificationDetail || status.label;

    item.prepend(site, meta, result);
    fragment.append(item);
  });

  elements.historyList.append(fragment);
}

function withTimeout(signalController, timeoutMs) {
  return window.setTimeout(() => signalController.abort(), timeoutMs);
}

async function checkWebsite(website) {
  if (!website) {
    return { status: "unverified", detail: "未提供官网链接" };
  }

  const controller = new AbortController();
  const timeoutId = withTimeout(controller, 7000);

  try {
    const response = await fetch(website.display, {
      method: "HEAD",
      mode: "cors",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status >= 200 && response.status < 400) {
      return { status: "valid", detail: `HTTP ${response.status}` };
    }

    return { status: "invalid", detail: `HTTP ${response.status}` };
  } catch {
    try {
      const response = await fetch(website.display, {
        method: "HEAD",
        mode: "no-cors",
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.type === "opaque") {
        return { status: "valid", detail: "网络可达，跨域状态不可读" };
      }

      return { status: response.ok ? "valid" : "invalid", detail: response.ok ? `HTTP ${response.status}` : "链接未返回成功状态" };
    } catch (error) {
      const detail = error?.name === "AbortError" ? "访问超时" : "浏览器未能访问该链接";
      return { status: "invalid", detail };
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function refreshExchangeRate() {
  if (state.rateLoading) return;

  state.rateLoading = true;
  elements.refreshRate.disabled = true;
  updateRateDisplay();

  const controller = new AbortController();
  const timeoutId = withTimeout(controller, 8000);

  try {
    const response = await fetch("https://api.frankfurter.dev/v1/latest?from=USD&to=CNY", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("汇率服务未返回成功状态");

    const data = await response.json();
    const rate = Number(data?.rates?.CNY);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("汇率数据无效");

    state.exchangeRate = rate;
    state.rateDate = typeof data.date === "string" ? data.date : "";
    state.rateSource = "Frankfurter";
  } catch {
    state.exchangeRate = WORKBOOK_FALLBACK_RATE;
    state.rateDate = "";
    state.rateSource = "参考表格回退值";
  } finally {
    window.clearTimeout(timeoutId);
    state.rateLoading = false;
    elements.refreshRate.disabled = false;
    updateRateDisplay();
  }
}

async function handleCalculate(event) {
  event.preventDefault();
  clearFormError();

  let input;
  let website;
  try {
    input = {
      rechargeAmount: getNumericInput(elements.rechargeAmount, "充值金额"),
      equivalentUsd: getNumericInput(elements.equivalentUsd, "充值等效美元"),
      multiplier: getNumericInput(elements.multiplier, "计算倍率"),
    };
    website = normalizeWebsiteUrl(elements.websiteUrl.value);
  } catch (error) {
    showFormError(error.message || "请输入有效参数。");
    return;
  }

  const rateSnapshot = {
    value: state.exchangeRate,
    date: state.rateDate,
  };
  const calculation = calculateValues(input.rechargeAmount, input.equivalentUsd, input.multiplier, rateSnapshot.value);
  updateResult({ ...input, ...calculation, exchangeRate: rateSnapshot.value }, website ? "正在校验官网" : "正在保存");

  elements.calculateButton.disabled = true;
  elements.calculateButton.textContent = website ? "正在校验官网" : "正在保存";

  const verification = await checkWebsite(website);
  const record = createRecord(input, website, verification, rateSnapshot);
  const saveState = saveRecord(record);

  if (website) {
    elements.websiteUrl.value = website.display;
  }

  renderHistory();
  const actionText = saveState.overwritten ? "已覆盖同官网记录" : "已保存";
  const verificationText = statusPresentation(record).label;
  updateResult({ ...input, ...calculation, exchangeRate: rateSnapshot.value }, `${actionText}，${verificationText}`);

  if (!saveState.persisted) {
    showFormError("本次结果已显示，但浏览器拒绝保存本地记录。请检查无痕模式或存储权限。");
  }

  elements.calculateButton.disabled = false;
  elements.calculateButton.textContent = "计算并保存";
}

function clearHistory() {
  if (state.history.length === 0) return;
  const confirmed = window.confirm("确定清空当前浏览器中的所有计算记录吗？");
  if (!confirmed) return;

  state.history = [];
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    showFormError("记录列表已清空，但浏览器拒绝更新本地存储。");
  }
  renderHistory();
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch {
    // Theme preference is optional, so the current page still updates if storage is unavailable.
  }
  setThemeToggleLabel();
}

elements.calculatorForm.addEventListener("submit", handleCalculate);
elements.refreshRate.addEventListener("click", refreshExchangeRate);
elements.clearHistory.addEventListener("click", clearHistory);
elements.themeToggle.addEventListener("click", toggleTheme);

window.addEventListener("storage", (event) => {
  if (event.key === HISTORY_KEY) {
    state.history = loadHistory();
    renderHistory();
  }
});

setThemeToggleLabel();
updateRateDisplay();
renderHistory();
refreshExchangeRate();

import { cleanDesc, findInDetail, getDetailRoot, highlightCard } from "./boss/page.js";
import { BOSS } from "./boss/selectors.js";
import { checkJobCards, createStreakGuard, streakStopMessage } from "./boss/self-check.js";
import { CONFIG, RECRUITER_STATUS_OPTIONS, isJobsPage } from "./config.js";
import { ContactedJobs } from "./contacted.js";
import { DELIVERY_LOCK_NAME, Delivery } from "./delivery.js";
import { coarseExplain, coarseRejectReason, hasFilterRules, jobTypeAccepted, jobTypeFilterActive, readCardInfo } from "./filters.js";
import { classifyJob } from "./rules/job-type.js";
import { keywordSnippet, matchKeyword } from "./rules/keywords.js";
import { RunStatus } from "./run-status.js";
import { CONFIG_FIELD_LABELS, formatConfigValue, getCurrentConfig } from "./settings-store.js";
import { SkippedJobs } from "./skipped.js";
import { saveLogEntries, state } from "./state.js";
import { UI } from "./ui/index.js";
import { showNotification } from "./ui/notify.js";

// 打开过详情的岗位卡片会记下“哪个账号、用哪套规则判断过”。同一套规则下再开始投递时跳过，
// 中途停下再继续能接着投；改了规则后重新判断。详情加载超时的只在本次投递里跳过。
function rulesKey() {
  const { targetCount, ...rules } = getCurrentConfig();
  const text = JSON.stringify(rules);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

// 按岗位 id 在当前页找卡片（补投、定位时用）
export const findCardById = (jobId) => (jobId
  ? Array.from(document.querySelectorAll(BOSS.jobCard)).find((card) => ContactedJobs.idOf(card) === jobId) || null
  : null);

const isHandled = (card, run) => card.dataset.zdlProcessed === run.mark || card.dataset.zdlTimeout === run.id;

// 开始投递时日志里的规则说明：第一行是摘要，其余行折叠起来，点开看每条规则的完整内容。
function filterSummary() {
  const config = getCurrentConfig();
  const count = (key) => config[key].length;
  const group = (label, keys) => {
    const parts = keys.filter(([key]) => count(key)).map(([key, name]) => `${name} ${count(key)}`);
    return parts.length ? `${label}${parts.join("/")}` : "";
  };
  const salary = config.salaryFilter.type !== "none" || config.salaryFilter.negotiable === false;
  const activity = count("recruiterActivityStatus") < RECRUITER_STATUS_OPTIONS.length;
  const summary = [
    jobTypeFilterActive() ? formatConfigValue("jobTypeFilter", config.jobTypeFilter) : "",
    group("职位名 ", [["includeTags", "包含"], ["coarseRequiredTags", "必须"], ["coarseBlockedTags", "排除"]]),
    count("locationTags") ? `工作地 ${config.locationTags.join("、")}` : "",
    salary ? `薪资 ${formatConfigValue("salaryFilter", config.salaryFilter)}` : "",
    count("blockedCompanies") ? `排除公司 ${count("blockedCompanies")} 家` : "",
    group("详情 ", [["detailOptionalTags", "包含"], ["detailRequiredTags", "必须"], ["detailBlockedTags", "排除"]]),
    count("recruiterIncludeTags") || activity ? "招聘者有限制" : "",
  ].filter(Boolean);
  if (!summary.length) return "筛选条件：未设置，列表里的岗位都会尝试沟通";
  const details = Object.keys(CONFIG_FIELD_LABELS)
    .filter((key) => key !== "targetCount" && (Array.isArray(config[key]) ? count(key) && !(key === "recruiterActivityStatus" && !activity) : true))
    .filter((key) => (key === "jobTypeFilter" ? jobTypeFilterActive() : key === "salaryFilter" ? salary : true))
    .map((key) => `${CONFIG_FIELD_LABELS[key]}：${formatConfigValue(key, config[key])}`);
  return `筛选条件：${summary.join(" · ")}\n${details.join("\n")}`;
}

// 列表里没有可投的岗位时，说清楚是投完了还是规则没匹配上。
function listExhaustedMessage(total, fresh, contacted, rejected) {
  if (!total) return "当前列表没有岗位，本次结束";
  if (!fresh) return `当前列表的 ${total} 个岗位都已处理完，本次结束。可以换城市或搜索词继续`;
  const reasons = Object.entries(rejected).sort((a, b) => b[1] - a[1]);
  const top = reasons.slice(0, 4).map(([label, n]) => `${label} ${n}`).join("、");
  const ruled = fresh - contacted;
  if (!ruled) return `列表已到底，剩下的 ${fresh} 个岗位都已沟通过，本次结束。可以换城市或搜索词继续`;
  return `列表已到底，剩下的 ${ruled} 个新岗位都不符合筛选规则（${top}${reasons.length > 4 ? " 等" : ""}），本次结束。`
    + "可以在「筛选设置」顶部的预览里看哪条规则挡得最多，或换城市、搜索词继续";
}

export const Core = {
  async startProcessing(run) {
    let roundIndex = 0;

    while (Delivery.isCurrent(run)) {
      if (state.delivery.dailyCount >= state.targetCount) {
        this.log(`已达到今日投递目标 ${state.targetCount} 次，自动停止`);
        stopProcess(run);
        return;
      }
      if (state.delivery.dailyCount >= CONFIG.DAILY_LIMIT) {
        this.log(`今日已投递 ${state.delivery.dailyCount} 次，已达每日上限 ${CONFIG.DAILY_LIMIT}，自动停止`);
        stopProcess(run);
        return;
      }

      const remaining = Math.max(state.targetCount - state.delivery.dailyCount, 0);
      const roundSize = roundIndex === 0
        ? Math.min(remaining, 150)
        : Math.max(Math.min(remaining, 150 - roundIndex * 30), 30);

      RunStatus.setActivity("正在加载岗位列表…");
      await this.autoScrollJobList(roundSize, run);
      if (!Delivery.isCurrent(run)) return;

      state.jobList = [];
      state.currentIndex = 0;

      while (Delivery.isCurrent(run)) {
        if (state.delivery.dailyCount >= state.targetCount || state.delivery.dailyCount >= CONFIG.DAILY_LIMIT) break;
        await this.processJobList(run);
        if (!Delivery.isCurrent(run)) break;
        if (state.currentIndex >= state.jobList.length && state.jobList.length > 0) break;
        await this.delay(CONFIG.BASIC_INTERVAL);
      }

      if (!Delivery.isCurrent(run)) break;
      if (state.delivery.dailyCount >= state.targetCount || state.delivery.dailyCount >= CONFIG.DAILY_LIMIT) {
        this.log(state.delivery.dailyCount >= state.targetCount
          ? `已达到今日投递目标 ${state.targetCount} 次，自动停止`
          : `今日已投递 ${state.delivery.dailyCount} 次，已达每日上限 ${CONFIG.DAILY_LIMIT}，自动停止`);
        break;
      }

      state.jobIndexOffset += state.jobList.length;
      roundIndex++;
      this.log(`正在收集第 ${roundIndex + 1} 轮岗位...`);
    }

    if (Delivery.isCurrent(run)) stopProcess(run);
  },

  async autoScrollJobList(roundSize, run) {
    return new Promise((resolve) => {
      const cardSelector = BOSS.jobCard;
      const maxHistory = 5;
      const baseWait = CONFIG.BASIC_INTERVAL + 500;
      let cardCountHistory = [];
      let adaptiveDelay = baseWait;
      let noChangeStreak = 0;

      const maxNeeded = Math.min(roundSize, Math.max(CONFIG.DAILY_LIMIT - state.delivery.dailyCount, 0));
      if (maxNeeded <= 0) {
        resolve({ hitBottom: false });
        return;
      }

      const countFiltered = () => {
        const contacted = ContactedJobs.setFor(run.uid);
        return Array.from(document.querySelectorAll(cardSelector)).filter((card) =>
          !isHandled(card, run) && !coarseRejectReason(readCardInfo(card), contacted)).length;
      };

      const scrollStep = async () => {
        if (!Delivery.isCurrent(run)) { resolve({ hitBottom: false }); return; }

        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
        await this.delay(adaptiveDelay);
        if (!Delivery.isCurrent(run)) { resolve({ hitBottom: false }); return; }

        const cards = document.querySelectorAll(cardSelector);
        const currentCount = cards.length;
        cardCountHistory.push(currentCount);
        if (cardCountHistory.length > maxHistory) cardCountHistory.shift();

        // 自适应延迟：连续 2 次无变化才减半，最低 800ms，有新卡片时重置
        if (cardCountHistory.length >= 2 && cardCountHistory[cardCountHistory.length - 1] !== cardCountHistory[cardCountHistory.length - 2]) {
          adaptiveDelay = baseWait;
          noChangeStreak = 0;
        } else if (cardCountHistory.length >= 3 && cardCountHistory[cardCountHistory.length - 1] === cardCountHistory[cardCountHistory.length - 2]) {
          noChangeStreak++;
          if (noChangeStreak >= 2) {
            adaptiveDelay = Math.max(Math.floor(adaptiveDelay / 2), 800);
          }
        }

        const filtered = countFiltered();
        if (filtered >= maxNeeded) {
          resolve({ hitBottom: false });
          return;
        }

        if (
          cardCountHistory.length === maxHistory &&
          new Set(cardCountHistory).size === 1
        ) {
          this.log("当前页面岗位加载完成，开始沟通");
          resolve({ hitBottom: true });
          return;
        }

        scrollStep();
      };

      scrollStep();
    });
  },

  async processJobList(run) {
    if (!Delivery.isCurrent(run)) return;
    const activeStatusFilter = state.settings.recruiterActivityStatus;
    // 粗筛：只看列表卡片上的信息
    if (!state.jobList || state.jobList.length === 0) {
      const contacted = ContactedJobs.setFor(run.uid);
      const cards = document.querySelectorAll(BOSS.jobCard);
      let skippedContacted = 0;
      let fresh = 0;
      const rejected = {};
      // 粗筛没通过的只在本次投递、同一套规则下不再重复统计；投递中改了规则会重新判断
      const coarseMark = `${run.id}:${rulesKey()}`;
      state.jobList = [];
      cards.forEach((card) => {
        if (isHandled(card, run) || card.dataset.zdlCoarse === coarseMark) return;
        fresh++;
        const info = readCardInfo(card);
        const { reason, label } = coarseExplain(info, contacted);
        if (reason === "contacted") {
          skippedContacted++;
          card.dataset.zdlProcessed = run.mark;
        } else if (reason) {
          rejected[label] = (rejected[label] || 0) + 1;
          card.dataset.zdlCoarse = coarseMark;
        }
        if (reason) return;
        state.jobList.push({
          el: card, jobId: info.jobId, company: info.company, logo: info.logo,
          job: info.title, salary: info.salary, address: info.address, tags: info.tags,
        });
      });

      const contactedNote = skippedContacted ? `，跳过已沟通过的 ${skippedContacted} 个` : "";
      const scope = fresh === cards.length ? `共 ${cards.length} 个岗位` : `新加载 ${fresh} 个岗位（列表共 ${cards.length} 个）`;
      this.log(`筛选完成，${scope}，匹配 ${state.jobList.length} 个${contactedNote}`);
      if (!state.jobList.length) {
        this.log(listExhaustedMessage(cards.length, fresh, skippedContacted, rejected));
        stopProcess(run);
        return;
      }
    }

    if (state.currentIndex >= state.jobList.length) {
      // jobList 已耗尽，返回让外层循环决定是否开始下一轮
      return;
    }

    // 细筛：打开详情后判断
    const item = state.jobList[state.currentIndex];
    const cardEl = item.el;
    const cumulativeTotal = state.jobIndexOffset + state.jobList.length;
    const idx = state.jobIndexOffset + state.currentIndex + 1;
    const prefix = `第${idx}/${cumulativeTotal}个，[${item.address}][${item.company}][${item.job}][${item.salary}]`;
    // remediable：被规则挡掉或加载超时的岗位记进“可补投”，误跳过的可以事后补投
    const skip = (message, key = message, remediable = false) => {
      this.log(`${prefix}，${message}，已跳过`);
      run.skips[key] = (run.skips[key] || 0) + 1;
      state.currentIndex++;
      if (remediable) {
        SkippedJobs.add(run.uid, {
          jobId: item.jobId, title: item.job, company: item.company, salary: item.salary, address: item.address, reason: message,
        });
      }
      RunStatus.render();
    };
    highlightCard(cardEl);
    RunStatus.setActivity(`正在看：${item.company} · ${item.job}`);
    const detailReady = await this.openDetail(item, run);
    // 中途停止时不打标记，下次开始会重新处理这个岗位
    if (!Delivery.isCurrent(run)) return;
    if (!detailReady) {
      // 加载超时的岗位本次不再试，下次开始时重试
      cardEl.dataset.zdlTimeout = run.id;
      skip("详情加载超时", "详情加载超时", true);
      this.stopIfBroken(run, "detail");
      return;
    }
    run.guard.ok("detail");
    cardEl.dataset.zdlProcessed = run.mark;

    let activeTime = "未知";
    const onlineTag = findInDetail(BOSS.recruiterOnline);
    if (onlineTag && onlineTag.textContent.trim() === "在线") {
      activeTime = "在线";
    } else {
      activeTime = findInDetail(BOSS.recruiterActive)?.textContent?.trim() || "未知";
    }
    if (activeStatusFilter.length > 0 && !activeStatusFilter.includes(activeTime)) {
      return skip(`招聘者"${activeTime}"`, "招聘者活跃状态不符", true);
    }

    let matchReason = "";

    // 岗位类型与经验：加上职位描述后给出最终判断
    if (jobTypeFilterActive()) {
      const root = getDetailRoot();
      const detailTags = root === document ? []
        // 经验、学历在详情头部的 .tag-list 里；.job-label-list 是技能标签，不参与类型判断
        : Array.from(root.querySelectorAll(BOSS.detailTags), (li) => li.textContent.trim());
      const jobType = classifyJob({
        title: item.job,
        tags: [...(item.tags || []), ...detailTags],
        desc: cleanDesc(document.querySelector(BOSS.detailDesc)),
        salary: item.salary,
      });
      if (!jobTypeAccepted(jobType)) {
        return skip(`岗位类型"${jobType.label}"不在投递范围${jobType.evidence ? `（${jobType.evidence}）` : ""}`, `岗位类型"${jobType.label}"`, true);
      }
      matchReason = `类型"${jobType.label}"`;
    }
    if (state.detailBlockedTags.length || state.detailRequiredTags.length || state.detailOptionalTags.length) {
      // 判断用小写文本，日志片段从原文截取（关键词正则不区分大小写，命中位置一致）
      const descRaw = cleanDesc(document.querySelector(BOSS.detailDesc));
      const descText = descRaw.toLowerCase();
      const quote = (text, kw) => {
        const snippet = keywordSnippet(text, kw);
        return snippet ? `（${snippet}）` : "";
      };

      // 排除词：只匹配职位描述
      const hitBlocked = state.detailBlockedTags.find((kw) => matchKeyword(descText, kw));
      if (hitBlocked) return skip(`命中排除词"${hitBlocked}"${quote(descRaw, hitBlocked)}`, `详情排除"${hitBlocked}"`, true);

      // 必须/任一：匹配职位描述、职位标签和职位名，只在详情区域内取，避免左侧列表干扰
      if (state.detailRequiredTags.length || state.detailOptionalTags.length) {
        const root = getDetailRoot();
        const join = (selector) => Array.from(root.querySelectorAll(selector))
          .map((li) => li.textContent.trim()).join(" ");
        const jobName = findInDetail(BOSS.detailTitle)?.textContent?.trim() || "";
        const wideRaw = [descRaw, join(BOSS.detailSkillTags), jobName, join(BOSS.detailTags)].filter(Boolean).join(" ");
        const wideText = wideRaw.toLowerCase();

        const missedRequired = state.detailRequiredTags.find((kw) => !matchKeyword(wideText, kw));
        if (missedRequired) return skip(`缺少必须词"${missedRequired}"`, `缺少"${missedRequired}"`, true);
        if (state.detailRequiredTags.length) matchReason = `必须"${state.detailRequiredTags.join("、")}"`;

        if (state.detailOptionalTags.length) {
          const matchedOptional = state.detailOptionalTags.filter((kw) => matchKeyword(wideText, kw));
          if (!matchedOptional.length) return skip("详情没有命中任一关键词", "详情没有命中任一关键词", true);
          matchReason = (matchReason ? matchReason + "；" : "") + `任一"${matchedOptional.join("、")}"${quote(wideRaw, matchedOptional[0])}`;
        }
      }

    }

    // 只投指定招聘者：读不到招聘者职位时不拦截，避免页面结构变化导致全部被跳过
    if (state.recruiterIncludeTags.length) {
      const bossRaw = (findInDetail(BOSS.recruiterTitle)?.textContent || "").replace(/\s+/g, " ").trim();
      if (bossRaw) {
        const hitRecruiter = state.recruiterIncludeTags.find((kw) => matchKeyword(bossRaw.toLowerCase(), kw));
        if (!hitRecruiter) return skip(`招聘者"${bossRaw}"不在只投范围`, "招聘者职位不符", true);
        matchReason = (matchReason ? matchReason + "；" : "") + `招聘者"${bossRaw}"`;
      } else {
        matchReason = (matchReason ? matchReason + "；" : "") + "未读到招聘者职位，未做招聘者筛选";
      }
    }

    const result = await this.contact(run, item);
    if (result === "contacted") return skip("之前已沟通过", "已沟通过");
    if (result === "nobutton") {
      skip("没有沟通按钮");
      this.stopIfBroken(run, "chat");
      return;
    }
    state.currentIndex++;
    this.logContactResult(run, result, prefix, `已投递${matchReason ? `，匹配 ${matchReason}` : ""}`);
  },

  // 在已打开的详情里点“立即沟通”，处理上限弹窗和投递成功弹窗。返回：
  // delivered 投递成功 / contacted 之前沟通过 / nobutton 没有沟通按钮 / target 已达今日目标或上限 /
  // limit 遇到 BOSS 150 次上限 / unconfirmed 点了但没确认成功 / stopped 投递已停止。
  async contact(run, item) {
    const chatBtn = findInDetail(BOSS.chatButton);
    const btnText = chatBtn?.textContent.trim() || "";
    if (btnText !== BOSS.chatButtonNew) {
      if (btnText !== BOSS.chatButtonContacted) return "nobutton";
      run.guard.ok("chat");
      ContactedJobs.add(run.uid, item.jobId);
      return "contacted";
    }
    run.guard.ok("chat");
    if (!Delivery.isCurrent(run)) return "stopped";
    if (state.delivery.dailyCount >= Math.min(state.targetCount, CONFIG.DAILY_LIMIT)) return "target";
    chatBtn.click();

    // 检测 BOSS 限制弹窗（120 提醒 / 150 上限）
    const isLimitReached = await this.handleLimitDialogs(run);
    if (!Delivery.isCurrent(run, true)) return "stopped";
    if (isLimitReached) return "limit";

    const confirmed = await this.handleGreetingModal(item.company, item.logo, item.job, run);
    if (confirmed) {
      run.guard.ok("confirm");
      ContactedJobs.add(run.uid, item.jobId);
      SkippedJobs.remove(run.uid, [item.jobId]);
      run.delivered++;
      RunStatus.render();
      return "delivered";
    }
    return Delivery.isCurrent(run, true) ? "unconfirmed" : "stopped";
  },

  // 把 contact 的结果写进日志，需要停下来时停止投递。返回是否应继续处理下一个岗位。
  logContactResult(run, result, prefix, deliveredText) {
    if (result === "delivered") {
      this.log(`${prefix}，${deliveredText}`);
      return true;
    }
    if (result === "target") {
      this.log(state.delivery.dailyCount >= CONFIG.DAILY_LIMIT
        ? `${prefix}，今日已达每日上限 ${CONFIG.DAILY_LIMIT} 次，自动停止`
        : `${prefix}，已达今日目标 ${state.targetCount} 次，自动停止`);
      stopProcess(run);
      return false;
    }
    if (result === "limit") {
      this.log(`${prefix}，BOSS限制：今日沟通已达150次上限，自动停止`);
      stopProcess(run);
      return false;
    }
    if (result === "unconfirmed") {
      this.log(`${prefix}，未确认投递成功，未增加次数`);
      return !this.stopIfBroken(run, "confirm");
    }
    return false;
  },

  // 补投：用户在“可补投”里选中的岗位，按岗位 id 在当前页找到卡片，打开详情后跳过细筛直接沟通。
  // 其余和正常投递一样：计入今日次数，到今日目标或每日上限就停。
  async processRemedy(run) {
    const items = run.remedy;
    for (let i = 0; i < items.length; i++) {
      if (!Delivery.isCurrent(run)) return;
      const saved = items[i];
      const prefix = `第${i + 1}/${items.length}个，[${saved.address}][${saved.company}][${saved.title}][${saved.salary}]`;
      const card = findCardById(saved.jobId);
      if (!card) {
        this.log(`${prefix}，不在当前页，无法补投，已跳过`);
        continue;
      }
      const info = readCardInfo(card);
      const item = { el: card, jobId: saved.jobId, company: info.company || saved.company, logo: info.logo, job: info.title || saved.title };
      highlightCard(card);
      RunStatus.setActivity(`正在补投：${item.company} · ${item.job}`);
      const ready = await this.openDetail(item, run);
      if (!Delivery.isCurrent(run)) return;
      if (!ready) {
        this.log(`${prefix}，详情加载超时，已跳过`);
        if (this.stopIfBroken(run, "detail")) return;
        continue;
      }
      run.guard.ok("detail");
      const result = await this.contact(run, item);
      if (result === "contacted") {
        SkippedJobs.remove(run.uid, [saved.jobId]);
        this.log(`${prefix}，之前已沟通过，已跳过`);
        continue;
      }
      if (result === "nobutton") {
        this.log(`${prefix}，没有沟通按钮，已跳过`);
        if (this.stopIfBroken(run, "chat")) return;
        continue;
      }
      if (!this.logContactResult(run, result, prefix, "已投递，补投")) return;
    }
    if (Delivery.isCurrent(run)) stopProcess(run);
  },

  // 开始投递前检查职位列表能不能读出来，读不出关键信息时不启动。
  checkPageBeforeStart() {
    const cards = Array.from(document.querySelectorAll(BOSS.jobCard)).slice(0, 15);
    const { errors, warnings } = checkJobCards(cards.map(readCardInfo));
    warnings.forEach((warning) => this.log(`页面检查：${warning}`));
    if (!errors.length) return true;
    errors.forEach((error) => this.log(`页面检查异常：${error}`));
    showNotification("页面检查未通过，未开始投递，详见日志", "error");
    return false;
  },

  // 同一步连续失败到上限时停止投递，返回是否已停止。
  stopIfBroken(run, step) {
    if (!run.guard.fail(step) || !Delivery.isCurrent(run)) return false;
    run.failed = true;
    this.log(streakStopMessage(step));
    showNotification("投递已自动停止，详见日志", "error");
    stopProcess(run);
    return true;
  },

  // 一次投递任务结束后汇总结果，方便看出哪条规则过严。
  logRunSummary(run) {
    if (run.remedy) {
      this.log(`本次补投成功 ${run.delivered} 个，共选了 ${run.remedy.length} 个`);
      return;
    }
    const skips = Object.entries(run.skips).sort((a, b) => b[1] - a[1]);
    const skipped = skips.reduce((sum, [, n]) => sum + n, 0);
    if (!run.delivered && !skipped) return;
    const top = skips.slice(0, 6).map(([key, n]) => `${key} ${n}`).join("、");
    const more = skips.length > 6 ? " 等" : "";
    this.log(`本次共投递 ${run.delivered} 个，详情页跳过 ${skipped} 个${top ? `（${top}${more}）` : ""}`);
    const remediable = SkippedJobs.list(run.uid).length;
    if (remediable) this.log(`提示：被细筛跳过的 ${remediable} 个岗位可以点日志上方的「可补投」复查，误跳过的可以补投`);
  },

  // 点开岗位并等右侧详情切换到这个岗位，避免用上一个岗位的详情做筛选。
  // 判断依据：详情标题与卡片职位名一致，且标题或正文已变化（本来就显示该岗位时除外）。
  async openDetail(item, run) {
    const normalize = (text) => (text || "").replace(/\s+/g, "").toLowerCase();
    const wanted = normalize(item.job);
    const readDesc = () => cleanDesc(document.querySelector(BOSS.detailDesc));
    const detailTitle = () => [...document.querySelectorAll(BOSS.detailTitle)]
      .find((el) => !el.closest(`${BOSS.jobCard}, #boss-pro-panel`));
    const titleMatches = (el) => {
      const title = normalize(el?.textContent);
      return !!title && !!wanted && (title.includes(wanted) || wanted.includes(title));
    };
    const previousDesc = readDesc();
    const previousTitle = normalize(detailTitle()?.textContent);
    const alreadyShown = titleMatches(detailTitle());
    const startedAt = Date.now();

    item.el.scrollIntoView({ behavior: "smooth", block: "center" });
    item.el.click();

    const ready = await this.waitFor(() => {
      if (state.activeRun !== run || !state.isRunning) return true;
      const desc = readDesc();
      if (!desc) return false;
      const title = detailTitle();
      if (title && !titleMatches(title)) return false;
      const titleChanged = !!title && normalize(title.textContent) !== previousTitle;
      return alreadyShown || titleChanged || desc !== previousDesc;
    }, CONFIG.DETAIL_TIMEOUT, 200);

    // 保留最短操作间隔，不因页面加载快而点得过快。
    const rest = CONFIG.OPERATION_INTERVAL - (Date.now() - startedAt);
    if (rest > 0) await this.delay(rest);
    return !!ready;
  },

  async handleLimitDialogs(run) {
    // 阻塞等待上限弹窗出现（120 提醒 / 150 上限），超时 2 秒自动返回
    const dialog = await this.waitFor(() => document.querySelector(BOSS.limitDialog), 2000, 400);
    if (!Delivery.isCurrent(run, true)) return false;
    if (!dialog) return false;

    const bodyText = dialog.querySelector(BOSS.limitDialogBody)?.textContent || "";
    const is150Limit = BOSS.limitReachedTexts.some((text) => bodyText.includes(text));
    const sureBtn = dialog.querySelector(BOSS.dialogConfirm);
    if (sureBtn) sureBtn.click();

    // 可能还有第二层弹窗
    await this.delay(400);
    if (!Delivery.isCurrent(run, true)) return is150Limit;
    const second = document.querySelector(BOSS.limitDialog);
    if (second) {
      const btn2 = second.querySelector(BOSS.dialogConfirm);
      if (btn2) btn2.click();
    }
    return is150Limit;
  },

  async handleGreetingModal(companyName, companyLogo, jobTitle, run) {
    // 阻塞等待"留在此页"按钮出现（无渐入动画，直接等 DOM 就绪，超时 5 秒）
    let btn = await this.waitFor(() =>
      [...document.querySelectorAll(BOSS.dialogCancel)]
        .find((b) => b.textContent.trim() === BOSS.stayOnPageText),
      5000, 300
    );
    if (!btn || !Delivery.isCurrent(run, true)) return false;

    // 按钮出现即确认投递成功，立即更新计数（同步，保证外层限流判断正确）
    const today = new Date().toLocaleDateString();
    if (!Delivery.recordSuccess(run)) return false;

    // 异步写入日志、投递历史、公司图标（不阻塞后续岗位处理）
    const _companyName = companyName, _companyLogo = companyLogo;
    setTimeout(() => {
      // 更新公司投递历史
      if (_companyName) {
        if (!state.deliveryHistory[today]) state.deliveryHistory[today] = {};
        const entry = state.deliveryHistory[today][_companyName];
        const record = entry && typeof entry === "object" ? entry
          : { count: typeof entry === "number" ? entry : 0, logo: "" };
        record.count = (record.count || 0) + 1;
        if (_companyLogo && !record.logo) record.logo = _companyLogo;
        // 记下投了这家公司的哪些岗位（同名岗位只记一次）
        if (jobTitle) record.jobs = [...new Set([...(record.jobs || []), jobTitle])].slice(-20);
        state.deliveryHistory[today][_companyName] = record;
        try { localStorage.setItem("zdlDeliveryHistory", JSON.stringify(state.deliveryHistory)); } catch (e) {}
        if (_companyLogo && !state.companyLogos[_companyName]) {
          state.companyLogos[_companyName] = _companyLogo;
          try { localStorage.setItem("zdlCompanyLogos", JSON.stringify(state.companyLogos)); } catch (e) {}
        }
      }
    }, 0);

    // 重试点击：等 200ms 稳定后点击，若按钮仍在则重试（最多 3 次）
    for (let attempt = 0; attempt < 3 && btn; attempt++) {
      await this.delay(attempt === 0 ? 200 : 300);
      if (!Delivery.isCurrent(run, true)) break;
      btn.click();
      await this.delay(300);
      btn = [...document.querySelectorAll(BOSS.dialogCancel)]
        .find((b) => b.textContent.trim() === BOSS.stayOnPageText);
    }
    return true;
  },

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  // 阻塞等待：每隔 intervalMs 执行 predicate()，一旦返回真值立即 resolve
  // 超时返回 null。不会卡死 UI（基于 Promise + setTimeout）
  async waitFor(predicate, timeoutMs, intervalMs = 300) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = predicate();
      if (result) return result;
      await this.delay(intervalMs);
    }
    return null;
  },

  // 日志按结构渲染：岗位行拆成“职位名 + 公司/薪资 + 原因 + 状态标签”，其余为普通提示行
  renderLogItem(logEntry) {
    const item = document.createElement("div");
    item.className = "zdl-log-item";
    const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rich = (text) => escape(text).replace(/「([^」]{1,60})」/g, '<mark class="zdl-log-hit">$1</mark>');
    const head = logEntry.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
    const time = head ? head[1] : "";
    const message = head ? head[2] : logEntry;
    const timeEl = document.createElement("span");
    timeEl.className = "zdl-log-time";
    timeEl.textContent = time.replace(/^(\d{1,2}:\d{2}):\d{2}$/, "$1");
    timeEl.title = time;

    const job = message.match(/^第(\d+)\/(\d+)个，\[(.*?)\]\[(.*?)\]\[(.*?)\]\[(.*?)\]，([\s\S]*)$/);
    if (job) {
      const [, index, total, address, company, title, salary, rest] = job;
      const status = /已投递/.test(rest) ? "ok" : /已跳过/.test(rest) ? "skip" : "info";
      // 已投递：“已投递，匹配 xx”显示“匹配 xx”，“已投递，补投…”显示“补投…”
      const reason = status === "ok"
        ? rest.replace(/^已投递，匹配\s*/, "匹配 ").replace(/^已投递，?/, "")
        : rest.replace(/，?已跳过$/, "");
      item.classList.add("zdl-log-job", status);
      item.title = `第 ${index}/${total} 个`;
      const body = document.createElement("div");
      body.className = "zdl-log-body";
      const line = document.createElement("div");
      line.className = "zdl-log-line";
      const name = document.createElement("strong");
      name.textContent = title;
      const meta = document.createElement("span");
      meta.className = "zdl-log-meta";
      meta.textContent = [company, salary, address].filter(Boolean).join(" · ");
      line.append(name, meta);
      body.appendChild(line);
      if (reason) {
        const desc = document.createElement("div");
        desc.className = "zdl-log-desc";
        desc.innerHTML = rich(reason);
        body.appendChild(desc);
      }
      const badge = document.createElement("span");
      badge.className = `zdl-log-badge ${status}`;
      badge.textContent = status === "ok" ? "已投递" : status === "skip" ? "跳过" : "提示";
      item.append(timeEl, body, badge);
      return item;
    }

    const text = document.createElement("div");
    text.className = "zdl-log-text";
    // 多行消息：第一行直接显示，其余折叠
    const [first, ...rest] = message.split("\n");
    text.innerHTML = rich(first);
    if (rest.length) {
      const more = document.createElement("details");
      more.className = "zdl-log-more";
      const label = document.createElement("summary");
      label.textContent = "查看完整规则";
      const body = document.createElement("div");
      body.innerHTML = rest.map(rich).join("<br>");
      more.append(label, body);
      text.appendChild(more);
    }
    item.append(timeEl, text);
    if (/本次共投递|本次结束|自动停止|投递已停止|已离开职位页/.test(message)) item.classList.add("zdl-log-key");
    if (/投递已停止|失败|异常/.test(message)) item.classList.add("zdl-log-error");
    if (/^提示：/.test(message)) item.classList.add("zdl-log-tip");
    return item;
  },

  log(message) {
    const logEntry = `[${new Date().toLocaleTimeString()}] ${message}`;
    state.logEntries.push(logEntry);
    saveLogEntries();
    const logPanel = document.querySelector("#pro-log");
    if (logPanel) {
      // 用户往上翻看旧日志时不强行滚到底
      const atBottom = logPanel.scrollHeight - logPanel.scrollTop - logPanel.clientHeight < 40;
      logPanel.appendChild(this.renderLogItem(logEntry));
      if (atBottom) logPanel.scrollTop = logPanel.scrollHeight;
      UI._refreshLogTabs();
    }
  },

};

export function stopProcess(run = state.activeRun) {
  if (run && state.activeRun !== run) return;
  if (run) run.cancelled = true;
  state.isRunning = false;
  state.currentIndex = 0;
  Delivery.render();
}

export async function toggleProcess() {
  if (state.activeRun) {
    if (state.isRunning) {
      state.activeRun.userStopped = true;
      Core.log("已手动停止投递");
      stopProcess(state.activeRun);
    }
    return;
  }
  await runDelivery();
}

// 补投选中的岗位：items 为 SkippedJobs 里的记录
export async function startRemedy(items) {
  if (state.activeRun || !items.length) return;
  await runDelivery({ remedy: items });
}

async function runDelivery({ remedy = null } = {}) {
  Delivery.sync();
  if (!state.account.id || state.account.needsReload || state.account.error) {
    showNotification(state.account.error || (state.account.needsReload
      ? "账号已变化，请刷新页面后启动" : "未识别到账号，请确认登录后重试"), "error");
    return;
  }
  if (!isJobsPage()) {
    showNotification("请先切换到「职位」页再启动", "error");
    return;
  }
  if (!remedy && !hasFilterRules()) {
    const choice = await UI._confirm({
      title: "还没有设置筛选规则",
      message: "现在开始会对列表里的所有岗位发起沟通，包括销售、客服等不相关的岗位。建议先用求职向导生成一套基础规则。",
      actions: [
        { label: "仍然开始", value: "start" },
        { label: "打开求职向导", value: "wizard", primary: true },
      ],
    });
    if (choice === "wizard") {
      UI._showSettingsPanel();
      UI._openWizard();
    }
    if (choice !== "start" || state.activeRun) return;
  }
  if (!navigator.locks?.request) {
    showNotification("当前浏览器不支持投递任务锁，请使用新版 Chrome 或 Edge", "error");
    return;
  }
  const run = {
    uid: state.account.id, id: Math.random().toString(36).slice(2), mark: "",
    started: false, cancelled: false, delivered: 0, skips: {}, guard: createStreakGuard(), remedy,
  };
  state.activeRun = run;
  Delivery.render();
  // 浏览器会给后台标签页的定时器限速，投递会明显变慢：切到后台时提醒一次
  const onVisibilityChange = () => {
    if (!document.hidden || run.warnedHidden || state.activeRun !== run || !state.isRunning) return;
    run.warnedHidden = true;
    Core.log("提示：页面在后台时浏览器会限速，投递会明显变慢，建议让这个标签页保持在前台");
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  try {
    // 同一浏览器只运行一个投递任务，避免多标签重复投递及计数覆盖。
    await navigator.locks.request(DELIVERY_LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) throw new Error("本机已有其他标签页正在投递，请先停止该任务");
      Delivery.sync();
      if (run.cancelled || state.account.id !== run.uid || state.account.needsReload || state.account.error) {
        throw new Error("账号或投递记录已变化，请刷新页面后重试");
      }
      Delivery.prepare(run);
      if (state.delivery.dailyCount >= Math.min(state.targetCount, CONFIG.DAILY_LIMIT)) {
        Core.log(`当前账号今日已投递 ${state.delivery.dailyCount} 次，已达今日目标或上限${remedy ? "，无法补投" : ""}`);
        return;
      }
      if (remedy) {
        run.started = true;
        state.isRunning = true;
        Delivery.render();
        Core.log(`开始补投选中的 ${remedy.length} 个岗位，跳过细筛直接沟通`);
        await Core.processRemedy(run);
        return;
      }
      if (!Core.checkPageBeforeStart()) return;
      run.mark = `${run.uid}:${rulesKey()}`;
      state.jobList = [];
      state.currentIndex = 0;
      state.jobIndexOffset = 0;
      run.started = true;
      state.isRunning = true;
      Delivery.render();
      const startTime = new Date();
      Core.log(`开始自动海投，时间：${startTime.toLocaleTimeString()}`);
      Core.log(filterSummary());

      await Core.startProcessing(run);
    });
  } catch (error) {
    run.failed = true;
    Core.log(`投递已停止：${state.account.error || error.message}`);
    showNotification(state.account.error || error.message, "error");
  } finally {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    highlightCard(null);
    if (run.started) {
      Core.logRunSummary(run);
      RunStatus.finish(run.userStopped ? "已停止" : run.failed ? "投递异常" : "投递完成");
    }
    if (state.activeRun === run) {
      state.isRunning = false;
      state.activeRun = null;
      Delivery.render();
    }
  }
}

import { getStoredJSON } from "../config.js";
import { CoarsePreview } from "../preview.js";
import { JOB_DEGREES } from "../rules/job-type.js";
import { WIZARD_DIRECTIONS, WIZARD_STACKS, defaultWizardAnswers, generateWizardConfig } from "../rules/wizard.js";
import { getConfigChanges, getCurrentConfig, importConfig, parseConfig } from "../settings-store.js";
import { elements, state } from "../state.js";
import { UI_ICONS } from "./icons.js";

export const WizardMethods = {
  // 求职向导：几个选择题生成规则，应用前预览改动，应用后可在底部撤销
  // 求职向导：弹窗里回答几个选择题生成基础规则，应用前预览改动，应用后可在底部撤销
  _createWizardDialog() {
    const KEY = "zdlWizardAnswers";
    let answers = { ...defaultWizardAnswers(), ...getStoredJSON(KEY, {}) };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch (error) {} };

    const dialog = document.createElement("dialog");
    dialog.id = "zdl-wizard";
    dialog.className = "zdl-import-dialog zdl-wizard";
    dialog.setAttribute("aria-labelledby", "zdl-wizard-title");
    const header = document.createElement("div");
    header.className = "zdl-settings-header";
    const heading = document.createElement("div");
    heading.className = "zdl-wizard-heading";
    heading.innerHTML = `<span class="zdl-wizard-mark">${UI_ICONS.wand}</span>
        <span class="zdl-wizard-title"><strong id="zdl-wizard-title">求职向导</strong><small>选几个选项，快速生成基础筛选规则，之后可在筛选设置里微调</small></span>`;
    const closeBtn = this._createIconButton(UI_ICONS.close, () => dialog.close(), "关闭求职向导");
    header.append(heading, closeBtn);
    const body = document.createElement("div");
    body.className = "zdl-wizard-body zdl-import-body";
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); dialog.close(); });
    dialog.addEventListener("click", (event) => event.stopPropagation());
    dialog.addEventListener("close", () => elements.wizardBtn?.focus({ preventScroll: true }));

    const chips = (options, isOn, toggle) => {
      const row = document.createElement("div");
      row.className = "zdl-wizard-chips";
      options.forEach(([key, label]) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "zdl-status-chip";
        const check = document.createElement("span");
        check.className = "zdl-status-check";
        check.setAttribute("aria-hidden", "true");
        chip.append(check, label);
        const render = () => {
          chip.classList.toggle("active", isOn(key));
          chip.setAttribute("aria-pressed", String(isOn(key)));
        };
        chip.addEventListener("click", () => { toggle(key); render(); onChange(); });
        render();
        row.appendChild(chip);
      });
      return row;
    };
    const listToggle = (field) => (key) => {
      const list = answers[field];
      answers[field] = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    };
    const step = (index, title, desc, ...content) => {
      const wrap = document.createElement("div");
      wrap.className = "zdl-wizard-step";
      const label = document.createElement("div");
      label.className = "zdl-wizard-step-label";
      label.innerHTML = `<span class="zdl-wizard-index">${index}</span><span>${title}</span>${desc ? `<small>${desc}</small>` : ""}`;
      wrap.append(label, ...content);
      return wrap;
    };
    const checkbox = (label, field) => {
      const wrap = document.createElement("label");
      wrap.className = "zdl-wizard-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!answers[field];
      input.addEventListener("change", () => { answers[field] = input.checked; onChange(); });
      wrap.append(input, label);
      return wrap;
    };

    // ① 身份
    const identityRow = chips([["intern", "实习"], ["campus", "校招/应届"], ["social", "社招"]],
      (k) => answers.identities.includes(k), listToggle("identities"));
    const years = document.createElement("label");
    years.className = "zdl-wizard-inline";
    const yearsSelect = document.createElement("select");
    yearsSelect.className = "zdl-wizard-select";
    [["1", "1 年以内"], ["3", "3 年以内"], ["5", "5 年以内"], ["all", "不限年限"]].forEach(([value, text]) => yearsSelect.add(new Option(text, value)));
    yearsSelect.value = answers.maxYears;
    yearsSelect.addEventListener("change", () => { answers.maxYears = yearsSelect.value; onChange(); });
    years.append("社招接受经验要求", yearsSelect);
    // 学历是包含关系：选硕士 = 本科、硕士要求的岗位都投，不投要求博士的
    const degree = document.createElement("label");
    degree.className = "zdl-wizard-inline";
    const degreeSelect = document.createElement("select");
    degreeSelect.className = "zdl-wizard-select";
    degreeSelect.add(new Option("不限", ""));
    JOB_DEGREES.forEach(([value, text]) => degreeSelect.add(new Option(`${text}（含${value === "bachelor" ? "学历不限" : value === "master" ? "本科" : "硕士、本科"}要求）`, value)));
    degreeSelect.value = answers.degree;
    degreeSelect.addEventListener("change", () => { answers.degree = degreeSelect.value; onChange(); });
    degree.append("我的学历", degreeSelect);
    const step1 = step("1", "你在找什么", "可多选；没标类型的岗位会照常收集，打开详情后再判断", identityRow, years, degree);
    // ② 方向
    const step2 = step("2", "想做什么方向", "可多选，没选的方向会被排除",
      chips(WIZARD_DIRECTIONS.map((d) => [d.key, d.label]), (k) => answers.directions.includes(k), listToggle("directions")));
    // ③ 技术栈
    const step3 = step("3", "用什么技术栈", "可多选，可跳过；职位描述要提到其中之一",
      chips(WIZARD_STACKS.map((t) => [t.key, t.label]), (k) => answers.stacks.includes(k), listToggle("stacks")));
    // 其他
    const salary = document.createElement("label");
    salary.className = "zdl-wizard-inline";
    const salaryInput = document.createElement("input");
    salaryInput.type = "number";
    salaryInput.min = "0";
    salaryInput.placeholder = "不限";
    salaryInput.className = "zdl-wizard-number";
    salaryInput.value = answers.minSalary;
    salaryInput.addEventListener("change", () => { answers.minSalary = salaryInput.value; onChange(); });
    salary.append("最低月薪", salaryInput, "K（日薪按 24 天折算）");
    const extras = document.createElement("div");
    extras.className = "zdl-wizard-extras";
    extras.append(checkbox("可面议", "negotiable"), checkbox("只投 HR / 招聘人员", "onlyHr"),
      checkbox("只投 3 天内活跃的招聘者", "recentActive"), checkbox("排除销售、客服、运营等非技术岗", "excludeNonTech"));
    const step4 = step("4", "其他", "可选", salary, extras);

    // 生成与预览
    const actions = document.createElement("div");
    actions.className = "zdl-wizard-actions";
    const hint = document.createElement("span");
    hint.className = "zdl-wizard-hint";
    const generate = document.createElement("button");
    generate.type = "button";
    generate.className = "zdl-config-btn zdl-config-primary";
    generate.textContent = "预览改动";
    actions.append(hint, generate);
    const review = document.createElement("div");
    review.className = "zdl-wizard-review";
    review.hidden = true;

    let pendingJson = "";
    const onChange = () => {
      save();
      years.hidden = !answers.identities.includes("social");
      degree.hidden = !(answers.identities.includes("intern") || answers.identities.includes("campus"));
      const ready = answers.identities.length && answers.directions.length;
      generate.disabled = !ready;
      hint.textContent = ready ? "会覆盖岗位类型、职位名、技术栈、薪资和招聘者规则" : "至少选一个身份和一个方向";
      review.hidden = true;
      pendingJson = "";
    };

    generate.addEventListener("click", () => {
      let config;
      try {
        const json = JSON.stringify({ type: "zdl-boss-config", version: 1, config: { ...getCurrentConfig(), ...generateWizardConfig(answers) } });
        config = parseConfig(json);
        pendingJson = json;
      } catch (error) {
        review.hidden = false;
        review.textContent = `生成失败：${error.message}`;
        return;
      }
      const changes = getConfigChanges(config);
      review.hidden = false;
      review.replaceChildren();
      const title = document.createElement("p");
      title.className = "zdl-wizard-review-title";
      title.textContent = changes.length ? `将更新 ${changes.length} 项设置，排除公司、工作地、详情排除词和今日目标保持不变` : "和当前规则一致，无需应用";
      const diff = document.createElement("dl");
      diff.className = "zdl-config-diff";
      changes.forEach((change) => {
        const row = document.createElement("div");
        const dt = document.createElement("dt");
        dt.textContent = change.label;
        const dd = document.createElement("dd");
        const before = Object.assign(document.createElement("span"), { className: "zdl-config-before", textContent: change.before });
        const arrow = Object.assign(document.createElement("span"), { className: "zdl-config-arrow", textContent: "→" });
        const after = Object.assign(document.createElement("strong"), { textContent: change.after });
        dd.append(before, arrow, after);
        row.append(dt, dd);
        diff.appendChild(row);
      });
      const buttons = document.createElement("div");
      buttons.className = "zdl-wizard-actions";
      const cancel = this._createTextButton("取消", () => { review.hidden = true; });
      cancel.className = "zdl-config-btn";
      const apply = this._createTextButton("应用到规则", () => {
        try {
          const count = importConfig(pendingJson);
          this._refreshConfigFilters();
          this._updateConfigControls();
          this._setConfigStatus(count ? "已按向导生成规则，可撤销" : "规则无变化");
          dialog.close();
          if (elements.settingsPanel.hidden) this._showSettingsPanel();
          CoarsePreview.render();
        } catch (error) {
          title.textContent = error.message;
          title.classList.add("error");
        }
      });
      apply.className = "zdl-config-btn zdl-config-primary";
      apply.disabled = !changes.length || state.isRunning || !!state.activeRun;
      buttons.append(cancel, apply);
      review.append(title, diff, buttons);
      review.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    body.append(step1, step2, step3, step4, actions, review);
    dialog.append(header, body);
    onChange();
    dialog.zdlOpen = () => {
      if (dialog.open) return;
      onChange();
      try { dialog.showModal(); } catch (error) { return; }
      generate.focus({ preventScroll: true });
    };
    return dialog;
  },


  _openWizard() {
    this._hideConfigImport(false);
    elements.wizardDialog?.zdlOpen();
  },
};

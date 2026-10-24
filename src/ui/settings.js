import { RECRUITER_STATUS_OPTIONS, REPO_URL } from "../config.js";
import { Delivery } from "../delivery.js";
import { hasFilterRules, jobTypeFilterActive } from "../filters.js";
import { CoarsePreview } from "../preview.js";
import { JOB_TYPES, JOB_YEARS, normalizeJobTypeFilter } from "../rules/job-type.js";
import { invalidateConfigUndo, saveTags } from "../settings-store.js";
import { elements, state } from "../state.js";
import { UI_ICONS } from "./icons.js";
import { UI } from "./index.js";

export const collapseInstances = [];


export function renderTagList(container, tags, tagType = "", editIndex) {
  container.innerHTML = "";
  tags.forEach((tag, i) => {
    const tagEl = createTagElement(tag, i, tags, container, tagType, editIndex);
    container.appendChild(tagEl);
  });
  CoarsePreview.schedule();
}


export function createTagElement(text, index, tags, container, tagType = "", editIndex) {
  const el = document.createElement("span");
  el.className = "zdl-tag" + (tagType ? " " + tagType : "");
  if (editIndex === index) el.classList.add("editing");
  el.draggable = true;
  el.dataset.index = index;

  const textSpan = document.createElement("span");
  textSpan.className = "zdl-tag-text";
  textSpan.textContent = text;

  const removeBtn = document.createElement("button");
  removeBtn.className = "zdl-tag-remove";
  removeBtn.innerHTML = "&#x2715;";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tags.splice(index, 1);
    saveTags();
    renderTagList(container, tags, tagType);
  });

  el.append(textSpan, removeBtn);
  return el;
}


export function toggleStatusOption(value, chip) {
  const idx = state.settings.recruiterActivityStatus.indexOf(value);
  if (idx >= 0) state.settings.recruiterActivityStatus.splice(idx, 1);
  else state.settings.recruiterActivityStatus.push(value);
  chip.classList.toggle("active", idx < 0);
  chip.setAttribute("aria-pressed", String(idx < 0));
  invalidateConfigUndo();
  localStorage.setItem("recruiterActivityStatus", JSON.stringify(state.settings.recruiterActivityStatus));
  UI._refreshFilterCounts();
}

export const SettingsMethods = {
  _renderConfigTags() {
    renderTagList(elements.includeTagList, state.includeTags);
    renderTagList(elements.locationTagList, state.locationTags);
    renderTagList(elements.detailBlockedTagList, state.detailBlockedTags, "blocked");
    renderTagList(elements.detailRequiredTagList, state.detailRequiredTags, "required");
    renderTagList(elements.detailOptionalTagList, state.detailOptionalTags, "optional");
    renderTagList(elements.recruiterIncludeTagList, state.recruiterIncludeTags, "optional");
    renderTagList(elements.blockedCompanyTagList, state.blockedCompanies, "blocked");
    renderTagList(elements.coarseBlockedTagList, state.coarseBlockedTags, "blocked");
    renderTagList(elements.coarseRequiredTagList, state.coarseRequiredTags, "required");
    this._refreshFilterCounts();
  },


  _createSettingsPanel() {
    const panel = document.createElement("div");
    panel.className = "zdl-settings-panel";
    panel.id = "zdl-settings-panel";
    panel.hidden = true;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", "zdl-settings-title");
    const header = document.createElement("div");
    header.className = "zdl-settings-header";
    const title = document.createElement("h4");
    title.id = "zdl-settings-title";
    title.textContent = "筛选设置";
    const close = this._createIconButton(UI_ICONS.close, () => this._hideSettingsPanel(true), "关闭筛选设置");
    close.setAttribute("aria-label", "关闭筛选设置");
    elements.wizardBtn = document.createElement("button");
    elements.wizardBtn.type = "button";
    elements.wizardBtn.className = "zdl-wizard-btn";
    elements.wizardBtn.innerHTML = `${UI_ICONS.wand}<span>求职向导</span>`;
    elements.wizardBtn.title = "第一次使用？选身份、方向和技术栈，快速生成基础规则";
    elements.wizardBtn.addEventListener("click", () => this._openWizard());
    const tools = document.createElement("div");
    tools.className = "zdl-settings-tools";
    tools.append(elements.wizardBtn, close);
    header.append(title, tools);
    elements.settingsScroll = document.createElement("div");
    elements.settingsScroll.className = "zdl-scroll-wrap zdl-settings-scroll";
    // 还没有任何规则时提示新手用向导；有规则后自动隐藏
    elements.emptyRulesHint = document.createElement("div");
    elements.emptyRulesHint.className = "zdl-empty-rules";
    const hintText = document.createElement("span");
    hintText.innerHTML = "<strong>还没有筛选规则</strong>第一次使用可以用求职向导，选几个选项就能生成基础规则";
    const hintBtn = this._createTextButton("打开求职向导", () => this._openWizard());
    hintBtn.className = "zdl-config-btn zdl-config-primary";
    elements.emptyRulesHint.append(hintText, hintBtn);
    elements.settingsScroll.append(elements.emptyRulesHint, this._createFilterContainer());
    panel.append(header, CoarsePreview.create(), elements.settingsScroll, this._createConfigControls());
    return panel;
  },


  _showSettingsPanel(keepHistory = false) {
    this._hideConfigImport(false);
    this._hideAccountsPanel();
    if (!keepHistory) document.getElementById("zdl-history-panel")?.remove();
    elements.settingsPanel.hidden = false;
    CoarsePreview.render();
    this._positionSettingsPanel();
  },


  _hideSettingsPanel(restoreFocus = false) {
    this._hideConfigImport(false);
    if (!elements.settingsPanel) return;
    elements.settingsPanel.hidden = true;
    if (restoreFocus) elements.settingsBtn?.focus({ preventScroll: true });
  },


  _positionSettingsPanel(panel = elements.settingsPanel) {
    const main = elements.panel.getBoundingClientRect();
    const width = panel.getBoundingClientRect().width;
    const gap = 12;
    let left = main.left - width - gap;
    if (left < gap) left = main.right + gap;
    if (left + width > window.innerWidth - gap) left = (window.innerWidth - width) / 2;
    const top = Math.max(gap, Math.min(main.top, window.innerHeight - 120));
    panel.style.left = `${Math.max(gap, left)}px`;
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${Math.max(80, window.innerHeight - top - gap)}px`;
  },


  _refreshConfigFilters() {
    const previous = elements.settingsPanel.querySelector(".zdl-filter-container");
    collapseInstances.length = 0;
    previous.replaceWith(this._createFilterContainer());
    this._renderConfigTags();
    elements.targetInput.value = state.targetCount;
    Delivery.render();
    document.getElementById("zdl-history-panel")?.remove();
  },


  _createFilterContainer() {
    const container = document.createElement("div");
    container.className = "zdl-filter-container";

    const coarseRequiredResult = this._createTagSection("必须包含", state.coarseRequiredTags, "如：Java", "required", "职位名全部命中才收集");
    const includeResult = this._createTagSection("包含任一", state.includeTags, "如：后端", "optional", "职位名命中一个即可");
    const coarseBlockedResult = this._createTagSection("排除", state.coarseBlockedTags, "如：外包", "blocked", "职位名命中即跳过");
    const locationResult = this._createTagSection("工作地", state.locationTags, "如：海淀", "", "包含任一，留空不限");
    const blockedCompanyResult = this._createTagSection("排除公司", state.blockedCompanies, "如：某某科技", "blocked", "公司名命中即跳过");

    const blockedResult = this._createTagSection("排除", state.detailBlockedTags, "如：社招", "blocked", "详情命中即跳过");
    const requiredResult = this._createTagSection("必须包含", state.detailRequiredTags, "如：Spring", "required", "全部命中才投递");
    const optionalResult = this._createTagSection("包含任一", state.detailOptionalTags, "如：Java", "optional", "命中一个即可");
    const recruiterResult = this._createTagSection("只投这些招聘者", state.recruiterIncludeTags, "如：hr*|招聘|人事", "optional", "招聘者职位命中任一才投，留空不限");

    const recruiterSection = document.createElement("div");
    recruiterSection.className = "zdl-tag-section";
    const statusRow = document.createElement("div");
    statusRow.className = "zdl-tag-row";
    const statusLabel = this._createFilterLabel("活跃状态", "只投勾选的状态");
    const statusSelect = this._createRecruiterStatusSelect();
    statusRow.append(statusLabel, statusSelect);
    recruiterSection.append(statusRow);

    elements.includeInput = includeResult.input;
    elements.includeTagList = includeResult.tagList;
    elements.locationInput = locationResult.input;
    elements.locationTagList = locationResult.tagList;
    elements.detailBlockedInput = blockedResult.input;
    elements.detailBlockedTagList = blockedResult.tagList;
    elements.detailRequiredInput = requiredResult.input;
    elements.detailRequiredTagList = requiredResult.tagList;
    elements.detailOptionalInput = optionalResult.input;
    elements.detailOptionalTagList = optionalResult.tagList;
    elements.recruiterIncludeInput = recruiterResult.input;
    elements.recruiterIncludeTagList = recruiterResult.tagList;
    elements.blockedCompanyInput = blockedCompanyResult.input;
    elements.blockedCompanyTagList = blockedCompanyResult.tagList;
    elements.coarseBlockedInput = coarseBlockedResult.input;
    elements.coarseBlockedTagList = coarseBlockedResult.tagList;
    elements.coarseRequiredInput = coarseRequiredResult.input;
    elements.coarseRequiredTagList = coarseRequiredResult.tagList;

    const salaryActive = () => (state.salaryFilter.type !== "none" && !!(state.salaryFilter.min || state.salaryFilter.max))
      || state.salaryFilter.negotiable === false;
    container.append(
      this._createCollapsibleSection("岗位类型", "实习 / 校招 / 社招", [
        this._createJobTypeSection(),
      ], () => (jobTypeFilterActive() ? 1 : 0)),
      this._createCollapsibleSection("职位列表粗筛", "职位名、地点、公司、薪资", [
        coarseRequiredResult.section,
        includeResult.section,
        coarseBlockedResult.section,
        locationResult.section,
        blockedCompanyResult.section,
        this._createSalarySection(),
      ], () => state.coarseRequiredTags.length + state.includeTags.length + state.coarseBlockedTags.length
        + state.locationTags.length + state.blockedCompanies.length + (salaryActive() ? 1 : 0)),
      this._createCollapsibleSection("职位详情细筛", "打开详情后判断", [
        blockedResult.section,
        requiredResult.section,
        optionalResult.section,
      ], () => state.detailBlockedTags.length + state.detailRequiredTags.length + state.detailOptionalTags.length),
      this._createCollapsibleSection("招聘者筛选", "打开详情后判断", [
        recruiterSection,
        recruiterResult.section,
      ], () => state.recruiterIncludeTags.length
        + (state.settings.recruiterActivityStatus.length < RECRUITER_STATUS_OPTIONS.length ? 1 : 0))
    );

    return container;
  },


  _createJobTypeSection() {
    const section = document.createElement("div");
    const save = () => {
      invalidateConfigUndo();
      localStorage.setItem("zdlJobTypeFilter", JSON.stringify(state.jobTypeFilter));
      yearsSection.hidden = !state.jobTypeFilter.types.includes("social");
      this._refreshFilterCounts();
      CoarsePreview.schedule();
    };
    const chipRow = (options, list) => {
      const row = document.createElement("div");
      row.className = "zdl-status-tags";
      options.forEach(([key, label]) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "zdl-status-chip";
        chip.dataset.value = key;
        const check = document.createElement("span");
        check.className = "zdl-status-check";
        check.setAttribute("aria-hidden", "true");
        chip.append(check, label);
        const render = () => {
          const on = state.jobTypeFilter[list].includes(key);
          chip.classList.toggle("active", on);
          chip.setAttribute("aria-pressed", String(on));
        };
        chip.addEventListener("click", () => {
          const values = state.jobTypeFilter[list];
          const idx = values.indexOf(key);
          if (idx >= 0) values.splice(idx, 1);
          else values.push(key);
          state.jobTypeFilter = normalizeJobTypeFilter(state.jobTypeFilter);
          render();
          save();
        });
        render();
        row.appendChild(chip);
      });
      return row;
    };
    const make = (title, desc, options, list) => {
      const wrap = document.createElement("div");
      wrap.className = "zdl-tag-section";
      const row = document.createElement("div");
      row.className = "zdl-tag-row";
      row.append(this._createFilterLabel(title, desc), chipRow(options, list));
      wrap.appendChild(row);
      return wrap;
    };
    const typesSection = make("岗位类型", "取消勾选的类型不投", JOB_TYPES, "types");
    const rulesLink = document.createElement("a");
    rulesLink.className = "zdl-filter-link";
    rulesLink.href = `${REPO_URL}#岗位类型怎么判断`;
    rulesLink.target = "_blank";
    rulesLink.rel = "noopener noreferrer";
    rulesLink.textContent = "判断规则";
    rulesLink.title = "综合卡片经验标签、职位名和职位描述判断，点击查看完整规则";
    typesSection.querySelector(".zdl-filter-label").appendChild(rulesLink);
    const yearsSection = make("社招年限", "按岗位要求的最低年限", JOB_YEARS, "years");
    yearsSection.hidden = !state.jobTypeFilter.types.includes("social");
    section.append(typesSection, yearsSection);
    return section;
  },


  _createFilterLabel(title, desc = "") {
    const label = document.createElement("label");
    label.className = "zdl-filter-label";
    const titleEl = document.createElement("span");
    titleEl.className = "zdl-filter-title";
    titleEl.textContent = title;
    label.appendChild(titleEl);
    if (desc) {
      const descEl = document.createElement("span");
      descEl.className = "zdl-filter-desc";
      descEl.textContent = desc;
      label.appendChild(descEl);
    }
    return label;
  },


  _refreshFilterCounts() {
    if (elements.emptyRulesHint) elements.emptyRulesHint.hidden = hasFilterRules();
    collapseInstances.forEach((inst) => {
      if (!inst.countEl || !inst.count) return;
      const n = inst.count();
      inst.countEl.textContent = n ? `已设 ${n} 项` : "未设置";
      inst.countEl.classList.toggle("empty", !n);
    });
  },


  _createTagSection(labelText, tagsRef, placeholder, tagType = "", desc = "") {
    const section = document.createElement("div");
    section.className = "zdl-tag-section";

    const tagRow = document.createElement("div");
    tagRow.className = "zdl-tag-row";

    const label = this._createFilterLabel(labelText, desc);

    const tagList = document.createElement("div");
    tagList.className = "zdl-tag-list";

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "zdl-tag-add-trigger";
    toggleBtn.textContent = "+";
    toggleBtn.title = "添加标签";

    const tagInline = document.createElement("div");
    tagInline.className = "zdl-tag-inline";
    tagInline.append(tagList, toggleBtn);

    tagRow.append(label, tagInline);

    const inputRow = document.createElement("div");
    inputRow.className = "zdl-tag-input-row";
    inputRow.style.display = "none";

    const input = document.createElement("input");
    input.className = "zdl-tag-input";
    input.placeholder = placeholder;

    const addBtn = document.createElement("button");
    addBtn.className = "zdl-tag-add-btn";
    addBtn.textContent = "添加";

    let editingIndex = null;

    const showInput = (initialValue = "") => {
      input.value = initialValue;
      inputRow.style.display = "flex";
      toggleBtn.textContent = "\u2212";
      toggleBtn.dataset.visible = "true";
      addBtn.textContent = editingIndex !== null ? "修改" : "添加";
      checkInput();
      input.focus();
    };

    const hideInput = () => {
      inputRow.style.display = "none";
      toggleBtn.textContent = "+";
      toggleBtn.dataset.visible = "false";
      input.value = "";
      editingIndex = null;
      addBtn.textContent = "添加";
    };

    const doSave = () => {
      const val = input.value.trim();
      if (!val) { hideInput(); return; }
      if (editingIndex !== null) {
        if (tagsRef[editingIndex] !== val && tagsRef.includes(val)) { input.value = ""; return; }
        tagsRef[editingIndex] = val;
      } else {
        if (tagsRef.includes(val)) { input.value = ""; return; }
        tagsRef.push(val);
      }
      saveTags();
      renderTagList(tagList, tagsRef, tagType, editingIndex);
      hideInput();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); doSave(); }
      if (e.key === "Escape") { hideInput(); }
    });

    addBtn.addEventListener("click", doSave);

    toggleBtn.addEventListener("click", () => {
      toggleBtn.dataset.visible === "true" ? hideInput() : showInput();
    });

    // 标签点击：进入编辑模式（事件委托）
    tagRow.addEventListener("click", (e) => {
      const tagEl = e.target.closest(".zdl-tag");
      if (!tagEl) return;
      if (e.target.closest(".zdl-tag-remove")) return;
      e.stopPropagation(); // 阻止冒泡到 document → 避免 renderTagList 清 DOM 后触发面板收起
      const idx = parseInt(tagEl.dataset.index, 10);
      if (!isNaN(idx)) {
        if (editingIndex === idx) {
          // 再次点击同一标签 → 取消编辑
          hideInput();
          renderTagList(tagList, tagsRef, tagType);
        } else {
          editingIndex = idx;
          showInput(tagsRef[idx]);
          renderTagList(tagList, tagsRef, tagType, idx);
        }
      }
    });

    // 标签拖拽排序（事件委托）
    let dragSrcIdx = null;
    tagRow.addEventListener("dragstart", (e) => {
      const tagEl = e.target.closest(".zdl-tag");
      if (!tagEl) return;
      dragSrcIdx = parseInt(tagEl.dataset.index, 10);
      e.dataTransfer.effectAllowed = "move";
      tagEl.classList.add("dragging");
    });
    tagRow.addEventListener("dragend", () => {
      tagRow.querySelectorAll(".zdl-tag.dragging").forEach((t) => t.classList.remove("dragging"));
      tagRow.querySelectorAll(".zdl-tag.drag-over").forEach((t) => t.classList.remove("drag-over"));
    });
    tagRow.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const tagEl = e.target.closest(".zdl-tag");
      if (tagEl) {
        tagRow.querySelectorAll(".zdl-tag.drag-over").forEach((t) => t.classList.remove("drag-over"));
        tagEl.classList.add("drag-over");
      }
    });
    tagRow.addEventListener("drop", (e) => {
      e.preventDefault();
      const tagEl = e.target.closest(".zdl-tag");
      if (!tagEl || dragSrcIdx === null) return;
      const targetIdx = parseInt(tagEl.dataset.index, 10);
      if (!isNaN(targetIdx) && dragSrcIdx !== targetIdx) {
        const item = tagsRef.splice(dragSrcIdx, 1)[0];
        tagsRef.splice(targetIdx, 0, item);
        saveTags();
        renderTagList(tagList, tagsRef, tagType, editingIndex);
      }
      dragSrcIdx = null;
    });

    const hint = document.createElement("p");
    hint.className = "zdl-tag-hint";
    hint.innerHTML = "英文按整词匹配（java 不含 javascript）；末尾加 <code>*</code> 匹配前缀，如 <code>spring*</code>；"
      + "多种写法用 <code>|</code> 隔开，如 <code>前端|客户端</code>";

    const hintHTML = hint.innerHTML;
    const checkInput = () => {
      const val = input.value.trim();
      let invalid = false;
      if (/[.*+?^${}()|[\]\\]/.test(val)) {
        try { new RegExp(val); } catch (error) { invalid = true; }
      }
      if (invalid === hint.classList.contains("warn")) return;
      hint.classList.toggle("warn", invalid);
      if (invalid) hint.textContent = "这不是有效的正则写法，会按普通文字匹配";
      else hint.innerHTML = hintHTML;
    };
    input.addEventListener("input", checkInput);

    inputRow.append(input, addBtn, hint);
    section.append(tagRow, inputRow);

    return { section, tagList, input };
  },


  _createSalarySection() {
    const section = document.createElement("div");
    section.className = "zdl-tag-section";

    const row = document.createElement("div");
    row.className = "zdl-tag-row";

    const label = this._createFilterLabel("薪资范围", "月薪，留空表示不限；日薪按 24 天折算");
    const sf = state.salaryFilter;
    const makeInput = (value, placeholder, aria) => {
      const input = document.createElement("input");
      input.className = "zdl-salary-input";
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.inputMode = "numeric";
      input.placeholder = placeholder;
      input.value = value;
      input.setAttribute("aria-label", aria);
      return input;
    };
    // 兼容旧配置：按类型决定显示哪一边的数值
    const minInput = makeInput(sf.type === "range" || sf.type === "atLeast" ? sf.min : "", "不限", "最低月薪（K）");
    const maxInput = makeInput(sf.type === "range" || sf.type === "atMost" ? sf.max : "", "不限", "最高月薪（K）");

    const field = (input) => {
      const wrap = document.createElement("label");
      wrap.className = "zdl-salary-field";
      const unit = document.createElement("span");
      unit.className = "zdl-salary-unit";
      unit.textContent = "K";
      wrap.append(input, unit);
      return wrap;
    };
    const sep = document.createElement("span");
    sep.className = "zdl-salary-sep";
    sep.textContent = "至";
    const summary = document.createElement("span");
    summary.className = "zdl-salary-summary";

    const clean = (input) => {
      const n = parseInt(input.value, 10);
      input.value = Number.isFinite(n) && n > 0 ? String(n) : "";
      return input.value;
    };
    // 面议岗位是否收集；默认勾选，和以前“面议不拦截”的行为一致
    const negotiable = document.createElement("button");
    negotiable.type = "button";
    negotiable.className = "zdl-status-chip zdl-salary-negotiable";
    negotiable.title = "勾选后，薪资写着“面议”的岗位也会收集";
    const negotiableCheck = document.createElement("span");
    negotiableCheck.className = "zdl-status-check";
    negotiableCheck.setAttribute("aria-hidden", "true");
    negotiable.append(negotiableCheck, "可面议");
    const renderNegotiable = () => {
      const on = state.salaryFilter.negotiable !== false;
      negotiable.classList.toggle("active", on);
      negotiable.setAttribute("aria-pressed", String(on));
    };
    negotiable.addEventListener("click", () => {
      state.salaryFilter.negotiable = state.salaryFilter.negotiable === false;
      renderNegotiable();
      saveSalary();
    });

    const renderSummary = (min, max) => {
      const range = min && max ? `${min}–${max}K` : min ? `${min}K 以上` : max ? `${max}K 以下` : "不限";
      summary.textContent = state.salaryFilter.negotiable === false ? `${range} · 不含面议` : range;
      summary.classList.toggle("empty", !min && !max && state.salaryFilter.negotiable !== false);
    };
    const saveSalary = () => {
      let min = clean(minInput), max = clean(maxInput);
      if (min && max && Number(min) > Number(max)) {
        [min, max] = [max, min];
        minInput.value = min;
        maxInput.value = max;
      }
      state.salaryFilter.type = min && max ? "range" : min ? "atLeast" : max ? "atMost" : "none";
      state.salaryFilter.min = min;
      state.salaryFilter.max = max;
      renderSummary(min, max);
      invalidateConfigUndo();
      localStorage.setItem("salaryFilter", JSON.stringify(state.salaryFilter));
      this._refreshFilterCounts();
      CoarsePreview.schedule();
    };
    minInput.addEventListener("change", saveSalary);
    maxInput.addEventListener("change", saveSalary);
    [minInput, maxInput].forEach((input) => input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
    }));

    renderNegotiable();
    renderSummary(minInput.value, maxInput.value);
    row.append(label, field(minInput), sep, field(maxInput), negotiable, summary);
    section.appendChild(row);
    return section;
  },


  _createRecruiterStatusSelect() {
    const container = document.createElement("div");
    container.id = "recruiter-status-select";
    container.className = "zdl-status-tags";

    RECRUITER_STATUS_OPTIONS.forEach((value) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "zdl-status-chip";
      chip.dataset.value = value;
      const active = state.settings.recruiterActivityStatus.includes(value);
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-pressed", String(active));

      const check = document.createElement("span");
      check.className = "zdl-status-check";
      check.setAttribute("aria-hidden", "true");

      const text = document.createElement("span");
      text.textContent = value;

      chip.append(check, text);

      chip.addEventListener("click", () => {
        toggleStatusOption(value, chip);
      });

      container.appendChild(chip);
    });

    return container;
  },


  _createCollapsibleSection(title, desc, children, count) {
    const wrapper = document.createElement("div");
    wrapper.className = "zdl-filter-group";

    const header = document.createElement("div");
    header.className = "zdl-collapse-header";

    const arrow = document.createElement("span");
    arrow.className = "zdl-collapse-arrow";
    arrow.textContent = "▶";

    const label = document.createElement("span");
    label.className = "zdl-collapse-title";
    label.textContent = title;

    const descEl = document.createElement("span");
    descEl.className = "zdl-collapse-desc";
    descEl.textContent = desc;

    const countEl = document.createElement("span");
    countEl.className = "zdl-collapse-count";

    header.append(arrow, label, descEl, countEl);

    const body = document.createElement("div");
    body.className = "zdl-collapse-body collapsed";

    children.forEach((child) => body.appendChild(child));

    const instance = { body, arrow, isOpen: false, countEl, count };
    collapseInstances.push(instance);

    header.addEventListener("click", () => {
      if (instance.isOpen) {
        instance.isOpen = false;
        body.classList.add("collapsed");
        arrow.textContent = "▶";
      } else {
        collapseInstances.forEach((inst) => {
          if (inst.isOpen) {
            inst.isOpen = false;
            inst.body.classList.add("collapsed");
            inst.arrow.textContent = "▶";
            inst.body.querySelectorAll(".zdl-tag-input-row").forEach((row) => { row.style.display = "none"; });
            inst.body.querySelectorAll(".zdl-tag-add-trigger").forEach((btn) => { btn.textContent = "+"; btn.dataset.visible = "false"; });
          }
        });
        instance.isOpen = true;
        body.classList.remove("collapsed");
        arrow.textContent = "▼";
      }
    });

    wrapper.append(header, body);
    return wrapper;
  },
};

// 脚本读取 BOSS 页面时用到的选择器和按钮文字都在这里。BOSS 改版后先改这一个文件。
// 自检（self-check.js）也按这里的定义检查页面。
export const BOSS = {
  // 左侧职位列表卡片
  jobCard: "li.job-card-box",
  cardTitle: ".job-name",
  cardCompany: ".boss-name",
  cardAddress: [".job-address-desc", ".company-location", ".job-area"], // 按顺序取第一个找到的
  cardSalary: ".job-salary",
  cardLogo: ".boss-logo img",
  cardBadgeIcon: ".job-tag-icon", // alt 含“猎头”的是猎头岗位
  cardTags: ".tag-list li",
  cardLink: "a[href*='job_detail']",

  // 右侧职位详情
  detailDesc: ".job-detail-body .desc",
  detailRoot: ".job-detail-container, .job-detail-box",
  detailTitle: ".job-name",
  detailTags: ".tag-list li", // 经验、学历
  detailSkillTags: ".job-label-list li",
  recruiterOnline: ".boss-online-tag",
  recruiterActive: ".boss-active-time",
  recruiterTitle: ".boss-info-attr",
  chatButton: "a.op-btn-chat",
  chatButtonNew: "立即沟通",
  chatButtonContacted: "继续沟通",

  // 点“立即沟通”后的弹窗
  limitDialog: ".chat-block-dialog",
  limitDialogBody: ".chat-block-body",
  limitReachedTexts: ["150", "休息一下", "无法进行沟通"], // 弹窗正文含其一表示今日已达上限
  dialogConfirm: ".default-btn.sure-btn",
  dialogCancel: ".default-btn.cancel-btn",
  stayOnPageText: "留在此页", // 投递成功弹窗里的按钮
};

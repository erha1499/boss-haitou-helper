export const CSS = `
.zdl-tutorial{position:fixed;inset:0;box-sizing:border-box;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;color:#1f2937;font-family:var(--zdl-font);overflow:hidden}
.zdl-tutorial::backdrop{background:transparent}
.zdl-tutorial-focus{position:fixed;box-sizing:border-box;border:2px solid var(--zdl-primary);border-radius:7px;box-shadow:0 0 0 9999px rgba(15,23,42,.42);pointer-events:none}
.zdl-tutorial-arrow{position:fixed;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.zdl-tutorial-line{fill:none;stroke:var(--zdl-primary);stroke-width:2.5}
.zdl-tutorial-card{position:fixed;box-sizing:border-box;width:min(280px,calc(100vw - 24px));max-height:calc(100vh - 24px);padding:14px 16px;border:1px solid #bfdbfe;border-radius:12px;background:#fff;box-shadow:0 8px 32px rgba(15,23,42,.2);overflow-y:auto}
.zdl-tutorial-header{display:flex;justify-content:space-between;align-items:center;gap:12px}
.zdl-tutorial-step{font:600 12px/1.5 ui-monospace,monospace;color:var(--zdl-primary)}
.zdl-tutorial-close{width:24px;height:24px;padding:0;border:0;border-radius:50%;background:var(--zdl-secondary);color:var(--zdl-neutral);font-size:20px;line-height:1;cursor:pointer}
.zdl-tutorial h2{margin:6px 0;font-size:16px;line-height:1.5;font-weight:600;color:#1f2937}
.zdl-tutorial-desc{margin:0;font-size:14px;line-height:1.65;color:#4b5563}
.zdl-tutorial-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:14px}
.zdl-tutorial-navigation{display:flex;gap:6px}
.zdl-tutorial-btn{padding:5px 9px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#4b5563;font-size:12px;line-height:1.5;cursor:pointer;white-space:nowrap}
.zdl-tutorial-btn.primary{background:var(--zdl-primary);border-color:var(--zdl-primary);color:#fff}
.zdl-tutorial-btn:disabled{opacity:.4;cursor:default}
.zdl-tutorial-btn:focus-visible,.zdl-tutorial-close:focus-visible{outline:2px solid var(--zdl-primary);outline-offset:2px}
.zdl-config-controls{flex-shrink:0;margin-top:12px;padding-top:12px;border-top:1px solid var(--zdl-border)}
.zdl-config-row{display:flex;align-items:center;gap:10px}
.zdl-config-buttons{display:flex;gap:6px;flex-shrink:0;margin-left:auto}
.zdl-config-controls .zdl-config-btn{min-height:28px;padding:3px 10px;border-color:transparent;background:transparent;color:var(--zdl-text-3)}
.zdl-config-controls .zdl-config-btn:not(:disabled):hover{border-color:var(--zdl-border);background:var(--zdl-secondary);color:var(--zdl-primary)}
.zdl-config-controls .zdl-config-text{margin:0 0 8px}
.zdl-config-controls>div:first-child:not([hidden]){display:flex;flex-direction:column;align-items:flex-end;margin-bottom:8px}
.zdl-config-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:5px 11px;border:1px solid var(--zdl-border);border-radius:7px;background:#fff;color:var(--zdl-text-2);font-family:inherit;font-size:12px;font-weight:500;line-height:1.5;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
.zdl-config-btn:hover{border-color:#c3d4f7;background:var(--zdl-accent);color:var(--zdl-primary)}
.zdl-config-text{display:block;box-sizing:border-box;width:100%;margin:10px 0;padding:10px 12px;border:1px solid var(--zdl-border);border-radius:8px;background:var(--zdl-secondary);color:var(--zdl-ink);font:12px/1.7 ui-monospace,monospace;resize:vertical;user-select:text}
.zdl-config-status{flex:1;min-width:0;font-size:12px;line-height:1.5;color:var(--zdl-neutral);overflow-wrap:anywhere}
.zdl-config-status.error{color:#dc2626}
.zdl-config-btn[hidden]{display:none}
.zdl-config-btn:disabled{opacity:.5;cursor:default}
.zdl-config-scope{margin:8px 0 0;color:var(--zdl-neutral);font-size:11px;line-height:1.7}
.zdl-import-dialog{position:fixed;inset:0;box-sizing:border-box;width:min(480px,calc(100vw - 24px));height:fit-content;max-width:none;max-height:calc(100vh - 24px);margin:auto;padding:18px;border:1px solid var(--zdl-border);border-radius:14px;background:#fff;color:var(--zdl-ink);font-family:var(--zdl-font);box-shadow:0 18px 70px rgba(23,36,58,.2);overflow:hidden}
.zdl-import-dialog[open]{display:flex;flex-direction:column}
.zdl-import-dialog::backdrop{background:rgba(23,36,58,.3)}
.zdl-confirm-dialog{width:min(400px,calc(100vw - 24px))}
.zdl-confirm-message{margin:0;font-size:13px;line-height:1.7;color:var(--zdl-text-2)}
.zdl-import-body{min-height:0;overflow:auto}
.zdl-import-body .zdl-config-scope{margin-top:0}
.zdl-import-body .zdl-config-text{min-height:80px;max-height:32vh}
.zdl-import-feedback{margin:0 0 10px;color:var(--zdl-text-2);font-size:12px;line-height:1.7}
.zdl-import-feedback.error{color:#dc2626}
.zdl-config-diff{margin:0;font-size:12px;line-height:1.7}
.zdl-config-diff>div{padding:9px 0;border-top:1px solid var(--zdl-border)}
.zdl-config-diff dt{color:var(--zdl-ink);font-weight:500}
.zdl-config-diff dd{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin:3px 0 0;overflow-wrap:anywhere}
.zdl-config-diff dd>*{min-width:0;max-width:100%;overflow-wrap:anywhere}
.zdl-config-before{color:var(--zdl-neutral)}
.zdl-config-arrow{color:var(--zdl-text-4)}
.zdl-config-diff strong{color:var(--zdl-primary);font-weight:500}
.zdl-import-footer{display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;margin-top:14px;padding-top:14px;border-top:1px solid var(--zdl-border)}
.zdl-config-primary{border-color:var(--zdl-primary);background:var(--zdl-primary);color:#fff}
.zdl-config-primary:not(:disabled):hover{background:#255fd3;color:#fff}
.zdl-import-dialog button:focus-visible,.zdl-import-dialog textarea:focus-visible{outline:2px solid #a6c0f7;outline-offset:2px}

.zdl-delivery-controls{padding:0 0 16px;flex-shrink:0}
.zdl-delivery-target{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.zdl-settings-open{margin-left:auto;min-height:36px;color:var(--zdl-text-2);background:#fff}
.zdl-settings-panel{position:fixed;box-sizing:border-box;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 24px);padding:18px;border:1px solid var(--zdl-border);border-radius:14px;background:#fff;box-shadow:var(--zdl-shadow-lg);font-family:var(--zdl-font);z-index:2147483647;display:flex;flex-direction:column;overflow:hidden}
.zdl-settings-panel[hidden]{display:none}
.zdl-settings-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--zdl-border);flex-shrink:0}
.zdl-settings-header h4{margin:0;font-size:15px;line-height:1.5;font-weight:600;color:var(--zdl-ink)}
.zdl-settings-panel .zdl-settings-scroll{flex:1;min-height:120px;max-height:none;padding-right:3px;overflow:auto}
.zdl-panel{position:fixed;box-sizing:border-box;top:24px;right:16px;width:368px;height:540px;max-width:calc(100vw - 32px);max-height:calc(100vh - 48px);min-width:min(320px,calc(100vw - 32px));min-height:min(350px,calc(100vh - 48px));border-radius:16px;padding:18px;font-family:var(--zdl-font);z-index:2147483647;display:flex;flex-direction:column;background:#fff;box-shadow:var(--zdl-shadow-lg);border:1px solid var(--zdl-border);overflow:hidden}
.zdl-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:10px;row-gap:14px;margin-bottom:16px;flex-shrink:0}
.zdl-btn-group{display:flex;align-items:center;gap:4px;flex-shrink:0}
.zdl-title-wrap{display:flex;align-items:center;gap:9px;min-width:0}
.zdl-title-icon{width:32px;height:32px;flex:0 0 32px;padding:5px;box-sizing:border-box;background:linear-gradient(135deg,#5b8cff,#1f4fd6);border-radius:9px;display:flex;justify-content:center;align-items:center;color:#fff}
.zdl-title-text h3{margin:0;color:var(--zdl-ink);font-weight:600;font-size:16px;line-height:1.4;white-space:nowrap}
.zdl-filter-container{background:transparent;padding:0;margin:0}
.zdl-filter-label{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:12px;line-height:1.6;flex-shrink:0}
.zdl-filter-title{font-weight:500;color:var(--zdl-text-2)}
.zdl-filter-desc{color:var(--zdl-text-4);font-size:11px}
.zdl-btn-start{box-sizing:border-box;width:100%;min-height:42px;padding:10px 16px;background:var(--zdl-primary);color:#fff;border:none;border-radius:9px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:500;line-height:1.5;transition:background .15s,box-shadow .15s;display:flex;justify-content:center;align-items:center;box-shadow:0 3px 8px rgba(var(--zdl-primary-rgb),.15);margin:0 auto}
.zdl-btn-start:hover{background:#255fd3;box-shadow:0 4px 12px rgba(var(--zdl-primary-rgb),.22)}
.zdl-icon-btn{box-sizing:border-box;width:28px;height:28px;flex:0 0 28px;padding:5px;border-radius:7px;border:1px solid transparent;background:transparent;cursor:pointer;display:flex;justify-content:center;align-items:center;color:var(--zdl-text-3);transition:background .15s,color .15s,border-color .15s}
.zdl-icon-btn:hover{background:var(--zdl-secondary);color:var(--zdl-primary)}
.zdl-icon-btn.pinned{background:var(--zdl-accent);border-color:#dbe7ff;color:var(--zdl-primary)}
.zdl-icon-btn.svg-btn{padding:5px}
.zdl-log{flex:1;min-height:0;overflow-y:auto;background:transparent;padding:10px 12px;font-size:12px;line-height:1.8;margin:0;color:var(--zdl-text-2);user-select:text;scrollbar-width:thin;scrollbar-color:#c5d1e2 transparent}
.zdl-log::-webkit-scrollbar{width:6px}
.zdl-log::-webkit-scrollbar-track{background:var(--zdl-secondary);border-radius:4px}
.zdl-log::-webkit-scrollbar-thumb{background:#c5d1e2;border-radius:4px}
.zdl-scroll-wrap{flex:0 0 auto;overflow-y:auto;max-height:55%;min-height:60px;scrollbar-width:thin;scrollbar-color:#c5d1e2 transparent}
.zdl-scroll-wrap::-webkit-scrollbar{width:6px}
.zdl-scroll-wrap::-webkit-scrollbar-track{background:transparent;border-radius:4px}
.zdl-scroll-wrap::-webkit-scrollbar-thumb{background:#c5d1e2;border-radius:4px}
.zdl-resize-handle{position:absolute;right:4px;bottom:4px;width:12px;height:12px;cursor:nwse-resize;opacity:.55;background:linear-gradient(135deg,transparent 50%,#b4c1d4 50%,transparent 55%,#b4c1d4 55%,transparent 60%,#b4c1d4 60%);z-index:2}
.zdl-mini-icon{width:40px;height:40px;position:fixed;bottom:40px;left:40px;background:linear-gradient(135deg,#5b8cff,#1f4fd6);border-radius:50%;box-shadow:0 6px 16px rgba(var(--zdl-primary-rgb),.4);cursor:pointer;display:none;justify-content:center;align-items:center;color:#fff;z-index:2147483647;transition:transform .15s ease,box-shadow .15s ease;overflow:visible;user-select:none;padding:8px;box-sizing:border-box}
.zdl-status-tags{display:contents}
.zdl-status-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;font-family:inherit;border-radius:6px;font-size:12px;line-height:1.5;cursor:pointer;transition:background .15s,color .15s,border-color .15s;white-space:nowrap;background:#fff;color:var(--zdl-text-3);border:1px solid var(--zdl-border);user-select:none}
.zdl-status-chip:hover{background:var(--zdl-secondary)}
.zdl-status-chip.active{background:var(--zdl-accent);color:#315fba;border-color:#d4e2ff}
.zdl-status-chip.active:hover{background:#e1ebff}
.zdl-status-check{position:relative;width:12px;height:12px;flex-shrink:0;box-sizing:border-box;border:1.5px solid #b4c1d4;border-radius:3px;background:#fff;transition:background .15s,border-color .15s}
.zdl-status-chip.active .zdl-status-check{border-color:var(--zdl-primary);background:var(--zdl-primary)}
.zdl-status-chip.active .zdl-status-check::after{content:"";position:absolute;left:2.5px;top:0;width:3px;height:6px;border:solid #fff;border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
.zdl-notify{position:fixed;top:20px;left:50%;z-index:2147483647;box-sizing:border-box;max-width:min(420px,calc(100vw - 32px));padding:10px 16px 10px 14px;border:1px solid #e4eaf3;border-left:3px solid #16a34a;border-radius:9px;background:#fff;color:#17243a;font:13px/1.6 var(--zdl-font);box-shadow:0 10px 30px rgba(23,36,58,.16);opacity:0;transform:translate(-50%,-8px);transition:opacity .2s ease,transform .2s ease}
.zdl-notify.error{border-left-color:#dc2626}
.zdl-notify.show{opacity:1;transform:translate(-50%,0)}
.zdl-tag-section{margin-bottom:12px}
.zdl-collapse-body .zdl-tag-section+.zdl-tag-section{border-top:1px solid #edf0f5;padding-top:12px}
.zdl-tag-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.zdl-tag-list{display:contents}
.zdl-tag-add-trigger{width:24px;height:24px;border-radius:6px;border:1px dashed #c3cede;background:#fff;color:var(--zdl-text-3);cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;transition:border-color .15s,color .15s,background .15s;line-height:1;font-weight:500;vertical-align:middle}
.zdl-tag-add-trigger:hover{border-color:var(--zdl-primary);color:var(--zdl-primary);background:var(--zdl-accent)}
.zdl-tag{display:inline-flex;align-items:center;gap:5px;max-width:100%;box-sizing:border-box;padding:4px 7px;border-radius:6px;font-size:12px;line-height:1.5;cursor:pointer;transition:background .15s;white-space:normal;background:#edf3fe;color:#41638f;border:1px solid #dfe8f7}
.zdl-tag:hover{background:#e4ecfa}
.zdl-tag.blocked{background:#fff1f0;color:#ad4a4a;border:1px solid #f5dada}
.zdl-tag.blocked:hover{background:#fce5e3}
.zdl-tag.required{background:#fff7e8;color:#8a621e;border:1px solid #f1e4c8}
.zdl-tag.required:hover{background:#f9efd8}
.zdl-tag.optional{background:#edf3fe;color:#41638f;border:1px solid #dfe8f7}
.zdl-tag.optional:hover{background:#e4ecfa}
.zdl-collapse-header{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;line-height:1.6;font-weight:500;color:var(--zdl-text-2);padding:11px 12px;margin:0;border:0;user-select:none;transition:background .15s,color .15s}
.zdl-filter-container>div:first-child>.zdl-collapse-header{border-top:none;margin-top:0}
.zdl-collapse-header:hover{color:var(--zdl-primary);background:var(--zdl-secondary)}
.zdl-collapse-arrow{font-size:9px;width:10px;opacity:.65;flex-shrink:0}
.zdl-collapse-body{padding:12px;border-top:1px solid var(--zdl-border);overflow:visible}
.zdl-collapse-body.collapsed{display:none}
.zdl-tag-text{flex:1;min-width:0;overflow-wrap:anywhere}
.zdl-log-more{margin-top:2px}
.zdl-log-more>summary{cursor:pointer;color:var(--zdl-primary);font-size:11px;list-style:none;width:fit-content}
.zdl-log-more>summary::-webkit-details-marker{display:none}
.zdl-log-more>summary::after{content:" ▾"}
.zdl-log-more[open]>summary::after{content:" ▴"}
.zdl-log-more>div{margin-top:4px;padding:6px 8px;border-radius:6px;background:var(--zdl-secondary);color:var(--zdl-text-2);line-height:1.7;overflow-wrap:anywhere}
.zdl-tag-part+.zdl-tag-part::before{content:"/";margin:0 4px;opacity:.4}
.zdl-tag-name{font-weight:600}
.zdl-tag-meta{margin-left:6px;font-size:11px;opacity:.6;white-space:nowrap}
.zdl-tag-remove{width:14px;height:14px;border-radius:4px;border:none;background:transparent;color:inherit;opacity:.65;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}
.zdl-tag-remove:hover{background:rgba(23,36,58,.08);opacity:1}
.zdl-tag-input-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px;min-width:0}
.zdl-tag-hint{flex-basis:100%;margin:0;color:var(--zdl-text-4);font-size:11px;line-height:1.6}
.zdl-tag-hint.warn{color:#b45309}
.zdl-wizard [hidden]{display:none!important}
.zdl-wizard{width:min(540px,calc(100vw - 24px))}
.zdl-wizard-heading{display:flex;align-items:center;gap:10px;min-width:0}
.zdl-wizard-body{padding-right:4px}
.zdl-wizard-body>.zdl-wizard-step:first-child{border-top:0;padding-top:2px}
.zdl-settings-tools{display:flex;align-items:center;gap:6px;flex-shrink:0}
.zdl-wizard-btn{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px solid #cfdcf8;border-radius:999px;background:var(--zdl-accent);color:var(--zdl-primary);font:inherit;font-size:12px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background .15s,border-color .15s}
.zdl-wizard-btn:hover{border-color:#a9c2f5;background:#e3ecff}
.zdl-wizard-btn svg{width:14px;height:14px}
.zdl-empty-rules{display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 12px;border:1px dashed #bcd0f6;border-radius:10px;background:var(--zdl-accent)}
.zdl-empty-rules[hidden]{display:none}
.zdl-empty-rules>span{flex:1;min-width:0;color:var(--zdl-text-2);font-size:12px;line-height:1.6}
.zdl-empty-rules strong{display:block;color:var(--zdl-ink);font-size:13px;font-weight:600}
.zdl-empty-rules .zdl-config-btn{flex-shrink:0}
.zdl-wizard-mark{display:flex;width:28px;height:28px;flex:0 0 28px;box-sizing:border-box;padding:6px;border-radius:8px;background:var(--zdl-primary);color:#fff}
.zdl-wizard-mark svg{width:100%;height:100%}
.zdl-wizard-title{display:flex;flex-direction:column;min-width:0;line-height:1.45}
.zdl-wizard-title strong{font-size:13px;font-weight:600}
.zdl-wizard-title small{color:var(--zdl-text-3);font-size:11px}
.zdl-wizard-step{padding:10px 0;border-top:1px solid #e9eef7}
.zdl-wizard-step-label{display:flex;align-items:baseline;gap:6px;margin-bottom:7px;color:var(--zdl-ink);font-size:12px;font-weight:500}
.zdl-wizard-step-label small{color:var(--zdl-text-4);font-size:11px;font-weight:400}
.zdl-wizard-index{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:0 0 16px;border-radius:50%;background:var(--zdl-accent);color:var(--zdl-primary);font-size:10px;font-weight:600;align-self:center}
.zdl-wizard-chips{display:flex;flex-wrap:wrap;gap:6px}
.zdl-wizard-inline{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;color:var(--zdl-text-2);font-size:12px}
.zdl-wizard-select,.zdl-wizard-number{box-sizing:border-box;height:28px;padding:2px 6px;border:1px solid var(--zdl-border);border-radius:6px;background:#fff;color:var(--zdl-ink);font:inherit;font-size:12px}
.zdl-wizard-number{width:64px;text-align:center}
.zdl-wizard-check{display:flex;align-items:center;gap:6px;margin-top:7px;color:var(--zdl-text-2);font-size:12px;cursor:pointer}
.zdl-wizard-check input{width:14px;height:14px;margin:0;accent-color:var(--zdl-primary);cursor:pointer}
.zdl-wizard-extras{display:grid;grid-template-columns:1fr 1fr;column-gap:10px}
.zdl-wizard-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-top:10px;border-top:1px solid #e9eef7}
.zdl-wizard-hint{margin-right:auto;color:var(--zdl-text-4);font-size:11px;line-height:1.5}
.zdl-wizard-review{margin-top:10px;padding:10px 12px;border:1px solid var(--zdl-border);border-radius:9px;background:#fff}
.zdl-wizard-review-title{margin:0 0 6px;color:var(--zdl-text-2);font-size:12px;line-height:1.6}
.zdl-wizard-review-title.error{color:#dc2626}
.zdl-wizard-review .zdl-wizard-actions{border-top:0;padding-top:8px}
.zdl-preview{display:flex;flex-direction:column;flex-shrink:0;max-height:min(46vh,420px);overflow:hidden;margin:0 0 12px;padding:9px 11px;border:1px solid var(--zdl-border);border-radius:9px;background:var(--zdl-secondary);color:var(--zdl-text-2);font-size:12px;line-height:1.6}
.zdl-preview-head{display:flex;align-items:baseline;gap:8px}
.zdl-preview-summary{flex:1;min-width:0}
.zdl-preview-summary strong{color:var(--zdl-primary);font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
.zdl-preview-toggle{flex-shrink:0;padding:1px 7px;border:1px solid var(--zdl-border);border-radius:5px;background:#fff;color:var(--zdl-primary);font:inherit;font-size:11px;cursor:pointer}
.zdl-preview-toggle:hover{border-color:#c3d4f7}
.zdl-preview-toggle[hidden]{display:none}
.zdl-preview-types{margin:8px 0 0;color:var(--zdl-text-3);font-size:11px}
.zdl-preview-warn-btn{display:block;width:100%;margin-top:6px;padding:4px 8px;border:0;border-radius:6px;background:#fffbeb;color:#b45309;font:inherit;font-size:11px;text-align:left;cursor:pointer}
.zdl-preview-warn-btn::before{content:"!";display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-right:6px;border-radius:50%;background:#f59e0b;color:#fff;font-size:10px;font-weight:700;vertical-align:-1px}
.zdl-preview-warn-btn:hover{background:#fef3c7}
.zdl-preview-warn-list{margin-top:8px;padding:6px 8px;border-radius:6px;background:#fffbeb;color:#b45309;font-size:11px;line-height:1.6}
.zdl-preview-warn-item+.zdl-preview-warn-item{margin-top:6px}
.zdl-preview-job-link{margin:0 4px 0 0;padding:0 5px;border:0;border-radius:4px;background:#fef3c7;color:#92400e;font:inherit;font-size:11px;line-height:1.7;text-decoration:underline;text-decoration-color:rgba(146,64,14,.35);text-underline-offset:2px;cursor:pointer}
.zdl-preview-job-link:hover{background:#fde68a;text-decoration-color:currentColor}
.zdl-filter-link{margin-left:auto;color:var(--zdl-primary);font-size:11px;font-weight:400;text-decoration:none}
.zdl-filter-link:hover{text-decoration:underline}
.zdl-tag-section[hidden]{display:none}
.zdl-preview-head,.zdl-preview-warn{flex-shrink:0}
/* 明细内容多时只在预览区内部滚动，不把下方的规则区挤没 */
.zdl-preview-detail{flex:1 1 auto;min-height:0;margin-right:-8px;padding-right:8px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#c5d1e2 transparent}
.zdl-preview-detail::-webkit-scrollbar{width:6px}
.zdl-preview-detail::-webkit-scrollbar-thumb{background:#c5d1e2;border-radius:4px}
.zdl-preview-detail[hidden]{display:none}
.zdl-preview-reasons{margin:8px 0 6px;color:var(--zdl-text-3);font-size:11px;line-height:1.6}
.zdl-preview-list{border-top:1px solid var(--zdl-border);scrollbar-width:thin;scrollbar-color:#c5d1e2 transparent}
.zdl-preview-row{display:flex;align-items:baseline;gap:8px;width:100%;box-sizing:border-box;padding:5px 4px;border:0;border-bottom:1px solid #e9eef5;background:none;color:inherit;font:inherit;font-size:12px;text-align:left;cursor:pointer}
.zdl-preview-row:hover{background:#fff}
.zdl-preview-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--zdl-ink)}
.zdl-preview-company{flex-shrink:1;max-width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--zdl-text-4);font-size:11px}
.zdl-preview-status{flex-shrink:0;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--zdl-text-4);font-size:11px}
.zdl-preview-status.ok{color:#16a34a;font-weight:500}
.zdl-tag-hit{flex-shrink:0;min-width:14px;padding:0 4px;box-sizing:border-box;border-radius:8px;background:rgba(255,255,255,.75);font-size:10px;line-height:1.6;text-align:center;font-variant-numeric:tabular-nums}
.zdl-tag-hit.zero{opacity:.5}
.zdl-tag.conflict{box-shadow:inset 0 0 0 1.5px #f59e0b}
.zdl-tag.conflict .zdl-tag-hit{background:#fef3c7;color:#b45309;opacity:1}
li.job-card-box.zdl-preview-flash{outline:2px solid #f59e0b;outline-offset:-2px;border-radius:12px}
.zdl-log-hit{padding:0 2px;border-radius:3px;background:#fef3c7;color:#92400e}
.zdl-panel.zdl-panel-hidden{opacity:0;transform:scale(.06);pointer-events:none}
.zdl-mini-icon:hover{transform:scale(1.08);box-shadow:0 8px 20px rgba(var(--zdl-primary-rgb),.5)}
.zdl-mini-icon:focus-visible{outline:2px solid #a6c0f7;outline-offset:3px}
.zdl-mini-icon.zdl-pop{animation:zdl-pop .28s cubic-bezier(.34,1.56,.64,1) .14s both}
.zdl-mini-icon.running::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid var(--zdl-primary);animation:zdl-ring 1.8s ease-out infinite;pointer-events:none}
@keyframes zdl-pop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
/* 投递中：纸飞机轻轻上下飞，波浪轻轻起伏 */
.zdl-logo .zdl-plane,.zdl-logo .zdl-wave{transform-box:fill-box;transform-origin:center}
.zdl-is-running .zdl-title-icon .zdl-plane,.zdl-mini-icon.running .zdl-plane{animation:zdl-plane-fly 1.8s ease-in-out infinite}
.zdl-is-running .zdl-title-icon .zdl-wave,.zdl-mini-icon.running .zdl-wave{animation:zdl-wave-roll 1.8s ease-in-out infinite}
@keyframes zdl-plane-fly{0%,100%{transform:translate(0,0) rotate(0)}50%{transform:translate(2px,-3px) rotate(-4deg)}}
@keyframes zdl-wave-roll{0%,100%{transform:translateX(0)}50%{transform:translateX(-3px)}}
@keyframes zdl-ring{0%{opacity:.55;transform:scale(1)}100%{opacity:0;transform:scale(1.45)}}
@keyframes zdl-fade-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.zdl-settings-panel:not([hidden]),.zdl-history-panel{animation:zdl-fade-in .18s ease}
.zdl-btn-start.is-running{background:#fff;color:#c2410c;box-shadow:none;outline:1px solid #f3d3c2;outline-offset:-1px}
.zdl-btn-start.is-running:hover{background:#fff7f3}
.zdl-salary-field{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 8px 0 2px;border:1px solid var(--zdl-border);border-radius:6px;background:#fff;cursor:text;transition:border-color .15s,box-shadow .15s}
.zdl-salary-field:focus-within{border-color:#a6c0f7;box-shadow:0 0 0 2px var(--zdl-accent)}
.zdl-salary-field .zdl-salary-input{width:52px;height:30px;border:0;background:transparent;box-shadow:none;padding:0 4px;appearance:textfield;-moz-appearance:textfield}
.zdl-salary-field .zdl-salary-input::-webkit-inner-spin-button,.zdl-salary-field .zdl-salary-input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.zdl-salary-field .zdl-salary-input::placeholder{color:#b4c1d4}
.zdl-salary-summary{margin-left:auto;padding:0 8px;border-radius:10px;background:var(--zdl-accent);color:var(--zdl-primary);font-size:11px;font-weight:500;line-height:1.9;white-space:nowrap}
.zdl-salary-negotiable{height:32px;box-sizing:border-box}
.zdl-salary-band{flex-shrink:0;width:32px;color:var(--zdl-text-2);font-size:12px}
.zdl-salary-row{align-items:center}
.zdl-salary-row[hidden]{display:none}
.zdl-salary-summary.empty{background:transparent;color:var(--zdl-text-4);font-weight:400}
a.zdl-icon-btn{text-decoration:none}
li.job-card-box.zdl-current-card{outline:2px solid var(--zdl-primary);outline-offset:-2px;border-radius:12px}
.zdl-tag-hint code{padding:0 3px;border-radius:3px;background:var(--zdl-secondary);color:var(--zdl-text-2);font:11px ui-monospace,monospace}
.zdl-tag-input{box-sizing:border-box;min-width:0;flex:1;padding:7px 9px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;line-height:1.5;background:#fff;color:var(--zdl-ink);outline:none;transition:border-color .15s,box-shadow .15s}
.zdl-tag-input:focus{border-color:#a6c0f7;box-shadow:0 0 0 2px var(--zdl-accent)}
.zdl-tag-add-btn{padding:6px 11px;background:var(--zdl-primary);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap}
.zdl-tag-add-btn:hover{filter:brightness(1.1)}
.zdl-tag-inline{display:contents}
.zdl-salary-input{box-sizing:border-box;height:32px;padding:4px 7px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;background:#fff;color:var(--zdl-ink);outline:none;flex-shrink:0;text-align:center}
.zdl-salary-input:focus{border-color:var(--zdl-primary)}
.zdl-tag.editing{outline:2px solid var(--zdl-primary);outline-offset:2px;border-radius:14px}
.zdl-tag.dragging{opacity:0.4}
.zdl-tag.drag-over{box-shadow:inset 0 0 0 2px var(--zdl-primary)}
.zdl-history-panel{position:fixed;box-sizing:border-box;top:24px;right:16px;width:min(360px,calc(100vw - 24px));max-height:min(500px,calc(100vh - 48px));min-height:180px;border-radius:14px;padding:18px;font-family:var(--zdl-font);z-index:2147483646;display:flex;flex-direction:column;background:#fff;box-shadow:var(--zdl-shadow-lg);border:1px solid var(--zdl-border);overflow:hidden}
.zdl-hist-header{display:flex;justify-content:space-between;align-items:center;padding:0 0 12px;border-bottom:1px solid var(--zdl-border);flex-shrink:0}
.zdl-hist-header h4{margin:0;font-size:15px;line-height:1.5;font-weight:600;color:var(--zdl-ink)}
#zdl-hist-close{display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:5px;border:0;border-radius:7px;background:transparent;color:var(--zdl-text-3);cursor:pointer;box-sizing:border-box}
#zdl-hist-close:hover{background:var(--zdl-secondary);color:var(--zdl-primary)}
.zdl-hist-empty{text-align:center;padding:40px 20px;color:var(--zdl-text-4)}
.zdl-hist-date-row{display:flex;align-items:center;gap:8px;padding:12px 0;border-bottom:1px solid var(--zdl-border);flex-shrink:0;font-size:12px;color:var(--zdl-neutral)}
.zdl-hist-select{box-sizing:border-box;min-width:0;height:32px;padding:4px 7px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;color:var(--zdl-text-2);background:#fff;cursor:pointer;outline:none;flex:1}
.zdl-hist-select:focus{border-color:var(--zdl-primary)}
.zdl-hist-search{box-sizing:border-box;min-width:0;height:32px;padding:4px 9px;border:1px solid var(--zdl-border);border-radius:6px;font-size:12px;color:var(--zdl-ink);outline:none;width:42%;flex-shrink:0}
.zdl-hist-search:focus{border-color:var(--zdl-primary)}
.zdl-hist-list{flex:1;overflow-y:auto;padding:4px 0}
.zdl-hist-date{padding:6px 0 10px;color:var(--zdl-neutral);font-size:12px;border-bottom:1px solid #edf0f5}
.zdl-hist-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f3f8;transition:background .15s}
.zdl-hist-row:hover{background:#f9fafb}
.zdl-hist-company{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
.zdl-hist-logo{width:30px;height:30px;border-radius:7px;object-fit:cover;flex-shrink:0;background:var(--zdl-secondary)}
.zdl-hist-no-logo{width:30px;height:30px;border:1px solid var(--zdl-border);border-radius:7px;background:var(--zdl-accent);color:#5774a3;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;box-sizing:border-box}
.zdl-hist-names{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.4}
.zdl-hist-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1f2937}
.zdl-hist-jobs{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--zdl-text-4)}
.zdl-hist-count{flex-shrink:0;font-weight:500;color:var(--zdl-primary);font-size:12px;font-variant-numeric:tabular-nums}
.zdl-hist-action{flex-shrink:0;margin-left:8px}
.zdl-hist-block-btn{padding:3px 8px;border:1px solid #f2d5d5;border-radius:5px;font-size:11px;line-height:1.5;cursor:pointer;background:#fff;color:#ad4a4a;transition:background .15s}
.zdl-hist-block-btn:hover{background:#fef2f2}
.zdl-hist-block-btn.blocked{background:#fff1f0;border-color:#f2d5d5;color:#ad4a4a}
.zdl-panel,.zdl-settings-panel,.zdl-history-panel,.zdl-tutorial,.zdl-import-dialog,.zdl-entry,.zdl-notify{--zdl-border:#e4eaf3;--zdl-ink:#17243a;-webkit-font-smoothing:antialiased}
.zdl-entry{position:fixed;top:80px;right:24px;z-index:2147483646;box-sizing:border-box;width:min(280px,calc(100vw - 32px));padding:14px;border:1px solid #c9d9fb;border-top:3px solid var(--zdl-primary);border-radius:14px;background:#fff;box-shadow:0 16px 44px rgba(23,36,58,.2),0 2px 8px rgba(23,36,58,.06);font-family:var(--zdl-font);animation:zdl-entry-in .35s ease,zdl-entry-nudge .6s ease .9s 2}
.zdl-entry-head{display:flex;align-items:center;gap:10px}
.zdl-entry-icon{position:relative;display:flex;width:38px;height:38px;flex:0 0 38px;box-sizing:border-box;padding:7px;border-radius:11px;background:linear-gradient(135deg,#5b8cff,#1f4fd6)}
.zdl-entry-icon::after{content:"";position:absolute;inset:-4px;border-radius:14px;border:2px solid var(--zdl-primary);opacity:0;animation:zdl-entry-ring 1.6s ease-out .4s 3}
.zdl-entry-text{display:flex;flex-direction:column;flex:1;min-width:0;line-height:1.45}
.zdl-entry-text strong{font-size:14px;font-weight:600;color:var(--zdl-ink)}
.zdl-entry-text span{font-size:12px;color:var(--zdl-text-3)}
.zdl-entry-close{align-self:flex-start;width:24px;height:24px;flex:0 0 24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--zdl-text-4);font-size:18px;line-height:1;cursor:pointer}
.zdl-entry-close:hover{background:var(--zdl-secondary);color:var(--zdl-ink)}
.zdl-entry-link{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:38px;margin-top:12px;padding:8px 14px;border-radius:9px;background:var(--zdl-primary);color:#fff!important;font-size:13px;font-weight:500;text-decoration:none;box-shadow:0 3px 8px rgba(var(--zdl-primary-rgb),.22);transition:background .15s}
.zdl-entry-link:hover{background:#255fd3}
.zdl-entry-link:focus-visible,.zdl-entry-close:focus-visible{outline:2px solid #a6c0f7;outline-offset:2px}
@keyframes zdl-entry-in{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
@keyframes zdl-entry-nudge{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(3px)}}
@keyframes zdl-entry-ring{0%{opacity:.6;transform:scale(.9)}100%{opacity:0;transform:scale(1.35)}}
.zdl-collapse-title{flex-shrink:0}
.zdl-collapse-desc{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--zdl-text-4);font-size:11px;font-weight:400}
.zdl-collapse-count{margin-left:auto;flex-shrink:0;padding:0 7px;border-radius:10px;background:var(--zdl-accent);color:var(--zdl-primary);font-size:11px;font-weight:500;line-height:1.8;font-variant-numeric:tabular-nums}
.zdl-collapse-count.empty{background:transparent;color:var(--zdl-text-4);font-weight:400}
.zdl-salary-sep{flex-shrink:0;color:var(--zdl-text-4);font-size:13px}
.zdl-salary-unit{flex-shrink:0;color:var(--zdl-text-3);font-size:12px;white-space:nowrap}
.zdl-hist-row.blocked .zdl-hist-name,.zdl-hist-row.blocked .zdl-hist-count{color:var(--zdl-text-4)}
.zdl-hist-row.blocked .zdl-hist-logo,.zdl-hist-row.blocked .zdl-hist-no-logo{opacity:.45}
.zdl-title-text{min-width:0}
.zdl-account-status:empty{display:none}
.zdl-accounts-panel{width:min(380px,calc(100vw - 24px))}
.zdl-accounts-content{min-height:0;overflow:auto}
.zdl-accounts-summary{margin:0 0 12px;color:var(--zdl-text-2);font-size:12px;line-height:1.7;font-variant-numeric:tabular-nums}
.zdl-accounts-table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.7;font-variant-numeric:tabular-nums}
.zdl-accounts-table th,.zdl-accounts-table td{padding:9px 8px;border-bottom:1px solid var(--zdl-border);white-space:nowrap}
.zdl-accounts-table thead th{background:var(--zdl-secondary);color:var(--zdl-text-3);font-weight:500}
.zdl-accounts-table th:first-child{text-align:left;font-weight:500}
.zdl-accounts-table th:not(:first-child),.zdl-accounts-table td{text-align:right}
.zdl-accounts-table .zdl-current-account{background:var(--zdl-accent);color:var(--zdl-primary)}
.zdl-current-badge{display:inline-block;margin-left:6px;padding:0 4px;border-radius:4px;background:#fff;color:var(--zdl-primary);font-size:10px;vertical-align:middle}
.zdl-accounts-note{margin:12px 0 0;color:var(--zdl-neutral);font-size:11px;line-height:1.7}
.zdl-accounts-error{margin:0;color:#c05621;font-size:12px;line-height:1.7}
.zdl-btn-start:disabled{opacity:.55;cursor:default;box-shadow:none}
.zdl-target-label,.zdl-target-unit{font-size:12px;line-height:1.5;white-space:nowrap;color:var(--zdl-text-3)}
.zdl-target-input{box-sizing:border-box;width:64px;height:36px;flex:0 0 64px;padding:5px 8px;border:1px solid var(--zdl-border);border-radius:7px;background:var(--zdl-secondary);color:var(--zdl-ink);font:500 14px/1.5 ui-monospace,monospace;text-align:center;font-variant-numeric:tabular-nums}
.zdl-settings-open svg{width:14px;height:14px;flex-shrink:0}
.zdl-icon-btn svg,#zdl-hist-close svg{width:100%;height:100%;display:block}
.zdl-log-section{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--zdl-border);border-radius:10px;background:var(--zdl-secondary)}
.zdl-log-heading{display:flex;align-items:center;justify-content:space-between;padding:7px 8px 7px 12px;border-bottom:1px solid var(--zdl-border);font-size:11px;font-weight:500;line-height:1.5;color:var(--zdl-text-3);flex-shrink:0}
.zdl-log-tools{display:flex;align-items:center;gap:6px}
.zdl-log-tabs{display:flex;gap:2px;padding:2px;border-radius:7px;background:#fff;border:1px solid var(--zdl-border)}
.zdl-log-tab{padding:0 7px;border:0;border-radius:5px;background:transparent;color:var(--zdl-text-3);font:inherit;font-weight:400;line-height:1.7;cursor:pointer;white-space:nowrap}
.zdl-log-tab:hover{color:var(--zdl-primary)}
.zdl-log-tab.active{background:var(--zdl-accent);color:var(--zdl-primary);font-weight:500}
.zdl-log[data-filter="ok"] .zdl-log-item:not(.zdl-log-job.ok),.zdl-log[data-filter="skip"] .zdl-log-item:not(.zdl-log-job.skip){display:none}
.zdl-log[data-empty]::before{content:attr(data-empty);display:block;padding:16px 0;text-align:center;color:var(--zdl-text-4)}
.zdl-remedy-btn{padding:1px 8px;border:1px solid #f3d9b0;border-radius:6px;background:#fff8ec;color:#b45309;font:inherit;font-weight:500;line-height:1.6;cursor:pointer;white-space:nowrap}
.zdl-remedy-btn:hover{background:#fdeed4}
.zdl-remedy-btn[hidden]{display:none}
.zdl-remedy-hint{margin:10px 0 4px;font-size:12px;line-height:1.6;color:var(--zdl-text-3)}
.zdl-remedy-row{gap:10px;cursor:pointer;align-items:flex-start}
.zdl-remedy-row input{margin:3px 0 0;flex-shrink:0;cursor:pointer}
.zdl-remedy-row.missing{cursor:default;opacity:.6}
.zdl-remedy-reason{font-size:11px;color:#b45309;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.zdl-remedy-action{flex-shrink:0;padding:2px 8px;border:1px solid var(--zdl-border);border-radius:6px;background:#fff;color:var(--zdl-primary);font-size:11px;line-height:1.6;cursor:pointer;text-decoration:none;box-shadow:none}
.zdl-remedy-action:hover{background:var(--zdl-accent)}
.zdl-remedy-footer{display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;padding-top:12px;border-top:1px solid var(--zdl-border)}
.zdl-log-clear{padding:1px 7px;border:0;border-radius:5px;background:transparent;color:var(--zdl-text-4);font:inherit;font-weight:400;cursor:pointer}
.zdl-log-clear:hover{background:#fff;color:var(--zdl-primary)}
.zdl-filter-group{margin-bottom:10px;border:1px solid var(--zdl-border);border-radius:9px;overflow:hidden;background:#fff}
.zdl-filter-group:last-child{margin-bottom:0}
.zdl-tag-row>.zdl-filter-label{flex-basis:100%;margin-bottom:2px}
.zdl-collapse-body>.zdl-tag-section:last-child{margin-bottom:0}
.zdl-panel button:focus-visible,.zdl-settings-panel button:focus-visible,.zdl-history-panel button:focus-visible,.zdl-target-input:focus-visible,.zdl-config-text:focus-visible{outline:2px solid #a6c0f7;outline-offset:2px}
@media(max-width:380px){.zdl-panel{padding:14px}.zdl-header{column-gap:8px}.zdl-title-wrap{gap:7px}.zdl-title-icon{width:30px;height:30px;flex-basis:30px}.zdl-title-text h3{font-size:14px}.zdl-btn-group{gap:2px}.zdl-header .zdl-icon-btn{width:26px;height:26px;flex-basis:26px}.zdl-delivery-target{gap:6px}.zdl-settings-open{padding:5px 8px}.zdl-settings-panel{padding:14px}}
@media(prefers-reduced-motion:reduce){.zdl-panel *,.zdl-settings-panel *,.zdl-history-panel *{transition:none!important}.zdl-mini-icon,.zdl-mini-icon::after,.zdl-logo .zdl-plane,.zdl-logo .zdl-wave,.zdl-settings-panel,.zdl-history-panel,.zdl-notify{animation:none!important;transition:none!important}.zdl-entry,.zdl-entry-icon::after{animation:none}}

.zdl-title-text{display:flex;align-items:baseline;gap:6px;min-width:0}
.zdl-version{padding:0 5px;border-radius:5px;background:var(--zdl-secondary);color:var(--zdl-text-4);font:500 10px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}
.zdl-kpi{grid-column:1/-1;padding:12px 14px 13px;border:1px solid var(--zdl-border);border-radius:12px;background:linear-gradient(180deg,#fafcff 0%,#f4f7fd 100%)}
.zdl-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.zdl-kpi-label{color:var(--zdl-text-3);font-size:12px;font-weight:500;letter-spacing:.02em}
.zdl-kpi-main{display:flex;align-items:baseline;gap:6px;margin-top:4px;font-variant-numeric:tabular-nums}
.zdl-kpi-value{color:var(--zdl-ink);font-size:28px;font-weight:600;line-height:1.15;letter-spacing:-.02em}
.zdl-kpi-target{color:var(--zdl-text-3);font-size:13px}
.zdl-kpi-total{margin-left:auto;color:var(--zdl-text-3);font-size:12px}
.zdl-kpi-bar{height:6px;margin-top:10px;border-radius:999px;background:#e2e8f3;overflow:hidden}
.zdl-kpi-bar>i{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#5b8ff9,var(--zdl-primary));transition:width .5s cubic-bezier(.4,0,.2,1)}
.zdl-kpi-bar.done>i{background:linear-gradient(90deg,#34c27a,#16a34a)}
.zdl-accounts-toggle{display:inline-flex;align-items:center;gap:2px;max-width:60%;padding:2px 6px 2px 9px;border:1px solid var(--zdl-border);border-radius:999px;background:#fff;color:var(--zdl-text-2);font:inherit;font-size:11px;line-height:1.6;white-space:nowrap;cursor:pointer;transition:border-color .15s,color .15s,background .15s}
.zdl-accounts-toggle svg{width:12px;height:12px;flex-shrink:0;opacity:.6;transition:transform .15s}
.zdl-accounts-toggle:hover,.zdl-accounts-toggle[aria-expanded=true]{border-color:#c3d4f7;color:var(--zdl-primary)}
.zdl-accounts-toggle[aria-expanded=true] svg{transform:rotate(90deg)}
.zdl-accounts-label{overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.zdl-account-status{display:block;margin-top:8px;padding:5px 8px;border-radius:6px;background:#fff7ed;color:#c2410c;font-size:11px;line-height:1.6;overflow-wrap:anywhere}
.zdl-account-status:empty{display:none}
.zdl-control-btn{gap:8px;min-height:44px;font-size:14px;font-weight:600;letter-spacing:.02em;background:linear-gradient(180deg,#3b7bf5 0%,var(--zdl-primary) 100%);box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 6px 16px -6px rgba(var(--zdl-primary-rgb),.55)}
.zdl-control-btn:hover:not(:disabled){background:linear-gradient(180deg,#336fe6 0%,#255fd3 100%)}
.zdl-control-btn:active:not(:disabled){transform:translateY(1px)}
.zdl-control-btn svg{width:15px;height:15px;flex-shrink:0}
.zdl-run-status{margin-top:10px;padding:8px 10px;border-radius:8px;background:var(--zdl-secondary);border:1px solid var(--zdl-border);font-size:12px;line-height:1.6;color:var(--zdl-text-2)}
.zdl-run-status[hidden]{display:none}
.zdl-run-head{display:flex;align-items:center;gap:6px;font-weight:600;color:#1f2937}
.zdl-run-dot{width:7px;height:7px;border-radius:50%;background:#16a34a;box-shadow:0 0 0 0 rgba(22,163,74,.5);animation:zdl-run-pulse 1.6s infinite}
@keyframes zdl-run-pulse{0%{box-shadow:0 0 0 0 rgba(22,163,74,.45)}70%{box-shadow:0 0 0 6px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}
@media (prefers-reduced-motion:reduce){.zdl-run-dot{animation:none}}
.zdl-run-activity{color:var(--zdl-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zdl-control-btn.is-running{background:#fff;color:#c2410c;box-shadow:0 0 0 1px #f3d3c2 inset}
.zdl-control-btn.is-running:hover:not(:disabled){background:#fff7f3}
.zdl-log{padding:4px 12px 8px;line-height:1.6}
.zdl-log-item{display:grid;grid-template-columns:38px minmax(0,1fr) auto;column-gap:8px;padding:7px 0;border-bottom:1px solid #e9eef5;color:var(--zdl-text-2);overflow-wrap:anywhere}
.zdl-log-item:last-child{border-bottom:0}
.zdl-log-time{padding-top:1px;color:var(--zdl-text-4);font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
.zdl-log-text{grid-column:2/-1;font-size:12px}
.zdl-log-body{min-width:0}
.zdl-log-line{display:flex;align-items:baseline;gap:6px;min-width:0}
.zdl-log-line strong{flex:0 1 auto;max-width:72%;min-width:0;overflow:hidden;color:var(--zdl-ink);font-size:12px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}
.zdl-log-meta{flex:1 1 0;min-width:0;overflow:hidden;color:var(--zdl-text-4);font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.zdl-log-desc{margin-top:1px;color:var(--zdl-text-3);font-size:11px;line-height:1.6}
.zdl-log-badge{align-self:start;padding:0 7px;border-radius:999px;font-size:10.5px;font-weight:500;line-height:1.8;white-space:nowrap}
.zdl-log-badge.ok{background:#e9f8ef;color:#15803d}
.zdl-log-badge.skip{background:#f1f4f8;color:var(--zdl-text-3)}
.zdl-log-badge.info{background:#eef4ff;color:var(--zdl-primary)}
.zdl-log-item.zdl-log-key{margin:6px 0;padding:8px 10px;border:1px solid var(--zdl-border);border-radius:8px;background:#fff}
.zdl-log-item.zdl-log-key .zdl-log-text{color:var(--zdl-ink);font-weight:500}
.zdl-log-item.zdl-log-error .zdl-log-text{color:#b91c1c}
.zdl-log-item.zdl-log-tip .zdl-log-text{color:#b45309}
.zdl-log:empty::before{content:"还没有日志，开始投递后会在这里显示每个岗位的结果";display:block;padding:24px 8px;color:var(--zdl-text-4);font-size:12px;text-align:center}
`;

export function injectCSS() {
  if (document.getElementById("zdl-styles")) return;
  const style = document.createElement("style");
  style.id = "zdl-styles";
  style.textContent = CSS;
  document.head.appendChild(style);
}

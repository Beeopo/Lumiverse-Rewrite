var Cq=[{id:"expand",name:"Expand",order:0,prompt:"Expand the passage with more descriptive detail, sensory imagery, and action. Add no new plot events."},{id:"compress",name:"Compress",order:1,prompt:"Condense the passage to be more succinct, keeping every key event and beat."},{id:"thoughts",name:"Add Inner Thoughts",order:2,prompt:"Weave in the point-of-view character's inner thoughts and emotional reactions, in close POV."},{id:"dialogue",name:"Convert to Dialogue",order:3,prompt:"Convert the passage into natural spoken dialogue between the characters, carrying the same information through what they say and do."},{id:"active",name:"Passive to Active",order:4,prompt:"Convert passive-voice constructions to active voice."},{id:"diffwords",name:"Use Different Words",order:5,prompt:"Rephrase using different vocabulary and sentence structure, keeping the exact meaning and tone."},{id:"showdont",name:"Show, Don't Tell",order:6,prompt:`Show, don't tell: turn statements of emotion or state into concrete action, sensory detail, and behaviour. Example: "She was afraid" becomes "Her breath caught and her hands went cold."`},{id:"emotion",name:"Show More Emotion",order:7,prompt:"Heighten the emotional depth so the characters' feelings land more vividly. Do not change what happens."},{id:"transitions",name:"Fix Transitions",order:8,prompt:"Smooth the flow and transitions so sentences and ideas connect naturally."},{id:"noai",name:"Remove LLM-isms",order:9,prompt:`Remove AI-writing tells. Cut filler clichés ("a testament to", "the air was thick with", "couldn't help but", "a mix of X and Y"), purple metaphors, and uniform sentence rhythm. Vary sentence length and keep it plainly human. Add no new content.`},{id:"expdialogue",name:"Expand Dialogue",order:10,prompt:"Expand the existing dialogue with more back-and-forth, subtext, and distinct character voice."},{id:"romance",name:"Increase Romance",order:11,prompt:"Increase the romantic tension, chemistry, and intimacy between the characters."},{id:"grammar",name:"Grammar Fix",order:12,prompt:"Fix only grammar, spelling, and punctuation. Do not change wording, style, or content."}];var GJ=`You are a line editor rewriting a passage of fiction in place for an author.

Output rules:
- Output ONLY the rewritten passage. No preamble, notes, explanations, quotation marks, markdown, or code fences.
- Do not repeat or acknowledge these instructions.

Always:
- Apply the requested edit to the text inside <rewrite_this> only.
- Keep the same point of view and verb tense as the original.
- Keep every named character, plot fact, and continuity detail unchanged unless the edit explicitly calls for it.
- Match the voice and register of the surrounding prose.
`+`- Write the rewrite in the SAME LANGUAGE as the original — never translate it.
`+`- Preserve wrapping markdown or punctuation (*…*, "…", (…)) only when it is present in the original.
`+"- Treat anything inside <context>, <character>, <persona>, <lore>, <memory>, or <speaker> as reference only — never rewrite or quote it.",WJ=`You are a line editor. Rewrite the text inside <rewrite_this> as instructed.
`+`Output ONLY the rewritten passage — no preamble, notes, quotes, or markdown.
`+`Keep the original point of view, tense, characters, and continuity unless the edit says otherwise.
`+`Write in the same language as the original — never translate. Keep wrapping *…*/"…" only if present.
`+"Treat <context>, <character>, <persona>, <lore>, <memory>, and <speaker> as reference only; never rewrite or quote them.";function xq(Z){if(Z===null||typeof Z!=="object"||Array.isArray(Z))return{};let Y=Z,W={};if(Array.isArray(Y.customProfiles)){let F=Y.customProfiles.filter((O)=>O!==null&&typeof O==="object"&&!Array.isArray(O)&&typeof O.id==="string"&&typeof O.name==="string"&&typeof O.prompt==="string").slice(0,100);W.customProfiles=F}if(Array.isArray(Y.customPrompts))W.customPrompts=Y.customPrompts.filter((F)=>typeof F==="string").slice(0,100);if(Array.isArray(Y.hiddenProfiles))W.hiddenProfiles=Y.hiddenProfiles.filter((F)=>typeof F==="string").slice(0,100);let M=["usePrevMessages","speakerAware","useCharCard","useUserPersona","useMemory","useLorebook","concise","autoApply","showDiff"];for(let F of M)if(typeof Y[F]==="boolean")W[F]=Y[F];if(typeof Y.prevMessageCount==="number"&&Number.isFinite(Y.prevMessageCount))W.prevMessageCount=Math.max(1,Math.min(4,Math.round(Y.prevMessageCount)));if(typeof Y.lengthPct==="number"&&Number.isFinite(Y.lengthPct))W.lengthPct=Math.max(1,Math.min(1000,Math.round(Y.lengthPct)));if(typeof Y.historyDepth==="number"&&Number.isFinite(Y.historyDepth))W.historyDepth=Math.max(1,Math.min(100,Math.round(Y.historyDepth)));return W}function vq(Z){let Y=Z.trim();if(!Y)return 0;let W=(Y.match(/\S+/g)||[]).length,M=Y.replace(/\s+/g,"").length;if(M>0&&W<M/8)return Math.max(W,Math.round(M/2));return W}function QJ(){let Z=window.getSelection();if(!Z||Z.isCollapsed||Z.rangeCount===0)return null;let Y=Z.getRangeAt(0),W=Y.commonAncestorContainer,F=(W.nodeType===Node.ELEMENT_NODE?W:W.parentElement)?.closest('[data-component="MessageContent"]');if(!F)return null;let L=F.closest("[data-message-id]")?.getAttribute("data-message-id");if(!L)return null;let _=document.createRange();_.selectNodeContents(F);let z=_.toString(),K=document.createRange();K.selectNodeContents(F),K.setEnd(Y.startContainer,Y.startOffset);let k=K.toString().length,N=document.createRange();N.selectNodeContents(F),N.setEnd(Y.endContainer,Y.endOffset);let C=Math.min(N.toString().length,z.length),T=Z.toString();if(!T.trim())return null;return{cap:{chatId:"",messageId:L,R:z,rs:k,re:C},text:T}}function Tq(Z,Y,W,M){if(Z==="first")return{rs:Math.max(0,Math.min(W,Y)),re:Y};if(Z==="last")return{rs:0,re:Math.max(0,Math.min(M,Y))};return{rs:0,re:Y}}function ZJ(){let Z=window.getSelection();if(!Z||Z.isCollapsed||Z.rangeCount===0)return null;let Y=Z.getRangeAt(0),W=(z)=>(z.nodeType===Node.ELEMENT_NODE?z:z.parentElement)?.closest("[data-message-id]")??null,M=W(Y.startContainer);if(M&&M===W(Y.endContainer))return null;let F=Array.from(document.querySelectorAll('[data-component="MessageContent"]')),O=[];for(let z of F){let K=!1;try{K=Y.intersectsNode(z)}catch{K=!1}if(!K)continue;let N=z.closest("[data-message-id]")?.getAttribute("data-message-id");if(!N)continue;O.push({el:z,messageId:N})}if(new Set(O.map((z)=>z.messageId)).size<2)return null;let _=[];for(let z=0;z<O.length;z++){let{el:K,messageId:k}=O[z],N=document.createRange();N.selectNodeContents(K);let C=N.toString(),T=K.contains(Y.startContainer),qq=K.contains(Y.endContainer),$,y;if(T&&!qq){let B=document.createRange();B.selectNodeContents(K),B.setEnd(Y.startContainer,Y.startOffset),{rs:$,re:y}=Tq("first",C.length,B.toString().length,0)}else if(qq&&!T){let B=document.createRange();B.selectNodeContents(K),B.setEnd(Y.endContainer,Y.endOffset),{rs:$,re:y}=Tq("last",C.length,0,B.toString().length)}else if(T&&qq)return null;else({rs:$,re:y}=Tq("middle",C.length,0,0));let V=C.slice($,y);if(!V.trim())continue;_.push({messageId:k,R:C,rs:$,re:y,text:V})}if(_.length<2)return null;return{segments:_}}function zJ(Z){let W=document.querySelector(`[data-message-id="${CSS.escape(Z)}"]`)?.querySelector('[data-component="MessageContent"]');if(!W)return null;let M=document.createRange();return M.selectNodeContents(W),M.toString()}var HJ=125000,t=500;function XJ(Z,Y){let W=Z.split(/(\s+)/),M=Y.split(/(\s+)/);if(W.length>t*2)W=W.slice(0,t*2);if(M.length>t*2)M=M.slice(0,t*2);let F=W.length,O=M.length;if(F*O>t*t)return null;let L=[];for(let k=0;k<=F;k++)L.push(new Int32Array(O+1));for(let k=1;k<=F;k++)for(let N=1;N<=O;N++)L[k][N]=W[k-1]===M[N-1]?L[k-1][N-1]+1:Math.max(L[k-1][N],L[k][N-1]);let _=[],z=F,K=O;while(z>0||K>0)if(z>0&&K>0&&W[z-1]===M[K-1])_.unshift({t:"eq",v:W[z-1]}),z--,K--;else if(K>0&&(z===0||L[z][K-1]>=L[z-1][K]))_.unshift({t:"ins",v:M[K-1]}),K--;else _.unshift({t:"del",v:W[z-1]}),z--;return _}function UJ(Z,Y,W){let M=XJ(Y,W);if(Z.replaceChildren(),!M){Z.textContent=W;return}for(let F of M)if(F.t==="eq")Z.appendChild(document.createTextNode(F.v));else{let O=document.createElement(F.t==="ins"?"ins":"del");O.textContent=F.v,Z.appendChild(O)}}function OJ(Z){let Y=Z.dom.addStyle(`
    .rw-panel { --rw-accent: var(--lumiverse-accent, var(--lumiverse-primary)); --rw-accent-text: var(--lumiverse-primary-text, #b8a0ff); container: rw / inline-size; padding: 4px 14px 18px; display: flex; flex-direction: column; color: var(--lumiverse-text); font-size: calc(13px * var(--lumiverse-font-scale, 1)); line-height: 1.45; -webkit-font-smoothing: antialiased; }

    /* ── Sections: hairline-separated groups with uppercase headers ── */
    .rw-sec { display: flex; flex-direction: column; gap: 9px; padding: 15px 0; border-top: 1px solid var(--lumiverse-border); }
    .rw-pane > .rw-sec:first-child { border-top: 0; padding-top: 12px; }
    .rw-sec-hd { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: calc(10px * var(--lumiverse-font-scale, 1)); font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--lumiverse-text-muted); margin: 0; }
    details.rw-sec { gap: 0; }
    details.rw-sec > summary { list-style: none; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: calc(10px * var(--lumiverse-font-scale, 1)); font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--lumiverse-text-muted); padding: 0; }
    details.rw-sec > summary::-webkit-details-marker { display: none; }
    details.rw-sec > summary::after { content: ""; flex: 0 0 auto; width: 6px; height: 6px; margin-right: 2px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform var(--lumiverse-transition); opacity: .85; }
    details.rw-sec[open] > summary::after { transform: rotate(45deg); }
    details.rw-sec[open] > summary { margin-bottom: 13px; }
    .rw-sec-body { display: flex; flex-direction: column; gap: 10px; }

    .rw-field { display: flex; flex-direction: column; gap: 5px; }
    .rw-fieldlbl { font-size: calc(11px * var(--lumiverse-font-scale, 1)); color: var(--lumiverse-text-muted); }
    .rw-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .rw-label { font-size: calc(11px * var(--lumiverse-font-scale, 1)); color: var(--lumiverse-text-muted); }

    /* ── Text controls ── */
    .rw-area { width: 100%; min-height: 96px; resize: vertical; padding: 9px 11px; background: var(--lumiverse-fill); color: var(--lumiverse-text); border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); font: inherit; line-height: 1.5; outline: none; box-sizing: border-box; transition: border-color var(--lumiverse-transition-fast), box-shadow var(--lumiverse-transition-fast); }
    .rw-select, .rw-input { width: 100%; padding: 8px 11px; background: var(--lumiverse-fill); color: var(--lumiverse-text); border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); font: inherit; font-size: calc(12.5px * var(--lumiverse-font-scale, 1)); outline: none; box-sizing: border-box; transition: border-color var(--lumiverse-transition-fast), box-shadow var(--lumiverse-transition-fast); }
    .rw-area:focus, .rw-select:focus, .rw-input:focus { border-color: var(--rw-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--rw-accent) 22%, transparent); }
    .rw-area::placeholder, .rw-input::placeholder, .rw-area:-ms-input-placeholder { color: var(--lumiverse-text-muted); }
    .rw-select { appearance: none; -webkit-appearance: none; padding-right: 30px; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-opacity='0.65' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
    .rw-num { width: 58px; text-align: right; padding: 6px 8px; font-size: calc(12px * var(--lumiverse-font-scale, 1)); font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
    .rw-num::-webkit-inner-spin-button, .rw-num::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

    /* ── Buttons ── */
    .rw-btns { display: flex; gap: 7px; flex-wrap: wrap; }
    .rw-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 5px 10px; border-radius: var(--lumiverse-radius); border: 1px solid var(--lumiverse-border); background: var(--lumiverse-fill); color: var(--lumiverse-text); cursor: pointer; font: inherit; font-size: calc(11.5px * var(--lumiverse-font-scale, 1)); line-height: 1.2; transition: background var(--lumiverse-transition-fast), border-color var(--lumiverse-transition-fast), color var(--lumiverse-transition-fast), filter var(--lumiverse-transition-fast); }
    .rw-btn:hover:not(:disabled) { background: var(--lumiverse-fill-hover); border-color: var(--lumiverse-border-hover); }
    .rw-btn:active:not(:disabled) { transform: translateY(1px); }
    .rw-btn:disabled { opacity: .4; cursor: default; }
    .rw-btn.full { width: 100%; }
    .rw-btn.primary { background: color-mix(in srgb, var(--rw-accent) 86%, #000); color: #fff; border-color: transparent; font-weight: 600; }
    .rw-btn.primary:hover:not(:disabled) { filter: brightness(1.14); }
    .rw-btn.run { width: 100%; padding: 7px; font-size: calc(12.5px * var(--lumiverse-font-scale, 1)); }
    .rw-btn.accent { background: color-mix(in srgb, var(--rw-accent) 13%, transparent); border-color: color-mix(in srgb, var(--rw-accent) 32%, transparent); color: var(--rw-accent-text); font-weight: 600; }
    .rw-btn.accent:hover:not(:disabled) { background: color-mix(in srgb, var(--rw-accent) 20%, transparent); border-color: color-mix(in srgb, var(--rw-accent) 45%, transparent); }

    /* ── Pill toggle (replaces raw checkboxes) ── */
    .rw-tog { display: flex; align-items: center; gap: 9px; cursor: pointer; font-size: calc(12.5px * var(--lumiverse-font-scale, 1)); color: var(--lumiverse-text); user-select: none; white-space: nowrap; }
    .rw-tog input { position: absolute; opacity: 0; width: 0; height: 0; }
    .rw-tog-sl { position: relative; flex: 0 0 auto; width: 34px; height: 19px; border-radius: 19px; background: var(--lumiverse-fill-strong); transition: background var(--lumiverse-transition); }
    .rw-tog-sl::before { content: ""; position: absolute; top: 3px; left: 3px; width: 13px; height: 13px; border-radius: 50%; background: var(--lumiverse-text-dim); transition: transform var(--lumiverse-transition), background var(--lumiverse-transition); }
    .rw-tog input:checked + .rw-tog-sl { background: color-mix(in srgb, var(--rw-accent) 42%, transparent); }
    .rw-tog input:checked + .rw-tog-sl::before { transform: translateX(15px); background: var(--rw-accent); }
    .rw-tog input:focus-visible + .rw-tog-sl { box-shadow: 0 0 0 2px color-mix(in srgb, var(--rw-accent) 35%, transparent); }
    .rw-tog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px 14px; }

    /* ── Length row ── */
    .rw-len-row { display: flex; align-items: center; gap: 11px; }
    .rw-len-row input[type=range] { flex: 1; min-width: 70px; accent-color: var(--rw-accent); height: 4px; cursor: pointer; }

    /* ── Status lines ── */
    .rw-status { font-size: calc(11px * var(--lumiverse-font-scale, 1)); color: var(--lumiverse-text-muted); min-height: 15px; }
    .rw-status.err { color: var(--lumiverse-danger); }
    #rw-cap { color: var(--lumiverse-text-muted); }
    #rw-cap.err { color: var(--lumiverse-danger); }
    .rw-delta { font-size: calc(11px * var(--lumiverse-font-scale, 1)); color: var(--lumiverse-text-muted); font-variant-numeric: tabular-nums; }

    /* ── Diff ── */
    .rw-diff { padding: 9px 11px; background: var(--lumiverse-fill); border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); font-size: calc(13px * var(--lumiverse-font-scale, 1)); line-height: 1.55; white-space: pre-wrap; max-height: 220px; overflow-y: auto; color: var(--lumiverse-text); }
    .rw-diff ins { background: color-mix(in srgb, var(--lumiverse-success) 24%, transparent); text-decoration: none; border-radius: 2px; }
    .rw-diff del { color: var(--lumiverse-danger); text-decoration: line-through; opacity: .8; }

    /* ── Managed-style list items ── */
    .rw-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); background: var(--lumiverse-fill); transition: border-color var(--lumiverse-transition-fast); }
    .rw-item:hover { border-color: var(--lumiverse-border-hover); }
    .rw-item-name { flex: 1; min-width: 0; font-size: calc(12.5px * var(--lumiverse-font-scale, 1)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rw-iconbtn { flex: 0 0 auto; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 1px solid transparent; border-radius: var(--lumiverse-radius-sm); background: transparent; color: var(--lumiverse-text-muted); cursor: pointer; font-size: calc(13px * var(--lumiverse-font-scale, 1)); transition: background var(--lumiverse-transition-fast), color var(--lumiverse-transition-fast); }
    .rw-iconbtn:hover { background: var(--lumiverse-fill-hover); color: var(--lumiverse-text); }
    .rw-subhd { font-size: calc(10px * var(--lumiverse-font-scale, 1)); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--lumiverse-text-muted); margin-top: 2px; }
    .rw-empty { font-size: calc(12px * var(--lumiverse-font-scale, 1)); line-height: 1.5; color: var(--lumiverse-text-muted); padding: 4px 2px; }

    /* ── Cost panel (details) ── */
    .rw-cost { border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); background: var(--lumiverse-fill); font-size: calc(12px * var(--lumiverse-font-scale, 1)); }
    .rw-cost > summary { cursor: pointer; user-select: none; padding: 8px 11px; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--lumiverse-text-muted); }
    .rw-cost > summary::-webkit-details-marker { display: none; }
    .rw-cost > summary::before { content: ""; order: 2; flex: 0 0 auto; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform var(--lumiverse-transition); opacity: .7; }
    .rw-cost[open] > summary::before { transform: rotate(45deg); }
    .rw-cost-total { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--lumiverse-text); font-weight: 600; }
    .rw-cost-body { padding: 2px 11px 9px; display: flex; flex-direction: column; gap: 3px; border-top: 1px solid var(--lumiverse-border); margin-top: 0; padding-top: 8px; }
    .rw-cost-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--lumiverse-text-muted); }
    .rw-cost-line span:last-child { font-variant-numeric: tabular-nums; color: var(--lumiverse-text); }

    /* ── Tabs ── */
    .rw-tabs { display: flex; gap: 3px; background: var(--lumiverse-fill-medium); border-radius: var(--lumiverse-radius-md); padding: 3px; margin: 4px 0 2px; }
    .rw-tab { flex: 1; text-align: center; font: inherit; font-size: calc(11.5px * var(--lumiverse-font-scale, 1)); font-weight: 600; padding: 6px 4px; border: 0; border-radius: var(--lumiverse-radius-sm); background: transparent; color: var(--lumiverse-text-muted); cursor: pointer; transition: background var(--lumiverse-transition-fast), color var(--lumiverse-transition-fast); }
    .rw-tab:hover { color: var(--lumiverse-text); }
    .rw-tab.on { background: color-mix(in srgb, var(--rw-accent) 24%, transparent); color: #fff; }
    .rw-pane { display: none; flex-direction: column; }
    .rw-pane.on { display: flex; }

    /* ── Style chip grid ── */
    .rw-style-sel { margin-left: auto; font-size: calc(11px * var(--lumiverse-font-scale, 1)); font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--lumiverse-text-muted); max-width: 58%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rw-cgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .rw-chip { display: flex; align-items: center; gap: 6px; text-align: left; padding: 0 9px; height: 25px; font: inherit; font-size: calc(11.5px * var(--lumiverse-font-scale, 1)); font-weight: 600; border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); background: var(--lumiverse-fill); color: var(--lumiverse-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: background var(--lumiverse-transition-fast), border-color var(--lumiverse-transition-fast), color var(--lumiverse-transition-fast); }
    .rw-chip:hover { border-color: var(--lumiverse-border-hover); background: var(--lumiverse-fill-hover); }
    .rw-chip:active { transform: translateY(1px); }
    .rw-chip.on { border-color: var(--rw-accent); background: color-mix(in srgb, var(--rw-accent) 24%, transparent); color: #fff; }
    .rw-chip.wide { grid-column: 1 / -1; }
    .rw-chip.auto { border-color: color-mix(in srgb, var(--rw-accent) 40%, transparent); background: color-mix(in srgb, var(--rw-accent) 13%, transparent); color: var(--rw-accent-text); }
    .rw-chip.auto.on { background: color-mix(in srgb, var(--rw-accent) 26%, transparent); color: #fff; }

    /* ── Taller output + compact action row ── */
    .rw-output { min-height: 150px; }
    .rw-actions { flex-wrap: nowrap; }
    .rw-actbtn { flex: 0 0 auto; width: 30px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--lumiverse-text-muted); }
    .rw-actbtn:hover:not(:disabled) { color: var(--lumiverse-text); }
    .rw-actbtn svg { width: 15px; height: 15px; }
    .rw-mi { width: 13px; height: 13px; flex: 0 0 auto; }

    /* ── Focus rings on non-form controls (form controls/toggles already ring) ── */
    .rw-tab:focus-visible, .rw-chip:focus-visible, .rw-btn:focus-visible, .rw-iconbtn:focus-visible {
      outline: none; box-shadow: 0 0 0 2px color-mix(in srgb, var(--rw-accent) 45%, transparent);
    }

    /* ── Narrow PANEL (container-keyed, not viewport — the drawer width is independent
       of the viewport): single-column grids + larger touch targets for the most-tapped controls. ── */
    @container rw (max-width: 360px) {
      .rw-tog-grid { grid-template-columns: 1fr; }
      .rw-iconbtn { width: 34px; height: 34px; }
      .rw-actbtn { width: 38px; height: 36px; }
      .rw-tab { padding: 9px 4px; }
      .rw-actions { flex-wrap: wrap; }
    }

    @media (prefers-reduced-motion: reduce) {
      .rw-area, .rw-select, .rw-input, .rw-btn, .rw-tab, .rw-chip, .rw-item, .rw-iconbtn, .rw-tog-sl, .rw-tog-sl::before,
      details.rw-sec > summary::after, .rw-cost > summary::before { transition: none !important; }
    }
  `),W=Z.ui.registerDrawerTab({id:"rewrite_assistant",title:"Rewrite",shortName:"Rewrite",description:"Rewrite selected message text with an LLM style profile",keywords:["rewrite","edit","prose","style"],iconSvg:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'}),M=Z.dom.createElement("div");M.className="rw-panel";let F='<svg class="rw-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2 5.2 1.8-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',O='<svg class="rw-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',L='<svg class="rw-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',_=(J)=>`${F}<span>${J}</span>`;M.innerHTML=`
    <div class="rw-tabs" id="rw-tabs" role="tablist" aria-label="Rewrite panel sections">
      <button class="rw-tab on" type="button" role="tab" id="rw-tab-rw" data-pane="rw" aria-controls="rw-pane-rw" aria-selected="true" tabindex="0">Rewrite</button>
      <button class="rw-tab" type="button" role="tab" id="rw-tab-ar" data-pane="ar" aria-controls="rw-pane-ar" aria-selected="false" tabindex="-1">Architect</button>
      <button class="rw-tab" type="button" role="tab" id="rw-tab-op" data-pane="op" aria-controls="rw-pane-op" aria-selected="false" tabindex="-1">Options</button>
    </div>

    <div class="rw-pane on" data-pane="rw" role="tabpanel" id="rw-pane-rw" aria-labelledby="rw-tab-rw" tabindex="0">
      <div class="rw-sec">
        <div class="rw-field">
          <span class="rw-fieldlbl">Connection</span>
          <select class="rw-select" id="rw-conn" aria-label="Connection"></select>
        </div>
      </div>

      <details class="rw-sec rw-style-sec" open>
        <summary><span>Style</span><span class="rw-style-sel" id="rw-style-sel"></span></summary>
        <div class="rw-sec-body">
          <select class="rw-select" id="rw-style" style="display:none;"></select>
          <div class="rw-cgrid" id="rw-style-grid"></div>
          <button class="rw-btn accent full" id="rw-autostyle" title="Generate a voice style from this chat's character">${_("Style this chat")}</button>
          <div id="rw-custom-wrap" style="display:none; flex-direction:column; gap:8px;">
            <select class="rw-select" id="rw-custom-saved" aria-label="Recent custom prompts"><option value="">— recent custom prompts —</option></select>
            <textarea class="rw-area" id="rw-custom" style="min-height:62px" placeholder="Type a one-off rewrite instruction…"></textarea>
            <div class="rw-btns"><button class="rw-btn accent" id="rw-refine">${_("Refine")}</button><button class="rw-btn" id="rw-save-as-style">Save as style…</button></div>
          </div>
        </div>
      </details>

      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Input</span><label class="rw-tog" title="Auto-capture highlighted text"><input type="checkbox" id="rw-watch" /><span class="rw-tog-sl"></span>Watch</label></div>
        <textarea class="rw-area" id="rw-input" placeholder="Highlight text in a message (Watch on), or type here. Alt+R captures the selection."></textarea>
        <div class="rw-status" id="rw-cap" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="rw-len-row">
          <span class="rw-label" id="rw-len-label">Length</span>
          <input type="range" id="rw-len" min="25" max="200" step="5" value="100" aria-label="Length percent" />
          <input type="number" id="rw-lenval" min="1" max="1000" value="100" class="rw-input rw-num" title="Target length % (1–1000)" aria-label="Length percent" />
        </div>
        <details class="rw-cost" id="rw-cost">
          <summary><span>Estimated cost</span><span class="rw-cost-total" id="rw-cost-total">≈ 0 tokens</span></summary>
          <div class="rw-cost-body" id="rw-cost-body"></div>
        </details>
        <button class="rw-btn primary run" id="rw-run">Run</button>
      </div>

      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Output</span><span id="rw-delta" class="rw-delta"></span></div>
        <textarea class="rw-area rw-output" id="rw-output" placeholder="The rewrite appears here (editable before applying)."></textarea>
        <label class="rw-tog"><input type="checkbox" id="rw-diff-toggle" /><span class="rw-tog-sl"></span>Show diff</label>
        <div id="rw-diff" class="rw-diff" style="display:none;"></div>
        <div class="rw-btns rw-actions">
          <button class="rw-btn primary" id="rw-apply" style="flex:1;">Apply to message</button>
          <button class="rw-btn rw-actbtn" id="rw-undo" type="button" aria-label="Undo" title="Undo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg></button>
          <button class="rw-btn rw-actbtn" id="rw-redo" type="button" aria-label="Redo" title="Redo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg></button>
          <button class="rw-btn rw-actbtn" id="rw-copy" type="button" aria-label="Copy" title="Copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
        <div class="rw-status" id="rw-msg" role="status" aria-live="polite" aria-atomic="true"></div>
      </div>

      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Context</span></div>
        <div class="rw-tog-grid">
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-prev" /><span class="rw-tog-sl"></span>Prev msgs</label>
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-char" /><span class="rw-tog-sl"></span>Character</label>
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-persona" /><span class="rw-tog-sl"></span>Persona</label>
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-speaker" /><span class="rw-tog-sl"></span>Speaker</label>
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-memory" /><span class="rw-tog-sl"></span>Memory</label>
          <label class="rw-tog"><input type="checkbox" id="rw-ctx-lore" /><span class="rw-tog-sl"></span>Lore</label>
        </div>
      </div>
    </div>

    <div class="rw-pane" data-pane="ar" role="tabpanel" id="rw-pane-ar" aria-labelledby="rw-tab-ar" tabindex="0">
      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Create a style</span></div>
        <input class="rw-input" id="rw-newprof-name" placeholder="New style name" />
        <textarea class="rw-area" id="rw-newprof-prompt" style="min-height:52px" placeholder="Instruction for this style…"></textarea>
        <div class="rw-btns"><button class="rw-btn accent" id="rw-newprof-add">Add style</button></div>
      </div>
      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Generate with AI</span></div>
        <input class="rw-input" id="rw-architect-desc" placeholder="Describe a style for AI to write…" />
        <div class="rw-btns"><button class="rw-btn accent" id="rw-architect">${_("AI generate style")}</button></div>
      </div>
      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Saved styles</span></div>
        <div id="rw-custom-profiles" style="display:flex;flex-direction:column;gap:6px;"></div>
        <div class="rw-subhd">Hide built-ins</div>
        <div id="rw-hide-builtins" class="rw-tog-grid"></div>
      </div>
    </div>

    <div class="rw-pane" data-pane="op" role="tabpanel" id="rw-pane-op" aria-labelledby="rw-tab-op" tabindex="0">
      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Behaviour</span></div>
        <div class="rw-tog-grid">
          <label class="rw-tog"><input type="checkbox" id="rw-concise" /><span class="rw-tog-sl"></span>Concise prompt</label>
          <label class="rw-tog"><input type="checkbox" id="rw-autoapply" /><span class="rw-tog-sl"></span>Auto-apply</label>
          <label class="rw-tog"><input type="checkbox" id="rw-debug" /><span class="rw-tog-sl"></span>Debug log</label>
        </div>
        <div class="rw-row"><span class="rw-label">Undo depth</span><input type="number" id="rw-histdepth" min="1" max="100" value="30" class="rw-input rw-num" title="Undo/redo history depth (1–100)" aria-label="Undo history depth" /></div>
      </div>
      <div class="rw-sec">
        <div class="rw-sec-hd"><span>Data</span></div>
        <div class="rw-btns"><button class="rw-btn" id="rw-export">Export settings</button><button class="rw-btn" id="rw-import">Import settings</button><button class="rw-btn" id="rw-export-debug">Export debug</button><button class="rw-btn" id="rw-reset">Reset to defaults</button></div>
      </div>
    </div>
  `,W.root.appendChild(M);let z=(J)=>M.querySelector(`#${J}`),K=z("rw-conn"),k=z("rw-watch"),N=z("rw-concise"),C=z("rw-autoapply"),T=z("rw-debug"),qq=z("rw-export-debug"),$=z("rw-input"),y=z("rw-cap"),V=z("rw-style"),B=z("rw-style-grid"),pq=z("rw-style-sel"),Fq=z("rw-tabs"),r=z("rw-len"),S=z("rw-lenval"),b=z("rw-run"),j=z("rw-output"),P=z("rw-apply"),c=z("rw-undo"),g=z("rw-redo"),Eq=z("rw-copy"),G=z("rw-msg"),zq=z("rw-diff-toggle"),dq=z("rw-delta"),Nq=z("rw-diff"),Aq=z("rw-ctx-prev"),Oq=z("rw-ctx-char"),_q=z("rw-ctx-persona"),kq=z("rw-ctx-speaker"),Dq=z("rw-ctx-memory"),Iq=z("rw-ctx-lore"),Hq=z("rw-cost"),Bq=z("rw-cost-total"),jq=z("rw-cost-body"),mq=z("rw-custom-wrap"),w=z("rw-custom"),n=z("rw-custom-saved"),Rq=z("rw-custom-profiles"),f=z("rw-newprof-name"),x=z("rw-newprof-prompt"),Xq=z("rw-newprof-add"),yq=z("rw-hide-builtins"),Uq=z("rw-histdepth"),aq=z("rw-export"),uq=z("rw-import"),p=z("rw-refine"),iq=z("rw-save-as-style"),bq=z("rw-architect-desc"),E=z("rw-architect"),Yq=z("rw-autostyle"),rq=z("rw-reset"),d=["rw","ar","op"];function Gq(J){Fq.querySelectorAll(".rw-tab").forEach((Q)=>{let q=Q,H=q.dataset.pane===J;q.classList.toggle("on",H),q.setAttribute("aria-selected",H?"true":"false"),q.tabIndex=H?0:-1}),M.querySelectorAll(".rw-pane").forEach((Q)=>Q.classList.toggle("on",Q.dataset.pane===J))}Fq.querySelectorAll(".rw-tab").forEach((J)=>{J.addEventListener("click",()=>Gq(J.dataset.pane)),J.addEventListener("keydown",(Q)=>{let q=Q,H=d.indexOf(J.dataset.pane),U=-1;if(q.key==="ArrowRight"||q.key==="ArrowDown")U=(H+1)%d.length;else if(q.key==="ArrowLeft"||q.key==="ArrowUp")U=(H-1+d.length)%d.length;else if(q.key==="Home")U=0;else if(q.key==="End")U=d.length-1;if(U<0)return;q.preventDefault(),Gq(d[U]),Fq.querySelector(`.rw-tab[data-pane="${d[U]}"]`)?.focus()})}),M.querySelectorAll(".rw-sec-hd > span:first-child").forEach((J)=>{J.setAttribute("role","heading"),J.setAttribute("aria-level","3")}),M.querySelectorAll(".rw-subhd").forEach((J)=>{J.setAttribute("role","heading"),J.setAttribute("aria-level","4")});function wq(){B.replaceChildren();for(let Q of[...V.options]){let q=Z.dom.createElement("button");q.type="button",q.className="rw-chip";let H=Q.value===V.value;if(H)q.classList.add("on");if(q.setAttribute("aria-pressed",H?"true":"false"),Q.value.startsWith("auto:"))q.classList.add("auto","wide");if(Q.value==="__custom__")q.classList.add("wide");q.textContent=Q.textContent,q.title=Q.textContent??"",q.addEventListener("click",()=>{V.value=Q.value,V.dispatchEvent(new Event("change"))}),B.appendChild(q)}let J=V.options[V.selectedIndex];pq.textContent=J?J.textContent??"":""}let v=[],m=[],$q={},o="",Lq=null,Wq=!1,a=!1,l=null;function u(){let J=V.value;V.replaceChildren();let Q=Z.dom.createElement("option");Q.value="__custom__",Q.textContent="Custom…",V.appendChild(Q);let q=Z.getActiveChat(),H=q.chatId?$q[q.chatId]:void 0;if(H){let U=Z.dom.createElement("option");U.value="auto:"+q.chatId,U.textContent=H.name,V.appendChild(U)}for(let U of[...Cq].sort((A,e)=>A.order-e.order)){if(m.includes(U.id))continue;let A=Z.dom.createElement("option");A.value=U.id,A.textContent=U.name,V.appendChild(A)}for(let U of v){let A=Z.dom.createElement("option");A.value=U.id,A.textContent=U.name,V.appendChild(A)}if(J&&[...V.options].some((U)=>U.value===J))V.value=J;else{let U=[...V.options].find((A)=>A.value!=="__custom__"&&!A.value.startsWith("auto:"));if(U)V.value=U.value}wq()}function Jq(){if(Rq.replaceChildren(),v.length===0){let J=Z.dom.createElement("div");J.className="rw-empty",J.textContent="No saved styles yet — create one above, or save a custom prompt as a style.",Rq.appendChild(J)}for(let J of v){let Q=Z.dom.createElement("div");Q.className="rw-item";let q=Z.dom.createElement("span");q.className="rw-item-name",q.textContent=J.name;let H=Z.dom.createElement("button");H.className="rw-iconbtn",H.innerHTML=O,H.title="Edit this style",H.setAttribute("aria-label","Edit style"),H.addEventListener("click",()=>{f.value=J.name,x.value=J.prompt,l=J.id,Xq.textContent="Update",Gq("ar"),f.focus()});let U=Z.dom.createElement("button");U.className="rw-iconbtn",U.innerHTML=L,U.title="Delete this style",U.setAttribute("aria-label","Delete style"),U.addEventListener("click",()=>{if(v=v.filter((A)=>A.id!==J.id),l===J.id)l=null,Xq.textContent="Add style",f.value="",x.value="";Z.sendToBackend({type:"update_config",config:{customProfiles:v}}),u(),Jq()}),Q.appendChild(q),Q.appendChild(H),Q.appendChild(U),Rq.appendChild(Q)}yq.replaceChildren();for(let J of[...Cq].sort((Q,q)=>Q.order-q.order)){let Q=Z.dom.createElement("label");Q.className="rw-tog";let q=Z.dom.createElement("input");q.type="checkbox",q.checked=m.includes(J.id),q.addEventListener("change",()=>{m=q.checked?[...new Set([...m,J.id])]:m.filter((U)=>U!==J.id),Z.sendToBackend({type:"update_config",config:{hiddenProfiles:m}}),u()});let H=Z.dom.createElement("span");H.className="rw-tog-sl",Q.appendChild(q),Q.appendChild(H),Q.appendChild(document.createTextNode(J.name)),yq.appendChild(Q)}}Xq.addEventListener("click",()=>{let J=f.value.trim(),Q=x.value.trim();if(!J||!Q){X(G,"Enter a name and an instruction for the style.",!0);return}if(l){let q=l;v=v.map((H)=>H.id===q?{id:q,name:J,prompt:Q}:H),l=null,Xq.textContent="Add style",Z.sendToBackend({type:"update_config",config:{customProfiles:v}}),f.value="",x.value="",u(),Jq(),X(G,`Updated style "${J}".`)}else{let q="cp_"+Date.now().toString(36);v=[...v,{id:q,name:J,prompt:Q}],Z.sendToBackend({type:"update_config",config:{customProfiles:v}}),f.value="",x.value="",u(),Jq(),V.value=q,V.dispatchEvent(new Event("change")),X(G,`Added style "${J}".`)}}),aq.addEventListener("click",()=>{if(!Lq){X(G,"Settings not loaded yet.",!0);return}let{customProfiles:J,customPrompts:Q,hiddenProfiles:q,usePrevMessages:H,prevMessageCount:U,speakerAware:A,useCharCard:e,useUserPersona:Mq,useMemory:lq,useLorebook:sq,lengthPct:eq,concise:tq,autoApply:qJ}=Lq,JJ=new Blob([JSON.stringify({version:1,customProfiles:J,customPrompts:Q,hiddenProfiles:q,usePrevMessages:H,prevMessageCount:U,speakerAware:A,useCharCard:e,useUserPersona:Mq,useMemory:lq,useLorebook:sq,lengthPct:eq,concise:tq,autoApply:qJ},null,2)],{type:"application/json"}),Vq=document.createElement("a");Vq.href=URL.createObjectURL(JJ),Vq.download="rewrite-settings.json",Vq.click(),URL.revokeObjectURL(Vq.href),X(G,"Settings exported.")}),uq.addEventListener("click",async()=>{let J=await Z.uploads.pickFile({accept:[".json","application/json"]});if(!J.length)return;let Q=new TextDecoder().decode(J[0].bytes),q;try{q=JSON.parse(Q)}catch{X(G,"Import failed: not valid JSON.",!0);return}let H=xq(q);Z.sendToBackend({type:"update_config",config:H}),X(G,"Settings imported.")}),p.addEventListener("click",()=>{if(!w.value.trim()){X(G,"Enter a custom instruction to refine.",!0);return}p.disabled=!0,p.innerHTML=_("Refining…"),Z.sendToBackend({type:"refine_prompt",text:w.value,connectionId:K.value})}),iq.addEventListener("click",()=>{if(!w.value.trim()){X(G,"Nothing to save — type a custom instruction first.",!0);return}x.value=w.value,Gq("ar"),f.focus(),X(G,"Name it and click Add to save as a style.")}),rq.addEventListener("click",async()=>{let{confirmed:J}=await Z.ui.showConfirm({title:"Reset to defaults",message:"This will restore all settings to their defaults and clear the undo/redo history. Your connection will be preserved.",variant:"danger",confirmLabel:"Reset"});if(!J)return;Z.sendToBackend({type:"reset_config"})}),E.addEventListener("click",()=>{if(!bq.value.trim()){X(G,"Enter a description for the AI to generate a style.",!0);return}E.disabled=!0,E.innerHTML=_("Generating…"),Z.sendToBackend({type:"architect_style",description:bq.value,connectionId:K.value})}),Yq.addEventListener("click",()=>{let J=Z.getActiveChat();if(!J.chatId||!J.characterId){X(G,"Open a chat with a character first.",!0);return}if(!K.value){X(G,"Select a connection first.",!0);return}Yq.disabled=!0,X(G,"Generating a chat style…"),Z.sendToBackend({type:"gen_autoprofile",chatId:J.chatId,characterId:J.characterId,connectionId:K.value})});function cq(J){K.replaceChildren();let Q=Z.dom.createElement("option");Q.value="",Q.textContent="— select a connection —",K.appendChild(Q);for(let q of J){let H=Z.dom.createElement("option");H.value=q.id,H.textContent=q.model?`${q.name} — ${q.model}`:q.name,K.appendChild(H)}if(o&&[...K.options].some((q)=>q.value===o))K.value=o}u(),Jq();let Qq=[];function hq(){n.replaceChildren();let J=Z.dom.createElement("option");J.value="",J.textContent="— recent custom prompts —",n.appendChild(J);for(let Q of Qq){let q=Z.dom.createElement("option");q.value=Q,q.textContent=Q.length>50?Q.slice(0,50)+"…":Q,n.appendChild(q)}}function nq(J){Qq=[J,...Qq.filter((Q)=>Q!==J)].slice(0,8),hq(),Z.sendToBackend({type:"update_config",config:{customPrompts:Qq}})}let D=null,R=null,Sq=`
— — —
`;function X(J,Q,q=!1){J.textContent=Q,J.className="rw-status"+(q?" err":""),J.setAttribute("aria-live",q?"assertive":"polite")}function i(){if(zq.checked&&j.value)UJ(Nq,$.value,j.value),Nq.style.display="block";else Nq.style.display="none";let J=vq(j.value)-vq($.value);dq.textContent=j.value?`${J>=0?"+":""}${J} words`:""}let s=null;function I(){if(s)clearTimeout(s);s=setTimeout(()=>{s=null;let J=$.value;if(!J.trim()){Bq.textContent="≈ 0 tokens",jq.replaceChildren();return}let Q=V.value==="__custom__",q=Z.getActiveChat();Z.sendToBackend({type:"preview_tokens",text:J,profileId:V.value,customPrompt:Q?w.value:void 0,concise:N.checked,lengthPct:parseInt(S.value,10)||100,chatId:D?.chatId??q.chatId??void 0,messageId:D?.messageId,characterId:q.characterId??void 0})},400)}let Zq=null,h=null;function Pq(){let J=Z.getActiveChat().chatId;if(!J)return!1;let Q=ZJ();if(Q&&Q.segments.length>=2){let H=Q.segments.map((U)=>`${U.messageId}:${U.rs}:${U.re}`).join("|");if(R&&R.sig===H)return!0;return R={chatId:J,segments:Q.segments,sig:H},D=null,$.value=Q.segments.map((U)=>U.text).join(Sq),j.value="",j.readOnly=!0,a=!1,i(),X(y,`captured ✓ ${Q.segments.length} messages`),I(),!0}let q=QJ();if(!q)return!1;return q.cap.chatId=J,D=q.cap,R=null,j.value="",j.readOnly=!1,a=!1,$.value=q.text,i(),X(y,`captured ✓ from message ${q.cap.messageId.slice(0,8)} (${q.text.length} chars)`),I(),!0}let fq=()=>{if(!k.checked)return;if(a)return;if(Zq)clearTimeout(Zq);Zq=setTimeout(Pq,200)};document.addEventListener("selectionchange",fq);let gq=(J)=>{if(J.altKey&&!J.ctrlKey&&!J.metaKey&&(J.key==="r"||J.key==="R")){if(Pq())J.preventDefault()}};document.addEventListener("keydown",gq),r.addEventListener("input",()=>{S.value=r.value}),r.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{lengthPct:parseInt(r.value,10)}}),I()}),S.addEventListener("change",()=>{let J=parseInt(S.value,10);if(!Number.isFinite(J))J=100;J=Math.max(1,Math.min(1000,J)),S.value=String(J),r.value=String(Math.min(J,200)),Z.sendToBackend({type:"update_config",config:{lengthPct:J}}),I()}),C.addEventListener("change",()=>Z.sendToBackend({type:"update_config",config:{autoApply:C.checked}})),T.addEventListener("change",()=>Z.sendToBackend({type:"update_config",config:{debug:T.checked}})),Uq.addEventListener("change",()=>{let J=parseInt(Uq.value,10);if(!Number.isFinite(J))J=30;J=Math.max(1,Math.min(100,J)),Uq.value=String(J),Z.sendToBackend({type:"update_config",config:{historyDepth:J}})}),qq.addEventListener("click",()=>{Z.sendToBackend({type:"get_debug"})}),K.addEventListener("change",()=>Z.sendToBackend({type:"update_config",config:{connectionId:K.value}})),k.addEventListener("change",()=>Z.sendToBackend({type:"update_config",config:{watch:k.checked}})),N.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{concise:N.checked}}),I()}),Aq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{usePrevMessages:Aq.checked}}),I()}),Oq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{useCharCard:Oq.checked}}),I()}),_q.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{useUserPersona:_q.checked}}),I()}),kq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{speakerAware:kq.checked}}),I()}),Dq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{useMemory:Dq.checked}}),I()}),Iq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{useLorebook:Iq.checked}}),I()}),V.addEventListener("change",()=>{mq.style.display=V.value==="__custom__"?"flex":"none",wq(),I()}),n.addEventListener("change",()=>{if(n.value)w.value=n.value,I()}),$.addEventListener("input",I),w.addEventListener("input",I),Hq.addEventListener("toggle",()=>{if(Z.sendToBackend({type:"update_config",config:{costCollapsed:!Hq.open}}),Hq.open)I()}),zq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{showDiff:zq.checked}}),i()}),j.addEventListener("input",i);function Kq(){if(Wq=!1,b.disabled=!1,b.textContent="Run",b.removeAttribute("aria-busy"),h)clearTimeout(h),h=null}b.addEventListener("click",()=>{if(Wq){Z.sendToBackend({type:"cancel"});return}let J=V.value==="__custom__",Q=J?w.value.trim():"";if(J&&!Q){X(G,"Enter a custom instruction.",!0);return}if(!$.value.trim()){X(G,"Nothing to rewrite — input is empty.",!0);return}if(Wq=!0,b.textContent="Cancel",b.setAttribute("aria-busy","true"),X(G,"Rewriting…"),h)clearTimeout(h);h=setTimeout(()=>{h=null,Wq=!1,b.disabled=!1,b.textContent="Run",b.removeAttribute("aria-busy"),X(G,"Timed out waiting for a response. Try again.",!0)},HJ);let q=Z.getActiveChat();if(R)Z.sendToBackend({type:"rewrite_multi",segments:R.segments.map((H)=>({messageId:H.messageId,text:H.text})),profileId:V.value,customPrompt:J?Q:void 0,concise:N.checked,connectionId:K.value,lengthPct:parseInt(S.value,10)||100,chatId:R.chatId,characterId:q.characterId??void 0});else Z.sendToBackend({type:"rewrite",profileId:V.value,customPrompt:J?Q:void 0,text:$.value,concise:N.checked,connectionId:K.value,lengthPct:parseInt(S.value,10)||100,chatId:D?.chatId??q.chatId??void 0,messageId:D?.messageId,characterId:q.characterId??void 0});if(J)nq(Q)}),P.addEventListener("click",()=>{if(R){let Q=R.segments.filter((q)=>q.output!=null).map((q)=>({messageId:q.messageId,R:q.R,rs:q.rs,re:q.re,output:q.output}));if(!Q.length){X(G,"Output is empty — run a rewrite first.",!0);return}if(R.chatId!==Z.getActiveChat().chatId){X(G,"That selection is from a different chat — switch back or re-select here.",!0);return}P.disabled=!0,X(G,"Applying…"),Z.sendToBackend({type:"apply_multi",chatId:R.chatId,items:Q});return}if(!D){X(G,"No captured selection. Turn on Watch mode and highlight text in a message.",!0);return}if(!j.value.trim()){X(G,"Output is empty — run a rewrite first.",!0);return}if(D.chatId!==Z.getActiveChat().chatId){X(G,"That selection is from a different chat — switch back or re-select here.",!0);return}let J=zJ(D.messageId);if(J===null||J!==D.R){D=null,X(y,""),X(G,"The message changed since you selected it. Re-select the text and run again.",!0);return}P.disabled=!0,X(G,"Applying…"),Z.sendToBackend({type:"apply",chatId:D.chatId,messageId:D.messageId,R:D.R,rs:D.rs,re:D.re,output:j.value})}),c.addEventListener("click",()=>Z.sendToBackend({type:"undo"})),g.addEventListener("click",()=>Z.sendToBackend({type:"redo"})),Eq.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(j.value),X(G,"Copied output.")}catch{X(G,"Copy failed.",!0)}});let oq=Z.onBackendMessage((J)=>{let Q=J;switch(Q.type){case"config":{Lq=Q.config;let q=Q.config;if(o=q.connectionId,[...K.options].some((H)=>H.value===o))K.value=o;if(k.checked=q.watch,N.checked=q.concise,r.value=String(Math.min(q.lengthPct,200)),S.value=String(q.lengthPct),C.checked=q.autoApply,T.checked=q.debug??!1,Aq.checked=q.usePrevMessages,Oq.checked=q.useCharCard,_q.checked=q.useUserPersona,kq.checked=q.speakerAware,Dq.checked=q.useMemory,Iq.checked=q.useLorebook,Qq=q.customPrompts||[],hq(),v=q.customProfiles||[],m=q.hiddenProfiles||[],$q=q.autoProfiles||{},u(),Jq(),Hq.open=!q.costCollapsed,zq.checked=q.showDiff??!1,i(),Uq.value=String(q.historyDepth??30),$.value.trim())I();break}case"rewrite_result":if(Kq(),j.value=Q.text,a=!0,X(G,`Done.${Q.tokens?` · prompt ~${Q.tokens} tok`:""}`),i(),C.checked&&D)P.click();break;case"rewrite_multi_result":{if(Kq(),R){for(let H of Q.segments){let U=R.segments.find((A)=>A.messageId===H.messageId);if(U)U.output=H.output}j.value=R.segments.map((H)=>H.output??"").join(Sq),j.readOnly=!0,a=!0;let q=R.segments.filter((H)=>H.output!=null).length;if(X(G,`Rewrote ${q} messages — Apply applies all.${Q.tokens?` · prompt ~${Q.tokens} tok`:""}`),i(),C.checked)P.click()}break}case"rewrite_error":Kq(),X(G,Q.error,!0);break;case"rewrite_cancelled":Kq(),X(G,"Cancelled.");break;case"apply_done":P.disabled=!1,a=!1,c.disabled=!Q.canUndo,g.disabled=!Q.canRedo,X(G,"Applied to message ✓");break;case"apply_multi_done":{P.disabled=!1,c.disabled=!Q.canUndo,g.disabled=!Q.canRedo,X(G,`Applied ${Q.applied} message(s).${Q.skipped.length?" Skipped "+Q.skipped.length+" (couldn't locate).":""}`),R=null,a=!1,j.readOnly=!1;break}case"apply_error":P.disabled=!1,X(G,Q.error,!0);break;case"undo_done":c.disabled=!Q.canUndo,g.disabled=!Q.canRedo,X(G,"Reverted ✓");break;case"undo_error":X(G,Q.error,!0);break;case"redo_done":c.disabled=!Q.canUndo,g.disabled=!Q.canRedo,X(G,"Reapplied ✓");break;case"redo_error":X(G,Q.error,!0);break;case"history":c.disabled=!Q.canUndo,g.disabled=!Q.canRedo;break;case"connections":cq(Q.connections);break;case"refine_result":p.disabled=!1,p.innerHTML=_("Refine"),w.value=Q.text,X(G,"Refined.");break;case"refine_error":p.disabled=!1,p.innerHTML=_("Refine"),X(G,Q.error,!0);break;case"architect_result":E.disabled=!1,E.innerHTML=_("AI generate style"),f.value=Q.name,x.value=Q.prompt,X(G,"Style drafted — review and Add.");break;case"architect_error":E.disabled=!1,E.innerHTML=_("AI generate style"),X(G,Q.error,!0);break;case"autoprofile_result":Yq.disabled=!1,$q[Q.chatId]={name:Q.name,prompt:Q.prompt},u(),V.value="auto:"+Q.chatId,V.dispatchEvent(new Event("change")),X(G,`Style ready: ${Q.name}`);break;case"autoprofile_error":Yq.disabled=!1,X(G,Q.error,!0);break;case"debug":{let q=Q.entries;if(!q.length){X(G,"Debug log is empty (enable Debug log, then run a rewrite).");break}let H=new Blob([JSON.stringify(q,null,2)],{type:"application/json"}),U=document.createElement("a");U.href=URL.createObjectURL(H),U.download="rewrite-debug.json",U.click(),URL.revokeObjectURL(U.href),X(G,`Debug log exported (${q.length} entr${q.length===1?"y":"ies"}).`);break}case"token_estimate":{Bq.textContent=`≈ ${Q.total} tokens`,jq.replaceChildren();let q=(H,U)=>{let A=Z.dom.createElement("div");A.className="rw-cost-line";let e=Z.dom.createElement("span");e.textContent=H;let Mq=Z.dom.createElement("span");Mq.textContent=String(U),A.appendChild(e),A.appendChild(Mq),jq.appendChild(A)};q("selection",Q.selection);for(let H of Q.sources)q(H.label,H.tokens);q("system",Q.system);break}}});return g.disabled=!0,Z.sendToBackend({type:"get_config"}),Z.sendToBackend({type:"get_connections"}),Z.sendToBackend({type:"get_history"}),()=>{if(document.removeEventListener("selectionchange",fq),document.removeEventListener("keydown",gq),Zq)clearTimeout(Zq);if(h)clearTimeout(h);if(s)clearTimeout(s);oq(),Y(),Z.dom.cleanup(),W.destroy()}}export{OJ as setup,Tq as multiSegSpan};

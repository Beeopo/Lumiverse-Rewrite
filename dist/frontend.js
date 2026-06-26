var Lq=[{id:"expand",name:"Expand",order:0,prompt:"Expand the passage with more descriptive detail, sensory imagery, and action. Add no new plot events."},{id:"compress",name:"Compress",order:1,prompt:"Condense the passage to be more succinct, keeping every key event and beat."},{id:"thoughts",name:"Add Inner Thoughts",order:2,prompt:"Weave in the point-of-view character's inner thoughts and emotional reactions, in close POV."},{id:"dialogue",name:"Convert to Dialogue",order:3,prompt:"Convert the passage into natural spoken dialogue between the characters, carrying the same information through what they say and do."},{id:"active",name:"Passive to Active",order:4,prompt:"Convert passive-voice constructions to active voice."},{id:"diffwords",name:"Use Different Words",order:5,prompt:"Rephrase using different vocabulary and sentence structure, keeping the exact meaning and tone."},{id:"showdont",name:"Show, Don't Tell",order:6,prompt:`Show, don't tell: turn statements of emotion or state into concrete action, sensory detail, and behaviour. Example: "She was afraid" becomes "Her breath caught and her hands went cold."`},{id:"emotion",name:"Show More Emotion",order:7,prompt:"Heighten the emotional depth so the characters' feelings land more vividly. Do not change what happens."},{id:"transitions",name:"Fix Transitions",order:8,prompt:"Smooth the flow and transitions so sentences and ideas connect naturally."},{id:"noai",name:"Remove LLM-isms",order:9,prompt:`Remove AI-writing tells. Cut filler clichés ("a testament to", "the air was thick with", "couldn't help but", "a mix of X and Y"), purple metaphors, and uniform sentence rhythm. Vary sentence length and keep it plainly human. Add no new content.`},{id:"expdialogue",name:"Expand Dialogue",order:10,prompt:"Expand the existing dialogue with more back-and-forth, subtext, and distinct character voice."},{id:"romance",name:"Increase Romance",order:11,prompt:"Increase the romantic tension, chemistry, and intimacy between the characters."},{id:"grammar",name:"Grammar Fix",order:12,prompt:"Fix only grammar, spelling, and punctuation. Do not change wording, style, or content."}];var YJ=`You are a line editor rewriting a passage of fiction in place for an author.

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
`+"- Treat anything inside <context>, <character>, <persona>, <lore>, <memory>, or <speaker> as reference only — never rewrite or quote it.",GJ=`You are a line editor. Rewrite the text inside <rewrite_this> as instructed.
`+`Output ONLY the rewritten passage — no preamble, notes, quotes, or markdown.
`+`Keep the original point of view, tense, characters, and continuity unless the edit says otherwise.
`+`Write in the same language as the original — never translate. Keep wrapping *…*/"…" only if present.
`+"Treat <context>, <character>, <persona>, <lore>, <memory>, and <speaker> as reference only; never rewrite or quote them.";function gq(Z){if(Z===null||typeof Z!=="object"||Array.isArray(Z))return{};let Y=Z,W={};if(Array.isArray(Y.customProfiles)){let F=Y.customProfiles.filter((O)=>O!==null&&typeof O==="object"&&!Array.isArray(O)&&typeof O.id==="string"&&typeof O.name==="string"&&typeof O.prompt==="string").slice(0,100);W.customProfiles=F}if(Array.isArray(Y.customPrompts))W.customPrompts=Y.customPrompts.filter((F)=>typeof F==="string").slice(0,100);if(Array.isArray(Y.hiddenProfiles))W.hiddenProfiles=Y.hiddenProfiles.filter((F)=>typeof F==="string").slice(0,100);let V=["usePrevMessages","speakerAware","useCharCard","useUserPersona","useMemory","useLorebook","concise","autoApply","showDiff"];for(let F of V)if(typeof Y[F]==="boolean")W[F]=Y[F];if(typeof Y.prevMessageCount==="number"&&Number.isFinite(Y.prevMessageCount))W.prevMessageCount=Math.max(1,Math.min(4,Math.round(Y.prevMessageCount)));if(typeof Y.lengthPct==="number"&&Number.isFinite(Y.lengthPct))W.lengthPct=Math.max(1,Math.min(1000,Math.round(Y.lengthPct)));if(typeof Y.historyDepth==="number"&&Number.isFinite(Y.historyDepth))W.historyDepth=Math.max(1,Math.min(100,Math.round(Y.historyDepth)));return W}function $q(Z){let Y=Z.trim();if(!Y)return 0;let W=(Y.match(/\S+/g)||[]).length,V=Y.replace(/\s+/g,"").length;if(V>0&&W<V/8)return Math.max(W,Math.round(V/2));return W}function JJ(){let Z=window.getSelection();if(!Z||Z.isCollapsed||Z.rangeCount===0)return null;let Y=Z.getRangeAt(0),W=Y.commonAncestorContainer,F=(W.nodeType===Node.ELEMENT_NODE?W:W.parentElement)?.closest('[data-component="MessageContent"]');if(!F)return null;let $=F.closest("[data-message-id]")?.getAttribute("data-message-id");if(!$)return null;let _=document.createRange();_.selectNodeContents(F);let z=_.toString(),K=document.createRange();K.selectNodeContents(F),K.setEnd(Y.startContainer,Y.startOffset);let k=K.toString().length,N=Z.toString(),C=k+N.length;if(!N.trim())return null;return{cap:{chatId:"",messageId:$,R:z,rs:k,re:C},text:N}}function Cq(Z,Y,W,V){if(Z==="first")return{rs:Math.max(0,Math.min(W,Y)),re:Y};if(Z==="last")return{rs:0,re:Math.max(0,Math.min(V,Y))};return{rs:0,re:Y}}function QJ(){let Z=window.getSelection();if(!Z||Z.isCollapsed||Z.rangeCount===0)return null;let Y=Z.getRangeAt(0),W=(z)=>(z.nodeType===Node.ELEMENT_NODE?z:z.parentElement)?.closest("[data-message-id]")??null,V=W(Y.startContainer);if(V&&V===W(Y.endContainer))return null;let F=Array.from(document.querySelectorAll('[data-component="MessageContent"]')),O=[];for(let z of F){let K=!1;try{K=Y.intersectsNode(z)}catch{K=!1}if(!K)continue;let N=z.closest("[data-message-id]")?.getAttribute("data-message-id");if(!N)continue;O.push({el:z,messageId:N})}if(new Set(O.map((z)=>z.messageId)).size<2)return null;let _=[];for(let z=0;z<O.length;z++){let{el:K,messageId:k}=O[z],N=document.createRange();N.selectNodeContents(K);let C=N.toString(),S=K.contains(Y.startContainer),e=K.contains(Y.endContainer),R,B;if(S&&!e){let T=document.createRange();T.selectNodeContents(K),T.setEnd(Y.startContainer,Y.startOffset),{rs:R,re:B}=Cq("first",C.length,T.toString().length,0)}else if(e&&!S){let T=document.createRange();T.selectNodeContents(K),T.setEnd(Y.endContainer,Y.endOffset),{rs:R,re:B}=Cq("last",C.length,0,T.toString().length)}else if(S&&e)return null;else({rs:R,re:B}=Cq("middle",C.length,0,0));let M=C.slice(R,B);if(!M.trim())continue;_.push({messageId:k,R:C,rs:R,re:B,text:M})}if(_.length<2)return null;return{segments:_}}function ZJ(Z){let W=document.querySelector(`[data-message-id="${CSS.escape(Z)}"]`)?.querySelector('[data-component="MessageContent"]');if(!W)return null;let V=document.createRange();return V.selectNodeContents(W),V.toString()}var zJ=125000,s=500;function HJ(Z,Y){let W=Z.split(/(\s+)/),V=Y.split(/(\s+)/);if(W.length>s*2)W=W.slice(0,s*2);if(V.length>s*2)V=V.slice(0,s*2);let F=W.length,O=V.length;if(F*O>s*s)return null;let $=[];for(let k=0;k<=F;k++)$.push(new Int32Array(O+1));for(let k=1;k<=F;k++)for(let N=1;N<=O;N++)$[k][N]=W[k-1]===V[N-1]?$[k-1][N-1]+1:Math.max($[k-1][N],$[k][N-1]);let _=[],z=F,K=O;while(z>0||K>0)if(z>0&&K>0&&W[z-1]===V[K-1])_.unshift({t:"eq",v:W[z-1]}),z--,K--;else if(K>0&&(z===0||$[z][K-1]>=$[z-1][K]))_.unshift({t:"ins",v:V[K-1]}),K--;else _.unshift({t:"del",v:W[z-1]}),z--;return _}function XJ(Z,Y,W){let V=HJ(Y,W);if(Z.replaceChildren(),!V){Z.textContent=W;return}for(let F of V)if(F.t==="eq")Z.appendChild(document.createTextNode(F.v));else{let O=document.createElement(F.t==="ins"?"ins":"del");O.textContent=F.v,Z.appendChild(O)}}function AJ(Z){let Y=Z.dom.addStyle(`
    .rw-panel { --rw-accent: var(--lumiverse-accent, var(--lumiverse-primary)); --rw-accent-text: var(--lumiverse-primary-text, #b8a0ff); container: rw / inline-size; padding: 4px 14px 18px; display: flex; flex-direction: column; color: var(--lumiverse-text); font-size: calc(13px * var(--lumiverse-font-scale, 1)); line-height: 1.45; -webkit-font-smoothing: antialiased; }

    /* ── Sections: hairline-separated groups with uppercase headers ── */
    .rw-sec { display: flex; flex-direction: column; gap: 9px; padding: 15px 0; border-top: 1px solid var(--lumiverse-border); }
    .rw-pane > .rw-sec:first-child { border-top: 0; padding-top: 12px; }
    .rw-sec-hd { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--lumiverse-text-muted); margin: 0; }
    details.rw-sec { gap: 0; }
    details.rw-sec > summary { list-style: none; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--lumiverse-text-muted); padding: 0; }
    details.rw-sec > summary::-webkit-details-marker { display: none; }
    details.rw-sec > summary::after { content: ""; flex: 0 0 auto; width: 6px; height: 6px; margin-right: 2px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform .2s ease; opacity: .85; }
    details.rw-sec[open] > summary::after { transform: rotate(45deg); }
    details.rw-sec[open] > summary { margin-bottom: 13px; }
    .rw-sec-body { display: flex; flex-direction: column; gap: 10px; }

    .rw-field { display: flex; flex-direction: column; gap: 5px; }
    .rw-fieldlbl { font-size: 11px; color: var(--lumiverse-text-muted); }
    .rw-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .rw-label { font-size: 11px; color: var(--lumiverse-text-muted); }

    /* ── Text controls ── */
    .rw-area { width: 100%; min-height: 96px; resize: vertical; padding: 9px 11px; background: var(--lumiverse-fill); color: var(--lumiverse-text); border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); font: inherit; line-height: 1.5; outline: none; box-sizing: border-box; transition: border-color .15s ease, box-shadow .15s ease; }
    .rw-select, .rw-input { width: 100%; padding: 8px 11px; background: var(--lumiverse-fill); color: var(--lumiverse-text); border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); font: inherit; font-size: 12.5px; outline: none; box-sizing: border-box; transition: border-color .15s ease, box-shadow .15s ease; }
    .rw-area:focus, .rw-select:focus, .rw-input:focus { border-color: var(--rw-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--rw-accent) 22%, transparent); }
    .rw-area::placeholder, .rw-input::placeholder, .rw-area:-ms-input-placeholder { color: var(--lumiverse-text-muted); }
    .rw-select { appearance: none; -webkit-appearance: none; padding-right: 30px; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-opacity='0.65' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; }
    .rw-num { width: 58px; text-align: right; padding: 6px 8px; font-size: 12px; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
    .rw-num::-webkit-inner-spin-button, .rw-num::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

    /* ── Buttons ── */
    .rw-btns { display: flex; gap: 7px; flex-wrap: wrap; }
    .rw-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 5px 10px; border-radius: var(--lumiverse-radius); border: 1px solid var(--lumiverse-border); background: var(--lumiverse-fill); color: var(--lumiverse-text); cursor: pointer; font: inherit; font-size: 11.5px; line-height: 1.2; transition: background .15s ease, border-color .15s ease, color .15s ease, filter .15s ease; }
    .rw-btn:hover:not(:disabled) { background: var(--lumiverse-fill-hover); border-color: var(--lumiverse-border-hover); }
    .rw-btn:active:not(:disabled) { transform: translateY(1px); }
    .rw-btn:disabled { opacity: .4; cursor: default; }
    .rw-btn.full { width: 100%; }
    .rw-btn.primary { background: color-mix(in srgb, var(--rw-accent) 86%, #000); color: #fff; border-color: transparent; font-weight: 600; }
    .rw-btn.primary:hover:not(:disabled) { filter: brightness(1.14); }
    .rw-btn.run { width: 100%; padding: 7px; font-size: 12.5px; }
    .rw-btn.accent { background: color-mix(in srgb, var(--rw-accent) 13%, transparent); border-color: color-mix(in srgb, var(--rw-accent) 32%, transparent); color: var(--rw-accent-text); font-weight: 600; }
    .rw-btn.accent:hover:not(:disabled) { background: color-mix(in srgb, var(--rw-accent) 20%, transparent); border-color: color-mix(in srgb, var(--rw-accent) 45%, transparent); }

    /* ── Pill toggle (replaces raw checkboxes) ── */
    .rw-tog { display: flex; align-items: center; gap: 9px; cursor: pointer; font-size: 12.5px; color: var(--lumiverse-text); user-select: none; white-space: nowrap; }
    .rw-tog input { position: absolute; opacity: 0; width: 0; height: 0; }
    .rw-tog-sl { position: relative; flex: 0 0 auto; width: 34px; height: 19px; border-radius: 19px; background: var(--lumiverse-fill-strong); transition: background .2s ease; }
    .rw-tog-sl::before { content: ""; position: absolute; top: 3px; left: 3px; width: 13px; height: 13px; border-radius: 50%; background: var(--lumiverse-text-dim); transition: transform .2s ease, background .2s ease; }
    .rw-tog input:checked + .rw-tog-sl { background: color-mix(in srgb, var(--rw-accent) 42%, transparent); }
    .rw-tog input:checked + .rw-tog-sl::before { transform: translateX(15px); background: var(--rw-accent); }
    .rw-tog input:focus-visible + .rw-tog-sl { box-shadow: 0 0 0 2px color-mix(in srgb, var(--rw-accent) 35%, transparent); }
    .rw-tog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px 14px; }

    /* ── Length row ── */
    .rw-len-row { display: flex; align-items: center; gap: 11px; }
    .rw-len-row input[type=range] { flex: 1; min-width: 70px; accent-color: var(--rw-accent); height: 4px; cursor: pointer; }

    /* ── Status lines ── */
    .rw-status { font-size: 11px; color: var(--lumiverse-text-muted); min-height: 15px; }
    .rw-status.err { color: var(--lumiverse-danger); }
    #rw-cap { color: var(--lumiverse-text-muted); }
    #rw-cap.err { color: var(--lumiverse-danger); }
    .rw-delta { font-size: 11px; color: var(--lumiverse-text-muted); font-variant-numeric: tabular-nums; }

    /* ── Diff ── */
    .rw-diff { padding: 9px 11px; background: var(--lumiverse-fill); border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); font-size: 13px; line-height: 1.55; white-space: pre-wrap; max-height: 220px; overflow-y: auto; color: var(--lumiverse-text); }
    .rw-diff ins { background: color-mix(in srgb, var(--lumiverse-success) 24%, transparent); text-decoration: none; border-radius: 2px; }
    .rw-diff del { color: var(--lumiverse-danger); text-decoration: line-through; opacity: .8; }

    /* ── Managed-style list items ── */
    .rw-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); background: var(--lumiverse-fill); transition: border-color .15s ease; }
    .rw-item:hover { border-color: var(--lumiverse-border-hover); }
    .rw-item-name { flex: 1; min-width: 0; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rw-iconbtn { flex: 0 0 auto; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 1px solid transparent; border-radius: var(--lumiverse-radius-sm); background: transparent; color: var(--lumiverse-text-muted); cursor: pointer; font-size: 13px; transition: background .12s ease, color .12s ease; }
    .rw-iconbtn:hover { background: var(--lumiverse-fill-hover); color: var(--lumiverse-text); }
    .rw-subhd { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--lumiverse-text-muted); margin-top: 2px; }

    /* ── Cost panel (details) ── */
    .rw-cost { border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); background: var(--lumiverse-fill); font-size: 12px; }
    .rw-cost > summary { cursor: pointer; user-select: none; padding: 8px 11px; list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--lumiverse-text-muted); }
    .rw-cost > summary::-webkit-details-marker { display: none; }
    .rw-cost > summary::before { content: ""; order: 2; flex: 0 0 auto; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform .2s ease; opacity: .7; }
    .rw-cost[open] > summary::before { transform: rotate(45deg); }
    .rw-cost-total { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--lumiverse-text); font-weight: 600; }
    .rw-cost-body { padding: 2px 11px 9px; display: flex; flex-direction: column; gap: 3px; border-top: 1px solid var(--lumiverse-border); margin-top: 0; padding-top: 8px; }
    .rw-cost-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--lumiverse-text-muted); }
    .rw-cost-line span:last-child { font-variant-numeric: tabular-nums; color: var(--lumiverse-text); }

    /* ── Tabs ── */
    .rw-tabs { display: flex; gap: 3px; background: var(--lumiverse-fill-medium); border-radius: var(--lumiverse-radius-md); padding: 3px; margin: 4px 0 2px; }
    .rw-tab { flex: 1; text-align: center; font: inherit; font-size: 11.5px; font-weight: 600; padding: 6px 4px; border: 0; border-radius: var(--lumiverse-radius-sm); background: transparent; color: var(--lumiverse-text-muted); cursor: pointer; transition: background .15s ease, color .15s ease; }
    .rw-tab:hover { color: var(--lumiverse-text); }
    .rw-tab.on { background: color-mix(in srgb, var(--rw-accent) 24%, transparent); color: #fff; }
    .rw-pane { display: none; flex-direction: column; }
    .rw-pane.on { display: flex; }

    /* ── Style chip grid ── */
    .rw-style-sel { margin-left: auto; font-size: 11px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--lumiverse-text-muted); max-width: 58%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rw-cgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
    .rw-chip { display: flex; align-items: center; gap: 6px; text-align: left; padding: 0 10px; height: 29px; font: inherit; font-size: 11.5px; font-weight: 600; border: 1px solid var(--lumiverse-border); border-radius: var(--lumiverse-radius); background: var(--lumiverse-fill); color: var(--lumiverse-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: background .15s ease, border-color .15s ease, color .15s ease; }
    .rw-chip:hover { border-color: var(--lumiverse-border-hover); background: var(--lumiverse-fill-hover); }
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
      .rw-tog-grid, .rw-cgrid { grid-template-columns: 1fr; }
      .rw-iconbtn { width: 34px; height: 34px; }
      .rw-actbtn { width: 38px; height: 36px; }
      .rw-tab { padding: 9px 4px; }
      .rw-chip { height: 38px; }
      .rw-actions { flex-wrap: wrap; }
    }

    @media (prefers-reduced-motion: reduce) {
      .rw-area, .rw-select, .rw-input, .rw-btn, .rw-tab, .rw-chip, .rw-item, .rw-iconbtn, .rw-tog-sl, .rw-tog-sl::before,
      details.rw-sec > summary::after, .rw-cost > summary::before { transition: none !important; }
    }
  `),W=Z.ui.registerDrawerTab({id:"rewrite_assistant",title:"Rewrite",shortName:"Rewrite",description:"Rewrite selected message text with an LLM style profile",keywords:["rewrite","edit","prose","style"],iconSvg:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'}),V=Z.dom.createElement("div");V.className="rw-panel";let F='<svg class="rw-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2 5.2 1.8-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',O='<svg class="rw-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',$='<svg class="rw-mi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',_=(Q)=>`${F}<span>${Q}</span>`;V.innerHTML=`
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
  `,W.root.appendChild(V);let z=(Q)=>V.querySelector(`#${Q}`),K=z("rw-conn"),k=z("rw-watch"),N=z("rw-concise"),C=z("rw-autoapply"),S=z("rw-debug"),e=z("rw-export-debug"),R=z("rw-input"),B=z("rw-cap"),M=z("rw-style"),T=z("rw-style-grid"),xq=z("rw-style-sel"),Mq=z("rw-tabs"),a=z("rw-len"),h=z("rw-lenval"),y=z("rw-run"),L=z("rw-output"),P=z("rw-apply"),i=z("rw-undo"),g=z("rw-redo"),pq=z("rw-copy"),G=z("rw-msg"),Zq=z("rw-diff-toggle"),dq=z("rw-delta"),Fq=z("rw-diff"),Nq=z("rw-ctx-prev"),Aq=z("rw-ctx-char"),Oq=z("rw-ctx-persona"),_q=z("rw-ctx-speaker"),kq=z("rw-ctx-memory"),Dq=z("rw-ctx-lore"),zq=z("rw-cost"),vq=z("rw-cost-total"),Iq=z("rw-cost-body"),Eq=z("rw-custom-wrap"),b=z("rw-custom"),r=z("rw-custom-saved"),Tq=z("rw-custom-profiles"),f=z("rw-newprof-name"),x=z("rw-newprof-prompt"),Hq=z("rw-newprof-add"),Bq=z("rw-hide-builtins"),Xq=z("rw-histdepth"),mq=z("rw-export"),uq=z("rw-import"),p=z("rw-refine"),aq=z("rw-save-as-style"),yq=z("rw-architect-desc"),d=z("rw-architect"),Uq=z("rw-autostyle"),iq=z("rw-reset"),E=["rw","ar","op"];function Yq(Q){Mq.querySelectorAll(".rw-tab").forEach((J)=>{let q=J,H=q.dataset.pane===Q;q.classList.toggle("on",H),q.setAttribute("aria-selected",H?"true":"false"),q.tabIndex=H?0:-1}),V.querySelectorAll(".rw-pane").forEach((J)=>J.classList.toggle("on",J.dataset.pane===Q))}Mq.querySelectorAll(".rw-tab").forEach((Q)=>{Q.addEventListener("click",()=>Yq(Q.dataset.pane)),Q.addEventListener("keydown",(J)=>{let q=J,H=E.indexOf(Q.dataset.pane),U=-1;if(q.key==="ArrowRight"||q.key==="ArrowDown")U=(H+1)%E.length;else if(q.key==="ArrowLeft"||q.key==="ArrowUp")U=(H-1+E.length)%E.length;else if(q.key==="Home")U=0;else if(q.key==="End")U=E.length-1;if(U<0)return;q.preventDefault(),Yq(E[U]),Mq.querySelector(`.rw-tab[data-pane="${E[U]}"]`)?.focus()})}),V.querySelectorAll(".rw-sec-hd > span:first-child").forEach((Q)=>{Q.setAttribute("role","heading"),Q.setAttribute("aria-level","3")}),V.querySelectorAll(".rw-subhd").forEach((Q)=>{Q.setAttribute("role","heading"),Q.setAttribute("aria-level","4")});function bq(){T.replaceChildren();for(let J of[...M.options]){let q=Z.dom.createElement("button");q.type="button",q.className="rw-chip";let H=J.value===M.value;if(H)q.classList.add("on");if(q.setAttribute("aria-pressed",H?"true":"false"),J.value.startsWith("auto:"))q.classList.add("auto","wide");if(J.value==="__custom__")q.classList.add("wide");q.textContent=J.textContent,q.title=J.textContent??"",q.addEventListener("click",()=>{M.value=J.value,M.dispatchEvent(new Event("change"))}),T.appendChild(q)}let Q=M.options[M.selectedIndex];xq.textContent=Q?Q.textContent??"":""}let v=[],m=[],jq={},c="",Rq=null,Gq=!1,n=null;function u(){let Q=M.value;M.replaceChildren();let J=Z.dom.createElement("option");J.value="__custom__",J.textContent="Custom…",M.appendChild(J);let q=Z.getActiveChat(),H=q.chatId?jq[q.chatId]:void 0;if(H){let U=Z.dom.createElement("option");U.value="auto:"+q.chatId,U.textContent=H.name,M.appendChild(U)}for(let U of[...Lq].sort((A,l)=>A.order-l.order)){if(m.includes(U.id))continue;let A=Z.dom.createElement("option");A.value=U.id,A.textContent=U.name,M.appendChild(A)}for(let U of v){let A=Z.dom.createElement("option");A.value=U.id,A.textContent=U.name,M.appendChild(A)}if(Q&&[...M.options].some((U)=>U.value===Q))M.value=Q;else{let U=[...M.options].find((A)=>A.value!=="__custom__"&&!A.value.startsWith("auto:"));if(U)M.value=U.value}bq()}function t(){Tq.replaceChildren();for(let Q of v){let J=Z.dom.createElement("div");J.className="rw-item";let q=Z.dom.createElement("span");q.className="rw-item-name",q.textContent=Q.name;let H=Z.dom.createElement("button");H.className="rw-iconbtn",H.innerHTML=O,H.title="Edit this style",H.setAttribute("aria-label","Edit style"),H.addEventListener("click",()=>{f.value=Q.name,x.value=Q.prompt,n=Q.id,Hq.textContent="Update",Yq("ar"),f.focus()});let U=Z.dom.createElement("button");U.className="rw-iconbtn",U.innerHTML=$,U.title="Delete this style",U.setAttribute("aria-label","Delete style"),U.addEventListener("click",()=>{if(v=v.filter((A)=>A.id!==Q.id),n===Q.id)n=null,Hq.textContent="Add style",f.value="",x.value="";Z.sendToBackend({type:"update_config",config:{customProfiles:v}}),u(),t()}),J.appendChild(q),J.appendChild(H),J.appendChild(U),Tq.appendChild(J)}Bq.replaceChildren();for(let Q of[...Lq].sort((J,q)=>J.order-q.order)){let J=Z.dom.createElement("label");J.className="rw-tog";let q=Z.dom.createElement("input");q.type="checkbox",q.checked=m.includes(Q.id),q.addEventListener("change",()=>{m=q.checked?[...new Set([...m,Q.id])]:m.filter((U)=>U!==Q.id),Z.sendToBackend({type:"update_config",config:{hiddenProfiles:m}}),u()});let H=Z.dom.createElement("span");H.className="rw-tog-sl",J.appendChild(q),J.appendChild(H),J.appendChild(document.createTextNode(Q.name)),Bq.appendChild(J)}}Hq.addEventListener("click",()=>{let Q=f.value.trim(),J=x.value.trim();if(!Q||!J){X(G,"Enter a name and an instruction for the style.",!0);return}if(n){let q=n;v=v.map((H)=>H.id===q?{id:q,name:Q,prompt:J}:H),n=null,Hq.textContent="Add style",Z.sendToBackend({type:"update_config",config:{customProfiles:v}}),f.value="",x.value="",u(),t(),X(G,`Updated style "${Q}".`)}else{let q="cp_"+Date.now().toString(36);v=[...v,{id:q,name:Q,prompt:J}],Z.sendToBackend({type:"update_config",config:{customProfiles:v}}),f.value="",x.value="",u(),t(),M.value=q,M.dispatchEvent(new Event("change")),X(G,`Added style "${Q}".`)}}),mq.addEventListener("click",()=>{if(!Rq){X(G,"Settings not loaded yet.",!0);return}let{customProfiles:Q,customPrompts:J,hiddenProfiles:q,usePrevMessages:H,prevMessageCount:U,speakerAware:A,useCharCard:l,useUserPersona:Kq,useMemory:oq,useLorebook:lq,lengthPct:sq,concise:eq,autoApply:tq}=Rq,qJ=new Blob([JSON.stringify({version:1,customProfiles:Q,customPrompts:J,hiddenProfiles:q,usePrevMessages:H,prevMessageCount:U,speakerAware:A,useCharCard:l,useUserPersona:Kq,useMemory:oq,useLorebook:lq,lengthPct:sq,concise:eq,autoApply:tq},null,2)],{type:"application/json"}),Vq=document.createElement("a");Vq.href=URL.createObjectURL(qJ),Vq.download="rewrite-settings.json",Vq.click(),URL.revokeObjectURL(Vq.href),X(G,"Settings exported.")}),uq.addEventListener("click",async()=>{let Q=await Z.uploads.pickFile({accept:[".json","application/json"]});if(!Q.length)return;let J=new TextDecoder().decode(Q[0].bytes),q;try{q=JSON.parse(J)}catch{X(G,"Import failed: not valid JSON.",!0);return}let H=gq(q);Z.sendToBackend({type:"update_config",config:H}),X(G,"Settings imported.")}),p.addEventListener("click",()=>{if(!b.value.trim()){X(G,"Enter a custom instruction to refine.",!0);return}p.disabled=!0,p.innerHTML=_("Refining…"),Z.sendToBackend({type:"refine_prompt",text:b.value,connectionId:K.value})}),aq.addEventListener("click",()=>{if(!b.value.trim()){X(G,"Nothing to save — type a custom instruction first.",!0);return}x.value=b.value,Yq("ar"),f.focus(),X(G,"Name it and click Add to save as a style.")}),iq.addEventListener("click",async()=>{let{confirmed:Q}=await Z.ui.showConfirm({title:"Reset to defaults",message:"This will restore all settings to their defaults and clear the undo/redo history. Your connection will be preserved.",variant:"danger",confirmLabel:"Reset"});if(!Q)return;Z.sendToBackend({type:"reset_config"})}),d.addEventListener("click",()=>{if(!yq.value.trim()){X(G,"Enter a description for the AI to generate a style.",!0);return}d.disabled=!0,d.innerHTML=_("Generating…"),Z.sendToBackend({type:"architect_style",description:yq.value,connectionId:K.value})}),Uq.addEventListener("click",()=>{let Q=Z.getActiveChat();if(!Q.chatId||!Q.characterId){X(G,"Open a chat with a character first.",!0);return}if(!K.value){X(G,"Select a connection first.",!0);return}Uq.disabled=!0,X(G,"Generating a chat style…"),Z.sendToBackend({type:"gen_autoprofile",chatId:Q.chatId,characterId:Q.characterId,connectionId:K.value})});function rq(Q){K.replaceChildren();let J=Z.dom.createElement("option");J.value="",J.textContent="— select a connection —",K.appendChild(J);for(let q of Q){let H=Z.dom.createElement("option");H.value=q.id,H.textContent=q.model?`${q.name} — ${q.model}`:q.name,K.appendChild(H)}if(c&&[...K.options].some((q)=>q.value===c))K.value=c}u(),t();let qq=[];function wq(){r.replaceChildren();let Q=Z.dom.createElement("option");Q.value="",Q.textContent="— recent custom prompts —",r.appendChild(Q);for(let J of qq){let q=Z.dom.createElement("option");q.value=J,q.textContent=J.length>50?J.slice(0,50)+"…":J,r.appendChild(q)}}function cq(Q){qq=[Q,...qq.filter((J)=>J!==Q)].slice(0,8),wq(),Z.sendToBackend({type:"update_config",config:{customPrompts:qq}})}let D=null,j=null,hq=`
— — —
`;function X(Q,J,q=!1){Q.textContent=J,Q.className="rw-status"+(q?" err":""),Q.setAttribute("aria-live",q?"assertive":"polite")}function Jq(){if(Zq.checked&&L.value)XJ(Fq,R.value,L.value),Fq.style.display="block";else Fq.style.display="none";let Q=$q(L.value)-$q(R.value);dq.textContent=L.value?`${Q>=0?"+":""}${Q} words`:""}let o=null;function I(){if(o)clearTimeout(o);o=setTimeout(()=>{o=null;let Q=R.value;if(!Q.trim()){vq.textContent="≈ 0 tokens",Iq.replaceChildren();return}let J=M.value==="__custom__",q=Z.getActiveChat();Z.sendToBackend({type:"preview_tokens",text:Q,profileId:M.value,customPrompt:J?b.value:void 0,concise:N.checked,lengthPct:parseInt(h.value,10)||100,chatId:D?.chatId??q.chatId??void 0,messageId:D?.messageId,characterId:q.characterId??void 0})},400)}let Qq=null,w=null;function Pq(){let Q=Z.getActiveChat().chatId;if(!Q)return!1;let J=QJ();if(J&&J.segments.length>=2){let H=J.segments.map((U)=>`${U.messageId}:${U.rs}:${U.re}`).join("|");if(j&&j.sig===H)return!0;return j={chatId:Q,segments:J.segments,sig:H},D=null,R.value=J.segments.map((U)=>U.text).join(hq),L.readOnly=!0,X(B,`captured ✓ ${J.segments.length} messages`),I(),!0}let q=JJ();if(!q)return!1;return q.cap.chatId=Q,D=q.cap,j=null,L.readOnly=!1,R.value=q.text,X(B,`captured ✓ from message ${q.cap.messageId.slice(0,8)} (${q.text.length} chars)`),I(),!0}let fq=()=>{if(!k.checked)return;if(Qq)clearTimeout(Qq);Qq=setTimeout(Pq,200)};document.addEventListener("selectionchange",fq);let Sq=(Q)=>{if(Q.altKey&&!Q.ctrlKey&&!Q.metaKey&&(Q.key==="r"||Q.key==="R")){if(Pq())Q.preventDefault()}};document.addEventListener("keydown",Sq),a.addEventListener("input",()=>{h.value=a.value}),a.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{lengthPct:parseInt(a.value,10)}}),I()}),h.addEventListener("change",()=>{let Q=parseInt(h.value,10);if(!Number.isFinite(Q))Q=100;Q=Math.max(1,Math.min(1000,Q)),h.value=String(Q),a.value=String(Math.min(Q,200)),Z.sendToBackend({type:"update_config",config:{lengthPct:Q}}),I()}),C.addEventListener("change",()=>Z.sendToBackend({type:"update_config",config:{autoApply:C.checked}})),S.addEventListener("change",()=>Z.sendToBackend({type:"update_config",config:{debug:S.checked}})),Xq.addEventListener("change",()=>{let Q=parseInt(Xq.value,10);if(!Number.isFinite(Q))Q=30;Q=Math.max(1,Math.min(100,Q)),Xq.value=String(Q),Z.sendToBackend({type:"update_config",config:{historyDepth:Q}})}),e.addEventListener("click",()=>{Z.sendToBackend({type:"get_debug"})}),K.addEventListener("change",()=>Z.sendToBackend({type:"update_config",config:{connectionId:K.value}})),k.addEventListener("change",()=>Z.sendToBackend({type:"update_config",config:{watch:k.checked}})),N.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{concise:N.checked}}),I()}),Nq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{usePrevMessages:Nq.checked}}),I()}),Aq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{useCharCard:Aq.checked}}),I()}),Oq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{useUserPersona:Oq.checked}}),I()}),_q.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{speakerAware:_q.checked}}),I()}),kq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{useMemory:kq.checked}}),I()}),Dq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{useLorebook:Dq.checked}}),I()}),M.addEventListener("change",()=>{Eq.style.display=M.value==="__custom__"?"flex":"none",bq(),I()}),r.addEventListener("change",()=>{if(r.value)b.value=r.value,I()}),R.addEventListener("input",I),b.addEventListener("input",I),zq.addEventListener("toggle",()=>{if(Z.sendToBackend({type:"update_config",config:{costCollapsed:!zq.open}}),zq.open)I()}),Zq.addEventListener("change",()=>{Z.sendToBackend({type:"update_config",config:{showDiff:Zq.checked}}),Jq()}),L.addEventListener("input",Jq);function Wq(){if(Gq=!1,y.disabled=!1,y.textContent="Run",y.removeAttribute("aria-busy"),w)clearTimeout(w),w=null}y.addEventListener("click",()=>{if(Gq){Z.sendToBackend({type:"cancel"});return}let Q=M.value==="__custom__",J=Q?b.value.trim():"";if(Q&&!J){X(G,"Enter a custom instruction.",!0);return}if(!R.value.trim()){X(G,"Nothing to rewrite — input is empty.",!0);return}if(Gq=!0,y.textContent="Cancel",y.setAttribute("aria-busy","true"),X(G,""),w)clearTimeout(w);w=setTimeout(()=>{w=null,Gq=!1,y.disabled=!1,y.textContent="Run",y.removeAttribute("aria-busy"),X(G,"Timed out waiting for a response. Try again.",!0)},zJ);let q=Z.getActiveChat();if(j)Z.sendToBackend({type:"rewrite_multi",segments:j.segments.map((H)=>({messageId:H.messageId,text:H.text})),profileId:M.value,customPrompt:Q?J:void 0,concise:N.checked,connectionId:K.value,lengthPct:parseInt(h.value,10)||100,chatId:j.chatId,characterId:q.characterId??void 0});else Z.sendToBackend({type:"rewrite",profileId:M.value,customPrompt:Q?J:void 0,text:R.value,concise:N.checked,connectionId:K.value,lengthPct:parseInt(h.value,10)||100,chatId:D?.chatId??q.chatId??void 0,messageId:D?.messageId,characterId:q.characterId??void 0});if(Q)cq(J)}),P.addEventListener("click",()=>{if(j){let J=j.segments.filter((q)=>q.output!=null).map((q)=>({messageId:q.messageId,R:q.R,rs:q.rs,re:q.re,output:q.output}));if(!J.length){X(G,"Output is empty — run a rewrite first.",!0);return}if(j.chatId!==Z.getActiveChat().chatId){X(G,"That selection is from a different chat — switch back or re-select here.",!0);return}P.disabled=!0,X(G,"Applying…"),Z.sendToBackend({type:"apply_multi",chatId:j.chatId,items:J});return}if(!D){X(G,"No captured selection. Turn on Watch mode and highlight text in a message.",!0);return}if(!L.value.trim()){X(G,"Output is empty — run a rewrite first.",!0);return}if(D.chatId!==Z.getActiveChat().chatId){X(G,"That selection is from a different chat — switch back or re-select here.",!0);return}let Q=ZJ(D.messageId);if(Q===null||Q!==D.R){D=null,X(B,""),X(G,"The message changed since you selected it. Re-select the text and run again.",!0);return}P.disabled=!0,X(G,"Applying…"),Z.sendToBackend({type:"apply",chatId:D.chatId,messageId:D.messageId,R:D.R,rs:D.rs,re:D.re,output:L.value})}),i.addEventListener("click",()=>Z.sendToBackend({type:"undo"})),g.addEventListener("click",()=>Z.sendToBackend({type:"redo"})),pq.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(L.value),X(G,"Copied output.")}catch{X(G,"Copy failed.",!0)}});let nq=Z.onBackendMessage((Q)=>{let J=Q;switch(J.type){case"config":{Rq=J.config;let q=J.config;if(c=q.connectionId,[...K.options].some((H)=>H.value===c))K.value=c;if(k.checked=q.watch,N.checked=q.concise,a.value=String(Math.min(q.lengthPct,200)),h.value=String(q.lengthPct),C.checked=q.autoApply,S.checked=q.debug??!1,Nq.checked=q.usePrevMessages,Aq.checked=q.useCharCard,Oq.checked=q.useUserPersona,_q.checked=q.speakerAware,kq.checked=q.useMemory,Dq.checked=q.useLorebook,qq=q.customPrompts||[],wq(),v=q.customProfiles||[],m=q.hiddenProfiles||[],jq=q.autoProfiles||{},u(),t(),zq.open=!q.costCollapsed,Zq.checked=q.showDiff??!1,Jq(),Xq.value=String(q.historyDepth??30),R.value.trim())I();break}case"rewrite_result":if(Wq(),L.value=J.text,X(G,`Done.${J.tokens?` · prompt ~${J.tokens} tok`:""}`),Jq(),C.checked&&D)P.click();break;case"rewrite_multi_result":{if(Wq(),j){for(let H of J.segments){let U=j.segments.find((A)=>A.messageId===H.messageId);if(U)U.output=H.output}L.value=j.segments.map((H)=>H.output??"").join(hq),L.readOnly=!0;let q=j.segments.filter((H)=>H.output!=null).length;if(X(G,`Rewrote ${q} messages — Apply applies all.${J.tokens?` · prompt ~${J.tokens} tok`:""}`),Jq(),C.checked)P.click()}break}case"rewrite_error":Wq(),X(G,J.error,!0);break;case"rewrite_cancelled":Wq(),X(G,"Cancelled.");break;case"apply_done":P.disabled=!1,i.disabled=!J.canUndo,g.disabled=!J.canRedo,X(G,"Applied to message ✓");break;case"apply_multi_done":{P.disabled=!1,i.disabled=!J.canUndo,g.disabled=!J.canRedo,X(G,`Applied ${J.applied} message(s).${J.skipped.length?" Skipped "+J.skipped.length+" (couldn't locate).":""}`),j=null,L.readOnly=!1;break}case"apply_error":P.disabled=!1,X(G,J.error,!0);break;case"undo_done":i.disabled=!J.canUndo,g.disabled=!J.canRedo,X(G,"Reverted ✓");break;case"undo_error":X(G,J.error,!0);break;case"redo_done":i.disabled=!J.canUndo,g.disabled=!J.canRedo,X(G,"Reapplied ✓");break;case"redo_error":X(G,J.error,!0);break;case"history":i.disabled=!J.canUndo,g.disabled=!J.canRedo;break;case"connections":rq(J.connections);break;case"refine_result":p.disabled=!1,p.innerHTML=_("Refine"),b.value=J.text,X(G,"Refined.");break;case"refine_error":p.disabled=!1,p.innerHTML=_("Refine"),X(G,J.error,!0);break;case"architect_result":d.disabled=!1,d.innerHTML=_("AI generate style"),f.value=J.name,x.value=J.prompt,X(G,"Style drafted — review and Add.");break;case"architect_error":d.disabled=!1,d.innerHTML=_("AI generate style"),X(G,J.error,!0);break;case"autoprofile_result":Uq.disabled=!1,jq[J.chatId]={name:J.name,prompt:J.prompt},u(),M.value="auto:"+J.chatId,M.dispatchEvent(new Event("change")),X(G,`Style ready: ${J.name}`);break;case"autoprofile_error":Uq.disabled=!1,X(G,J.error,!0);break;case"debug":{let q=J.entries;if(!q.length){X(G,"Debug log is empty (enable Debug log, then run a rewrite).");break}let H=new Blob([JSON.stringify(q,null,2)],{type:"application/json"}),U=document.createElement("a");U.href=URL.createObjectURL(H),U.download="rewrite-debug.json",U.click(),URL.revokeObjectURL(U.href),X(G,`Debug log exported (${q.length} entr${q.length===1?"y":"ies"}).`);break}case"token_estimate":{vq.textContent=`≈ ${J.total} tokens`,Iq.replaceChildren();let q=(H,U)=>{let A=Z.dom.createElement("div");A.className="rw-cost-line";let l=Z.dom.createElement("span");l.textContent=H;let Kq=Z.dom.createElement("span");Kq.textContent=String(U),A.appendChild(l),A.appendChild(Kq),Iq.appendChild(A)};q("selection",J.selection);for(let H of J.sources)q(H.label,H.tokens);q("system",J.system);break}}});return g.disabled=!0,Z.sendToBackend({type:"get_config"}),Z.sendToBackend({type:"get_connections"}),Z.sendToBackend({type:"get_history"}),()=>{if(document.removeEventListener("selectionchange",fq),document.removeEventListener("keydown",Sq),Qq)clearTimeout(Qq);if(w)clearTimeout(w);if(o)clearTimeout(o);nq(),Y(),Z.dom.cleanup(),W.destroy()}}export{AJ as setup,Cq as multiSegSpan};

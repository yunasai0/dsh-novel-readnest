"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[1413],{1751:(e,t,r)=>{r.d(t,{SS:()=>u,Xy:()=>i,ty:()=>f});var o=r(95917);let a="readest-dialogue",n="readest-dialogue-block",i=e=>!!e.dialogueHighlight||!!e.dialogueHighlightCustomTextColor||"slightly-heavier"===e.dialogueHighlightWeight||"bold"===e.dialogueHighlightWeight,l=/“[^“”]+?[”"]|„[^„“]+?[“"]|"[^"\n]+?"|«[^«»]+?[»]|「[^「」]+?[」]|『[^『』]+?[』]|‘(?:[^‘’\n]|’(?=\p{L})|\p{L}’(?=[\s\p{Pd}]))*?(?![‘’“”„«»「」『』"'])\p{P}’(?!\p{L})|‘(?:[^‘’]|’(?=\p{L})){1,300}?’(?!\p{L})/gu,s=/“[^“”\n]*(?:“[^“”\n]*”[^“”\n]*)+”|„[^„“\n]*(?:„[^„“\n]*“[^„“\n]*)+“|«[^«»\n]*(?:«[^«»\n]*»[^«»\n]*)+»/gu,d=/“[^“”"]+$|„[^„“"]+$|«[^«»]+$|「[^「」]+$|『[^『』]+$|‘(?:[^‘’]|’(?=\p{L}))+$/gu,c=/‘(?:[^‘’]|’(?=\p{L})){1,300}?’(?!\p{L})/uy,g=/^[—–―－][\s\u3000]/,h=e=>{let t=e.parentElement;return!!(!t||t.closest(`.${a}`))||!!t.closest("pre, code, kbd, samp, script, style, textarea, rt, rp")},p=(e,t,r,o)=>{if(r>=o)return;o<t.length&&t.splitText(o);let n=r>0?t.splitText(r):t,i=e.createElement("span");i.className=a,i.setAttribute("cfi-skip",""),n.parentNode?.replaceChild(i,n),i.appendChild(n)},m="p, li, blockquote, dd, dt",u=(e,t)=>{if(e.querySelectorAll(`.${a}`).forEach(e=>{let t=e.parentNode;if(t){for(;e.firstChild;)t.insertBefore(e.firstChild,e);t.removeChild(e)}}),e.querySelectorAll(`.${n}`).forEach(e=>{e.classList.remove(n)}),(e.body??e.documentElement)?.normalize(),!i(t)||!e.body&&!e.documentElement)return;let{entries:r,text:o,blocks:u}=(e=>{let t=e.defaultView?.NodeFilter.SHOW_TEXT??4,r=e.createTreeWalker(e.body??e.documentElement,t),o=[],a=[],n="",i=null,l=r.nextNode(),s=null;for(;l;){let e=l.textContent??"";if(e&&!l.parentElement?.closest("script, style")){let t=l.parentElement?.closest("p, div, li, blockquote, dd, dt, h1, h2, h3, h4, h5, h6, td, th, caption, figcaption, section, article, aside, body")??null;(0===a.length||t!==s)&&a.push({start:n.length,end:n.length,firstCharacter:"",firstCharacterEligible:!1}),s=t;let r=a[a.length-1],d=!h(l);r.firstCharacter||(r.firstCharacter=e.trimStart().charAt(0),r.firstCharacterEligible=d),d&&(i&&t!==i&&(n+="\n"),r.start===r.end&&(r.start=n.length),i=t,o.push({node:l,start:n.length,end:n.length+e.length}),r.end=(n+=e).length)}l=r.nextNode()}return{entries:o,text:n,blocks:a}})(e);if(0!==r.length){let t,a;((e,t,r)=>{let o=t.length-1;for(let a=r.length-1;a>=0;a--){let n=r[a];for(;o>=0&&t[o].start>=n.end;)o--;for(let r=o;r>=0&&t[r].end>n.start;r--){let o=t[r];o.node.isConnected&&p(e,o.node,Math.max(n.start,o.start)-o.start,Math.min(n.end,o.end)-o.start)}}})(e,r,((e,t)=>{let r=[],o=t.filter(e=>e.firstCharacter);for(let t=0;t<o.length-1;t++){let a=o[t],n=o[t+1],i=e.slice(a.start,a.end).trimEnd();d.lastIndex=0;let l=d.exec(i);if(!l||!n.firstCharacterEligible||l[0][0]!==n.firstCharacter)continue;let s="‘"===l[0][0]?301:2048;l[0].length>s||r.push({start:a.start+l.index,end:a.start+i.length})}for(let t of[l,s]){let o;for(t.lastIndex=0;o=t.exec(e);){if(o[0].length>2048){if(t.lastIndex=o.index+1,t===l&&"‘"===o[0][0]){c.lastIndex=o.index;let a=c.exec(e);a&&(r.push({start:o.index,end:o.index+a[0].length}),t.lastIndex=o.index+a[0].length)}continue}r.push({start:o.index,end:o.index+o[0].length})}}r.sort((e,t)=>e.start-t.start||t.end-e.end);let a=[],n=-1;for(let e of r)e.start>=n&&(a.push(e),n=e.end);return a})(o,u)),a=new Set(t=[...e.querySelectorAll(m)].filter(e=>g.test((e.textContent??"").trimStart()))),t.forEach(e=>{[...e.querySelectorAll(m)].some(e=>a.has(e))||e.classList.add(n)})}},f=function(e,t,r){let a=arguments.length>3&&void 0!==arguments[3]?arguments[3]:null,n=(a??[]).flatMap(e=>"subitems"in e?e.subitems:[e]).flatMap(e=>e.cfis??[e.cfi]);for(let{doc:a,index:i}of e.renderer.getContents())u(a,t),r.filter(e=>"annotation"===e.type&&e.style&&!e.deletedAt&&(0,o.bw)(e.cfi)===i).forEach(t=>e.addAnnotation(t)),n.filter(e=>(0,o.bw)(e)===i).forEach(t=>e.addAnnotation({value:"foliate-search:"+t}))}},19930:(e,t,r)=>{r.d(t,{BH:()=>p,FE:()=>h,NN:()=>a,QG:()=>i,gs:()=>l,nK:()=>o});let o="scroll-wrapper",a="scroll-wrapper-fit",n=`.${o}`,i="link-hit-area",l=10,s="data-readest-scroll-wrapper-touch-scroll",d=e=>e.scrollWidth-e.clientWidth>4,c=e=>e.scrollHeight-e.clientHeight>4,g=e=>{if(!e||!("closest"in e))return null;let t=e.closest(n);for(;t;){if(!t.classList.contains(a)&&(d(t)||c(t)))return t;t=t.parentElement?.closest(n)??null}return null},h=e=>{let t=e.documentElement;if("true"===t.getAttribute(s))return;t.setAttribute(s,"true");let r=0,o=0,a=null,n=()=>{a=null},i={capture:!0,passive:!1};e.addEventListener("touchstart",e=>{if(!(a=g(e.target)))return;let t=e.changedTouches[0];t&&(r=t.screenX,o=t.screenY)},i),e.addEventListener("touchmove",e=>{var t;if(!a||!a.contains(e.target))return;let n=e.changedTouches[0];if(!n)return;let i=n.screenX-r,l=n.screenY-o;t=a,(Math.abs(i)>Math.abs(l)?Math.abs(i)>=8&&d(t):Math.abs(l)>=8&&c(t))&&e.stopImmediatePropagation()},i),e.addEventListener("touchend",n,i),e.addEventListener("touchcancel",n,i),e.addEventListener("wheel",e=>{let t=g(e.target);t&&(Math.abs(e.deltaX)>Math.abs(e.deltaY)?d(t):c(t))&&e.stopImmediatePropagation()},{capture:!0,passive:!0})},p=e=>{let t=e.defaultView,r=r=>{let a=r.parentElement;if(!a||a.classList.contains(o))return;let n=e.createElement("div");n.className=o,n.setAttribute("cfi-skip",""),a.insertBefore(n,r),n.appendChild(r),u(r,n,t),y(n,t)};e.querySelectorAll("table:not([data-foliate-chunk])").forEach(r),e.querySelectorAll("math").forEach(e=>{((e,t)=>{if("block"===e.getAttribute("display"))return!0;let r=e;for(;;){let e=r.parentElement;if(!e)return!1;for(let t of e.childNodes)if(t!==r&&(t.nodeType===Node.ELEMENT_NODE||t.nodeType===Node.TEXT_NODE&&t.textContent?.trim()))return!1;if(!t?.getComputedStyle(e).display.startsWith("inline"))return!0;r=e}})(e,t)&&r(e)})},m=["Top","Right","Bottom","Left"],u=(e,t,r)=>{if(!r)return;let o=e.style;if(!o)return;let a=r.getComputedStyle(e);for(let e of m){let r=`margin${e}`,n=a[r];0>parseFloat(n)&&(t.style[r]=n,o[r]="0px")}},f=e=>{let t=e.scrollWidth-e.clientWidth;e.classList.toggle(a,t<=4||b(e,t))},b=(e,t)=>{if(t>l+4||!e.ownerDocument.documentElement.classList.contains(i))return!1;let r=e.querySelector(":scope > table");if(!r||r.offsetWidth-e.clientWidth>4)return!1;let o=e.ownerDocument.defaultView?.getComputedStyle(e).direction==="rtl",a=e.getBoundingClientRect().left+e.clientLeft,n=a+e.clientWidth;return[...r.querySelectorAll("a")].some(e=>{let r=e.getBoundingClientRect();return(o?a-r.left:r.right-n)+l>=t-4})},y=(e,t)=>{if(!t?.ResizeObserver)return;let r=new t.ResizeObserver(()=>{e.clientWidth<=0||(f(e),r.disconnect(),k(e,t))});r.observe(e)},k=(e,t)=>{let r=e.ownerDocument.fonts;if(r?.status==="loading"){let o=Date.now()+1e4,a=t.setInterval(()=>{"loading"===r.status&&Date.now()<o||(t.clearInterval(a),f(e))},100)}for(let t of Array.from(e.querySelectorAll("img")))t.complete||t.addEventListener("load",()=>f(e),{once:!0})}},31413:(e,t,r)=>{r.d(t,{a0:()=>y,xg:()=>k,Xy:()=>P,xD:()=>K,nt:()=>M,nT:()=>G,Zb:()=>B,jO:()=>_,Si:()=>O,Hx:()=>q,bs:()=>N,hx:()=>m,e$:()=>f,h6:()=>v,Yc:()=>u,D1:()=>x,AU:()=>J,Yz:()=>Y,$f:()=>A,rj:()=>E,uM:()=>X,J3:()=>z,uI:()=>D,Jp:()=>R});var o=r(67299),a=r(68182),n=r(97390),i=r(5014),l=r(1751),s=r(80043),d=r(61215),c=r(1667);let g=`url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><filter id="readest-white-transparent" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="255" intercept="-244"/><feFuncG type="linear" slope="255" intercept="-244"/><feFuncB type="linear" slope="255" intercept="-244"/></feComponentTransfer><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 1 1 0 -2"/><feComposite in="SourceGraphic" operator="out"/></filter></svg>')}#readest-white-transparent")`;var h=r(19930);let p=(e,t,r,a)=>{let n=["Georgia","Times New Roman"],i=[e,...a!==e?[a]:[],...o.H0.filter(t=>t!==e&&t!==a&&!n.includes(t)),...o.az.filter(t=>t!==e&&t!==a),...n.filter(e=>o.H0.includes(e)&&!n.includes(a)),...o.o6],l=[t,...a!==t?[a]:[],...o.Z4.filter(e=>e!==t&&e!==a),...o.Yk.filter(e=>e!==t&&e!==a),...o.o6],s=[r,...o.nh.filter(e=>e!==r)],d=e=>e.map(e=>`"${e}"`).join(", ");return{serif:`${d(i)}, serif`,sansSerif:`${d(l)}, sans-serif`,monospace:`${d(s)}, monospace`}},m=e=>{let t=p(e.serifFont,e.sansSerifFont,e.monospaceFont,e.defaultCJKFont);return"serif"===e.defaultFont.toLowerCase()?t.serif:t.sansSerif},u=e=>{let t=p(e.serifFont,e.sansSerifFont,e.monospaceFont,e.defaultCJKFont);return{serif:t.serif,sans:t.sansSerif}},f=e=>{let t=["ios","android"].includes((0,c.Ox)()),r=(e.zoomLevel||100)/100;return e.defaultFontSize*(t?1.25:1)*r},b=()=>`
    ::selection {
      color: var(--theme-bg-color);
      background: var(--theme-fg-color);
    }
    ::-moz-selection {
      color: var(--theme-bg-color);
      background: var(--theme-fg-color);
    }
  `,y="link-touch-hold",k="text-selected",$=["zh","ja","ko"],w=$.map(e=>`:lang(${e})`).join(", "),x=()=>`
  .duokan-footnote-content,
  .duokan-footnote-item {
    display: block !important;
  }

  body {
    padding: 1em !important;
    overflow-wrap: break-word;
  }

  a:any-link {
    text-decoration: none;
    padding: unset;
    margin: unset;
  }

  ol {
    margin: 0;
    padding: 0;
  }

  p, li, blockquote, dd {
    margin: unset !important;
    text-indent: unset !important;
  }

  div {
    margin: unset !important;
    padding: unset !important;
  }

  dt {
    font-weight: bold;
    line-height: 1.6;
  }

  .epubtype-footnote,
  aside[epub|type~="endnote"],
  aside[epub|type~="footnote"],
  aside[epub|type~="note"],
  aside[epub|type~="rearnote"] {
    display: block;
  }
`,v=(e,t,r)=>`
    a:empty {
      background-color: transparent;
      mix-blend-mode: multiply;
    }
    a img {
      mix-blend-mode: multiply;
    }
    div[data-dict-kind="mdict"] .entry_name {
      font-size: 1.2em;
      margin-block-start: 0.5em;
      margin-block-end: 0.5em;
    }
    div[data-dict-kind="mdict"] .juan_drop {
      ${r?`background-color: color-mix(in srgb, ${e} 80%, #000);`:""}
    }
  `,S=e=>{let t=e.match(/^rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)$/);if(!t)return null;let[r,o,a]=[Number(t[1]),Number(t[2]),Number(t[3])];return{r,g:o,b:a,a:void 0===t[4]?1:Number(t[4]),brightness:.299*r+.587*o+.114*a}},z=e=>{let t=e=>{let t=e.getRootNode();return e.parentElement??(t instanceof ShadowRoot?t.host:null)},r=!1;for(let o=t(e);o;o=t(o)){let e=S(getComputedStyle(o).backgroundColor);if(e&&e.a>.5){r=e.brightness>=128;break}}let o=new Map,a=[];for(let t of[e,...e.querySelectorAll("*")]){let n=getComputedStyle(t),i=S(n.backgroundColor),l=t===e?r:!!o.get(t.parentElement),s=i&&i.a>.5?i.brightness>=128:l;o.set(t,s);let d=S(n.color);if(!d||s||d.brightness>=128)continue;let c=Math.round(255-2*d.brightness),[g,h,p]=[d.r,d.g,d.b].map(e=>Math.min(255,e+c));a.push([t,`rgba(${g}, ${h}, ${p}, ${d.a})`])}for(let[e,t]of a)e.style.setProperty("color",t,"important")},C=e=>`
  .translation-source {
  }
  .translation-target {
  }
  /* The original is wrapped rather than erased so its CFIs stay resolvable;
     cfi-skip keeps the wrapper invisible to CFI indexing. */
  .translation-source-hidden {
    display: none !important;
  }
  .translation-target.hidden {
    display: none !important;
  }
  .translation-target-block {
    display: block !important;
    ${e.showTranslateSource?"margin: 0.5em 0 !important;":""}
    ${(e=>{let{translationFont:t,translationFontStyle:r,translationFontSize:o,translationColor:a}=e;return[t&&`font-family: var(--${t}) !important;`,r?.includes("italic")&&"font-style: italic !important;",r?.includes("bold")&&"font-weight: bold !important;",o&&1!==o&&`font-size: ${o}em !important;`,a&&`color: ${a} !important;`].filter(Boolean).join("\n    ")})(e)}
  }
  .translation-target-toc {
    display: block !important;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`,E=()=>{let e="auto",t="default",r=!1,o=!1,a=[];t=localStorage.getItem("themeColor")||"default",e=localStorage.getItem("themeMode")||"auto",r="true"===localStorage.getItem("systemIsDarkMode"),o=(0,s.XJ)(localStorage.getItem("ambientIsDarkMode"),r),a=JSON.parse(localStorage.getItem("customThemes")||"[]");let i="dark"===e||"auto"===e&&r||"ambient"===e&&o,l=n.Zj.find(e=>e.name===t);if(!l){let e=a.find(e=>e.name===t);e&&(l={name:e.name,label:e.label,colors:{light:(0,n.PF)(e.colors.light),dark:(0,n.n1)(e.colors.dark)}})}l||(l=n.Zj[0]);let d=i?l.colors.dark:l.colors.light;return{bg:d["base-100"],fg:d["base-content"],primary:d.primary,palette:d,isDarkMode:i}},A=function(e,t){var r,o,a,n,i,s,c,m,u,x,v;let S,z,A,N,I,F,T,H,j,D,R,q,_,W,B,P,O,M,G,X,J,Y,K,U,V=arguments.length>2&&void 0!==arguments[2]?arguments[2]:[],Z=arguments.length>3&&void 0!==arguments[3]&&arguments[3];t||(t=E());let Q=(S=e.marginTopPx,z=e.marginRightPx,A=e.marginBottomPx,N=e.marginLeftPx,I=e.writingMode,F=e.vertical,`
  html {
    /* The paginator forces this on the root in paginated mode only; scrolled
       mode needs it too or a long URL runs past the viewport (#7154).
       break-word, not anywhere: see the td, th rule (#5681). */
    overflow-wrap: break-word !important;
    --margin-top: ${S}px;
    --margin-right: ${z}px;
    --margin-bottom: ${A}px;
    --margin-left: ${N}px;
  }
  html, body {
    ${"auto"===I?"":`writing-mode: ${I} !important;`}
    max-height: unset;
    -webkit-touch-callout: none;
    -webkit-user-select: text;
  }
  body {
    overflow: unset;
    zoom: 1;
    padding: unset;
    margin: unset;
  }
  /* -webkit-touch-callout on html/body does not reach descendant images in
     Android WebView, and the native image callout collides with the reader's
     touch handlers and can freeze the app */
  img {
    -webkit-touch-callout: none;
    -webkit-user-drag: none;
  }
  /* Chromium snaps a long press onto any link in reach of the finger, and a
     link long press starts no selection (#6242); set while a touch is held */
  html.${y} a[href] {
    pointer-events: none !important;
  }
  /* Linked images must still receive Android's long-press contextmenu. */
  html.${y} a[href] img:not([zy-enlarge-src="none"]),
  html.${y} a[href] svg:not([zy-enlarge-src="none"]) image {
    pointer-events: auto !important;
  }
  svg:where(:not([width])), img:where(:not([width])) {
    width: auto;
  }
  svg:where(:not([height])), img:where(:not([height])) {
    height: auto;
  }
  figure > div:has(img) {
    height: auto !important;
  }
  /* enlarge the clickable area of links, in documents opted in by applyLinkHitArea */
  html.${h.QG} a {
    position: relative !important;
  }
  html.${h.QG} a::before {
    content: '';
    position: absolute;
    inset: -${h.gs}px;
  }
  /* the enlarged area swallows the text around a link, so a selection dragged
     next to a footnote marker snaps away (#6566); set while text is selected */
  html.${k} a::before {
    pointer-events: none;
  }

  .${h.nK} {
    display: block;
    overflow: auto;
    max-width: 100%;
    touch-action: pan-x pan-y;
    scrollbar-width: thin;
    -webkit-overflow-scrolling: touch;
  }
  .${h.NN} {
    overflow: visible;
  }
  .${h.nK} > table {
    display: table !important;
    max-width: 100%;
  }
  /* A scroll container is monolithic in CSS fragmentation, so a scrolling
     wrapper can't break across columns: taller than the page, it overflows the
     column and every row past the first page is clipped and unreachable
     (#6129). Clamp the wrapper — not the table, whose max-height Chromium and
     WebKit treat as a minimum — to one page so it scrolls vertically in place.
     A fit wrapper is overflow:visible and its rows paginate normally. */
  body.paginated-mode .${h.nK}:not(.${h.NN}) {
    max-height: calc(var(--available-height) * 1px);
  }
  pre, code {
    white-space: pre-wrap !important;
    scrollbar-width: none;
  }
  math {
    overflow: auto;
    scrollbar-width: none;
    max-height: calc(var(--available-height) * 1px);
  }
  table, math {
    max-width: calc(var(--available-width) * 1px);
  }

  .epubtype-footnote,
  aside[epub|type~="endnote"],
  aside[epub|type~="footnote"],
  aside[epub|type~="note"],
  aside[epub|type~="rearnote"] {
    display: none;
  }

  /* Now begins really dirty hacks to fix some badly designed epubs */
  .duokan-footnote-content,
  .duokan-footnote-item {
    display: none;
  }

  .duokan-image-gallery-cell {
    height: calc(var(--available-height) * 1px);
  }

  .duokan-image-gallery-cell img {
    height: 90%;
  }

  div:has(> img, > svg) {
    max-width: 100% !important;
  }

  body.paginated-mode td:has(img), body.paginated-mode td :has(img) {
    max-height: calc(var(--available-height) * 0.8 * 1px);
  }

  body.paginated-mode img {
    max-width: 100%;
    max-height: calc(var(--available-height) * 1px);
    object-fit: contain;
  }

  body.paginated-mode svg {
    max-width: 100%;
    max-height: calc(var(--available-height) * 1px);
  }

  body.scroll-mode img {
    max-width: 100%;
    object-fit: contain;
  }

  figure.code {
    overflow: unset !important;
  }

  /* some epubs set insane inline-block for p */
  p {
    display: block;
  }

  /* inline images without dimension */
  .ie6 img {
    width: unset;
    height: unset;
  }
  sup img {
    height: 1em;
  }
  img.has-text-siblings {
    ${F?"width: 1em;":"height: 1em;"}
  }
  /* Baseline is only Readest's default: applyImageStyle adds this class when the
     book leaves vertical-align at its initial value, so an author-set value
     (e.g. a CJK glyph-substitution image nudged with vertical-align: -0.15em)
     keeps winning. See #4866. */
  img.has-text-siblings-baseline {
    vertical-align: baseline;
  }
  :is(div) > img.has-text-siblings[style*="object-fit"] {
    display: block;
    height: auto;
    vertical-align: unset;
  }
  .duokan-footnote img:not([class]) {
    width: 0.8em;
    height: 0.8em;
  }
  div:has(img.singlepage) {
    position: relative;
    width: auto;
    height: auto;
  }
  /* some mobi */
  p[width][height] > img:only-child { 
    width: unset !important;
    height: unset !important;
  }

  /* page break */
  body.paginated-mode div[style*="page-break-after: always"],
  body.paginated-mode div[style*="page-break-after:always"],
  body.paginated-mode p[style*="page-break-after: always"],
  body.paginated-mode p[style*="page-break-after:always"] {
    margin-bottom: calc(var(--available-height) * 1px);
  }

  .br {
    display: flow-root;
  }

  .h5_mainbody {
    overflow: unset !important;
  }
`),ee=e.useBookLayout?"":(T=e.overrideLayout,H=e.paragraphMargin,j=e.lineHeight,D=e.wordSpacing,R=e.letterSpacing,q=e.textIndent,_=e.fullJustification,W=e.hyphenation,B=e.vertical,`
  html {
    --default-text-align: ${_?"justify":"start"};
    hanging-punctuation: allow-end last;
    orphans: 2;
    widows: 2;
  }
  html, body {
    text-align: var(--default-text-align);
  }
  /* Authored text-wrap: pretty (e.g. Standard Ebooks' core.css) makes engines
     that justify with it (Safari 26+, recent Chromium) overshoot inter-word
     gaps and blocks the Word Spacing setting (#5582). Only the style longhand
     is reset so an authored nowrap mode survives, and only on justified text
     containers so balanced headings keep their rag. */
  ${_?"html, body, p, li, blockquote, dd { text-wrap-style: auto !important; }":""}
  [align="left"] { text-align: left; }
  [align="right"] { text-align: right; }
  [align="center"] { text-align: center; }
  [align="justify"] { text-align: justify; }
  /* Some badly designed EPUBs put their line-height on body; drop it so the
     Line Spacing setting below, not an inherited value, spaces the text. It
     lives in this chunk so Use Book Layout lets the book's body value
     inherit (#6088). */
  body {
    line-height: unset;
  }
  :is(hgroup, header) p {
      text-align: unset;
      hyphens: unset;
  }
  /* The div clause treats a div as paragraph-like only when every descendant is
     inline formatting (INLINE_FORMATTING_TAGS). Anything injected into a book
     paragraph at runtime — the translation target, its preserved markup, the
     a11y skip link — must use a tag from that list, or the enclosing div drops
     this whole rule and reverts to the book's default line spacing, indent and
     hyphenation. */
  p, blockquote, dd, div:not(:has(*:not(${d.Yu}))) {
    line-height: ${j} ${T?"!important":""};
    word-spacing: ${D}px ${T?"!important":""};
    letter-spacing: ${R}px ${T?"!important":""};
    text-indent: ${q}em ${T?"!important":""};
    -webkit-hyphens: ${W?"auto":"manual"} ${T?"!important":""};
    hyphens: ${W?"auto":"manual"} ${T?"!important":""};
    -webkit-hyphenate-limit-before: 3;
    -webkit-hyphenate-limit-after: 2;
    -webkit-hyphenate-limit-lines: 2;
    hanging-punctuation: allow-end last;
    widows: 2;
  }
  li {
    line-height: ${j} ${T?"!important":""};
    -webkit-hyphens: ${W?"auto":"manual"} ${T?"!important":""};
    hyphens: ${W?"auto":"manual"} ${T?"!important":""};
  }
  p.aligned-center, blockquote.aligned-center,
  dd.aligned-center, div.aligned-center {
    text-align: center ${T?"!important":""};
  }
  p.aligned-left, blockquote.aligned-left,
  dd.aligned-left, div.aligned-left {
    ${_&&T?"text-align: justify !important;":""}
  }
  p.aligned-right, blockquote.aligned-right,
  dd.aligned-right, div.aligned-right {
    text-align: right ${T?"!important":""};
  }
  p.aligned-justify, blockquote.aligned-justify,
  dd.aligned-justify, div.aligned-justify {
    ${!_&&T?"text-align: initial !important;":""};
  }
  /* An image that starts a paragraph must not take the indent: sized to the
     column, it would overhang by the indent and paint a strip on the next page
     (#6198). applyImageStyle marks such paragraphs; selectors can't see text,
     so :only-child also matched a footnote icon inside text. */
  p.leading-image {
    text-indent: initial !important;
  }
  blockquote[align="center"], div[align="center"],
  p[align="center"], dd[align="center"],
  p.aligned-center, blockquote.aligned-center,
  dd.aligned-center, div.aligned-center,
  li p, ol p, ul p, td p {
    text-indent: initial !important;
  }
  /* Some converted books use an inline-only <blockquote> for every paragraph
     (#6656); under override it is spaced like a <p>, while a quote wrapping
     block content keeps its indent. */
  p${T?`, blockquote:not(:has(*:not(${d.Yu})))`:""} {
    ${B?`margin-left: ${H}em ${T?"!important":""};`:""}
    ${B?`margin-right: ${H}em ${T?"!important":""};`:""}
    ${B?`margin-top: unset ${T?"!important":""};`:""}
    ${B?`margin-bottom: unset ${T?"!important":""};`:""}
    ${!B?`margin-top: ${H}em ${T?"!important":""};`:""}
    ${!B?`margin-bottom: ${H}em ${T?"!important":""};`:""}
    ${!B?`margin-left: unset ${T?"!important":""};`:""}
    ${!B?`margin-right: unset ${T?"!important":""};`:""}
  }
  div {
    ${B&&T?`margin-left: ${H}em !important;`:""}
    ${B&&T?`margin-right: ${H}em !important;`:""}
    ${!B&&T?`margin-top: ${H}em !important;`:""}
    ${!B&&T?`margin-bottom: ${H}em !important;`:""}
  }
  p > font:only-child { 
    display: flow-root; 
  }

  ${w} {
    widows: 1;
    orphans: 1;
  }

  /* workaround for some badly designed epubs */
  div.left *, p.left * { text-align: left; }
  div.right *, p.right * { text-align: right; }
  div.center *, p.center * { text-align: center; }
  div.justify *, p.justify * { text-align: justify; }

  img.pi {
    ${B?"transform: rotate(90deg);":""}
    ${B?"transform-origin: center;":""}
    ${B?"height: 2em;":""}
    ${B?`width: ${j}em;`:""}
    ${B?"vertical-align: unset;":""}
  }

  .nonindent, .noindent {
    text-indent: unset !important;
  }
`),et=(r=e.serifFont,o=e.sansSerifFont,a=e.monospaceFont,n=e.defaultFont,i=e.defaultCJKFont,s=f(e),c=e.minimumFontSize,m=e.fontWeight,u=e.overrideFont,x=e.ignorePublisherFonts??[],P=p(r,o,a,i),O="serif"===n.toLowerCase()?"--serif":"--sans-serif",M=`
    p, li, div, pre, dd {
      font-size: max(1rem, var(--min-font-size, 8px)) !important;
    }
  `,`
    html {
      --serif: ${P.serif};
      --sans-serif: ${P.sansSerif};
      --monospace: ${P.monospace};
      ${u?"":x.map(e=>`--book-${e}: var(--${e});`).join(" ")}
      --font-size: ${s}px;
      --min-font-size: ${c}px;
      --font-weight: ${m};
    }
    html, body {
      font-size: ${s}px !important;
      font-weight: ${m};
      -webkit-text-size-adjust: none;
      text-size-adjust: none;
    }
    /* Zero specificity (:where) so ANY ebook font-family declaration — even
       one on the html element itself, at equal (0,0,1) specificity — wins the
       cascade regardless of injection order. Books like Pandoc-generated
       EPUBs declare their font on the html element; a plain html rule here
       ties on specificity and wins only by being appended later, silently
       overriding the book's embedded font with the app's default font
       (mobile especially, whose default font is sans-serif). */
    :where(html) {
      font-family: var(${O}) ${u?"!important":""};
    }
    /* higher specificity than ebook built-in font styles */
    html body {
      ${u?`font-family: var(${O}) !important;`:""}
    }
    font[size="1"] {
      font-size: ${c}px;
    }
    font[size="2"] {
      font-size: ${1.5*c}px;
    }
    font[size="3"] {
      font-size: ${s}px;
    }
    font[size="4"] {
      font-size: ${1.2*s}px;
    }
    font[size="5"] {
      font-size: ${1.5*s}px;
    }
    font[size="6"] {
      font-size: ${2*s}px;
    }
    font[size="7"] {
      font-size: ${3*s}px;
    }
    /* hardcoded inline font size */
    [style*="font-size: 16px"], [style*="font-size:16px"] {
      font-size: 1rem !important;
    }
    /* The revert pass below deliberately excludes pre/code/kbd, so this is the
       only rule that applies the app's code font and it has to swap sides with
       the toggle. Off: zero specificity, so a book's own code font wins. On:
       above the book, and !important is not enough on its own because
       specificity still breaks ties between important author declarations. */
    ${u?"html body :is(pre, code, kbd)":":where(pre, code, kbd)"} {
      font-family: var(--monospace) ${u?"!important":""};
      font-variant-ligatures: none;
    }
    body *:not(pre, code, kbd, .code):not(pre *, code *, kbd *, .code *) {
      ${u?"font-family: revert !important;":""}
    }
    ${u?M:""}
  `),er=L(V),eo=((e,t,r,o,a,n,i)=>{let{bg:l,fg:s,primary:d,isDarkMode:c}=r,h=!!o&&"none"!==o,p=n&&h,m=h?"transparent":l;return`
    html {
      --bg-texture-id: ${o};
      --theme-bg-color: ${l};
      --theme-fg-color: ${s};
      --theme-primary-color: ${d};
      --override-color: ${e};
      color-scheme: ${c?"dark":"light"};
    }
    ${p&&!e?"html":"html, body"} {
      color: ${s};
    }
    ${a?b():c?`
    ::selection {
      background: color-mix(in srgb, ${d} 40%, transparent);
    }
  `:""}
    html[has-background], body[has-background] {
      --background-set: var(--theme-bg-color);
    }
    html {
      background-color: var(--theme-bg-color, transparent);
      background: var(--background-set, none);
    }
    body {
      ${a&&!p?`background-color: ${l} !important;`:""}
      ${p&&e?"background-color: transparent !important;":""}
    }
    section, aside, blockquote, article, nav, header, footer, main, figure,
    div, p, font, h1, h2, h3, h4, h5, h6, li, span {
      ${e?`background-color: ${m} !important;`:""}
      ${e?`color: ${s} !important;`:""}
      ${e?`border-color: ${s} !important;`:""}
    }
    pre, span { /* inline code blocks */
      ${e?`background-color: ${m} !important;`:""}
    }
    a:any-link {
      ${e?`color: ${d} !important;`:c?"color: lightblue;":""}
    }
    /* left off hovered links, so a book's own a:hover style applies (#6859) */
    a:any-link:where(:not(:hover)) {
      text-decoration: ${a?"underline":"none"};
    }
    body.pbg {
      ${c&&!p?`background-color: ${l} !important;`:""}
    }
    /* When inverting in dark mode, invert(100%) must stay the effective filter
       (a later filter declaration would discard it), and multiply must not
       apply: multiply with a dark page background erases the image (#5250). */
    img {
      ${i?`filter: ${g}${c&&t?" invert(100%)":""};`:c&&t?"filter: invert(100%);":""}
      ${!i&&c&&!t&&e?"filter: grayscale(100%) contrast(1.2) brightness(1.2);":""}
      ${!i&&e&&!(c&&t)?"mix-blend-mode: multiply;":""}
    }
    ${i?`svg image { filter: ${g}${c&&t?" invert(100%)":""}; }
    img, svg image { mix-blend-mode: normal !important; background-color: transparent !important; }`:""}
    svg, img {
      ${e?"background-color: transparent !important;":""};
    }
    /* horizontal rule #1649 */
    *:has(> hr.background-img):not(body) {
      background-color: ${l};
    }
    hr.background-img {
      mix-blend-mode: multiply;
    }
    p[width][height] > img:only-child {
      mix-blend-mode: multiply;
    }
    /* inline images */
    *:has(> img.has-text-siblings):not(body) {
      ${e?`background-color: ${l};`:""}
    }
    p img.has-text-siblings, span img.has-text-siblings, sup img.has-text-siblings {
      mix-blend-mode: ${c?"screen":"multiply"};
    }
    table:has(> colgroup) {
      table-layout: fixed;
    }
    /* break-word, never anywhere: overflow-wrap:anywhere (and its legacy alias
       word-break:break-word) count mid-word break opportunities in min-content
       sizing, which drops every cell's minimum to a single character. Auto table
       layout then hands the whole width to the widest column and shreds a short
       label column into a stack of letters (#5681). break-word leaves intrinsic
       sizes alone and still breaks a long token that overflows its cell; a table
       too wide for its column scrolls in its wrapper instead (#4029, #4391). */
    td, th {
      overflow-wrap: break-word;
    }
    /* code */
    body.theme-dark code {
      ${c?`color: ${s}cc;`:""}
      ${c?`background: color-mix(in srgb, ${l} 90%, #000);`:""}
      ${c?`background-color: color-mix(in srgb, ${l} 90%, #000);`:""}
    }
    blockquote {
      ${c?`background: color-mix(in srgb, ${l} 80%, #000);`:""}
    }
    /* Only tint table descendants when the user has opted into color override.
       By default, leave them transparent so a plain table (and the invisible
       spacer cells some books use for vertical layout) keeps the page
       background instead of a different shade. Illegible light/zebra table
       backgrounds are handled separately by the dark-mode light-background
       rewriters (getDarkModeLightBackgroundOverrides / transformStylesheet).
       See #4419 (and #2377, which this gate originally fixed). */
    blockquote, table * {
      ${c&&e?`background: color-mix(in srgb, ${l} 80%, #000);`:""}
      ${c&&e?`background-color: color-mix(in srgb, ${l} 80%, #000);`:""}
    }
    /* override inline hardcoded text color */
    font[color="#000000"], font[color="#000"], font[color="black"],
    font[color="rgb(0,0,0)"], font[color="rgb(0, 0, 0)"],
    *[style*="color: rgb(0,0,0)"], *[style*="color: rgb(0, 0, 0)"],
    *[style*="color: #000"], *[style*="color: #000000"], *[style*="color: black"],
    *[style*="color:rgb(0,0,0)"], *[style*="color:rgb(0, 0, 0)"],
    *[style*="color:#000"], *[style*="color:#000000"], *[style*="color:black"] {
      color: ${s} !important;
    }
    ${c&&!e?`
    /* Callout boxes often use inline white/light backgrounds while html/body set dark fg. */
    *[style*="background-color: #fff"], *[style*="background-color:#fff"],
    *[style*="background-color: #ffffff"], *[style*="background-color:#ffffff"],
    *[style*="background-color: white"], *[style*="background-color:white"],
    *[style*="background: #fff"], *[style*="background:#fff"],
    *[style*="background: #ffffff"], *[style*="background:#ffffff"],
    *[style*="background: white"], *[style*="background:white"],
    *[style*="background-color: rgb(255"], *[style*="background-color:rgb(255"],
    *[style*="background: rgb(255"], *[style*="background:rgb(255"] {
      background-color: ${l} !important;
    }
    /* Force transparent, not the theme bg: the dark page fill already comes from
       the paginator container / reader grid cell, while an opaque body paints over
       the host background texture (#4446) — and foliate captures docBackground once
       per section load, so the body must stay transparent regardless of texture
       state. Book-forced light page backgrounds still get neutralized (#4392) since
       the theme-dark fill shows through. */
    body.theme-dark {
      background-color: transparent !important;
    }
`:""}
    /* for the Gutenberg eBooks */
    #pg-header * {
      color: inherit !important;
    }
    .x-ebookmaker, .x-ebookmaker-cover, .x-ebookmaker-coverpage {
      background-color: unset !important;
    }
    /* for the Feedbooks eBooks */
    .chapterHeader, .chapterHeader * {
      border-color: unset;
      background-color: ${l} !important;
    }
    .calibre {
      color: unset;
      background-color: unset;
    }
  `})(e.overrideColor,e.invertImgColorInDark,t,e.backgroundTextureId,e.isEink,Z,!!e.transparentImageBackground),ea=C(e),en=`
  /* Warichu (割注/夹注) — double-line inline annotation */
  .warichu-pending {
    display: inline;
    font-size: 0.5em;
    line-height: 1.1;
  }
  .warichu-chunk {
    display: inline-block;
    line-height: 1.1;
    font-size: 0.5em;
    text-indent: 0;
    vertical-align: middle !important;
    width: 1lh !important;
    text-align: center !important;
  }
  .warichu-chunk .warichu-line {
    display: inline;
  }
  .warichu-open,
  .warichu-close {
    display: inline;
    font-size: 0.5em;
    vertical-align: middle;
    line-height: 1.1;
  }
`,ei=(G=e.wordLensGlossFontSize||.5,X=e.wordLensGlossColor||"",`
  rt {
    user-select: none;
    -webkit-user-select: none;
  }
  rp {
    display: none !important;
  }
  ruby.wl-gloss {
    cursor: help;
  }
  ruby.wl-gloss > rt {
    font-size: ${G}em;
    line-height: 1.1;
    ${X?`color: ${X};
    opacity: 1;`:"opacity: 0.7;"}
    font-weight: normal;
    text-align: center;
  }
`),el=`
  :where(${$.map(e=>`html:lang(${e})`).join(", ")}) {
    widows: 1;
    orphans: 1;
  }
`,es=(0,l.Xy)(e)?(v=t,J=e.dialogueHighlight?e.dialogueHighlightCustomColor&&e.dialogueHighlightColor?e.dialogueHighlightColor:v.primary:null,Y=e=>J?`
    background-color: color-mix(in srgb, ${J} ${e}%, transparent) !important;`:"",K=e.dialogueHighlightCustomTextColor&&e.dialogueHighlightTextColor?`
    color: ${e.dialogueHighlightTextColor} !important;`:"",U="slightly-heavier"===e.dialogueHighlightWeight?"\n    -webkit-text-stroke: 0.2px currentColor !important;":"bold"===e.dialogueHighlightWeight?"\n    font-weight: bold !important;":"",`
  /* Dialogue lines tinted with the custom color or, by default, the theme's
     primary color. !important so the tint survives "Override Book Color",
     which repaints spans/paragraphs with the theme background at the same
     importance level but lower specificity. */
  .readest-dialogue {${Y(22)}${K}${U}
    border-radius: 0.2em;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .readest-dialogue-block {${Y(12)}${K}${U}
    border-radius: 0.3em;
  }${e.dialogueHighlightItalic?`
  /* Italic runs marked like quoted dialogue; nested marks drop their own
     tint so overlapping translucent backgrounds don't stack. */
  :is(i, em) {${Y(22)}${K}${U}
    border-radius: 0.2em;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  :is(i, em) :is(i, em, .readest-dialogue), .readest-dialogue :is(i, em) {
    background-color: transparent !important;
  }`:""}${"bold"===e.dialogueHighlightWeight?`
  .readest-dialogue-block *, .readest-dialogue *${e.dialogueHighlightItalic?", :is(i, em) *":""} {
    font-weight: bold !important;
  }`:""}
`):"",ed=e.userStylesheet;return`@namespace epub "http://www.idpf.org/2007/ops";
${er}
${Q}
${ee}
${el}
${et}
${eo}
${es}
${ea}
${en}
${ei}
${ed}`},L=e=>e.filter(e=>!!e.blobUrl).map(e=>{try{return(0,i.pD)(e)}catch{return""}}).join("\n"),N=e=>{let t="translation-style",r=document.getElementById(t);r&&r.remove();let o=document.createElement("style");o.id=t,o.textContent=C(e),document.head.appendChild(o)},I=function(e){let t=arguments.length>1&&void 0!==arguments[1]&&arguments[1],r=e.match(/\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\\(?:[0-9a-fA-F]{1,6}\s?|[^\n\r\f])|[\w-]+|\s+|[^\s]/g)??[],o=new Set,a=0,n=0,i=e=>{let a=[];for(let t=n;t<e;t++)/^\s+$|^\/\*/.test(r[t])||a.push(t);let i=a[0];if(1===a.length&&void 0!==i&&/^(serif|sans-serif|monospace)$/i.test(r[i])){let e=r[i].toLowerCase();o.add(e),t&&(r[i]=`var(--${e}, ${e})`)}};for(let e=0;e<r.length;e++)"("===r[e]?a++:")"===r[e]?a--:","===r[e]&&0===a&&(i(e),n=e+1);if(i(r.length),!o.size)return e;let l=r.join(""),s=l.trim(),d=l.slice(0,l.indexOf(s));return d+[...o].reduceRight((e,t)=>`var(--book-${t}, ${e})`,s)+l.slice(d.length+s.length)},F=/^(?:(?:\d+(?:\.\d+)?|\.\d+)(?:[a-z]+|%)|x*-?(?:small|large)|medium|smaller|larger)$/i,T=(e,t,r)=>{let[o="",...a]=r.split("!"),n=[...o.matchAll(/[^\s/]+|\//g)],i=n.findIndex(e=>F.test(e[0]));if(i<0)return e;let l=n[n[i+1]?.[0]==="/"?i+3:i+1]?.index;if(void 0===l)return e;let s=I(o.slice(l));return[t+o.slice(0,l)+s,...a].join("!")},H=/((?:^|[\s;{])font\s*:)([^;{}]*)/gi,j=(e,t,r)=>t+I(r),D=e=>e.replace(/(font-family\s*:)([^;{}!]*)/gi,j).replace(H,T),R=function(e,t,r,o){let a=arguments.length>4&&void 0!==arguments[4]&&arguments[4];if(a)return e;let n=["ios","android"].includes((0,c.Ox)())?1.25:1,i=!e.includes("{"),l=/([^{]+)({[^}]+})/g;e=e.replace(l,(e,t,r)=>{let o=/text-align\s*:\s*center\s*[;$]/.test(r),a=/text-indent\s*:\s*0(?:\.0+)?(?:px|em|rem|%)?\s*[;$]/.test(r);return o&&a?t+(r=r.replace(/(text-indent\s*:\s*0(?:\.0+)?(?:px|em|rem|%)?)(\s*;|\s*$)/g,"$1 !important$2")):e});let s=o?"overflow-y: clip !important;":"overflow-x: clip !important;";e=e.replace(l,(e,t,r)=>{if(/white-space\s*:\s*nowrap\s*[;$]/.test(r)){if(!/overflow\s*:/.test(r)){let e=/(?:^|[;{\s])(?:max-)?height\s*:|line-clamp\s*:/.test(r);r=r.replace(/}$/,` ${e?"overflow: clip !important;":s} }`)}return t+r}return e}),i?/page-break-after\s*:\s*always\s*[;]?/.test(e)&&!/margin-bottom\s*:/.test(e)&&(e=e.replace(/;?\s*$/,"")+"; margin-bottom: calc(var(--available-height) * 1px)"):e=e.replace(l,(e,t,r)=>/page-break-after\s*:\s*always\s*[;$]/.test(r)?(/margin-bottom\s*:/.test(r)||(r=r.replace(/}$/," margin-bottom: calc(var(--available-height) * 1px); }")),t+r):e);let d=[];e=(e=(e=(e=e.replace(l,(e,t,r)=>{if(o)return t+r;let a=[],n=!1;for(let e of["top","bottom","left","right"]){let t=RegExp(`duokan-bleed\\s*:\\s*[^;]*${e}[^;]*;`),o=RegExp(`margin-${e}\\s*:`);t.test(r)&&!o.test(r)&&(n=!0,a.push(e),r=r.replace(/}$/,` margin-${e}: calc(-1 * var(--page-margin-${e})) !important; }`))}return n&&(/position\s*:/.test(r)||(r=r.replace(/}$/," position: relative !important; }")),/overflow\s*:/.test(r)||(r=r.replace(/}$/," overflow: hidden !important; }")),/display\s*:/.test(r)||(r=r.replace(/}$/," display: flow-root !important; }")),a.includes("left")&&a.includes("right")&&(r=r.replace(/}$/," width: calc(var(--full-width) * 1px) !important; }").replace(/}$/," min-width: calc(var(--full-width) * 1px) !important; }").replace(/}$/," max-width: calc(var(--full-width) * 1px) !important; }")),a.includes("top")&&a.includes("bottom")&&(r=r.replace(/}$/," height: calc(var(--full-height) * 1px) !important; }").replace(/}$/," min-height: calc(var(--full-height) * 1px) !important; }").replace(/}$/," max-height: calc(var(--full-height) * 1px) !important; }"))),t+r})).replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi,e=>(d.push(e),`READEST_URL_${d.length-1}_PLACEHOLDER`))).replace(/((?:^|[{;\s])background(?:-attachment)?\s*:)([^;{}]*)/gi,(e,t,r)=>{if(!/\bfixed\b/i.test(r))return e;let o=[];return t+r.replace(/[\w-]*\([^)]*\)/g,e=>(o.push(e),`READEST_FN_${o.length-1}_PLACEHOLDER`)).replace(/\bfixed\b/gi,"scroll").replace(/READEST_FN_(\d+)_PLACEHOLDER/g,(e,t)=>o[+t])})).replace(/READEST_URL_(\d+)_PLACEHOLDER/g,(e,t)=>d[+t]),o||(e=e.replace(l,(e,t,r)=>{if(![...r.matchAll(/(?:^|[^-a-z])background(?:-color|-image)?\s*:\s*([^;!}]+)/gi)].map(e=>e[1].trim()).some(e=>!/^(?:none|transparent)$/i.test(e)&&!/^(?:rgba|hsla)\([^)]*[,\s]0(?:\.0+)?\s*\)$/i.test(e)))return e;let o="",a="";for(let e of r.matchAll(/(?:^|[^-a-z])margin(-left|-right)?\s*:\s*([^;!}]+)/gi)){let t=e[1],r=e[2].trim();if("-left"===t)o=r;else if("-right"===t)a=r;else{if(r.includes("("))continue;let e=r.split(/\s+/);if(e.length<1||e.length>4)continue;let[t,n=t,,i=n]=e;a=n,o=i}}let n=(o.startsWith("-")?" margin-left: 0 !important;":"")+(a.startsWith("-")?" margin-right: 0 !important;":"");return n?t+r.replace(/}$/,`${n} }`):e})),e=(e=e.replace(l,(e,t,r)=>{if(/\bbody\b/i.test(t)){let e=/font-family\s*:\s*serif\s*(?:;|\}|$)/.test(r),t=/font-family\s*:\s*sans-serif\s*(?:;|\}|$)/.test(r);e&&(r=r.replace(/font-family\s*:\s*serif\s*(;|\}|$)/gi,"font-family: unset$1")),t&&(r=r.replace(/font-family\s*:\s*sans-serif\s*(;|\}|$)/gi,"font-family: unset$1"))}return t+r})).replace(l,(e,r,o)=>{let a=/(?:^|[^a-z-])width\s*:\s*(\d+(?:\.\d+)?)px/.exec(o);return(a?parseFloat(a[1]??"0"):0)>t&&!/max-width\s*:/.test(o)?r+(o=o.replace(/}$/," width: 100%; max-width: calc(var(--available-width) * 1px); box-sizing: border-box; }")):e});let g=t>r,h="(min-width: 0px)",p="(min-width: 999999px)",m=[];e=(e=(e=(e=e.replace(/"[^"\n]*"|'[^'\n]*'/g,e=>(m.push(e),`READEST_STR_${m.length-1}_PLACEHOLDER`))).replace(/@media[^{]*/gi,e=>e.replace(/\(\s*orientation\s*:\s*(landscape|portrait)\s*\)/gi,(e,t)=>"landscape"===t.toLowerCase()===g?h:p).replace(/\(\s*(min|max)-(width|height)\s*:\s*([^)]+?)\s*\)/gi,(e,o,a,n)=>{let i=/^(\d*\.?\d+)(?:px)?$/.exec(n);if(!i)return e;let l="width"===a.toLowerCase()?t:r,s=parseFloat(i[1]);return("min"===o.toLowerCase()?l>=s:l<=s)?h:p}))).replace(/READEST_STR_(\d+)_PLACEHOLDER/g,(e,t)=>m[+t])).replace(/font-size\s*:\s*xx-small/gi,"font-size: 0.6rem").replace(/font-size\s*:\s*x-small/gi,"font-size: 0.75rem").replace(/font-size\s*:\s*small/gi,"font-size: 0.875rem").replace(/font-size\s*:\s*medium/gi,"font-size: 1rem").replace(/font-size\s*:\s*large/gi,"font-size: 1.2rem").replace(/font-size\s*:\s*x-large/gi,"font-size: 1.5rem").replace(/font-size\s*:\s*xx-large/gi,"font-size: 2rem").replace(/font-size\s*:\s*xxx-large/gi,"font-size: 3rem").replace(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi,(e,t)=>{let r=parseFloat(t)/n/16;return`font-size: ${r}rem`}).replace(/font-size\s*:\s*(\d+(?:\.\d+)?)pt/gi,(e,t)=>{let r=parseFloat(t)/n/12;return`font-size: ${r}rem`}).replace(/font-size\s*:\s*(\d*\.?\d+)(px|rem|em|%)?/gi,function(e,t){let r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:"px";return`font-size: max(${t}${r}, var(--min-font-size, 8px))`}).replace(/backdrop-filter\s*:\s*brightness\(100%\)\s*[;]?/gi,"").replace(/(\d*\.?\d+)vw/gi,(e,r)=>parseFloat(r)*t/100+"px").replace(/(\d*\.?\d+)vh/gi,(e,t)=>parseFloat(t)*r/100+"px").replace(/([\s;])-webkit-user-select\s*:\s*none/gi,"$1-webkit-user-select: unset").replace(/([\s;])-moz-user-select\s*:\s*none/gi,"$1-moz-user-select: unset").replace(/([\s;])-ms-user-select\s*:\s*none/gi,"$1-ms-user-select: unset").replace(/([\s;])-o-user-select\s*:\s*none/gi,"$1-o-user-select: unset").replace(/([\s;])user-select\s*:\s*none/gi,"$1user-select: unset").replace(/(font-family\s*:\s*)([^;{}]*)/gi,(e,t,r)=>{let o=/\s*!\s*important\s*$/i.exec(r);return t+I(o?r.slice(0,o.index):r,!0)+(o?o[0]:"")}).replace(/([\s;])font-weight\s*:\s*normal/gi,"$1font-weight: var(--font-weight)").replace(/([\s;])color\s*:\s*black/gi,"$1color: var(--theme-fg-color)").replace(/([\s;])color\s*:\s*#(?:000f?|000000(?:ff)?)(?![0-9a-f])/gi,"$1color: var(--theme-fg-color)").replace(/([\s;])color\s*:\s*rgb\(0,\s*0,\s*0\)/gi,"$1color: var(--theme-fg-color)");let{isDarkMode:u,bg:f}=E();return u&&(e=e.replace(l,(e,t,r)=>{let o=r.replace(/background(-color)?\s*:\s*([^;!}]+)(\s*!important)?(?=\s*[;!}])/gi,(e,t,r,o)=>(e=>{let t=e.trim().toLowerCase();if("white"===t)return!0;let r=t.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);if(r){let e=r[1],t=3===e.length?e.split("").map(e=>e+e).join(""):e;return(.299*parseInt(t.slice(0,2),16)+.587*parseInt(t.slice(2,4),16)+.114*parseInt(t.slice(4,6),16))/255>.85}let o=t.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);return o?.[1]!=null&&null!=o[2]&&null!=o[3]&&(.299*parseInt(o[1],10)+.587*parseInt(o[2],10)+.114*parseInt(o[3],10))/255>.85})(r.trim().split(/\s+/)[0]??"")?`background-color: ${f}${o??""}`:e);return o===r?e:t+o})),e.replace(H,T)},q=(e,t)=>{e.body.classList.remove("theme-light","theme-dark"),e.body.classList.add(t?"theme-dark":"theme-light")},_=(e,t)=>{e.body.classList.remove("scroll-mode","paginated-mode"),e.body.classList.add(t?"scroll-mode":"paginated-mode")},W=/^([A-Za-z_][\w.-]*):([A-Za-z_][\w.-]*)$/,B=e=>{let t=(e,t)=>{for(let r=e;r;r=r.parentElement){let e=r.getAttribute(`xmlns:${t}`);if(e)return e}return null};for(let r of e.querySelectorAll("*"))for(let{name:e,value:o}of Array.from(r.attributes)){let[,a,n]=W.exec(e)??[];if(!a)continue;let i="xml"===a?"http://www.w3.org/XML/1998/namespace":t(r,a)??("epub"===a?"http://www.idpf.org/2007/ops":null);i&&!r.hasAttributeNS(i,n)&&r.setAttributeNS(i,e,o)}},P=(e,t)=>{e.documentElement.setAttribute("data-eink",t?"true":"false")},O=(e,t)=>{let r="scrollbar-hide-style",o=e.getElementById(r);t?(o||((o=e.createElement("style")).id=r,e.head.appendChild(o)),o.textContent="foliate-view::part(container) { scrollbar-width: none; }"):o&&(o.textContent="foliate-view::part(container) { scrollbar-width: thin; }")},M=e=>{let t=e.defaultView??window,r=Array.from(e.querySelectorAll("img")).map(r=>{let o=r.getAttribute("width"),a=o&&(o.endsWith("%")||o.endsWith("vw"))?parseFloat(o):0/0,n=r.getAttribute("height"),i=n&&(n.endsWith("%")||n.endsWith("vh"))?parseFloat(n):0/0,l="none"===r.getAttribute("zy-enlarge-src"),s=r.closest("p"),d=null;if(s){let t=e.createRange();t.setStart(s,0),t.setEndBefore(r),t.toString().trim()||(d=s)}let c=!1,g=!1,h=r.parentNode;if(h&&h.nodeType===Node.ELEMENT_NODE){let e=Array.from(h.childNodes),o=e.some(e=>e.nodeType===Node.TEXT_NODE&&e.textContent?.trim()),a=e.every(e=>e.nodeType!==Node.ELEMENT_NODE||"BR"!==e.tagName),n=r.computedStyleMap?.().get("width"),i=!!n&&n.toString().includes("%");if(c=o&&a&&!i){let e=t.getComputedStyle(r).verticalAlign;g=""===e||"baseline"===e}}return{img:r,percentWidth:a,percentHeight:i,inlineWithText:c,keepBaseline:g,noEnlarge:l,leadingImageParagraph:d}}),o=e.documentElement?.style,a=o?parseFloat(o.getPropertyValue("--available-height")):0/0,n=!isNaN(a)&&a>0?a:t?.innerHeight??window.innerHeight,i=o?parseFloat(o.getPropertyValue("--available-width")):0/0,l=!isNaN(i)&&i>0?i:t?.innerWidth??window.innerWidth;for(let{img:e,percentWidth:t,percentHeight:o,inlineWithText:a,keepBaseline:i,noEnlarge:s,leadingImageParagraph:d}of r)d?.classList.add("leading-image"),isNaN(t)||(e.style.width=`${t/100*l}px`,e.removeAttribute("width")),isNaN(o)||(e.style.height=`${o/100*n}px`,e.removeAttribute("height")),isNaN(t)||isNaN(o)||(e.style.objectFit="contain"),a&&(e.classList.add("has-text-siblings"),i&&e.classList.add("has-text-siblings-baseline")),s&&e.style.setProperty("pointer-events","none");e.querySelectorAll("hr").forEach(e=>{let t=window.getComputedStyle(e);t.backgroundImage&&"none"!==t.backgroundImage&&e.classList.add("background-img")})},G=e=>{e.links.length<=1e3&&e.documentElement.classList.add(h.QG)},X=e=>{let t=e.defaultView??window,r=e.querySelectorAll(":is(div, p, blockquote, dd):not([data-foliate-chunk])"),o=Array(r.length);for(let e=0;e<r.length;e++){let a=t.getComputedStyle(r[e]).textAlign;"center"===a?o[e]="aligned-center":"left"===a?o[e]="aligned-left":"right"===a?o[e]="aligned-right":"justify"===a?o[e]="aligned-justify":o[e]=null}for(let e=0;e<r.length;e++){let t=o[e];t&&r[e].classList.add(t)}},J=e=>{let{isDarkMode:t,isBwEink:r,isFixedLayout:o=!1,invertImgColorInDark:a=!1,applyThemeToPDF:n=!1,format:i}=e;return r?"difference":t&&(!o||a||"PDF"===i&&n)?"screen":"multiply"},Y=(e,t)=>e.applyThemeToPDF?{background:t.bg,foreground:t.fg,keepImages:!(t.isDarkMode&&e.invertImgColorInDark)}:void 0,K=(e,t,r,o)=>{r||(r=E());let{bg:n,fg:i,primary:l,isDarkMode:s}=r,d=!o||a.hz.has(o),c=t.isEink,h=t.overrideColor,p=t.invertImgColorInDark,m=t.contrast??100,u=[],f="PDF"===o&&t.applyThemeToPDF,y=!!t.transparentImageBackground&&"PDF"!==o;y&&u.push(g),s&&p&&!f&&u.push("invert(100%) hue-rotate(180deg)"),100!==m&&u.push(`contrast(${m}%)`);let k=u.length?`filter: ${u.join(" ")};`:"",$="fixed-layout-styles",w=e.getElementById($);w&&w.remove(),(w=e.createElement("style")).id=$,w.textContent=`
    html {
      --theme-bg-color: ${n};
      --theme-fg-color: ${i};
      --theme-primary-color: ${l};
      color-scheme: ${d&&s?"dark":"light"};
      /* Chrome for Android's text autosizing rescales line metrics and shifts
         absolutely positioned per-letter text in fixed-layout books (#5641). */
      -webkit-text-size-adjust: none;
      text-size-adjust: none;
    }
    body {
      position: relative;
      ${d?"background-color: var(--theme-bg-color);":""}
    }
    ${c?b():""}
    #canvas {
      display: inline-block;
      width: fit-content;
      height: fit-content;
      background-color: var(--theme-bg-color);
    }
    img, canvas {
      ${k}
      ${!y&&h&&!f?`mix-blend-mode: ${s?"#000000"===n?"luminosity":"overlay":"multiply"};`:""}
    }
    ${y?`svg image { ${k} }
    img, svg image { mix-blend-mode: normal !important; background-color: transparent !important; }`:""}
    img.singlePage {
      position: relative;
    }
    /* An unsized <image> draws at its natural size, which is the page size,
       but a percentage-height svg in an auto-height block is only 150px tall
       and would clip it to a strip (#6530). */
    svg:not([viewBox]):has(> image:not([width])) {
      overflow: visible;
    }
  `,e.head.appendChild(w)}},61215:(e,t,r)=>{r.d(t,{PD:()=>i,Yu:()=>a});let o=["a","b","em","i","strong","u","span","font","sup","sub","small","mark"],a=o.join(", "),n=new Set(o),i=e=>n.has(e.toLowerCase())},80043:(e,t,r)=>{function o(e,t){return null===t?e<35:e<20||!(e>50)&&t}function a(e,t,r){return"dark"===e||"light"!==e&&("ambient"===e?r:t)}r.d(t,{XJ:()=>s,hi:()=>d,iz:()=>l,yf:()=>o,zm:()=>a});let n=["auto","light","dark"],i=["auto","light","dark","ambient"];function l(e,t){let r=t?i:n,o=r.indexOf("ambient"!==e||t?e:"auto"),a=o<0?0:(o+1)%r.length;return r[a]??"auto"}function s(e,t){return"true"===e||"false"!==e&&t}function d(e){return"auto"===e||"light"===e||"dark"===e||"ambient"===e}},95917:(e,t,r)=>{r.d(t,{$w:()=>n,F5:()=>s,G0:()=>l,II:()=>i,W4:()=>c,bw:()=>d});var o=r(35810);let a=e=>{let t=e.match(/^epubcfi\((.+)\)$/);return t?t[1]:e};function n(e,t){if(!e||!t)return!1;if(e===t||e&&a(e).startsWith(a(t)))return!0;let r=o.collapse(t),n=o.collapse(t,!0);try{return o.compare(e,r)>=0&&0>=o.compare(e,n)}catch(r){return console.warn("Failed to compare CFIs",{cfi:e,location:t,error:r}),!1}}function i(e){if(!e)return()=>!1;let t=a(e),r=null,n=null;try{r=o.collapse(e),n=o.collapse(e,!0)}catch(t){console.warn("Failed to collapse location for matcher",{location:e,error:t})}return i=>{if(!i)return!1;if(i===e||a(i).startsWith(t))return!0;if(null===r||null===n)return!1;try{return o.compare(i,r)>=0&&0>=o.compare(i,n)}catch(t){return console.warn("Failed to compare CFIs",{cfi:i,location:e,error:t}),!1}}}function l(e,t){if(!t)return null;let r=e.filter(e=>"string"==typeof e&&e.length>0);if(0===r.length)return null;let a=o.collapse(t),n=0,i=r.length;for(;n<i;){let e=n+i>>>1;0>=o.compare(r[e],a)?n=e+1:i=e}return 0===n?r[0]:n>=r.length?r[r.length-1]:r[n-1]}function s(e){try{let t=o.parse(e);if(!t.parent)return!1;let r=e=>Array.isArray(e)&&e.every(e=>Array.isArray(e)&&0===e.length);return r(t.start)||r(t.end)}catch{return!1}}function d(e){try{let t=o.parse(e);return o.fake.toIndex((t.parent??t).shift())}catch{return null}}function c(e){if(!e)return null;let t=e.match(/^epubcfi\((.+)\)$/);if(!t)return null;let r=t[1],o=r.indexOf("!");return -1===o?r:r.slice(0,o)}},97390:(e,t,r)=>{r.d(t,{PF:()=>n,PL:()=>d,Zj:()=>l,n1:()=>i});var o=r(72037);let a=e=>{let t=o.A.readability(e,"#000000")<o.A.readability(e,"#ffffff");return o.A.mix(e,t?"#ffffff":"#000000",80).toHexString()},n=e=>{let{bg:t,fg:r,primary:a}=e;return{"base-100":t,"base-200":(0,o.A)(t).darken(5).toHexString(),"base-300":(0,o.A)(t).darken(12).toHexString(),"base-content":r,neutral:(0,o.A)(t).darken(15).desaturate(20).toHexString(),"neutral-content":(0,o.A)(r).lighten(20).desaturate(20).toHexString(),primary:a,secondary:(0,o.A)(a).lighten(20).toHexString(),accent:(0,o.A)(a).analogous()[1].toHexString()}},i=e=>{let{bg:t,fg:r,primary:a}=e;return{"base-100":t,"base-200":(0,o.A)(t).lighten(5).toHexString(),"base-300":(0,o.A)(t).lighten(12).toHexString(),"base-content":r,neutral:(0,o.A)(t).lighten(15).desaturate(20).toHexString(),"neutral-content":(0,o.A)(r).darken(20).desaturate(20).toHexString(),primary:a,secondary:(0,o.A)(a).darken(20).toHexString(),accent:(0,o.A)(a).triad()[1].toHexString()}},l=[{name:"default",label:"Default",colors:{light:n({fg:"#392921",bg:"#f7efe3",primary:"#855340"}),dark:i({fg:"#eadfc9",bg:"#100d0c",primary:"#cbaa72"})}},{name:"gray",label:"Gray",colors:{light:n({fg:"#222222",bg:"#e0e0e0",primary:"#4488cc"}),dark:i({fg:"#c6c6c6",bg:"#444444",primary:"#88ccee"})}},{name:"sepia",label:"Sepia",colors:{light:n({fg:"#5b4636",bg:"#f1e8d0",primary:"#008b8b"}),dark:i({fg:"#ffd595",bg:"#342e25",primary:"#48d1cc"})}},{name:"grass",label:"Grass",colors:{light:n({fg:"#232c16",bg:"#d7dbbd",primary:"#177b4d"}),dark:i({fg:"#d8deba",bg:"#333627",primary:"#a6d608"})}},{name:"cherry",label:"Cherry",colors:{light:n({fg:"#4e1609",bg:"#f0d1d5",primary:"#de3838"}),dark:i({fg:"#e5c4c8",bg:"#462f32",primary:"#ff646e"})}},{name:"sky",label:"Sky",colors:{light:n({fg:"#262d48",bg:"#cedef5",primary:"#2d53e5"}),dark:i({fg:"#babee1",bg:"#282e47",primary:"#ff646e"})}},{name:"solarized",label:"Solarized",colors:{light:n({fg:"#586e75",bg:"#fdf6e3",primary:"#268bd2"}),dark:i({fg:"#93a1a1",bg:"#002b36",primary:"#268bd2"})}},{name:"gruvbox",label:"Gruvbox",colors:{light:n({fg:"#3c3836",bg:"#fbf1c7",primary:"#076678"}),dark:i({fg:"#ebdbb2",bg:"#282828",primary:"#83a598"})}},{name:"nord",label:"Nord",colors:{light:n({fg:"#2e3440",bg:"#eceff4",primary:"#5e81ac"}),dark:i({fg:"#d8dee9",bg:"#2e3440",primary:"#88c0d0"})}},{name:"contrast",label:"Contrast",colors:{light:n({fg:"#000000",bg:"#ffffff",primary:"#4488cc"}),dark:i({fg:"#ffffff",bg:"#000000",primary:"#88ccee"})}},{name:"sunset",label:"Sunset",colors:{light:n({fg:"#423126",bg:"#fff7f0",primary:"#fe6b64"}),dark:i({fg:"#f6e1d7",bg:"#3c2b25",primary:"#ff9c94"})}}],s=(e,t,r)=>{let o=Object.entries({"color-scheme":r,"--color-base-100":t["base-100"],"--color-base-200":t["base-200"],"--color-base-300":t["base-300"],"--color-base-content":t["base-content"],"--color-primary":t.primary,"--color-primary-content":a(t.primary),"--color-secondary":t.secondary,"--color-secondary-content":a(t.secondary),"--color-accent":t.accent,"--color-accent-content":a(t.accent),"--color-neutral":t.neutral,"--color-neutral-content":t["neutral-content"],"--color-info":"oklch(72.06% 0.191 231.6)","--color-info-content":"oklch(14.412% 0.0382 231.6)","--color-success":"oklch(64.8% 0.15 160)","--color-success-content":"oklch(12.96% 0.03 160)","--color-warning":"oklch(84.71% 0.199 83.87)","--color-warning-content":"oklch(16.942% 0.0398 83.87)","--color-error":"oklch(71.76% 0.221 22.18)","--color-error-content":"oklch(14.352% 0.0442 22.18)","--radius-selector":"1.9rem","--radius-field":"0.5rem","--radius-box":"1rem","--size-selector":"0.25rem","--size-field":"0.25rem","--border":"1px","--depth":"0","--noise":"0"}).map(e=>{let[t,r]=e;return`  ${t}: ${r};`}).join("\n");return`[data-theme="${e}"] {
${o}
}`},d=e=>{let t=`${e.name}-light`,r=`${e.name}-dark`,o=[s(t,n(e.colors.light),"light"),s(r,i(e.colors.dark),"dark")].join("\n"),a=`theme-${e.name}-styles`;document.getElementById(a)?.remove();let l=document.createElement("style");return l.id=a,l.textContent=o,document.head.appendChild(l),{light:t,dark:r}}}}]);
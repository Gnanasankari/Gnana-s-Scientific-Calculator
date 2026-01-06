const exprLine = document.getElementById("exprLine");
const resultLine = document.getElementById("resultLine");
const keys = document.getElementById("keys");
const histList = document.getElementById("histList");

const angleBtn = document.getElementById("angleBtn");
const shiftBtn = document.getElementById("shiftBtn");
const themeBtn = document.getElementById("themeBtn");

const copyBtn = document.getElementById("copyBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const modePill = document.getElementById("modePill");
const memPill = document.getElementById("memPill");

let expr = "";
let ans = 0;
let memory = 0;
let degMode = true;   // DEG by default
let shift = false;

const HISTORY_LIMIT = 18;

function setPills(msg="Ready"){
  modePill.textContent = msg;
  memPill.textContent = `M: ${formatNumber(memory)}`;
}
setPills();

function formatNumber(n){
  if (!Number.isFinite(n)) return String(n);
  // avoid huge long decimals
  const s = n.toString();
  if (Math.abs(n) >= 1e12 || (Math.abs(n) > 0 && Math.abs(n) < 1e-9)) return n.toExponential(8);
  // trim to 12-ish significant digits without forcing trailing zeros
  return Number(n.toPrecision(12)).toString();
}

function render(){
  exprLine.textContent = expr || "";
  resultLine.textContent = expr ? previewEval(expr) : "0";
}

function previewEval(input){
  try{
    const val = evaluate(input);
    if (val === null) return "…";
    return formatNumber(val);
  }catch{
    return "…";
  }
}

function pushHistory(e, r){
  const div = document.createElement("div");
  div.className = "item";
  div.innerHTML = `<div class="e">${escapeHtml(e)}</div><div class="r">${escapeHtml(r)}</div>`;
  div.addEventListener("click", () => {
    expr = e;
    render();
    pulse("Loaded from history");
  });
  histList.prepend(div);

  while(histList.children.length > HISTORY_LIMIT){
    histList.removeChild(histList.lastChild);
  }
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function pulse(text){
  setPills(text);
  modePill.animate(
    [{ transform:"scale(1)" }, { transform:"scale(1.05)" }, { transform:"scale(1)" }],
    { duration: 220 }
  );
}

function insertText(t){
  // basic safety: prevent double operators except minus for negative
  const last = expr.slice(-1);
  const ops = "+-×÷^";
  if (ops.includes(last) && ops.includes(t) && !(t === "-" && last !== "-")){
    expr = expr.slice(0,-1) + t;
  }else{
    expr += t;
  }
  render();
}

function del(){
  expr = expr.slice(0,-1);
  render();
}

function ac(){
  expr = "";
  render();
  pulse("Cleared");
}

function enter(){
  if(!expr.trim()) return;
  try{
    const v = evaluate(expr);
    if(v === null) return;
    const out = formatNumber(v);
    pushHistory(expr, out);
    ans = v;
    expr = out; // continue calculation from result
    resultLine.textContent = out;
    pulse("Done");
  }catch(e){
    pulse("Error");
    resultLine.textContent = "Error";
  }
}

function toRad(x){ return degMode ? (x * Math.PI / 180) : x; }
function fromRad(x){ return degMode ? (x * 180 / Math.PI) : x; }

// Factorial for integers (0..170 safe-ish for JS double)
function factorial(n){
  if(!Number.isFinite(n)) throw new Error("bad");
  if(n < 0) throw new Error("neg");
  if(Math.floor(n) !== n) throw new Error("non-int");
  if(n > 170) return Infinity;
  let r = 1;
  for(let i=2;i<=n;i++) r *= i;
  return r;
}

// -------- Expression evaluation --------
// We convert our UI tokens to a safe JS expression and evaluate with Function.
// (Still not for untrusted input; but it's fine for a local calculator UI.)
function evaluate(input){
  let s = input;

  // Replace UI operators
  s = s.replaceAll("×","*").replaceAll("÷","/");

  // Handle constants and ANS
  s = s.replaceAll("π","Math.PI");
  s = s.replaceAll("e","Math.E");
  s = s.replaceAll("ANS", `(${ans})`);

  // Factorial: replace occurrences of "number!" or ")!"
  // We'll convert "X!" => fact(X)
  s = s.replace(/(\d+(\.\d+)?|\))!/g, (m) => {
    const base = m.slice(0,-1);
    return `fact(${base})`;
  });

  // Power caret: a^b => (a**b)
  s = s.replaceAll("^","**");

  // Functions: sin(, cos(, tan( etc.)
  // We store them as tokens like "sin(" inserted by actions
  s = s
    .replaceAll("sin(", "SIN(")
    .replaceAll("cos(", "COS(")
    .replaceAll("tan(", "TAN(")
    .replaceAll("asin(", "ASIN(")
    .replaceAll("acos(", "ACOS(")
    .replaceAll("atan(", "ATAN(")
    .replaceAll("ln(", "LN(")
    .replaceAll("log(", "LOG(")
    .replaceAll("abs(", "ABS(")
    .replaceAll("sqrt(", "SQRT(")
    .replaceAll("cbrt(", "CBRT(");

  // Map tokens to JS
  // DEG/RAD aware trig via wrappers
  const ctx = {
    fact: factorial,
    SIN: (x)=> Math.sin(toRad(x)),
    COS: (x)=> Math.cos(toRad(x)),
    TAN: (x)=> Math.tan(toRad(x)),
    ASIN: (x)=> fromRad(Math.asin(x)),
    ACOS: (x)=> fromRad(Math.acos(x)),
    ATAN: (x)=> fromRad(Math.atan(x)),
    LN: (x)=> Math.log(x),
    LOG: (x)=> Math.log10(x),
    ABS: (x)=> Math.abs(x),
    SQRT: (x)=> Math.sqrt(x),
    CBRT: (x)=> Math.cbrt(x),
    // Allow Math.* in expression
    Math
  };

  // Quick validation: only allow common characters after conversion
  // (numbers, operators, parentheses, dot, comma, letters, underscores)
  if(!/^[0-9+\-*/().,\sA-Za-z_*]*$/.test(s)) throw new Error("Invalid");

  // Evaluate
  const fn = new Function(...Object.keys(ctx), `"use strict"; return (${s});`);
  const v = fn(...Object.values(ctx));

  if (v === undefined || v === null) return null;
  if (typeof v !== "number") return Number(v);
  return v;
}

// -------- Actions (buttons) --------
function action(name){
  switch(name){
    case "ac": return ac();
    case "del": return del();
    case "enter": return enter();

    case "parenL": return insertText("(");
    case "parenR": return insertText(")");

    case "pi": return insertText("π");
    case "e": return insertText("e");
    case "ans": return insertText("ANS");

    case "pct": return insertText("/100");
    case "sign":
      // toggle sign for last number chunk
      expr = toggleLastNumberSign(expr);
      return render();

    case "inv":
      expr = `1/(${expr || "0"})`;
      return render();

    case "abs":
      return insertText("abs(");

    case "exp":
      // scientific notation helper: a EXP b => a*10^b
      // we'll insert "*10^"
      if(!expr) insertText("1");
      return insertText("*10^");

    case "sqrt": return insertText("sqrt(");
    case "cbrt": return insertText("cbrt(");

    case "ln": return insertText("ln(");
    case "log10": return insertText("log(");

    case "sin": return insertText("sin(");
    case "cos": return insertText("cos(");
    case "tan": return insertText("tan(");

    case "asin": return insertText("asin(");
    case "acos": return insertText("acos(");
    case "atan": return insertText("atan(");

    case "pow2":
      if(!expr) return;
      expr = `(${expr})^2`;
      return render();

    case "pow3":
      if(!expr) return;
      expr = `(${expr})^3`;
      return render();

    case "pow": return insertText("^"); // user inserts caret between
    case "root":
      // a root b => a^(1/b) ; we insert "^(1/"
      return insertText("^(1/");

    case "tenpow":
      // 10^x
      return insertText("10^");

    case "fact":
      if(!expr) return;
      // append factorial for last term; simplest: "!"
      return insertText("!");

    case "rand":
      ans = Math.random();
      resultLine.textContent = formatNumber(ans);
      pulse("rand → ANS");
      return;

    // Memory
    case "mc": memory = 0; return setPills("MC");
    case "mr": insertText(formatNumber(memory)); return setPills("MR");
    case "mplus":
      memory += (expr ? (evaluate(expr) ?? 0) : 0);
      return setPills("M+");
    case "mminus":
      memory -= (expr ? (evaluate(expr) ?? 0) : 0);
      return setPills("M-");
  }
}

function toggleLastNumberSign(s){
  // Find last number segment and toggle prefix '-'
  // Example: "12+34" -> "12+-34"
  // Example: "12+(-34)" stays manageable
  if(!s) return s;
  const m = s.match(/(.*?)(\d+(\.\d+)?)(?!.*\d)/);
  if(!m) return s.startsWith("-") ? s.slice(1) : "-" + s;
  const prefix = m[1];
  const num = m[2];
  const before = s.slice(0, prefix.length);
  const after = s.slice(prefix.length + num.length);
  // If already has "+-" or "-"+num pattern at boundary, toggle
  if(before.endsWith("+-")){
    return before.slice(0,-2) + "+" + num + after;
  }
  if(before.endsWith("-") && (before.length===1 || "+×÷^(".includes(before.slice(-2,-1)))){
    return before.slice(0,-1) + num + after;
  }
  // Otherwise insert unary minus
  return before + "-" + num + after;
}

// -------- Events --------
keys.addEventListener("click", (e)=>{
  const btn = e.target.closest("button");
  if(!btn) return;

  // Shift: swap action if present
  const ins = btn.dataset.insert;
  const act = btn.dataset.action;

  if(ins){
    insertText(ins);
    pulse("Typing");
    return;
  }

  if(act){
    const use = shift && btn.dataset.shift ? btn.dataset.shift : act;
    action(use);
    pulse(shift ? "SHIFT" : "Action");
    return;
  }
});

angleBtn.addEventListener("click", ()=>{
  degMode = !degMode;
  angleBtn.textContent = degMode ? "DEG" : "RAD";
  angleBtn.classList.toggle("on", !degMode);
  pulse(degMode ? "Degree mode" : "Radian mode");
  render();
});

shiftBtn.addEventListener("click", ()=>{
  shift = !shift;
  shiftBtn.classList.toggle("on", shift);
  pulse(shift ? "SHIFT on" : "SHIFT off");
});

themeBtn.addEventListener("click", ()=>{
  document.body.classList.toggle("light");
  pulse(document.body.classList.contains("light") ? "Light theme" : "Dark theme");
});

copyBtn.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(resultLine.textContent.trim());
    pulse("Copied!");
  }catch{
    pulse("Copy blocked");
  }
});

clearHistoryBtn.addEventListener("click", ()=>{
  histList.innerHTML = "";
  pulse("History cleared");
});

// Keyboard support
document.addEventListener("keydown", (e)=>{
  const k = e.key;

  if(k === "Enter"){ e.preventDefault(); return enter(); }
  if(k === "Backspace"){ e.preventDefault(); return del(); }
  if(k === "Escape"){ e.preventDefault(); return ac(); }

  // Map operators
  if(k === "*") return insertText("×");
  if(k === "/") return insertText("÷");
  if(k === "-") return insertText("-");
  if(k === "+") return insertText("+");
  if(k === "^") return insertText("^");
  if(k === "(" || k === ")") return insertText(k);
  if(k === ".") return insertText(".");
  if(/[0-9]/.test(k)) return insertText(k);

  // Quick functions
  if(k.toLowerCase() === "s") return insertText("sin(");
  if(k.toLowerCase() === "c") return insertText("cos(");
  if(k.toLowerCase() === "t") return insertText("tan(");
  if(k.toLowerCase() === "l") return insertText("ln(");
});

render();

(function () {
  "use strict";

  const KEY = "fluent60:v1";
  const LEVEL1_END = 60;
  const SESSION_SECONDS = 30 * 60;
  const STEPS1 = [
    { id: "review", icon: "🔁", name: "Warm-up review", min: 3 },
    { id: "words", icon: "📚", name: "New vocabulary", min: 7 },
    { id: "grammar", icon: "🧩", name: "Sentence & grammar", min: 8 },
    { id: "speak", icon: "🎤", name: "Phrases & speaking", min: 8 },
    { id: "quiz", icon: "✅", name: "Quick quiz", min: 4 }
  ];
  const STEPS2 = [
    { id: "review", icon: "🔁", name: "Warm-up review", min: 3 },
    { id: "words", icon: "📚", name: "New vocabulary", min: 6 },
    { id: "grammar", icon: "🧩", name: "Grammar & quiz", min: 6 },
    { id: "listen", icon: "🎧", name: "Listening", min: 6 },
    { id: "speak", icon: "🎤", name: "Phrases & speaking", min: 9 }
  ];
  const stepsFor = (l) => (l.listen ? STEPS2 : STEPS1);
  const PHASES = {
    1: { name: "Phase 1 · Foundation", range: "Days 1–15", color: "var(--p1)", desc: "Survival English and simple tenses" },
    2: { name: "Phase 2 · Building", range: "Days 16–30", color: "var(--p2)", desc: "Future, comparisons, perfect tenses, linking ideas" },
    3: { name: "Phase 3 · Fluency", range: "Days 31–45", color: "var(--p3)", desc: "Conditionals, passive, reported speech, idioms, work English" },
    4: { name: "Phase 4 · Confidence", range: "Days 46–60", color: "var(--p4)", desc: "Advanced grammar, interviews, presentations, debate" },
    5: { name: "Level 2 · Phase 5 · Expanding", range: "Days 61–75", color: "var(--p1)", desc: "Richer tenses, storytelling, everyday topics, first listening practice" },
    6: { name: "Level 2 · Phase 6 · Natural Conversation", range: "Days 76–90", color: "var(--p2)", desc: "Phrasal verbs, idioms, hedging, fast speech and accents" },
    7: { name: "Level 2 · Phase 7 · Advanced Grammar", range: "Days 91–105", color: "var(--p3)", desc: "Mixed conditionals, passive, perfect modals, emphasis" },
    8: { name: "Level 2 · Phase 8 · Real-world Fluency", range: "Days 106–120", color: "var(--p4)", desc: "Interviews, meetings, debate, IELTS-style speaking, graduation" }
  };

  const lessons = (window.LESSONS || []).slice().sort((a, b) => a.day - b.day);
  const byDay = {};
  lessons.forEach((l) => (byDay[l.day] = l));
  const TOTAL = lessons.length;

  // ---------- storage ----------
  function dateStr(d) {
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  const todayStr = () => dateStr(new Date());

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === "object" && s.days) return s;
    } catch (e) { /* ignore */ }
    return { start: todayStr(), days: {} };
  }
  let state = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
  }
  function rec(n) {
    if (!state.days[n]) state.days[n] = { steps: [false, false, false, false, false], done: false, quiz: [], lq: [], seconds: 0 };
    const d = state.days[n];
    if (!d.quiz) d.quiz = [];
    if (!d.lq) d.lq = [];
    return d;
  }
  const isDone = (n) => !!(state.days[n] && state.days[n].done);

  // ---------- helpers ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function speak(text, rate) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate || 0.9;
    window.speechSynthesis.speak(u);
  }
  function completedCount() { return Object.keys(state.days).filter((n) => state.days[n].done).length; }
  function nextDay() {
    for (let i = 1; i <= TOTAL; i++) if (!isDone(i)) return i;
    return null;
  }
  function expectedDay() {
    const start = new Date(state.start + "T00:00:00");
    const diff = Math.floor((new Date(todayStr() + "T00:00:00") - start) / 86400000);
    return Math.max(1, Math.min(TOTAL, diff + 1));
  }
  function streak() {
    const dates = new Set();
    Object.values(state.days).forEach((d) => { if (d.done && d.doneOn) dates.add(d.doneOn); });
    const cur = new Date();
    if (!dates.has(dateStr(cur))) cur.setDate(cur.getDate() - 1);
    let n = 0;
    while (dates.has(dateStr(cur))) { n++; cur.setDate(cur.getDate() - 1); }
    return n;
  }
  function totalMinutes() {
    return Math.round(Object.values(state.days).reduce((s, d) => s + (d.seconds || 0), 0) / 60);
  }
  // kind "quiz" = grammar/vocab quiz, "lq" = listening questions
  function questionsOf(l, kind) { return kind === "lq" ? (l.listen ? l.listen.questions : []) : l.quiz; }
  function quizScore(n, kind) {
    kind = kind || "quiz";
    const l = byDay[n], r = state.days[n];
    if (!l || !r || !r[kind]) return null;
    const qs = questionsOf(l, kind);
    let right = 0, answered = 0;
    qs.forEach((q, i) => {
      if (r[kind][i] !== undefined && r[kind][i] !== null) { answered++; if (r[kind][i] === q[2]) right++; }
    });
    return { right, answered, total: qs.length };
  }
  function avgQuiz() {
    let right = 0, total = 0;
    Object.keys(state.days).forEach((n) => {
      ["quiz", "lq"].forEach((k) => {
        const s = quizScore(+n, k);
        if (s) { right += s.right; total += s.answered; }
      });
    });
    return total ? Math.round((right / total) * 100) : null;
  }

  let timerHandle = null;
  function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

  // ---------- dashboard ----------
  function renderDashboard() {
    const done = completedCount();
    const pct = Math.round((done / TOTAL) * 100);
    const nd = nextDay();
    const exp = expectedDay();
    const behind = Math.max(0, exp - 1 - done);
    const avg = avgQuiz();

    let heroHtml;
    if (nd === null) {
      heroHtml = `<div class="card hero"><h1>🎉 You finished all ${TOTAL} days!</h1><p class="muted">Amazing work. Keep speaking, listening and reading English every day. You can replay any lesson from the roadmap below.</p></div>`;
    } else {
      const l = byDay[nd];
      heroHtml = `<div class="card hero row">
        <div class="grow"><div class="muted">${isDone(nd - 1) || nd === 1 ? "Up next" : "Continue"} · Day ${nd} of ${TOTAL}</div>
        <h1>${esc(l.title)}</h1><p class="muted" style="margin:0">${esc(l.goal)} · 30 minutes</p></div>
        <a class="btn primary" href="#/day/${nd}">${state.days[nd] && (state.days[nd].steps || []).some(Boolean) ? "Resume lesson →" : "Start lesson →"}</a></div>`;
    }

    let notice = "";
    if (done < TOTAL) {
      if (behind > 0) notice = `<div class="banner warn">You are <b>${behind} day${behind > 1 ? "s" : ""}</b> behind your schedule (today should be Day ${exp}). Do one extra lesson a day or a 10-minute catch-up to get back on track.</div>`;
      else if (done >= exp) notice = `<div class="banner">You're on track or ahead of schedule. Keep going!</div>`;
    }

    const phasesHtml = [1, 2, 3, 4, 5, 6, 7, 8].map((p) => {
      const cells = lessons.filter((l) => l.phase === p).map((l) => {
        const r = state.days[l.day];
        const cls = ["cell"];
        if (isDone(l.day)) cls.push("done");
        else if (r && r.steps.some(Boolean)) cls.push("partial");
        if (l.day === nd) cls.push("today");
        return `<a class="${cls.join(" ")}" href="#/day/${l.day}" title="${esc(l.title)}">${l.day}<small>${esc(l.title.split(" ")[0])}</small></a>`;
      }).join("");
      const ph = PHASES[p];
      return `<div class="phase"><h3><span class="dot" style="background:${ph.color}"></span>${ph.name} <span class="muted" style="font-weight:400">· ${ph.range}</span></h3>
        <div class="muted" style="font-size:14px;margin-bottom:8px">${ph.desc}</div><div class="grid">${cells}</div></div>`;
    }).join("");

    $("#app").innerHTML = `
      ${heroHtml}${notice}
      <div class="stats">
        <div class="stat"><span class="muted">Days completed</span><b>${done}/${TOTAL}</b><div class="bar"><i style="width:${pct}%"></i></div></div>
        <div class="stat"><span class="muted">Current streak</span><b>${streak()} 🔥</b></div>
        <div class="stat"><span class="muted">Minutes studied</span><b>${totalMinutes()}</b></div>
        <div class="stat"><span class="muted">Quiz accuracy</span><b>${avg === null ? "–" : avg + "%"}</b></div>
      </div>
      <div class="card"><h2>Your ${TOTAL}-day roadmap</h2>${phasesHtml}
        <div class="muted" style="font-size:13px">Green = completed · Dashed = started · Blue outline = next lesson</div></div>
      <div class="card"><h2>Settings & backup</h2>
        <div class="row">
          <label>Course start date <input type="date" id="startDate" value="${esc(state.start)}"></label>
          <button class="btn" id="exportBtn">⬇ Export backup</button>
          <label class="btn" style="margin:0">⬆ Import backup<input type="file" id="importFile" accept="application/json" hidden></label>
          <button class="btn danger" id="resetBtn">Reset progress</button>
        </div>
        <p class="muted" style="font-size:13px;margin:10px 0 0">Progress lives in your browser's localStorage. Clearing browser data erases it — export a backup now and then.</p>
      </div>`;

    $("#startDate").addEventListener("change", (e) => {
      if (e.target.value) { state.start = e.target.value; save(); renderDashboard(); }
    });
    $("#exportBtn").addEventListener("click", exportBackup);
    $("#importFile").addEventListener("change", importBackup);
    $("#resetBtn").addEventListener("click", () => {
      if (confirm("Delete ALL progress and start over? This cannot be undone.")) {
        state = { start: todayStr(), days: {} };
        save();
        renderDashboard();
      }
    });
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fluent60-backup-" + todayStr() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importBackup(e) {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s || typeof s !== "object" || !s.days || typeof s.start !== "string") throw new Error("bad file");
        state = s;
        save();
        renderDashboard();
      } catch (err) {
        alert("That file is not a valid backup.");
      }
    };
    reader.readAsText(f);
  }

  // ---------- day view ----------
  function reviewWords(n) {
    const picks = [[n - 1, 3], [n - 3, 2], [n - 7, 2]];
    const out = [];
    picks.forEach(([d, count]) => {
      if (byDay[d]) byDay[d].vocab.slice(0, count).forEach((v) => out.push({ day: d, v }));
    });
    return out;
  }

  function stepBody(l, i) {
    const id = stepsFor(l)[i].id;
    if (id === "review") {
      const rw = reviewWords(l.day);
      if (!rw.length) return `<p>This is your first lesson, so there is nothing to review yet. Instead: say "Hello, my name is ..." out loud 5 times to warm up your mouth and voice.</p>`;
      return `<p class="muted">Try to remember the meaning first, then click the card to check. Say each word aloud.</p>` +
        rw.map((r) => `<div class="review-card"><b>${esc(r.v[0])}</b> <span class="muted">(Day ${r.day})</span>
          <button class="speak" data-say="${esc(r.v[0])}" title="Listen">🔊</button>
          <div class="ans">${esc(r.v[1])} — <i>${esc(r.v[2])}</i></div></div>`).join("");
    }
    if (id === "words") {
      return `<div class="words">` + l.vocab.map((v) => `<div class="word"><b>${esc(v[0])}</b>
        <button class="speak" data-say="${esc(v[0])}" title="Listen">🔊</button>
        <div>${esc(v[1])}</div>
        <div class="ex">“${esc(v[2])}” <button class="speak" data-say="${esc(v[2])}" title="Listen">🔊</button></div></div>`).join("") + `</div>
        <p class="muted" style="font-size:14px">Tip: say each word and its example sentence out loud 3 times. Then make ONE new sentence of your own.</p>`;
    }
    if (id === "grammar") {
      const g = l.grammar;
      return `<h3>${esc(g.topic)}</h3><div class="rule">${esc(g.rule)}</div>
        <b>Examples</b><ul class="ex-list">${g.examples.map((e) => `<li>${esc(e)} <button class="speak" data-say="${esc(e)}" title="Listen">🔊</button></li>`).join("")}</ul>` +
        (l.listen ? `<h3 style="margin-top:16px">Quick quiz</h3><div id="quiz"></div>` : "");
    }
    if (id === "listen") {
      const t = l.listen;
      return `<h3>${esc(t.title)}</h3>
        <p class="muted">1) Press Play and listen WITHOUT reading. 2) Answer the questions. 3) Open the transcript, then listen again and read along.</p>
        <div class="row" style="margin-bottom:10px">
          <button class="btn primary speak" data-say="${esc(t.text)}" data-rate="0.9">▶ Play audio</button>
          <button class="btn speak" data-say="${esc(t.text)}" data-rate="0.7">🐢 Play slowly</button>
          <button class="btn" id="stopAudio">⏹ Stop</button>
          <button class="btn" id="toggleTranscript">📄 Show transcript</button>
        </div>
        <div class="rule" id="transcript" hidden>${esc(t.text)}</div>
        <div id="lquiz"></div>`;
    }
    if (id === "speak") {
      return `<b>Useful phrases</b><ul class="ex-list">${l.phrases.map((p) => `<li><b>${esc(p[0])}</b> <button class="speak" data-say="${esc(p[0])}" title="Listen">🔊</button> <span class="muted">— ${esc(p[1])}</span></li>`).join("")}</ul>
        <div class="task"><b>🎤 Speaking task</b><br>${esc(l.speak)}</div>
        <p class="muted" style="font-size:14px">Speak out loud, not in your head. Recording yourself on your phone is the fastest way to improve.</p>`;
    }
    // level 1 quiz step
    return `<div id="quiz"></div>`;
  }

  function renderQuiz(l, kind) {
    kind = kind || "quiz";
    const box = $(kind === "lq" ? "#lquiz" : "#quiz");
    if (!box) return;
    const r = rec(l.day);
    const qs = questionsOf(l, kind);
    box.innerHTML = qs.map((q, qi) => {
      const ans = r[kind][qi];
      const answered = ans !== undefined && ans !== null;
      return `<div class="q"><b>${qi + 1}. ${esc(q[0])}</b>` + q[1].map((o, oi) => {
        let cls = "opt";
        if (answered && oi === q[2]) cls += " right";
        else if (answered && oi === ans) cls += " wrong";
        return `<button class="${cls}" data-k="${kind}" data-q="${qi}" data-o="${oi}" ${answered ? "disabled" : ""}>${esc(o)}</button>`;
      }).join("") + `</div>`;
    }).join("");
    const s = quizScore(l.day, kind);
    if (s && s.answered === s.total) box.insertAdjacentHTML("beforeend", `<p><b>Score: ${s.right}/${s.total}</b> ${s.right === s.total ? "🎉 Perfect!" : kind === "lq" ? "— read the transcript and listen again." : "— review the grammar box once more."}</p>`);
  }

  function renderDay(n) {
    const l = byDay[n];
    if (!l) { location.hash = "#/"; return; }
    const r = rec(n);
    const exp = expectedDay();

    let banner = "";
    if (r.done) banner = `<div class="banner">✅ Day ${n} completed on ${esc(r.doneOn || "")}. You can revise any time.</div>`;
    else if (n > (nextDay() || TOTAL)) banner = `<div class="banner warn">You skipped ahead. Lessons build on each other — consider finishing Day ${nextDay()} first.</div>`;
    else if (n < exp && !r.done) banner = `<div class="banner warn">This lesson is overdue (schedule says today is Day ${exp}). Finish it now to catch up.</div>`;

    const ph = PHASES[l.phase];
    $("#app").innerHTML = `
      <div class="row" style="margin-bottom:8px"><a href="#/" class="btn small">← Dashboard</a>
        <span class="badge" style="background:${ph.color};color:#fff">${ph.name}</span></div>
      <div class="card">
        <div class="row">
          <div class="grow"><div class="muted">Day ${n} of ${TOTAL}</div><h1>${esc(l.title)}</h1>
          <div class="muted">🎯 ${esc(l.goal)}</div></div>
          <div style="text-align:center"><div class="timer" id="timer">30:00</div>
            <button class="btn small" id="timerBtn">▶ Start 30-min timer</button></div>
        </div>
      </div>
      ${banner}
      <div class="steps-nav" id="stepsNav"></div>
      ${stepsFor(l).map((s, i) => `<section class="card step" id="step-${i}">
        <div class="step-head"><span style="font-size:22px">${s.icon}</span><h2>${i + 1}. ${s.name}</h2><span class="badge">${s.min} min</span>
        <label class="check"><input type="checkbox" data-step="${i}" ${r.steps[i] ? "checked" : ""}> Done</label></div>
        ${stepBody(l, i)}</section>`).join("")}
      <div class="tabs-nav">
        ${n > 1 ? `<a class="btn" href="#/day/${n - 1}">← Day ${n - 1}</a>` : "<span></span>"}
        ${n < TOTAL ? `<a class="btn" href="#/day/${n + 1}">Day ${n + 1} →</a>` : "<span></span>"}
      </div>
      <div class="complete-bar"><span id="progressText" class="muted"></span>
        <button class="btn primary" id="completeBtn"></button></div>`;

    renderQuiz(l, "quiz");
    if (l.listen) renderQuiz(l, "lq");
    refreshProgress(n);

    // events
    $("#app").addEventListener("click", dayClick);
    $$("input[data-step]").forEach((cb) => cb.addEventListener("change", () => {
      r.steps[+cb.dataset.step] = cb.checked;
      save();
      refreshProgress(n);
    }));
    const tt = $("#toggleTranscript");
    if (tt) tt.addEventListener("click", () => {
      const t = $("#transcript");
      t.hidden = !t.hidden;
      tt.textContent = t.hidden ? "📄 Show transcript" : "🙈 Hide transcript";
    });
    const sa = $("#stopAudio");
    if (sa) sa.addEventListener("click", () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); });
    $("#completeBtn").addEventListener("click", () => {
      if (r.done) {
        r.done = false; delete r.doneOn; save(); renderDay(n);
      } else {
        r.done = true; r.doneOn = todayStr(); r.steps = r.steps.map(() => true); save();
        location.hash = "#/";
      }
    });
    setupTimer(n);
  }

  function dayClick(e) {
    const sp = e.target.closest(".speak");
    if (sp) { speak(sp.dataset.say, sp.dataset.rate ? +sp.dataset.rate : 0); return; }
    const rc = e.target.closest(".review-card");
    if (rc) { rc.classList.toggle("open"); return; }
    const opt = e.target.closest(".opt");
    if (opt && !opt.disabled) {
      const n = currentDay();
      const l = byDay[n];
      const r = rec(n);
      const kind = opt.dataset.k;
      r[kind][+opt.dataset.q] = +opt.dataset.o;
      for (let i = 0; i < questionsOf(l, kind).length; i++) if (r[kind][i] === undefined) r[kind][i] = null;
      save();
      renderQuiz(l, kind);
      const s = quizScore(n, kind);
      if (s.answered === s.total) {
        const stepId = kind === "lq" ? "listen" : (l.listen ? "grammar" : "quiz");
        const idx = stepsFor(l).findIndex((x) => x.id === stepId);
        if (idx >= 0) {
          r.steps[idx] = true;
          const cb = $('input[data-step="' + idx + '"]');
          if (cb) cb.checked = true;
          save();
          refreshProgress(n);
        }
      }
    }
  }

  function currentDay() {
    const m = location.hash.match(/^#\/day\/(\d+)/);
    return m ? +m[1] : null;
  }

  function refreshProgress(n) {
    const r = rec(n);
    const doneSteps = r.steps.filter(Boolean).length;
    $("#stepsNav").innerHTML = stepsFor(byDay[n]).map((s, i) => `<a class="step-pill ${r.steps[i] ? "done" : ""}" href="#/day/${n}" data-jump="${i}">${r.steps[i] ? "✓" : s.icon} ${s.name}</a>`).join("");
    $$("#stepsNav a").forEach((a) => a.addEventListener("click", (ev) => {
      ev.preventDefault();
      $("#step-" + a.dataset.jump).scrollIntoView({ behavior: "smooth" });
    }));
    $("#progressText").textContent = r.done ? "Day completed ✅" : `${doneSteps}/5 steps done`;
    const btn = $("#completeBtn");
    btn.disabled = !r.done && doneSteps < 5;
    btn.textContent = r.done ? "Mark as not done" : "✔ Complete Day " + n;
  }

  function setupTimer(n) {
    const r = rec(n);
    const el = $("#timer"), btn = $("#timerBtn");
    let running = false;
    function paint() {
      const left = Math.max(0, SESSION_SECONDS - (r.seconds || 0));
      el.textContent = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
      if (left === 0) { el.textContent = "00:00 ✓"; }
    }
    paint();
    if (r.seconds > 0 && r.seconds < SESSION_SECONDS) btn.textContent = "▶ Resume timer";
    btn.addEventListener("click", () => {
      running = !running;
      stopTimer();
      if (running) {
        btn.textContent = "⏸ Pause";
        timerHandle = setInterval(() => {
          r.seconds = (r.seconds || 0) + 1;
          paint();
          if (r.seconds % 5 === 0) save();
          if (r.seconds >= SESSION_SECONDS) { stopTimer(); running = false; btn.textContent = "Timer finished"; save(); }
        }, 1000);
      } else {
        btn.textContent = "▶ Resume timer";
        save();
      }
    });
  }

  // ---------- guide ----------
  function renderGuide() {
    $("#app").innerHTML = `
      <h1>How the course works</h1>
      <p class="muted">Each day is exactly 30 minutes. Same routine, new content. Consistency beats intensity. There is no writing homework: everything is listening, speaking, vocabulary and grammar.</p>
      <div class="card"><h2>Level 1 · Days 1–60 (beginner to intermediate)</h2>
        <table><tr><th>Step</th><th>Time</th><th>What you do</th></tr>
        <tr><td>🔁 Warm-up review</td><td>3 min</td><td>Recall words from 1, 3 and 7 days ago (spaced repetition).</td></tr>
        <tr><td>📚 New vocabulary</td><td>7 min</td><td>6 useful words with meaning, example and audio. Say them aloud.</td></tr>
        <tr><td>🧩 Sentence & grammar</td><td>8 min</td><td>One grammar point or sentence pattern with simple rules and examples.</td></tr>
        <tr><td>🎤 Phrases & speaking</td><td>8 min</td><td>Real-life phrases and a speaking task. Speak out loud!</td></tr>
        <tr><td>✅ Quick quiz</td><td>4 min</td><td>3 questions to check what you learned.</td></tr></table></div>
      <div class="card"><h2>Level 2 · Days 61–120 (intermediate to upper-intermediate)</h2>
        <table><tr><th>Step</th><th>Time</th><th>What you do</th></tr>
        <tr><td>🔁 Warm-up review</td><td>3 min</td><td>Spaced review of earlier words.</td></tr>
        <tr><td>📚 New vocabulary</td><td>6 min</td><td>8 B1–B2 words with examples and audio.</td></tr>
        <tr><td>🧩 Grammar & quiz</td><td>6 min</td><td>Upper-intermediate grammar plus a 3-question quiz.</td></tr>
        <tr><td>🎧 Listening</td><td>6 min</td><td>Listen to a short passage, answer 2 questions, then read the transcript.</td></tr>
        <tr><td>🎤 Phrases & speaking</td><td>9 min</td><td>Shadow the listening text, then do a longer speaking task.</td></tr></table></div>
      <div class="card"><h2>The 8 phases</h2>
        ${[1, 2, 3, 4, 5, 6, 7, 8].map((p) => `<p><span class="dot" style="background:${PHASES[p].color}"></span> <b>${PHASES[p].name}</b> (${PHASES[p].range}) — ${PHASES[p].desc}.</p>`).join("")}
        <p class="muted">The last day of each phase is a checkpoint with a longer speaking test.</p></div>
      <div class="card"><h2>Rules for becoming fluent</h2>
        <ol>
          <li><b>Speak every day.</b> Out loud, even to yourself. Fluency is a speaking skill.</li>
          <li><b>Never skip two days.</b> If you miss one, do two short lessons the next day.</li>
          <li><b>Record yourself</b> on Day 1, 30, 60, 90 and 120 and compare.</li>
          <li><b>Add extra input outside the 30 min</b> if you can: one English video, a podcast on your commute, your phone in English.</li>
          <li><b>Accept mistakes.</b> Communicating clearly is the goal, not perfect grammar.</li>
          <li><b>Think in English</b> — narrate what you are doing ("I'm making tea. I'm adding sugar.").</li>
        </ol></div>
      <div class="card"><h2>Free extras you can add (no cost)</h2>
        <ul><li>BBC Learning English, "6 Minute English" podcast</li><li>YouTube: English with Lucy, Rachel's English, Papa Teach Me</li>
        <li>Practice speaking: HelloTalk, Tandem or ChatGPT voice mode</li></ul></div>
      <a class="btn primary" href="#/">Go to dashboard</a>`;
  }

  // ---------- router ----------
  function route() {
    stopTimer();
    $("#app").replaceWith($("#app").cloneNode(false)); // drop old listeners
    const h = location.hash || "#/";
    const m = h.match(/^#\/day\/(\d+)$/);
    if (m) renderDay(Math.max(1, Math.min(TOTAL, +m[1])));
    else if (h === "#/guide") renderGuide();
    else renderDashboard();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", save);
  document.addEventListener("click", (e) => {
    const sp = e.target.closest(".speak");
    if (sp && !$("#app").contains(sp)) speak(sp.dataset.say);
  });

  if (lessons.length !== 120) console.warn("Expected 120 lessons, found " + lessons.length);
  route();
})();

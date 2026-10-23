/* ==========================================================================
   GAV Quiz — Backend no Google Sheets (Google Apps Script)
   1) Abra a planilha > Extensões > Apps Script, cole este arquivo inteiro.
   2) Troque a senha ADMIN_KEY abaixo.
   3) Rode a função setup() uma vez (cria as abas e um quiz de exemplo).
   4) Implantar > Nova implantação > App da Web
        Executar como: Eu  |  Quem pode acessar: Qualquer pessoa
   5) Copie a URL /exec e cole em config.js (API_URL) no GitHub.
   ========================================================================== */

var ADMIN_KEY = 'gav2026';          // <<< TROQUE ESTA SENHA (é a senha do apresentador)

var SH_Q = 'Quizzes', SH_A = 'Respostas', SH_P = 'Jogadores';
var Q_HEADER = ['Quiz', 'Nº', 'Pergunta', 'A', 'B', 'C', 'D', 'Correta'];
var CACHE_TTL = 21600; // 6h

function doGet(e) { return respond((e && e.parameter) || {}); }

/* POST em texto puro (JSON) — usado para salvar perguntas, que não cabem numa URL */
function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { p = (e && e.parameter) || {}; }
  return respond(p);
}

function respond(params) {
  var out;
  try { out = createEngine(SheetStore()).handle(params); }
  catch (err) { out = { ok: false, error: 'server', message: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function SheetStore() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var cache = CacheService.getScriptCache();
  function sh(name) { return ss.getSheetByName(name); }
  function cget(k) { var v = cache.get(k); return v ? JSON.parse(v) : null; }
  function cput(k, v) { try { cache.put(k, JSON.stringify(v), CACHE_TTL); } catch (e) {} }

  return {
    adminKey: function () { return ADMIN_KEY; },
    now: function () { return Date.now(); },

    getState: function () {
      var s = cget('STATE');
      if (s) return s;
      var raw = props.getProperty('STATE');
      s = raw ? JSON.parse(raw) : { phase: 'off', q: -1 };
      cput('STATE', s); return s;
    },
    setState: function (s) { props.setProperty('STATE', JSON.stringify(s)); cput('STATE', s); },

    /* ---- quizzes salvos: uma linha por pergunta na aba "Quizzes" ---- */
    _qrows: function () {
      var s = sh(SH_Q); if (!s) return [];
      return s.getDataRange().getValues().slice(1).filter(function (r) { return String(r[0]).trim() && String(r[2]).trim(); });
    },
    _toQ: function (r) {
      var opts = [r[3], r[4], r[5], r[6]].map(function (x) { return String(x === undefined ? '' : x).trim(); });
      while (opts.length && !opts[opts.length - 1]) opts.pop();
      return { text: String(r[2]).trim(), options: opts, correct: String(r[7] || '').trim().toUpperCase().charAt(0) };
    },
    listQuizzes: function () {
      var m = {}, order = [];
      this._qrows().forEach(function (r) { var k = String(r[0]).trim(); if (!m[k]) { m[k] = 0; order.push(k); } m[k]++; });
      return order.map(function (k) { return { name: k, count: m[k] }; });
    },
    getQuiz: function (name) {
      var self = this, rows = this._qrows().filter(function (r) { return String(r[0]).trim().toLowerCase() === name.toLowerCase(); });
      rows.sort(function (a, b) { return (Number(a[1]) || 0) - (Number(b[1]) || 0); });
      return rows.length ? rows.map(function (r) { return self._toQ(r); }) : null;
    },
    saveQuiz: function (name, qs) {
      var lock = LockService.getScriptLock(); lock.waitLock(15000);
      try {
        var s = sh(SH_Q), key = name.toLowerCase();
        var keep = this._qrows().filter(function (r) { return String(r[0]).trim().toLowerCase() !== key; });
        var add = qs.map(function (q, i) { var o = q.options.concat(['', '', '', '']).slice(0, 4); return [name, i + 1, q.text].concat(o).concat([q.correct]); });
        var all = keep.concat(add);
        if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, Q_HEADER.length).clearContent();
        if (all.length) s.getRange(2, 1, all.length, Q_HEADER.length).setValues(all);
      } finally { lock.releaseLock(); }
    },
    deleteQuiz: function (name) {
      var lock = LockService.getScriptLock(); lock.waitLock(15000);
      try {
        var s = sh(SH_Q), key = name.toLowerCase();
        var keep = this._qrows().filter(function (r) { return String(r[0]).trim().toLowerCase() !== key; });
        if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, Q_HEADER.length).clearContent();
        if (keep.length) s.getRange(2, 1, keep.length, Q_HEADER.length).setValues(keep);
      } finally { lock.releaseLock(); }
    },
    setQuestions: function (session, qs) { props.setProperty('Q_' + session, JSON.stringify(qs)); cput('Q_' + session, qs); },
    getQuestions: function (session) {
      var q = cget('Q_' + session); if (q) return q;
      q = JSON.parse(props.getProperty('Q_' + session) || '[]'); cput('Q_' + session, q); return q;
    },

    addPlayer: function (session, pid, who) {   // who = { n: nome, r: sala }
      var lock = LockService.getScriptLock(); lock.waitLock(10000);
      try {
        var map = this.getPlayers(session), old = map[pid];
        if (!old || old.n !== who.n || old.r !== who.r) {
          sh(SH_P).appendRow([new Date(), session, pid, who.n, who.r]);
          map[pid] = who; cput('P_' + session, map);
        }
      } finally { lock.releaseLock(); }
    },
    getPlayers: function (session) {
      var m = cget('P_' + session); if (m) return m;
      m = {};
      sh(SH_P).getDataRange().getValues().slice(1).forEach(function (r) { if (r[1] === session) m[r[2]] = { n: String(r[3]), r: String(r[4] || '') }; });
      cput('P_' + session, m); return m;
    },

    hasAnswer: function (k) { return !!cache.get('A_' + k); },
    markAnswer: function (k) { cache.put('A_' + k, '1', CACHE_TTL); },
    addAnswer: function (a) {
      sh(SH_A).appendRow([new Date(), a.session, a.q + 1, a.pid, a.name, a.room, a.choice, a.correct ? 'SIM' : 'NÃO', a.ms, a.points]);
    },
    getAnswers: function (session, q) {
      var rows = sh(SH_A).getDataRange().getValues().slice(1), out = [];
      rows.forEach(function (r) {
        if (r[1] !== session) return;
        var qi = Number(r[2]) - 1; if (q !== null && q !== undefined && qi !== q) return;
        out.push({ q: qi, pid: String(r[3]), name: String(r[4]), room: String(r[5]), choice: String(r[6]), correct: r[7] === 'SIM', ms: Number(r[8]) || 0, points: Number(r[9]) || 0 });
      });
      return out;
    },

    putResults: function (session, q, obj) { cput('R_' + session + '_' + q, obj); },
    getResults: function (session, q) { return cget('R_' + session + '_' + q); }
  };
}

/* Rode uma vez: cria as abas com cabeçalhos e perguntas de exemplo */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  function ensure(name, header, widths) {
    var s = ss.getSheetByName(name) || ss.insertSheet(name);
    if (s.getLastRow() === 0) {
      s.appendRow(header);
      s.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#0B306B').setFontColor('#FEF9E0');
      s.setFrozenRows(1);
      (widths || []).forEach(function (w, i) { s.setColumnWidth(i + 1, w); });
    }
    return s;
  }
  var q = ensure(SH_Q, Q_HEADER, [150, 40, 380, 170, 170, 170, 170, 80]);
  if (q.getLastRow() === 1) {
    q.getRange(2, 1, 5, 8).setValues([
      ['Marca GAV', 1, 'O que o símbolo da GAV representa?', 'Uma flor tropical', 'Uma rosa dos ventos', 'Um sol nascente', 'Uma estrela-do-mar', 'B'],
      ['Marca GAV', 2, 'A ligatura do logotipo une quais letras?', 'A e V', 'G e V', 'G e A', 'Nenhuma', 'C'],
      ['Marca GAV', 3, 'A marca animada remete a quais elementos?', 'Ao ar e à água', 'Ao fogo e à terra', 'À areia e ao sol', 'Às montanhas', 'A'],
      ['Marca GAV', 4, 'Qual tipografia é usada nos títulos?', 'Motiva Sans', 'Helvetica', 'Fraunces', 'Times New Roman', 'C'],
      ['Marca GAV', 5, 'Qual é a cor predominante da marca GAV?', 'Areia institucional', 'Azul GAV', 'Offwhite', 'Verde-água', 'B']
    ]);
  }
  ensure(SH_A, ['Data/Hora', 'Sessão', 'Pergunta', 'ID Jogador', 'Nome completo', 'Sala', 'Resposta', 'Correta', 'Tempo (ms)', 'Pontos']);
  ensure(SH_P, ['Data/Hora', 'Sessão', 'ID Jogador', 'Nome completo', 'Sala']);
  PropertiesService.getScriptProperties().setProperty('STATE', JSON.stringify({ phase: 'off', q: -1 }));
  CacheService.getScriptCache().remove('STATE');
}

/* ---------------- motor do jogo (idêntico ao assets/engine.js) ---------------- */
/* ==========================================================================
   GAV Quiz — motor do jogo
   O MESMO código roda em dois lugares:
   - no Google Apps Script (Code.gs), gravando na planilha;
   - no navegador, em modo demonstração (localStorage), para testar sem backend.
   ========================================================================== */
function createEngine(S) {
  var LETTERS = ['A', 'B', 'C', 'D'];
  var PREROLL_MS = 3500;   // tempo da animação de transição antes da pergunta abrir
  var GRACE_MS = 1500;     // tolerância de rede após o fim do tempo

  function err(code, msg) { return { ok: false, error: code, message: msg || code }; }
  function isHost(p) { return p.key && String(p.key) === String(S.adminKey()); }

  function publicState(st, withCorrect) {
    var out = {
      ok: true, session: st.session || null, phase: st.phase || 'off', q: st.q, total: st.total || 0,
      startedAt: st.startedAt || 0, endsAt: st.endsAt || 0, title: st.title || '', quiz: st.quiz || '', timed: !!st.timed, secs: st.secs || 0, v: st.v || 0,
      serverNow: S.now()
    };
    if (st.session && st.q >= 0 && (st.phase === 'question' || st.phase === 'reveal')) {
      var q = S.getQuestions(st.session)[st.q];
      out.question = { text: q.text, options: q.options, time: q.time };
      if (st.phase === 'reveal' || withCorrect) out.correct = q.correct;
    }
    return out;
  }

  function bump(st) { st.v = (st.v || 0) + 1; S.setState(st); return st; }

  // jogador = { n: nome completo, r: sala }
  function who(players, pid, fb) {
    var v = players[pid];
    if (!v) return { n: (fb && fb.name) || '?', r: (fb && fb.room) || '' };
    return typeof v === 'string' ? { n: v, r: '' } : v;
  }

  function scoreFor(correct, ms, limitMs) {
    if (!correct) return 0;
    if (!limitMs) return 1000;              // sem tempo: acerto vale 1000 (desempate pelo tempo total)
    var f = Math.max(0, 1 - ms / limitMs);
    return Math.round(500 + 500 * f);
  }

  /* Ranking individual: mais acertos; empate → menor tempo somado nas respostas certas */
  function ranking(session) {
    var players = S.getPlayers(session), rows = S.getAnswers(session, null), map = {}, seen = {};
    Object.keys(players).forEach(function (pid) { var w = who(players, pid); map[pid] = { pid: pid, name: w.n, room: w.r, score: 0, hits: 0, ms: 0 }; });
    rows.forEach(function (r) {
      var k = r.pid + ':' + r.q; if (seen[k]) return; seen[k] = 1;
      var m = map[r.pid] || (map[r.pid] = { pid: r.pid, name: r.name, room: r.room || '', score: 0, hits: 0, ms: 0 });
      m.score += r.points; if (r.correct) { m.hits++; m.ms += r.ms; }
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) { return b.hits - a.hits || a.ms - b.ms || a.name.localeCompare(b.name); });
    list.forEach(function (m, i) { m.pos = i + 1; });
    return list;
  }

  /* Ranking de salas: maior número total de respostas certas; empate → menor tempo somado */
  function roomRanking(list) {
    var rooms = {};
    list.forEach(function (m) {
      var k = m.room || 'Sem sala', r = rooms[k] || (rooms[k] = { room: k, people: 0, total: 0, hits: 0, ms: 0 });
      r.people++; r.total += m.score; r.hits += m.hits; r.ms += m.ms;
    });
    var out = Object.keys(rooms).map(function (k) { var r = rooms[k]; r.avg = Math.round(r.total / r.people); return r; });
    out.sort(function (a, b) { return b.hits - a.hits || a.ms - b.ms || a.room.localeCompare(b.room); });
    out.forEach(function (r, i) { r.pos = i + 1; });
    return out;
  }

  function questionResults(session, qi) {
    var players = S.getPlayers(session), rows = S.getAnswers(session, qi), seen = {}, list = [];
    var q = S.getQuestions(session)[qi], counts = q.options.map(function () { return 0; });
    rows.forEach(function (r) {
      if (seen[r.pid]) return; seen[r.pid] = 1;
      var idx = LETTERS.indexOf(r.choice); if (idx >= 0 && idx < counts.length) counts[idx]++;
      var w = who(players, r.pid, r);
      list.push({ pid: r.pid, name: w.n, room: w.r, choice: r.choice, correct: r.correct, ms: r.ms, points: r.points });
    });
    list.sort(function (a, b) { return a.ms - b.ms; });
    return { counts: counts, answers: list, answered: list.length, players: Object.keys(players).length, correct: q.correct };
  }

  /* Valida e normaliza as perguntas vindas do editor */
  function cleanQuestions(raw) {
    var list = raw;
    if (typeof raw === 'string') { try { list = JSON.parse(raw); } catch (e) { return { error: 'Formato de perguntas inválido.' }; } }
    if (!list || !list.length) return { error: 'Adicione pelo menos uma pergunta.' };
    if (list.length > 60) return { error: 'Máximo de 60 perguntas por quiz.' };
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var q = list[i] || {}, text = String(q.text || '').trim().slice(0, 300);
      var opts = (q.options || []).map(function (o) { return String(o || '').trim().slice(0, 140); });
      while (opts.length && !opts[opts.length - 1]) opts.pop();
      var n = i + 1;
      if (!text) return { error: 'A pergunta ' + n + ' está sem enunciado.' };
      if (opts.length < 2) return { error: 'A pergunta ' + n + ' precisa de pelo menos 2 alternativas.' };
      if (opts.length > 4) opts = opts.slice(0, 4);
      if (opts.indexOf('') >= 0) return { error: 'A pergunta ' + n + ' tem uma alternativa vazia no meio.' };
      var c = String(q.correct || '').toUpperCase().charAt(0);
      if (LETTERS.indexOf(c) < 0 || LETTERS.indexOf(c) >= opts.length) return { error: 'Marque a alternativa correta da pergunta ' + n + '.' };
      out.push({ text: text, options: opts, correct: c });
    }
    return { list: out };
  }
  function cleanName(n) { return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 60); }

  var actions = {
    /* ---------- públicas (celulares) ---------- */
    state: function () { return publicState(S.getState()); },

    join: function (p) {
      var st = S.getState();
      if (!st.session || st.phase === 'off') return err('no_session', 'O quiz ainda não foi aberto.');
      var name = String(p.name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      var room = String(p.room || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      var pid = String(p.pid || '').slice(0, 40);
      if (!pid || name.split(' ').filter(function (w) { return w.length >= 2; }).length < 2) return err('bad_name', 'Digite seu nome completo (nome e sobrenome).');
      if (!room) return err('bad_room', 'Selecione a sua sala.');
      S.addPlayer(st.session, pid, { n: name, r: room });
      return { ok: true, session: st.session, pid: pid, name: name, room: room };
    },

    answer: function (p) {
      var st = S.getState(), qi = Number(p.q), choice = String(p.choice || '').toUpperCase(), pid = String(p.pid || '');
      if (st.phase !== 'question' || st.q !== qi) return err('closed', 'Esta pergunta não está aberta.');
      var q = S.getQuestions(st.session)[qi];
      if (LETTERS.indexOf(choice) < 0 || LETTERS.indexOf(choice) >= q.options.length) return err('bad_choice');
      var now = S.now();
      if (now < st.startedAt - 500) return err('not_yet', 'Aguarde a pergunta abrir.');
      if (st.endsAt && now > st.endsAt + GRACE_MS) return err('time_up', 'Tempo esgotado.');
      var key = st.session + ':' + qi + ':' + pid;
      if (S.hasAnswer(key)) return { ok: true, already: true };
      S.markAnswer(key);
      var w = who(S.getPlayers(st.session), pid, p);
      var ms = Math.max(0, (st.endsAt ? Math.min(now, st.endsAt) : now) - st.startedAt), correct = choice === q.correct;
      S.addAnswer({ session: st.session, q: qi, pid: pid, name: w.n, room: w.r, choice: choice,
        correct: correct, ms: ms, points: scoreFor(correct, ms, q.time * 1000) });
      return { ok: true, choice: choice };   // a correção NÃO é revelada aqui
    },

    result: function (p) {
      var st = S.getState(), qi = Number(p.q);
      if (!(st.phase === 'reveal' && st.q === qi) && st.phase !== 'end') return err('not_revealed');
      var res = S.getResults(st.session, st.phase === 'end' ? 'final' : qi);
      if (!res) return err('not_ready');
      var me = res.players[p.pid] || null;
      return { ok: true, q: qi, correct: res.correct, me: me, total: res.count, rooms: res.rooms || 0 };
    },

    /* ---------- apresentador (exigem senha) ---------- */
    host_check: function () { return { ok: true }; },

    /* ----- quizzes salvos (editor do apresentador) ----- */
    host_quizzes: function () { return { ok: true, quizzes: S.listQuizzes() }; },
    host_quiz_get: function (p) {
      var qs = S.getQuiz(cleanName(p.name));
      return qs ? { ok: true, name: cleanName(p.name), questions: qs } : err('not_found', 'Quiz não encontrado.');
    },
    host_quiz_save: function (p) {
      var name = cleanName(p.name); if (!name) return err('bad_name', 'Dê um nome ao quiz.');
      var c = cleanQuestions(p.questions); if (c.error) return err('bad_questions', c.error);
      S.saveQuiz(name, c.list);
      return { ok: true, name: name, count: c.list.length, quizzes: S.listQuizzes() };
    },
    host_quiz_delete: function (p) { S.deleteQuiz(cleanName(p.name)); return { ok: true, quizzes: S.listQuizzes() }; },

    host_open: function (p) {
      var name = cleanName(p.quiz), qs = name ? S.getQuiz(name) : null;
      if (!qs || !qs.length) return err('no_questions', 'Escolha um quiz salvo com perguntas.');
      var timed = String(p.timer) === '1' || p.timer === true;
      var secs = Math.max(5, Math.min(300, Math.round(Number(p.secs) || 20)));
      qs = qs.map(function (q) { return { text: q.text, options: q.options, correct: q.correct, time: timed ? secs : 0 }; });
      var d = new Date(S.now());
      var session = 'S' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) +
        '-' + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + '-' + Math.random().toString(36).slice(2, 6);
      S.setQuestions(session, qs);
      var prev = S.getState();
      return publicState(bump({ session: session, phase: 'lobby', q: -1, total: qs.length, title: p.title || '', quiz: name,
        timed: timed, secs: timed ? secs : 0, v: prev.v || 0 }), true);
    },

    host_next: function () {
      var st = S.getState();
      if (!st.session) return err('no_session');
      if (st.q + 1 >= st.total) return actions.host_end();
      var qi = st.q + 1, q = S.getQuestions(st.session)[qi], now = S.now();
      st.phase = 'question'; st.q = qi; st.startedAt = now + PREROLL_MS; st.endsAt = q.time ? st.startedAt + q.time * 1000 : 0;
      return publicState(bump(st), true);
    },

    host_reveal: function () {
      var st = S.getState();
      if (st.phase !== 'question') return publicState(st, true);
      var r = questionResults(st.session, st.q), rank = ranking(st.session), map = {}, rp = {};
      roomRanking(rank).forEach(function (x) { rp[x.room] = x.pos; });
      var byPid = {}; r.answers.forEach(function (a) { byPid[a.pid] = a; });
      rank.forEach(function (m) {
        var a = byPid[m.pid];
        map[m.pid] = { choice: a ? a.choice : null, correct: a ? a.correct : false, points: a ? a.points : 0, score: m.score, hits: m.hits, pos: m.pos, room: m.room, roomPos: rp[m.room || 'Sem sala'] };
      });
      S.putResults(st.session, st.q, { correct: r.correct, count: rank.length, players: map });
      st.phase = 'reveal';
      return publicState(bump(st), true);
    },

    host_end: function () {
      var st = S.getState();
      if (!st.session) return err('no_session');
      var rank = ranking(st.session), map = {}, rooms = roomRanking(rank), rp = {};
      rooms.forEach(function (x) { rp[x.room] = x.pos; });
      rank.forEach(function (m) { map[m.pid] = { score: m.score, pos: m.pos, hits: m.hits, room: m.room, roomPos: rp[m.room || 'Sem sala'] }; });
      S.putResults(st.session, 'final', { correct: null, count: rank.length, rooms: rooms.length, players: map });
      st.phase = 'end';
      return publicState(bump(st), true);
    },

    host_close: function () {
      var st = S.getState(); st.phase = 'off'; return publicState(bump(st), true);
    },

    host_results: function (p) {
      var st = S.getState(), qi = p.q !== undefined && p.q !== '' ? Number(p.q) : st.q;
      if (!st.session || qi < 0) return err('no_question');
      var r = questionResults(st.session, qi); r.ok = true; r.q = qi; return r;
    },

    host_players: function () {
      var st = S.getState(); if (!st.session) return { ok: true, players: [] };
      var pl = S.getPlayers(st.session);
      return { ok: true, players: Object.keys(pl).map(function (k) { var w = who(pl, k); return { name: w.n, room: w.r }; }) };
    },

    host_ranking: function () {
      var st = S.getState(); if (!st.session) return err('no_session');
      var list = ranking(st.session);
      return { ok: true, ranking: list.map(function (m) { return { name: m.name, room: m.room, score: m.score, hits: m.hits, ms: m.ms, pos: m.pos }; }),
        rooms: roomRanking(list), questionsDone: st.phase === 'end' ? st.total : Math.max(0, st.q + (st.phase === 'question' ? 0 : 1)) };
    }
  };

  return {
    handle: function (p) {
      p = p || {};
      var fn = actions[p.action || 'state'];
      if (!fn) return err('unknown_action');
      if (String(p.action).indexOf('host_') === 0 && !isHost(p)) return err('unauthorized', 'Senha do apresentador incorreta.');
      return fn(p);
    },
    LETTERS: LETTERS
  };
}
if (typeof module !== 'undefined') module.exports = { createEngine: createEngine };

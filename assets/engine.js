/* ==========================================================================
   GAV Quiz — motor do jogo
   O MESMO código roda em dois lugares:
   - no Google Apps Script (Code.gs), gravando na planilha;
   - no navegador, em modo demonstração (localStorage), para testar sem backend.
   ========================================================================== */
function createEngine(S) {
  var LETTERS = ['A', 'B', 'C', 'D'];
  var PREROLL_MS = 3000;   // tempo da animação de transição antes da pergunta abrir
  var GRACE_MS = 1500;     // tolerância de rede após o fim do tempo

  function err(code, msg) { return { ok: false, error: code, message: msg || code }; }
  function isHost(p) { return p.key && String(p.key) === String(S.adminKey()); }

  function publicState(st, withCorrect) {
    var out = {
      ok: true, session: st.session || null, phase: st.phase || 'off', q: st.q, total: st.total || 0,
      startedAt: st.startedAt || 0, endsAt: st.endsAt || 0, title: st.title || '', quiz: st.quiz || '', view: st.view || '', timed: !!st.timed, secs: st.secs || 0, v: st.v || 0,
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
      out.push({ text: text, options: opts, correct: c,
        section: String(q.section || '').trim().slice(0, 60), note: String(q.note || '').trim().slice(0, 240) });
    }
    return { list: out };
  }
  function cleanName(n) { return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 60); }

  /* resultado individual (lido do cache por participante — rápido) */
  function myResult(st, pid) {
    var key = st.phase === 'end' ? 'final' : st.q;
    var me = S.getMyResult ? S.getMyResult(st.session, key, pid) : null;
    var res = null;
    if (!me) { res = S.getResults(st.session, key); if (!res) return null; me = res.players[pid] || null; }
    var meta = S.getResultsMeta ? S.getResultsMeta(st.session, key) : null;
    meta = meta || res || S.getResults(st.session, key) || {};
    return { q: st.q, correct: meta.correct || null, me: me, total: meta.count || 0, rooms: meta.rooms || 0 };
  }

  var actions = {
    /* ---------- públicas (celulares) ---------- */
    state: function (p) {
      var st = S.getState(), out = publicState(st);
      // junto com o estado, o celular já recebe o próprio resultado (economiza uma chamada)
      if (p && p.pid && st.session && (st.phase === 'reveal' || st.phase === 'end')) out.res = myResult(st, String(p.pid));
      return out;
    },

    /* gabarito: só depois do fim do quiz; inclui as respostas da própria pessoa */
    gabarito: function (p) {
      var st = S.getState();
      if (st.phase !== 'end' || !st.session) return err('not_yet', 'O gabarito fica disponível no fim do quiz.');
      var qs = S.getQuestions(st.session), pid = String(p.pid || ''), mine = [];
      qs.forEach(function (q, i) {
        var m = pid ? (S.getMyResult ? S.getMyResult(st.session, i, pid) : null) : null;
        if (!m && pid) { var r = S.getResults(st.session, i); m = r && r.players ? r.players[pid] : null; }
        mine.push(m ? { choice: m.choice || null, correct: !!m.correct } : null);
      });
      var fin = pid ? myResult(st, pid) : null;
      return { ok: true, quiz: st.quiz || '', title: st.title || '', date: st.startedAt || S.now(), total: qs.length,
        questions: qs.map(function (q) { return { text: q.text, options: q.options, correct: q.correct, section: q.section || '', note: q.note || '' }; }),
        mine: mine, me: fin ? fin.me : null, players: fin ? fin.total : 0, rooms: fin ? fin.rooms : 0 };
    },


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
      qs = qs.map(function (q) { return { text: q.text, options: q.options, correct: q.correct, section: q.section || '', note: q.note || '', time: timed ? secs : 0 }; });
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
      st.view = ''; st.phase = 'question'; st.q = qi; st.startedAt = now + PREROLL_MS; st.endsAt = q.time ? st.startedAt + q.time * 1000 : 0;
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
      st.phase = 'reveal'; st.view = '';
      return publicState(bump(st), true);
    },

    host_end: function () {
      var st = S.getState();
      if (!st.session) return err('no_session');
      var rank = ranking(st.session), map = {}, rooms = roomRanking(rank), rp = {};
      rooms.forEach(function (x) { rp[x.room] = x.pos; });
      rank.forEach(function (m) { map[m.pid] = { score: m.score, pos: m.pos, hits: m.hits, room: m.room, roomPos: rp[m.room || 'Sem sala'] }; });
      S.putResults(st.session, 'final', { correct: null, count: rank.length, rooms: rooms.length, players: map });
      st.phase = 'end'; st.view = '';
      return publicState(bump(st), true);
    },

    /* o painel do administrador escolhe o que o telão mostra: '' (normal) ou ranking */
    host_view: function (p) {
      var st = S.getState(), v = String(p.view || '');
      if (['', 'rank-both', 'rank-people', 'rank-rooms'].indexOf(v) < 0) return err('bad_view');
      if (v && st.phase !== 'reveal' && st.phase !== 'end') return err('not_now', 'O ranking só pode ser mostrado depois de revelar uma resposta.');
      st.view = v; return publicState(bump(st), true);
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
      return { ok: true, players: Object.keys(pl).map(function (k) { var w = who(pl, k); return { pid: k, name: w.n, room: w.r }; }) };
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

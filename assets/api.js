/* GAV Quiz — cliente da API (remoto = Google Apps Script | demo = localStorage) */
(function () {
  var CFG = window.GAV_CONFIG || {};
  var qs = new URLSearchParams(location.search);
  var DEMO = qs.get('demo') === '1' || !CFG.API_URL;

  /* ----- armazenamento local para o modo demonstração (mesmo navegador, várias abas) ----- */
  function LocalStore() {
    var P = 'gavq:';
    function g(k, d) { try { var v = localStorage.getItem(P + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
    function s(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) {} }
    function quizzes() {
      var all = g('quizzes', null);
      if (!all) { all = {}; all['Marca GAV'] = { qs: window.GAV_DEMO_QUESTIONS || [], t: 1 }; s('quizzes', all); }
      return all;
    }
    return {
      adminKey: function () { return 'demo'; },
      now: function () { return Date.now(); },
      getState: function () { return g('state', { phase: 'off', q: -1 }); },
      setState: function (v) { s('state', v); },
      listQuizzes: function () {
        var all = quizzes();
        return Object.keys(all).map(function (k) { return { name: k, count: all[k].qs.length, updated: all[k].t }; })
          .sort(function (a, b) { return b.updated - a.updated; });
      },
      getQuiz: function (name) { var q = quizzes()[name]; return q ? q.qs : null; },
      saveQuiz: function (name, qs) { var all = quizzes(); all[name] = { qs: qs, t: Date.now() }; s('quizzes', all); },
      deleteQuiz: function (name) { var all = quizzes(); delete all[name]; s('quizzes', all); },
      setQuestions: function (ses, q) { s('q:' + ses, q); },
      getQuestions: function (ses) { return g('q:' + ses, []); },
      addPlayer: function (ses, pid, name) { var m = g('p:' + ses, {}); m[pid] = name; s('p:' + ses, m); },
      getPlayers: function (ses) { return g('p:' + ses, {}); },
      hasAnswer: function (k) { return !!g('a:' + k, 0); },
      markAnswer: function (k) { s('a:' + k, 1); },
      addAnswer: function (a) { var l = g('ans:' + a.session, []); l.push(a); s('ans:' + a.session, l); },
      getAnswers: function (ses, q) { return g('ans:' + ses, []).filter(function (a) { return q === null || q === undefined || a.q === q; }); },
      putResults: function (ses, q, o) { s('r:' + ses + ':' + q, o); },
      getResults: function (ses, q) { return g('r:' + ses + ':' + q, null); }
    };
  }

  var engine = DEMO ? createEngine(LocalStore()) : null;
  var offset = 0; // relógio do servidor - relógio local

  function call(action, params, opts) {
    params = Object.assign({ action: action }, params || {});
    if (DEMO) {
      return new Promise(function (res) {
        setTimeout(function () { res(JSON.parse(JSON.stringify(engine.handle(params)))); }, 60 + Math.random() * 120);
      });
    }
    var t0 = Date.now(), req;
    if (opts && opts.post) {
      // envios grandes (perguntas) vão por POST em texto puro — evita o preflight de CORS no Apps Script
      req = fetch(CFG.API_URL, { method: 'POST', redirect: 'follow', body: JSON.stringify(params), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    } else {
      var url = CFG.API_URL + (CFG.API_URL.indexOf('?') >= 0 ? '&' : '?') + new URLSearchParams(params).toString() + '&_=' + Date.now();
      req = fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
    }
    return req
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.serverNow) offset = j.serverNow - (t0 + Date.now()) / 2;
        return j;
      });
  }

  window.GAVAPI = {
    demo: DEMO,
    call: function (a, p, o) {
      return call(a, p, o).then(function (j) {
        if (DEMO && j && j.serverNow) offset = 0;
        return j;
      }).catch(function (e) { return { ok: false, error: 'network', message: 'Sem conexão. Tentando de novo…' }; });
    },
    now: function () { return Date.now() + offset; },
    playerUrl: function () {
      if (CFG.PLAYER_URL) return CFG.PLAYER_URL + (DEMO ? (CFG.PLAYER_URL.indexOf('?') < 0 ? '?demo=1' : '&demo=1') : '');
      var u = new URL('index.html', location.href); u.search = DEMO ? '?demo=1' : ''; return u.toString();
    }
  };

  /* perguntas usadas apenas no modo demonstração */
  window.GAV_DEMO_QUESTIONS = [
    { text: 'O que o símbolo da GAV representa?', options: ['Uma flor tropical', 'Uma rosa dos ventos', 'Um sol nascente', 'Uma estrela-do-mar'], correct: 'B' },
    { text: 'A ligatura do logotipo une quais letras?', options: ['A e V', 'G e V', 'G e A', 'Nenhuma'], correct: 'C' },
    { text: 'A marca animada remete a quais elementos?', options: ['Ao ar e à água', 'Ao fogo e à terra', 'À areia e ao sol', 'Às montanhas'], correct: 'A' },
    { text: 'Qual tipografia é usada nos títulos?', options: ['Motiva Sans', 'Helvetica', 'Fraunces', 'Times New Roman'], correct: 'C' },
    { text: 'Qual é a cor predominante da marca GAV?', options: ['Areia institucional', 'Azul GAV', 'Offwhite', 'Verde-água'], correct: 'B' }
  ];
})();

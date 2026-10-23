/* ==========================================================================
   GAV Quiz — identidade animada
   - logo(): revelação do logotipo com a ligatura G–A  (manual, p. 19 / "Marca animada")
   - symbol(): rosa dos ventos se desdobrando como um leque (manual, p. 20)
   - waves(): grafismos de ondas em movimento lento
   - mascot(): "Brisa", personagem original que aparece na tela do celular
   ========================================================================== */
(function () {
  var B = window.GAV_BRAND, NS = 'http://www.w3.org/2000/svg';
  var C = { navy: '#0B306B', blue: '#053F9B', off: '#FEF9E0', sand: '#BF8F64', sand2: '#A57A4C' };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uid = 0;

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  /* ---------------- LOGO (p. 19) ---------------- */
  function logo(target, o) {
    o = o || {}; var id = 'lg' + (++uid), L = B.logo;
    var color = o.color || C.navy, tag = o.tagline !== false;
    var h = tag ? L.h : L.markH;
    var svg = el(
      '<svg class="gav-logo" viewBox="0 0 ' + L.w + ' ' + h + '" role="img" aria-label="GAV Hotéis e Resorts">' +
      '<defs><mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="' + L.w + '" height="' + L.h + '">' +
      '<circle class="m-g" cx="106" cy="118" r="64" fill="none" stroke="#fff" stroke-width="140" pathLength="1" transform="rotate(-40 106 118)"/>' +
      '<rect class="m-a" x="196" y="-10" width="230" height="250" fill="#fff"/>' +
      '<rect class="m-l" x="70" y="88" width="300" height="96" fill="#fff"/>' +
      '</mask></defs>' +
      '<g fill="' + color + '">' +
      '<path class="p-ga" d="' + L.ga + '" mask="url(#' + id + ')"/>' +
      '<path class="p-v" d="' + L.v + '"/>' +
      (tag ? '<path class="p-tag" d="' + L.tag + '"/>' : '') +
      '</g></svg>');
    target.appendChild(svg);
    if (o.animate === false || reduce) { svg.classList.add('static'); return svg; }
    play(); svg.replay = play;
    function play() {
      var d = o.delay || 0, ease = 'cubic-bezier(.22,.8,.2,1)';
      svg.querySelector('.m-g').animate([{ strokeDasharray: '1', strokeDashoffset: 1 }, { strokeDasharray: '1', strokeDashoffset: 0 }],
        { duration: 900, delay: d + 150, easing: ease, fill: 'both' });
      svg.querySelector('.m-a').animate([{ transform: 'translateY(250px)' }, { transform: 'translateY(0)' }],
        { duration: 700, delay: d, easing: ease, fill: 'both' });
      svg.querySelector('.m-l').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: 650, delay: d + 850, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'both' });
      svg.querySelector('.p-v').animate([{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 700, delay: d + 120, easing: ease, fill: 'both' });
      var t = svg.querySelector('.p-tag');
      if (t) t.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 700, delay: d + 1350, easing: ease, fill: 'both' });
    }
    return svg;
  }

  /* ---------------- SÍMBOLO (p. 20) ---------------- */
  function symbol(target, o) {
    o = o || {}; var S = B.symbol, R = S.size / 2;
    var color = o.color || C.navy;
    var svg = el('<svg class="gav-symbol" viewBox="0 0 ' + S.size + ' ' + S.size + '" aria-hidden="true"><g class="rot">' +
      S.petals.map(function (p, i) { return '<path data-i="' + i + '" d="' + p.d + '" fill="' + color + '"/>'; }).join('') + '</g></svg>');
    target.appendChild(svg);
    var origin = R + 'px ' + R + 'px';
    var petals = [].slice.call(svg.querySelectorAll('path')), rot = svg.querySelector('.rot');
    petals.concat([rot]).forEach(function (n) { n.style.transformOrigin = origin; n.style.transformBox = 'view-box'; });
    var anims = [];
    function stop() { anims.forEach(function (a) { a.cancel(); }); anims = []; }
    // fechado = todas as pétalas recolhidas sobre a primeira, como um leque fechado
    function frames(i, open) {
      var closed = 'rotate(' + (-i * 41) + 'deg) scale(.55)', opened = 'rotate(0deg) scale(1)';
      return open ? [{ transform: closed, opacity: i ? .0 : 1, offset: 0 }, { transform: closed, opacity: 1, offset: .12 }, { transform: opened, opacity: 1 }]
                  : [{ transform: opened, opacity: 1 }, { transform: closed, opacity: 1, offset: .88 }, { transform: closed, opacity: i ? 0 : 1 }];
    }
    var api = {
      el: svg,
      unfold: function (dur, delay) {
        stop(); if (reduce) return Promise.resolve();
        dur = dur || 1600; delay = delay || 0;
        petals.forEach(function (p, i) {
          anims.push(p.animate(frames(i, true), { duration: dur, delay: delay + i * 25, easing: 'cubic-bezier(.3,.7,.15,1)', fill: 'both' }));
        });
        anims.push(rot.animate([{ transform: 'rotate(-120deg) scale(.6)' }, { transform: 'rotate(0) scale(1)' }],
          { duration: dur, delay: delay, easing: 'cubic-bezier(.3,.7,.15,1)', fill: 'both' }));
        return anims[anims.length - 1].finished.catch(function () {});
      },
      fold: function (dur) {
        stop(); if (reduce) return Promise.resolve(); dur = dur || 900;
        petals.forEach(function (p, i) { anims.push(p.animate(frames(i, false), { duration: dur, easing: 'cubic-bezier(.6,0,.6,1)', fill: 'both' })); });
        anims.push(rot.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(120deg) scale(.6)' }], { duration: dur, easing: 'cubic-bezier(.6,0,.6,1)', fill: 'both' }));
        return anims[anims.length - 1].finished.catch(function () {});
      },
      spin: function (secs) {
        if (reduce) return; rot.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: (secs || 40) * 1000, iterations: Infinity });
      },
      loop: function () { // desdobra, respira, recolhe — para telas de espera
        var alive = true;
        (function cycle() {
          if (!alive || !svg.isConnected) return;
          api.unfold(1600).then(function () { return wait(2600); }).then(function () { if (alive && svg.isConnected) return api.fold(900); })
            .then(function () { return wait(250); }).then(cycle);
        })();
        return function () { alive = false; };
      }
    };
    if (o.unfold) api.unfold(o.duration, o.delay);
    return api;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------------- GRAFISMOS (ondas) ---------------- */
  function waves(target, o) {
    o = o || {}; var W = B.waves;
    var colors = o.colors || { blue: C.blue, sand: C.sand };
    var svg = el('<svg class="gav-waves" viewBox="0 0 ' + W.w + ' ' + W.h + '" preserveAspectRatio="' + (o.par || 'xMidYMax slice') + '" aria-hidden="true">' +
      W.blue.map(function (d, i) { return '<path class="wv b' + i + '" d="' + d + '" fill="' + colors.blue + '"/>'; }).join('') +
      W.sand.map(function (d, i) { return '<path class="wv s' + i + '" d="' + d + '" fill="' + colors.sand + '"/>'; }).join('') + '</svg>');
    target.appendChild(svg);
    if (!reduce) [].forEach.call(svg.querySelectorAll('.wv'), function (p, i) {
      var amp = 18 + (i % 3) * 10;
      p.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + (i % 2 ? amp : -amp) + 'px)' }, { transform: 'translateX(0)' }],
        { duration: 7000 + i * 1300, iterations: Infinity, easing: 'ease-in-out' });
    });
    return svg;
  }

  /* ---------------- MASCOTE "BRISA" ----------------
     Personagem original — uma gotinha de onda inspirada nos grafismos.
     (O manual proíbe adicionar elementos ao logo/símbolo, por isso o
     personagem é independente deles.) */
  var MOUTH = {
    idle: '<path d="M61 96 Q70 104 79 96" fill="none" stroke="#0B306B" stroke-width="3.5" stroke-linecap="round"/>',
    happy: '<path d="M58 93 Q70 93 82 93 Q80 109 70 109 Q60 109 58 93Z" fill="#0B306B"/><path d="M63 103 Q70 99 77 103 Q74 108 70 108 Q66 108 63 103Z" fill="#E27C6B"/>',
    sad: '<path d="M61 101 Q70 93 79 101" fill="none" stroke="#0B306B" stroke-width="3.5" stroke-linecap="round"/>',
    think: '<ellipse cx="74" cy="98" rx="4.5" ry="5" fill="#0B306B"/>',
    wow: '<ellipse cx="70" cy="99" rx="6.5" ry="8" fill="#0B306B"/>'
  };
  function mascotSVG() {
    return '<svg class="brisa-svg" viewBox="0 0 140 160" aria-hidden="true">' +
      '<ellipse class="shadow" cx="70" cy="155" rx="34" ry="5" fill="#0B306B" opacity=".18"/>' +
      '<g class="body">' +
      '<path class="arm l" d="M24 112 C10 108 8 96 15 88" fill="none" stroke="#053F9B" stroke-width="9" stroke-linecap="round"/>' +
      '<path class="arm r" d="M116 112 C130 108 132 96 125 88" fill="none" stroke="#053F9B" stroke-width="9" stroke-linecap="round"/>' +
      '<path d="M70 150 C34 150 17 127 19 98 C21 70 39 51 57 39 C65 33 71 25 69 12 C91 14 109 31 113 53 C116 70 121 80 122 98 C123 127 106 150 70 150Z" fill="#053F9B"/>' +
      '<path d="M69 12 C86 3 108 10 114 29 C103 21 90 23 85 34 C82 23 76 16 69 12Z" fill="#0B306B"/>' +
      '<path d="M38 66 C42 56 50 49 58 45" fill="none" stroke="#FEF9E0" stroke-width="4" stroke-linecap="round" opacity=".45"/>' +
      '<ellipse cx="70" cy="130" rx="30" ry="17" fill="#FEF9E0"/>' +
      '<path d="M24 120 C40 111 56 125 72 118 C88 111 103 122 118 113" fill="none" stroke="#BF8F64" stroke-width="7" stroke-linecap="round"/>' +
      '<g class="eyes"><ellipse cx="55" cy="78" rx="9" ry="11" fill="#fff"/><ellipse cx="86" cy="78" rx="9" ry="11" fill="#fff"/>' +
      '<g class="pupils"><circle cx="57" cy="80" r="5.2" fill="#0B306B"/><circle cx="88" cy="80" r="5.2" fill="#0B306B"/>' +
      '<circle cx="59" cy="77.5" r="1.8" fill="#fff"/><circle cx="90" cy="77.5" r="1.8" fill="#fff"/></g></g>' +
      '<ellipse cx="44" cy="91" rx="6" ry="3.5" fill="#BF8F64" opacity=".7"/><ellipse cx="97" cy="91" rx="6" ry="3.5" fill="#BF8F64" opacity=".7"/>' +
      '<g class="mouth">' + MOUTH.idle + '</g>' +
      '</g></svg>';
  }

  function mascot(o) {
    o = o || {};
    var root = el('<div class="brisa" data-side="left" aria-live="polite"><div class="brisa-bubble"></div>' + mascotSVG() + '</div>');
    document.body.appendChild(root);
    var bubble = root.querySelector('.brisa-bubble'), mouth = root.querySelector('.mouth'), eyes = root.querySelector('.eyes'),
        pupils = root.querySelector('.pupils'), hideT, autoT, enabled = true;
    eyes.style.transformOrigin = '70px 78px'; eyes.style.transformBox = 'view-box';
    pupils.style.transformBox = 'view-box';
    // piscar
    (function blink() {
      if (!reduce) eyes.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.1)' }, { transform: 'scaleY(1)' }], { duration: 180 });
      setTimeout(blink, 2200 + Math.random() * 3000);
    })();
    // olhar em volta
    (function look() {
      var dx = (Math.random() * 6 - 3).toFixed(1), dy = (Math.random() * 4 - 2).toFixed(1);
      pupils.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      setTimeout(look, 1400 + Math.random() * 1800);
    })();

    function mood(m) { mouth.innerHTML = MOUTH[m] || MOUTH.idle; root.dataset.mood = m || 'idle'; }
    function show(side, text, m, ms) {
      clearTimeout(hideT);
      root.dataset.side = side || root.dataset.side || 'left';
      mood(m || 'idle');
      if (text) { bubble.textContent = text; root.classList.add('talk'); } else root.classList.remove('talk');
      root.classList.add('on');
      if (ms !== 0) hideT = setTimeout(hide, ms || 3800);
    }
    function hide() { root.classList.remove('on', 'talk'); }

    var LINES = o.lines || ['Oi! Eu sou a Brisa 👋', 'Olho na tela do apresentador!', 'Respira… e escolhe!', 'Tô torcendo por você!', 'Bora pra próxima?', 'Que vista, hein? 🌊'];
    function auto() {
      clearTimeout(autoT);
      autoT = setTimeout(function () {
        if (enabled && !root.classList.contains('on')) {
          var sides = ['left', 'right', 'bottom'];
          show(sides[Math.floor(Math.random() * 3)], LINES[Math.floor(Math.random() * LINES.length)], Math.random() < .5 ? 'happy' : 'idle', 3600);
        }
        auto();
      }, (o.every || 14000) + Math.random() * 8000);
    }
    auto();

    return {
      el: root, show: show, hide: hide, mood: mood,
      react: function (kind, text) { // reação imediata (acerto/erro/etc.)
        var map = { right: ['bottom', 'happy'], wrong: ['bottom', 'sad'], wait: ['right', 'think'], hello: ['left', 'happy'], wow: ['bottom', 'wow'] };
        var s = map[kind] || ['left', 'idle'];
        root.classList.remove('jump', 'droop'); void root.offsetWidth;
        if (kind === 'right') root.classList.add('jump');
        if (kind === 'wrong') root.classList.add('droop');
        show(s[0], text, s[1], 3200);
      },
      auto: function (on) { enabled = on; }
    };
  }

  /* confete nas cores da marca */
  function confetti(n) {
    if (reduce) return;
    var cols = [C.navy, C.blue, C.sand, C.sand2, C.off];
    var layer = el('<div class="confetti" aria-hidden="true"></div>'); document.body.appendChild(layer);
    for (var i = 0; i < (n || 60); i++) {
      var p = document.createElement('i'); p.style.background = cols[i % cols.length];
      p.style.left = Math.random() * 100 + 'vw';
      p.style.borderRadius = Math.random() < .5 ? '50% 0' : '2px';
      layer.appendChild(p);
      p.animate([{ transform: 'translate3d(0,-10vh,0) rotate(0)', opacity: 1 },
                 { transform: 'translate3d(' + (Math.random() * 30 - 15) + 'vw,105vh,0) rotate(' + (Math.random() * 720) + 'deg)', opacity: 1 }],
        { duration: 1800 + Math.random() * 1600, delay: Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'both' });
    }
    setTimeout(function () { layer.remove(); }, 4200);
  }

  window.GAV = { colors: C, logo: logo, symbol: symbol, waves: waves, mascot: mascot, confetti: confetti, wait: wait };
})();

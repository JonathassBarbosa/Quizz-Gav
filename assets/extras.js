/* ==========================================================================
   GAV Quiz — extras do fim do quiz
   - GAVX.gabarito(dados, pessoa): gera o gabarito em PDF (A4) na identidade GAV
   - GAVX.story(info): moldura de stories 9:16 com foto para o pódio (salvar/compartilhar)
   Tudo é desenhado em <canvas> com os vetores da marca e as fontes da página.
   ========================================================================== */
(function () {
  var B = window.GAV_BRAND;
  var C = { navy: '#0B306B', blue: '#053F9B', off: '#FEF9E0', sand: '#BF8F64', sand2: '#A57A4C', paper: '#FBFAF6', ink: '#0B306B', mute: '#5A6B88', line: '#E3E6EC', ok: '#2F7D5B', bad: '#B5523F' };
  var SERIF = "'Fraunces', Georgia, serif", SANS = "'Albert Sans', 'Helvetica Neue', Arial, sans-serif";

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var specs = ['500 30px Fraunces', '600 30px Fraunces', '400 16px "Albert Sans"', '600 16px "Albert Sans"', '700 16px "Albert Sans"', '800 16px "Albert Sans"'];
    return Promise.race([Promise.all(specs.map(function (f) { return document.fonts.load(f).catch(function () {}); })), new Promise(function (r) { setTimeout(r, 2500); })]);
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (window.jspdf) return res();
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Não foi possível carregar o gerador de PDF.')); };
      document.head.appendChild(s);
    });
  }
  var here = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^\/]*$/, '') : 'assets/'; })();

  /* ---------- desenho dos vetores da marca ---------- */
  function drawLogo(ctx, x, y, w, color, tagline) {
    var L = B.logo, h = tagline ? L.h : L.markH, k = w / L.w;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = color;
    ctx.fill(new Path2D(L.ga)); ctx.fill(new Path2D(L.v)); if (tagline) ctx.fill(new Path2D(L.tag));
    ctx.restore(); return h * k;
  }
  function drawSymbol(ctx, cx, cy, size, color, alpha) {
    var S = B.symbol, k = size / S.size;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(k, k); ctx.fillStyle = color;
    S.petals.forEach(function (p) { ctx.fill(new Path2D(p.d)); });
    ctx.restore();
  }
  function drawWaves(ctx, x, y, w, colors) {
    var W = B.waves, k = w / W.w;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = colors.blue; W.blue.forEach(function (d) { ctx.fill(new Path2D(d)); });
    ctx.fillStyle = colors.sand; W.sand.forEach(function (d) { ctx.fill(new Path2D(d)); });
    ctx.restore(); return W.h * k;
  }
  function wrap(ctx, text, maxW) {
    var words = String(text || '').split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function spaced(ctx, text, x, y, spacing, align) {
    var chars = String(text).split(''), total = chars.reduce(function (a, c) { return a + ctx.measureText(c).width + spacing; }, -spacing);
    var cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    var prev = ctx.textAlign; ctx.textAlign = 'left';
    chars.forEach(function (c) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + spacing; });
    ctx.textAlign = prev; return total;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ======================================================================
     GABARITO (A4) — layout baseado no gabarito de referência da GAV
     coordenadas em pontos (595 × 842), desenhadas em escala 3×
     ====================================================================== */
  var PW = 595.32, PH = 841.92, SC = 3;
  function newPage() {
    var c = document.createElement('canvas'); c.width = Math.round(PW * SC); c.height = Math.round(PH * SC);
    var ctx = c.getContext('2d'); ctx.scale(SC, SC); ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, PW, PH);
    return { canvas: c, ctx: ctx };
  }
  function header(ctx, quiz) {
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, PW, 80);
    ctx.fillStyle = C.sand; ctx.fillRect(0, 80, PW, 5);
    drawLogo(ctx, 28, 17, 70, C.off, true);
    ctx.fillStyle = 'rgba(254,249,224,.35)'; ctx.fillRect(137, 8, .8, 66);
    ctx.fillStyle = C.off; ctx.font = '500 25px ' + SERIF; ctx.fillText('Gabarito', 156, 38);
    ctx.font = '400 9.5px ' + SANS; ctx.fillStyle = 'rgba(254,249,224,.85)';
    var sub = wrap(ctx, quiz, 330)[0] || ''; ctx.fillText(sub, 156, 59);
    drawSymbol(ctx, 548, 40, 52, C.off, 1);
  }
  function footer(ctx, left, page, pages) {
    ctx.fillStyle = C.mute; ctx.font = '400 8px ' + SANS; ctx.textAlign = 'left'; ctx.fillText(left, 36, 808);
    ctx.fillStyle = C.navy; ctx.font = '700 8px ' + SANS; ctx.textAlign = 'right';
    ctx.fillText('Pontuação: 1 ponto por acerto' + (pages > 1 ? '   ·   ' + page + '/' + pages : ''), PW - 36, 808);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.navy; ctx.fillRect(0, PH - 7, PW, 7);
  }

  function layoutGabarito(g, who) {
    // mede cada linha para paginar
    var meas = newPage().ctx, items = [], lastSec = null, X0 = 75, TW = 400;
    g.questions.forEach(function (q, i) {
      var sec = (q.section || '').trim();
      if (sec && sec !== lastSec) { items.push({ type: 'section', text: sec, h: 34 }); lastSec = sec; }
      meas.font = '700 10px ' + SANS; var tl = wrap(meas, q.text, TW);
      var ci = 'ABCD'.indexOf(q.correct), ans = (q.options[ci] || '');
      meas.font = '400 8px ' + SANS;
      var sub = wrap(meas, 'Resposta: ' + ans + (q.note ? '. ' + q.note : ''), TW);
      var h = Math.max(46, 14 + tl.length * 12.5 + sub.length * 10.5 + 8);
      items.push({ type: 'row', n: i + 1, q: q, title: tl, sub: sub, h: h, mine: g.mine ? g.mine[i] : null });
    });
    var pages = [[]], y = 0, TOP = 160, BOTTOM = 780;
    var first = true;
    items.forEach(function (it) {
      var start = first ? TOP + 6 : TOP - 30;
      if (!pages[pages.length - 1].length) y = start;
      if (y + it.h > BOTTOM) { pages.push([]); y = TOP - 30; first = false; }
      if (it.type === 'section' && pages[pages.length - 1].length === 0 && pages.length > 1) y = TOP - 30;
      it.y = y; y += it.h; pages[pages.length - 1].push(it);
    });
    return pages;
  }

  function drawGabarito(g, who) {
    var pages = layoutGabarito(g, who), out = [];
    var date = new Date(g.date || Date.now());
    var left = (g.title || 'Quiz GAV') + ' · ' + pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear();
    var hits = (g.mine || []).filter(function (m) { return m && m.correct; }).length;
    pages.forEach(function (items, pi) {
      var P = newPage(), ctx = P.ctx;
      header(ctx, 'Quiz ' + (g.quiz || g.title || 'GAV'));
      if (pi === 0 && who) {
        // faixa do participante
        ctx.fillStyle = '#fff'; roundRect(ctx, 36, 102, PW - 72, 44, 8); ctx.fill();
        ctx.strokeStyle = C.line; ctx.lineWidth = .8; ctx.stroke();
        ctx.fillStyle = C.sand; ctx.font = '800 6.5px ' + SANS; spaced(ctx, 'PARTICIPANTE', 50, 118, 1.6);
        ctx.fillStyle = C.navy; ctx.font = '700 11px ' + SANS; ctx.fillText(wrap(ctx, who.name || '', 250)[0] || '', 50, 134);
        ctx.font = '400 8.5px ' + SANS; ctx.fillStyle = C.mute;
        var nameW = Math.min(250, ctx.measureText(who.name || '').width);
        ctx.fillText(who.room ? 'Sala ' + who.room : '', 50, 144.5);
        ctx.textAlign = 'right';
        ctx.fillStyle = C.navy; ctx.font = '600 20px ' + SERIF; ctx.fillText(hits + '/' + g.total, PW - 50, 132);
        ctx.fillStyle = C.mute; ctx.font = '400 8px ' + SANS;
        ctx.fillText('acertos' + (who.pos ? ' · ' + who.pos + 'º lugar de ' + (who.players || '') : ''), PW - 50, 143);
        ctx.textAlign = 'left';
      }
      items.forEach(function (it) {
        if (it.type === 'section') {
          ctx.fillStyle = C.sand; ctx.font = '700 7.5px ' + SANS;
          var w = spaced(ctx, it.text.toUpperCase(), 36, it.y + 20, 2);
          ctx.fillStyle = C.line; ctx.fillRect(Math.max(36 + w + 16, 315), it.y + 17, PW - 36 - Math.max(36 + w + 16, 315), .8);
          return;
        }
        var y = it.y, mid = y + it.h / 2;
        ctx.fillStyle = C.navy; ctx.font = '700 13px ' + SANS; ctx.textBaseline = 'middle'; ctx.fillText(pad(it.n), 36, mid); ctx.textBaseline = 'alphabetic';
        var ty = mid - ((it.title.length * 12.5 + it.sub.length * 10.5) / 2) + 9;
        ctx.font = '700 10px ' + SANS; ctx.fillStyle = C.navy;
        it.title.forEach(function (l, k) { ctx.fillText(l, 75, ty + k * 12.5); });
        ctx.font = '400 8px ' + SANS; ctx.fillStyle = C.mute;
        it.sub.forEach(function (l, k) { ctx.fillText(l, 75, ty + it.title.length * 12.5 + 1 + k * 10.5); });
        // letra correta
        ctx.fillStyle = C.navy; ctx.beginPath(); ctx.arc(543, mid, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 13px ' + SANS; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.q.correct, 543, mid + .5);
        // resposta da pessoa
        if (g.mine) {
          var m = it.mine;
          ctx.font = '700 7px ' + SANS;
          if (!m || !m.choice) { ctx.fillStyle = C.mute; ctx.fillText('sem resposta', 497, mid); }
          else { ctx.fillStyle = m.correct ? C.ok : C.bad; ctx.fillText('você: ' + m.choice + (m.correct ? ' ✓' : ' ✕'), 497, mid); }
        }
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = C.line; ctx.fillRect(36, y + it.h - .4, PW - 72, .8);
      });
      footer(ctx, left, pi + 1, pages.length);
      out.push(P.canvas);
    });
    return out;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40); }

  function gabarito(g, who) {
    return Promise.all([loadFonts(), loadScript(here + 'jspdf.umd.min.js')]).then(function () {
      var canvases = drawGabarito(g, who);
      var doc = new window.jspdf.jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
      canvases.forEach(function (c, i) {
        if (i) doc.addPage();
        doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, PW, PH, undefined, 'FAST');
      });
      var name = 'gabarito-' + (slug(g.quiz) || 'quiz-gav') + (who && who.name ? '-' + slug(who.name.split(' ')[0]) : '') + '.pdf';
      var blob = doc.output('blob');
      saveBlob(blob, name, 'application/pdf');
      return { pages: canvases.length };
    });
  }

  function saveBlob(blob, name, type) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    // iPhone antigo sem suporte a download: abre o arquivo para "Compartilhar → Salvar"
    var iOSOld = /iP(hone|ad|od)/.test(navigator.userAgent) && !('download' in HTMLAnchorElement.prototype);
    if (iOSOld) window.open(url, '_blank');
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  /* ======================================================================
     STORIES 9:16 (1080 × 1920) — foto + moldura da conquista
     ====================================================================== */
  var SW = 1080, SH = 1920;
  var MEDAL = { 1: { fill: '#BF8F64', ink: '#0B306B', label: '1º lugar' }, 2: { fill: '#FEF9E0', ink: '#0B306B', label: '2º lugar' }, 3: { fill: '#A57A4C', ink: '#FEF9E0', label: '3º lugar' } };

  function drawStory(canvas, img, info) {
    canvas.width = SW; canvas.height = SH;
    var ctx = canvas.getContext('2d');
    // fundo: foto (cobrindo) ou degradê da marca
    if (img) {
      var r = Math.max(SW / img.width, SH / img.height), w = img.width * r, h = img.height * r;
      ctx.drawImage(img, (SW - w) / 2, (SH - h) / 2 - 80, w, h);
    } else {
      var g0 = ctx.createLinearGradient(0, 0, 0, SH); g0.addColorStop(0, '#0B306B'); g0.addColorStop(1, '#053F9B');
      ctx.fillStyle = g0; ctx.fillRect(0, 0, SW, SH);
      drawSymbol(ctx, SW / 2, 820, 760, C.off, .07);
      ctx.fillStyle = 'rgba(254,249,224,.75)'; ctx.font = '600 40px ' + SANS; ctx.textAlign = 'center';
      ctx.fillText('Toque em "Tirar foto"', SW / 2, 820); ctx.textAlign = 'left';
    }
    // véu superior
    var gt = ctx.createLinearGradient(0, 0, 0, 560); gt.addColorStop(0, 'rgba(11,48,107,.92)'); gt.addColorStop(.55, 'rgba(11,48,107,.55)'); gt.addColorStop(1, 'rgba(11,48,107,0)');
    ctx.fillStyle = gt; ctx.fillRect(0, 0, SW, 560);
    drawLogo(ctx, 92, 100, 300, C.off, true);
    ctx.fillStyle = C.sand; ctx.font = '800 26px ' + SANS; spaced(ctx, 'QUIZ', 92, 368, 7);
    ctx.fillStyle = C.off; ctx.font = '500 56px ' + SERIF;
    wrap(ctx, info.quiz, SW - 184).slice(0, 2).forEach(function (l, k) { ctx.fillText(l, 92, 434 + k * 64); });

    // ondas + painel inferior
    var wy = 1060;
    var gb = ctx.createLinearGradient(0, wy - 220, 0, wy + 200); gb.addColorStop(0, 'rgba(11,48,107,0)'); gb.addColorStop(1, 'rgba(11,48,107,.7)');
    ctx.fillStyle = gb; ctx.fillRect(0, wy - 220, SW, SH - (wy - 220));
    ctx.fillStyle = C.navy;
    ctx.beginPath(); ctx.moveTo(0, wy + 190);
    ctx.bezierCurveTo(260, wy + 120, 520, wy + 250, 780, wy + 180); ctx.bezierCurveTo(900, wy + 150, 1000, wy + 160, SW, wy + 175);
    ctx.lineTo(SW, SH); ctx.lineTo(0, SH); ctx.closePath(); ctx.fill();

    // medalha
    var M = MEDAL[info.pos] || MEDAL[1], mx = SW / 2, my = wy + 300;
    drawSymbol(ctx, mx, my, 470, C.off, .12);
    ctx.fillStyle = M.fill; ctx.beginPath(); ctx.arc(mx, my, 118, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(11,48,107,.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(mx, my, 100, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = M.ink; ctx.font = '600 118px ' + SERIF; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(info.pos + 'º', mx + 6, my + 8); ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = C.off; ctx.font = '500 92px ' + SERIF; ctx.fillText(M.label, mx, my + 228);
    ctx.font = '700 46px ' + SANS;
    var nm = wrap(ctx, info.name, SW - 200); ctx.fillText(nm[0] || '', mx, my + 304);
    ctx.fillStyle = C.sand; ctx.font = '600 34px ' + SANS;
    ctx.fillText((info.room ? info.room + '  ·  ' : '') + info.hits + ' de ' + info.total + ' acertos', mx, my + 366);
    ctx.textAlign = 'left';

    // moldura
    ctx.strokeStyle = 'rgba(254,249,224,.9)'; ctx.lineWidth = 6; roundRect(ctx, 34, 34, SW - 68, SH - 68, 44); ctx.stroke();
    ctx.fillStyle = 'rgba(254,249,224,.6)'; ctx.font = '700 22px ' + SANS; spaced(ctx, 'GAV HOTÉIS E RESORTS', SW / 2, SH - 70, 6, 'center');
  }

  var modal = null;
  function story(info) {
    if (!modal) modal = buildModal();
    modal.info = info; modal.img = null;
    loadFonts().then(function () { drawStory(modal.canvas, null, info); });
    modal.root.hidden = false; document.body.style.overflow = 'hidden';
    modal.setReady(false);
  }
  function buildModal() {
    var css = document.createElement('style');
    css.textContent = '.gx-modal{position:fixed;inset:0;z-index:200;background:rgba(7,20,45,.96);display:flex;flex-direction:column;align-items:center;gap:12px;padding:max(14px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));overflow:auto}' +
      '.gx-modal[hidden]{display:none}' +
      '.gx-top{width:100%;max-width:420px;display:flex;align-items:center;justify-content:space-between;color:#FEF9E0}' +
      '.gx-top b{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:1.25rem}' +
      '.gx-x{border:0;background:rgba(254,249,224,.12);color:#FEF9E0;width:40px;height:40px;border-radius:50%;font-size:1.1rem}' +
      '.gx-canvas{height:min(62vh,640px);aspect-ratio:9/16;max-width:100%;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.5);background:#0B306B}' +
      '.gx-btns{width:100%;max-width:420px;display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.gx-btns .btn{width:100%;padding:.85em .6em}.gx-btns .full{grid-column:1/-1}' +
      '.gx-hint{color:rgba(254,249,224,.7);font-size:.85rem;text-align:center;max-width:380px;line-height:1.4}';
    document.head.appendChild(css);
    var root = document.createElement('div'); root.className = 'gx-modal'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Compartilhe esta conquista');
    root.innerHTML = '<div class="gx-top"><b>Compartilhe esta conquista</b><button class="gx-x" aria-label="Fechar">✕</button></div>' +
      '<canvas class="gx-canvas"></canvas>' +
      '<div class="gx-btns"><button class="btn sand" data-a="cam">📷 Tirar foto</button><button class="btn ghost" data-a="gal" style="color:#FEF9E0">🖼️ Da galeria</button>' +
      '<button class="btn full" data-a="share" style="background:#FEF9E0;color:#0B306B">Salvar / postar nos stories</button></div>' +
      '<p class="gx-hint" data-hint>Tire uma selfie: a moldura com a sua colocação é aplicada na hora. Depois toque em <b>Salvar / postar</b> e escolha <b>Salvar imagem</b> ou o Instagram.</p>' +
      '<input type="file" accept="image/*" capture="user" hidden data-in="cam"><input type="file" accept="image/*" hidden data-in="gal">';
    document.body.appendChild(root);
    var m = { root: root, canvas: root.querySelector('canvas'), img: null, info: null };
    m.setReady = function (ok) { root.querySelector('[data-a=share]').disabled = false; };
    root.querySelector('.gx-x').onclick = function () { root.hidden = true; document.body.style.overflow = ''; };
    root.querySelector('[data-a=cam]').onclick = function () { root.querySelector('[data-in=cam]').click(); };
    root.querySelector('[data-a=gal]').onclick = function () { root.querySelector('[data-in=gal]').click(); };
    [].forEach.call(root.querySelectorAll('input[type=file]'), function (inp) {
      inp.onchange = function () {
        var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
        var url = URL.createObjectURL(f), im = new Image();
        im.onload = function () { m.img = im; drawStory(m.canvas, im, m.info); root.querySelector('[data-a=cam]').textContent = '📷 Tirar outra'; };
        im.onerror = function () { alertHint('Não foi possível abrir essa foto. Tente outra.'); };
        im.src = url;
      };
    });
    function alertHint(t) { root.querySelector('[data-hint]').textContent = t; }
    root.querySelector('[data-a=share]').onclick = function () {
      var btn = this; btn.disabled = true;
      m.canvas.toBlob(function (blob) {
        btn.disabled = false; if (!blob) return;
        var name = 'conquista-gav-' + (m.info.pos || '') + 'lugar.jpg';
        var file = null; try { file = new File([blob], name, { type: 'image/jpeg' }); } catch (e) {}
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'Minha conquista no ' + m.info.quiz, text: m.info.pos + 'º lugar no ' + m.info.quiz + '! #GAVHoteis' })
            .catch(function (e) { if (e && e.name !== 'AbortError') saveBlob(blob, name, 'image/jpeg'); });
        } else {
          saveBlob(blob, name, 'image/jpeg');
          alertHint('Imagem salva! Se não aparecer na galeria, procure em Downloads. Agora é só postar nos stories.');
        }
      }, 'image/jpeg', 0.92);
    };
    return m;
  }

  window.GAVX = { gabarito: gabarito, story: story, _drawGabarito: drawGabarito, _drawStory: drawStory, _fonts: loadFonts };
})();

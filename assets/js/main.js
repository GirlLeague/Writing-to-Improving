
(function(){
  var root = document.documentElement;
  root.classList.add('js');
  var acts = Array.prototype.slice.call(document.querySelectorAll('.act'));
  var entryTimer = 0;
  var helm = document.getElementById('helm');
  var wheel = document.getElementById('wheel');
  var hint = document.getElementById('hint');
  var live = document.getElementById('live');
  var ticks = Array.prototype.slice.call(document.querySelectorAll('.tick'));
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var active = -1, beat = 1, hinted = false, used = false, raf = 0, turn = 0, orphanTimer = 0;

  function sectionTop(el){ return el.getBoundingClientRect().top + window.pageYOffset; }
  function scrollToY(y){
    if (reduceQuery.matches) window.scrollTo(0, y);
    else window.scrollTo({top:y, behavior:'smooth'});
  }
  function setHint(text, show){
    hint.textContent = text;
    helm.classList.toggle('show-hint', !!show);
  }
  function isFinal(){ return active === acts.length - 1; }
  function paintTicks(){
    ticks.forEach(function(t, i){
      t.classList.remove('past','now','future');
      if (active === acts.length - 1) t.classList.add('now');
      else if (i < active) t.classList.add('past');
      else if (i === active) t.classList.add('now');
      else t.classList.add('future');
    });
  }
  var TERMS = ['大陆航海总局','爱斯基摩海','爱丁岛','天赋号','贾凯齐','谢莜萱','江彦辰','高小天','六分仪','冰淇淋','一样'];
  function protectTerms(rootEl){
    if (!rootEl) return;
    var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function(node){
      var pn = node.parentNode;
      if (!pn || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pn.nodeName)) return;
      if (pn.classList && pn.classList.contains('ncw')) return;
      var text = node.nodeValue, hit = -1;
      for (var i = 0; i < TERMS.length; i++){ if (text.indexOf(TERMS[i]) !== -1){ hit = i; break; } }
      if (hit === -1) return;
      var frag = document.createDocumentFragment(), rest = text;
      while (rest.length){
        var best = -1, bestAt = -1;
        for (var k = 0; k < TERMS.length; k++){
          var at = rest.indexOf(TERMS[k]);
          if (at !== -1 && (bestAt === -1 || at < bestAt)){ bestAt = at; best = k; }
        }
        if (bestAt === -1){ frag.appendChild(document.createTextNode(rest)); break; }
        if (bestAt > 0) frag.appendChild(document.createTextNode(rest.slice(0, bestAt)));
        var span = document.createElement('span');
        span.className = 'ncw';
        span.textContent = TERMS[best];
        frag.appendChild(span);
        rest = rest.slice(bestAt + TERMS[best].length);
      }
      node.parentNode.replaceChild(frag, node);
    });
  }
  function lineMetrics(p){
    var range = document.createRange();
    range.selectNodeContents(p);
    var rects = range.getClientRects();
    if (!rects.length) return null;
    var lines = [], seen = {};
    for (var i = 0; i < rects.length; i++){
      var key = Math.round(rects[i].top);
      if (!(key in seen)){ seen[key] = lines.length; lines.push({top:key, w:0}); }
      lines[seen[key]].w += rects[i].width;
    }
    lines.sort(function(a, b){ return a.top - b.top; });
    return {count: lines.length, last: lines[lines.length - 1].w};
  }
  function fixOrphans(sec){
    if (!sec) return;
    var ps = sec.querySelectorAll('.copy p');
    for (var i = 0; i < ps.length; i++){
      var p = ps[i];
      if (p.dataset.balanced) continue;
      var fs = parseFloat(getComputedStyle(p).fontSize) || 18;
      var m = lineMetrics(p);
      if (!m || m.count < 2) continue;
      if (m.last < fs * 2.2){
        p.style.textWrap = 'balance';
        p.dataset.balanced = '1';
        var m2 = lineMetrics(p);
        if (m2 && m2.last < fs * 2.2) p.style.textWrap = 'pretty';
      }
    }
  }
  function resetOrphans(){
    acts.forEach(function(sec){
      sec.querySelectorAll('.copy p').forEach(function(p){
        p.style.textWrap = '';
        delete p.dataset.balanced;
      });
    });
  }
  function updateFrame(){
    var deathTop = sectionTop(acts[16]);
    var compact = window.innerWidth <= 760;
    var limit = Math.max(1, deathTop - window.innerHeight * .7);
    var p = Math.min(1, Math.max(0, window.pageYOffset / limit));
    var maxEdge = Math.min(window.innerWidth * (compact ? .04 : .05), compact ? 18 : 68);
    var base = compact ? 8 : 18;
    var edge = active >= 16 ? 0 : base + Math.pow(p, 1.35) * Math.max(0, maxEdge - base);
    root.style.setProperty('--frame', edge.toFixed(1) + 'px');
  }
  function setActive(index, nextBeat, announce){
    index = Math.max(0, Math.min(acts.length - 1, index));
    nextBeat = index === 5 ? (nextBeat || 1) : 1;
    var changed = index !== active;
    var beatChanged = nextBeat !== beat;
    active = index; beat = nextBeat;

    acts.forEach(function(el, i){
      el.classList.toggle('is-active', i === index);
    });
    var two = acts[5];
    two.classList.toggle('is-beat1', index === 5 && beat === 1);
    two.classList.toggle('is-beat2', index === 5 && beat === 2);
    document.body.classList.toggle('is-beat2', index === 5 && beat === 2);
    var beats = two.querySelectorAll('.beat');
    beats.forEach(function(el, i){ el.classList.toggle('is-current', i + 1 === beat); });

    document.body.dataset.act = String(index + 1);
    wheel.disabled = false;
    wheel.setAttribute('aria-disabled', 'false');
    document.body.classList.toggle('is-death', index === 16);
    helm.classList.toggle('is-replay', index === acts.length - 1);
    helm.classList.toggle('is-advancing', false);

    if (index === acts.length - 1){
      wheel.setAttribute('aria-label', '再航一次，回到第一幕');
      setHint('再航一次', true);
      turn = -120;
      root.style.setProperty('--turn', turn + 'deg');
    } else {
      if (turn === -120){ turn = 0; root.style.setProperty('--turn', '0deg'); }
      wheel.setAttribute('aria-label', '转舵，前往第 ' + (index + 2) + ' 幕');
      if (index === 0 && !used && hinted) setHint('转舵 · 下一幕', true);
      else setHint('', false);
    }

    if (changed || beatChanged){
      paintTicks();
      updateFrame();
      if (live && announce !== false){
        if (index === 5 && beat === 2) live.textContent = '第 6 幕，第二段，共 ' + acts.length + ' 幕';
        else live.textContent = '第 ' + (index + 1) + ' 幕，共 ' + acts.length + ' 幕';
      }
      if (index > 0) hinted = true;
    }
    if (changed){
      setupWeather(index + 1); fixOrphans(acts[index]);
      if (!reduceQuery.matches){
        var sec = acts[index];
        sec.classList.remove('is-entering');
        void sec.offsetWidth;
        sec.classList.add('is-entering');
        clearTimeout(entryTimer);
        entryTimer = setTimeout(function(){ sec.classList.remove('is-entering'); }, 1250);
      }
    }
    if (changed && index === 13 && !reduceQuery.matches){
      var fall = acts[13];
      fall.classList.remove('is-falling');
      void fall.offsetWidth;
      fall.classList.add('is-falling');
    }
  }
  function readPosition(){
    var marker = window.pageYOffset + window.innerHeight * 0.42;
    var index = 0;
    for (var i = 0; i < acts.length; i++){
      var top = sectionTop(acts[i]);
      var height = acts[i].offsetHeight;
      if (marker >= top && marker < top + height){ index = i; break; }
      if (marker >= top) index = i;
    }
    var b = 1;
    if (index === 5){
      var top = sectionTop(acts[5]);
      if (window.pageYOffset > top + window.innerHeight * 0.58) b = 2;
    }
    setActive(index, b, true);
    updateFrame();
  }
  function onScroll(){
    if (raf) return;
    raf = window.requestAnimationFrame(function(){ raf = 0; readPosition(); });
  }
  function advance(){
    used = true;
    helm.classList.remove('show-hint');
    helm.classList.add('is-advancing');
    window.setTimeout(function(){ helm.classList.remove('is-advancing'); }, 760);
    if (active === acts.length - 1){
      turn = 0;
      root.style.setProperty('--turn', '0deg');
      window.scrollTo(0, 0);
      window.setTimeout(function(){
        setActive(0, 1, true);
        used = false; hinted = true;
        setHint('转舵 · 下一幕', true);
        wheel.focus({preventScroll:true});
      }, reduceQuery.matches ? 0 : 80);
      return;
    }
    if (active === 5 && beat === 1){
      scrollToY(sectionTop(acts[5]) + window.innerHeight * 0.99);
      return;
    }
    scrollToY(sectionTop(acts[Math.min(active + 1, acts.length - 1)]));
  }
  function rotateWheel(delta){
    turn += delta;
    root.style.setProperty('--turn', turn + 'deg');
  }

  /* On narrow screens a 16:9 plate crops to its middle; move a portrait
     viewBox onto each act's focal object instead of showing only empty centre. */
  var mobileFocus = {1:1120,2:560,3:800,4:650,5:450,6:700,7:800,8:1200,9:800,10:800,
    11:900,12:700,13:800,14:400,15:700,16:500,17:800,18:800,19:800,20:800,21:1080};
  function updateAspect(){
    var mobile = window.matchMedia('(max-width:760px)').matches;
    var cropW = Math.min(1600, 900 * window.innerWidth / Math.max(1, window.innerHeight));
    acts.forEach(function(section){
      var svg = section.querySelector('.stage svg');
      if (!svg) return;
      if (mobile){
        var fx = mobileFocus[section.dataset.act] || 800;
        var x0 = Math.max(0, Math.min(1600 - cropW, fx - cropW / 2));
        svg.setAttribute('viewBox', x0.toFixed(1) + ' 0 ' + cropW.toFixed(1) + ' 900');
      } else {
        svg.setAttribute('viewBox', '0 0 1600 900');
      }
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    });
  }
  /* ---------- weather: drifting sea fog + distant thunder, outdoor acts only ---------- */
  var WEATHER = {1:.8, 4:.55, 7:.7, 8:.45, 9:.6, 10:.8, 14:.5, 18:.55, 19:.45, 20:.4, 21:.9};
  var SEA = {1:.64, 7:.56, 10:.52, 14:.58, 20:.6, 21:.65};
  var WATER = {1:1.8, 4:1.9, 7:1.7, 8:1.8, 21:2.0};
  var wWater = 1;
  var canvas = document.createElement('canvas');
  canvas.id = 'weather';
  canvas.setAttribute('aria-hidden', 'true');
  var wctx = canvas.getContext('2d');
  var fogSprite = (function(){
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    var rad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rad.addColorStop(0, 'rgba(198,208,194,.55)');
    rad.addColorStop(.5, 'rgba(178,192,180,.24)');
    rad.addColorStop(1, 'rgba(160,176,162,0)');
    g.fillStyle = rad;
    g.fillRect(0, 0, 128, 128);
    return c;
  })();
  var wOn = false, wAct = 0, wIntensity = 0, wW = 0, wH = 0, wDpr = 1;
  var wFog = [], wDrops = [], wCrests = [], wGlints = [], wRipples = [], wSpark = [], wRaf = 0, wLast = 0, wNextFlash = 0, wQueue = [], wBolt = null, wPower = 0;

  function weatherStage(act){
    var section = acts[act - 1];
    return section ? section.querySelector('.stage') : null;
  }
  function weatherSize(){
    var stage = canvas.parentNode;
    if (!stage) return;
    var box = stage.getBoundingClientRect();
    wDpr = Math.min(1.6, window.devicePixelRatio || 1);
    wW = Math.max(320, box.width);
    wH = Math.max(320, box.height);
    canvas.width = Math.round(wW * wDpr);
    canvas.height = Math.round(wH * wDpr);
    wctx.setTransform(wDpr, 0, 0, wDpr, 0, 0);
  }
  function weatherSeed(){
    var k = wIntensity, i, j;
    wWater = WATER[wAct] || 1;
    wFog = [];
    var count = Math.round(5 + k * 9);
    for (i = 0; i < count; i++){
      wFog.push({
        x: Math.random() * wW,
        y: wH * (.34 + Math.random() * .6),
        r: wW * (.16 + Math.random() * .26),
        a: .045 + Math.random() * .06,
        vx: (10 + Math.random() * 26) * (Math.random() < .5 ? -1 : 1),
        ph: Math.random() * 6.28,
        sp: .1 + Math.random() * .22
      });
    }
    wDrops = [];
    var dn = Math.round(wW / 9 * k);
    for (j = 0; j < dn; j++){
      wDrops.push({
        x: Math.random() * (wW + 260) - 130,
        y: Math.random() * wH,
        v: 680 + Math.random() * 520,
        l: 14 + Math.random() * 30,
        a: .075 + Math.random() * .085
      });
    }
    wCrests = [];
    var seaTop = SEA[wAct];
    if (seaTop){
      var cn = Math.round((18 + k * 14) * wWater);
      for (j = 0; j < cn; j++){
        wCrests.push({
          x: Math.random() * wW,
          y: wH * (seaTop + .06 + Math.random() * (.9 - seaTop - .06)),
          len: wW * (.05 + Math.random() * .1),
          v: 8 + Math.random() * 20,
          a: (.07 + Math.random() * .09) * (1 + (wWater - 1) * .35),
          ph: Math.random() * 6.28
        });
      }
    }
    wGlints = [];
    var gl = Math.round(wW / 18 * k * wWater);
    for (j = 0; j < gl; j++){
      wGlints.push({x: Math.random() * wW, y: wH * (.56 + Math.random() * .4), len: 6 + Math.random() * 26,
        v: 6 + Math.random() * 22, a: .1 + Math.random() * .22, ph: Math.random() * 6.28, sp: .6 + Math.random() * 1.6});
    }
    wRipples = [];
    var rp = Math.round(wW / 7 * k * (1 + (wWater - 1) * .5));
    for (j = 0; j < rp; j++){
      wRipples.push({x: Math.random() * wW, y: wH * (.54 + Math.random() * .44), len: 3 + Math.random() * 14,
        v: 3 + Math.random() * 12, a: .04 + Math.random() * .1, ph: Math.random() * 6.28, sp: .9 + Math.random() * 2.2});
    }
    wSpark = [];
    var sk = Math.round(wW / 34 * k * wWater);
    for (j = 0; j < sk; j++){
      wSpark.push({x: Math.random() * wW, y: wH * (.55 + Math.random() * .42), r: .6 + Math.random() * 1.3,
        a: .12 + Math.random() * .3, ph: Math.random() * 6.28, sp: .5 + Math.random() * 1.4});
    }
    wQueue = [];
    wPower = 0;
    wBolt = null;
    wNextFlash = performance.now() + 2200 + Math.random() * 4200;
  }
  function makeBolt(){
    var x = wW * (.26 + Math.random() * .66), y = 0;
    var bottom = wH * (.38 + Math.random() * .26);
    var pts = [[x, y]], branches = [];
    var steps = 7 + Math.floor(Math.random() * 5), i, b;
    for (i = 0; i < steps; i++){
      y += bottom / steps;
      x += (Math.random() - .5) * wW * .05;
      pts.push([x, y]);
      if (Math.random() < .34 && i > 1){
        var bx = x, by = y, bp = [[bx, by]];
        var bl = 2 + Math.floor(Math.random() * 3);
        for (b = 0; b < bl; b++){
          bx += (Math.random() - .5) * wW * .05;
          by += bottom * .09;
          bp.push([bx, by]);
        }
        branches.push(bp);
      }
    }
    return {main: pts, branches: branches};
  }
  function drawBolt(alpha){
    if (!wBolt) return;
    function line(p){
      wctx.beginPath();
      wctx.moveTo(p[0][0], p[0][1]);
      for (var i = 1; i < p.length; i++) wctx.lineTo(p[i][0], p[i][1]);
      wctx.stroke();
    }
    wctx.save();
    wctx.globalCompositeOperation = 'lighter';
    wctx.strokeStyle = 'rgba(216,232,226,' + alpha.toFixed(3) + ')';
    wctx.shadowColor = 'rgba(190,214,208,.55)';
    wctx.shadowBlur = 16;
    wctx.lineWidth = 1.9;
    line(wBolt.main);
    wctx.lineWidth = 1.2;
    wBolt.branches.forEach(line);
    wctx.restore();
  }
  function stepWeather(now){
    if (!wOn){ wRaf = 0; return; }
    wRaf = window.requestAnimationFrame(stepWeather);
    var dt = Math.min(.05, (now - wLast) / 1000 || .016);
    wLast = now;
    wctx.clearRect(0, 0, wW, wH);

    for (var i = 0; i < wFog.length; i++){
      var p = wFog[i];
      p.x += p.vx * dt;
      p.ph += p.sp * dt;
      if (p.x - p.r > wW + 60) p.x = -p.r - 60;
      if (p.x + p.r < -60) p.x = wW + p.r + 60;
      var yy = p.y + Math.sin(p.ph) * 24;
      wctx.globalAlpha = p.a * (.78 + .22 * Math.sin(p.ph * 1.7));
      wctx.drawImage(fogSprite, p.x - p.r, yy - p.r * .5, p.r * 2, p.r);
    }
    wctx.globalAlpha = 1;

    if (wCrests.length){
      wctx.strokeStyle = 'rgba(198,214,205,.62)';
      wctx.lineWidth = 1.25;
      for (var c = 0; c < wCrests.length; c++){
        var s = wCrests[c];
        s.x += s.v * dt;
        s.ph += dt * .9;
        if (s.x - s.len > wW + 40) s.x = -s.len - 40;
        var sy = s.y + Math.sin(s.ph) * 2.4;
        wctx.globalAlpha = s.a * (.55 + .45 * Math.sin(s.ph * 1.3));
        wctx.beginPath();
        wctx.moveTo(s.x, sy);
        wctx.quadraticCurveTo(s.x + s.len * .5, sy - 3.2, s.x + s.len, sy);
        wctx.stroke();
      }
      wctx.globalAlpha = 1;
    }

    var seaTop = SEA[wAct];
    if (seaTop){
      wctx.save();
      wctx.globalCompositeOperation = 'lighter';
      var rows = Math.round(5 + (wWater - 1) * 2.6);
      for (var b = 0; b < rows; b++){
        var t = b / (rows - 1);
        var yy = wH * (seaTop + .03 + t * (.95 - seaTop));
        var amp = (2.4 + t * 11) * (1 + wPower * 1.6) * (1 + (wWater - 1) * .34);
        var ph = now * .00055 * (1 + t * .55) + b * 1.73;
        wctx.strokeStyle = 'rgba(196,220,206,' + Math.min(.17, (.018 + .075 * t) * (1 + (wWater - 1) * .5)).toFixed(3) + ')';
        wctx.lineWidth = .8 + t * .6;
        wctx.beginPath();
        for (var x = -24; x <= wW + 24; x += 12){
          var y2 = yy + Math.sin(x * (.0031 + b * .0006) + ph) * amp + Math.sin(x * (.0089 + b * .0011) - ph * (1.4 + b * .12)) * (amp * (.32 + b * .04));
          if (x === -24) wctx.moveTo(x, y2); else wctx.lineTo(x, y2);
        }
        wctx.stroke();
      }
      for (var g = 0; g < wGlints.length; g++){
        var q = wGlints[g];
        q.x += q.v * dt * (1 + (wWater - 1) * .3); q.ph += q.sp * dt;
        if (q.x - q.len > wW + 20){ q.x = -q.len - 10; q.y = wH * (.56 + Math.random() * .4); }
        var tw = .45 + .55 * Math.sin(q.ph);
        wctx.strokeStyle = 'rgba(214,232,216,' + (q.a * tw).toFixed(3) + ')';
        wctx.lineWidth = 1.1;
        wctx.beginPath();
        wctx.moveTo(q.x, q.y);
        wctx.lineTo(q.x + q.len * tw, q.y - .6);
        wctx.stroke();
      }
      for (var r2 = 0; r2 < wRipples.length; r2++){
        var rp2 = wRipples[r2];
        rp2.x += rp2.v * dt; rp2.ph += rp2.sp * dt;
        if (rp2.x > wW + 30){ rp2.x = -30; rp2.y = wH * (.54 + Math.random() * .44); }
        var ra = rp2.a * (.4 + .6 * Math.sin(rp2.ph));
        wctx.strokeStyle = 'rgba(224,240,226,' + ra.toFixed(3) + ')';
        wctx.lineWidth = .9;
        wctx.beginPath();
        wctx.moveTo(rp2.x, rp2.y + Math.sin(rp2.ph * 1.7) * 1.6);
        wctx.lineTo(rp2.x + rp2.len, rp2.y + Math.sin(rp2.ph * 1.7 + .8) * 1.2);
        wctx.stroke();
      }
      for (var s2 = 0; s2 < wSpark.length; s2++){
        var sp2 = wSpark[s2];
        sp2.ph += sp2.sp * dt;
        var tw2 = Math.max(0, Math.sin(sp2.ph));
        if (tw2 <= .02) continue;
        wctx.fillStyle = 'rgba(240,248,238,' + (sp2.a * tw2 * tw2).toFixed(3) + ')';
        wctx.beginPath();
        wctx.arc(sp2.x, sp2.y, sp2.r * (.6 + tw2 * .7), 0, 6.2832);
        wctx.fill();
      }
      wctx.restore();
    }

    if (wDrops.length){
      wctx.strokeStyle = 'rgba(206,220,212,.55)';
      wctx.lineWidth = 1;
      for (var r = 0; r < wDrops.length; r++){
        var d = wDrops[r];
        d.y += d.v * dt;
        d.x += d.v * dt * .17;
        if (d.y > wH + 20){ d.y = -30 - Math.random() * 60; d.x = Math.random() * (wW + 260) - 130; }
        if (d.x > wW + 30) d.x -= wW + 60;
        wctx.globalAlpha = d.a;
        wctx.beginPath();
        wctx.moveTo(d.x, d.y);
        wctx.lineTo(d.x - d.l * .17, d.y - d.l);
        wctx.stroke();
      }
      wctx.globalAlpha = 1;
    }

    if (!wQueue.length && now > wNextFlash){
      var bursts = 2 + Math.floor(Math.random() * 3);
      var at = now + 60;
      for (var q = 0; q < bursts; q++){
        at += 80 + Math.random() * 160;
        wQueue.push({at: at, a: (.05 + Math.random() * .065) * (q === 0 ? 1.3 : .78), d: 130 + Math.random() * 170});
      }
      wBolt = Math.random() < .62 ? makeBolt() : null;
      wNextFlash = now + 5200 + Math.random() * 8600;
    }
    var glow = 0;
    for (var f = wQueue.length - 1; f >= 0; f--){
      var item = wQueue[f];
      if (now < item.at) continue;
      var age = now - item.at;
      if (age > item.d){ wQueue.splice(f, 1); continue; }
      var v = 1 - age / item.d;
      glow = Math.max(glow, item.a * v * v);
    }
    wPower = Math.max(glow, wPower * .9);
    if (wPower > .004){
      wctx.save();
      wctx.globalCompositeOperation = 'lighter';
      var sky = wctx.createLinearGradient(0, 0, 0, wH * .82);
      sky.addColorStop(0, 'rgba(168,192,192,' + (wPower * 1.75).toFixed(3) + ')');
      sky.addColorStop(.55, 'rgba(150,176,178,' + (wPower * .9).toFixed(3) + ')');
      sky.addColorStop(1, 'rgba(120,144,144,0)');
      wctx.fillStyle = sky;
      wctx.fillRect(0, 0, wW, wH);
      wctx.restore();
      drawBolt(Math.min(.5, wPower * 4.5));
    }
  }
  function weatherStart(){
    if (!wOn || wRaf) return;
    wLast = performance.now();
    wRaf = window.requestAnimationFrame(stepWeather);
  }
  function weatherStop(){
    if (wRaf) window.cancelAnimationFrame(wRaf);
    wRaf = 0;
    if (wctx) wctx.clearRect(0, 0, wW, wH);
  }
  function setupWeather(act){
    var stage = weatherStage(act);
    var k = WEATHER[act] || 0;
    var on = !!stage && k > 0 && !reduceQuery.matches;
    if (on){
      if (canvas.parentNode !== stage){
        var copy = stage.querySelector('.copy');
        if (copy) stage.insertBefore(canvas, copy);
        else stage.appendChild(canvas);
      }
      wAct = act;
      wIntensity = k;
      weatherSize();
      weatherSeed();
      wOn = true;
      canvas.style.opacity = '1';
      weatherStart();
    } else {
      wOn = false;
      weatherStop();
      canvas.style.opacity = '0';
    }
  }
  function weatherResize(){
    if (!wOn) return;
    weatherSize();
    weatherSeed();
  }

  wheel.addEventListener('click', advance);
  window.addEventListener('scroll', function(){
    if (!used && active === 0) helm.classList.remove('show-hint');
    onScroll();
  }, {passive:true});
  window.addEventListener('resize', function(){
    updateAspect(); weatherResize(); onScroll();
    window.clearTimeout(orphanTimer);
    orphanTimer = window.setTimeout(function(){ resetOrphans(); fixOrphans(acts[active]); }, 180);
  }, {passive:true});
  document.addEventListener('keydown', function(e){
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
      e.preventDefault();
      rotateWheel(e.key === 'ArrowRight' ? 9 : -9);
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') && (document.activeElement === wheel || e.target === wheel)){
      e.preventDefault();
      advance();
    }
  });

  window.setTimeout(function(){
    if (!hinted && !used && active === 0 && !reduceQuery.matches){
      hinted = true;
      setHint('转舵 · 下一幕', true);
    }
  }, 1900);

  if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', function(){ readPosition(); setupWeather(active + 1); });
  protectTerms(document.body);
  updateAspect();
  window.setTimeout(function(){ fixOrphans(acts[active]); }, 40);
  window.setTimeout(readPosition, 30);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) onScroll(); });
})();

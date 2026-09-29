/*
 * Loading screen Demon Slayer pour Garry's Mod : bascule entre le monde des Pourfendeurs et celui des démons.
 * ES5 uniquement : doit tourner sur Awesomium (branche principale) comme sur Chromium (x86-64).
 */
(function () {
  "use strict";

  var C = window.CONFIG || {};
  var BREATHS = C.breathingStyles && C.breathingStyles.length ? C.breathingStyles : [{ color: "#3fa9f5", effect: "water" }];
  var DEMON_COLOR = C.demonColor || "#d1102e";
  var DURATION = { slayer: (C.slayerDuration || 11000) / 1000, demon: (C.demonDuration || 9000) / 1000 };
  var TRANS_TIME = 0.9;
  var BLADE_LEFT = 18.6;

  var STAGES = [
    [/retrieving server info/i, 4], [/workshop complete/i, 55], [/mount/i, 8], [/downloading|workshop/i, 10],
    [/parsing game info/i, 58], [/client info sent/i, 75], [/sending client info/i, 70], [/received all lua/i, 84],
    [/starting lua/i, 90], [/lua/i, 80], [/precach/i, 93], [/loading/i, 95]
  ];

  /* ---------- Utilitaires ---------- */

  function $(id) { return document.getElementById(id); }
  function now() { return new Date().getTime(); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function hexToRgb(hex) {
    var n = parseInt(String(hex).replace("#", ""), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbHex(c) {
    return "#" + ((1 << 24) + ((c.r | 0) << 16) + ((c.g | 0) << 8) + (c.b | 0)).toString(16).slice(1);
  }
  function rgba(c, a) { return "rgba(" + (c.r | 0) + "," + (c.g | 0) + "," + (c.b | 0) + "," + (+a).toFixed(3) + ")"; }
  function setBg(el, value) {
    el.style.backgroundImage = value;
    if (!el.style.backgroundImage) {
      el.style.backgroundImage = value
        .replace(/linear-gradient\(to right,/g, "linear-gradient(left,")
        .replace(/linear-gradient\(/g, "-webkit-linear-gradient(");
    }
  }
  function setTransform(el, v) { el.style.webkitTransform = v; el.style.transform = v; }
  function queryParam(name) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
  }
  function mk(w, h) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  }
  function blobSprite(color0, color1) {
    var c = mk(256, 128), g = c.getContext("2d");
    g.scale(1, 0.5);
    var gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, color0); gr.addColorStop(0.6, color1); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return c;
  }
  function almond(g, cx, cy, ew, eh) {
    g.beginPath();
    g.moveTo(cx - ew, cy);
    g.quadraticCurveTo(cx, cy - eh * 2, cx + ew, cy);
    g.quadraticCurveTo(cx, cy + eh * 2, cx - ew, cy);
    g.closePath();
  }

  var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
    function (cb) { return setTimeout(cb, 1000 / 40); };

  function fitRem() { document.documentElement.style.fontSize = (window.innerHeight / 100) + "px"; }

  var cv = $("bg"), ctx = cv.getContext("2d");
  var buf = mk(1, 1), bctx = buf.getContext("2d");
  var W = 0, H = 0, S = 1;
  var moon = { x: 0, y: 0, r: 0 };

  /* ---------- Personnages (images fournies dans config.js) ---------- */

  var Chars = { slayer: [], demon: [], idx: { slayer: -1, demon: -1 } };

  function loadChars(list, arr) {
    for (var i = 0; list && i < list.length; i++) {
      var def = typeof list[i] === "string" ? { src: list[i] } : list[i];
      var img = new Image();
      img.onload = (function (d) { return function () { d.ok = true; }; })(def);
      img.src = def.src;
      def.img = img;
      arr.push(def);
    }
  }
  loadChars(C.characters && C.characters.slayer, Chars.slayer);
  loadChars(C.characters && C.characters.demon, Chars.demon);

  function nextChar(w) {
    if (!Chars[w].length) return null;
    Chars.idx[w] = (Chars.idx[w] + 1) % Chars[w].length;
    return Chars[w][Chars.idx[w]];
  }

  // Deux calques : l'image nette et un contour lumineux (silhouette teintée, dilatée puis floutée)
  function charLayers(def, color) {
    var h = Math.round(H * (def.height || 0.8));
    if (def.cache && def.cacheH === h && def.cacheColor === color) return def.cache;
    var img = def.img, w = Math.round(img.width * h / img.height), pad = Math.round(50 * S);
    var cw = w + pad * 2, ch = h + pad * 2;

    var sil = mk(cw, ch), sg = sil.getContext("2d");
    sg.drawImage(img, pad, pad, w, h);
    sg.globalCompositeOperation = "source-in";
    sg.fillStyle = color;
    sg.fillRect(0, 0, cw, ch);

    var glow = mk(cw, ch), gg = glow.getContext("2d"), r = 3.5 * S;
    gg.shadowColor = color;
    gg.shadowBlur = 28 * S;
    for (var a = 0; a < 8; a++) {
      var ang = a / 8 * Math.PI * 2;
      gg.drawImage(sil, Math.cos(ang) * r, Math.sin(ang) * r);
    }
    gg.shadowBlur = 12 * S;
    gg.drawImage(sil, 0, 0);

    var base = mk(cw, ch), bg = base.getContext("2d");
    if ("imageSmoothingQuality" in bg) bg.imageSmoothingQuality = "high";
    bg.drawImage(img, pad, pad, w, h);

    def.cache = { glow: glow, base: base, pad: pad };
    def.cacheH = h; def.cacheColor = color;
    return def.cache;
  }

  function drawChar(g, w, t, phaseT, cxFrac, color) {
    var list = Chars[w], i = Chars.idx[w];
    if (!list.length || i < 0 || !list[i].ok) return;
    var L = charLayers(list[i], list[i].color || color);
    var def = list[i], cx = def.x !== undefined ? def.x : cxFrac;
    var e = 1 - Math.pow(1 - clamp(phaseT / 1.1, 0, 1), 3);
    var x = Math.round(W * cx - L.base.width / 2 + (1 - e) * (cx < 0.5 ? -80 : 80) * S);
    var y = Math.round(H * (0.98 - (def.lift || 0)) + L.pad - L.base.height + Math.sin(t * 1.2) * 6 * S);
    g.globalAlpha = e * (0.75 + 0.25 * Math.sin(t * 2.2));
    g.globalCompositeOperation = "lighter";
    g.drawImage(L.glow, x, y);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = e;
    g.drawImage(L.base, x, y);
    g.globalAlpha = 1;
  }

  /* ---------- Monde des Pourfendeurs ---------- */

  var Slayer = (function () {
    var back, front, canopy, mistSpr, wSpr = [], wLens = [];
    var clouds = [], mists = [], petals = [], embers = [], flies = [], clusters = [], lanterns = [];
    var PRESETS = {
      none: { embers: 0, mist: 1, petals: "wisteria" },
      water: { embers: 0, mist: 1.2, petals: "wisteria" },
      flame: { embers: 1, mist: 0.6, petals: "wisteria" },
      thunder: { embers: 0, mist: 1, petals: "wisteria" },
      mist: { embers: 0, mist: 2.8, petals: "wisteria" },
      love: { embers: 0, mist: 0.9, petals: "pink" },
      sun: { embers: 1, mist: 0.6, petals: "wisteria" }
    };
    var PETAL_TONES = {
      wisteria: [["#c9b3ff", "#8f6ad8"], ["#b59cf0", "#6f4fc0"], ["#e4d8ff", "#a88ae6"]],
      pink: [["#ffc2da", "#f07aa8"], ["#ffd9e6", "#ff94bb"], ["#ffb0cc", "#e0588f"]]
    };
    var col = hexToRgb(BREATHS[0].color), fx = PRESETS.none, emberAcc = 0;

    function hillY(k) {
      return H * (0.845 - 0.085 * Math.exp(-Math.pow((k - 0.66) / 0.11, 2)) + 0.018 * Math.sin(k * 9));
    }

    function buildBack() {
      back = mk(W, H);
      var g = back.getContext("2d"), i;
      var sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#060a1c"); sky.addColorStop(0.35, "#0f1840");
      sky.addColorStop(0.65, "#1f2a62"); sky.addColorStop(0.85, "#2c3470"); sky.addColorStop(1, "#1a1f48");
      g.fillStyle = sky; g.fillRect(0, 0, W, H);

      for (i = 0; i < 170; i++) {
        var sx = Math.random() * W, sy = Math.pow(Math.random(), 1.6) * H * 0.6;
        var dx = sx - moon.x, dy = sy - moon.y;
        if (dx * dx + dy * dy < Math.pow(moon.r * 2.2, 2)) continue;
        var big = Math.random() < 0.06;
        g.fillStyle = "rgba(235,240,255," + (big ? 0.9 : rnd(0.25, 0.6)).toFixed(2) + ")";
        g.fillRect(Math.round(sx), Math.round(sy), big ? 2 * S : S, big ? 2 * S : S);
      }

      var halo = g.createRadialGradient(moon.x, moon.y, moon.r, moon.x, moon.y, moon.r * 3.4);
      halo.addColorStop(0, "rgba(190,205,255,0.22)"); halo.addColorStop(1, "rgba(190,205,255,0)");
      g.fillStyle = halo; g.fillRect(0, 0, W, H);
      var halo2 = g.createRadialGradient(moon.x, moon.y, moon.r, moon.x, moon.y, moon.r * 1.35);
      halo2.addColorStop(0, "rgba(255,250,235,0.35)"); halo2.addColorStop(1, "rgba(255,250,235,0)");
      g.fillStyle = halo2; g.fillRect(0, 0, W, H);

      g.fillStyle = "#f8f0da";
      g.beginPath(); g.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2); g.fill();
      g.save();
      g.beginPath(); g.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2); g.clip();
      var shade = g.createLinearGradient(moon.x - moon.r, moon.y - moon.r, moon.x + moon.r, moon.y + moon.r);
      shade.addColorStop(0, "rgba(230,215,185,0)"); shade.addColorStop(1, "rgba(215,195,160,0.55)");
      g.fillStyle = shade; g.fillRect(moon.x - moon.r, moon.y - moon.r, moon.r * 2, moon.r * 2);
      var MARIA = [[-0.3, -0.2, 0.34, 0.22, 0.4], [0.18, -0.35, 0.22, 0.14, -0.3], [0.25, 0.2, 0.3, 0.2, 0.6], [-0.2, 0.35, 0.2, 0.12, 0.1]];
      for (i = 0; i < MARIA.length; i++) {
        var m = MARIA[i];
        g.save();
        g.translate(moon.x + m[0] * moon.r, moon.y + m[1] * moon.r); g.rotate(m[4]); g.scale(m[2], m[3]);
        var mg = g.createRadialGradient(0, 0, 0, 0, 0, moon.r);
        mg.addColorStop(0, "rgba(200,185,150,0.3)"); mg.addColorStop(0.6, "rgba(200,185,150,0.18)"); mg.addColorStop(1, "rgba(200,185,150,0)");
        g.fillStyle = mg;
        g.beginPath(); g.arc(0, 0, moon.r, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.restore();
    }

    function ridge(g, baseY, amp, freq, jag, dip, color, rimAlpha) {
      var p0 = rnd(0, 6), p1 = rnd(0, 6), p2 = rnd(0, 6), pts = [], x;
      for (x = 0; x <= W + 8; x += 6) {
        var k = x / W;
        var y = baseY - amp * (0.55 * Math.sin(k * freq + p0) + 0.3 * Math.sin(k * freq * 2.3 + p1) +
          0.15 * Math.abs(Math.sin(k * freq * 5.1 + p2)) * jag) + (Math.random() - 0.5) * amp * 0.03;
        y += dip * Math.exp(-Math.pow((k - 0.66) / 0.15, 2));
        pts.push([x, y]);
      }
      g.fillStyle = color;
      g.beginPath(); g.moveTo(0, H);
      for (x = 0; x < pts.length; x++) g.lineTo(pts[x][0], pts[x][1]);
      g.lineTo(W, H); g.closePath(); g.fill();
      if (rimAlpha) {
        var rim = g.createLinearGradient(0, 0, W, 0);
        rim.addColorStop(0, "rgba(170,190,255,0)");
        rim.addColorStop(clamp(moon.x / W, 0.1, 0.9), "rgba(190,205,255," + rimAlpha + ")");
        rim.addColorStop(1, "rgba(170,190,255,0)");
        g.strokeStyle = rim; g.lineWidth = 1.6 * S;
        g.beginPath();
        for (x = 0; x < pts.length; x++) { if (x === 0) g.moveTo(pts[x][0], pts[x][1] + S); else g.lineTo(pts[x][0], pts[x][1] + S); }
        g.stroke();
      }
    }

    function pine(g, x, baseY, h) {
      var tiers = 6, w = h * 0.4;
      g.beginPath();
      for (var i = 0; i < tiers; i++) {
        var ty = baseY - h * (i / tiers) * 0.88, tw = w * (1 - (i / tiers) * 0.8) * rnd(0.85, 1.1);
        g.moveTo(x - tw / 2, ty); g.lineTo(x + rnd(-0.02, 0.02) * h, ty - h * 0.26); g.lineTo(x + tw / 2, ty);
      }
      g.fill();
      g.fillRect(x - h * 0.018, baseY - h * 0.1, h * 0.036, h * 0.1 + 4);
    }

    function torii(g, cx, baseY, h) {
      var span = h * 0.95, pw = h * 0.075;
      var ky = baseY - h, kt = h * 0.075, kw = span * 0.8;
      var nukiY = baseY - h * 0.66;
      g.beginPath();
      g.moveTo(cx - kw, ky - kt * 1.2);
      g.quadraticCurveTo(cx, ky + kt * 0.6, cx + kw, ky - kt * 1.2);
      g.lineTo(cx + kw * 0.96, ky + kt * 0.2);
      g.quadraticCurveTo(cx, ky + kt * 1.6, cx - kw * 0.96, ky + kt * 0.2);
      g.closePath(); g.fill();
      g.fillRect(cx - kw * 0.85, ky + kt * 0.8, kw * 1.7, kt * 0.7);
      g.fillRect(cx - span * 0.68, nukiY, span * 1.36, h * 0.055);
      g.fillRect(cx - pw * 0.35, ky + kt, pw * 0.7, nukiY - ky - kt);
      g.fillRect(cx - span / 2 - pw / 2, ky + kt, pw, baseY - ky - kt);
      g.fillRect(cx + span / 2 - pw / 2, ky + kt, pw, baseY - ky - kt);
    }

    function lantern(g, x, baseY, h, color) {
      var u = h / 10;
      g.fillStyle = color;
      g.fillRect(x - u * 1.6, baseY - u, u * 3.2, u);
      g.fillRect(x - u * 0.5, baseY - u * 5, u, u * 4);
      g.fillRect(x - u * 1.4, baseY - u * 5.6, u * 2.8, u * 0.6);
      g.fillRect(x - u * 1.1, baseY - u * 7.4, u * 2.2, u * 1.8);
      g.fillStyle = "#ffcf7a";
      g.fillRect(x - u * 0.55, baseY - u * 7.05, u * 1.1, u * 1.1);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x - u * 2.2, baseY - u * 7.2);
      g.quadraticCurveTo(x - u * 1.2, baseY - u * 7.6, x, baseY - u * 9);
      g.quadraticCurveTo(x + u * 1.2, baseY - u * 7.6, x + u * 2.2, baseY - u * 7.2);
      g.closePath(); g.fill();
      g.beginPath(); g.arc(x, baseY - u * 9.2, u * 0.45, 0, Math.PI * 2); g.fill();
      lanterns.push({ x: x, y: baseY - u * 6.5, r: u * 6, ph: rnd(0, 6.28) });
    }

    function buildFront() {
      front = mk(W, H);
      var g = front.getContext("2d"), x;
      ridge(g, H * 0.6, H * 0.12, 7, 1.4, H * 0.1, "#2a3268", 0.55);
      ridge(g, H * 0.7, H * 0.08, 5, 1, H * 0.06, "#1a2050", 0.4);
      ridge(g, H * 0.78, H * 0.05, 4, 0.6, H * 0.03, "#121739", 0.25);

      g.fillStyle = "#2a0a12";
      torii(g, W * 0.66, hillY(0.66) + H * 0.012, H * 0.17);

      g.fillStyle = "#080a1d";
      g.beginPath(); g.moveTo(0, H);
      for (x = 0; x <= W + 8; x += 8) g.lineTo(x, hillY(x / W));
      g.lineTo(W, H); g.closePath(); g.fill();

      lanterns = [];
      lantern(g, W * 0.66 - H * 0.14, hillY(0.66 - H * 0.14 / W) + H * 0.006, H * 0.075, "#080a1d");
      lantern(g, W * 0.66 + H * 0.14, hillY(0.66 + H * 0.14 / W) + H * 0.006, H * 0.075, "#080a1d");

      g.fillStyle = "#080a1d";
      for (x = -20; x < W + 20; x += rnd(12, 34) * S) {
        var k = x / W;
        if (Math.abs(k - 0.66) < 0.11) continue;
        var edge = Math.max(0, Math.abs(k - 0.5) - 0.3) / 0.2;
        pine(g, x, hillY(k) + H * 0.02, H * (rnd(0.05, 0.1) + edge * rnd(0.06, 0.16)));
      }
    }

    function clusterSprite(len) {
      var w = Math.round(len * 0.3 + 18 * S), c = mk(w, len), g = c.getContext("2d");
      var n = Math.floor(len / (2 * S)), top = hexToRgb("#d6c4ff"), bot = hexToRgb("#5b3fa6");
      g.strokeStyle = "#2a1a2e"; g.lineWidth = 1.4 * S;
      g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, len * 0.85); g.stroke();
      for (var i = n - 1; i >= 0; i--) {
        var k = i / n, y = 3 * S + k * (len - 8 * S);
        var spread = Math.pow(1 - k, 0.8) * w * 0.4 + 1.5 * S;
        var x = w / 2 + rnd(-spread, spread);
        var pr = (2.6 * (1 - k) + 1.5) * S * rnd(0.85, 1.15);
        var cc = { r: bot.r + (top.r - bot.r) * (1 - k), g: bot.g + (top.g - bot.g) * (1 - k), b: bot.b + (top.b - bot.b) * (1 - k) };
        g.save();
        g.translate(x, y); g.rotate(rnd(-0.5, 0.5)); g.scale(1, 0.72);
        g.fillStyle = rgba(cc, 1);
        g.beginPath(); g.arc(0, 0, pr, 0, Math.PI * 2); g.fill();
        if (k < 0.7) {
          g.fillStyle = "rgba(245,238,255,0.65)";
          g.beginPath(); g.arc(-pr * 0.3, -pr * 0.35, pr * 0.45, 0, Math.PI * 2); g.fill();
        }
        g.restore();
      }
      return c;
    }

    function leaf(g, x, y, len, ang) {
      g.save();
      g.translate(x, y); g.rotate(ang);
      g.strokeStyle = "#16261f"; g.lineWidth = 1.2 * S;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
      for (var i = 0; i < 7; i++) {
        var lx = len * (0.2 + i * 0.12), side = i % 2 ? 1 : -1, lw = len * 0.16;
        g.save();
        g.translate(lx, 0); g.rotate(side * 0.7);
        g.fillStyle = i % 3 ? "#1d352c" : "#284a3b";
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(lw * 0.5, -lw * 0.35, lw, 0); g.quadraticCurveTo(lw * 0.5, lw * 0.35, 0, 0); g.fill();
        g.restore();
      }
      g.restore();
    }

    function bezierPoints(p0, p1, p2, p3, n) {
      var out = [];
      for (var i = 0; i <= n; i++) {
        var t = i / n, u = 1 - t;
        out.push([
          u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
        ]);
      }
      return out;
    }

    function spriteFor(len) {
      var best = 0;
      for (var i = 0; i < wLens.length; i++) if (wLens[i] <= len) best = i;
      return wSpr[best];
    }

    // Branches de glycine qui encadrent le haut de l'écran depuis les deux coins
    function buildCanopy() {
      canopy = mk(W, H);
      var g = canopy.getContext("2d"), i, j;
      var branches = [
        { pts: bezierPoints([-0.03 * W, 0.01 * H], [0.08 * W, 0.09 * H], [0.2 * W, -0.02 * H], [0.36 * W, 0.035 * H], 40), w0: 16, w1: 3, maxLen: 0.13, side: -1 },
        { pts: bezierPoints([1.03 * W, -0.01 * H], [0.9 * W, 0.08 * H], [0.78 * W, -0.01 * H], [0.6 * W, 0.045 * H], 40), w0: 20, w1: 3, maxLen: 0.32, side: 1 },
        { pts: bezierPoints([1.02 * W, 0.1 * H], [0.95 * W, 0.12 * H], [0.9 * W, 0.07 * H], [0.84 * W, 0.1 * H], 20), w0: 10, w1: 2, maxLen: 0.22, side: 1 }
      ];
      clusters = [];
      for (i = 0; i < branches.length; i++) {
        var b = branches[i], pts = b.pts;
        g.strokeStyle = "#140c14"; g.lineCap = "round";
        for (j = 1; j < pts.length; j++) {
          var k = j / pts.length;
          g.lineWidth = (b.w0 + (b.w1 - b.w0) * k) * S;
          g.beginPath(); g.moveTo(pts[j - 1][0], pts[j - 1][1]); g.lineTo(pts[j][0], pts[j][1]); g.stroke();
        }
        for (j = 2; j < pts.length; j += 2) {
          var kk = j / pts.length, p = pts[j];
          if (Math.random() < 0.55) leaf(g, p[0], p[1], rnd(26, 46) * S, rnd(-2.6, -0.4) + (b.side < 0 ? 0 : Math.PI * 0.2));
          var n = Math.random() < 0.5 ? 2 : 1;
          for (var c = 0; c < n; c++) {
            var len = H * b.maxLen * (1 - kk * 0.65) * rnd(0.45, 1);
            clusters.push({ x: p[0] + rnd(-6, 6) * S, y: p[1] + rnd(0, 4) * S, spr: spriteFor(len), ph: rnd(0, 6.28), sp: rnd(0.5, 0.9), amp: rnd(0.02, 0.045) });
          }
        }
      }
      clusters.sort(function (a, b) { return b.spr.height - a.spr.height; });
    }

    function cloudSprite(w, h) {
      var c = mk(w, h), g = c.getContext("2d"), base = h * 0.8, bumps = [], x = w * 0.06;
      while (x < w * 0.94) {
        var r = rnd(0.2, 0.42) * h * (1 - Math.abs(x / w - 0.5) * 1.2);
        r = Math.max(r, h * 0.1);
        bumps.push([x, base - r * 0.55, r]);
        x += r * rnd(0.7, 1.2);
      }
      function blob(dy, color) {
        g.fillStyle = color;
        g.beginPath();
        for (var i = 0; i < bumps.length; i++) {
          g.moveTo(bumps[i][0] + bumps[i][2], bumps[i][1] + dy);
          g.arc(bumps[i][0], bumps[i][1] + dy, bumps[i][2], 0, Math.PI * 2);
        }
        g.fill();
      }
      blob(0, "#56649f");
      blob(h * 0.05, "#243064");
      blob(h * 0.16, "#1a2352");
      g.globalCompositeOperation = "destination-out";
      g.fillRect(0, base, w, h);
      return c;
    }

    function petalTone() {
      var set = PETAL_TONES[fx.petals] || PETAL_TONES.wisteria;
      return set[Math.floor(Math.random() * set.length)];
    }

    function newPetal(anywhere) {
      return {
        x: rnd(-0.1, 1.05) * W, y: anywhere ? rnd(0, H) : rnd(-0.08, 0) * H,
        vy: rnd(20, 45) * S, sw: rnd(0.5, 1.4), ph: rnd(0, 6.28),
        rot: rnd(0, 6.28), vr: rnd(-2, 2), sz: rnd(2.6, 4.6) * S, tone: petalTone()
      };
    }

    function build() {
      var i;
      buildBack();
      buildFront();
      wLens = [0.05, 0.07, 0.09, 0.12, 0.15, 0.19, 0.24, 0.3];
      wSpr = [];
      for (i = 0; i < wLens.length; i++) { wLens[i] = Math.round(H * wLens[i]); wSpr.push(clusterSprite(wLens[i])); }
      buildCanopy();
      mistSpr = blobSprite("rgba(150,165,220,0.5)", "rgba(150,165,220,0.2)");

      clouds = [];
      var CLOUDS = [[0.08, 0.2, 0.3], [0.5, 0.14, 0.22], [0.78, 0.5, 0.26], [0.3, 0.42, 0.18], [0.95, 0.3, 0.2]];
      for (i = 0; i < CLOUDS.length; i++) {
        var cw = CLOUDS[i][2] * W;
        clouds.push({ x: CLOUDS[i][0] * W - cw / 2, y: CLOUDS[i][1] * H, spr: cloudSprite(Math.round(cw), Math.round(cw * 0.26)), v: rnd(3, 7) * S });
      }
      mists = [];
      for (i = 0; i < 7; i++) {
        mists.push({ x: rnd(-0.4, 1) * W, y: rnd(0.62, 0.95) * H, w: rnd(0.5, 0.9) * W, h: H * rnd(0.12, 0.2), v: rnd(-12, 12) * S });
      }
      petals = [];
      for (i = 0; i < 36; i++) petals.push(newPetal(true));
      flies = [];
      for (i = 0; i < 22; i++) {
        flies.push({ x: rnd(0, 1) * W, y: rnd(0.55, 0.92) * H, vx: 0, vy: 0, ph: rnd(0, 6.28), sp: rnd(1.2, 2.6) });
      }
      embers = [];
    }

    function draw(g, dt, t, phaseT) {
      var i;
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      g.drawImage(back, 0, 0);

      for (i = 0; i < clouds.length; i++) {
        var c = clouds[i];
        c.x += c.v * dt;
        if (c.x > W) c.x = -c.spr.width;
        g.drawImage(c.spr, Math.round(c.x), Math.round(c.y - c.spr.height / 2));
      }
      g.drawImage(front, 0, 0);

      g.globalCompositeOperation = "lighter";
      for (i = 0; i < lanterns.length; i++) {
        var l = lanterns[i], fl = 0.85 + 0.15 * Math.sin(t * 7 + l.ph) * Math.sin(t * 3.1 + l.ph);
        var lg = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        lg.addColorStop(0, "rgba(255,190,110," + (0.35 * fl).toFixed(3) + ")"); lg.addColorStop(1, "rgba(255,190,110,0)");
        g.fillStyle = lg; g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      g.globalCompositeOperation = "source-over";

      g.globalAlpha = Math.min(1, 0.14 * fx.mist);
      for (i = 0; i < 4; i++) {
        var m0 = mists[i];
        g.drawImage(mistSpr, m0.x, m0.y - H * 0.08 - m0.h / 2, m0.w, m0.h);
      }
      g.globalAlpha = 1;

      drawChar(g, "slayer", t, phaseT, 0.2, rgbHex(col));

      g.globalAlpha = Math.min(1, 0.2 * fx.mist);
      for (i = 0; i < mists.length; i++) {
        var m = mists[i];
        m.x += m.v * dt;
        if (m.x > W) m.x = -m.w; else if (m.x < -m.w) m.x = W;
        g.drawImage(mistSpr, m.x, m.y - m.h / 2, m.w, m.h);
      }
      g.globalAlpha = 1;

      g.drawImage(canopy, 0, 0);
      for (i = 0; i < clusters.length; i++) {
        var cl = clusters[i];
        g.save();
        g.translate(cl.x, cl.y);
        g.rotate(Math.sin(t * cl.sp + cl.ph) * cl.amp);
        g.drawImage(cl.spr, -cl.spr.width / 2, 0);
        g.restore();
      }

      for (i = 0; i < petals.length; i++) {
        var p = petals[i];
        p.y += p.vy * dt;
        p.x += (Math.sin(t * p.sw + p.ph) * 28 + 14) * S * dt;
        p.rot += p.vr * dt;
        if (p.y > H + 10 || p.x > W + 40) { petals[i] = newPetal(false); continue; }
        var flip = Math.abs(Math.sin(t * 2 * p.sw + p.ph));
        g.save();
        g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, 0.25 + 0.4 * flip);
        g.fillStyle = p.tone[1];
        g.beginPath(); g.arc(0, 0, p.sz, 0, Math.PI * 2); g.fill();
        g.fillStyle = p.tone[0];
        g.beginPath(); g.arc(-p.sz * 0.2, -p.sz * 0.25, p.sz * 0.65, 0, Math.PI * 2); g.fill();
        g.restore();
      }

      g.globalCompositeOperation = "lighter";
      for (i = 0; i < flies.length; i++) {
        var f = flies[i];
        f.vx = clamp(f.vx + rnd(-1, 1) * 40 * S * dt, -16 * S, 16 * S);
        f.vy = clamp(f.vy + rnd(-1, 1) * 40 * S * dt, -10 * S, 10 * S);
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.x < 0) f.x = W; else if (f.x > W) f.x = 0;
        if (f.y < H * 0.5 || f.y > H * 0.95) f.vy = -f.vy;
        var fa = Math.pow(Math.max(0, Math.sin(t * f.sp + f.ph)), 3);
        if (fa < 0.02) continue;
        g.fillStyle = "rgba(210,255,140," + (0.16 * fa).toFixed(3) + ")";
        g.beginPath(); g.arc(f.x, f.y, 7 * S, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(240,255,200," + fa.toFixed(3) + ")";
        g.beginPath(); g.arc(f.x, f.y, 1.6 * S, 0, Math.PI * 2); g.fill();
      }

      if (fx.embers) {
        emberAcc = Math.min(5, emberAcc + dt * 16);
        while (emberAcc > 1 && embers.length < 120) {
          emberAcc -= 1;
          embers.push({ x: rnd(0, W), y: H + 10, vy: -rnd(40, 100) * S, ph: rnd(0, 6.28), life: 0, max: rnd(2.5, 6), sz: rnd(1, 2.4) * S });
        }
      }
      var core = { r: (col.r + 255) / 2, g: (col.g + 255) / 2, b: (col.b + 255) / 2 };
      for (i = embers.length - 1; i >= 0; i--) {
        var e = embers[i];
        e.life += dt;
        if (e.life > e.max) { embers.splice(i, 1); continue; }
        var ea = Math.sin((e.life / e.max) * Math.PI);
        e.y += e.vy * dt;
        e.x += Math.sin(t * 1.5 + e.ph) * 22 * S * dt;
        g.fillStyle = rgba(col, 0.13 * ea);
        g.beginPath(); g.arc(e.x, e.y, e.sz * 3.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = rgba(core, 0.9 * ea);
        g.beginPath(); g.arc(e.x, e.y, e.sz, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = "source-over";
    }

    return {
      build: build,
      draw: draw,
      setBreath: function (b) {
        col = hexToRgb(b.color);
        fx = PRESETS[b.effect] || PRESETS.none;
      }
    };
  })();

  /* ---------- Monde des démons (Château de l'Infini) ---------- */

  var Demon = (function () {
    var back, far, near, ground, mistSpr, lilySpr = [];
    var lilies = [], ash = [], embers = [], mists = [], eyes = [];
    var eyeTimer = 1, emberAcc = 0, pad = 60;
    var eye = { open: 0, delay: 0, blink: 0, blinkT: 4, lx: 0, ly: 0, tx: 0, ty: 0, lookT: 0 };
    var EMBER = { r: 255, g: 60, b: 30 };

    function groundY(k) { return H * (0.905 + 0.018 * Math.sin(k * 7 + 1) + 0.008 * Math.sin(k * 19)); }

    function buildBack() {
      back = mk(W, H);
      var g = back.getContext("2d"), i;
      var sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#070003"); sky.addColorStop(0.4, "#22020a");
      sky.addColorStop(0.72, "#4e0712"); sky.addColorStop(1, "#1a0206");
      g.fillStyle = sky; g.fillRect(0, 0, W, H);

      for (i = 0; i < 160; i++) {
        g.fillStyle = "rgba(255,120,100," + rnd(0.05, 0.3).toFixed(3) + ")";
        g.fillRect(Math.random() * W, Math.random() * H * 0.8, 1, 1);
      }

      var halo = g.createRadialGradient(moon.x, moon.y, moon.r * 0.9, moon.x, moon.y, moon.r * 3);
      halo.addColorStop(0, "rgba(255,40,40,0.35)");
      halo.addColorStop(0.4, "rgba(120,0,20,0.12)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = halo; g.fillRect(0, 0, W, H);

      var body = g.createRadialGradient(moon.x - moon.r * 0.25, moon.y - moon.r * 0.3, moon.r * 0.1, moon.x, moon.y, moon.r);
      body.addColorStop(0, "#ff7a5c"); body.addColorStop(0.55, "#e0201e"); body.addColorStop(1, "#7a0a0c");
      g.fillStyle = body;
      g.beginPath(); g.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2); g.fill();

      for (i = 0; i < 16; i++) {
        var ang = Math.random() * Math.PI * 2, d = Math.random() * moon.r * 0.8;
        g.fillStyle = "rgba(60,0,0," + rnd(0.08, 0.22).toFixed(3) + ")";
        g.beginPath();
        g.arc(moon.x + Math.cos(ang) * d, moon.y + Math.sin(ang) * d, moon.r * rnd(0.04, 0.16), 0, Math.PI * 2);
        g.fill();
      }
    }

    function pagoda(g, x, baseY, w, floors, color, lamp) {
      var y = baseY, fw = w;
      g.fillStyle = color;
      g.fillRect(x - w * 0.55, baseY, w * 1.1, w * 0.05);
      for (var f = 0; f < floors; f++) {
        var wallH = fw * 0.3, wallW = fw * 0.7, rw = fw * 0.62, rh = fw * 0.16;
        g.fillStyle = color;
        g.fillRect(x - wallW / 2, y - wallH, wallW, wallH);
        if (lamp) {
          var n = 4, ww = wallW / (n * 2 + 1);
          g.fillStyle = lamp;
          for (var i = 0; i < n; i++) {
            if (Math.random() < 0.3) continue;
            g.fillRect(x - wallW / 2 + ww * (1 + i * 2), y - wallH * 0.78, ww, wallH * 0.5);
          }
          g.fillStyle = color;
        }
        y -= wallH;
        g.beginPath();
        g.moveTo(x - rw, y - rh * 0.3);
        g.quadraticCurveTo(x - rw * 0.7, y + rh * 0.1, x - rw * 0.4, y + rh * 0.05);
        g.lineTo(x + rw * 0.4, y + rh * 0.05);
        g.quadraticCurveTo(x + rw * 0.7, y + rh * 0.1, x + rw, y - rh * 0.3);
        g.quadraticCurveTo(x + rw * 0.55, y - rh * 0.4, x + rw * 0.3, y - rh);
        g.lineTo(x - rw * 0.3, y - rh);
        g.quadraticCurveTo(x - rw * 0.55, y - rh * 0.4, x - rw, y - rh * 0.3);
        g.closePath(); g.fill();
        y -= rh * 0.9;
        fw *= 0.78;
      }
      g.fillRect(x - w * 0.012, y - w * 0.12, w * 0.024, w * 0.12);
    }

    function platform(g, y, x0, x1, color) {
      var th = 7 * S;
      g.fillStyle = color;
      g.fillRect(x0, y, x1 - x0, th);
      g.fillRect(x0, y - 16 * S, x1 - x0, 2.5 * S);
      for (var x = x0; x < x1; x += 22 * S) g.fillRect(x, y - 16 * S, 2.5 * S, 16 * S);
    }

    function buildCastle(list, color, lamp, pillars, platforms) {
      var c = mk(W + pad * 2, H + pad * 2), g = c.getContext("2d"), i;
      g.translate(pad, pad);
      g.fillStyle = color;
      for (i = 0; i < pillars.length; i++) g.fillRect(pillars[i][0] * W, -pad, pillars[i][1] * W, H + pad * 2);
      for (i = 0; i < platforms.length; i++) platform(g, platforms[i][0] * H, platforms[i][1] * W, platforms[i][2] * W, color);
      for (i = 0; i < list.length; i++) {
        var b = list[i];
        if (b[4]) {
          g.save(); g.translate(b[0] * W, b[1] * H); g.scale(1, -1);
          pagoda(g, 0, 0, b[2] * W, b[3], color, lamp);
          g.restore();
        } else {
          pagoda(g, b[0] * W, b[1] * H, b[2] * W, b[3], color, lamp);
        }
      }
      return c;
    }

    function lilySprite(color, glow) {
      var w = Math.round(90 * S), h = Math.round(170 * S), c = mk(w, h), g = c.getContext("2d");
      var cx = w / 2, cy = 45 * S, i, a;
      g.strokeStyle = "#0e1408"; g.lineWidth = 2.2 * S;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, h); g.stroke();
      if (glow) { g.shadowColor = glow; g.shadowBlur = 16 * S; }
      g.strokeStyle = color; g.fillStyle = color; g.lineCap = "round";
      g.lineWidth = 1.1 * S;
      for (i = 0; i < 7; i++) {
        a = -Math.PI / 2 + (i - 3) * 0.33;
        var len = rnd(34, 42) * S, ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
        g.beginPath(); g.moveTo(cx, cy);
        g.quadraticCurveTo(cx + Math.cos(a) * len * 0.5 + (i - 3) * 2 * S, cy + Math.sin(a) * len * 0.6 - 6 * S, ex, ey);
        g.stroke();
        g.beginPath(); g.arc(ex, ey, 1.7 * S, 0, Math.PI * 2); g.fill();
      }
      g.lineWidth = 3.2 * S;
      for (i = 0; i < 6; i++) {
        a = (i / 6) * Math.PI * 2 + rnd(-0.2, 0.2);
        var r = rnd(14, 18) * S;
        var px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.6;
        g.beginPath(); g.moveTo(cx, cy);
        g.quadraticCurveTo(cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * 0.6 - 10 * S, px, py);
        g.quadraticCurveTo(px + Math.cos(a) * 3 * S, py + 6 * S, cx + Math.cos(a) * r * 0.75, py + 4 * S);
        g.stroke();
      }
      return c;
    }

    function newAsh(anywhere) {
      return {
        x: rnd(-0.05, 1.05) * W, y: anywhere ? rnd(0, H) : -10, vy: rnd(15, 40) * S,
        sw: rnd(0.4, 1.2), ph: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-3, 3),
        sz: rnd(1.5, 4.5) * S, light: Math.random() < 0.35, a: rnd(0.3, 0.8)
      };
    }

    function build() {
      var i;
      pad = Math.round(70 * S);
      buildBack();
      far = buildCastle([
        [0.05, 0.58, 0.10, 4, 0], [0.21, 0.02, 0.07, 3, 1], [0.33, 0.66, 0.08, 5, 0], [0.44, 0.0, 0.06, 3, 1],
        [0.86, 0.52, 0.09, 4, 0], [0.95, 0.02, 0.08, 3, 1], [0.78, 0.8, 0.06, 3, 0], [0.5, 0.86, 0.07, 3, 0], [0.13, 0.3, 0.05, 3, 0]
      ], "#2a040b", "rgba(255,80,40,0.35)",
        [[0.15, 0.006], [0.38, 0.005], [0.81, 0.006], [0.9, 0.004]],
        [[0.3, 0, 0.3], [0.62, 0.76, 1], [0.18, 0.8, 1]]);
      near = buildCastle([[0.09, 1.0, 0.2, 5, 0], [0.9, 0.0, 0.18, 4, 1], [0.3, 0.0, 0.1, 3, 1]],
        "#0c0104", "rgba(255,110,50,0.75)", [[0.005, 0.014], [0.982, 0.014]], [[0.24, 0, 0.2]]);

      ground = mk(W, H);
      var g = ground.getContext("2d"), x;
      g.fillStyle = "#050001";
      g.beginPath(); g.moveTo(0, H);
      for (x = 0; x <= W + 8; x += 8) g.lineTo(x, groundY(x / W));
      g.lineTo(W, H); g.closePath(); g.fill();
      g.strokeStyle = "rgba(255,40,40,0.18)"; g.lineWidth = 2 * S;
      g.beginPath();
      for (x = 0; x <= W + 8; x += 8) { if (x === 0) g.moveTo(x, groundY(0)); else g.lineTo(x, groundY(x / W)); }
      g.stroke();

      mistSpr = blobSprite("rgba(170,20,30,0.55)", "rgba(140,10,20,0.2)");
      lilySpr = [
        lilySprite("#d0102a", "rgba(255,30,50,0.45)"), lilySprite("#b80c22", "rgba(255,30,50,0.35)"),
        lilySprite("#e0182e", "rgba(255,40,60,0.5)"), lilySprite("#4fb0ff", "rgba(80,170,255,0.95)")
      ];
      lilies = [];
      for (i = 0; i < 80; i++) {
        var k = rnd(-0.02, 1.02), y = groundY(k) + rnd(0.005, 0.1) * H;
        lilies.push({ x: k * W, y: y, sc: rnd(0.55, 0.9) + (y / H - 0.9) * 5, spr: lilySpr[Math.floor(Math.random() * 3)], ph: rnd(0, 6.28), sp: rnd(0.7, 1.4) });
      }
      for (i = 0; i < 2; i++) {
        var kb = rnd(0.25, 0.75), yb = groundY(kb) + rnd(0.02, 0.05) * H;
        lilies.push({ x: kb * W, y: yb, sc: 1.1, spr: lilySpr[3], ph: rnd(0, 6.28), sp: 0.8 });
      }
      lilies.sort(function (a, b) { return a.y - b.y; });

      ash = [];
      for (i = 0; i < 70; i++) ash.push(newAsh(true));
      mists = [];
      for (i = 0; i < 6; i++) mists.push({ x: rnd(-0.4, 1) * W, y: rnd(0.55, 0.92) * H, w: rnd(0.5, 0.9) * W, h: H * 0.2, v: rnd(-18, 18) * S });
      embers = [];
      eyes = [];
    }

    function heartbeat(t) {
      var ph = t % 1.5;
      return Math.exp(-Math.pow((ph - 0.08) / 0.05, 2)) + 0.65 * Math.exp(-Math.pow((ph - 0.32) / 0.06, 2));
    }

    function drawMoonEye(g, dt) {
      if (eye.delay > 0) eye.delay -= dt;
      eye.blinkT -= dt;
      if (eye.blinkT <= 0) { eye.blink = 0.16; eye.blinkT = rnd(3, 7); }
      if (eye.blink > 0) eye.blink -= dt;
      var target = (eye.delay > 0 || eye.blink > 0) ? 0 : 1;
      eye.open += (target - eye.open) * Math.min(1, dt * (target < eye.open ? 22 : 2.5));

      eye.lookT -= dt;
      if (eye.lookT <= 0) { eye.lookT = rnd(1.2, 3); eye.tx = rnd(-0.3, 0.3); eye.ty = rnd(-0.15, 0.15); }
      eye.lx += (eye.tx - eye.lx) * Math.min(1, dt * 4);
      eye.ly += (eye.ty - eye.ly) * Math.min(1, dt * 4);

      var cx = moon.x, cy = moon.y, ew = moon.r * 0.8, eh = moon.r * 0.42 * eye.open;
      if (eh < 1.5) {
        g.strokeStyle = "rgba(20,0,0,0.9)"; g.lineWidth = 5 * S;
        g.beginPath(); g.moveTo(cx - ew, cy); g.quadraticCurveTo(cx, cy + moon.r * 0.08, cx + ew, cy); g.stroke();
        return;
      }
      g.save();
      almond(g, cx, cy, ew, eh);
      g.fillStyle = "#1a0000"; g.fill();
      g.clip();
      var ix = cx + eye.lx * ew, iy = cy + eye.ly * moon.r, ir = moon.r * 0.36;
      var ig = g.createRadialGradient(ix, iy, 0, ix, iy, ir);
      ig.addColorStop(0, "#fff2a8"); ig.addColorStop(0.35, "#ffb020"); ig.addColorStop(0.75, "#e0301a"); ig.addColorStop(1, "#4a0000");
      g.fillStyle = ig;
      g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(90,0,0,0.5)"; g.lineWidth = 1.5 * S;
      g.beginPath(); g.arc(ix, iy, ir * 0.62, 0, Math.PI * 2); g.stroke();
      g.save();
      g.translate(ix, iy); g.scale(0.12, 1);
      g.fillStyle = "#000";
      g.beginPath(); g.arc(0, 0, ir * 0.88, 0, Math.PI * 2); g.fill();
      g.restore();
      g.restore();
      almond(g, cx, cy, ew, eh);
      g.strokeStyle = "rgba(10,0,0,0.95)"; g.lineWidth = 5 * S; g.stroke();
    }

    function drawEyes(g, dt) {
      eyeTimer -= dt;
      if (eyeTimer <= 0 && eyes.length < 6) {
        eyeTimer = rnd(0.7, 1.8);
        eyes.push({ x: rnd(0.03, 0.97) * W, y: rnd(0.5, 0.86) * H, s: rnd(4, 10) * S, t: 0, max: rnd(2.5, 4.5), blinkAt: rnd(0.9, 2) });
      }
      for (var i = eyes.length - 1; i >= 0; i--) {
        var e = eyes[i];
        e.t += dt;
        if (e.t > e.max) { eyes.splice(i, 1); continue; }
        var a = Math.max(0, Math.min(1, e.t / 0.6, (e.max - e.t) / 0.6));
        var open = Math.abs(e.t - e.blinkAt) < 0.09 ? 0.1 : 1;
        for (var side = -1; side <= 1; side += 2) {
          var ex = e.x + side * e.s * 2.2;
          g.save();
          g.translate(ex, e.y); g.rotate(side * -0.25);
          g.globalCompositeOperation = "lighter";
          g.fillStyle = "rgba(255,30,10," + (0.2 * a).toFixed(3) + ")";
          g.beginPath(); g.arc(0, 0, e.s * 2.6, 0, Math.PI * 2); g.fill();
          g.fillStyle = "rgba(255,190,60," + a.toFixed(3) + ")";
          almond(g, 0, 0, e.s, e.s * 0.4 * open); g.fill();
          g.globalCompositeOperation = "source-over";
          g.fillStyle = "rgba(0,0,0," + a.toFixed(3) + ")";
          g.fillRect(-e.s * 0.09, -e.s * 0.4 * open, e.s * 0.18, e.s * 0.8 * open);
          g.restore();
        }
      }
    }

    function draw(g, dt, t, phaseT) {
      var i, hb = heartbeat(t);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      g.drawImage(back, 0, 0);

      g.globalCompositeOperation = "lighter";
      var mg = g.createRadialGradient(moon.x, moon.y, moon.r, moon.x, moon.y, moon.r * 2.4);
      mg.addColorStop(0, "rgba(255,30,30," + (0.12 + 0.18 * hb).toFixed(3) + ")"); mg.addColorStop(1, "rgba(255,30,30,0)");
      g.fillStyle = mg; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = "source-over";

      drawMoonEye(g, dt);

      g.drawImage(far, -pad + Math.sin(t * 0.07) * 25 * S, -pad + Math.sin(t * 0.05) * 12 * S);

      g.globalAlpha = 0.18;
      for (i = 0; i < 3; i++) {
        var m0 = mists[i];
        g.drawImage(mistSpr, m0.x, m0.y - H * 0.25 - m0.h / 2, m0.w, m0.h);
      }
      g.globalAlpha = 1;

      g.drawImage(near, -pad + Math.sin(t * 0.07 + 1) * 45 * S, -pad + Math.cos(t * 0.06) * 20 * S);

      drawEyes(g, dt);
      g.drawImage(ground, 0, 0);
      drawChar(g, "demon", t, phaseT, 0.2, DEMON_COLOR);

      for (i = 0; i < lilies.length; i++) {
        var l = lilies[i];
        g.save();
        g.translate(l.x, l.y);
        g.rotate(Math.sin(t * l.sp + l.ph) * 0.06);
        g.scale(l.sc, l.sc);
        g.drawImage(l.spr, -l.spr.width / 2, -l.spr.height);
        g.restore();
      }

      g.globalAlpha = 0.3;
      for (i = 0; i < mists.length; i++) {
        var m = mists[i];
        m.x += m.v * dt;
        if (m.x > W) m.x = -m.w; else if (m.x < -m.w) m.x = W;
        g.drawImage(mistSpr, m.x, m.y - m.h / 2, m.w, m.h);
      }
      g.globalAlpha = 1;

      for (i = 0; i < ash.length; i++) {
        var a = ash[i];
        a.y += a.vy * dt;
        a.x += Math.sin(t * a.sw + a.ph) * 25 * S * dt;
        a.rot += a.vr * dt;
        if (a.y > H + 10) { ash[i] = newAsh(false); continue; }
        g.save();
        g.translate(a.x, a.y); g.rotate(a.rot);
        g.fillStyle = a.light ? "rgba(220,190,180," + (a.a * 0.6).toFixed(3) + ")" : "rgba(25,10,10," + a.a.toFixed(3) + ")";
        g.fillRect(-a.sz / 2, -a.sz / 4, a.sz, a.sz / 2);
        g.restore();
      }

      emberAcc = Math.min(5, emberAcc + dt * 14);
      while (emberAcc > 1 && embers.length < 120) {
        emberAcc -= 1;
        embers.push({ x: rnd(0, W), y: H + 10, vy: -rnd(40, 110) * S, ph: rnd(0, 6.28), life: 0, max: rnd(2.5, 6), sz: rnd(1, 2.4) * S });
      }
      g.globalCompositeOperation = "lighter";
      for (i = embers.length - 1; i >= 0; i--) {
        var e = embers[i];
        e.life += dt;
        if (e.life > e.max) { embers.splice(i, 1); continue; }
        var ea = Math.sin((e.life / e.max) * Math.PI);
        e.y += e.vy * dt;
        e.x += Math.sin(t * 1.6 + e.ph) * 25 * S * dt;
        g.fillStyle = rgba(EMBER, 0.14 * ea);
        g.beginPath(); g.arc(e.x, e.y, e.sz * 4, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(255,200,150," + (0.9 * ea).toFixed(3) + ")";
        g.beginPath(); g.arc(e.x, e.y, e.sz, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = "source-over";

      var vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
      vg.addColorStop(0, "rgba(120,0,10,0)");
      vg.addColorStop(1, "rgba(150,0,15," + (0.35 + 0.3 * hb).toFixed(3) + ")");
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }

    return {
      build: build,
      draw: draw,
      enter: function () { eye.open = 0; eye.delay = 0.7; eye.blink = 0; eye.blinkT = rnd(3, 6); }
    };
  })();

  var WORLDS = { slayer: Slayer, demon: Demon };

  /* ---------- Katana ---------- */

  var el = { fill: $("blade-fill"), tip: $("blade-tip"), tipGlow: $("tip-glow"), tsuba: $("tsuba") };
  var accentHex = BREATHS[0].color;

  function setAccent(hex) {
    accentHex = hex;
    var c = hexToRgb(hex);
    setBg(el.fill, "linear-gradient(to right, " + rgba(c, 0.05) + " 0%, " + rgba(c, 0.55) + " 55%, " + rgba(c, 1) + " 92%, #ffffff 100%)");
    el.tsuba.style.borderColor = hex;
    el.tipGlow.style.boxShadow = "0 0 2.5rem 1rem " + rgba(c, 0.8);
  }

  /* ---------- Bascule entre les mondes ---------- */

  var world = "slayer", trans = null, breathIdx = 0, shake = 0, flashAll = 0, sparks = [];
  var phases = { slayer: 0, demon: 0 };

  function startTransition() {
    var to = world === "slayer" ? "demon" : "slayer";
    var ch = nextChar(to);
    if (to === "slayer") enterSlayer(ch);
    else {
      Demon.enter();
      setAccent(DEMON_COLOR);
    }
    phases[to] = 0;
    trans = { from: world, to: to, t: 0 };
    shake = 1;
    flashAll = 0.45;
    Music.switchTo(to);
  }

  function enterSlayer(ch) {
    var b;
    if (ch && ch.color) b = { color: ch.color, effect: ch.effect || "none" };
    else {
      breathIdx = (breathIdx + 1) % BREATHS.length;
      b = BREATHS[breathIdx];
    }
    Slayer.setBreath(b);
    setAccent(b.color);
  }

  function spawnSparks(x0, x1, color, blood) {
    var dx = x1 - x0, dy = H, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = dy / len, ny = -dx / len;
    for (var i = 0; i < (blood ? 7 : 5); i++) {
      var r = Math.random(), sp = rnd(150, 520) * S;
      sparks.push({
        x: x0 + dx * r, y: dy * r,
        vx: nx * sp + rnd(-80, 80) * S, vy: ny * sp + rnd(-220, 40) * S,
        life: 0, max: rnd(0.4, 1), sz: (blood ? rnd(2, 6) : rnd(1, 2.5)) * S,
        grav: (blood ? 1100 : 300) * S, blood: blood, c: color
      });
    }
  }

  function drawSparks(dt) {
    for (var i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.life += dt;
      if (s.life > s.max) { sparks.splice(i, 1); continue; }
      s.vy += s.grav * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      var a = 1 - s.life / s.max;
      if (s.blood) {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(120,0,8," + a.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.sz, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = rgba(s.c, a);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.sz * 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function strokeLine(x0, y0, x1, y1, width, style) {
    ctx.strokeStyle = style; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  function drawTransition(dt, t) {
    trans.t += dt;
    var p = easeInOut(clamp(trans.t / TRANS_TIME, 0, 1));
    WORLDS[trans.from].draw(ctx, dt, t, phases[trans.from]);
    WORLDS[trans.to].draw(bctx, dt, t, phases[trans.to]);

    var sk = W * 0.22, X = -sk + p * (W + 2 * sk), x0 = X + sk, x1 = X - sk;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-5, -5); ctx.lineTo(x0, -5); ctx.lineTo(x1, H + 5); ctx.lineTo(-5, H + 5);
    ctx.closePath(); ctx.clip();
    ctx.drawImage(buf, 0, 0);
    ctx.restore();

    if (p < 1) {
      var toDemon = trans.to === "demon";
      var c = toDemon ? { r: 255, g: 30, b: 40 } : hexToRgb(accentHex);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      strokeLine(x0, 0, x1, H, 46 * S, rgba(c, 0.22));
      strokeLine(x0, 0, x1, H, 14 * S, rgba(c, 0.65));
      strokeLine(x0, 0, x1, H, 4 * S, "rgba(255,255,255,0.95)");
      ctx.globalCompositeOperation = "source-over";
      spawnSparks(x0, x1, c, toDemon);
    }

    if (trans.t >= TRANS_TIME) { world = trans.to; trans = null; }
  }

  /* ---------- Progression ---------- */

  var P;
  function resetProgress() { P = { total: 0, needed: 0, downloaded: 0, stage: 0, target: 0, shown: 0, cap: 97 }; }
  resetProgress();

  function computeTarget() {
    var fileP = 0;
    if (P.total > 0) fileP = clamp(Math.max((P.total - P.needed) / P.total, P.downloaded / P.total), 0, 1);
    var t = Math.max(P.stage, P.total > 0 ? 8 + fileP * 60 : 0);
    if (t > P.target) P.target = Math.min(t, P.cap);
  }

  function onStatus(status) {
    var s = String(status || "");
    for (var i = 0; i < STAGES.length; i++) {
      if (STAGES[i][0].test(s)) { if (STAGES[i][1] > P.stage) P.stage = STAGES[i][1]; break; }
    }
    computeTarget();
  }

  function renderProgress() {
    var p = P.shown;
    el.fill.style.width = p.toFixed(2) + "%";
    el.tip.style.left = (BLADE_LEFT + p / 100 * (100 - BLADE_LEFT)).toFixed(2) + "%";
    el.tipGlow.style.opacity = p > 0.5 ? 1 : 0;
  }

  /* ---------- Musique (fondu entre les mondes) ---------- */

  var Music = {
    started: false, vol: 0.45, cur: "slayer", tracks: {},
    start: function (gmodVol) {
      if (this.started) return;
      this.started = true;
      var m = C.music || {}, self = this, v = (gmodVol === undefined || gmodVol === null || gmodVol === "") ? 1 : +gmodVol;
      this.vol = clamp(v * (C.musicVolume || 0.45), 0, 1);
      this.cur = world;
      var names = ["slayer", "demon"];
      for (var i = 0; i < names.length; i++) {
        if (!m[names[i]]) continue;
        var a = $("music-" + names[i]);
        a.src = m[names[i]];
        a.volume = 0;
        try {
          var pr = a.play();
          if (pr && pr["catch"]) pr["catch"](function () {});
        } catch (e) {}
        this.tracks[names[i]] = a;
      }
      // Les navigateurs classiques bloquent l'autoplay avec son jusqu'au premier clic (GMod non)
      document.onclick = document.onkeydown = function () {
        for (var n in self.tracks) {
          try {
            var pr2 = self.tracks[n].play();
            if (pr2 && pr2["catch"]) pr2["catch"](function () {});
          } catch (e) {}
        }
      };
      setInterval(function () {
        for (var n in self.tracks) {
          var tr = self.tracks[n], other = n === "slayer" ? "demon" : "slayer";
          var goal = (n === self.cur || !self.tracks[other]) ? self.vol : 0;
          tr.volume = clamp(tr.volume + clamp(goal - tr.volume, -self.vol / 12, self.vol / 12), 0, 1);
        }
      }, 100);
    },
    switchTo: function (w) { this.cur = w; }
  };

  /* ---------- API appelée par Garry's Mod ---------- */

  var real = false;
  function markReal() {
    if (real) return;
    real = true;
    Demo.stop();
    resetProgress();
  }

  window.GameDetails = function (servername, serverurl, mapname, maxplayers, steamid, gamemode, volume) {
    markReal(); Music.start(volume);
  };
  window.SetStatusChanged = function (status) { markReal(); onStatus(status); };
  window.SetFilesTotal = function (n) { markReal(); P.total = +n || 0; computeTarget(); };
  window.SetFilesNeeded = function (n) { markReal(); P.needed = +n || 0; computeTarget(); };
  window.DownloadingFile = function () { markReal(); P.downloaded++; computeTarget(); };

  /* ---------- Mode démo (aperçu dans un navigateur) ---------- */

  var Demo = {
    timers: [],
    stop: function () { for (var i = 0; i < this.timers.length; i++) clearTimeout(this.timers[i]); this.timers = []; },
    start: function () {
      var self = this, N = 60;
      self.stop();
      resetProgress();
      function at(ms, fn) { self.timers.push(setTimeout(fn, ms)); }
      at(0, function () { Music.start(1); onStatus("Retrieving server info..."); });
      at(1600, function () { onStatus("Mounting Addons"); });
      at(2400, function () { P.total = N; P.needed = N; computeTarget(); });
      for (var i = 0; i < N; i++) {
        (function (i) { at(2800 + i * 160, function () { P.downloaded++; P.needed = N - i - 1; computeTarget(); }); })(i);
      }
      at(12500, function () { onStatus("Workshop Complete"); });
      at(14000, function () { onStatus("Sending client info..."); });
      at(16000, function () { onStatus("Client info sent!"); });
      at(18000, function () { onStatus("Received all Lua files we needed!"); });
      at(20000, function () { onStatus("Starting Lua..."); });
      at(22500, function () { P.cap = 100; P.stage = 100; P.target = 100; });
      at(32000, function () { self.start(); });
    }
  };

  /* ---------- Démarrage ---------- */

  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.width = buf.width = Math.round(window.innerWidth * dpr);
    H = cv.height = buf.height = Math.round(window.innerHeight * dpr);
    S = H / 1080;
    moon.x = W * 0.64; moon.y = H * 0.44; moon.r = H * 0.2;
    for (var n in Chars) {
      if (!Chars[n].length) continue;
      for (var i = 0; i < Chars[n].length; i++) Chars[n][i].cache = null;
    }
    Slayer.build();
    Demon.build();
  }

  fitRem();
  resize();
  var resizeTimer = null;
  window.onresize = function () {
    fitRem();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  };

  breathIdx = -1;
  enterSlayer(nextChar("slayer"));

  if (queryParam("demo")) Demo.start();
  else setTimeout(function () { if (!real) Demo.start(); }, 1800);

  var last = now(), shaking = false;
  (function loop() {
    var t = now(), dt = Math.min(0.1, (t - last) / 1000), ts = t / 1000;
    last = t;

    if (P.target < P.cap) P.target = Math.min(P.cap, P.target + dt * 0.22);
    P.shown += (P.target - P.shown) * Math.min(1, dt * 2.5);
    renderProgress();

    phases[world] += dt;
    if (trans) phases[trans.to] += dt;
    if (!trans && phases[world] > DURATION[world]) startTransition();

    if (trans) drawTransition(dt, ts);
    else WORLDS[world].draw(ctx, dt, ts, phases[world]);
    drawSparks(dt);

    if (flashAll > 0.01) {
      ctx.fillStyle = "rgba(255,255,255," + (flashAll * 0.35).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
      flashAll -= dt * 2.5;
    }

    if (shake > 0) {
      var m = shake * 14 * S;
      setTransform(cv, "translate(" + rnd(-m, m).toFixed(1) + "px," + rnd(-m, m).toFixed(1) + "px) scale(1.03)");
      shake -= dt * 2.2;
      shaking = true;
    } else if (shaking) {
      setTransform(cv, "none");
      shaking = false;
    }

    raf(loop);
  })();
})();

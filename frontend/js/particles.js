// =============================================================
// Floating particle network — login left panel
// White/blue dots drifting upward + connecting lines
// =============================================================
function initParticules() {
  var canvas = document.getElementById("loginCanvas");
  if (!canvas) return;

  var ctx = canvas.getContext("2d");
  var w, h, pts;
  var COUNT = 70;
  var MAX_DIST = 160;

  function resize() {
    var r = canvas.parentElement.getBoundingClientRect();
    w = canvas.width = r.width;
    h = canvas.height = r.height;
  }

  function create() {
    pts = [];
    for (var i = 0; i < COUNT; i++) {
      pts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -(Math.random() * 0.7 + 0.15),
        r: Math.random() * 2.2 + 0.6,
        o: Math.random() * 0.6 + 0.25,
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    var t = Date.now() * 0.001;

    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.pulse += 0.035;

      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      var alpha = p.o * (0.5 + 0.5 * Math.sin(p.pulse));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(47,111,94," + alpha + ")";
      ctx.fill();
    }

    for (var i = 0; i < pts.length; i++) {
      for (var j = i + 1; j < pts.length; j++) {
        var dx = pts[i].x - pts[j].x;
        var dy = pts[i].y - pts[j].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < MAX_DIST) {
          var alpha = (1 - d / MAX_DIST) * 0.18;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = "rgba(74,155,143," + alpha + ")";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", function() { resize(); create(); });
  resize();
  create();
  draw();
}

window.addEventListener("load", initParticules);

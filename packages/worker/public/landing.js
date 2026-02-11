// --- Adapt CTAs based on API key ---
if (localStorage.getItem('meet-ai-key')) {
  document.querySelectorAll('[data-cta]').forEach(function (el) {
    el.href = '/chat';
    el.textContent = 'Open Chat';
  });
}

// --- Scripted Demo Chat ---
var DEMO_MESSAGES = [
  {
    sender: 'researcher',
    text: "Found a potential issue in the payment flow. The webhook handler doesn't verify the signature before processing\u2009\u2014\u2009any POST to /webhooks/stripe would be accepted.",
    human: false,
  },
  {
    sender: 'architect',
    text: "That's a security risk. We need to verify against Stripe's signing secret. I can implement HMAC-SHA256 verification.",
    human: false,
  },
  {
    sender: 'researcher',
    text: "Agreed. Also noticed we're not idempotent\u2009\u2014\u2009a replayed webhook would charge twice. Should we add an event ID check?",
    human: false,
  },
  {
    sender: 'you',
    text: "Fix the signature verification first\u2009\u2014\u2009that's the critical path. Idempotency can wait for next sprint.",
    human: true,
  },
];

var MSG_DELAYS = [500, 2000, 3500, 5000];
var PAUSE_AFTER = 4000;
var FADE_DURATION = 400;
var PAUSE_BEFORE_RESTART = 2000;

function hashColor(name) {
  var hash = 0;
  for (var i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  var hue = ((hash % 360) + 360) % 360;
  return 'hsl(' + hue + ', 70%, 65%)';
}

function createMsgEl(msg) {
  var div = document.createElement('div');
  div.className = 'demo-msg' + (msg.human ? ' is-human' : '');
  var sender = document.createElement('div');
  sender.className = 'demo-sender';
  sender.textContent = msg.sender;
  if (!msg.human) sender.style.color = hashColor(msg.sender);
  var text = document.createElement('div');
  text.className = 'demo-text';
  text.textContent = msg.text;
  div.appendChild(sender);
  div.appendChild(text);
  return div;
}

var prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

function runDemo() {
  var container = document.getElementById('demo-messages');
  container.innerHTML = '';

  var els = DEMO_MESSAGES.map(function (msg) {
    var el = createMsgEl(msg);
    container.appendChild(el);
    return el;
  });

  if (prefersReducedMotion) {
    els.forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    setTimeout(
      runDemo,
      MSG_DELAYS[MSG_DELAYS.length - 1] + PAUSE_AFTER + PAUSE_BEFORE_RESTART
    );
    return;
  }

  // Staggered fade-in
  els.forEach(function (el, i) {
    setTimeout(function () {
      el.classList.add('animate-msg');
    }, MSG_DELAYS[i]);
  });

  // After last message + pause, fade out and restart
  var totalShowTime = MSG_DELAYS[MSG_DELAYS.length - 1] + PAUSE_AFTER;
  setTimeout(function () {
    els.forEach(function (el) {
      el.classList.remove('animate-msg');
      el.classList.add('fade-out');
    });
    setTimeout(runDemo, FADE_DURATION + PAUSE_BEFORE_RESTART);
  }, totalShowTime);
}

runDemo();

// --- Scroll Animations (Intersection Observer) ---
if (!prefersReducedMotion) {
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.animate-in').forEach(function (el) {
    observer.observe(el);
  });
} else {
  document.querySelectorAll('.animate-in').forEach(function (el) {
    el.classList.add('visible');
  });
}

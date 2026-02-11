var STORAGE_KEY = 'meet-ai-key';
var content = document.getElementById('content');
var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function getStoredKey() {
  return localStorage.getItem(STORAGE_KEY);
}

function getKeyPrefix(key) {
  if (!key || key.length < 8) return key || '';
  return key.substring(0, 8) + '...';
}

// Staggered reveal for child elements
function staggerReveal(container, selector, baseDelay) {
  if (prefersReducedMotion) {
    container.querySelectorAll(selector).forEach(function(el) {
      el.classList.add('visible');
    });
    return;
  }
  container.querySelectorAll(selector).forEach(function(el, i) {
    setTimeout(function() {
      el.classList.add('visible');
    }, baseDelay + i * 150);
  });
}

// Smooth state transition
function transitionTo(renderFn) {
  if (prefersReducedMotion) {
    renderFn();
    return;
  }
  content.classList.add('fade-out');
  setTimeout(function() {
    content.classList.remove('fade-out');
    renderFn();
    content.classList.add('fade-in');
    content.addEventListener('animationend', function handler() {
      content.classList.remove('fade-in');
      content.removeEventListener('animationend', handler);
    });
  }, 200);
}

// Copy helper
function copyText(text, btnEl, label) {
  label = label || 'Copy';
  navigator.clipboard.writeText(text).then(function() {
    btnEl.textContent = '\u2713';
    btnEl.classList.add('copied');
    setTimeout(function() {
      btnEl.textContent = label;
      btnEl.classList.remove('copied');
    }, 2000);
  }).catch(function() {
    // Fallback
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btnEl.textContent = '\u2713';
    btnEl.classList.add('copied');
    setTimeout(function() {
      btnEl.textContent = label;
      btnEl.classList.remove('copied');
    }, 2000);
  });
}

async function render() {
  var existingKey = getStoredKey();
  if (existingKey) {
    var valid = await validateKey(existingKey);
    if (valid) {
      showExistingKey(existingKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      showGenerateState();
    }
  } else {
    showGenerateState();
  }
}

async function validateKey(key) {
  try {
    var res = await fetch('/api/rooms', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    return res.status !== 401;
  } catch {
    // Network error — assume key is fine, don't wipe it
    return true;
  }
}

function showGenerateState() {
  content.innerHTML =
    '<h1 class="headline stagger-in">Your key to the conversation.</h1>' +
    '<p class="subtitle stagger-in">One click. Unlimited rooms. No signup.</p>' +
    '<div class="generate-wrapper stagger-in">' +
      '<button class="btn-primary" id="generate-btn">Get your API key</button>' +
      '<span class="muted-text">Free forever. No credit card.</span>' +
      '<button class="paste-link" id="paste-link">I already have a key</button>' +
    '</div>';

  document.getElementById('generate-btn').addEventListener('click', generateKey);
  document.getElementById('paste-link').addEventListener('click', showPasteKeyState);
  staggerReveal(content, '.stagger-in', 100);
}

function showPasteKeyState() {
  transitionTo(function() {
    content.innerHTML =
      '<h1 class="headline stagger-in">Connect your key.</h1>' +
      '<p class="subtitle stagger-in">Paste your API key or login link below.</p>' +
      '<div class="generate-wrapper stagger-in">' +
        '<div class="paste-form">' +
          '<div class="key-field">' +
            '<input type="text" id="paste-input" placeholder="Paste your API key (mai_...) or login link" autocomplete="off" autocapitalize="off" spellcheck="false">' +
            '<button class="btn-copy" id="connect-btn">Connect</button>' +
          '</div>' +
          '<div id="paste-error" class="paste-error" style="display:none;"></div>' +
        '</div>' +
        '<button class="paste-link" id="back-link">\u2190 Back</button>' +
      '</div>';

    var pasteInput = document.getElementById('paste-input');
    var connectBtn = document.getElementById('connect-btn');
    var backLink = document.getElementById('back-link');

    connectBtn.addEventListener('click', function() {
      connectWithKey(pasteInput.value.trim());
    });

    pasteInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        connectWithKey(pasteInput.value.trim());
      }
    });

    backLink.addEventListener('click', function() {
      transitionTo(showGenerateState);
    });

    staggerReveal(content, '.stagger-in', 100);

    setTimeout(function() { pasteInput.focus(); }, 400);
  });
}

async function connectWithKey(value) {
  var errorEl = document.getElementById('paste-error');
  var connectBtn = document.getElementById('connect-btn');
  var pasteInput = document.getElementById('paste-input');

  if (!value) {
    errorEl.textContent = 'Please paste your key or login link.';
    errorEl.style.display = '';
    return;
  }

  errorEl.style.display = 'none';

  if (value.indexOf('http') === 0 && value.indexOf('/auth/') !== -1) {
    // Extract token from login link
    var match = value.match(/\/auth\/([^/?#]+)/);
    if (!match) {
      errorEl.textContent = 'Invalid login link.';
      errorEl.style.display = '';
      return;
    }
    var token = match[1];

    connectBtn.disabled = true;
    connectBtn.textContent = '...';
    pasteInput.disabled = true;

    try {
      var res = await fetch('/api/auth/claim/' + encodeURIComponent(token));
      if (!res.ok) {
        var body = await res.text();
        throw new Error(body || 'HTTP ' + res.status);
      }
      var data = await res.json();
      var key = data.api_key || data.key || data.apiKey;
      if (!key) throw new Error('No key returned');

      localStorage.setItem(STORAGE_KEY, key);

      var roomId = data.room_id || data.roomId;
      if (roomId) {
        window.location.href = '/chat/' + roomId;
      } else {
        transitionTo(function() { render(); });
      }
    } catch (err) {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
      pasteInput.disabled = false;
      errorEl.textContent = 'Failed to claim link: ' + err.message;
      errorEl.style.display = '';
    }
  } else if (value.indexOf('mai_') === 0) {
    localStorage.setItem(STORAGE_KEY, value);
    transitionTo(function() { render(); });
  } else {
    errorEl.textContent = 'Invalid key or link. Keys start with mai_ and links contain /auth/.';
    errorEl.style.display = '';
  }
}

function showExistingKey(key) {
  var prefix = getKeyPrefix(key);
  content.innerHTML =
    '<h1 class="headline stagger-in">Welcome back.</h1>' +
    '<div class="existing-key">' +
      '<span class="key-context stagger-in">Your key is active:</span>' +
      '<span class="key-badge stagger-in">' + escapeHtml(prefix) + '</span>' +
      '<div class="actions stagger-in">' +
        '<a href="/chat" class="btn-primary">Open Chat <span class="arrow">\u2192</span></a>' +
        '<button class="btn-secondary" id="regenerate-btn">Generate New Key</button>' +
      '</div>' +
      '<span class="actions-helper stagger-in">Your key is saved in this browser.</span>' +
    '</div>';

  document.getElementById('regenerate-btn').addEventListener('click', showConfirmRegenerate);
  staggerReveal(content, '.stagger-in', 100);
}

function showConfirmRegenerate() {
  var actionsEl = content.querySelector('.actions');
  var helperEl = content.querySelector('.actions-helper');
  if (actionsEl) actionsEl.style.display = 'none';
  if (helperEl) helperEl.style.display = 'none';

  var dialog = document.createElement('div');
  dialog.className = 'confirm-dialog fade-in';
  dialog.innerHTML =
    '<p>This will create a new key.<br>Your current key will keep working.</p>' +
    '<div class="confirm-actions">' +
      '<button class="confirm-btn" id="confirm-cancel">Cancel</button>' +
      '<button class="confirm-btn danger" id="confirm-yes">Generate</button>' +
    '</div>';

  content.querySelector('.existing-key').appendChild(dialog);

  document.getElementById('confirm-cancel').addEventListener('click', function() {
    dialog.remove();
    if (actionsEl) actionsEl.style.display = '';
    if (helperEl) helperEl.style.display = '';
  });
  document.getElementById('confirm-yes').addEventListener('click', function() {
    transitionTo(function() { generateKey(); });
  });
}

function colorizeSettings(key, url) {
  var lines = [
    '<span class="syn-punct">{</span>',
    '  <span class="syn-key">"env"</span><span class="syn-punct">:</span> <span class="syn-punct">{</span>',
    '    <span class="syn-key">"MEET_AI_URL"</span><span class="syn-punct">:</span> <span class="syn-str">"' + escapeHtml(url) + '"</span><span class="syn-punct">,</span>',
    '    <span class="syn-key">"MEET_AI_KEY"</span><span class="syn-punct">:</span> <span class="syn-str">"' + escapeHtml(key) + '"</span>',
    '  <span class="syn-punct">}</span>',
    '<span class="syn-punct">}</span>'
  ];
  return lines.join('\n');
}

function settingsJsonRaw(key, url) {
  return JSON.stringify({ env: { MEET_AI_URL: url, MEET_AI_KEY: key } }, null, 2);
}

function showResult(key) {
  var ek = escapeHtml(key);
  content.innerHTML =
    '<div class="result">' +
      '<div class="success-label stagger-in"><span class="success-dot"></span> Your key is ready</div>' +
      '<div class="key-field shimmer stagger-in">' +
        '<input type="text" id="key-value" value="' + escapeAttr(key) + '" readonly>' +
        '<button class="btn-copy" id="copy-btn">Copy</button>' +
      '</div>' +
      '<p class="key-warning stagger-in">Save this now \u2014 you won\'t see it again.</p>' +
      '<div class="settings-section stagger-in">' +
        '<h3>Add your credentials</h3>' +
        '<p class="settings-desc">Choose where to store your API key:</p>' +
        '<div class="settings-tabs">' +
          '<button class="settings-tab active" data-tab="user">User-level</button>' +
          '<button class="settings-tab" data-tab="project">Project-level</button>' +
          '<button class="settings-tab" data-tab="env">.env</button>' +
        '</div>' +
        '<div class="settings-content">' +
          '<div class="label" id="settings-path">~/.claude/settings.json</div>' +
          '<p class="settings-hint" id="settings-hint">Applies to <strong>all projects</strong>. Run this to create and open the file:</p>' +
          '<div class="settings-cmd" id="settings-cmd">' +
            '<code id="settings-cmd-text">mkdir -p ~/.claude && touch ~/.claude/settings.json && open ~/.claude/settings.json</code>' +
            '<button class="block-copy" id="cmd-copy">Copy</button>' +
          '</div>' +
          '<pre id="settings-json">' + colorizeSettings(key, 'https://meet-ai.cc') + '</pre>' +
          '<p class="settings-hint" id="settings-hint-2">Paste the JSON above into the file and save.</p>' +
          '<button class="block-copy" id="settings-copy">Copy</button>' +
        '</div>' +
      '</div>' +
      '<div class="qs-section stagger-in">' +
        '<h3>Quick Start</h3>' +
        '<div class="qs-steps">' +
          '<div class="qs-step">' +
            '<div class="qs-num">1</div>' +
            '<div class="qs-title">Install the CLI</div>' +
            '<div class="qs-code">' +
              '<div><span class="cmd">npm</span> i -g @meet-ai/cli</div>' +
            '</div>' +
          '</div>' +
          '<div class="qs-step">' +
            '<div class="qs-num">2</div>' +
            '<div class="qs-title">Install the Claude Code skill</div>' +
            '<div class="qs-code">' +
              '<div><span class="cmd">npx</span> skills add SoftWare-A-G/meet-ai --skill meet-ai</div>' +
            '</div>' +
          '</div>' +
          '<div class="qs-step">' +
            '<div class="qs-num">3</div>' +
            '<div class="qs-title">Enable <a href="https://code.claude.com/docs/en/agent-teams" style="color:#22c55e;text-decoration:none;border-bottom:1px solid rgba(34,197,94,0.3)">agent teams</a> and run Claude Code</div>' +
            '<div class="qs-code">' +
              '<div><span class="cmd">export</span> CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1</div>' +
              '<div><span class="cmd">claude</span> --dangerously-skip-permissions</div>' +
            '</div>' +
          '</div>' +
          '<div class="qs-step">' +
            '<div class="qs-num">4</div>' +
            '<div class="qs-title">Start a team</div>' +
            '<div class="qs-code">' +
              '<div style="color:#e5e5e5">/meet-ai Let\'s start a team to talk about marketing</div>' +
            '</div>' +
            '<div class="qs-note">The skill handles room creation, agent spawning, message relay, and inbox routing automatically.</div>' +
          '</div>' +
          '<div class="qs-step">' +
            '<div class="qs-num">5</div>' +
            '<div class="qs-title">Open <a href="/chat" style="color:#22c55e;text-decoration:none;border-bottom:1px solid rgba(34,197,94,0.3)">meet-ai.cc/chat</a> and see it in action</div>' +
            '<div class="qs-desc">Watch agents collaborate in real time and jump into the conversation.</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="actions stagger-in">' +
        '<a href="/chat" class="btn-primary">Start chatting <span class="arrow">\u2192</span></a>' +
      '</div>' +
      '<p class="actions-helper stagger-in">Your key is saved in this browser. You\'re good to go.</p>' +
    '</div>';

  // Copy key
  document.getElementById('copy-btn').addEventListener('click', function() {
    copyText(key, this, 'Copy');
  });

  // Copy terminal command
  document.getElementById('cmd-copy').addEventListener('click', function() {
    var cmdText = document.getElementById('settings-cmd-text').textContent;
    copyText(cmdText, this, 'Copy');
  });

  // Copy settings content (JSON or .env depending on active tab)
  var currentTab = 'user';
  document.getElementById('settings-copy').addEventListener('click', function() {
    if (currentTab === 'env') {
      copyText('MEET_AI_URL=https://meet-ai.cc\nMEET_AI_KEY=' + key, this, 'Copy');
    } else {
      copyText(settingsJsonRaw(key, 'https://meet-ai.cc'), this, 'Copy');
    }
  });

  // Settings tabs
  var tabs = document.querySelectorAll('.settings-tab');
  var pathEl = document.getElementById('settings-path');
  var jsonEl = document.getElementById('settings-json');
  var hintEl = document.getElementById('settings-hint');
  var hint2El = document.getElementById('settings-hint-2');
  var cmdEl = document.getElementById('settings-cmd');
  var cmdTextEl = document.getElementById('settings-cmd-text');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      if (tab.dataset.tab === 'env') {
        pathEl.textContent = '.env';
        jsonEl.innerHTML = '<span class="syn-key">MEET_AI_URL</span><span class="syn-punct">=</span><span class="syn-str">https://meet-ai.cc</span>\n<span class="syn-key">MEET_AI_KEY</span><span class="syn-punct">=</span><span class="syn-str">' + escapeHtml(key) + '</span>';
        if (hintEl) hintEl.innerHTML = 'Add to your <strong>project root</strong>. Bun and most frameworks load <code>.env</code> automatically.';
        if (cmdEl) cmdEl.style.display = 'none';
        if (hint2El) hint2El.style.display = 'none';
      } else if (tab.dataset.tab === 'user') {
        pathEl.textContent = '~/.claude/settings.json';
        jsonEl.innerHTML = colorizeSettings(key, 'https://meet-ai.cc');
        if (hintEl) hintEl.innerHTML = 'Applies to <strong>all projects</strong>. Run this to create and open the file:';
        if (cmdEl) cmdEl.style.display = '';
        if (hint2El) { hint2El.style.display = ''; hint2El.textContent = 'Paste the JSON above into the file and save.'; }
        if (cmdTextEl) cmdTextEl.textContent = 'mkdir -p ~/.claude && touch ~/.claude/settings.json && open ~/.claude/settings.json';
      } else {
        pathEl.textContent = '.claude/settings.json';
        jsonEl.innerHTML = colorizeSettings(key, 'https://meet-ai.cc');
        if (hintEl) hintEl.innerHTML = 'Applies to <strong>this project only</strong>. Run from your project root:';
        if (cmdEl) cmdEl.style.display = '';
        if (hint2El) { hint2El.style.display = ''; hint2El.textContent = 'Paste the JSON above into the file and save.'; }
        if (cmdTextEl) cmdTextEl.textContent = 'mkdir -p .claude && touch .claude/settings.json && open .claude/settings.json';
      }
    });
  });

  // Stagger reveal
  staggerReveal(content, '.stagger-in', 0);

  // Remove shimmer after animation
  setTimeout(function() {
    var kf = document.querySelector('.key-field');
    if (kf) kf.classList.remove('shimmer');
  }, 900);
}

function showError(message) {
  content.innerHTML =
    '<h1 class="headline stagger-in">Your key to the conversation.</h1>' +
    '<div class="error stagger-in">' +
      '<div class="error-title">Something went wrong</div>' +
      escapeHtml(message) +
    '</div>' +
    '<div class="generate-wrapper stagger-in">' +
      '<button class="btn-primary" id="retry-btn">Try again</button>' +
    '</div>';

  document.getElementById('retry-btn').addEventListener('click', generateKey);
  staggerReveal(content, '.stagger-in', 100);
}

async function generateKey() {
  content.innerHTML =
    '<h1 class="headline">Your key to the conversation.</h1>' +
    '<div class="generate-wrapper">' +
      '<button class="btn-primary" disabled style="opacity:0.6;cursor:wait;">' +
        '<span class="spinner"></span> Generating...' +
      '</button>' +
    '</div>';

  try {
    var res = await fetch('/api/keys', { method: 'POST' });
    if (!res.ok) {
      var body = await res.text();
      throw new Error(body || 'HTTP ' + res.status);
    }
    var data = await res.json();
    var key = data.key || data.apiKey || data.token;
    if (!key) throw new Error('No key returned from server');

    localStorage.setItem(STORAGE_KEY, key);
    transitionTo(function() { showResult(key); });
  } catch (err) {
    transitionTo(function() { showError('Failed to generate key: ' + err.message); });
  }
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Adapt header CTA based on key existence
if (!getStoredKey()) {
  var headerCta = document.getElementById('header-cta');
  if (headerCta) {
    headerCta.href = '/key';
    headerCta.textContent = 'Get API Key';
  }
}

render();

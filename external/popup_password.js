// popup_password.js
// Temporary password popup for page load (deprecate when no longer needed)

(function() {
  // Option 2: Remember password in browser memory (localStorage)
  const PASSWORD_KEY = 'flyoverdemo_password_ok';
  const PASSWORD_VALUE = 'NEWBS';
  try {
    if (localStorage.getItem(PASSWORD_KEY) === '1') {
      // Already entered, skip popup
      return;
    }
  } catch {}

  // Create overlay (dark background)
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.7)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = 2147483647;

  // Create white filter layer (semi-transparent)
  const whiteFilter = document.createElement('div');
  whiteFilter.style.position = 'absolute';
  whiteFilter.style.top = 0;
  whiteFilter.style.left = 0;
  whiteFilter.style.width = '100vw';
  whiteFilter.style.height = '100vh';
  whiteFilter.style.background = 'rgba(255,255,255,0.45)';
  whiteFilter.style.zIndex = 1;
  overlay.appendChild(whiteFilter);

  // Create popup box
  const box = document.createElement('div');
  box.style.background = '#fff';
  box.style.padding = '2em';
  box.style.borderRadius = '8px';
  box.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)';
  box.style.textAlign = 'center';
  box.style.position = 'relative';
  box.style.zIndex = 2;

  // Message
  const msg = document.createElement('div');
  msg.textContent = 'Enter password to continue:';
  msg.style.marginBottom = '1em';
  box.appendChild(msg);

  // Input
  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = 'Password';
  input.style.marginBottom = '1em';
  input.style.width = '100%';
  input.style.padding = '0.5em';
  box.appendChild(input);

  // Error message
  const error = document.createElement('div');
  error.style.color = 'red';
  error.style.margin = '0.5em 0';
  error.style.display = 'none';
  error.textContent = 'Incorrect password.';
  box.appendChild(error);

  // Button
  const btn = document.createElement('button');
  btn.textContent = 'Submit';
  btn.style.marginTop = '1em';
  btn.onclick = function() {
    if (input.value === PASSWORD_VALUE) {
      // Remember password in localStorage
      try { localStorage.setItem(PASSWORD_KEY, '1'); } catch {}
      // Remove overlay and all children
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      document.body.style.pointerEvents = '';
    } else {
      error.style.display = 'block';
      input.value = '';
      input.focus();
    }
  };
  box.appendChild(btn);

  // Enter key support
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') btn.click();
  });

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  input.focus();
})();

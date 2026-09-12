/* PinOnIt booking embed — drop-in widget for host websites.
   Usage:
     <div id="pinonit-booking"></div>
     <script src="https://pinonit.com/embed.js" data-slug="your-username" defer></script>
   Optional popup button:
     <button data-pinonit="your-username">Book a meeting</button>
*/
(function () {
  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if ((scripts[i].src || '').indexOf('/embed.js') !== -1) {
        script = scripts[i];
        break;
      }
    }
  }
  if (!script) return;

  var slug = (script.getAttribute('data-slug') || '').replace(/^\/+|\/+$/g, '');
  if (!slug) return;

  var origin = (script.src || '').replace(/\/embed\.js(?:\?.*)?$/i, '') || 'https://pinonit.com';
  var bookingUrl = origin + '/' + encodeURIComponent(slug);

  function makeIframe() {
    var iframe = document.createElement('iframe');
    iframe.src = bookingUrl;
    iframe.title = 'Book with PinOnIt';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    iframe.style.cssText = 'width:100%;min-height:700px;border:0;border-radius:12px;display:block;background:#fff;';
    return iframe;
  }

  function mountInline() {
    var host = document.getElementById('pinonit-booking');
    if (!host || host.getAttribute('data-pinonit-mounted') === '1') return;
    host.setAttribute('data-pinonit-mounted', '1');
    host.appendChild(makeIframe());
  }

  function closePopup(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.documentElement.style.overflow = '';
  }

  function openPopup() {
    if (document.getElementById('pinonit-embed-overlay')) return;
    var overlay = document.createElement('div');
    overlay.id = 'pinonit-embed-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,0.62);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

    var panel = document.createElement('div');
    panel.style.cssText =
      'position:relative;width:min(480px,100%);max-height:calc(100vh - 32px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 64px rgba(15,23,42,0.28);';

    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close booking');
    close.textContent = '\u00d7';
    close.style.cssText =
      'position:absolute;top:8px;right:10px;z-index:2;width:36px;height:36px;border:0;border-radius:999px;background:#fff;color:#334155;font-size:24px;line-height:36px;cursor:pointer;box-shadow:0 1px 4px rgba(15,23,42,0.12);';
    close.onclick = function () { closePopup(overlay); };

    var iframe = makeIframe();
    iframe.style.minHeight = 'min(720px, calc(100vh - 32px))';
    iframe.style.height = 'min(720px, calc(100vh - 32px))';
    iframe.style.borderRadius = '16px';

    panel.appendChild(close);
    panel.appendChild(iframe);
    overlay.appendChild(panel);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closePopup(overlay);
    });
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';
  }

  function bindButtons() {
    var nodes = document.querySelectorAll('[data-pinonit]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute('data-pinonit-bound') === '1') continue;
      var value = el.getAttribute('data-pinonit') || '';
      if (value && value !== slug) continue;
      el.setAttribute('data-pinonit-bound', '1');
      el.addEventListener('click', function (event) {
        event.preventDefault();
        openPopup();
      });
    }
  }

  function init() {
    mountInline();
    bindButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

(function () {
  'use strict';
  document.querySelectorAll('.footer-year').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('itm-theme', next); } catch (e) {}
    });
  }
})();

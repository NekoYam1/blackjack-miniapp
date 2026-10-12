// Модуль полноэкранного режима. Подключается ДО app.js и даёт глобальный объект window.FS.
// Вне Telegram (обычный браузер) ничего не ломает: FS.supported === false.
(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  const atLeast = (v) => !!(tg && tg.isVersionAtLeast && tg.isVersionAtLeast(v));

  const FS = {
    tg,
    inTelegram: !!tg,
    supported: atLeast("8.0"),      // requestFullscreen появился в Mini App API 8.0
    lastError: null,
    get isOn() { return !!(tg && tg.isFullscreen); },
    enter() { if (FS.supported && !FS.isOn) tg.requestFullscreen(); },
    exit()  { if (FS.supported && FS.isOn) tg.exitFullscreen(); },
    toggle() { FS.isOn ? FS.exit() : FS.enter(); },
    onChange(cb) {
      if (!tg) return;
      ["fullscreenChanged", "fullscreenFailed", "safeAreaChanged", "contentSafeAreaChanged"]
        .forEach((name) => tg.onEvent(name, cb));
    },
  };
  window.FS = FS;

  if (!tg) return;

  tg.ready();
  tg.expand();                                          // запасной вариант: хотя бы на всю высоту окна
  if (atLeast("7.7")) tg.disableVerticalSwipes();       // иначе свайп вниз сворачивает апп

  tg.onEvent("fullscreenFailed", (e) => { FS.lastError = (e && e.error) || "UNKNOWN"; });
  tg.onEvent("fullscreenChanged", () => { FS.lastError = null; });

  FS.enter();                                           // сразу просим полный экран
})();

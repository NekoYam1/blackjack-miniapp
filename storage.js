// Сохранение фишек и статистики.
// В Telegram (API 6.9+) используется CloudStorage: данные привязаны к аккаунту и видны с любого устройства.
// Вне Telegram и как запасной вариант: localStorage.
// Это игровые фишки без реальной стоимости, поэтому подделка значения в браузере ни на что не влияет.

const KEY = "blackjack:v1";
const tg = window.Telegram && window.Telegram.WebApp;
const cloud = tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9") ? tg.CloudStorage : null;

function fromLocal() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

export function load() {
  return new Promise((resolve) => {
    if (!cloud) return resolve(fromLocal());
    const timer = setTimeout(() => resolve(fromLocal()), 2500); // если Telegram не ответил
    cloud.getItem(KEY, (err, value) => {
      clearTimeout(timer);
      if (err || !value) return resolve(fromLocal());
      try { resolve(JSON.parse(value)); } catch { resolve(fromLocal()); }
    });
  });
}

let timer = null;
export function save(data) {
  const json = JSON.stringify(data);
  try { localStorage.setItem(KEY, json); } catch { /* приватный режим */ }
  if (!cloud) return;
  clearTimeout(timer);
  timer = setTimeout(() => cloud.setItem(KEY, json, () => {}), 300); // не чаще раза в 300 мс
}

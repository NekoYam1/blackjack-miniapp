// Связывает игру, интерфейс и сохранение. Запускается как ES-модуль.
import { Game, START_CHIPS, MIN_BET } from "./game.js";
import { load, save } from "./storage.js";
import { createUI } from "./ui.js";

const tg = window.Telegram && window.Telegram.WebApp;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const haptic = {
  tap: () => tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred("light"),
  notify: (type) => tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred(type),
};

// Цвет под интерфейсом Telegram совпадает со столом
const FELT = "#0b2a22";
if (tg) {
  try {
    tg.setBackgroundColor(FELT);
    if (tg.isVersionAtLeast("7.10")) tg.setBottomBarColor(FELT);
  } catch { /* старый клиент */ }
}

// Данные из хранилища могут быть пустыми или битыми: проверяем
function sanitize(saved) {
  // Если фишек не хватает даже на минимальную ставку, начинаем заново с полным стеком
  if (!saved || !Number.isFinite(saved.chips) || saved.chips < MIN_BET) return {};
  return { chips: Math.floor(saved.chips), stats: saved.stats };
}

function confirmReset(onYes) {
  const text = `Сбросить фишки до ${START_CHIPS} и обнулить статистику?`;
  if (tg && tg.showConfirm) tg.showConfirm(text, (ok) => ok && onYes());
  else if (confirm(text)) onYes();
}

async function main() {
  const game = new Game(sanitize(await load()));
  let busy = false; // пока ходит дилер, кнопки не реагируют

  async function dealerTurn() {
    busy = true;
    ui.render();
    await sleep(600);                       // пауза на переворот карты
    while (game.dealerShouldHit()) {
      game.dealerDraw();
      ui.render();
      haptic.tap();
      await sleep(700);
    }
    game.settle();
    ui.render();
    save(game.toSave());
    notifyResult();
    busy = false;
  }

  function notifyResult() {
    if (game.result === "win" || game.result === "blackjack") haptic.notify("success");
    else if (game.result === "push") haptic.notify("warning");
    else haptic.notify("error");
  }

  // Любое действие игрока: выполнить, перерисовать, сохранить, при необходимости запустить дилера
  function act(fn) {
    if (busy) return;
    fn();
    ui.render();
    save(game.toSave());
    if (game.phase === "dealer") dealerTurn();
    else if (game.phase === "done") notifyResult();
  }

  const ui = createUI(game, {
    onChip: (v) => act(() => { if (game.addBet(v)) haptic.tap(); }),
    onClear: () => act(() => game.clearBet()),
    onDeal: () => act(() => { if (game.deal()) haptic.tap(); }),
    onHit: () => act(() => { game.hit(); haptic.tap(); }),
    onStand: () => act(() => game.stand()),
    onDouble: () => act(() => game.double()),
    onNext: () => act(() => (game.broke ? game.reset() : game.nextRound())),
    onReset: () => confirmReset(() => act(() => game.reset())),
  });

  // Открыли апп сразу после прошлого раунда: подставляем прошлую ставку, как после «Новая раздача»
  if (game.chips >= game.lastBet) game.addBet(game.lastBet);
  ui.render();
}

main();

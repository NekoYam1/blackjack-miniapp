// Отрисовка: превращает состояние Game в DOM. Правил игры здесь нет.
import { handValue, RED, MIN_BET, BET_STEPS } from "./game.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString("ru-RU");

function cardEl(card, { hidden, isNew, flip, delay }) {
  const el = document.createElement("div");
  el.className = "card" + (hidden ? " back" : "") + (!hidden && RED.has(card.suit) ? " red" : "");
  if (isNew) el.classList.add("new");
  if (flip) el.classList.add("flip");
  if (isNew || flip) el.style.animationDelay = delay + "ms";
  if (hidden) {
    el.setAttribute("aria-label", "Закрытая карта");
    return el;
  }
  el.setAttribute("aria-label", card.rank + " " + card.suit);
  const rank = document.createElement("span"); rank.className = "r"; rank.textContent = card.rank;
  const suit = document.createElement("span"); suit.className = "s"; suit.textContent = card.suit;
  const big = document.createElement("span"); big.className = "big"; big.textContent = card.suit;
  el.append(rank, suit, big);
  return el;
}

// Анимируем только новые карты и переворот закрытой карты дилера.
function renderHand(box, cards, hideSecond) {
  const prevCount = Number(box.dataset.count || 0);
  const prevHidden = box.dataset.hidden === "1";
  box.replaceChildren(...cards.map((c, i) => {
    const hidden = hideSecond && i === 1;
    const isNew = i >= prevCount;
    const flip = prevHidden && !hidden && i === 1;
    return cardEl(c, { hidden, isNew, flip, delay: isNew ? (i - prevCount) * 140 : 0 });
  }));
  box.dataset.count = String(cards.length);
  box.dataset.hidden = hideSecond ? "1" : "0";
}

function totalText(cards, hideSecond) {
  if (!cards.length) return "";
  if (hideSecond) return handValue([cards[0]]).total + " + ?";
  const { total, soft } = handValue(cards);
  return total + (soft && total <= 21 ? " (мягкая)" : "");
}

function banner(g) {
  const money = Math.abs(g.net);
  switch (g.phase) {
    case "betting": return { text: g.bet ? "Нажмите «Раздать»" : "Сделайте ставку", tone: "" };
    case "player": return { text: g.reshuffled ? "Колода перемешана. Ваш ход" : "Ваш ход", tone: "" };
    case "dealer": return { text: "Ходит дилер", tone: "" };
  }
  switch (g.result) {
    case "blackjack": return { text: `Блэкджек! +${fmt(money)}`, tone: "win" };
    case "win": return { text: `${g.dealerValue.total > 21 ? "У дилера перебор" : "Победа"} +${fmt(money)}`, tone: "win" };
    case "lose": return { text: `${g.dealerBJ ? "У дилера блэкджек" : "Проигрыш"} −${fmt(money)}`, tone: "lose" };
    case "bust": return { text: `Перебор −${fmt(money)}`, tone: "lose" };
    default: return { text: "Ничья, ставка возвращена", tone: "push" };
  }
}

export function createUI(game, h) {
  const el = {
    chips: $("chips"), stats: $("stats"), reset: $("reset"),
    dealerHand: $("dealerHand"), playerHand: $("playerHand"),
    dealerTotal: $("dealerTotal"), playerTotal: $("playerTotal"), betTag: $("betTag"),
    banner: $("banner"),
    betControls: $("betControls"), playControls: $("playControls"), doneControls: $("doneControls"),
    chipRow: $("chipRow"), clear: $("clear"), deal: $("deal"),
    hit: $("hit"), stand: $("stand"), double: $("double"), next: $("next"),
  };

  const chipButtons = BET_STEPS.map((value) => {
    const b = document.createElement("button");
    b.className = "chip chip-" + value;
    b.textContent = String(value);
    b.setAttribute("aria-label", "Добавить к ставке " + value);
    b.onclick = () => h.onChip(value);
    return b;
  });
  el.chipRow.replaceChildren(...chipButtons);

  el.clear.onclick = h.onClear;
  el.deal.onclick = h.onDeal;
  el.hit.onclick = h.onHit;
  el.stand.onclick = h.onStand;
  el.double.onclick = h.onDouble;
  el.next.onclick = h.onNext;
  el.reset.onclick = h.onReset;

  function render() {
    const g = game;

    el.chips.textContent = fmt(g.chips);
    el.stats.textContent = `Раздач: ${g.stats.rounds}, побед: ${g.stats.wins}`;

    renderHand(el.dealerHand, g.dealer, g.holeHidden);
    renderHand(el.playerHand, g.player, false);
    el.dealerTotal.textContent = totalText(g.dealer, g.holeHidden);
    el.playerTotal.textContent = totalText(g.player, false);
    el.betTag.textContent = g.bet ? `Ставка: ${fmt(g.bet)}` : "";

    const b = banner(g);
    el.banner.textContent = b.text;
    el.banner.className = "banner " + b.tone;

    el.betControls.hidden = g.phase !== "betting";
    el.playControls.hidden = !(g.phase === "player" || g.phase === "dealer");
    el.doneControls.hidden = g.phase !== "done";

    chipButtons.forEach((btn, i) => { btn.disabled = g.chips < BET_STEPS[i]; });
    el.clear.disabled = g.bet === 0;
    el.deal.disabled = g.bet < MIN_BET;

    const myTurn = g.phase === "player";
    el.hit.disabled = !myTurn;
    el.stand.disabled = !myTurn;
    el.double.disabled = !g.canDouble();

    el.next.textContent = g.broke ? "Фишки закончились. Начать заново" : "Новая раздача";
  }

  return { render };
}

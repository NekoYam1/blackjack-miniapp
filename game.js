// Чистая логика блэкджека: без DOM и без Telegram. Её можно тестировать в Node.
// Правила: 6 колод, дилер стоит на любых 17 (включая мягкие), блэкджек платит 3:2,
// можно: ещё карту, стоп, удвоить (только на первых двух картах). Сплита и страховки нет.

export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const RED = new Set(["♥", "♦"]);

export const DECKS = 6;                 // 6 × 52 = 312 карт
export const RESHUFFLE_BELOW = 78;      // перемешиваем, когда в колоде осталось меньше 78 карт (четверть)
export const START_CHIPS = 1000;
export const MIN_BET = 10;
export const BET_STEPS = [10, 25, 50, 100];

export function createShoe(decks = DECKS) {
  const cards = [];
  for (let d = 0; d < decks; d++)
    for (const suit of SUITS)
      for (const rank of RANKS) cards.push({ rank, suit });
  return cards;
}

// Тасование Фишера–Йейтса
export function shuffle(cards, rng = Math.random) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function cardValue(rank) {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

// Пример: [A, 6] -> { total: 17, soft: true }; [A, 6, 10] -> { total: 17, soft: false }
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.rank);
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;

export class Game {
  constructor({ chips = START_CHIPS, stats = {} } = {}, rng = Math.random) {
    this.rng = rng;
    this.chips = chips;                       // свободные фишки (без ставки на столе)
    this.stats = { rounds: 0, wins: 0, losses: 0, pushes: 0, ...stats };
    this.lastBet = MIN_BET;
    this._resetRound();
    this._newShoe();
    this.reshuffled = false;
  }

  // ---- служебное ----
  _newShoe() { this.shoe = shuffle(createShoe(), this.rng); this.reshuffled = true; }
  _draw() { return this.shoe.pop(); }
  _resetRound() {
    this.player = [];
    this.dealer = [];
    this.bet = 0;
    this.phase = "betting";                   // betting -> player -> dealer -> done
    this.holeHidden = false;                  // закрыта ли вторая карта дилера
    this.result = null;                       // blackjack | win | lose | bust | push
    this.dealerBJ = false;
    this.net = 0;                             // выигрыш (+) или проигрыш (−) за раунд
    this.broke = false;                       // не хватает фишек даже на минимальную ставку
  }

  get playerValue() { return handValue(this.player); }
  get dealerValue() { return handValue(this.dealer); }
  canDouble() { return this.phase === "player" && this.player.length === 2 && this.chips >= this.bet; }
  toSave() {
    // Если закрыть апп в фазе ставок, ставка возвращается; посреди раздачи — нет.
    return { chips: this.phase === "betting" ? this.chips + this.bet : this.chips, stats: this.stats };
  }

  // ---- ставки ----
  addBet(amount) {
    if (this.phase !== "betting" || this.chips < amount) return false;
    this.chips -= amount;
    this.bet += amount;
    return true;
  }
  clearBet() {
    if (this.phase !== "betting") return;
    this.chips += this.bet;
    this.bet = 0;
  }

  // ---- раздача ----
  deal() {
    if (this.phase !== "betting" || this.bet < MIN_BET) return false;
    this.reshuffled = false;
    if (this.shoe.length < RESHUFFLE_BELOW) this._newShoe();
    this.lastBet = this.bet;
    this.player.push(this._draw());
    this.dealer.push(this._draw());
    this.player.push(this._draw());
    this.dealer.push(this._draw());
    this.phase = "player";
    this.holeHidden = true;
    if (isBlackjack(this.player) || isBlackjack(this.dealer)) {
      this.holeHidden = false;
      this.settle();
    }
    return true;
  }

  hit() {
    if (this.phase !== "player") return;
    this.player.push(this._draw());
    const { total } = this.playerValue;
    if (total > 21) this.settle();
    else if (total === 21) this.stand();      // на 21 больше брать нечего
  }

  stand() {
    if (this.phase !== "player") return;
    this.phase = "dealer";
    this.holeHidden = false;
  }

  double() {
    if (!this.canDouble()) return;
    this.chips -= this.bet;
    this.bet *= 2;
    this.player.push(this._draw());
    if (this.playerValue.total > 21) this.settle();
    else this.stand();
  }

  // ---- ход дилера (UI вызывает по шагам, чтобы показать анимацию) ----
  dealerShouldHit() { return this.phase === "dealer" && this.dealerValue.total < 17; }
  dealerDraw() { if (this.dealerShouldHit()) this.dealer.push(this._draw()); }

  // ---- подсчёт результата ----
  settle() {
    const pv = this.playerValue.total;
    const dv = this.dealerValue.total;
    const pBJ = isBlackjack(this.player);
    const dBJ = isBlackjack(this.dealer);
    this.dealerBJ = dBJ;

    let result;
    let returned = 0;                          // сколько фишек вернётся игроку (со ставкой)
    if (pBJ && dBJ) { result = "push"; returned = this.bet; }
    else if (pBJ) { result = "blackjack"; returned = this.bet + Math.floor(this.bet * 1.5); }
    else if (dBJ) { result = "lose"; }
    else if (pv > 21) { result = "bust"; }
    else if (dv > 21 || pv > dv) { result = "win"; returned = this.bet * 2; }
    else if (pv < dv) { result = "lose"; }
    else { result = "push"; returned = this.bet; }

    this.result = result;
    this.net = returned - this.bet;
    this.chips += returned;
    this.stats.rounds++;
    if (result === "win" || result === "blackjack") this.stats.wins++;
    else if (result === "push") this.stats.pushes++;
    else this.stats.losses++;

    this.phase = "done";
    this.holeHidden = false;
    this.broke = this.chips < MIN_BET;
  }

  // ---- следующий раунд ----
  nextRound() {
    if (this.phase !== "done" || this.broke) return;
    this._resetRound();
    // Ставка прошлого раунда подставляется сама, если хватает фишек
    if (this.chips >= this.lastBet) this.addBet(this.lastBet);
    else if (this.chips >= MIN_BET) this.addBet(MIN_BET);
  }

  reset() {
    this.chips = START_CHIPS;
    this.stats = { rounds: 0, wins: 0, losses: 0, pushes: 0 };
    this.lastBet = MIN_BET;
    this._resetRound();
    this._newShoe();
    this.reshuffled = false;
  }
}

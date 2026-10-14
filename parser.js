// Bid phrase parser for auctioneer speech.
// Turns a transcript line into suggestions like {paddle:"42", amount:600}.
// Only paddle-anchored phrases produce suggestions ("do I hear 600?" alone never does).
(function (root) {
  const SMALL = {
    zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40,
    fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
  };
  const NUMWORD = Object.keys(SMALL).concat(['hundred', 'thousand']).join('|');
  const RUN = new RegExp('\\b(?:' + NUMWORD + ')(?:[\\s-]+(?:' + NUMWORD + '|and))*\\b', 'gi');

  function convertRun(run) {
    const words = run.toLowerCase().split(/[\s-]+/);
    const tail = [];
    while (words.length && words[words.length - 1] === 'and') tail.unshift(words.pop());
    const out = [];
    let total = 0, cur = 0, has = false;
    const flush = () => { if (has) out.push(String(total + cur)); total = 0; cur = 0; has = false; };
    for (const w of words) {
      if (w === 'and') continue;
      if (w === 'hundred') { cur = (cur || 1) * 100; has = true; continue; }
      if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; has = true; continue; }
      const v = SMALL[w];
      if (v === undefined) continue;
      // "forty two" combines; "two forty" or "one two" starts a new number.
      const lastUnit = cur % 100;
      const combines = !has || (cur === 0 && total > 0) ||
        (lastUnit === 0 && cur > 0) ||
        (lastUnit >= 20 && lastUnit % 10 === 0 && v < 10);
      // Auction shorthand: "seven fifty" = 750, "twelve fifty" = 1250.
      if (!combines && total === 0 && cur > 0 && cur < 100 && v >= 10) { cur = cur * 100 + v; continue; }
      if (!combines) flush();
      cur += v; has = true;
    }
    flush();
    return out.join(' ') + (tail.length ? ' ' + tail.join(' ') : '');
  }

  function normalize(text) {
    let t = ' ' + String(text || '').toLowerCase() + ' ';
    t = t.replace(/\ba (hundred|thousand)\b/g, 'one $1');
    t = t.replace(RUN, convertRun);
    t = t.replace(/(\d),(\d{3})\b/g, '$1$2').replace(/(\d),(\d{3})\b/g, '$1$2');
    t = t.replace(/(\d+(?:\.\d+)?)\s*(?:k|grand|thousand)\b/g, (m, n) => String(Math.round(parseFloat(n) * 1000)));
    t = t.replace(/(\d+)\s+hundred\b/g, (m, n) => String(parseInt(n, 10) * 100));
    t = t.replace(/\bno\.\s*(\d)/g, 'number $1');
    t = t.replace(/#\s*(\d)/g, 'number $1');
    return t.replace(/\s+/g, ' ');
  }

  const PADDLE_RE = /\b(?:paddles?|numbers?|bidders?|bid number|card)\s*(\d{1,4})\b/g;
  const TO_RE = /\$?\s?(\d{2,7})(?:\s*dollars)?\s+(?:to|from|with|on|by|goes to)\s+(?:the\s+)?(?:paddle\s+|number\s+|bidder\s+)?(\d{1,4})\b/g;
  const MONEY_RE = /\$\s?(\d+(?:\.\d+)?)|\b(\d+(?:\.\d+)?)\s*(?:dollars|bucks)\b/g;
  const NUM_RE = /\b(\d{2,7})\b/g;

  // ctx: { high, next, opening, increment }
  function parseBidPhrases(text, ctx) {
    ctx = ctx || {};
    const t = normalize(text);
    const high = Number(ctx.high) || 0;
    const floor = high > 0 ? high + 0.01 : Math.max(1, (Number(ctx.opening) || 0) * 0.5);
    const ceiling = high > 0 ? high + Math.max(50, (Number(ctx.increment) || 50) * 40) : Math.max(1000, (Number(ctx.opening) || 100) * 25);
    const plausible = a => a >= floor && a <= ceiling;
    const results = [];
    const seen = new Set();
    const push = (paddle, amount, assumed, at) => {
      const key = paddle + '@' + amount;
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ paddle: String(paddle), amount, assumed: !!assumed, at, sold: /\bsold\b/.test(t) });
    };

    // "600 to 42", "$700 goes to number 18"
    let m;
    TO_RE.lastIndex = 0;
    while ((m = TO_RE.exec(t))) {
      const amount = Number(m[1]);
      if (plausible(amount)) push(m[2], amount, false, m.index);
    }

    // Paddle-anchored: "paddle 42", "number 42", "bidder 42"
    const paddles = [];
    PADDLE_RE.lastIndex = 0;
    while ((m = PADDLE_RE.exec(t))) paddles.push({ paddle: m[1], idx: m.index, end: m.index + m[0].length, numIdx: m.index + m[0].lastIndexOf(m[1]) });
    if (!paddles.length) return results;

    const paddleNumPositions = new Set(paddles.map(p => p.numIdx));
    const amounts = [];
    MONEY_RE.lastIndex = 0;
    while ((m = MONEY_RE.exec(t))) {
      const a = Number(m[1] || m[2]);
      if (plausible(a)) amounts.push({ amount: a, idx: m.index, strong: true });
    }
    NUM_RE.lastIndex = 0;
    while ((m = NUM_RE.exec(t))) {
      if (paddleNumPositions.has(m.index)) continue;
      const a = Number(m[1]);
      if (amounts.some(x => Math.abs(x.idx - m.index) <= 2)) continue;
      if (plausible(a)) amounts.push({ amount: a, idx: m.index, strong: false });
    }

    for (const p of paddles) {
      if (results.some(r => r.paddle === p.paddle)) continue;
      let best = null, bestScore = Infinity;
      for (const a of amounts) {
        const d = a.idx < p.idx ? p.idx - a.idx : a.idx - p.end;
        const score = d - (a.strong ? 15 : 0);
        if (score < bestScore) { best = a; bestScore = score; }
      }
      if (best && bestScore < 80) push(p.paddle, best.amount, false, p.idx);
      else if (ctx.next) push(p.paddle, Number(ctx.next), true, p.idx);
    }
    return results;
  }

  const api = { normalize, parseBidPhrases };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AuctionParser = api;
})(typeof window !== 'undefined' ? window : globalThis);

// Ein Zufallsgenerator mit Gedächtnis. Derselbe Same ergibt dieselbe
// Sternkarte - sonst läge Kilrah bei jedem Neuladen anders.
export function makePrng(seed = 1337) {
  let s = seed >>> 0;
  return function next() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Würfel mit ganzen Zahlen von min bis max (beide eingeschlossen).
export function rollInt(rnd, min, max) {
  return min + Math.floor(rnd() * (max - min + 1));
}

// Ein Eintrag aus einer Liste.
export function pick(rnd, list) {
  return list[Math.floor(rnd() * list.length) % list.length];
}

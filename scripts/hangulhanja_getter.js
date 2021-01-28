JSON.stringify(Object.values($0.___hanjas).map(h => {
  const o = { t: h.symbol, m: h.meanings }
  if (h.simplified) {
    o.s = h.simplified;
  }
  return o;
}))
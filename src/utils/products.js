import { productItems, BEST_SELLER_IDS } from "../constants";

export const BUNDLE_RECIPES = [
  { bundle: "paket-lengkap", singles: ["lanyard", "cocard", "booklet"] },
  { bundle: "paket-lc", singles: ["lanyard", "cocard"] },
  { bundle: "paket-lb", singles: ["lanyard", "booklet"] },
  { bundle: "paket-cb", singles: ["cocard", "booklet"] },
];

export const normalizeSelection = (ids) => {
  const singletonIds = Object.keys(productItems).filter((id) => productItems[id].length === 1);
  const keep = ids.filter((id) => !singletonIds.includes(id));
  const pool = new Set(ids.filter((id) => singletonIds.includes(id)));

  BUNDLE_RECIPES.forEach(({ bundle, singles }) => {
    if (singles.every((single) => pool.has(single))) {
      keep.push(bundle);
      singles.forEach((single) => pool.delete(single));
    }
  });

  pool.forEach((single) => keep.push(single));
  return keep;
};

export const sortedProducts = (list) =>
  [...list].sort((a, b) => {
    const rankA = BEST_SELLER_IDS.indexOf(a.id);
    const rankB = BEST_SELLER_IDS.indexOf(b.id);
    if (rankA === -1 && rankB === -1) return 0;
    if (rankA === -1) return 1;
    if (rankB === -1) return -1;
    return rankA - rankB;
  });


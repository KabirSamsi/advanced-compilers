export const mapInv = (
  map: Map<string, Set<string>>,
): Map<string, Set<string>> => {
  const out = new Map<string, Set<string>>();
  for (const key of map.keys()) out.set(key, new Set());
  for (const [node, successors] of map.entries()) {
    for (const s of successors) out.get(s)!.add(node);
  }
  return out;
};
export const setEquals = <T>(setA: Set<T>, setB: Set<T>): boolean => {
    if (setA.size != setB.size) return false;
    for (const elem of setA) {
        if (!setB.has(elem)) return false;
    }
    return true;
};
export const bigIntersection = <T>(sets: Set<T>[]): Set<T> => {
    if (sets.length === 0) return new Set();
    let result = new Set(sets[0]);
    for (let i = 1; i < sets.length; i++) {
        result = new Set([...result].filter((x) => sets[i].has(x)));
    }
    return result;
};

// deno-lint-ignore no-explicit-any
export const format = (val: any): string => {
    const capBool = (x: any) => (typeof x === 'boolean') ? (x ? "True" : "False") : x
    if (val instanceof Set) {
        return val.size > 0 ? Array.from(val).map(capBool).map(x => (typeof x === 'object') ? JSON.stringify(x, null, 0) : x).join(", ") : "∅";
    } else if (val instanceof Map) {
        return val.size > 0
            ? Array.from(val.entries()).sort().map(([k, v]) => `${k}: ${capBool(v)}`).join(", ")
            : "∅";
    } else if (typeof val === "object" && val !== null) {
        const keys = Object.keys(val).sort();
        return keys.length > 0
            ? keys.map(key => `${key}: ${capBool(val[key])}`).join(", ")
            : "∅";
    } else {
        return val;
    }
};
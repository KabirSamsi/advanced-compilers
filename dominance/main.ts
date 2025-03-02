import { CFGs, graph } from "./util.ts";

export const readStdin = async (): Promise<string> => {
  const stdin = Deno.stdin.readable
      .pipeThrough(new TextDecoderStream())
      .getReader();

  let datastring = "";
  while (true) {
    const { value, done } = await stdin.read();
    if (done) break;
    datastring += value;
  }
  return datastring.trim();
};

/* Main function */
const main = (cfgs: Record<string, [graph, string]>, mode: Mode) => {
  for (const func in cfgs) {
    const cfg = cfgs[func];
    const doms = computeDominators(cfg);
    if (mode === "dom") {
      const obj = Object.fromEntries(
          Array.from(doms, ([key, valueSet]) => [key, Array.from(valueSet).sort()]),
      );

      const sortedObj = Object.keys(obj)
          .sort()
          .reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
          }, {} as { [key: string]: any });

      console.log(JSON.stringify(sortedObj, null, 2));
    }
  }
};

const bigIntersection = <T>(sets: Set<T>[]): Set<T> => {
  if (sets.length === 0) return new Set();
  let result = new Set(sets[0]);
  for (let i = 1; i < sets.length; i++) {
    result = new Set([...result].filter((x) => sets[i].has(x)));
  }
  return result;
};

const setEquals = <T>(setA: Set<T>, setB: Set<T>): boolean => {
  if (setA.size != setB.size) return false;
  for (const elem of setA) {
    if (!setB.has(elem)) return false;
  }
  return true;
};

const computeDominators = (arg: [graph, string]) => {
  const cfg = arg[0];
  const vertices = [...cfg.keys()];

  // compute predecessors
  const predsMap = new Map<string, Set<string>>();
  vertices.forEach((v) => {
    predsMap.set(v, new Set());
  });
  cfg.entries().forEach(([v, succs]) => {
    succs.forEach((succ) => {
      predsMap.get(succ)!.add(v);
    });
  });

  // dom = {each vertex -> all vertices}
  const dom = new Map<string, Set<string>>();
  vertices.forEach((v) => {
    dom.set(v, new Set(vertices));
  });

  // while dom is still changing:
  let changed = true;
  while (changed) {
    changed = false;

    // for vertex in CFG:
    for (const v of vertices) {
      const preds = predsMap.get(v);

      // dom[p] for p in vertex.preds
      const predDoms: Set<string>[] = [];
      preds?.forEach((p) => {
        predDoms.push(dom.get(p)!);
      });
      // ∩(dom[p] for p in vertex.preds)
      const newDom = bigIntersection(predDoms);
      // {vertex} u ...
      newDom.add(v);

      if (!setEquals(newDom, dom.get(v)!)) {
        dom.set(v, newDom);
        changed = true;
      }
    }
  }

  return dom;
};

const modes = ["dom" ,"front" , "tree"] as const;
export type Mode = typeof modes[number];

if (import.meta.main) {
  const datastring = await readStdin();
  const cfgs = await CFGs(datastring);
  const args = Deno.args;
  if (args.length < 1 || !modes.includes(args[0] as Mode)) {
    console.error(`Please specify one of: ${modes.join(", ")}`);
    Deno.exit(1);
  }
  main(cfgs, (Deno.args[0] as Mode))
}

export default main;

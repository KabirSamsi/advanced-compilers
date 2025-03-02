import { CFGs, graph, readStdin, mapInv, setEquals, bigIntersection, prettyPrint } from "./util.ts";

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

const dominanceTree = (dom: Map<string, Set<string>>): graph => {
  // inverted dominance map
  const inverted = mapInv(dom);

  // remove reflexive
  const invertedStrict = new Map<string, Set<string>>(
    [...inverted].map(([key, values]) => [
      key,
      new Set([...values].filter((val) => val !== key)),
    ]),
  );

  // second-level strict dominance
  const invertedStrict2 = new Map<string, Set<string>>();
  for (const [key, values] of invertedStrict) {
    const unionSet = new Set<string>(
      [...values].flatMap((child) =>
        Array.from(invertedStrict.get(child) ?? [])
      ),
    );
    invertedStrict2.set(key, unionSet);
  }

  // remove values present in the second-level set
  const result = new Map<string, string[]>();
  for (const [key, values] of invertedStrict) {
    const secondSet = invertedStrict2.get(key) || new Set<string>();
    result.set(key, [...values].filter((v) => !secondSet.has(v)));
  }

  return result;
};

const dominanceFrontier = (
  dom: Map<string, Set<string>>,
  cfg: graph,
): Map<string, string[]> => {
  const result = new Map<string, string[]>();

  const inverted = mapInv(dom);

  for (const node of dom.keys()) {
    const dominatedSuccessors = new Set<string>();

    const dominatedBlocks = inverted.get(node);
    if (dominatedBlocks) {
      for (const dominated of dominatedBlocks) {
        cfg.get(dominated)?.forEach((successors) => {
          dominatedSuccessors.add(successors);
        });
      }
    }
    result.set(
      node,
      [...dominatedSuccessors].filter((b) =>
        b === node || !inverted.get(node)?.has(b)
      ),
    );
  }
  return result;
};

const modes = ["dom", "front", "tree"] as const;
export type Mode = typeof modes[number];

const main = (cfgs: Record<string, [graph, string]>, mode: Mode) => {
  const ret: Record<string, any> = {};
  for (const func in cfgs) {
    const cfg = cfgs[func];
    const doms = computeDominators(cfg);
    if (mode === "dom") {
      ret[func] = doms;
      prettyPrint(doms);
    } else if (mode === "tree") {
      const tree = dominanceTree(doms);
      ret[func] = tree;
      prettyPrint(tree);
    } else if (mode === "front") {
      const frontier = dominanceFrontier(doms, cfg[0]);
      ret[func] = frontier;
      prettyPrint(frontier);
    }
  }
  return ret;
};

if (import.meta.main) {
  const datastring = await readStdin();
  const cfgs = await CFGs(datastring);
  const args = Deno.args;
  if (args.length < 1 || !modes.includes(args[0] as Mode)) {
    console.error(`Please specify one of: ${modes.join(", ")}`);
    Deno.exit(1);
  }
  main(cfgs, Deno.args[0] as Mode);
}

export default main;

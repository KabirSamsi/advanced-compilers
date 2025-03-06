import {CFGs, readStdin, mapInv, setEquals, bigIntersection, Graph, prettyPrint} from "./util.ts";

const computeDominators = (cfg : Graph) => {
  const vertices = cfg.getVertices()

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
      const preds = cfg.predecessors(v);

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

export const dominanceTree = (cfg : Graph) => {
  const dom = computeDominators(cfg)
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

export const dominanceFrontier = (
  cfg: Graph,
): Map<string, string[]> => {
  const dom = computeDominators(cfg)
  const result = new Map<string, string[]>();

  const inverted = mapInv(dom);

  for (const node of dom.keys()) {
    const dominatedSuccessors = new Set<string>();

    const dominatedBlocks = inverted.get(node);
    if (dominatedBlocks) {
      for (const dominated of dominatedBlocks) {
        cfg.successors(dominated).forEach((successors) => {
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

const main = (cfgs: Record<string,Graph>, mode: Mode) => {
  const ret: Record<string, any> = {};
  for (const func in cfgs) {
    const cfg = cfgs[func];
    const doms = computeDominators(cfg);
    if (mode === "dom") {
      ret[func] = doms;
      prettyPrint(doms);
    } else if (mode === "tree") {
      const tree = dominanceTree(cfg);
      ret[func] = tree;
      prettyPrint(tree);
    } else if (mode === "front") {
      const frontier = dominanceFrontier(cfg);
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

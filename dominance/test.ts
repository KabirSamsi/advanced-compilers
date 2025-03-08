import main from "./main.ts";
import { assertFalse } from "@std/assert/false";
import { assert } from "@std/assert";
import { CFGs } from "../ssa/bbcfg.ts";

type graph = Map<string, string[]>;

/* Recursively compute all children of a node in the dominator tree
* @param tree – The dominator tree
* @param node – The node of interest
* @return – All children of node in tree
*/
function getDominated(tree: graph, node: string): Array<string> {
  let descendents: Array<string> = [node];
  for (const child of tree.get(node) || []) {
    for (const descendent of getDominated(tree, child)) {
      descendents.push(descendent);
    }
  }
  return descendents;
}

/* Validates that a given dominator tree is a tree via MST construction
* @param tree – The dominator tree
* @return – Validation
*/
function isTree(tree: graph, edges: Array<[string, string]>): boolean {
  let parent: Map<string, string> = new Map();
  for (const node of tree.keys()) {
    parent.set(node, node);
  }

  function find(node: string) {
    if (parent.get(node)! == node) {
      return node;
    }
    return find(parent.get(node)!);
  }

  function union(n1: string, n2: string) {
    parent.set(find(n1), find(n2));
  }

  // Cycle detection via union find
  for (const [f, t] of edges) {
    assertFalse(find(f) == find(t));
    union(f, t);
  }
  return true;
}

/* Check if a dominates b in the cfg
* @param cfg – The Control-Flow Graph
* @param a – Entry node
* @param b – Destination node
*/
function dom(
  cfg: graph,
  entry: string,
  a: string,
  b: string,
): boolean {
  if (a == b) return true;

  // Check that it's possible to reach b via a
  let reachable: boolean = false;
  let queue: Array<string> = [entry];
  let visited: Set<string> = new Set([entry]);
  while (queue.length > 0) {
    let front: string = queue.shift()!;
    if (front == b) {
      reachable = true;
      break;
    }
    for (let neighbor of cfg.get(front)!) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  if (!reachable) return false;
  // Since it was possible to reach b, all paths through the entry are valid
  if (a == entry) return true;

  // Check that removing a from the graph makes it impossible to reach b
  queue = [entry];
  visited = new Set([entry, a]);
  while (queue.length > 0) {
    let front: string = queue.shift()!;
    if (front == b) return false;
    for (let neighbor of cfg.get(front)!) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return true;
}

/* Verify that a dominator tree is able to compute all dominators in a graph
* @param tree - Dominator tree
* @param g – CFG with its given entry point
*/
function getsAllDominators(tree: graph, g: [graph, string]) {
  let [cfg, entry] = g;
  for (const f of cfg.keys()) {
    for (const t of cfg.keys()) {
      // f dominates t <=> t is a descendent of f in the dominator tree
      assert(dom(cfg, entry, f, t) == getDominated(tree, f).includes(t));
    }
  }

  let edges: Array<[string, string]> = [];
  for (const [node, neighbors] of tree) {
    for (const neighbor of neighbors) {
      edges.push([node, neighbor]);
    }
  }
  isTree(tree, edges);
}

/* Extract predecessors of a block (indexed by label) in a CFG. */
export const pred = (adj: graph, node: string): string[] => {
  const predecessors: string[] = [];
  for (const neighbor of adj.keys()) {
    if ((adj.get(neighbor) || []).includes(node)) {
      predecessors.push(neighbor);
    }
  }
  return predecessors;
};

/*
 * Verifies that the dominance frontier for each node is correct
 * @param tree – The dominator tree
 * @param g – The CFG and its entry
 * @param frontier – The frontier whom we are testing
 */
function verifyDominanceFrontier(
  tree: graph,
  g: [graph, string],
  frontier: graph,
) {
  const [cfg, _entry] = g;
  const preds: Map<string, Array<string>> = new Map();
  const dominated: Map<string, Array<string>> = new Map();
  for (const node of cfg.keys()) {
    preds.set(node, pred(cfg, node));
    dominated.set(node, getDominated(tree, node));
  }

  // Iterate through each node in the frontier, and through the graph.
  for (let node of frontier.keys()) {
    for (let neighbor of cfg.keys()) {
      /* For each neighbor
      * If the neighbor is in A's frontier, then
        * A does not strictly dominate B (means A == B or B is not in A's dominated)
        * For all predecessors in B, A dominates at least one of them
      */

      if (frontier.get(node)!.includes(neighbor)) {
        assertFalse(
          node != neighbor && dominated.get(node)!.includes(neighbor),
        );
        let dominatesOne: boolean = false;
        for (let p of preds.get(neighbor)!) {
          if (dominated.get(node)!.includes(p)) {
            dominatesOne = true;
          }
        }
        assert(dominatesOne);
      }

      /*
       * If A does not strictly dominate B (means A == B or B is not in A's dominated)
       * Scan through all of B's predecesors. If A dominates at least one of them:
       * Then B should be in A's frontier
       */
      if (node == neighbor || !dominated.get(node)!.includes(neighbor)) {
        for (let p of preds.get(neighbor)!) {
          if (dominated.get(node)!.includes(p)) {
            assert(frontier.get(node)!.includes(neighbor));
          }
        }
      }
    }
  }
}

for await (const entry of Deno.readDir("test")) {
  if (entry.isFile && entry.name.endsWith(".bril")) {
    Deno.test(`Testing dominators/dominator tree for file: ${entry.name}`, async () => {
      const fileContent = await Deno.readTextFile(`test/${entry.name}`);
      const cfgs = await CFGs(fileContent);
      const trees = main(cfgs, "tree");

      for (const lbl of Object.keys(cfgs)) {
        let tree = trees[lbl];
        getsAllDominators(tree, cfgs[lbl].toOldGraph());
      }
    });

    Deno.test(`Testing domination frontier for file: ${entry.name}`, async () => {
      const fileContent = await Deno.readTextFile(`test/${entry.name}`);
      const cfgs = await CFGs(fileContent);
      const trees = main(cfgs, "tree");
      const frontiers = main(cfgs, "front");

      for (const lbl of Object.keys(cfgs)) {
        let tree = trees[lbl];
        let frontier = frontiers[lbl];
        verifyDominanceFrontier(tree, cfgs[lbl].toOldGraph(), frontier);
      }
    });
  }
}

import { assertExists } from "@std/assert";
import {Block, brilInstruction, CFGs, graph, pred} from "./util.ts";
import main from "./main.ts";
import { assertFalse } from "@std/assert/false";

/* Recursively compute all children of a node in the dominator tree
* @param tree – The dominator tree
* @param node – The node of interest
* @return – All children of node in tree
*/
function getDominated(tree : graph, node : string) : Array<string> {
  let descendents : Array<string> = [node];
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
function isTree(tree : graph, edges : Array<[string, string]>) : boolean {
  let parent : Map<string, string> = new Map();
  for (const node of tree.keys()) {
    parent.set(node, node);
  }

  function find(node : string) {
    if (parent.get(node)! == node) {
      return node;
    }
    return find(parent.get(node)!);
  }

  function union(n1 : string, n2 : string) {
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
* @param a – Intermediary node who should dominate b
* @param b – Destination node
* @param visited - All nodes who have been visited thus far
* @param path – All nodes along the current path
*/
function dom(
    cfg : graph,
    a : string,
    b : string,
    visited : Set<string>,
    path : Array<string>
)  {
  if (path[path.length-1]! == b) {
    return (path.includes(a));
  }

  if (a == b) return true;
  for (let neighbor of cfg.get(path[path.length-1]!)!) {
    if (!visited.has(neighbor)) {
      visited.add(neighbor);
      path.push(neighbor);
      if (!dom(cfg, a, b, visited, path)) {
        return false;
      }
    }
  }
}

/* Verify that a dominator tree is able to compute all dominators in a graph
* @param tree - Dominator tree
* @param g – CFG with its given entry point
*/
function getsAllDominators(tree : graph, g : [graph, string]) {
  let [cfg, entry] = g;
  for (const f of cfg.keys()) {
    for (const t of cfg.keys()) {
      // f dominates t <=> t is a descendent of f in the dominator tree
      assertFalse(dom(cfg, f, t, new Set(), [entry]) && !getDominated(tree, f).includes(t));
      assertFalse(!dom(cfg, f, t, new Set(), [entry]) && getDominated(tree, f).includes(t));
    }
  }

  let edges : Array<[string, string]> = [];
  for (const [node, neighbors] of tree) {
    for (const neighbor of neighbors) {
      edges.push([node, neighbor]);
    }
  }
  isTree(tree, edges);
}

/*
  * Verifies that the dominance frontier for each node is correct
  * @param tree – The dominator tree
  * @param g – The CFG and its entry
  * @param frontier – The frontier whom we are testing
* */
function verifyDominanceFrontier(tree : graph, g : [graph, string], frontier : graph) {
  const [cfg, _entry] = g;
  const preds : Map<string, Array<string>> = new Map();
  const dominated : Map<string, Array<string>> = new Map();
  for (const node of cfg.keys()) {
    preds.set(node, pred(cfg, node));
    dominated.set(node, getDominated(tree, node));
  }

  for (let node of frontier.keys()) {
    for (let neighbor of cfg.keys()) {
      // If node's frontier includes neighbor, but it is either strictly dominated or
      if (frontier.get(node)!.includes(neighbor)) {
        /* Assert
          * B is in A's frontier
          * A does not dominate B
          * A dominates at least one of B's predecessors */
        assertFalse(dominated.get(node)!.includes(neighbor));
        let doesNotDominate : boolean = true;
        for (let pred of preds.get(neighbor)!) {
          if (dominated.get(node)!.includes(pred)) {
            doesNotDominate = false;
          }
        }
        assertFalse(doesNotDominate);
      } else {
        /* Assert
          * B is not in A's frontier
          * A does not dominate B
          * A does not dominate any of B's predecessors */
        if(dominated.get(node)!.includes(neighbor)) {
          for (let pred of preds.get(neighbor)!) {
            assertFalse(dominated.get(node)!.includes(pred));
          }
        }
      }
    }
  }
}

for await (const entry of Deno.readDir("test")) {
  if (entry.isFile && entry.name.endsWith(".bril")) {
    Deno.test(`Testing file: ${entry.name}`, async () => {
      const fileContent = await Deno.readTextFile(`test/${entry.name}`);
      const cfgs = await CFGs(fileContent);
      const r1 = main(cfgs, "dom");
      const r3 = main(cfgs, "tree");
      const r2 = main(cfgs, "front");
      console.log(cfgs);
      assertExists(cfgs);
    });
  }
}

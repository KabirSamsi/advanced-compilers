import { basicBlocks, CFGs, generateCFG } from "./bbcfg.ts";
import {
  BlockMap,
  brilInstruction,
  brilProgram,
} from "../common/looseTypes.ts";
import { dominanceFrontier, dominanceTree } from "../dominance/main.ts";
import { Graph } from "../common/graph.ts";
import {
  prettyPrint,
  readStdin,
  runBril2Json,
  runBril2Txt,
} from "../common/commandLine.ts";

/**
 * Returns a map from each defined variable in a function to the blocks that defined it
 * @param blocks basic blocks
 */
const defSources = (blocks: BlockMap) => {
  const map = new Map<string, Set<string>>();
  for (const [label, insns] of blocks) {
    for (const insn of insns) {
      if (insn.dest) {
        const dest = insn.dest;
        if (!map.has(dest)) map.set(dest, new Set());
        map.get(dest)!.add(label);
      }
    }
  }
  return map;
};

/* Count total number of predecessors of a vertex in a dominance frontier */
const predsDominanceFrontier = (
  frontier: Map<string, string[]>,
  vertex: string,
): number => {
  let total: number = 0;
  for (const [node, neigbors] of frontier) {
    if (neigbors.includes(vertex)) {
      total += 1;
    }
  }
  return total;
};

/*
  Returns a set of all variables defined in a Bril function over a sriesseries of basic blocks
  * @param blocks basic blocks
*/
const findAllVars = (blocks: BlockMap): Set<string> => {
  const vars = new Set<string>();
  for (const [label, insns] of blocks) {
    for (const insn of insns) {
      if (insn.dest) {
        vars.add(insn.dest);
      }
    }
  }
  return vars;
};

/*
  Insert Phi nodes using the Dominance Frontier
*/
const insertPhi = (
  blocks: BlockMap,
  cfg: Graph,
  frontier: Map<string, string[]>,
): BlockMap => {
  //         {
  //           "args": [
  //             "a.2",
  //             "a.3"
  //           ],
  //           "dest": "a.1",
  //           "labels": [
  //             "left",
  //             "right"
  //           ],
  //           "op": "phi",
  //           "type": "int"
  //         },

  const vars: Set<string> = findAllVars(blocks);
  const defs: Map<string, Set<string>> = defSources(blocks);
  const addedPhi: Set<string> = new Set<string>();

  for (const variable of vars) {
    for (const def of defs.get(variable)!) {
      // Iterate through each block in dominance frontier
      for (const lbl of frontier.get(def)!) {
        if (!addedPhi.has(lbl)) {
          addedPhi.add(lbl);

          // Build up phi node with proper data
          let newArgs = [];
          let newLabels = [];
          for (let pred of cfg.predecessors(lbl)) {
            newLabels.push(pred);
            newArgs.push(variable);
          }

          blocks.get(lbl)!.unshift({
            op: "phi",
            dest: variable,
            args: newArgs,
            labels: newLabels,
          });
        }

        // Add new block to defs
        if (!defs.get(variable)!.has(lbl)) {
          const newDefs = defs.get(variable)!;
          newDefs.add(lbl);
          defs.set(variable, newDefs);
        }
      }
    }
  }
  return blocks;
};

/*
 * Rename all variables following insertion of phi nodes
 */
const rename = (
  stacks: Map<string, string[]>,
  blocks: BlockMap,
  blockname: string,
  cfg: Graph,
  tree: Map<string, string[]>,
) => {
  for (const instr of blocks.get(blockname)!) {
    instr.args = instr.args?.map((v) => {
      if (stacks.get(v)) {
        return stacks.get(v)![0];
      } else {
        return v;
      }
    });
    instr.dest = instr.dest + "_" + blockname;
    console.log(stacks);
    let newArr = stacks.get(instr.dest)!;
    newArr.unshift(instr.dest + "_" + blockname);
    stacks.set(instr.dest, newArr);
  }

  const successors = cfg.successors(blockname);
  for (let succ of successors) {
    for (let insn of blocks.get(succ)!) {
      if (insn.op && insn.op == "phi" && insn.args) {
        let replacements: string[] = [];
        for (let arg of insn.args) {
          replacements.push(stacks.get(arg)![0]);
        }
        insn.args = replacements;
      }
    }
  }

  for (let child of tree.get(blockname)!) {
    rename(stacks, blocks, child, cfg, tree);
  }
};

/*
 * Perform translation into SSA
 */
const intoSSA = (
  blocks: BlockMap,
  frontier: Map<string, string[]>,
  cfg: Graph,
  tree: Map<string, string[]>,
) => {
  insertPhi(blocks, cfg, frontier);
  const stacks = new Map<string, Array<string>>();
  if (blocks.size > 0) {
    rename(stacks, blocks, [...blocks][0][0], cfg, tree);
  }
};

const insertSets = (block: brilInstruction[]): brilInstruction[] => {
  let updatedBlock: brilInstruction[] = [];
  for (const insn of block) {
    updatedBlock.push(insn);
    if (insn.dest) {
      updatedBlock.push({ op: insn.dest! });
    }
  }
  return [];
};

const leaveSSA = (blocks: BlockMap) => {
  //         {
  //           "args": [
  //             "a.2",
  //             "a.3"
  //           ],
  //           "dest": "a.1",
  //           "labels": [
  //             "left",
  //             "right"
  //           ],
  //           "op": "phi",
  //           "type": "int"
  //         },
  blocks.forEach((block, blockName) => {
    const newBlock = block.filter((insn) => {
      if (insn?.op === "phi") {
        // side effect of filter LOL
        const args = insn.args ?? [];
        const labels = insn.labels ?? [];
        for (let i = 0; i < Math.min(args.length, labels.length); i++) {
          blocks.get(labels[i])!.push({
            op: "id",
            dest: insn.dest,
            args: [args[i]],
          });
        }
        return false;
      }
      return true;
    });
    // Update the block in the map with the filtered instructions
    blocks.set(blockName, newBlock);
  });
};

const main = async (stdin: string, intoSSA: boolean, outOfSSA: boolean) => {
  try {
    JSON.parse(stdin);
  } catch {
    stdin = await runBril2Json(stdin);
  }
  const program: brilProgram = JSON.parse(stdin);

  for (const fn of program.functions || []) {
    if (fn.instrs) {
      const blocks = basicBlocks(fn.instrs);
      // console.log(blocks);
      const cfg: Graph = generateCFG(blocks);
      const frontier = dominanceFrontier(cfg);
      const tree = dominanceTree(cfg);

      if (intoSSA) {
        insertPhi(blocks, cfg, frontier);
        // intoSSA(blocks,frontier,cfg,tree)
      }

      if (outOfSSA) leaveSSA(blocks);

      fn.instrs = Array.from(blocks.entries()).flatMap((
        [label, instrs],
      ): brilInstruction[] => [{ label: label }, ...instrs]);
    }
  }

  // for JSON output
  // console.log(JSON.stringify(program,null, 2));
  const text = await runBril2Txt(program);
  console.log(text);
};

if (import.meta.main) {
  const datastring = await readStdin();
  let args = Deno.args;
  if (args.at(0) === "in") main(datastring, true, false);
  else if (args.at(0) === "out") main(datastring, false, true);
  else main(datastring, true, true);
}

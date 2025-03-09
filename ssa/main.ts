import { basicBlocks, CFGs, generateCFG } from "../common/basicBlockCFG.ts";
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
  args : string[],
  cfg: Graph,
  frontier: Map<string, string[]>,
): BlockMap => {
  const vars: Set<string> = findAllVars(blocks).union(new Set(args));

  const defs: Map<string, Set<string>> = defSources(blocks);
  const addedPhi: Set<string> = new Set<string>();

  for (const variable of vars) {
    for (const def of defs.get(variable) || []) {
      // Iterate through each block in dominance frontier
      for (const lbl of frontier.get(def)!) {
        if (!addedPhi.has(lbl)) {
          addedPhi.add(lbl);

          // Build up phi node with proper data
          const newArgs = [];
          const newLabels = [];
          for (const pred of cfg.predecessors(lbl)) {
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

  const freshVars : Set<string> = new Set();
  // Replace arguments with new names; update destination with fresh name
  for (const instr of blocks.get(blockname)!) {
    // Map to new names on top of the stack
    if (instr.op && instr.op != "phi" && instr.args) {
      instr.args = instr.args!.map((arg) => {
        return stacks.get(arg)![0];
      });
      if (instr.dest) {
        const fresh = instr.dest + "_" + blockname;
        freshVars.add(fresh);
        // Replace with new name
        const newArr = stacks.get(instr.dest)!;
        newArr.unshift(fresh);
        stacks.set(instr.dest, newArr);
        instr.dest = fresh;
      }
    }
  }

  // Update phi-nodes in successor nodes
  const successors = cfg.successors(blockname);
  for (const succ of successors) {
    for (const instr of blocks.get(succ)!) {
      if (instr.op && instr.op == "phi" && instr.args) {
        instr.args = instr.args!.map((arg) => {
          return stacks.get(arg)?.[0] ?? arg;
        });
      }
    }
  }

  // Recurse over all children immediately dominated (in dominator tree)
  for (const child of tree.get(blockname)!) {
    rename(stacks, blocks, child, cfg, tree);
  }

  // Pop recently pushed fresh names
  for (const name of freshVars) {
    for (const [_varname, stack] of stacks) {
      while (stack.length > 0 && stack[0] == name) {
        stack.shift();
      }
    }
  }
};

/*
 * Perform translation into SSA
 */
const enterSSA = (
  blocks: BlockMap,
  args : string[],
  frontier: Map<string, string[]>,
  cfg: Graph,
  tree: Map<string, string[]>,
) => {
  insertPhi(blocks, args, cfg, frontier);
  const stacks = new Map<string, string[]>();
  for (const arg of args) {
    stacks.set(arg, [arg]);
  }
  for (const variable of findAllVars(blocks)) {
    stacks.set(variable, [variable]);
  }
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
      const args = (fn.args || []).map(({name, type}) => name);
      const cfg: Graph = generateCFG(blocks);
      const frontier = dominanceFrontier(cfg);
      const tree = dominanceTree(cfg);

      if (intoSSA) {
        enterSSA(blocks, args, frontier,cfg,tree)
      }

      if (outOfSSA) leaveSSA(blocks);

      fn.instrs = Array.from(blocks.entries()).flatMap((
        [label, instrs],
      ): brilInstruction[] => [{ label: label }, ...instrs]);
    }
  }

  // for JSON output
  console.log(JSON.stringify(program,null, 2));
  // const text = await runBril2Txt(program);
  // console.log(JSON.program);
};

if (import.meta.main) {
  const datastring = await readStdin();
  let args = Deno.args;
  if (args.at(0) === "in") main(datastring, true, false);
  else if (args.at(0) === "out") main(datastring, false, true);
  else main(datastring, true, true);
}

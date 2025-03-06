import {
  basicBlocks,
  brilInstruction,
  brilProgram,
  env,
  generateCFG,
  Graph,
  prettyPrint,
  readStdin,
  runBril2Json,
  runBril2Txt,
} from "./util.ts";
import { dominanceFrontier } from "./dominance.ts";

/**
 * Returns a map from each defined variable in a function to the blocks that defined it
 * @param blocks basic blocks
 */
const defSources = (blocks: Map<string, brilInstruction[]>) => {
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
const predsDominanceFrontier = (frontier : Map<string, string[]>, vertex : string) : number => {
  let total : number = 0;
  for (const [node, neigbors] of frontier) {
    if (neigbors.includes(vertex)) {
      total += 1;
    }
  }
  return total;
}

/*
  Returns a set of all variables defined in a Bril function over a sriesseries of basic blocks
  * @param blocks basic blocks
*/
const findAllVars = (blocks : Map<string, brilInstruction[]>) : Set<string> => {
  const vars  = new Set<string>();
  for (const [label, insns] of blocks) {
    for (const insn of insns) {
      if (insn.dest) {
        vars.add(insn.dest);
      }
    }
  }
  return vars;
}

/*
  Insert Phi nodes using the Dominance Frontier
*/
const insertPhi = (blocks : Map<string, brilInstruction[]>, frontier: Map<string, string[]>) : Map<string, brilInstruction[]> => {
  const vars : Set<string> = findAllVars(blocks);
  const defs : Map<string, Set<string>> = defSources(blocks);
  const addedPhi : Set<string> = new Set<string>();

  for (const variable of vars) {
    for (const def of defs.get(variable)!) {
      for (const lbl of frontier.get(def)!) {
        if (!addedPhi.has(lbl)) {
          blocks.get(lbl)!.unshift({
            op: "phi", dest: variable,
            args : Array.from({length : predsDominanceFrontier(frontier, variable)}, () => variable)
          });
        }

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
const rename = (blocks : Map<string, brilInstruction[]>, blockname: string, cfg : Graph, tree : Map<string, string[]>) => {
  const stacks = new Map<string, Array<string>>();

  for (const instr of blocks.get(blockname)!) {
    instr.args = instr.args?.map((v) => {
      if (stacks.get(v)) {
        return stacks.get(v)![0];
      } else {
        return v;
      }
    });
    instr.dest = instr.dest + "_" + blockname;
    let newArr = stacks.get(instr.dest)!;
    newArr.unshift(instr.dest + "_" + blockname);
    stacks.set(instr.dest, newArr);

    const successors = cfg.successors(blockname);
    for (let succ of successors) {
      for (let insn of blocks.get(succ)!) {
        if (insn.op && insn.op == "phi" && insn.args) {
          let replacements : string[] = [];
          for (let arg of insn.args) {
            replacements.push(stacks.get(arg)![0]);
          }
          insn.args = replacements;
        }
      }
    }

    for (let child of tree.get(blockname)!) {
      rename(blocks, child, cfg, tree);
    }
  }
};

/*
* Perform translation into SSA
*/
const intoSSA = (blocks : Map<string, brilInstruction[]>, frontier : Map<string, string[]>, cfg : Graph, tree : Map<string, string[]>) => {
  insertPhi(blocks, frontier);
  for (let [name, _] of blocks) {
    rename(blocks, name, cfg, tree);
  }
}

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

const outOfSSA = (blocks: Map<string, brilInstruction[]>) => {
  blocks.forEach((block, label, map) => {
    const newBlock = block
        .filter(insn => insn.op !== "get")
        .map(insn => {
          if (insn.op === "set") {
            const [dest, src] = insn.args!;
            return {
              dest,
              args: [src],
              op: "id",
              type: undefined,
            };
          }
          return insn;
        });
    map.set(label, newBlock);
  });
};

const main = async (stdin: string, preservePhiNodes: boolean) => {
  try {
    JSON.parse(stdin);
  } catch {
    stdin = await runBril2Json(stdin);
  }
  const program: brilProgram = JSON.parse(stdin);

  for (const fn of program.functions || []) {
    if (fn.instrs) {
      const [blocks, labelOrdering]: [
        Map<string, brilInstruction[]>,
        Array<string>,
      ] = basicBlocks(fn.instrs);
      const cfg: Graph = generateCFG(blocks, labelOrdering);
      const frontier = dominanceFrontier(cfg);
      const definitions = defSources(blocks);
      let shadow: env = new Map();

      // Out of SSA from Pizlo’s Upsilon/Phi Variant
      if (!preservePhiNodes) {
        outOfSSA(blocks);
      }
      fn.instrs = Array.from(blocks.values()).flat();
    }
  }

  // for JSON output
  // console.log(JSON.stringify(program,null, 2));
  const text = await runBril2Txt(program);
  // console.log(text);
};

if (import.meta.main) {
  const datastring = await readStdin();
  main(datastring, Deno.args[0] === "phi");
}

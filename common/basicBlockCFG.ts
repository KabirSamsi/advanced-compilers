import { Graph } from "./graph.ts";
import { runBril2Json } from "./commandLine.ts";
import {
  BlockMap,
  brilInstruction,
  brilProgram,
} from "./looseTypes.ts";

/*
    Generate a series of basic blocks from a given instructions, and ordering of labels.
    @param instrs – The set of initial, unblocked instructions.
    @return – A series of blocks marked with their corresponding labels, along with an ordering of labels.
*/
export const basicBlocks = (instructions: brilInstruction[]): BlockMap => {
  let blocks = new Map<string, brilInstruction[]>();
  let currentBlock: brilInstruction[] = [];
  let currentBlockLabel: string | undefined = undefined;
  let labelCounter = 0;

  const usedLabels = new Set(
    instructions.filter((i) => i.label).map((i) => i.label!),
  );

  function newLabel(): string {
    while (usedLabels.has(`lbl${labelCounter}`)) labelCounter++;
    const generatedLabel = `lbl${labelCounter++}`;
    usedLabels.add(generatedLabel);
    return generatedLabel;
  }

  for (const instr of instructions) {
    if (instr.label) {
      // new block with explicit label
      if (currentBlockLabel !== undefined || currentBlock.length > 0) {
        // end previous block
        const prevBlockLabel = currentBlockLabel ?? newLabel();
        blocks.set(prevBlockLabel, currentBlock);
      }
      // start the new block
      currentBlockLabel = instr.label;
      currentBlock = [];
    } else {
      // continue the block
      currentBlock.push(instr);

      if (["jmp", "br", "ret"].includes(instr.op ?? "")) {
        // end previous block
        const prevBlockLabel = currentBlockLabel ?? newLabel();
        blocks.set(prevBlockLabel, currentBlock);
        currentBlock = [];
        currentBlockLabel = undefined;
      }
    }
  }
  // finish any remaining blocks
  if (currentBlockLabel !== undefined || currentBlock.length > 0) {
    const prevBlockLabel = currentBlockLabel ?? newLabel();
    blocks.set(prevBlockLabel, currentBlock);
  }

  const entryBlock = blocks.keys().next().value;
  if (entryBlock === undefined) return blocks;

  // ensure entry
  if (
    blocks.entries().some(([_, insns]) =>
      insns.at(-1)?.labels?.includes(entryBlock)
    )
  ) {
    let i: number = 1;
    while (blocks.has("entry" + i)) i += 1;
    const newEntry = "entry" + i;
    const oldBlocks = blocks;
    blocks = new Map<string, brilInstruction[]>();
    blocks.set(newEntry, []);
    for (const [k, v] of oldBlocks) blocks.set(k, v);
  }
  return blocks;
};

/*
    Generate an adjacency list mapping labels of basic blocks to their neighboring blocks
    @param blocks – The set of basic blocks
    @param labels – The set of block labels
    @return – A graph representing the control-flow graph of the function
*/
export const generateCFG = (
  blocks: BlockMap,
): Graph => {
  const labels = blocks.keys().toArray();
  const g = new Graph(labels);
  for (const [label, insns] of blocks) {
    const finalLabels = insns.at(-1)?.labels;
    if (finalLabels) {
      finalLabels.forEach((succ) => {
        g.addEdge(label, succ);
      });
    } else {
      const idx = labels.indexOf(label);
      if (idx != -1 && idx != labels.length - 1) {
        g.addEdge(label, labels[idx + 1]);
      }
    }
  }

  // /* If the first block has no in-edges, don't do anything.
  //   If there are, then add a fresh entry block pointing to the actual first element. */
  // let into_first: boolean = false;
  // for (let node of g.getVertices()) {
  //   if (g.successors(node)!.includes(blocks.keys().toArray()[0])) {
  //     into_first = true;
  //   }
  // }
  //
  // if (into_first) {
  //   let i: number = 1;
  //   while (g.getVertices().includes("entry" + i)) i += 1;
  //   g.addEdge("entry" + i, blocks.keys().toArray()[0] || "")
  // }
  return g;
};

export const CFGs = async (brildata: string) => {
  try {
    JSON.parse(brildata);
  } catch {
    brildata = await runBril2Json(brildata);
  }

  const data: brilProgram = JSON.parse(brildata);

  const ret: Record<string, Graph> = {};
  for (const fn of data.functions || []) {
    const blocks = basicBlocks(fn.instrs ?? []);
    ret[fn.name!] = generateCFG(blocks);
  }
  return ret;
};
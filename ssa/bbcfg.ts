import {Graph} from "../common/graph.ts";
import {runBril2Json} from "../common/commandLine.ts";
import {BlockMap, brilInstruction, brilProgram} from "../common/looseTypes.ts";

/*
    Generate a series of basic blocks from a given instructions, and ordering of labels.
    @param instrs – The set of initial, unblocked instructions.
    @return – A series of blocks marked with their corresponding labels, along with an ordering of labels.
*/
export const basicBlocks = (
  instrs: Array<brilInstruction>,
): BlockMap => {
  // Store all labeled blocks
  let blocks: BlockMap = new Map<
    string,
    Array<brilInstruction>
  >();
  const label_order: string[] = [];
  let label_count: number = 0;

  // Traverse each block and add it
  let curr_label: string = "";
  let curr: Array<brilInstruction> = [];
  for (const insn of instrs) {
    // End block if it is a label or a terminator

    if (insn.label) {
      if (curr.length > 0) {
        if (curr_label == "") {
          blocks.set("lbl" + label_count, curr);
          label_order.push("lbl" + label_count);
          label_count += 1;
        } else {
          blocks.set(curr_label, curr);
          label_order.push(curr_label);
        }
      }
      curr = [];
      curr_label = insn.label; // Update new label
    } else if (insn.op) {
      curr.push(insn);
      if (insn.op == "jmp" || insn.op == "br" || insn.op == "ret") {
        if (curr_label == "") {
          blocks.set("lbl" + label_count, curr);
          label_order.push("lbl" + label_count);
          label_count += 1;
        } else {
          blocks.set(curr_label, curr);
          label_order.push(curr_label);
        }
        curr = [];
        curr_label = ""; // Until we have a new starting label, treat as dead code
      }
    } else {
      curr.push(insn);
    }
  }

  if (curr_label == "") {
    blocks.set("lbl" + label_count, curr);
    label_order.push("lbl" + label_count);
    label_count += 1;
  } else {
    blocks.set(curr_label, curr);
    label_order.push(curr_label);
  }

  const entryBlock = label_order[0];
  const isEntryTargeted = blocks.entries().some(([_, insns]) => {
    return insns.at(-1)?.labels?.includes(entryBlock);
  });
  // TODO kabir i guess check this
  if (isEntryTargeted) {
    let i: number = 1;
    while (blocks.has("entry" + i)) i += 1;
    const newEntry = "entry" + i;
    const oldBlocks = blocks;
    blocks = new Map<string, brilInstruction[]>();
    blocks.set(newEntry, []);
    for (const [k, v] of oldBlocks) blocks.set(k, v);
    label_order.unshift(newEntry);
  }

  // TODO why do we have a dangling lbl0?
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
  const labels = blocks.keys().toArray()
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


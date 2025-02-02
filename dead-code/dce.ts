import { promises as fs } from 'fs';

// Bril program types
type brilInstruction = {label?: string; dest?: string; op?: string; args?: string};
type brilFunction = {instrs?: Array<brilInstruction>; name?: string};
type brilProgram = {functions?: Array<brilFunction>};

// Local-Value Numbering Types
type lvnEntry = {expr?: any, variable : string};
type lvntable = Array<lvnEntry>;

// Flatten matrix to array (use after basic blocking is done to reform original program)
const flatten = (arr : Array<Array<any>>) : Array<any> => {
    let result : Array<any> = [];
    for (let row of arr) {
        for (let elem of row) {
            result.push(elem);
        }
    }
    return result;
}

// Generates a series of basic blocks from a given function
const block = (instrs : Array<brilInstruction>) => {
    // Store all labeled blocks    
    let blocks : Map<string, Array<brilInstruction>> = new Map<string, Array<brilInstruction>>();
    let label_order : Array<String> = ["start"];

    // Traverse each block and add it
    let curr_label : string = "start";
    let curr : Array<brilInstruction> = [];
    for (let insn of instrs) {

        // End block if it is a label or a terminator
        if (insn.label) {
            label_order.push(insn.label);
            if (curr.length > 0) {
                blocks.set(curr_label, curr);
            }
            curr_label = insn.label; // Update new label
            curr = [insn];
        } else if (insn.op) {
            curr.push(insn);
            if (insn.op == "jmp" || insn.op == "br") {
                blocks.set(curr_label, curr);
                curr = [];
                curr_label = ""; // Until we have a new starting label, treat as dead code
            }
        } else {
            curr.push(insn);
        }
    }
    blocks.set(curr_label, curr);

    if (blocks.has("")) {
        blocks.delete("");
    }
    
    return blocks;
}

// Make a pass over a set of instructions and remove any dead ones
const removeUnused = (instructions : Array<brilInstruction>) : Array<brilInstruction> => {
    // Maps each variable to whether it gets referenced in the future or not
    let unused : Set<string> = new Set<string>();

    for (let instruction of instructions) {
        // Scan for variable assignment
        if (instruction.dest) {
            if (!unused.has(instruction.dest)) {
                unused.add(instruction.dest);
            }
        }
        
        // Scan for variable usage
        if (instruction.args) {
            for (let arg of instruction.args) {
                if (unused.has(arg)) {
                    unused.delete(arg);
                }
            }
        }
    }

    // Make a pass and only add in instructions that rely on variable usage
    let results : Array<brilInstruction> = [];
    for (let instruction of instructions) {
        if (instruction.dest) {
            if (!unused.has(instruction.dest)) {
                results.push(instruction);
            }
        } else {
            results.push(instruction);
        }
    }

    return results;
}

// Remove instances where a variable is assigned to, and that value is not used at all.
const removeUnusedDeclarations = (instructions : Array<brilInstruction>) : Array<brilInstruction> => {
    let blocked : Map<string, Array<brilInstruction>> = block(instructions);
    let optimizedBlocks : Array<Array<brilInstruction>> = [];

    for (let basicBlock of blocked) {

        // Cache the most previous assignment; remove it if referenced.
        let usages : Map<string, number> = new Map<string, number>();
        let result : Array<brilInstruction> = [];

        for (let instruction of basicBlock[1]) {

            if (instruction.args) {
                // Scan for any usages of variables
                for (let arg of instruction.args) {
                    // Set to -1 as it has been referenced
                    usages.set(arg, -1);
                }
            }

            if (instruction.dest) {
                if (usages.has(instruction.dest)) {
                    // If there was an (unitialized) value previously stored there, kick it out
                    if (usages.get(instruction.dest) != -1) {
                        result.splice(usages.get(instruction.dest) ?? 0, 1);
                    }
                }
                usages.set(instruction.dest, result.length);
            }
            result.push(instruction);
        }
        optimizedBlocks.push(result);
    }
    return flatten(optimizedBlocks);
}

// Eliminate all dead code until convergence from a given Bril function
const deadCodeElimination = (fn : brilFunction) => {
    const instructions : Array<brilInstruction> = fn.instrs || [];
    let optimized : Array<brilInstruction> = removeUnusedDeclarations(removeUnused(instructions));
    let prev_length : number = instructions.length;

    // Iterate until convergence
    while (prev_length > optimized.length) {
        prev_length = optimized.length;
        optimized = removeUnusedDeclarations(removeUnused(optimized));
    }
    return optimized;
}

// Local value numbering
const localValueNumbering = (fn : brilFunction) : Array<brilInstruction> => {
    const instructions : Array<brilInstruction> = fn.instrs || [];
    const blocked : Map<string, Array<brilInstruction>> = block(instructions);
    return instructions;
}

// Main loop
async function main() {
    try {
        const fileData : string = await fs.readFile(process.argv[2], 'utf-8');
        const data : brilProgram = JSON.parse(fileData);
        const result : brilProgram = {functions: []};

        // Iterate through each function defined in the Bril program
        for (const fn of data.functions || []) {
            if (result.functions) {
                result.functions.push({"name" : fn.name, "instrs": deadCodeElimination(fn)});
            }
        }
        console.log(JSON.stringify(result));

    } catch (e) {
        console.log(`Error: ${e}`);
    }
}

main();
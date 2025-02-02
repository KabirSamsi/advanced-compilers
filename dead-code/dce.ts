import { promises as fs } from 'fs';

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
const block = (instrs : Array<object>) => {
    // Store all labeled blocks    
    let blocks : Map<string, Array<object>> = new Map<string, Array<object>>();
    let label_order : Array<String> = ["start"];

    // Traverse each block and add it
    let curr_label : string = "start";
    let curr : Array<object> = [];
    for (let insn of instrs) {

        // End block if it is a label or a terminator
        if (insn.hasOwnProperty("label")) {
            let labeledInsn : {[label : string] : any} = insn;
            label_order.push(labeledInsn.label);
            if (curr.length > 0) {
                blocks.set(curr_label, curr);
            }
            curr_label = labeledInsn.label; // Update new label
            curr = [insn];
        } else if (insn.hasOwnProperty("op")) {
            curr.push(insn);
            let labeledInsn : {[op : string] : any} = insn;
            if (labeledInsn.op == "jmp" || labeledInsn.op == "br") {
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
const removeUnused = (instructions : Array<object>) : Array<object> => {
    // Maps each variable to whether it gets referenced in the future or not
    let unused : Set<string> = new Set<string>();

    for (let instruction of instructions) {
        // Scan for variable assignment
        if (instruction.hasOwnProperty("dest")) {
            // Pattern match dest field by typecasting
            const obj: { [dest: string]: any } = instruction;
            if (!unused.has(obj.dest)) {
                unused.add(obj.dest);
            }
        }
        
        // Scan for variable usage
        if (instruction.hasOwnProperty("args")) {
            const obj: { [args: string]: any } = instruction;
            // Pattern match args field by typecasting
            for (let arg of obj.args) {
                if (unused.has(arg)) {
                    unused.delete(arg);
                }
            }
        }
    }

    // Make a pass and only add in instructions that rely on variable usage
    let results : Array<object> = [];
    for (let instruction of instructions) {
        if (instruction.hasOwnProperty("dest")) {
            const obj: { [dest: string]: any } = instruction;
            if (!unused.has(obj.dest)) {
                results.push(instruction);
            }
        } else {
            results.push(instruction);
        }
    }

    return results;
}

// Remove instances where a variable is assigned to, and that value is not used at all.
const removeUnusedDeclarations = (instructions : Array<object>) : Array<Array<object>> => {
    let blocked : Map<string, Array<Object>> = block(instructions);
    let optimizedBlocks : Array<Array<Object>> = [];

    for (let basicBlock of blocked) {

        // Cache the most previous assignment; remove it if referenced.
        let usages : Map<string, number> = new Map<string, number>();
        let result : Array<object> = [];

        for (let instruction of basicBlock[1]) {

            if (instruction.hasOwnProperty("args")) {
                // Scan for any usages of variables
                const obj : { [args : string] : any } = instruction;
                for (let arg of obj.args) {
                    // Set to -1 as it has been referenced
                    usages.set(arg, -1);
                }
            }

            if (instruction.hasOwnProperty("dest")) {
                // Pattern match dest field by typecasting
                const obj: { [dest: string]: any } = instruction;
                if (usages.has(obj.dest)) {
                    // If there was an (unitialized) value previously stored there, kick it out
                    if (usages.get(obj.dest) != -1) {
                        result.splice(usages.get(obj.dest) ?? 0, 1);
                    }
                }
                usages.set(obj.dest, result.length);
            }

            result.push(instruction);
        }
        optimizedBlocks.push(result);
    }
    return flatten(optimizedBlocks);
}

// Main loop
async function main() {
    try {
        const fileData : string = await fs.readFile(process.argv[2], 'utf-8');
        const data : { [functions: string] : any } = JSON.parse(fileData);
        let result_object : {functions : Array<object>} = {functions: []};

        // Iterate through each function defined in the Bril program
        for (const fn of data.functions) {
            const instructions : Array<object> = fn.instrs;
            let optimized : Array<object> = removeUnusedDeclarations(removeUnused(instructions));
            let prev_length : number = instructions.length;

            // Iterate until convergence
            while (prev_length > optimized.length) {
                prev_length = optimized.length;
                optimized = removeUnusedDeclarations(removeUnused(optimized));
            }

            let new_function : object = {"name" : fn.name, "instrs": optimized};
            result_object.functions.push(new_function);
        }

        console.log(JSON.stringify(result_object));

    } catch (e) {
        console.log(`Error: ${e}`);
    }
}

main();
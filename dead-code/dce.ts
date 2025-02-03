import { promises as fs } from 'fs';

// Bril program types
type brilInstruction = {label?: string; dest?: string; op?: string; args?: Array<string>, functions?: Array<string>, labels?: Array<string>, value?: any, type?: any};
type brilFunction = {instrs?: Array<brilInstruction>; name?: string};
type brilProgram = {functions?: Array<brilFunction>};

type lvnExpr =
| {name : "const", value: any, type : any}
| {name : "op", op : string | undefined, args : (Array<number> | undefined),  type : any, functions : (Array<string> | undefined), labels : (Array<string> | undefined)}

// Local-Value Numbering Types
type lvnEntry = {expr?: lvnExpr, variable : string};
type lvntable = Array<lvnEntry>;
type store = Map<string, number>;

/*
    Flatten an Array<Array<any>> to a flat Array<any>.
    @param instrs – The set of initial, unblocked instructions.
    @return – A series of blocks marked with their corresponding labels.
*/
const flatten = (arr : Array<Array<any>>) : Array<any> => {
    let result : Array<any> = [];
    for (let row of arr) {
        for (let elem of row) {
            result.push(elem);
        }
    }
    return result;
}

/*
    Generate a series of basic blocks from a given instructions.
    @param instrs – The set of initial, unblocked instructions.
    @return – A series of blocks marked with their corresponding labels.
*/
const basicBlock = (instrs : Array<brilInstruction>) : Map<string, Array<brilInstruction>> => {
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

/*
    Make a pass over a set of instructions.
    Remove any declarations that are not further referenced.
    Iterates til convergence (until making a pass removes no further instructions).
    @param instructions – List of Bril instructions to be optimized.
    @return – Array of Bril instructions with any unused variables removed.
*/
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

/*
    Remove instances where a variable is assigned to, and that value is not used at all.
    @param instructions – Array of Bril instructions to be optimized.
    @return – Array of Bril instructions with any unused declarations removed.
*/
const removeUnusedDeclarations = (instructions : Array<brilInstruction>) : Array<brilInstruction> => {
    let blocked : Map<string, Array<brilInstruction>> = basicBlock(instructions);
    let optimizedBlocks : Array<Array<brilInstruction>> = [];

    for (let block of blocked) {

        // Cache the most previous assignment; remove it if referenced.
        let usages : Map<string, number> = new Map<string, number>();
        let result : Array<brilInstruction> = [];

        for (let instruction of block[1]) {

            // Scan for any usages of variables
            if (instruction.args) {
                for (let arg of instruction.args) {
                    // Set to -1 as it has been referenced
                    usages.set(arg, -1);
                }
            }

            // Scan for initialization of variables
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

/*
    Eliminate all dead code until convergence from a given Bril function.
    @param fn – Bril function whose dead code is to be eliminated.
    @return – Array of Bril instructions with any dead code removed.
*/
const deadCodeElimination = (instructions : Array<brilInstruction>) : Array<brilInstruction> => {
    let optimized : Array<brilInstruction> = removeUnusedDeclarations(removeUnused(instructions));
    let prev_length : number = instructions.length;

    // Iterate until convergence
    while (prev_length > optimized.length) {
        prev_length = optimized.length;
        optimized = removeUnusedDeclarations(removeUnused(optimized));
    }
    return optimized;
}

/*
    Locally number values within a basic block and eliminate repeated value initializations.
    @param fn – Bril function whose dead code is to be eliminated.
    @return – Array of Bril instructions with repeated instructions factored out.
*/
const valueBlock  = (block : Array<brilInstruction>) : Array<brilInstruction> => {
    let result : Array<brilInstruction> = [];
    let lvnTable : lvntable = [];
    let store : store = new Map<string, number>();
    const valueIdx : Map<string, number> = new Map<string, number>();

    // Iterate through each block
    for (let instruction of block) {
        if (!instruction.op || (instruction.op && instruction.op == "jmp")) {
            result.push(instruction);

        } else if (instruction.dest && instruction.op == "const") {
            let parsed : lvnExpr = {name: "const", value : instruction.value, type: instruction.type};
            let parsedRepr : string = JSON.stringify({name: "const", value : instruction.value});

            if (valueIdx.has(parsedRepr)) {
                // Find location within table, update pointer, and add id pointer to instruction set
                let idxptr : number | undefined = (valueIdx.get(parsedRepr));
                if (idxptr == undefined) {
                    idxptr = -1;
                }
                store.set(instruction.dest, idxptr);
                result.push({
                    dest : instruction.dest,
                    args : [lvnTable[idxptr].variable],
                    op : "id",
                    type : instruction.type
                });

            } else { // If not present in table, add it in and push instruction
                valueIdx.set(parsedRepr, lvnTable.length);
                store.set(instruction.dest, lvnTable.length);
                lvnTable.push({expr: parsed, variable : instruction.dest})
                result.push(instruction);
            }

        } else if (instruction.args) {
        
            // If the instruction does not have a destination, just substitute the arguments in
            if (!instruction.dest) {
                // Index each arg based on its pointer as a variable in the table
                let argMappings : Array<string> = [];
                for (let arg of instruction.args) {
                    if (store.has(arg)) {
                        argMappings.push(lvnTable[store.get(arg) || -1].variable);
                    } else {
                        argMappings.push(arg);
                    }
                }
                result.push({
                    op : instruction.op,
                    args : argMappings,
                    type : instruction.type,
                    functions : instruction.functions,
                    labels : instruction.labels
                });
            
            // If the instruction has a destination, try to replace its arguments and remove it if possible
            } else if (instruction.dest) {
                // Index each arg based on its pointer as a variable in the table
                let argMappings : Array<number> = [];
                for (let arg of instruction.args) {
                    let stored = store.get(arg);
                    if (stored == undefined) {
                        argMappings.push(-1);
                    } else {
                        argMappings.push(stored);
                    }
                }
                
                /* 
                    Parse to an LVN expression which can be looked up.
                    FLAG: Make arguments order-independent for commutative operations.
                */
                let parsedInsn : lvnExpr = {
                    name : "op",
                    op : instruction.op,
                    args : argMappings,
                    functions : instruction.functions,
                    labels : instruction.labels,
                    type : instruction.type
                }

                let parsedRepr : string = JSON.stringify(parsedInsn);
    
                // If this instruction already exists, then just re-reference as an id
                if (valueIdx.has(parsedRepr)) {
                    let idxptr : number = valueIdx.get(parsedRepr) || -1;
                    store.set(instruction.dest, idxptr);
                    result.push({
                        dest : instruction.dest,
                        args : [lvnTable[idxptr].variable],
                        op : "id",
                        type : instruction.type
                    });
    
                } else {
                    store.set(instruction.dest, lvnTable.length);
                    valueIdx.set(parsedRepr, lvnTable.length);
                    lvnTable.push({expr : parsedInsn, variable : instruction.dest});
                    let varMappings : Array<string> = [];
                    for (let arg of argMappings) {
                        varMappings.push(lvnTable[arg].variable);
                    }

                    result.push({
                        dest : instruction.dest,
                        args : varMappings,
                        op : instruction.op,
                        type : instruction.type,
                        functions : instruction.functions,
                        labels :  instruction.labels
                    });
                }
            }
        }

        /* Algorithm:
        
        for each instruction:
            if it is a label or jump:
                don't update the table;
                add it to the resultant list of instructions
            
            if it is a const:
                Look it up in the table.
                If it is present, just point this variable to that position
                    Add an identity pointer to the list of instructions (id <canonical home>)
                Otherwise
                    Add it to the list of instructions

        
            if it contains arguments:
                Look up each argument's number in the table
                    Get its numerical index
                Replace all arguments in the expression with their corresponding numbers
                
                If the command is 'id', just draw a new pointer in the table. Add an instruction that would do ID as well.
                    
                - For more complex pass – store table of 'order-irrelevant' commands.
                    - If the op here is order-irrelevant, sort the arguments.
                Check if the resultant expression already exists in the table
                    If so, just create a pointer
                    Otherwise, make a new row element
                    - If the op here is order-irrelevant, sort the arguments.
        */
    }
    return result;
}

/*
    Apply local value numbering to the instructions comprising an entire function.
    @param fn – Bril function whose dead code is to be eliminated.
    @return – Array of Bril instructions with repeated instructions factored out.
*/
const localValueNumbering = (instructions : Array<brilInstruction>) : Array<brilInstruction> => {
    const blocked : Map<string, Array<brilInstruction>> = basicBlock(instructions);
    let result : Array<Array<brilInstruction>> = [];

    for (let block of blocked) {
        result.push(valueBlock(block[1]));
    }

    return flatten(result);
}

/*
    Main function.
    Open a file specified from the command line and run each function through DCE and LVN passes.
*/
async function main() {
    try {
        const fileData : string = await fs.readFile(process.argv[2], 'utf-8');
        const data : brilProgram = JSON.parse(fileData);
        const result : brilProgram = {functions: []};

        // Iterate through each function defined in the Bril program
        for (const fn of data.functions || []) {
            if (result.functions) {
                let pass : Array<brilInstruction> = deadCodeElimination(fn.instrs || []);
                pass = localValueNumbering(pass);
                pass = deadCodeElimination(pass);

                result.functions.push({"name" : fn.name, "instrs": pass});
            }
        }
        console.log(JSON.stringify(result));

    } catch (e) {
        console.log(`Error: ${e}`);
    }
}

main();

import { stdin } from "process";

// Bril program types
type brilInstruction = {
    label?: string;
    dest?: string;
    op?: string;
    args?: Array<string>,
    functions?: Array<string>,
    labels?: Array<string>,
    value?: any,
    type?: any
};

type brilFunction = {
    instrs?: Array<brilInstruction>;
    name?: string;
    args?: Array<string>
};

type brilProgram = {functions?: Array<brilFunction>};

// LVN Usage Types
type lvnExpr =
| {
    name : "const",
    value: any,
    type : any
  }
| {
    name : "op",
    op : string | undefined,
    args : (Array<number> | undefined),
    type : any,
    functions : (Array<string> | undefined),
    labels : (Array<string> | undefined)
  }

type lvnEntry = {
    expr?: lvnExpr,
    variable : string
};
type lvntable = Array<lvnEntry>;
type store = Map<string, number>;

// Store order-irrelevant operations
const orderIrrelevant : Set<string> = new Set<string>(["add", "mul", "eq", "ne", "and", "or"]);
const arithReduce : Set<string> = new Set<string>(["add", "mul", "sub", "div"]);
const boolReduce : Set<string> = new Set<string>(["and", "or", "eq", "le","ge", "lt", "gt", "ne"]);

// Maps constant-optimizable opcodes to their relative functions
const reduceMap : Map<string, Function> = new Map<string, Function>([
    ["add", (x : number, y : number) => x+y],
    ["mul", (x : number, y : number) => x*y],
    ["sub", (x : number, y : number) => x-y],
    ["eq", (x : number, y : number) => x == y],
    ["ne", (x : number, y : number) : boolean => x != y],
    ["le", (x : number, y : number) : boolean => x <= y],
    ["ge", (x : number, y : number) : boolean => x >= y],
    ["lt", (x : number, y : number) : boolean => x < y],
    ["gt", (x : number, y : number) : boolean => x > y],
    ["and", (x : boolean, y : boolean) : boolean => x && y],
    ["or", (x : boolean, y : boolean) : boolean => x || y],
]);

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
    // Final parsing result
    let result : Array<brilInstruction> = [];
    
    // Stores LVN expressions
    let lvnTable : lvntable = [];
    
    // Maps variables to their LVN table rows
    const store : store = new Map<string, number>();
    
    // Maps JSON parsing of LVN table entries to their rows
    const valueIdx : Map<string, number> = new Map<string, number>();

    // Maps variables to their latest new name in the LVN table.
    const newNaming : Map<string, string> = new Map<string, string>();
    
    // Count number of variable assignments made
    let declarationsCounted : number = 0;

    for (let instruction of block) {
        /*
            * If the instruction is a label or jump, don't update the table.
            * Only add it to the resultant list of instructions.
        */
        if (!instruction.op || (instruction.op && instruction.op == "jmp")) {
            result.push(instruction);

        /*
            * If the variable is a const, look it up in the table.
            * If it is present, point this variable to that table position.
            * Add an identity pointer to the list of instructions (id <canonical home>)
            * Otherwise, add it to the list of instructions.
        */
        } else if (instruction.dest && instruction.op == "const") {
            let parsed : lvnExpr = {
                name: "const",
                value : instruction.value,
                type: instruction.type
            };

            let parsedRepr : string = JSON.stringify(parsed);

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

        /*
            If the instruction contains arguments:
            - Look up each argument's number in the table
                - Get its numerical index
            - Replace all arguments in the expression with their corresponding numbers
        */
        
        } else if (instruction.args) {
            /*  If the instruction does not have a destination (no assignment),
                just substitute the arguments in */
            if (!instruction.dest) {
                // Index each arg based on its pointer as a variable in the table
                let argMappings : Array<string> = [];

                for (let arg of instruction.args) {
                    if (store.has(arg)) {
                        let storeIdx : number | undefined = store.get(arg);
                        if (storeIdx == undefined) {
                            storeIdx = -1;
                        }
                        argMappings.push(lvnTable[storeIdx].variable);
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
            
            /*  If the instruction has a destination,
                try to replace its arguments and remove it if possible
            */
            } else if (instruction.dest) {
                /*
                    * If the command is 'id', just draw a new pointer in the table.
                    * Add an instruction that would do ID as well.                    
                */
                if (instruction.op && instruction.op == "id") {
                    let var_dest : number | undefined = store.get(instruction.args[0]);
                    if (var_dest == undefined) {
                        var_dest = -1;
                    }

                    let arg_dest : string;
                    if (var_dest == -1) {
                        arg_dest = instruction.args[0];
                    } else {
                        store.set(instruction.dest, var_dest);
                        arg_dest = lvnTable[var_dest].variable;
                    }
                    
                    result.push({
                        dest : instruction.dest,
                        op : "id",
                        args : [arg_dest],
                        type : instruction.type,
                        functions : instruction.functions,
                        labels : instruction.labels
                    });
                
                } else { // Otherwise, handle properly
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

                    // Binary reduction for constant elements
                    let arithReduceable : boolean = true;
                    let booleanReduceable : boolean = true;
                    let totalA : number = 0;
                    let totalB : boolean = false;

                    if (arithReduce.has(instruction.op)) {
                        let arg1 : number = argMappings[0];
                        let arg2 : number = argMappings[1];
                        if (arg1 != -1 && arg2 != -1) {
                            if (lvnTable[arg1].expr && lvnTable[arg1].expr.name == "const"
                                &&
                                lvnTable[arg2].expr && lvnTable[arg2].expr.name == "const"
                            ) {
                                if (instruction.op == "div") {
                                    if (lvnTable[arg2].expr.value != 0) {
                                        totalA = lvnTable[arg1].expr.value / lvnTable[arg2].expr.value;
                                    } else {
                                        arithReduceable = false;
                                    }
                                } else {
                                    let opFn : Function | undefined = reduceMap.get(instruction.op);
                                    if (!opFn) {
                                        arithReduceable = false;    
                                    } else {
                                        totalA = opFn(lvnTable[arg1].expr.value, lvnTable[arg2].expr.value);
                                    }
                                }
                            } else {
                                arithReduceable = false;
                            }

                        } else {
                            arithReduceable = false;
                        }

                    } else if (boolReduce.has(instruction.op)) {
                        arithReduceable = false;
                        let arg1 : number = argMappings[0];
                        let arg2 : number = argMappings[1];
                        if (arg1 != -1 && arg2 != -1) {
                            if (lvnTable[arg1].expr && lvnTable[arg1].expr.name == "const"
                                &&
                                lvnTable[arg2].expr && lvnTable[arg2].expr.name == "const"
                            ) {
                                let opFn : Function | undefined = reduceMap.get(instruction.op);
                                if (!opFn) {
                                    booleanReduceable = false;
                                } else {
                                    totalB = opFn(lvnTable[arg1].expr.value, lvnTable[arg2].expr.value);
                                }
                            } else {
                                booleanReduceable = false;
                            }
                        } else {
                            booleanReduceable = false;
                        } 

                    } else {
                        arithReduceable = false;
                        booleanReduceable = false;
                    }
                    
                    /* 
                        Parse to an LVN expression which can be looked up.
                        Make arguments order-independent for commutative operations.
                    */
                    let parsedInsn : lvnExpr;
                    if (arithReduceable) {
                        parsedInsn = {
                            name : "const",
                            value : totalA,
                            type : instruction.type
                        }
                    } else if (booleanReduceable) {
                        parsedInsn = {
                            name : "const",
                            value : totalB,
                            type : instruction.type
                        }
                    } else {
                        parsedInsn = {
                            name : "op",
                            op : instruction.op,
                            args : [],
                            functions : instruction.functions,
                            labels : instruction.labels,
                            type : instruction.type
                        }

                        // If the command is order-irrelevant, sort its arguments.
                        if (orderIrrelevant.has(instruction.op)) {
                            parsedInsn.args = argMappings.sort();
                        } else {
                            parsedInsn.args = argMappings;
                        }
                    }

                    let parsedRepr : string = JSON.stringify(parsedInsn);
        
                    // If this instruction already exists, then just re-reference as an id
                    if (valueIdx.has(parsedRepr)) {
                        let idxptr : number | undefined = valueIdx.get(parsedRepr);
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
        
                    } else {
                        store.set(instruction.dest, lvnTable.length);
                        valueIdx.set(parsedRepr, lvnTable.length);
                        lvnTable.push({expr : parsedInsn, variable : instruction.dest});
                        let varMappings : Array<string> = [];

                        for (let i = 0; i < argMappings.length; i++) {
                            if (argMappings[i] == -1) {
                                varMappings.push(instruction.args[i]);
                            } else {
                                varMappings.push(lvnTable[argMappings[i]].variable);
                            }
                        }

                        if (arithReduceable)  {
                            result.push({
                                dest : instruction.dest,
                                value : totalA,
                                op : "const",
                                type : instruction.type
                            });
                        } else if (booleanReduceable)  {
                            result.push({
                                dest : instruction.dest,
                                value : totalB,
                                op : "const",
                                type : instruction.type
                            });
                        } else {
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
            }
        }
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
const main = () => {
    process.stdin.setEncoding("utf8");
    let dataString : string = "";

    stdin.on("data", chunk => {
        dataString += chunk;
    });
    
    stdin.on("end", () => {
        
        try {
            const data = JSON.parse(dataString);
            const result : brilProgram = {functions: []};

            // Iterate through each function defined in the Bril program
            for (const fn of data.functions || []) {
                if (result.functions) {
                    let pass : Array<brilInstruction> = deadCodeElimination(fn.instrs || []);
                    pass = localValueNumbering(pass);
                    pass = deadCodeElimination(pass);
        
                    result.functions.push({"name" : fn.name, "instrs": pass, "args": fn.args});
                }
            }
            console.log(JSON.stringify(result));

        } catch (error) {
            console.error("Invalid JSON:", error);
        }
    });
}

main();
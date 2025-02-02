import { promises as fs } from 'fs';

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
const removeUnusedDeclarations = (instructions : Array<object>) : Array<object> => {
    // Cache the most previous assignment; remove it if referenced.
    let usages : Map<string, number> = new Map<string, number>();
    let result : Array<object> = [];

    for (let instruction of instructions) {
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

        if (instruction.hasOwnProperty("args")) {
            // Scan for any usages of variables
            const obj : { [args : string] : any } = instruction;
            for (let arg of obj.args) {
                // Set to -1 as it has been referenced
                usages.set(arg, -1);
            }
        }
        result.push(instruction);
    }

    return result;
}

// Main loop
async function main() {
    try {
        const fileData : string = await fs.readFile(`./test/${process.argv[2]}.json`, 'utf-8');
        const data : { [functions: string] : any } = JSON.parse(fileData);
        let result_object : {functions : Array<object>} = {functions: []};

        // Iterate through each function defined in the Bril program
        for (const fn of data.functions) {
            const instructions : Array<object> = fn.instrs;
            let optimized : Array<object> = removeUnused(instructions);
            let prev_length : number = instructions.length;

            // Iterate until convergence
            while (prev_length > optimized.length) {
                prev_length = optimized.length;
                optimized = removeUnusedDeclarations(removeUnused(optimized));
            }

            let new_function : object = {"name" : fn.name, "instrs": optimized};
            result_object.functions.push(new_function);
        }

        try {
            await fs.writeFile(`./test/${process.argv[2]}_optimized.json`, JSON.stringify(result_object));
            console.log("Optimized output written successfully.");
        } catch(err) {
            console.log('Error writing file:', err);
        }

    } catch (err) {
        console.log('Error reading file:', err);
    }
}

main();
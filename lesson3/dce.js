"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const data = __importStar(require("./test/double.json"));
// Make a pass over a set of instructions and remove any dead ones
const removeUnused = (instructions) => {
    // Maps each variable to whether it gets referenced in the future or not
    let unused = new Set();
    for (let instruction of instructions) {
        // Scan for variable assignment
        if (instruction.hasOwnProperty("dest")) {
            // Pattern match dest field by typecasting
            const obj = instruction;
            if (!unused.has(obj.dest)) {
                unused.add(obj.dest);
            }
        }
        // Scan for variable usage
        if (instruction.hasOwnProperty("args")) {
            const obj = instruction;
            // Pattern match args field by typecasting
            for (let arg of obj.args) {
                if (unused.has(arg)) {
                    unused.delete(arg);
                }
            }
        }
    }
    // Make a pass and only add in instructions that rely on variable usage
    let results = [];
    for (let instruction of instructions) {
        if (instruction.hasOwnProperty("dest")) {
            const obj = instruction;
            if (!unused.has(obj.dest)) {
                results.push(instruction);
            }
        }
        else {
            results.push(instruction);
        }
    }
    return results;
};
// Remove instances where a variable is assigned to, and that value is not used at all.
const removeUnusedDeclarations = (instructions) => {
    var _a;
    // Cache the most previous assignment; remove it if referenced.
    let usages = new Map();
    let result = [];
    for (let instruction of instructions) {
        if (instruction.hasOwnProperty("dest")) {
            // Pattern match dest field by typecasting
            const obj = instruction;
            if (usages.has(obj.dest)) {
                // If there was an (unitialized) value previously stored there, kick it out
                if (usages.get(obj.dest) != -1) {
                    result.splice((_a = usages.get(obj.dest)) !== null && _a !== void 0 ? _a : 0, 1);
                }
            }
            usages.set(obj.dest, result.length);
        }
        if (instruction.hasOwnProperty("args")) {
            // Scan for any usages of variables
            const obj = instruction;
            for (let arg of obj.args) {
                // Set to -1 as it has been referenced
                usages.set(arg, -1);
            }
        }
        result.push(instruction);
    }
    return result;
};
// Main loop
const main = () => {
    let result_object = { functions: [] };
    // Iterate through each function defined in the Bril program
    for (const fn of data.functions) {
        const instructions = fn.instrs;
        let optimized = removeUnused(instructions);
        let prev_length = instructions.length;
        // Iterate until convergence
        while (prev_length > optimized.length) {
            prev_length = optimized.length;
            optimized = removeUnusedDeclarations(removeUnused(optimized));
        }
        let new_function = { "name": fn.name, "instrs": optimized };
        result_object.functions.push(new_function);
    }
    fs_1.default.writeFile('./test/double_optimized.json', JSON.stringify(result_object), (err) => {
        if (err) {
            console.log('Error writing file:', err);
        }
    });
};
main();

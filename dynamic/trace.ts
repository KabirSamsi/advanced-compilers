import {readStdin, runBril2Json} from "../common/commandLine.ts";
import {brilFunction, brilInstruction, brilProgram} from "../common/looseTypes.ts";
import {evalProg, TraceItem} from "./brili.ts";
import * as bril from "./bril-ts/bril.ts";

/* Main function */
const main = async () => {
    let datastring = await readStdin();
    // Try to parse as JSON first
    try {
        JSON.parse(datastring);
    } catch {
        // If JSON parsing fails, assume it's Bril text representation and convert
        datastring = await runBril2Json(datastring);
    }
    const data: brilProgram = JSON.parse(datastring);

    const realLog = console.log;
    // suppress brili log
    console.log = () => {};
    let trace: TraceItem[];
    try {
        trace = evalProg(data as bril.Program) || [];
    } finally {
        console.log = realLog;
    }
    const p = optimize(data,trace!)
    console.log(JSON.stringify(p,null, 2));
};

export function traceToSpec(trace: TraceItem[]): brilInstruction[] {
    const abortLabel = "trace_abort";
    const specInstrs: brilInstruction[] = [];
    let tmpCounter = 0;

    specInstrs.push({ op: "speculate" });

    for (const item of trace) {
        const instr = item.instr;

        switch (instr.op) {
            case "br": {
                const taken = item.takenLabel;
                const [lTrue, lFalse] = instr.labels!;
                const cond = instr.args![0];

                if (taken === lTrue) {
                    specInstrs.push({ op: "guard", args: [cond], labels: [abortLabel] });
                } else if (taken === lFalse) {
                    const notVar = `%not${tmpCounter++}`;
                    specInstrs.push({ op: "not", dest: notVar, args: [cond] });
                    specInstrs.push({ op: "guard", args: [notVar], labels: [abortLabel] });
                } else {
                    throw new Error("don't know which we took")
                }
                break;
            }

            case "jmp": {
                // unconditional is already part of trace
                break;
            }

            case "ret":
                // specInstrs.push(instr);
                // specInstrs.push({ op: "commit" });
                // break;

            default:
                specInstrs.push(instr);
        }
    }

    specInstrs.push({ op: "commit" });
    return specInstrs;
}


function optimize(program: brilProgram, trace: TraceItem[]): brilProgram {
    if (!trace.length) return program;

    const abortLabel = "trace_abort";

    const mainFn = program.functions?.find(fn => fn.name === "main");
    if (!mainFn) {
        throw new Error("No main but nonempty trace");
    }

    const specInstrs = traceToSpec(trace);

    const newMain: brilFunction = {
        ...mainFn,
        instrs: [
            ...specInstrs,
            { op: "jmp", labels: [".DONE"] },
            { label: abortLabel },
            ...(mainFn.instrs!),
            { label: ".DONE" }
        ]
    };

    const newFuncs = program.functions!.map(fn =>
        fn.name === "main" ? newMain : fn
    );

    return { functions: newFuncs };
}

if (import.meta.main) {
    main();
}

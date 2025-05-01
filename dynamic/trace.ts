import {readStdin, runBril2Json} from "../common/commandLine.ts";
import {brilProgram} from "../common/looseTypes.ts";
import {evalProg} from "./brili.ts";
import * as bril from "./bril-ts/bril.ts";

/* Main function */
const main = async () => {
    const args = Deno.args; // Get command-line arguments

    let datastring = await readStdin();
    // // Try to parse as JSON first
    try {
        JSON.parse(datastring);
    } catch {
        // If JSON parsing fails, assume it's Bril text representation and convert
        datastring = await runBril2Json(datastring);
    }
    //
    const data: brilProgram = JSON.parse(datastring);
    const trace = evalProg(data as bril.Program)
    console.log(trace);
};

if (import.meta.main) {
    main();
}

export const runBril2Txt = async (program) => {
    const process = new Deno.Command("bril2txt", {
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
    });
    const child = process.spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(JSON.stringify(program)));
    await writer.close();
    const { stdout, stderr } = await child.output();
    if (stderr.length > 0) {
        console.error("Error running bril2json:", new TextDecoder().decode(stderr));
        Deno.exit(1);
    }
    return new TextDecoder().decode(stdout);
};
/* Convert Bril text programs into JSON representation using bril2json */
export const runBril2Json = async (datastring) => {
    const process = new Deno.Command("bril2json", {
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
    });
    const child = process.spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(datastring));
    await writer.close();
    const { stdout, stderr } = await child.output();
    if (stderr.length > 0) {
        console.error("Error running bril2json:", new TextDecoder().decode(stderr));
        Deno.exit(1);
    }
    return new TextDecoder().decode(stdout);
};
export const readStdin = async () => {
    const stdin = Deno.stdin.readable
        .pipeThrough(new TextDecoderStream())
        .getReader();
    let datastring = "";
    while (true) {
        const { value, done } = await stdin.read();
        if (done)
            break;
        datastring += value;
    }
    return datastring.trim();
};
export const prettyPrint = (map) => {
    const obj = Object.fromEntries(Array.from(map, ([key, valueSet]) => [key, Array.from(valueSet).sort()]));
    const sortedObj = Object.keys(obj)
        .sort()
        .reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
    }, {});
    console.log(JSON.stringify(sortedObj, null, 2));
};
//# sourceMappingURL=commandLine.js.map
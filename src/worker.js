importScripts("https://cdn.jsdelivr.net/pyodide/v0.18.0/full/pyodide.js");

const clear = () => postMessage({ kind: 'clear' });
const output = value => postMessage({ kind: 'output', value });

const turtle = {};
turtle.test = function (val) { output(`got this value in js: ${val}`); }

const pyodideLoader = (async () => {
    const mod = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.18.0/full/",
        stdout: output,
        stderr: output,
    });
    console.log('Loaded pyodide');

    mod.registerJsModule('turtle', turtle);

    // get a snapshot of the globals after init so we can delete user-defined ones (and imports)
    const baseGlobals = new Set();
    for (const x of mod.globals) baseGlobals.add(x);
    mod.resetGlobals = () => {
        const remove = [];
        for (const x of mod.globals) {
            if (!baseGlobals.has(x)) remove.push(x);
        }
        for (const x of remove) {
            mod.globals.delete(x);
        }
    };

    // apply any runtime modifications we need - imports will be wiped, but module changes will persist
    await mod.runPythonAsync(`
import time
def sync_sleep(t):
    v = time.time() + t
    while time.time() < v:
        pass
time.sleep = sync_sleep
`);

    return mod;
})();

async function run(code) {
    const pyodide = await pyodideLoader;
    try {
        clear();

        pyodide.resetGlobals();
        await pyodide.loadPackagesFromImports(code, console.log, console.log);
        await pyodide.runPythonAsync(code);
    } catch (err) {
        output(`\n${err}\n`);
    }
}

onmessage = async e => {
    await run(e.data.code);
    postMessage({ kind: 'finished' });
};

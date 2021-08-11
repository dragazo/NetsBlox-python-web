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

    return mod;
})();

async function run(code) {
    const pyodide = await pyodideLoader;
    try {
        clear();
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

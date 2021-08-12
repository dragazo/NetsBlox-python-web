importScripts('https://cdn.jsdelivr.net/pyodide/v0.18.0/full/pyodide.js');

let g_pyodide = undefined;

const clear = () => postMessage({ kind: 'clear' });
const output = value => postMessage({ kind: 'output', value });

const PI = Math.PI;
const TWO_PI = 2 * PI;

let turtleId = 0;
let degrees = 360;

const jsturtle = {
    Turtle: class {
        constructor() {
            this.id = turtleId++;
            this.x = 0;
            this.y = 0;
            this.rot = 0; // angle [0, 1)
            postMessage({ kind: 'create-turtle', id: this.id });
        }
        goto(x, y) {
            this.x = +x;
            this.y = +y;
            postMessage({ kind: 'move-turtle', id: this.id, to: [this.x, this.y] });
        }
        setheading(ang) {
            this.rot = (+ang / degrees) % 1;
            console.log('rot:', this.rot);
            postMessage({ kind: 'rotate-turtle', id: this.id, to: this.rot * TWO_PI });
        }
    },
};

const pyodideLoader = (async () => {
    const mod = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.18.0/full/',
        stdout: output,
        stderr: output,
    });
    console.log('Loaded pyodide');

    mod.registerJsModule('_impl_jsturtle', jsturtle);

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

    // leave our private dependencies in scope
    baseGlobals.add('_impl_jsturtle');

    // apply any runtime modifications we need - imports will be wiped, but module changes will persist
    await mod.runPythonAsync(`
import types
import time
import sys
import _impl_jsturtle

def sync_sleep(t):
    v = time.time() + t
    while time.time() < v:
        pass
time.sleep = sync_sleep

class Turtle:
    def __init__(self):
        self._jsturtle = _impl_jsturtle.Turtle.new()
    def goto(self, x, y):
        self._jsturtle.goto(x, y)
    def setheading(self, ang):
        self._jsturtle.setheading(ang)

turtle = types.ModuleType('turtle')
turtle.Turtle = Turtle

sys.modules['turtle'] = turtle
`);

    g_pyodide = mod; // save in global scope for non-async things that are called dynamically
    return mod;
})();

async function run(code) {
    const pyodide = await pyodideLoader;
    try {
        clear();
        turtleId = 0;

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

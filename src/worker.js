importScripts('https://cdn.jsdelivr.net/pyodide/v0.18.0/full/pyodide.js');

let g_pyodide = undefined;

const clear = () => postMessage({ kind: 'clear' });
const output = value => postMessage({ kind: 'output', value });

const TWO_PI = 2 * Math.PI;

let turtleId = 0;
const jsturtle = {
    Turtle: class {
        constructor() {
            this.id = turtleId++;
            postMessage({ kind: 'create-turtle', id: this.id });
        }
        setpos(x, y, drawing) {
            postMessage({ kind: 'move-turtle', id: this.id, to: [+x, -y], drawing });
        }
        setrot(rot) {
            postMessage({ kind: 'rotate-turtle', id: this.id, to: +rot * TWO_PI });
        }
        setvisible(visible) {
            postMessage({ kind: 'showhide-turtle', id: this.id, visible });
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
    baseGlobals.add('_impl_math');

    // apply any runtime modifications we need - imports will be wiped, but module changes will persist
    await mod.runPythonAsync(`
import types
import time
import sys
import _impl_jsturtle
import math as _impl_math

def sync_sleep(t):
    v = time.time() + t
    while time.time() < v:
        pass
time.sleep = sync_sleep

class Turtle:
    def __init__(self):
        self._jsturtle = _impl_jsturtle.Turtle.new()
        self._x = 0.0
        self._y = 0.0
        self._rot = 0.0 # angle [0, 1)
        self._degrees = 360.0
        self._drawing = False
        self._visible = True

    def setpos(self, x, y = None):
        if y is None:
            x, y = x
        self._x = float(x)
        self._y = float(y)
        self._jsturtle.setpos(self._x, self._y, self._drawing)
    setposition = setpos
    goto = setpos

    def setheading(self, ang):
        self._rot = (float(ang) / self._degrees) % 1.0
        self._jsturtle.setrot(self._rot)
    seth = setheading

    def setvisible(self, visible):
        self._visible = bool(visible)
        self._jsturtle.setvisible(self._visible)
    
    def isvisible(self):
        return self._visible

    def show(self):
        self.setvisible(True)
    showturtle = show
    st = show

    def hide(self):
        self.setvisible(False)
    hideturtle = hide
    ht = hide

    def pos(self):
        return (self._x, self._y)
    position = pos

    def xcor(self):
        return self._x
    getx = xcor

    def ycor(self):
        return self._y
    gety = ycor

    def setx(self, x):
        self.setpos(x, self._y)
    def sety(self, y):
        self.setpos(self._x, y)

    def heading(self):
        return self._rot * self._degrees

    def forward(self, dist):
        dist = float(dist)
        h = self._rot * 2 * _impl_math.pi
        self.setpos(self._x + _impl_math.sin(h) * dist, self._y + _impl_math.cos(h) * dist)
    fd = forward

    def backward(self, dist):
        self.forward(-float(dist))
    back = backward
    bk = backward

    def left(self, ang):
        self.setheading(self.heading() - float(ang))
    lt = left
    def right(self, ang):
        self.setheading(self.heading() + float(ang))
    rt = right

    def home(self):
        self.setpos(0, 0)
        self.setheading(0)

    def degrees(self, fullcircle = 360.0):
        fullcircle = float(fullcircle)
        assert fullcircle > 0
        self._degrees = fullcircle
    def radians(self):
        self.degrees(2 * _impl_math.pi)

    def down(self):
        self._drawing = True
    pendown = down
    pd = down

    def up(self):
        self._drawing = False
    penup = up
    pu = up

    def isdown(self):
        return self._drawing

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

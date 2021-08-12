let editor = undefined;  // ace editor
let output = undefined;  // textarea
let display = undefined; // canvas
let draw = undefined;    // canvas drawing context

let worker = undefined;
let running = false;

const SAVED_CODE_KEY = 'saved-code';

let turtles = {};
const TURTLE_POLY = [[10, 0], [-8, -7], [-3, 0], [-8, 7]];

class Turtle {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.rot = 0;
    }
    goto(x, y) {
        this.x = x;
        this.y = y;
    }
    setheading(ang) {
        this.rot = ang;
    }
}

function clearDisplay() {
    draw.save();
    draw.setTransform(1, 0, 0, 1, 0, 0);
    draw.clearRect(0, 0, draw.canvas.width, draw.canvas.height);
    draw.restore();
}
function updateDisplay() {
    clearDisplay();

    function fillPoly(poly) {
        draw.beginPath();
        draw.moveTo(poly[0][0], poly[0][1]);
        for (let i = 1; i < poly.length; ++i) {
            draw.lineTo(poly[i][0], poly[i][1]);
        }
        draw.fill();
    }

    for (const id in turtles) {
        const turtle = turtles[id];
        draw.save();

        draw.translate(turtle.x, -turtle.y);
        draw.rotate(-turtle.rot);
        fillPoly(TURTLE_POLY);
        draw.restore();
    }
}

function clear() {
    output.value = '';
    turtles = {};
    clearDisplay();
}
function writeLine(v) {
    output.value += `${v}\n`;
    output.scrollTop = output.scrollHeight;
}

function run() {
    if (running) return;
    running = true;

    if (!worker) {
        worker = new Worker('worker.js');
        worker.onmessage = e => {
            switch (e.data.kind) {
                case 'output': writeLine(e.data.value); break;
                case 'clear': clear(); break;
                case 'finished': running = false; break;
            
                case 'create-turtle': turtles[e.data.id] = new Turtle(); updateDisplay(); break;
                case 'move-turtle': turtles[e.data.id].goto(e.data.to[0], e.data.to[1]); updateDisplay(); break;
                case 'rotate-turtle': turtles[e.data.id].setheading(e.data.to); updateDisplay(); break;
            }
        };
    }

    const code = editor.getValue();
    localStorage.setItem(SAVED_CODE_KEY, code);
    worker.postMessage({ code });
}
function stop() {
    if (!worker) return;
    worker.terminate();
    worker = undefined;
    running = false;
    writeLine('\nProgram terminated by user');
}

async function init() {
    editor = ace.edit('editor');
    editor.setTheme('ace/theme/xcode');
    editor.setFontSize(16);
    editor.setShowPrintMargin(false);
    editor.setOption('wrap', true);
    editor.setOption('scrollPastEnd', 1);
    editor.session.setMode('ace/mode/python');

    output = document.getElementById('output');
    display = document.getElementById('display');
    draw = display.getContext('2d');

    const display_container = document.getElementById('display-container');
    function updateDisplaySize() {
        display.width = display_container.clientWidth;
        display.height = display_container.clientHeight;
        draw.setTransform(1, 0, 0, 1, display.width / 2, display.height / 2);
        updateDisplay(); // redraw whatever was on the canvas
    };
    updateDisplaySize();
    window.onresize = updateDisplaySize;

    const code = localStorage.getItem(SAVED_CODE_KEY);
    if (code && typeof(code) === 'string') {
        editor.setValue(code);
        editor.clearSelection();
    }

    document.getElementById('go').addEventListener('click', run);
    document.getElementById('stop').addEventListener('click', stop);
}

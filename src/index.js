let editor = undefined;  // ace editor
let output = undefined;  // textarea
let display = undefined; // canvas
let draw = undefined;    // canvas drawing context

let worker = undefined;
let running = false;

const SAVED_CODE_KEY = 'saved-code';

const UPDATE_INTERVAL = 16;
let displayChanged = false;

let turtles = {};     // dict<turtle id, turtle>
let turtleLines = {}; // dict<turtle id, line[]>

const TURTLE_POLY = [[0, -10], [-7, 8], [0, 4], [7, 8]];

class Turtle {
    constructor(id) {
        this.id = id;
        this.x = 0;
        this.y = 0;
        this.rot = 0;
        this.lines = [];
        this.wasDrawing = false;
        this.visible = true;

        turtles[id] = this;
        turtleLines[id] = this.lines;
    }
    goto(x, y, drawing) {
        if (drawing) {
            if (this.wasDrawing) this.lines[this.lines.length - 1].push([x, y]);
            else this.lines.push([[this.x, this.y], [x, y]]);
        }

        this.x = x;
        this.y = y;
        this.wasDrawing = drawing;
    }
    setheading(ang) {
        this.rot = ang;
    }
}

let redraws = 0;
function updateDisplay() {
    if (!displayChanged) return;
    displayChanged = false;

    function clearDisplay() {
        draw.save();
        draw.setTransform(1, 0, 0, 1, 0, 0);
        draw.clearRect(0, 0, draw.canvas.width, draw.canvas.height);
        draw.restore();
    }
    function drawLine(poly) {
        draw.beginPath();
        draw.moveTo(poly[0][0], poly[0][1]);
        for (let i = 1; i < poly.length; ++i) {
            draw.lineTo(poly[i][0], poly[i][1]);
        }
    }

    clearDisplay();

    for (const id in turtleLines) {
        for (const line of turtleLines[id]) {
            drawLine(line);
            draw.stroke();
        }
    }

    for (const id in turtles) {
        const turtle = turtles[id];
        if (!turtle.visible) continue;

        draw.save();
        draw.translate(turtle.x, turtle.y);
        draw.rotate(turtle.rot);
        drawLine(TURTLE_POLY);
        draw.fill();
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
            
                case 'create-turtle':
                    new Turtle(e.data.id);
                    displayChanged = true;
                    break;
                case 'move-turtle':
                    turtles[e.data.id].goto(e.data.to[0], e.data.to[1], e.data.drawing);
                    displayChanged = true;
                    break;
                case 'rotate-turtle':
                    turtles[e.data.id].setheading(e.data.to);
                    displayChanged = true;
                    break;
                case 'showhide-turtle':
                    turtles[e.data.id].visible = e.data.visible;
                    displayChanged = true;
                    break;
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
        displayChanged = true;
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

    function periodicUpdate() {
        try {
            updateDisplay();
        }
        catch (e) {
            console.error(e);
        }
        setTimeout(periodicUpdate, UPDATE_INTERVAL);
    }
    periodicUpdate();
}

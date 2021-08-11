let editor = undefined;
let output = undefined;

let worker = undefined;
let running = false;

const SAVED_CODE_KEY = 'saved-code';

function clear() { output.value = ''; }
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
            if (e.data.kind === 'output') writeLine(e.data.value);
            else if (e.data.kind === 'clear') clear();
            else if (e.data.kind === 'finished') running = false;
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

    const code = localStorage.getItem(SAVED_CODE_KEY);
    if (code && typeof(code) === 'string') {
        editor.setValue(code);
        editor.clearSelection();
    }

    document.getElementById('go').addEventListener('click', run);
    document.getElementById('stop').addEventListener('click', stop);
}

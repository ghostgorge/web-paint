document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.querySelector('.canvas-container');

    // State
    let isDrawing = false;
    let currentTool = 'brush';
    let brushSize = 5;
    let currentColor = '#000000';
    let startX, startY;
    let snapshot;
    let undoStack = [];
    const MAX_UNDO = 20;

    // Elements
    const toolBtns = document.querySelectorAll('.tool-btn');
    const sizeSlider = document.getElementById('size-slider');
    const colorPicker = document.getElementById('color-picker');
    const colorPreview = document.getElementById('color-preview');
    const colorOptions = document.querySelectorAll('.color-option');
    const clearBtn = document.getElementById('clear-btn');
    const saveBtn = document.getElementById('save-btn');
    const undoBtn = document.getElementById('undo-btn');

    // Initialization
    function resizeCanvas() {
        // Set canvas size to a fixed reasonable size or responsive to container
        // For a paint app, fixed size or specific aspect ratio is often better
        // Let's go with a fixed large size for now, centered in the view
        canvas.width = 800;
        canvas.height = 600;

        // Fill white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveState();
    }

    resizeCanvas();

    // Event Listeners
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', drawing);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseout', stopDraw); // Stop if mouse leaves canvas

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });

    canvas.addEventListener('touchend', () => {
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    });

    // Tools
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.tool-btn.active').classList.remove('active');
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
        });
    });

    // Size
    sizeSlider.addEventListener('input', (e) => {
        brushSize = e.target.value;
    });

    // Color
    colorPicker.addEventListener('input', (e) => {
        setColor(e.target.value);
    });

    colorOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            setColor(opt.dataset.color);
        });
    });

    function setColor(color) {
        currentColor = color;
        colorPicker.value = color;
        colorPreview.style.backgroundColor = color;
    }

    // Actions
    clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the canvas?')) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            saveState();
        }
    });

    saveBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `paint-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });

    undoBtn.addEventListener('click', undo);

    // Drawing Logic
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function startDraw(e) {
        if (currentTool === 'text') {
            handleTextTool(e);
            return;
        }

        isDrawing = true;
        const pos = getMousePos(e);
        startX = pos.x;
        startY = pos.y;

        ctx.beginPath();
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
        ctx.fillStyle = currentColor;

        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (currentTool === 'brush' || currentTool === 'eraser') {
            ctx.moveTo(startX, startY);
        } else if (currentTool === 'fill') {
            floodFill(Math.floor(startX), Math.floor(startY), hexToRgba(currentColor));
        }
    }

    function drawing(e) {
        if (!isDrawing) return;
        if (currentTool === 'text') return;

        const pos = getMousePos(e);

        if (currentTool === 'brush' || currentTool === 'eraser') {
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        } else if (['rectangle', 'circle', 'triangle', 'line'].includes(currentTool)) {
            ctx.putImageData(snapshot, 0, 0); // Restore to avoid trails
            drawShape(pos.x, pos.y);
        }
    }

    function stopDraw() {
        if (currentTool === 'text') return;
        if (!isDrawing) return;
        isDrawing = false;
        if (currentTool !== 'fill') {
            saveState();
        }
    }

    // Text Tool Logic
    let activeTextParams = null;

    function handleTextTool(e) {
        if (activeTextParams) {
            commitText();
        }

        const pos = getMousePos(e);

        const input = document.createElement('input');
        input.type = 'text';
        input.style.position = 'fixed';
        input.style.left = e.clientX + 'px';
        input.style.top = e.clientY + 'px';
        input.style.font = (brushSize * 2 + 10) + 'px sans-serif';
        input.style.color = currentColor;
        input.style.background = 'transparent';
        input.style.border = '1px dashed #333';
        input.style.outline = 'none';
        input.style.padding = '0';
        input.style.zIndex = '1000';
        input.style.minWidth = '100px';

        document.body.appendChild(input);

        setTimeout(() => input.focus(), 0);

        activeTextParams = {
            x: pos.x,
            y: pos.y,
            input: input
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                commitText();
            }
        });
    }

    function commitText() {
        if (!activeTextParams) return;
        const { x, y, input } = activeTextParams;
        const text = input.value;

        if (text) {
            ctx.font = (brushSize * 2 + 10) + 'px sans-serif';
            ctx.fillStyle = currentColor;
            ctx.fillText(text, x, y + (brushSize * 2 + 10));
            saveState();
        }

        if (document.body.contains(input)) {
            document.body.removeChild(input);
        }
        activeTextParams = null;
    }

    function drawShape(x, y) {
        ctx.beginPath();
        if (currentTool === 'rectangle') {
            ctx.strokeRect(startX, startY, x - startX, y - startY);
        } else if (currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (currentTool === 'triangle') {
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.lineTo(startX - (x - startX), y);
            ctx.closePath();
            ctx.stroke();
        } else if (currentTool === 'line') {
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    }

    // Undo System
    function saveState() {
        undoStack.push(canvas.toDataURL());
        if (undoStack.length > MAX_UNDO) undoStack.shift();
    }

    function undo() {
        if (undoStack.length > 1) { // Keep at least one state (blank)
            undoStack.pop(); // Remove current state
            const prevState = undoStack[undoStack.length - 1];
            const img = new Image();
            img.src = prevState;
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
        }
    }

    // Flood Fill (Simple Stack-based Recursive implementation)
    // Note: This can be slow for large areas in JS, optimized scanline is better but this is a start
    function floodFill(x, y, fillColor) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const targetColor = getPixel(data, x, y);

        // Don't fill if color is same
        if (colorsMatch(targetColor, fillColor)) return;

        const stack = [[x, y]];

        while (stack.length) {
            const [cx, cy] = stack.pop();
            const pixelIndex = (cy * canvas.width + cx) * 4;

            if (cx >= 0 && cx < canvas.width && cy >= 0 && cy < canvas.height) {
                if (colorsMatch(getPixel(data, cx, cy), targetColor)) {
                    setPixel(data, cx, cy, fillColor);

                    stack.push([cx + 1, cy]);
                    stack.push([cx - 1, cy]);
                    stack.push([cx, cy + 1]);
                    stack.push([cx, cy - 1]);
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        saveState();
    }

    function getPixel(data, x, y) {
        const i = (y * canvas.width + x) * 4;
        return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    }

    function setPixel(data, x, y, color) {
        const i = (y * canvas.width + x) * 4;
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = 255; // Alpha
    }

    function colorsMatch(c1, c2) {
        return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2];
    }

    function hexToRgba(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16),
            255
        ] : [0, 0, 0, 255];
    }
});

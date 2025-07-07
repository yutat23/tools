class ImageEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentTool = 'select';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentColor = '#000000';
        this.secondaryColor = '#ffffff';
        this.fontSize = 24;
        this.strokeWidth = 2;
        this.arrowSize = 10;
        this.elements = [];
        this.selectedElement = null;
        this.history = [];
        this.historyIndex = -1;
        this.backgroundImage = null;
        this.isResizing = false;
        this.resizeHandle = null;
        this.isDrawing = false;
        this.drawingPath = [];
        this.lastX = 0;
        this.lastY = 0;
        
        this.initializeEventListeners();
        this.saveState();
        this.initializeDarkMode();
        this.initializeLucideIcons();
    }

    initializeEventListeners() {
        // ツール選択
        document.querySelectorAll('[data-tool]').forEach(button => {
            button.addEventListener('click', (e) => {
                this.setTool(e.target.closest('[data-tool]').dataset.tool);
            });
        });

        // 画像アップロード
        document.getElementById('imageInput').addEventListener('change', (e) => {
            this.loadImage(e.target.files[0]);
        });

        // 色選択
        document.getElementById('colorPicker').addEventListener('change', (e) => {
            this.currentColor = e.target.value;
            document.getElementById('colorInput').value = e.target.value;
            // 選択された要素の色を変更
            this.updateSelectedElementColor();
        });

        document.getElementById('colorInput').addEventListener('input', (e) => {
            this.currentColor = e.target.value;
            document.getElementById('colorPicker').value = e.target.value;
            // 選択された要素の色を変更
            this.updateSelectedElementColor();
        });

        // 第2色選択
        document.getElementById('secondaryColorPicker').addEventListener('change', (e) => {
            this.secondaryColor = e.target.value;
            document.getElementById('secondaryColorInput').value = e.target.value;
            this.updateSelectedElementSecondaryColor();
        });

        document.getElementById('secondaryColorInput').addEventListener('input', (e) => {
            this.secondaryColor = e.target.value;
            document.getElementById('secondaryColorPicker').value = e.target.value;
            this.updateSelectedElementSecondaryColor();
        });

        // 縁の太さ
        document.getElementById('strokeWidthSlider').addEventListener('input', (e) => {
            this.strokeWidth = parseInt(e.target.value);
            document.getElementById('strokeWidthValue').textContent = e.target.value;
            this.updateSelectedElementStrokeWidth();
        });

        // 矢印サイズ
        document.getElementById('arrowSizeSlider').addEventListener('input', (e) => {
            this.arrowSize = parseInt(e.target.value);
            document.getElementById('arrowSizeValue').textContent = e.target.value;
            this.updateSelectedElementArrowSize();
        });

        // フォントサイズ
        document.getElementById('fontSizeSlider').addEventListener('input', (e) => {
            this.fontSize = parseInt(e.target.value);
            document.getElementById('fontSizeValue').textContent = e.target.value;
        });

        // キャンバスイベント
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // タッチイベント対応
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this._lastTouch = touch;
                this.handleMouseDown(this._convertTouchToMouseEvent(touch, e));

                // 長押し右クリックメニュー用タイマー
                this._longPressTimer = setTimeout(() => {
                    // 長押し時に右クリックメニューを表示
                    // 選択ツールかつ要素が選択されている場合のみ
                    if (this.currentTool === 'select' && this.selectedElement) {
                        // タッチ位置でメニュー表示（pageX/pageYを使用）
                        this.showContextMenu({
                            pageX: touch.pageX,
                            pageY: touch.pageY
                        });
                    }
                }, 700); // 700ms長押し
            }
            e.preventDefault();
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this._lastTouch = touch;
                this.handleMouseMove(this._convertTouchToMouseEvent(touch, e));
            }
            // 長押しキャンセル
            if (this._longPressTimer) {
                clearTimeout(this._longPressTimer);
                this._longPressTimer = null;
            }
            e.preventDefault();
        }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => {
            // touchend時はtouchesが空なので、最後のtouch位置を使う
            if (this._lastTouch) {
                this.handleMouseUp(this._convertTouchToMouseEvent(this._lastTouch, e));
            }
            // 長押しキャンセル
            if (this._longPressTimer) {
                clearTimeout(this._longPressTimer);
                this._longPressTimer = null;
            }
            e.preventDefault();
        }, { passive: false });

        // 操作ボタン
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('clearBtn').addEventListener('click', () => this.clear());
        document.getElementById('saveBtn').addEventListener('click', () => this.save());

        // テキストモーダル
        document.getElementById('confirmTextBtn').addEventListener('click', () => this.addText());
        document.getElementById('cancelTextBtn').addEventListener('click', () => this.hideTextModal());

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedElement) {
                this.deleteSelectedElement();
            }
        });

        // クリップボードからの貼り付け
        document.addEventListener('paste', (e) => {
            e.preventDefault();
            this.handlePaste(e);
        });

        // ドラッグ&ドロップ
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.canvas.style.borderColor = '#3B82F6';
        });

        this.canvas.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.canvas.style.borderColor = '#D1D5DB';
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            this.canvas.style.borderColor = '#D1D5DB';
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.loadImage(files[0]);
            }
        });

        // ダブルクリックでテキスト編集
        this.canvas.addEventListener('dblclick', (e) => {
            if (this.currentTool === 'select' && this.selectedElement && this.selectedElement.type === 'text') {
                this.editTextElement(this.selectedElement);
            }
        });

        // 右クリックメニュー
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.currentTool === 'select' && this.selectedElement) {
                this.showContextMenu(e);
            }
        });

        // 右クリックメニューのボタン
        document.getElementById('editTextBtn').addEventListener('click', () => {
            if (this.selectedElement && this.selectedElement.type === 'text') {
                this.editTextElement(this.selectedElement);
            }
            this.hideContextMenu();
        });

        document.getElementById('changeColorBtn').addEventListener('click', () => {
            this.showColorPicker();
            this.hideContextMenu();
        });

        document.getElementById('deleteElementBtn').addEventListener('click', () => {
            this.deleteSelectedElement();
            this.hideContextMenu();
        });

        // 右クリックメニューを隠す
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // ダークモードトグル
        document.getElementById('darkModeToggle').addEventListener('click', () => {
            this.toggleDarkMode();
        });

        // 色変更モーダル
        document.getElementById('modalColorPicker').addEventListener('change', (e) => {
            document.getElementById('modalColorInput').value = e.target.value;
        });

        document.getElementById('modalColorInput').addEventListener('input', (e) => {
            document.getElementById('modalColorPicker').value = e.target.value;
        });

        document.getElementById('modalSecondaryColorPicker').addEventListener('change', (e) => {
            document.getElementById('modalSecondaryColorInput').value = e.target.value;
        });

        document.getElementById('modalSecondaryColorInput').addEventListener('input', (e) => {
            document.getElementById('modalSecondaryColorPicker').value = e.target.value;
        });

        document.getElementById('modalStrokeWidthSlider').addEventListener('input', (e) => {
            document.getElementById('modalStrokeWidthValue').textContent = e.target.value;
        });

        document.getElementById('modalArrowSizeSlider').addEventListener('input', (e) => {
            document.getElementById('modalArrowSizeValue').textContent = e.target.value;
        });

        document.getElementById('confirmColorBtn').addEventListener('click', () => {
            if (this.selectedElement) {
                const color = document.getElementById('modalColorInput').value;
                const secondaryColor = document.getElementById('modalSecondaryColorInput').value;
                const strokeWidth = parseInt(document.getElementById('modalStrokeWidthSlider').value);
                const arrowSize = parseInt(document.getElementById('modalArrowSizeSlider').value);
                
                if (color) {
                    this.selectedElement.color = color;
                    this.currentColor = color;
                    document.getElementById('colorPicker').value = color;
                    document.getElementById('colorInput').value = color;
                }
                
                if (secondaryColor) {
                    this.selectedElement.secondaryColor = secondaryColor;
                    this.secondaryColor = secondaryColor;
                    document.getElementById('secondaryColorPicker').value = secondaryColor;
                    document.getElementById('secondaryColorInput').value = secondaryColor;
                }
                
                this.selectedElement.strokeWidth = strokeWidth;
                this.strokeWidth = strokeWidth;
                document.getElementById('strokeWidthSlider').value = strokeWidth;
                document.getElementById('strokeWidthValue').textContent = strokeWidth;
                
                if (this.selectedElement.type === 'arrow') {
                    this.selectedElement.arrowSize = arrowSize;
                    this.arrowSize = arrowSize;
                    document.getElementById('arrowSizeSlider').value = arrowSize;
                    document.getElementById('arrowSizeValue').textContent = arrowSize;
                }
                
                this.redraw();
                this.saveState();
            }
            this.hideColorModal();
        });

        document.getElementById('cancelColorBtn').addEventListener('click', () => {
            this.hideColorModal();
        });
    }

    setTool(tool) {
        this.currentTool = tool;
        
        // ボタンのアクティブ状態を更新
        document.querySelectorAll('[data-tool]').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

        // カーソルを更新
        const cursorMap = {
            select: 'default',
            text: 'text',
            rect: 'crosshair',
            circle: 'crosshair',
            line: 'crosshair',
            arrow: 'crosshair',
            pen: 'crosshair',
            crop: 'crosshair'
        };
        this.canvas.style.cursor = cursorMap[tool] || 'default';
    }

    loadImage(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // キャンバスサイズを画像に合わせる
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                document.getElementById('canvasSize').textContent = `${img.width} x ${img.height}`;
                
                this.backgroundImage = img;
                this.elements = [];
                this.selectedElement = null;
                this.redraw();
                this.saveState();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    handlePaste(e) {
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // 画像データの場合
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    this.loadImage(file);
                    return;
                }
            }
        }
        
        // 画像が見つからない場合は通知
        console.log('クリップボードに画像が見つかりませんでした');
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

        this.startX = x;
        this.startY = y;

        if (this.currentTool === 'text') {
            // テキストツールの場合は正確な位置を渡す
            this.showTextModal(x, y);
        } else if (this.currentTool === 'select') {
            // リサイズハンドルのチェック
            const resizeHandle = this.checkResizeHandle(x, y);
            if (resizeHandle) {
                this.isResizing = true;
                this.resizeHandle = resizeHandle;
                return;
            }

            const elementSelected = this.selectElement(x, y);
            // 要素が選択された場合はドラッグ移動を有効にする
            if (elementSelected) {
                this.isDrawing = true;
            }
        } else if (this.currentTool === 'pen') {
            // ペンツールの開始
            this.isDrawing = true;
            this.drawingPath = [{x, y}];
            this.lastX = x;
            this.lastY = y;
            
            // 縁取りを描画（背景色がある場合）
            if (this.secondaryColor && this.strokeWidth > 0) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.strokeStyle = this.secondaryColor;
                this.ctx.lineWidth = this.strokeWidth + 2;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
            }
            
            // メインの線を描画
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.strokeWidth;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
        } else if (this.currentTool === 'crop') {
            this.isDrawing = true;
        } else {
            this.isDrawing = true;
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

        if (this.currentTool === 'select' && this.selectedElement && this.isResizing) {
            // リサイズ処理
            this.resizeElement(x, y);
        } else if (this.currentTool === 'select' && this.selectedElement && this.isDrawing) {
            // 要素の移動
            this.selectedElement.x = x - this.selectedElement.offsetX;
            this.selectedElement.y = y - this.selectedElement.offsetY;
            this.redraw();
        } else if (this.currentTool === 'pen' && this.isDrawing) {
            // ペンツールの描画（縁取り付き）
            this.drawingPath.push({x, y});
            
            // 縁取りを描画（背景色がある場合）
            if (this.secondaryColor && this.strokeWidth > 0) {
                this.ctx.strokeStyle = this.secondaryColor;
                this.ctx.lineWidth = this.strokeWidth + 2;
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
            }
            
            // メインの線を描画
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.strokeWidth;
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
        } else if (['rect', 'circle', 'line', 'arrow', 'crop'].includes(this.currentTool) && this.isDrawing) {
            // 図形の描画プレビュー
            this.redraw();
            this.drawPreview(x, y);
        } else if (this.currentTool === 'text') {
            // テキストツールの場合はカーソル位置にプレビューを表示
            this.redraw();
            this.drawTextPreview(x, y);
        } else if (this.currentTool === 'select' && this.selectedElement) {
            // リサイズハンドルのチェック
            const resizeHandle = this.checkResizeHandle(x, y);
            if (resizeHandle) {
                this.canvas.style.cursor = 'nw-resize';
            } else {
                this.canvas.style.cursor = 'move';
            }
        }
    }

    handleMouseUp(e) {
        if (!this.isDrawing && !this.isResizing) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

        if (['rect', 'circle', 'line', 'arrow'].includes(this.currentTool)) {
            this.addElement(this.currentTool, this.startX, this.startY, x, y);
        } else if (this.currentTool === 'crop') {
            this.cropImage(this.startX, this.startY, x, y);
        } else if (this.currentTool === 'pen' && this.drawingPath.length > 1) {
            // ペンツールの描画完了
            this.addPenElement(this.drawingPath);
        } else if (this.currentTool === 'select' && this.selectedElement) {
            // 選択ツールでの移動またはリサイズが完了した場合、状態を保存
            this.saveState();
        }

        this.isDrawing = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.drawingPath = [];
        
        // 選択ツールの場合はカーソルを元に戻す
        if (this.currentTool === 'select') {
            this.canvas.style.cursor = 'default';
        }
    }

    showTextModal(x, y) {
        this.tempTextPosition = { x, y };
        document.getElementById('textModal').classList.remove('hidden');
        document.getElementById('textModal').classList.add('flex');
        document.getElementById('textInput').focus();
    }

    hideTextModal() {
        document.getElementById('textModal').classList.add('hidden');
        document.getElementById('textModal').classList.remove('flex');
        document.getElementById('textInput').value = '';
        this.tempTextPosition = null;
        this.editingElement = null;
    }

    addText() {
        const text = document.getElementById('textInput').value.trim();
        if (text && this.tempTextPosition) {
            // 編集モードの場合は既存の要素を削除
            if (this.editingElement) {
                const index = this.elements.indexOf(this.editingElement);
                if (index > -1) {
                    this.elements.splice(index, 1);
                }
                this.editingElement = null;
            }
            this.addElement('text', this.tempTextPosition.x, this.tempTextPosition.y, 0, 0, text);
        }
        this.hideTextModal();
    }

    editTextElement(element) {
        this.tempTextPosition = { x: element.x, y: element.y };
        document.getElementById('textInput').value = element.text;
        document.getElementById('textModal').classList.remove('hidden');
        document.getElementById('textModal').classList.add('flex');
        document.getElementById('textInput').focus();
        
        // 既存の要素を削除するフラグを設定
        this.editingElement = element;
    }

    addElement(type, x1, y1, x2, y2, text = '') {
        const element = {
            id: Date.now() + Math.random(),
            type,
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1),
            color: this.currentColor,
            secondaryColor: this.secondaryColor,
            strokeWidth: this.strokeWidth,
            arrowSize: this.arrowSize,
            fontSize: this.fontSize,
            text: text
        };

        // テキスト要素の場合、Y座標を調整（ベースライン基準）
        if (type === 'text') {
            element.y = y1; // クリックした位置をそのまま使用
        } else if (type === 'line' || type === 'arrow') {
            // 線要素と矢印要素の場合は実際の座標を保存
            element.x = x1;
            element.y = y1;
            element.width = x2 - x1;
            element.height = y2 - y1;
        }

        this.elements.push(element);
        this.redraw();
        this.saveState();
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    addPenElement(path) {
        const element = {
            id: Date.now() + Math.random(),
            type: 'pen',
            path: [...path],
            color: this.currentColor,
            secondaryColor: this.secondaryColor,
            strokeWidth: this.strokeWidth
        };

        this.elements.push(element);
        this.redraw();
        this.saveState();
    }

    selectElement(x, y) {
        this.selectedElement = null;
        
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const element = this.elements[i];
            if (this.isPointInElement(x, y, element)) {
                this.selectedElement = element;
                this.selectedElement.offsetX = x - element.x;
                this.selectedElement.offsetY = y - element.y;
                break;
            }
        }
        
        // 選択された要素の色をカラーピッカーに反映
        this.updateColorPickerFromSelectedElement();
        
        this.redraw();
        return this.selectedElement !== null; // 要素が選択されたかどうかを返す
    }

    isPointInElement(x, y, element) {
        if (element.type === 'text') {
            // テキストのフォント設定を一時的に適用
            this.ctx.font = `${element.fontSize}px Arial`;
            const textWidth = this.ctx.measureText(element.text).width;
            // テキストの選択範囲を正確に計算
            return x >= element.x && x <= element.x + textWidth &&
                   y >= element.y - element.fontSize && y <= element.y;
        } else if (element.type === 'pen') {
            // ペン描画要素の選択判定（線の近くをクリックした場合も選択）
            const tolerance = this.strokeWidth + 5;
            for (let i = 1; i < element.path.length; i++) {
                const prev = element.path[i - 1];
                const curr = element.path[i];
                const distance = this.pointToLineDistance(x, y, prev.x, prev.y, curr.x, curr.y);
                if (distance <= tolerance) {
                    return true;
                }
            }
            return false;
        } else if (element.type === 'line' || element.type === 'arrow') {
            // 線要素と矢印要素の選択判定（線の近くをクリックした場合も選択）
            const tolerance = 5;
            const x1 = element.x;
            const y1 = element.y;
            const x2 = element.x + element.width;
            const y2 = element.y + element.height;
            
            // 点から線までの距離を計算
            const A = x - x1;
            const B = y - y1;
            const C = x2 - x1;
            const D = y2 - y1;
            
            const dot = A * C + B * D;
            const lenSq = C * C + D * D;
            let param = -1;
            
            if (lenSq !== 0) param = dot / lenSq;
            
            let xx, yy;
            if (param < 0) {
                xx = x1;
                yy = y1;
            } else if (param > 1) {
                xx = x2;
                yy = y2;
            } else {
                xx = x1 + param * C;
                yy = y1 + param * D;
            }
            
            const dx = x - xx;
            const dy = y - yy;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            return distance <= tolerance;
        } else {
            return x >= element.x && x <= element.x + element.width &&
                   y >= element.y && y <= element.y + element.height;
        }
    }

    drawPreview(x, y) {
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);

        if (this.currentTool === 'rect') {
            this.ctx.strokeRect(this.startX, this.startY, x - this.startX, y - this.startY);
        } else if (this.currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(x - this.startX, 2) + Math.pow(y - this.startY, 2));
            
            // 背景色で塗りつぶし（第2色がある場合）
            if (this.secondaryColor && this.strokeWidth > 0) {
                this.ctx.fillStyle = this.secondaryColor;
                this.ctx.beginPath();
                this.ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
                this.ctx.fill();
            }
            
            // 縁を描画
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.strokeWidth;
            this.ctx.beginPath();
            this.ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
            this.ctx.stroke();
        } else if (this.currentTool === 'line') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.startX, this.startY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
        } else if (this.currentTool === 'arrow') {
            // 縁取りを描画（背景色がある場合）
            if (this.secondaryColor && this.strokeWidth > 0) {
                this.ctx.strokeStyle = this.secondaryColor;
                this.ctx.lineWidth = this.strokeWidth + 2;
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
            }
            
            // メインの線を描画
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.strokeWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(this.startX, this.startY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            
            // 矢印のプレビュー
            if (this.secondaryColor && this.strokeWidth > 0) {
                this.drawArrow(this.startX, this.startY, x, y, this.arrowSize, this.secondaryColor, this.strokeWidth + 2, this.secondaryColor);
            }
            this.drawArrow(this.startX, this.startY, x, y, this.arrowSize, this.currentColor, this.strokeWidth, this.currentColor);
        } else if (this.currentTool === 'crop') {
            // クロップエリアを半透明のオーバーレイで表示
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // 選択エリアを透明にする
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.fillRect(this.startX, this.startY, x - this.startX, y - this.startY);
            this.ctx.globalCompositeOperation = 'source-over';
            
            // 選択エリアの境界線を描画
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(this.startX, this.startY, x - this.startX, y - this.startY);
        }

        this.ctx.setLineDash([]);
    }

    drawTextPreview(x, y) {
        // テキストツールのプレビュー表示
        this.ctx.font = `${this.fontSize}px Arial`;
        this.ctx.fillStyle = this.currentColor;
        this.ctx.globalAlpha = 0.5;
        this.ctx.fillText('T', x, y);
        this.ctx.globalAlpha = 1.0;
    }

    drawArrow(startX, startY, endX, endY, size, color = null, strokeWidth = null, fillColor = null) {
        // 現在のスタイルを保存
        const originalStrokeStyle = this.ctx.strokeStyle;
        const originalLineWidth = this.ctx.lineWidth;
        const originalFillStyle = this.ctx.fillStyle;
        
        // 線の方向を計算（startX,startY から endX,endY への方向）
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // 線の長さが0の場合は矢印を描画しない
        if (length === 0) {
            this.ctx.strokeStyle = originalStrokeStyle;
            this.ctx.lineWidth = originalLineWidth;
            this.ctx.fillStyle = originalFillStyle;
            return;
        }
        
        // 線の角度を計算
        const angle = Math.atan2(dy, dx);
        
        // 矢印の角度（30度）
        const arrowAngle = Math.PI / 6;
        
        // 矢印の三角形を作成
        const arrowLength = size * 1.5; // 矢印の長さ
        const arrowWidth = size; // 矢印の幅
        
        // 矢印の先端から後ろに移動
        const backX = endX - Math.cos(angle) * arrowLength;
        const backY = endY - Math.sin(angle) * arrowLength;
        
        // 矢印の両側の点を計算
        const leftX = backX - Math.cos(angle + arrowAngle) * arrowWidth;
        const leftY = backY - Math.sin(angle + arrowAngle) * arrowWidth;
        const rightX = backX - Math.cos(angle - arrowAngle) * arrowWidth;
        const rightY = backY - Math.sin(angle - arrowAngle) * arrowWidth;
        
        // 矢印の三角形パスを作成
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(leftX, leftY);
        this.ctx.lineTo(rightX, rightY);
        this.ctx.closePath();
        
        // 塗りつぶしを描画
        if (fillColor) {
            this.ctx.fillStyle = fillColor;
            this.ctx.fill();
        }
        
        // 縁取りを描画
        if (color && strokeWidth) {
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = strokeWidth;
            this.ctx.stroke();
        }
        
        // 元のスタイルを復元
        this.ctx.strokeStyle = originalStrokeStyle;
        this.ctx.lineWidth = originalLineWidth;
        this.ctx.fillStyle = originalFillStyle;
    }

    redraw() {
        // キャンバスをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 背景画像を描画
        if (this.backgroundImage) {
            this.ctx.drawImage(this.backgroundImage, 0, 0);
        }

        // 要素を描画
        this.elements.forEach(element => {
            this.drawElement(element);
        });

        // 選択された要素をハイライト
        if (this.selectedElement) {
            this.highlightElement(this.selectedElement);
        }
    }

    drawElement(element) {
        this.ctx.lineWidth = element.strokeWidth || 2;

        switch (element.type) {
            case 'rect':
                // 背景色を描画
                if (element.secondaryColor && element.strokeWidth > 0) {
                    this.ctx.fillStyle = element.secondaryColor;
                    this.ctx.fillRect(element.x, element.y, element.width, element.height);
                }
                // 縁を描画
                this.ctx.strokeStyle = element.color;
                this.ctx.strokeRect(element.x, element.y, element.width, element.height);
                break;
            case 'circle':
                // 円の中心と半径を計算（プレビューと同じ方法）
                const centerX = element.x + element.width / 2;
                const centerY = element.y + element.height / 2;
                const radius = Math.sqrt(Math.pow(element.width / 2, 2) + Math.pow(element.height / 2, 2));
                
                // 背景色で塗りつぶし（第2色がある場合）
                if (element.secondaryColor && element.strokeWidth > 0) {
                    this.ctx.fillStyle = element.secondaryColor;
                    this.ctx.beginPath();
                    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                    this.ctx.fill();
                }
                
                // 縁を描画
                this.ctx.strokeStyle = element.color;
                this.ctx.lineWidth = element.strokeWidth;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
            case 'line':
                this.ctx.strokeStyle = element.color;
                this.ctx.beginPath();
                this.ctx.moveTo(element.x, element.y);
                this.ctx.lineTo(element.x + element.width, element.y + element.height);
                this.ctx.stroke();
                break;
            case 'arrow':
                // 縁取りを描画（背景色がある場合）
                if (element.secondaryColor && element.strokeWidth > 0) {
                    this.ctx.strokeStyle = element.secondaryColor;
                    this.ctx.lineWidth = element.strokeWidth + 2; // 縁取りは少し太く
                    this.ctx.beginPath();
                    this.ctx.moveTo(element.x, element.y);
                    this.ctx.lineTo(element.x + element.width, element.y + element.height);
                    this.ctx.stroke();
                }
                
                // メインの線を描画
                this.ctx.strokeStyle = element.color;
                this.ctx.lineWidth = element.strokeWidth;
                this.ctx.beginPath();
                this.ctx.moveTo(element.x, element.y);
                this.ctx.lineTo(element.x + element.width, element.y + element.height);
                this.ctx.stroke();
                
                // 矢印を描画
                if (element.secondaryColor && element.strokeWidth > 0) {
                    // 縁取りの矢印（背景色で塗りつぶし）
                    this.drawArrow(element.x, element.y, element.x + element.width, element.y + element.height, element.arrowSize || 10, element.secondaryColor, element.strokeWidth + 2, element.secondaryColor);
                }
                // メインの矢印（メイン色で塗りつぶし）
                this.drawArrow(element.x, element.y, element.x + element.width, element.y + element.height, element.arrowSize || 10, element.color, element.strokeWidth, element.color);
                break;
            case 'text':
                this.ctx.font = `${element.fontSize}px Arial`;
                // 縁取りを描画
                if (element.strokeWidth > 0) {
                    this.ctx.strokeStyle = element.secondaryColor || '#000000';
                    this.ctx.lineWidth = element.strokeWidth;
                    this.ctx.strokeText(element.text, element.x, element.y);
                }
                // テキストを描画
                this.ctx.fillStyle = element.color;
                this.ctx.lineWidth = 1;
                this.ctx.fillText(element.text, element.x, element.y);
                break;
            case 'pen':
                if (element.path && element.path.length > 1) {
                    // 縁取りを描画（背景色がある場合）
                    if (element.secondaryColor && element.strokeWidth > 0) {
                        this.ctx.strokeStyle = element.secondaryColor;
                        this.ctx.lineWidth = element.strokeWidth + 2; // 縁取りは少し太く
                        this.ctx.lineCap = 'round';
                        this.ctx.lineJoin = 'round';
                        this.ctx.beginPath();
                        this.ctx.moveTo(element.path[0].x, element.path[0].y);
                        for (let i = 1; i < element.path.length; i++) {
                            this.ctx.lineTo(element.path[i].x, element.path[i].y);
                        }
                        this.ctx.stroke();
                    }
                    
                    // メインの線を描画
                    this.ctx.strokeStyle = element.color;
                    this.ctx.lineWidth = element.strokeWidth;
                    this.ctx.lineCap = 'round';
                    this.ctx.lineJoin = 'round';
                    this.ctx.beginPath();
                    this.ctx.moveTo(element.path[0].x, element.path[0].y);
                    for (let i = 1; i < element.path.length; i++) {
                        this.ctx.lineTo(element.path[i].x, element.path[i].y);
                    }
                    this.ctx.stroke();
                }
                break;
        }
    }

    highlightElement(element) {
        this.ctx.strokeStyle = '#3B82F6';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);

        if (element.type === 'text') {
            // テキストのフォント設定を一時的に適用
            this.ctx.font = `${element.fontSize}px Arial`;
            const textWidth = this.ctx.measureText(element.text).width;
            this.ctx.strokeRect(element.x - 2, element.y - element.fontSize - 2, textWidth + 4, element.fontSize + 4);
            
            // リサイズハンドルを描画
            this.drawResizeHandle(element.x + textWidth, element.y);
        } else if (element.type === 'line' || element.type === 'arrow') {
            // 線要素と矢印要素のハイライト（線の両端に小さな四角を表示）
            this.ctx.fillStyle = '#3B82F6';
            this.ctx.fillRect(element.x - 3, element.y - 3, 6, 6);
            this.ctx.fillRect(element.x + element.width - 3, element.y + element.height - 3, 6, 6);
            
            // 線要素と矢印要素のリサイズハンドルを描画（終点に配置）
            this.drawResizeHandle(element.x + element.width, element.y + element.height);
        } else if (element.type === 'pen') {
            // ペン描画要素のハイライト（線の近くに点線を表示）
            if (element.path && element.path.length > 1) {
                this.ctx.strokeStyle = '#3B82F6';
                this.ctx.lineWidth = 1;
                this.ctx.setLineDash([3, 3]);
                this.ctx.beginPath();
                this.ctx.moveTo(element.path[0].x, element.path[0].y);
                for (let i = 1; i < element.path.length; i++) {
                    this.ctx.lineTo(element.path[i].x, element.path[i].y);
                }
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
        } else {
            this.ctx.strokeRect(element.x - 2, element.y - 2, element.width + 4, element.height + 4);
            
            // 図形要素のリサイズハンドルを描画
            this.drawResizeHandle(element.x + element.width, element.y + element.height);
        }

        this.ctx.setLineDash([]);
    }

    drawResizeHandle(x, y) {
        const handleSize = 6;
        this.ctx.fillStyle = '#3B82F6';
        this.ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
    }

    updateSelectedElementColor() {
        if (this.selectedElement) {
            this.selectedElement.color = this.currentColor;
            this.redraw();
            this.saveState();
        }
    }

    updateColorPickerFromSelectedElement() {
        if (this.selectedElement) {
            this.currentColor = this.selectedElement.color;
            document.getElementById('colorPicker').value = this.currentColor;
            document.getElementById('colorInput').value = this.currentColor;
            
            // 第2色と縁の太さも更新
            if (this.selectedElement.secondaryColor) {
                this.secondaryColor = this.selectedElement.secondaryColor;
                document.getElementById('secondaryColorPicker').value = this.secondaryColor;
                document.getElementById('secondaryColorInput').value = this.secondaryColor;
            }
            
            if (this.selectedElement.strokeWidth) {
                this.strokeWidth = this.selectedElement.strokeWidth;
                document.getElementById('strokeWidthSlider').value = this.strokeWidth;
                document.getElementById('strokeWidthValue').textContent = this.strokeWidth;
            }
            
            if (this.selectedElement.arrowSize) {
                this.arrowSize = this.selectedElement.arrowSize;
                document.getElementById('arrowSizeSlider').value = this.arrowSize;
                document.getElementById('arrowSizeValue').textContent = this.arrowSize;
            }
        }
    }

    updateSelectedElementSecondaryColor() {
        if (this.selectedElement) {
            this.selectedElement.secondaryColor = this.secondaryColor;
            this.redraw();
            this.saveState();
        }
    }

    updateSelectedElementStrokeWidth() {
        if (this.selectedElement) {
            this.selectedElement.strokeWidth = this.strokeWidth;
            this.redraw();
            this.saveState();
        }
    }

    updateSelectedElementArrowSize() {
        if (this.selectedElement && (this.selectedElement.type === 'arrow')) {
            this.selectedElement.arrowSize = this.arrowSize;
            this.redraw();
            this.saveState();
        }
    }

    saveState() {
        // 現在の状態を履歴に保存
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push({
            elements: JSON.parse(JSON.stringify(this.elements)),
            backgroundImage: this.backgroundImage
        });
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.elements = JSON.parse(JSON.stringify(state.elements));
            this.backgroundImage = state.backgroundImage;
            this.selectedElement = null;
            this.redraw();
        }
    }

    clear() {
        if (confirm('すべての編集内容を削除しますか？')) {
            this.elements = [];
            this.selectedElement = null;
            this.redraw();
            this.saveState();
        }
    }

    cropImage(x1, y1, x2, y2) {
        const cropX = Math.min(x1, x2);
        const cropY = Math.min(y1, y2);
        const cropWidth = Math.abs(x2 - x1);
        const cropHeight = Math.abs(y2 - y1);

        // 新しいキャンバスを作成
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;

        // 現在のキャンバスの内容を新しいキャンバスにコピー
        tempCtx.drawImage(this.canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        // 新しい画像を作成
        const newImage = new Image();
        newImage.onload = () => {
            // キャンバスサイズを更新
            this.canvas.width = cropWidth;
            this.canvas.height = cropHeight;
            document.getElementById('canvasSize').textContent = `${cropWidth} x ${cropHeight}`;
            
            // 背景画像を更新
            this.backgroundImage = newImage;
            this.elements = [];
            this.selectedElement = null;
            this.redraw();
            this.saveState();
        };
        newImage.src = tempCanvas.toDataURL();
    }

    deleteSelectedElement() {
        if (this.selectedElement) {
            const index = this.elements.indexOf(this.selectedElement);
            if (index > -1) {
                this.elements.splice(index, 1);
                this.selectedElement = null;
                this.redraw();
                this.saveState();
            }
        }
    }

    showContextMenu(e) {
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.left = e.pageX + 'px';
        contextMenu.style.top = e.pageY + 'px';
        contextMenu.classList.remove('hidden');
        
        // テキスト要素でない場合は編集ボタンを無効化
        const editBtn = document.getElementById('editTextBtn');
        if (this.selectedElement && this.selectedElement.type === 'text') {
            editBtn.disabled = false;
            editBtn.classList.remove('text-gray-400');
            editBtn.classList.add('text-gray-700');
        } else {
            editBtn.disabled = true;
            editBtn.classList.remove('text-gray-700');
            editBtn.classList.add('text-gray-400');
        }
    }

    hideContextMenu() {
        document.getElementById('contextMenu').classList.add('hidden');
    }

    showColorPicker() {
        if (this.selectedElement) {
            document.getElementById('modalColorPicker').value = this.selectedElement.color;
            document.getElementById('modalColorInput').value = this.selectedElement.color;
            document.getElementById('modalSecondaryColorPicker').value = this.selectedElement.secondaryColor || '#ffffff';
            document.getElementById('modalSecondaryColorInput').value = this.selectedElement.secondaryColor || '#ffffff';
                    document.getElementById('modalStrokeWidthSlider').value = this.selectedElement.strokeWidth || 2;
        document.getElementById('modalStrokeWidthValue').textContent = this.selectedElement.strokeWidth || 2;
        
        if (this.selectedElement.type === 'arrow') {
            document.getElementById('modalArrowSizeSlider').value = this.selectedElement.arrowSize || 10;
            document.getElementById('modalArrowSizeValue').textContent = this.selectedElement.arrowSize || 10;
        }
            document.getElementById('colorModal').classList.remove('hidden');
            document.getElementById('colorModal').classList.add('flex');
        }
    }

    hideColorModal() {
        document.getElementById('colorModal').classList.add('hidden');
        document.getElementById('colorModal').classList.remove('flex');
    }

    checkResizeHandle(x, y) {
        if (!this.selectedElement) {
            return null;
        }

        const handleSize = 8;
        let handleX, handleY;

        if (this.selectedElement.type === 'text') {
            // テキスト要素の右下のリサイズハンドルを計算
            this.ctx.font = `${this.selectedElement.fontSize}px Arial`;
            const textWidth = this.ctx.measureText(this.selectedElement.text).width;
            handleX = this.selectedElement.x + textWidth;
            handleY = this.selectedElement.y;
        } else if (this.selectedElement.type === 'line' || this.selectedElement.type === 'arrow') {
            // 線要素と矢印要素の終点のリサイズハンドルを計算
            handleX = this.selectedElement.x + this.selectedElement.width;
            handleY = this.selectedElement.y + this.selectedElement.height;
        } else {
            // 図形要素の右下のリサイズハンドルを計算
            handleX = this.selectedElement.x + this.selectedElement.width;
            handleY = this.selectedElement.y + this.selectedElement.height;
        }
        
        // リサイズハンドルの範囲をチェック
        if (x >= handleX - handleSize && x <= handleX + handleSize &&
            y >= handleY - handleSize && y <= handleY + handleSize) {
            return this.selectedElement.type;
        }
        
        return null;
    }

    resizeElement(x, y) {
        if (!this.selectedElement) {
            return;
        }

        if (this.selectedElement.type === 'text') {
            // テキストの現在の幅を計算
            this.ctx.font = `${this.selectedElement.fontSize}px Arial`;
            const currentWidth = this.ctx.measureText(this.selectedElement.text).width;
            
            // 新しい幅に基づいてフォントサイズを計算
            const newWidth = x - this.selectedElement.x;
            if (newWidth > 10) { // 最小サイズの制限
                const scale = newWidth / currentWidth;
                const newFontSize = Math.max(8, Math.min(200, this.selectedElement.fontSize * scale));
                this.selectedElement.fontSize = Math.round(newFontSize);
            }
        } else if (this.selectedElement.type === 'line' || this.selectedElement.type === 'arrow') {
            // 線要素と矢印要素のリサイズ（終点を変更）
            this.selectedElement.width = x - this.selectedElement.x;
            this.selectedElement.height = y - this.selectedElement.y;
        } else {
            // 図形要素のリサイズ
            const newWidth = Math.max(5, x - this.selectedElement.x);
            const newHeight = Math.max(5, y - this.selectedElement.y);
            
            this.selectedElement.width = newWidth;
            this.selectedElement.height = newHeight;
        }
        
        this.redraw();
    }

    save() {
        // 保存前に選択状態をクリア
        const wasSelected = this.selectedElement !== null;
        this.selectedElement = null;
        
        // キャンバスを再描画して選択枠を除去
        this.redraw();
        
        // キャンバスをPNGとして保存
        const link = document.createElement('a');
        link.download = 'edited-image.png';
        link.href = this.canvas.toDataURL();
        link.click();
        
        // 保存後に選択状態を復元（元々選択されていた場合）
        if (wasSelected) {
            // 少し遅延を入れてから選択状態を復元
            setTimeout(() => {
                this.redraw();
            }, 100);
        }
    }

    // ダークモード機能
    initializeDarkMode() {
        const isDarkMode = this.getCookie('darkMode') === 'true';
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            this.updateDarkModeButton(true);
        }
    }

    toggleDarkMode() {
        const isDarkMode = document.documentElement.classList.toggle('dark');
        this.setCookie('darkMode', isDarkMode.toString(), 365);
        this.updateDarkModeButton(isDarkMode);
    }

    updateDarkModeButton(isDarkMode) {
        const button = document.getElementById('darkModeToggle');
        if (isDarkMode) {
            // 太陽アイコン（ライトモードに切り替え）
            button.innerHTML = `<i data-lucide="sun" class="w-5 h-5"></i>`;
            button.title = 'ライトモードに切り替え';
        } else {
            // 月アイコン（ダークモードに切り替え）
            button.innerHTML = `<i data-lucide="moon" class="w-5 h-5"></i>`;
            button.title = 'ダークモードに切り替え';
        }
        // アイコンを再初期化
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    setCookie(name, value, days) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    }

    getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    initializeLucideIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // タッチイベント→マウスイベント変換ユーティリティ
    _convertTouchToMouseEvent(touch, originalEvent) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => { if (originalEvent) originalEvent.preventDefault(); },
            // 必要なら他のプロパティも追加
        };
    }
}

// エディターを初期化
document.addEventListener('DOMContentLoaded', () => {
    new ImageEditor();
}); 
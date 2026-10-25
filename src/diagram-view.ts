import { ItemView, WorkspaceLeaf } from 'obsidian';
import type MermaidPopupPlugin from './main';

export const DIAGRAM_VIEW_TYPE = 'diagram-popup-preview';

export interface DiagramSnapshot {
    element: HTMLElement;
    width: number;
    height: number;
}

// Keep the rendered snapshot independent of the editor's DOM and size limits.
export function captureDiagram(container: HTMLElement): DiagramSnapshot {
    const graphic = container.matches('svg, img') ? container : container.querySelector('svg, img');
    const bounds = (graphic ?? container).getBoundingClientRect();
    const svgBox = graphic?.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    const dimension = (axis: 'width' | 'height', index: number): number => {
        const image = graphic as HTMLImageElement | null;
        const natural = axis === 'width' ? image?.naturalWidth : image?.naturalHeight;
        const value = natural || svgBox?.[index] || parseFloat(graphic?.getAttribute(axis) ?? '') || bounds[axis];
        return Number.isFinite(value) && value > 0 ? value : (axis === 'width' ? 800 : 600);
    };
    const width = dimension('width', 2);
    const height = dimension('height', 3);
    const element = container.cloneNode(true) as HTMLElement;
    element.querySelectorAll('.mermaid-popup-button, .mermaid-popup-button-reading, .edit-block-button').forEach(el => el.remove());
    const clonedGraphic = element.matches('svg, img') ? element : element.querySelector<HTMLElement>('svg, img');
    // Clear only the editor sizing chain. Mermaid label/foreignObject sizes
    // inside the SVG are part of the drawing and must remain intact.
    let node = clonedGraphic ?? element;
    while (node) {
        for (const property of ['width', 'height', 'max-width', 'max-height', 'min-width', 'min-height', 'transform', 'position']) {
            node.style.removeProperty(property);
        }
        // A note's constrained wrappers must not clip or shrink the preview.
        // Only touch the sizing chain; sizes inside SVG labels stay intact.
        node.style.setProperty('width', `${width}px`, 'important');
        node.style.setProperty('height', `${height}px`, 'important');
        node.style.setProperty('max-width', 'none', 'important');
        node.style.setProperty('max-height', 'none', 'important');
        node.style.setProperty('flex', 'none', 'important');
        if (node !== clonedGraphic) {
            node.style.setProperty('overflow', 'visible', 'important');
            node.style.setProperty('clip-path', 'none', 'important');
            node.style.setProperty('contain', 'none', 'important');
        }
        if (node === element) break;
        node = node.parentElement!;
    }
    return { element, width, height };
}

export class DiagramView extends ItemView {
    private stage!: HTMLElement;
    private surface!: HTMLElement;
    private zoomLabel!: HTMLElement;
    private width = 800;
    private height = 600;
    private scale = 1;
    private x = 0;
    private y = 0;
    private fitted = true;

    constructor(leaf: WorkspaceLeaf, private plugin: MermaidPopupPlugin) {
        super(leaf);
    }

    getViewType(): string { return DIAGRAM_VIEW_TYPE; }
    getDisplayText(): string { return 'Diagram preview'; }
    getIcon(): string { return 'image'; }

    async onOpen(): Promise<void> {
        this.contentEl.empty();
        this.contentEl.addClass('diagram-native-view');
        const toolbar = this.contentEl.createDiv({ cls: 'diagram-native-toolbar' });
        toolbar.setAttribute('aria-label', 'Diagram controls');
        const button = (text: string, title: string, action: () => void) => {
            const el = toolbar.createEl('button', { text, attr: { title, 'aria-label': title } });
            this.registerDomEvent(el, 'click', action);
        };
        button('+', 'Zoom in', () => this.zoom(1 + this.zoomStep()));
        button('−', 'Zoom out', () => this.zoom(1 / (1 + this.zoomStep())));
        button('Fit', 'Fit diagram to window', () => this.fit());
        button('100%', 'Actual size', () => { this.fitted = false; this.center(1); });
        for (const [label, dx, dy] of [['←', -1, 0], ['→', 1, 0], ['↑', 0, -1], ['↓', 0, 1]] as const) {
            button(label, `Move ${label}`, () => {
                this.fitted = false;
                const step = parseFloat(this.plugin.settings.MoveStepValue) || 30;
                this.x += dx * step;
                this.y += dy * step;
                this.updateTransform();
            });
        }
        button('Close', 'Close diagram preview', () => this.leaf.detach());
        this.zoomLabel = toolbar.createEl('span', { cls: 'diagram-native-zoom' });
        this.stage = this.contentEl.createDiv({ cls: 'diagram-native-stage' });
        this.stage.tabIndex = 0;
        this.stage.setAttribute('aria-label', 'Diagram canvas: drag to pan, scroll to zoom');
        this.surface = this.stage.createDiv({ cls: 'diagram-native-surface' });
        this.surface.createEl('p', { text: 'Open a diagram from its source note to load a preview. Previews are snapshots and are not restored after restart.' });

        this.registerDomEvent(this.stage, 'wheel', event => {
            event.preventDefault();
            event.stopPropagation();
            const rect = this.stage.getBoundingClientRect();
            this.zoom(event.deltaY < 0 ? 1 + this.zoomStep() : 1 / (1 + this.zoomStep()), event.clientX - rect.left, event.clientY - rect.top);
        }, { passive: false });
        let drag: { id: number; x: number; y: number } | null = null;
        this.registerDomEvent(this.stage, 'pointerdown', event => {
            if (event.button !== 0) return;
            event.preventDefault();
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
            this.stage.setPointerCapture(event.pointerId);
            this.stage.addClass('is-dragging');
        });
        this.registerDomEvent(this.stage, 'pointermove', event => {
            if (!drag || drag.id !== event.pointerId) return;
            this.fitted = false;
            this.x += event.clientX - drag.x;
            this.y += event.clientY - drag.y;
            drag.x = event.clientX;
            drag.y = event.clientY;
            this.updateTransform();
        });
        const stop = () => { drag = null; this.stage.removeClass('is-dragging'); };
        this.registerDomEvent(this.stage, 'pointerup', stop);
        this.registerDomEvent(this.stage, 'pointercancel', stop);
        this.registerDomEvent(this.stage, 'lostpointercapture', stop);
        this.registerDomEvent(this.stage, 'keydown', event => {
            if (event.key === '0') this.fit();
            else if (event.key === '+' || event.key === '=') this.zoom(1 + this.zoomStep());
            else if (event.key === '-') this.zoom(1 / (1 + this.zoomStep()));
            else return;
            event.preventDefault();
        });
        this.registerDomEvent(this.stage, 'click', event => event.preventDefault());
    }

    setDiagram(snapshot: DiagramSnapshot, sourcePath: string): void {
        this.stage.title = sourcePath ? `Snapshot of ${sourcePath}. Reopen from the note to refresh.` : 'Diagram snapshot';
        this.width = snapshot.width;
        this.height = snapshot.height;
        this.surface.empty();
        this.surface.appendChild(this.surface.ownerDocument.importNode(snapshot.element, true));
        this.surface.style.width = `${this.width}px`;
        this.surface.style.height = `${this.height}px`;
        this.fit();
    }

    onResize(): void { if (this.stage && this.fitted) this.fit(); }

    private zoomStep(): number { return parseFloat(this.plugin.settings.ZoomRatioValue) || 0.2; }

    private fit(): void {
        this.fitted = true;
        const scale = Math.min((this.stage.clientWidth - 48) / this.width, (this.stage.clientHeight - 48) / this.height);
        this.center(Math.max(0.02, scale));
    }

    private center(scale: number): void {
        this.scale = scale;
        this.x = (this.stage.clientWidth - this.width * scale) / 2;
        this.y = (this.stage.clientHeight - this.height * scale) / 2;
        this.updateTransform();
    }

    private zoom(factor: number, cx = this.stage.clientWidth / 2, cy = this.stage.clientHeight / 2): void {
        this.fitted = false;
        // Fit is an explicit action, never a limit on manual zoom. In particular,
        // small diagrams may already fit at >20x: '+' must still enlarge them.
        const next = Math.max(0.02, this.scale * factor);
        if (!Number.isFinite(next)) return;
        const ratio = next / this.scale;
        const x = cx - (cx - this.x) * ratio;
        const y = cy - (cy - this.y) * ratio;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        this.x = x;
        this.y = y;
        this.scale = next;
        this.updateTransform();
    }

    private updateTransform(): void {
        this.surface.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
        this.zoomLabel.textContent = `${Math.round(this.scale * 100)}%`;
    }
}

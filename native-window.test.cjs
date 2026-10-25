const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

function environment() {
    const dom = new JSDOM('<!doctype html><body></body>');
    const { document, HTMLElement, Element } = dom.window;
    Object.defineProperty(Element.prototype, 'doc', { get() { return this.ownerDocument; } });
    Object.defineProperty(Element.prototype, 'win', { get() { return this.ownerDocument.defaultView; } });
    Element.prototype.addClass = function (...names) { this.classList.add(...names); };
    Element.prototype.removeClass = function (...names) { this.classList.remove(...names); };
    Element.prototype.empty = function () { this.replaceChildren(); };
    Element.prototype.createEl = function (tag, options = {}) {
        const el = document.createElement(tag);
        if (options.text) el.textContent = options.text;
        if (options.cls) el.className = options.cls;
        for (const [key, val] of Object.entries(options.attr ?? {})) el.setAttribute(key, val);
        this.appendChild(el);
        return el;
    };
    Element.prototype.createDiv = function (options) { return this.createEl('div', options); };
    Element.prototype.setCssStyles = function (styles) { Object.assign(this.style, styles); };
    Element.prototype.getCssPropertyValue = function (key) { return this.win.getComputedStyle(this).getPropertyValue(key); };
    String.prototype.contains = String.prototype.includes;
    class Component {
        cleanups = [];
        registerDomEvent(el, event, handler, options) {
            el.addEventListener(event, handler, options);
            this.cleanups.push(() => el.removeEventListener(event, handler, options));
        }
        dispose() { this.cleanups.forEach(fn => fn()); }
    }
    class ItemView extends Component {
        constructor(leaf) { super(); this.leaf = leaf; this.app = leaf.app; this.contentEl = document.body.createDiv(); }
    }
    const notices = [];
    const api = { ItemView, Plugin: Component, MarkdownView: class {}, PluginSettingTab: class {},
        Platform: { isDesktopApp: true }, Notice: class { constructor(msg) { notices.push(msg); } }, setIcon() {} };
    const cache = {};
    function load(file) {
        file = path.resolve(file);
        if (cache[file]) return cache[file].exports;
        const mod = { exports: {} }; cache[file] = mod;
        const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
        }).outputText;
        const context = vm.createContext({ exports: mod.exports, module: mod, console,
            MutationObserver: dom.window.MutationObserver, document,
            require: name => name === 'obsidian' ? api : name.startsWith('.') ? load(path.join(path.dirname(file), `${name}.ts`)) : require(name) });
        vm.runInContext('String.prototype.contains = String.prototype.includes;', context);
        vm.runInContext(code, context, { filename: file });
        return mod.exports;
    }
    return { document, dom, api, notices, load };
}

test('snapshot restores SVG intrinsic dimensions without changing source or Mermaid label geometry', () => {
    const env = environment();
    const root = env.document.body.createDiv();
    root.style.cssText = 'max-width:300px;height:60px;overflow:hidden;clip-path:inset(0)';
    root.innerHTML = '<button class="mermaid-popup-button"></button><div class="mermaid" style="height:60px"><svg viewBox="0 0 1600 900" style="width:100px;height:60px;max-width:100px"><foreignObject width="200" height="60"><div style="width:180px;height:50px">Label</div></foreignObject></svg></div>';
    const before = root.innerHTML;
    const { captureDiagram } = env.load('src/diagram-view.ts');
    const result = captureDiagram(root);
    assert.equal(result.width, 1600); assert.equal(result.height, 900);
    assert.equal(result.element.querySelector('svg').style.width, '1600px');
    assert.equal(result.element.querySelector('foreignObject div').style.width, '180px');
    assert.equal(result.element.style.width, '1600px');
    assert.equal(result.element.style.overflow, 'visible');
    assert.equal(result.element.style.maxWidth, 'none');
    assert.equal(result.element.style.clipPath, 'none');
    assert.equal(result.element.querySelector('svg').style.getPropertyPriority('width'), 'important');
    assert.equal(result.element.querySelector('.mermaid-popup-button'), null);
    assert.equal(root.innerHTML, before);
});

test('native view supports fit, independent zoom/pan, resize, close, and lifecycle cleanup', async () => {
    const env = environment();
    const { DiagramView, captureDiagram } = env.load('src/diagram-view.ts');
    let closed = 0;
    const view = new DiagramView({ detach() { closed++; } }, { settings: { ZoomRatioValue: '0.2', MoveStepValue: '30' } });
    await view.onOpen();
    const stage = view.contentEl.querySelector('.diagram-native-stage');
    Object.defineProperty(stage, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(stage, 'clientHeight', { value: 700, configurable: true });
    const source = env.document.body.createDiv(); source.innerHTML = '<svg viewBox="0 0 1600 900"></svg>';
    view.setDiagram(captureDiagram(source), 'Example.md');
    const surface = stage.firstElementChild;
    const initial = surface.style.transform;
    const click = label => view.contentEl.querySelector(`[aria-label="${label}"]`).click();
    assert.match(initial, /scale\(0.595\)/);
    click('Zoom in'); assert.notEqual(surface.style.transform, initial);
    click('Move →'); assert.notEqual(surface.style.transform, initial);
    click('Fit diagram to window'); assert.equal(surface.style.transform, initial);
    click('Actual size'); assert.match(surface.style.transform, /scale\(1\)/);
    stage.dispatchEvent(new env.dom.window.WheelEvent('wheel', { deltaY: -1, clientX: 50, clientY: 50, cancelable: true }));
    assert.match(surface.style.transform, /scale\(1.2\)/);
    // Manual zoom must grow beyond both the viewport and the old 20x ceiling.
    for (let i = 0; i < 30; i++) click('Zoom in');
    const enlarged = surface.style.transform;
    const enlargedScale = Number(enlarged.match(/scale\(([^)]+)\)/)[1]);
    assert.ok(enlargedScale > 20);
    assert.ok(1600 * enlargedScale > stage.clientWidth);
    view.onResize(); assert.equal(surface.style.transform, enlarged);
    click('Move →'); assert.notEqual(surface.style.transform, enlarged);
    const tiny = env.document.body.createDiv(); tiny.innerHTML = '<svg viewBox="0 0 10 10"></svg>';
    view.setDiagram(captureDiagram(tiny), 'Tiny.md');
    const tinyFit = Number(surface.style.transform.match(/scale\(([^)]+)\)/)[1]);
    assert.ok(tinyFit > 20);
    click('Zoom in');
    assert.ok(Number(surface.style.transform.match(/scale\(([^)]+)\)/)[1]) > tinyFit);
    view.setDiagram(captureDiagram(source), 'Example.md');
    click('Fit diagram to window');
    Object.defineProperty(stage, 'clientWidth', { value: 800 }); view.onResize();
    assert.notEqual(surface.style.transform, initial);
    assert.equal(env.document.querySelector('.popup-overlay'), null);
    click('Close diagram preview'); assert.equal(closed, 1);
    view.dispose(); click('Close diagram preview'); assert.equal(closed, 1);
});

test('desktop uses native workspace API, mobile/legacy use overlay, failed opens close the new leaf', async () => {
    const env = environment();
    const Plugin = env.load('src/main.ts').default;
    const { DiagramView } = env.load('src/diagram-view.ts');
    const plugin = new Plugin(); plugin.settings = { previewMode: 'window' };
    let native = 0, overlays = 0, detached = 0;
    const leaf = { async setViewState(state) { assert.equal(state.type, 'diagram-popup-preview'); }, detach() { detached++; } };
    leaf.view = Object.create(DiagramView.prototype);
    leaf.view.setDiagram = snapshot => assert.equal(snapshot.width, 800);
    plugin.app = { workspace: { getLeavesOfType: () => [], openPopoutLeaf(options) {
        assert.equal(options.size.width, 1000); native++; return leaf;
    } } };
    plugin.openLegacyPopup = () => overlays++;
    const source = env.document.body.createDiv();
    await plugin.openPopup(source); assert.equal(native, 1); assert.equal(overlays, 0);
    env.api.Platform.isDesktopApp = false;
    await plugin.openPopup(source); assert.equal(overlays, 1);
    env.api.Platform.isDesktopApp = true; plugin.settings.previewMode = 'popup';
    await plugin.openPopup(source); assert.equal(overlays, 2);
    plugin.settings.previewMode = 'window'; leaf.setViewState = async () => { throw new Error('test failure'); };
    await plugin.openPopup(source); assert.equal(detached, 1); assert.equal(env.notices.length, 1);
});

test('discovery watches every note while preview is active and disconnects closed notes', async () => {
    const env = environment();
    const Plugin = env.load('src/main.ts').default;
    const plugin = new Plugin();
    const first = env.document.body.createDiv();
    const second = env.document.body.createDiv();
    let leaves = [first, second].map(containerEl => ({ view: { containerEl } }));
    plugin.app = { workspace: { getLeavesOfType: () => leaves } };
    plugin.settings = { kvMap: {}, kvMapDefault: { Mermaid: '.mermaid' }, kvMapReserved: {} };
    let discovered = 0;
    plugin.addPopupButton = () => discovered++;
    plugin.watchMarkdownViews();
    first.innerHTML = '<div class="mermaid"></div>';
    second.innerHTML = '<div class="mermaid"></div>';
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(discovered, 2);
    assert.equal(plugin.markdownObservers.size, 2);
    leaves = leaves.slice(1); plugin.watchMarkdownViews();
    assert.equal(plugin.markdownObservers.size, 1);
    first.appendChild(env.document.createElement('div'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(discovered, 2);
    leaves = []; plugin.watchMarkdownViews();
    assert.equal(plugin.markdownObservers.size, 0);
});

type NodeFilterResult = 1 | 2 | 3;
type Rangeish = Range | Node | TyperRangeish;
type Rectish = Rect | ClientRect | TyperRectish;
type Pointish = Point | Offset | MouseEvent | Touch;
type CaretPoint = 'base' | 'extend' | 'start' | 'end';
type SelectMode = 'word';

declare enum TyperNodeType {
    NODE_WIDGET = 1,
    NODE_EDITABLE = 2,
    NODE_PARAGRAPH = 4,
    NODE_INLINE = 16,
    NODE_EDITABLE_PARAGRAPH = 32,
    NODE_INLINE_WIDGET = 64,
    NODE_INLINE_EDITABLE = 128,
    NODE_SHOW_HIDDEN = 8192,
}

interface Dictionary<T> {
    [name: string]: T;
}

interface Iterator<T> {
    previousNode(): T;
    nextNode(): T;
}

interface Callback<T> {
    (node: T): any;
}

interface TyperEventHandler<T extends TyperEvent> {
    (event: T): any;
}

interface Rect {
    top: number;
    left: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

interface Point {
    x: number;
    y: number
}

interface Offset {
    left: number;
    top: number;
}

interface TyperRangeish {
    getRange(): Range;
}

interface TyperRectish {
    getRect(): Rect;
}

interface TyperCommand {
    (tx: TyperTransaction, value?: any): any;
}

interface TyperEvent {
    readonly typer: Typer;
    readonly eventName: string;
    readonly timestamp: number;
    readonly widget: TyperWidget;
    readonly data: any;
}

interface TyperWidgetEvent extends TyperEvent {
    readonly targetWidget: TyperWidget;
}

interface TyperDefaultPreventableEvent extends TyperEvent {
    preventDefault(): void;
    isDefaultPrevented(): boolean;
}

interface TyperWidgetExtractEvent extends TyperEvent {
    readonly extractedNode: Element;
}

interface TyperWidgetReceiveEvent extends TyperDefaultPreventableEvent {
    readonly receivedNode: Element;
    readonly caret: TyperCaret;
}

interface TyperEventReceiver extends Dictionary<TyperEventHandler<TyperEvent>> {
    init?: TyperEventHandler<TyperEvent>;
    destroy?: TyperEventHandler<TyperEvent>;
    extract?: TyperEventHandler<TyperWidgetExtractEvent>;
    receive?: TyperEventHandler<TyperWidgetReceiveEvent>;
    beforeStateChange?: TyperEventHandler<TyperEvent>;
    stateChange?: TyperEventHandler<TyperEvent>;
    contentChange?: TyperEventHandler<TyperEvent>;
    focusin?: TyperEventHandler<TyperEvent>;
    focusout?: TyperEventHandler<TyperEvent>;
    keystroke?: TyperEventHandler<TyperDefaultPreventableEvent>;
    textInput?: TyperEventHandler<TyperDefaultPreventableEvent>;
    click?: TyperEventHandler<TyperDefaultPreventableEvent>;
    dblclick?: TyperEventHandler<TyperDefaultPreventableEvent>;
    mousewheel?: TyperEventHandler<TyperDefaultPreventableEvent>;
    widgetInit?: TyperEventHandler<TyperWidgetEvent>;
    widgetDestroy?: TyperEventHandler<TyperWidgetEvent>;
}

interface TyperDocument {
    getNode(node: Node): TyperNode;
}

interface TyperUndoable {
    getValue(): any;
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    snapshot(milliseconds: number | boolean): void;
}

interface Typer extends TyperDocument, TyperUndoable {
    readonly element: Element;

    hasCommand(commandName: string): boolean;
    focused(): boolean;
    widgetEnabled(widgetName: string): boolean;
    widgetAllowed(widgetName: string, node: TyperNode): boolean;
    getStaticWidget(id: string): TyperWidget | null;
    getStaticWidgets(): TyperWidget[];
    getSelection(): TyperSelection;
    extractText(selection: Rangeish): string;
    nodeFromPoint(x: number, y: number, whatToShow?: TyperNodeType): TyperNode;
    retainFocus(element: Element): void;
    releaseFocus(element: Element): void;
    invoke(command: string | TyperCommand, value?: any): void;

    createCaret(): TyperCaret;
    createCaret(node: Node, offset: number): TyperCaret;

    createSelection(range: TyperRangeish): TyperSelection;
    createSelection(startNode: Node, collapse?: boolean): TyperSelection;
    createSelection(startNode: Node, startOffset: number, endNode?: Node, endOffset?: number): TyperSelection;
    createSelection(range: Range, collapse?: boolean): TyperSelection;
    createSelection(start: Range, end: Range): TyperSelection;
}

interface TyperOptions extends Dictionary<any>, TyperEventReceiver {
    element: Element;
    inline?: boolean;
    disallowedElement?: string;
    widgets?: TyperWidgetDefinition[];
}

interface TyperTransaction {
    readonly typer: Typer;
    readonly selection: TyperSelection;
    readonly widget: TyperWidget;

    insertText(text: string): void;
    insertHtml(content: string | Node): void;
    insertWidget(name: string, options: Dictionary<any>): void;
    removeElement(element: Element): void;
    removeWidget(widget: TyperWidget): void;
    trackChange(node: Node | TyperNode | TyperWidget): void;
}

interface TyperWidget {
    readonly typer: TyperDocument | Typer;
    readonly id: number;
    readonly element: Element;
    readonly options: Dictionary<any>;

    remove(): void;
}

interface TyperWidgetDefinition extends Dictionary<any>, TyperEventReceiver {
    element?: string | Element;
    editable?: string;
    allow?: string;
    allowedIn?: string;
    textFlow?: boolean;
    options?: Dictionary<any>;
    commands?: Dictionary<TyperCommand>;
    text?: (widget: TyperWidget) => string;
    insert?: (tx: TyperTransaction, options: Dictionary<any>) => void;
    remove?: 'keepText' | ((tx: TyperTransaction, widget: TyperWidget) => void);
}

interface TyperCaret extends TyperRangeish, TyperRectish {
    readonly typer: Typer;
    readonly node: TyperNode;
    readonly element: Element;
    readonly textNode: Text | null;
    readonly offset: number;

    getRange(): Range;
    getRect(): Rect;
    clone(): TyperCaret;
    moveTo(range: Rangeish): boolean;
    moveTo(node: Node, offset: number): boolean;
    moveToPoint(x: number, y: number): boolean;
    moveToText(node: Node, offset: number): boolean;
    moveToLineEnd(direction: number): boolean;
    moveByLine(direction: number): boolean;
    moveByWord(direction: number): boolean;
    moveByCharacter(direction: number): boolean;
}

interface TyperSelection extends TyperRangeish {
    readonly typer: Typer;
    readonly baseCaret: TyperCaret;
    readonly extendCaret: TyperCaret;
    readonly focusNode: TyperNode;
    readonly direction: number;
    readonly isCaret: boolean;
    readonly isSingleEditable: boolean;
    readonly timestamp: number;

    readonly startNode: TyperNode;
    readonly startElement: Element;
    readonly startTextNode: Text | null;
    readonly startOffset: number;

    readonly endNode: TyperNode;
    readonly endElement: Element;
    readonly endTextNode: Text | null;
    readonly endOffset: number;

    getCaret(point?: CaretPoint): TyperCaret;
    getParagraphElements(): Element[];
    getRange(collapse?: boolean): Range;
    getSelectedElements(): Element[];
    getSelectedText(): string;
    getSelectedTextNodes(): Text[];
    getWidgets(): TyperWidget[];
    widgetAllowed(widgetName: string): boolean;

    createTreeWalker(whatToShow: number, filter?: (node: TyperNode) => NodeFilterResult): TyperTreeWalker;

    select(mode: SelectMode): boolean;
    select(range: TyperRangeish): boolean;
    select(startNode: Node, collapse?: boolean): boolean;
    select(startNode: Node, startOffset: number, endNode?: Node, endOffset?: number): boolean;
    select(range: Range, collapse?: boolean): boolean;
    select(start: Range, end: Range): boolean;

    moveTo(range: Rangeish): boolean;
    moveTo(node: Node, offset: number): boolean;
    moveToPoint(x: number, y: number): boolean;
    moveToText(node: Node, offset: number): boolean;
    moveToLineEnd(direction: number): boolean;
    moveByLine(direction: number): boolean;
    moveByWord(direction: number): boolean;
    moveByCharacter(direction: number): boolean;

    selectAll(): boolean;
    collapse(point?: CaretPoint): boolean;
    focus(): void;
    clone(): TyperSelection;
}

interface TyperNode {
    readonly typer: Typer;
    readonly element: Element;
    readonly widget: TyperWidget;
    readonly childNodes: TyperNode[];
    readonly firstChild: Node;
    readonly lastChild: Node;
    readonly nodeType: TyperNodeType;
}

interface TyperTreeWalker extends Iterator<TyperNode> {
    readonly whatToShow: number;
    readonly filter: (node: TyperNode) => NodeFilterResult;
    readonly root: TyperNode;
    currentNode: TyperNode;

    previousSibling(): TyperNode;
    nextSibling(): TyperNode;
    firstChild(): TyperNode;
    lastChild(): TyperNode;
    parentNode(): TyperNode;
    previousNode(): TyperNode;
    nextNode(): TyperNode;
}

interface TyperDOMNodeIterator extends Iterator<Node> {
    readonly whatToShow: number;
    readonly filter: (node: Node) => NodeFilterResult;
    currentNode: Node;

    previousNode(): Node;
    nextNode(): Node;
}

interface TyperStatic {
    readonly NODE_WIDGET: TyperNodeType;
    readonly NODE_EDITABLE: TyperNodeType;
    readonly NODE_EDITABLE_PARAGRAPH: TyperNodeType;
    readonly NODE_PARAGRAPH: TyperNodeType;
    readonly NODE_INLINE: TyperNodeType;
    readonly NODE_INLINE_WIDGET: TyperNodeType;
    readonly NODE_INLINE_EDITABLE: TyperNodeType;
    readonly NODE_ANY_ALLOWTEXT: TyperNodeType,
    readonly NODE_ANY_BLOCK_EDITABLE: TyperNodeType,
    readonly NODE_ANY_INLINE: TyperNodeType,
    readonly ZWSP: string;
    readonly ZWSP_ENTITY: string;

    new(options: TyperOptions): Typer;

    readonly widgets: Dictionary<TyperWidgetDefinition>;
    readonly presets: Dictionary<TyperOptions>;
    readonly defaultOptions: TyperOptions;
    readonly ui: TyperUIStatic;
    historyLevel: number;

    iterate<T>(iterator: Iterator<T>, callback: Callback<T>, from?: T): void;
    iterateToArray<T>(iterator: Iterator<T>, callback: Callback<T>, from?: T): any[];
    compareAttrs(a: Node, b: Node): boolean;
    comparePosition(a: Node, b: Node): number;
    compareRangePosition(a: Rangeish, b: Rangeish): number;
    containsOrEquals(a: Node, b: Node): boolean;
    rangeIntersects(a: Rangeish, b: Rangeish): boolean;
    rangeCovers(a: Rangeish, b: Rangeish): boolean;
    rangeEquals(a: Rangeish, b: Rangeish): boolean;
    rectEquals(a: ClientRect, b: ClientRect): boolean;
    rectCovers(a: ClientRect, b: ClientRect): boolean;
    pointInRect(x: number, y: number, b: ClientRect): boolean;
    elementFromPoint(x: number, y: number): Element;
    caretRangeFromPoint(x: number, y: number, within?: Element): Range;
    createElement(tagName: string): Element;
    createTextNode(nodeValue?: string): Text;
    createDocumentFragment(content: Node | string): DocumentFragment
    trim(str: string): string;
    closest(node: TyperNode, nodeType: TyperNodeType): TyperNode;
    is(a: Object, b: Function): Object | false;
    is(a: TyperNode, b: TyperNodeType): TyperNode | false;
    is(a: Element, b: string): Element | false;

    createRange(range: TyperRangeish): Range;
    createRange(startNode: Node, collapse?: boolean): Range;
    createRange(startNode: Node, startOffset: number, endNode?: Node, endOffset?: number): Range;
    createRange(range: Range, collapse?: boolean): Range;
    createRange(start: Range, end: Range): Range;

    getRect(): Rect;
    getRect(element: Element): Rect;
    toPlainRect(rect: DOMRect | ClientRect): Rect;
    toPlainRect(left: number, top: number, right: number, bottom: number): Rect;

    preset(element: Element, name: string, options: TyperOptions): Typer;
}

type Direction = 'left' | 'top' | 'right' | 'bottom';

type TyperControlEventHandler = (ui: TyperUI, control: TyperControl, data: any) => void;
type TyperControlStateHandler = (ui: TyperUI, control: TyperControl) => boolean;
type TyperControlBinder = (ui: TyperUI, control: TyperControl, value: any) => any;

interface TyperControl {
    readonly name: string;
    readonly type: string;
    readonly controls: TyperControl[];

    is(type: string): boolean;
    parentOf(control: TyperControl): boolean;
    resolve(control: string): TyperControl[];
    resolveOne(control: string): TyperControl | null;
    set(prop: string, value: any): void;
    set(value: any): void;
    getValue(): any;
    setValue(value: any): void;
    getState(name: string): boolean | string[];
    setState(name: string, state: boolean | string[]): void;
}

interface TyperControlDefinition {
}

interface TyperControlOptions extends Dictionary<any>, Dictionary<TyperControlEventHandler> {
    name?: string;
    icon?: string;
    label?: string;
    defaultNS?: string;
    controls?: string | TyperControlDefinition[] | ((ui: TyperUI, control: TyperControl) => string | TyperControlDefinition[]);

    buttonsetGroup?: 'left' | 'right';
    hiddenWhenDisabled?: boolean;
    renderAs?: string,
    requireChildControls?: boolean;
    requireTyper?: boolean;
    requireWidget?: string,
    requireWidgetEnabled?: string,
    showButtonLabel?: boolean,
    hideCalloutOnExecute?: boolean,

    init?: TyperControlEventHandler;
    stateChange?: TyperControlEventHandler;
    validate?: TyperControlEventHandler;
    execute?: TyperControlEventHandler;
    destroy?: TyperControlEventHandler;

    dialog?: (ui: TyperUI, control: TyperControl) => Promise<any> | null;
    enabled?: boolean | TyperControlStateHandler;
    visible?: boolean | TyperControlStateHandler;
    active?: boolean | TyperControlStateHandler;
}

interface TyperUI {
    readonly element: Element;

    update(): void;
    destroy(): void;
    getControl(element: Element): TyperControl | null;
    resolve(control: string): TyperControl[];
    trigger(control: string | TyperControl, event: string, data?: any): void;
    show(control: string | TyperControl, element: Element, ref: Element, pos: Direction): void;
    hide(control: string | TyperControl): void;
    enabled(control: string | TyperControl): boolean;
    active(control: string | TyperControl): boolean;
    visible(control: string | TyperControl): boolean;
    getIcon(control: TyperControl): string;
    getLabel(control: TyperControl): string;
    validate(): boolean;
    reset(): void;
    getValue(): any;
    getValue(control: string | TyperControl): any;
    setValue(value: any): void;
    setValue(control: string | TyperControl, value: any): void;
    set(control: string, prop: string, value: any): void;
    execute(control: string | TyperControl, value: any): void;
}

interface TyperUIOptions extends Dictionary<any>, Dictionary<TyperControlEventHandler> {
    language?: string;
    theme?: string;
    controls: string;

    init?: TyperControlEventHandler;
    executing?: TyperControlEventHandler;
    executed?: TyperControlEventHandler;
    cancelled?: TyperControlEventHandler;
}

interface TyperTheme extends Dictionary<any>, Dictionary<TyperControlEventHandler>, Dictionary<TyperControlBinder> {
    controlActiveClass: string;
    controlDisabledClass: string;
    controlHiddenClass: string;
    controlPinActiveClass: string;
    controlErrorClass: string;
    iconset: string;

    init?: TyperControlEventHandler;
    executing?: TyperControlEventHandler;
    executed?: TyperControlEventHandler;
    cancelled?: TyperControlEventHandler;
    postValidate?: TyperControlEventHandler;
    showCallout?: TyperControlEventHandler;
    afterShow?: TyperControlEventHandler;
    beforeHide?: TyperControlEventHandler;
    positionUpdate?: TyperControlEventHandler;

    bind: TyperControlBinder;
    bindIcon: TyperControlBinder;
    bindShortcut: TyperControlBinder;
}

interface TyperUIStatic {
    (options?: TyperUIOptions): TyperUI;
    (controls: string, options?: TyperUIOptions): TyperUI;

    readonly isTouchDevice: bool;

    readonly controls: Dictionary<TyperControlDefinition>;
    readonly themes: Dictionary<TyperTheme>;
    readonly controlExtensions: Dictionary<any>;

    matchWSDelim(needle: string, haystack: string): string | false;
    getWheelDelta(e: MouseWheelEvent): number;
    listen(obj: object, prop: string, callback: (obj: object, prop: string, value: any) => void): void;

    getZIndex(element: Element, pseudo?: string): number;
    getZIndexOver(element: Element): number;
    setZIndex(element: Element, over: Element): void;
    cssFromPoint(x: number, y: number, origin?: Element, parent?: Element): object;
    cssFromPoint(point: Pointish, origin?: Element, parent?: Element): object;
    cssFromRect(rect: Rect, parent?: Element): object;

    define(name: string, base?: object, ctor?: Function): Function;

    getShortcut(command: string): string | null;
    setShortcut(command: string, keystroke: string): void;

    addHook(keystroke: string, hook: Function): void;
    addControls(values: Dictionary<TyperControlDefinition>): void;
    addControls(ns: string, values: Dictionary<TyperControlDefinition>): void;
    addLabels(lang: string, values: Dictionary<string>): void;
    addLabels(lang: string, ns: string, values: Dictionary<string>): void;
    addIcons(iconSet: string, values: Dictionary<string>): void;
    addIcons(iconSet: string, ns: string, values: Dictionary<string>): void;

    snap(element: Element, to: Element, dir: string): void;
    unsnap(element: Element): void;
    focus(element: Element, inputOnly?: boolean): void;

    alert(message): Promise<any>;
    confirm(message): Promise<any>;
    prompt(message, value): Promise<any>;

    group(options: TyperControlOptions): TyperControlDefinition;
    dropdown(options: TyperControlOptions): TyperControlDefinition;
    callout(options: TyperControlOptions): TyperControlDefinition;
    label(options: TyperControlOptions): TyperControlDefinition;
    button(options: TyperControlOptions): TyperControlDefinition;
    link(options: TyperControlOptions): TyperControlDefinition;
    file(options: TyperControlOptions): TyperControlDefinition;
    textbox(options: TyperControlOptions): TyperControlDefinition;
    checkbox(options: TyperControlOptions): TyperControlDefinition;
    dialog(options: TyperControlOptions): TyperControlDefinition;
}

declare module "typer" {
    export = TyperStatic;
}

declare let Typer: TyperStatic;

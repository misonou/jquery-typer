type NodeFilterResult = 1 | 2 | 3;
type Rangeable = Range | Node | TyperRangeable;
type CaretPoint = 'base' | 'extend' | 'start' | 'end';
type SelectMode = 'word';

declare enum TyperNodeType {
    NODE_WIDGET = 1,
    NODE_EDITABLE = 2,
    NODE_PARAGRAPH = 4,
    NODE_OUTER_PARAGRAPH = 8,
    NODE_INLINE = 16,
    NODE_EDITABLE_PARAGRAPH = 32,
    NODE_INLINE_WIDGET = 64,
    NODE_INLINE_EDITABLE = 128,
    NODE_SHOW_EDITABLE = 4096,
}

interface Map<T> {
    [name: string]: T;
}

interface Iterator<T> {
}

interface Callback<T> {
    (node: T): any;
}

interface TyperEventHandler<T extends TyperEvent> {
    (event: T): any;
}

interface TyperCommand {
    (tx: TyperTransaction, value?: any): any;
}

interface TyperDocument {
    getNode(node: Node): TyperNode;
    getEditableNode(node: Node): TyperNode;
}

interface TyperUndoable {
    undo(): void;
    redo(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    snapshot(milliseconds: number | boolean): void;
}

interface TyperRangeable {
    getRange(): Range;
}

interface TyperEvent {
    readonly typer: Typer;
    readonly eventName: string;
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

interface TyperEventReceiver extends Map<TyperEventHandler<TyperEvent>> {
    init?: TyperEventHandler<TyperEvent>;
    destroy?: TyperEventHandler<TyperEvent>;
    change?: TyperEventHandler<TyperEvent>;
    beforeStateChange?: TyperEventHandler<TyperEvent>;
    stateChange?: TyperEventHandler<TyperEvent>;
    focusin?: TyperEventHandler<TyperEvent>;
    focusout?: TyperEventHandler<TyperEvent>;
    keystroke?: TyperEventHandler<TyperDefaultPreventableEvent>;
    widgetInit?: TyperEventHandler<TyperWidgetEvent>;
    widgetDestroy?: TyperEventHandler<TyperWidgetEvent>;
    widgetFocusin?: TyperEventHandler<TyperWidgetEvent>;
    widgetFocusout?: TyperEventHandler<TyperWidgetEvent>;
}

interface Typer extends TyperDocument, TyperUndoable {
    readonly element: Element;

    hasCommand(commandName: string): boolean;
    widgetEnabled(widgetName: string): boolean;
    getStaticWidgets(): TyperWidget[];
    getSelection(): TyperSelection;
    extractText(selection: TyperSelection): string;
    nodeFromPoint(x: number, y: number): TyperNode;
    retainFocus(element: Element): void;
    invoke(command: string | TyperCommand): void;
}

interface TyperOptions extends Map<any>, TyperEventReceiver {
    element: Element;
    inline?: boolean;
    defaultOptions?: boolean;
    disallowedElement?: string;
    historyLevel?: number;
    widgets?: TyperWidgetDefinition[];
}

interface TyperWidget {
    readonly typer: TyperDocument | Typer;
    readonly id: number;
    readonly element: Element;
    readonly options: Map<any>;

    remove(): void;
}

interface TyperWidgetDefinition extends Map<any>, TyperEventReceiver {
    element?: string | Element;
    editable?: string;
    inline?: boolean;
    allowedWidgets?: string;
    disallowedWidgets?: string;
    commands?: Map<TyperCommand>;
}

interface TyperWidgetOptions extends Map<any> {
}

interface TyperCaret extends TyperRangeable {
    readonly typer: Typer;
    readonly node: TyperNode;
    readonly element: Element;
    readonly textNode: Text | null;
    readonly offset: number;

    getRange(): Range;
    clone(): TyperCaret;
    moveTo(direction: number): boolean;
    moveToPoint(direction: number): boolean;
    moveToText(direction: number): boolean;
    moveToLineEnd(direction: number): boolean;
    moveByLine(direction: number): boolean;
    moveByWord(direction: number): boolean;
    moveByCharacter(direction: number): boolean;
}

interface TyperSelection extends TyperRangeable {
    readonly typer: Typer;
    readonly baseCaret: TyperCaret;
    readonly extendCaret: TyperCaret;
    readonly direction: number;
    readonly isCaret: boolean;
    readonly focusNode: TyperNode;
    readonly timestamp: number;
    readonly isSingleEditable: boolean;

    getCaret(point?: string): TyperCaret;
    getEditableElements(): Element[];
    getEditableRanges(): Range[];
    getParagraphElements(): Element[];
    getRange(collapse?: boolean): Range;
    getSelectedElements(): Element[];
    getSelectedText(): string;
    getSelectedTextNodes(): Text[];
    getWidgets(): TyperWidget[];

    createTreeWalker(whatToShow: number, filter?: (node: TyperNode) => NodeFilterResult): TyperTreeWalker;
    createDOMNodeIterator(whatToShow: number, filter?: (node: Node) => NodeFilterResult): TyperDOMNodeIterator;

    select(mode: SelectMode): boolean;
    select(range: TyperRangeable): boolean;
    select(startNode: Node, collapse?: boolean): boolean;
    select(startNode: Node, startOffset: number, endNode?: Node, endOffset?: number): boolean;
    select(range: Range, collapse?: boolean): boolean;
    select(start: Range, end: Range): boolean;

    moveToPoint(direction: number): boolean;
    moveToText(direction: number): boolean;
    moveToLineEnd(direction: number): boolean;
    moveByLine(direction: number): boolean;
    moveByWord(direction: number): boolean;
    moveByCharacter(direction: number): boolean;

    focus(): void;
    clone(): TyperSelection;
}

interface TyperTransaction {
    readonly typer: Typer;
    readonly selection: TyperSelection;
    readonly widget: TyperWidget;

    insertText(text: string): void;
    insertHtml(content: string | Node): void;
    insertWidget(name: string, options: TyperWidgetOptions): void;
    removeWidget(widget: TyperWidget): void;
    execCommand(commandName: string, ...args): void;
}

interface TyperNode {
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
    readonly NODE_SHOW_EDITABLE: TyperNodeType;
    readonly ZWSP: string;
    readonly ZWSP_ENTITY: string;

    new (options: TyperOptions): Typer;

    widgets: Map<TyperWidgetDefinition>;
    defaultOptions: TyperOptions;

    iterate<T>(iterator: Iterator<T>, callback: Callback<T>, from?: T): void;
    iterateToArray<T>(iterator: Iterator<T>, callback: Callback<T>, from?: T): any[];
    compareAttrs(a: Node, b: Node): boolean;
    comparePosition(a: Node, b: Node): number;
    compareRangePosition(a: Rangeable, b: Rangeable): number;
    containsOrEquals(a: Node, b: Node): boolean;
    rangeIntersects(a: Rangeable, b: Rangeable): boolean;
    rangeCovers(a: Rangeable, b: Rangeable): boolean;
    rangeEquals(a: Rangeable, b: Rangeable): boolean;
    rectEquals(a: ClientRect, b: ClientRect): boolean;
    caretRangeFromPoint(x: number, y: number, within?: Element): Range;
    createElement(tagName: string): Element;
    createTextNode(nodeValue?: string): Text;
    createDocumentFragment(content: Node | string): DocumentFragment
    trim(str: string): string;

    createRange(range: TyperRangeable): Range;
    createRange(startNode: Node, collapse?: boolean): Range;
    createRange(startNode: Node, startOffset: number, endNode?: Node, endOffset?: number): Range;
    createRange(range: Range, collapse?: boolean): Range;
    createRange(start: Range, end: Range): Range;
}

declare module "typer" {
    export = TyperStatic;
}

declare let Typer: TyperStatic;

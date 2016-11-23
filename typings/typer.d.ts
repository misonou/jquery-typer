type NodeFilterResult = 1 | 2 | 3;

type CollapseMode = boolean | CollapseModeIntValue;

declare enum CollapseModeIntValue {
    COLLAPSE_START_INSIDE = 7,
    COLLAPSE_START_OUTSIDE = 6,
    COLLAPSE_END_INSIDE = 3,
    COLLAPSE_END_OUTSIDE = 2,
}

declare enum TyperNodeType {
    NODE_WIDGET = 1,
    NODE_EDITABLE = 2,
    NODE_PARAGRAPH = 4,
    NODE_OUTER_PARAGRAPH = 8,
    NODE_INLINE = 16,
    NODE_EDITABLE_INLINE = 32,
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

interface TyperEventHandler {
    (event: TyperEvent, ...rest): any;
}

interface TyperCommand {
    (tx: TyperTransaction, ...rest): any;
}

interface TyperEventReceiver extends Map<TyperEventHandler> {
    init?: TyperEventHandler;
    destroy?: TyperEventHandler;
    change?: TyperEventHandler;
    beforeStateChange?: TyperEventHandler;
    stateChange?: TyperEventHandler;
    focusin?: TyperEventHandler;
    focusout?: TyperEventHandler;
    widgetInit?: TyperEventHandler;
    widgetDestory?: TyperEventHandler;
    widgetFocusin?: TyperEventHandler;
    widgetFocusout?: TyperEventHandler;
}

interface TyperStatic {
    readonly COLLAPSE_START_INSIDE: CollapseModeIntValue;
    readonly COLLAPSE_START_OUTSIDE: CollapseModeIntValue;
    readonly COLLAPSE_END_INSIDE: CollapseModeIntValue;
    readonly COLLAPSE_END_OUTSIDE: CollapseModeIntValue;
    readonly NODE_WIDGET: TyperNodeType;
    readonly NODE_EDITABLE: TyperNodeType;
    readonly NODE_PARAGRAPH: TyperNodeType;
    readonly NODE_OUTER_PARAGRAPH: TyperNodeType;
    readonly NODE_INLINE: TyperNodeType;
    readonly NODE_EDITABLE_INLINE: TyperNodeType;
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
    compareRangePosition(a: Range | Node, b: Range | Node): number;
    containsOrEquals(a: Node, b: Node): boolean;
    rangeIntersects(a: Range | Node, b: Range | Node): boolean;
    rangeCovers(a: Range | Node, b: Range | Node): boolean;
    getRangeFromMouseEvent(e: MouseEvent): Range;

    createRange(selection: TyperSelection): Range;
    createRange(startNode: Node, collapse: CollapseMode): Range;
    createRange(startNode: Node, startOffset: number | boolean, endNode: Node, endOffset?: number | boolean): Range;
    createRange(range: Range, collapse?: CollapseMode): Range;
    createRange(start: Range, end: Range): Range;
}

interface Typer {
    readonly element: Element;
    readonly document: TyperDocument;

    canUndo(): boolean;
    canRedo(): boolean;
    undo(): void;
    redo(): void;
    hasCommand(commandName: string): boolean;
    getSelection(): TyperSelection;
    retainFocus(element: Element): void;
    moveCaret(node: Node, offset: number): void;
    invoke(command: string | TyperCommand): void;

    select(selection: TyperSelection): void;
    select(startNode: Node, collapse: CollapseMode): void;
    select(startNode: Node, startOffset: number | boolean, endNode: Node, endOffset?: number | boolean): void;
    select(range: Range, collapse?: CollapseMode): void;
    select(start: Range, end: Range): void;
}

interface TyperOptions extends Map<any>, TyperEventReceiver {
    element: Element;
    controlClasses?: string;
    controlElements?: string;
    attributes?: string;
    historyLevel?: number;
    widgets?: TyperWidgetDefinition[];
}

interface TyperWidgetDefinition extends Map<any>, TyperEventReceiver {
    element?: string | Element;
    editable?: string;
    inline?: boolean;
    commands?: Map<TyperCommand>;
}

interface TyperWidget {
    readonly typer: Typer;
    readonly id: number;
    readonly element: Element;
    readonly options: Map<any>;

    remove(): void;
}

interface TyperEvent {
    readonly typer: Typer;
    readonly eventName: string;
    readonly widget: TyperWidget;
}

interface TyperSelection {
    readonly widgets: TyperWidget[];
    readonly editableElements: Element[];
    readonly paragraphElements: Element[];
    readonly selectedElements: Element[];
    readonly previousNode: TyperNode;
    readonly nextNode: TyperNode;
    readonly previousTextNode: Text;
    readonly nextTextNode: Text;
    readonly textStart: boolean;
    readonly textEnd: boolean;
    readonly isSingleEditable: boolean;

    getSelectedElements(selector?: string): Element[];
    getEditableElements(widget: TyperWidget, selector?: string): Element[];
    createTreeWalker(whatToShow: number, filter?: (node: TyperNode) => NodeFilterResult): TyperTreeWalker;
    createDOMNodeIterator(whatToShow: number, filter?: (node: Node) => NodeFilterResult): TyperDOMNodeIterator;
}

interface TyperTransaction {
    readonly originalSelection: TyperSelection;
    readonly selection: TyperSelection;
    readonly widget: TyperWidget;

    remove(node: Node): void;
    normalize(range?: Range | Node): void;
    invoke(command: string | TyperCommand): void;
    hasCommand(commandName: string): boolean;
    insertText(text: string): void;
    insertHtml(content: string | Node): void;
    execCommand(commandName: string, ...args): void;
    getSelectedText(): string;
    getSelectedTextNodes(): Text[];
    moveCaret(node: Node, offset: number): void;
    restoreSelection(): void;

    select(selection: TyperSelection): void;
    select(startNode: Node, collapse: CollapseMode): void;
    select(startNode: Node, startOffset: number | boolean, endNode: Node, endOffset?: number | boolean): void;
    select(range: Range, collapse?: CollapseMode): void;
    select(start: Range, end: Range): void;
}

interface TyperDocument {
    readonly rootNode: TyperNode;

    getNode(node: Node): TyperNode;
}

interface TyperNode {
    readonly containingElement: Element;
    readonly element: Element | Range;
    readonly widget: TyperWidget;
    readonly childNodes: TyperNode[];
    readonly childDOMNodes: Node[];
    readonly firstChild: Node;
    readonly lastChild: Node;
    readonly nodeType: TyperNodeType;

    selectedInRange(range: Range): boolean;
    createRange(collapse: number): Range;
    createDOMNodeIterator(whatToShow: number, filter?: (node: Node) => NodeFilterResult): TyperDOMNodeIterator;
    cloneDOMNodes(deep: boolean): Node;
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

declare module "typer" {
    export = TyperStatic;
}

declare let Typer: TyperStatic;

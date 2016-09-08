type NodeFilterResult = 1 | 2 | 3;

interface Map<T> {
    [name: string]: T;
}

interface Iterable<T> {
    currentNode: T;

    previousNode(): T;
    nextNode(): T;
}

interface Callback<T> {
    (node: T): any;
}

interface TyperEventHandler {
    (event: TyperEvent): any;
}

interface TyperCommand {
    (tx: TyperTransaction, ...rest): any;
}

interface TyperWidgetBase {
    init?: TyperEventHandler;
    destroy?: TyperEventHandler;
    change?: TyperEventHandler;
    beforeStateChange?: TyperEventHandler;
    stateChange?: TyperEventHandler;
    focusin?: TyperEventHandler;
    focusout?: TyperEventHandler;
}

interface TyperStatic {
    readonly COLLAPSE_START_INSIDE: number;
    readonly COLLAPSE_START_OUTSIDE: number;
    readonly COLLAPSE_END_INSIDE: number;
    readonly COLLAPSE_END_OUTSIDE: number;

    new (options: TyperOptions): Typer;

    widgets: Map<TyperWidgetDefinition>;

    iterate<T>(iterator: Iterable<T>, callback: Callback<T>, from?: T): void;
    iterateToArray<T>(iterator: Iterable<T>, callback: Callback<T>, from?: T): any[];
    compareAttrs(a: Node, b: Node): boolean;
    comparePosition(a: Node, b: Node): number;
    compareRangePosition(a: Range | Node, b: Range | Node): number;
    containsOrEquals(a: Node, b: Node): boolean;
    rangeIntersects(a: Range | Node, b: Range | Node): boolean;
    rangeCovers(a: Range | Node, b: Range | Node): boolean;
    getRangeFromMouseEvent(e: MouseEvent): Range;

    createRange(selection: TyperSelection): Range;
    createRange(startNode: Node, collapse: number | boolean): Range;
    createRange(startNode: Node, startOffset: number | boolean, endNode: Node, endOffset?: number | boolean): Range;
    createRange(range: Range, collapse?: boolean): Range;
    createRange(start: Range, end: Range): Range;
}

interface Typer extends TyperWidgetBase {
    readonly element: Element;

    canUndo(): boolean;
    canRedo(): boolean;
    undo(): void;
    redo(): void;
    hasCommand(commandName: string): boolean;
    getSelection(): TyperSelection;
    moveCaret(node: Node, offset: number): void;
    invoke(command: string | TyperCommand): void;

    select(selection: TyperSelection): void;
    select(startNode: Node, collapse: number | boolean): void;
    select(startNode: Node, startOffset: number | boolean, endNode: Node, endOffset?: number | boolean): void;
    select(range: Range, collapse?: boolean): void;
    select(start: Range, end: Range): void;
}

interface TyperOptions extends Map<any>, TyperWidgetBase {
    element: Element;
    controlClasses?: string;
    controlElements?: string;
    attributes?: string;
    historyLevel?: number;
    widgets?: TyperWidgetDefinition[];
}

interface TyperWidgetDefinition extends Map<any>, TyperWidgetBase {
    element: string | Element;
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
    select(startNode: Node, collapse: number | boolean): void;
    select(startNode: Node, startOffset: number | boolean, endNode: Node, endOffset?: number | boolean): void;
    select(range: Range, collapse?: boolean): void;
    select(start: Range, end: Range): void;
}

interface TyperNode {
    readonly containingElement: Element;
    readonly element: Element | Range;
    readonly widget: TyperWidget;
    readonly childNodes: TyperNode[];
    readonly childDOMNodes: Node[];
    readonly firstChild: Node;
    readonly lastChild: Node;

    selectedInRange(range: Range): boolean;
    createRange(collapse: number): Range;
    createDOMNodeIterator(whatToShow: number, filter?: (node: Node) => NodeFilterResult): TyperDOMNodeIterator;
    cloneDOMNodes(deep: boolean): Node;
}

interface TyperTreeWalker extends Iterable<TyperNode> {
    new (root: TyperNode, whatToShow: number, filter?: (node: TyperNode) => NodeFilterResult): TyperTreeWalker;

    readonly whatToShow: number;
    readonly filter: (node: TyperNode) => NodeFilterResult;
    readonly root: TyperNode;
    currentNode: TyperNode;

    previousSibling(): TyperNode;
    nextSibling(): TyperNode;
    firstChild(): TyperNode;
    nextSlastChildibling(): TyperNode;
    parentNode(): TyperNode;
    previousNode(): TyperNode;
    nextNode(): TyperNode;
}

interface TyperDOMNodeIterator extends Iterable<Node> {
    new (root: Node | TyperTreeWalker, whatToShow: number, filter?: (node: Node) => NodeFilterResult): TyperDOMNodeIterator;

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

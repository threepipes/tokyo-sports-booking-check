interface ParserQuery {
  name: string; // html tag name
  class: string | undefined; // class name
  attrs: Map<string, string> | undefined; // attrs
}

function matchQuery(node: GoogleAppsScript.XML_Service.Element, q: ParserQuery): boolean {
  if (node.getName() !== q.name) {
    return false;
  }
  const classAttr = node.getAttribute('class');
  if (q.class !== undefined && (classAttr === null || classAttr.getValue() !== q.class)) {
    return false;
  }
  if (q.attrs !== undefined) {
    for (const [key, value] of q.attrs) {
      const attr = node.getAttribute(key);
      if (attr === null || attr.getValue() !== value) {
        return false;
      }
    }
  }
  return true;
}

export class Parser {
  private root: GoogleAppsScript.XML_Service.Element;

  constructor(root: GoogleAppsScript.XML_Service.Element) {
    this.root = root;
  }

  find(q: ParserQuery): GoogleAppsScript.XML_Service.Element[] {
    let result: GoogleAppsScript.XML_Service.Element[] = [];
    this._dfs(this.root, q, result);
    return result;
  }

  private _dfs(
    node: GoogleAppsScript.XML_Service.Element,
    q: ParserQuery,
    result: GoogleAppsScript.XML_Service.Element[]
  ) {
    if (matchQuery(node, q)) {
        result.push(node);
    }

    // Continue the DFS with the children of the current node
    const children = node.getChildren();
    for (let i = 0; i < children.length; i++) {
      this._dfs(children[i], q, result);
    }
  }
}

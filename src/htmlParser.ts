interface ParserQuery {
  name: string; // html tag name
  class: string | undefined; // class name
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
    // Check if the current node matches the query
    if (node.getName() === q.name) {
      const classAttr = node.getAttribute('class');
      if (q.class === undefined || classAttr !== null && classAttr.getValue() === q.class) {
        result.push(node);
      }
    }

    // Continue the DFS with the children of the current node
    const children = node.getChildren();
    for (let i = 0; i < children.length; i++) {
      this._dfs(children[i], q, result);
    }
  }
}

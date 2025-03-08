export class Graph {
  private vertices: Set<string>;
  private edges: Map<string, string[]>;

  constructor(initialVertices: string[]) {
    this.vertices = new Set(initialVertices);
    this.edges = new Map(initialVertices.map((v) => [v, []]));
  }

  addEdge(from: string, to: string) {
    if (!this.vertices.has(from)) {
      this.vertices.add(from);
      this.edges.set(from, []);
    }
    if (!this.vertices.has(to)) {
      this.vertices.add(to);
      this.edges.set(to, []);
    }
    this.edges.get(from)!.push(to);
  }

  getVertices() {
    return [...this.vertices];
  }

  successors(vertex: string) {
    return this.edges.get(vertex)!;
  }

  predecessors(vertex: string): string[] {
    const preds: string[] = [];
    for (const [v, neighbors] of this.edges) {
      if (neighbors.includes(vertex)) {
        preds.push(v);
      }
    }
    return preds;
  }

  public toSortedJSON() {
    const sortedVertices = Array.from(this.vertices).sort();
    const sortedEdges: { [key: string]: string[] } = {};
    Array.from(this.edges.keys())
      .sort()
      .forEach((key) => {
        sortedEdges[key] = this.edges.get(key)!.slice().sort();
      });

    const result = {
      vertices: sortedVertices,
      edges: sortedEdges,
    };

    return JSON.stringify(result, null, 2);
  }

  public toMap(): Map<string, string[]> {
    const mapRepresentation = new Map<string, string[]>();
    for (const [vertex, neighbors] of this.edges.entries()) {
      mapRepresentation.set(vertex, neighbors.slice());
    }
    return mapRepresentation;
  }

  public toOldGraph(): [Map<string, string[]>, string] {
    const map = this.toMap();
    return [map,[...map.keys()][0]]
}
}

export class Graph {
    vertices;
    edges;
    constructor(initialVertices) {
        this.vertices = new Set(initialVertices);
        this.edges = new Map(initialVertices.map((v) => [v, []]));
    }
    addEdge(from, to) {
        if (!this.vertices.has(from)) {
            this.vertices.add(from);
            this.edges.set(from, []);
        }
        if (!this.vertices.has(to)) {
            this.vertices.add(to);
            this.edges.set(to, []);
        }
        this.edges.get(from).push(to);
    }
    getVertices() {
        return [...this.vertices];
    }
    successors(vertex) {
        return this.edges.get(vertex);
    }
    predecessors(vertex) {
        const preds = [];
        for (const [v, neighbors] of this.edges) {
            if (neighbors.includes(vertex)) {
                preds.push(v);
            }
        }
        return preds;
    }
    toSortedJSON() {
        const sortedVertices = Array.from(this.vertices).sort();
        const sortedEdges = {};
        Array.from(this.edges.keys())
            .sort()
            .forEach((key) => {
            sortedEdges[key] = this.edges.get(key).slice().sort();
        });
        const result = {
            vertices: sortedVertices,
            edges: sortedEdges,
        };
        return JSON.stringify(result, null, 2);
    }
    toMap() {
        const mapRepresentation = new Map();
        for (const [vertex, neighbors] of this.edges.entries()) {
            mapRepresentation.set(vertex, neighbors.slice());
        }
        return mapRepresentation;
    }
    toOldGraph() {
        const map = this.toMap();
        return [map, [...map.keys()][0]];
    }
}
//# sourceMappingURL=graph.js.map
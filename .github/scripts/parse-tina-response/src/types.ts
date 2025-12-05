type GraphQLResponse = {
    data: {
        [key: string]: {
            edges: Array<Edge>;
        }
    }
}

type Edge = {
    node: {
        _sys: {
            path: string;
        }
    }
}

type FileData = {
    path: string;
    contents: string;
}

export type { GraphQLResponse, Edge, FileData };
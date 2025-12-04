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

export type { GraphQLResponse, Edge };
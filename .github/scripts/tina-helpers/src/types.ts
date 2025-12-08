interface GraphQLResponse<T = {}> {
    data: {
        [key: string]: {
            pageInfo: {
                hasNextPage: boolean;
                endCursor: string;
                startCursor: string;
            }
            edges: Array<Edge<T>>;
        }
    }
}

interface Edge<T = {}> {
    node: {
        _sys: {
            path: string;
        }
    } & T;
}

interface AuditableContent {
    lastChecked: string;
}

interface ITinaClient<T = {}> {
     getContent: ({first, after}: {first?: number, after?: string})=> Promise<GraphQLResponse <T>>;
}

type FileData = {
    path: string;
    content: string;
}

export type { GraphQLResponse, Edge, FileData , ITinaClient, AuditableContent};
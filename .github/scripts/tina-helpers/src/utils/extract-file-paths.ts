import type { Edge, GraphQLResponse } from "../types";

const extractFilePaths = (response: GraphQLResponse) : Array<string> => {
    const filePaths : Array<string> = [];
    for(const key of Object.keys(response.data)) {
      const edges = response.data[key]!.edges as Array<Edge>;
      edges.forEach((edge)=> {
          filePaths.push(edge.node._sys.path);
      })
    }
    return filePaths;
}


export default extractFilePaths;
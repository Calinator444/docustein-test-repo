import type { GraphQLResponse, Edge } from "./types";


export async function main(): Promise<void> {
  console.log("running main!");
  const tinaGqlResponse = process.argv[2];  
  if(!tinaGqlResponse)
  {
    console.error('Error: expected a graphql response from Tina')
    console.error('Please double check the graphql query provided')
    process.exit(1);
  }

  const response = JSON.parse(tinaGqlResponse) as GraphQLResponse;

  const filePaths : Array<string> = [];

  for(const key of Object.keys(response.data)) {
    const edges = response.data[key]!.edges as Array<Edge>;
    edges.forEach((edge)=> {
        filePaths.push(edge.node._sys.path);
    })
  }
  for(const path of filePaths) {
    console.log(path);
  }
}
main();
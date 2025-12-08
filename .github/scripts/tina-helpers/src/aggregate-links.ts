import type { GraphQLResponse, Edge, FileData } from "./types";

import { readFile } from 'node:fs/promises';

const ROOT_DIR = "../../../"
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

const mapFileContents = async (path: string) : Promise<FileData> => {
  const content = await readFile(`${ROOT_DIR}${path}`, {encoding: "utf-8"});
  return {path, content};
}

export async function main(): Promise<void> {

  const tinaGqlResponse = process.argv[2];  

  if(!tinaGqlResponse)
  {
    console.error('Error: expected a graphql response from Tina')
    console.error('Please double check the graphql query provided')
    process.exit(1);
  }

  const response = JSON.parse(tinaGqlResponse) as GraphQLResponse;

  const files = extractFilePaths(response);

  const allContents = await Promise.all(files.map((path)=> mapFileContents(path)));
  
  console.log(JSON.stringify(allContents));
}
main();
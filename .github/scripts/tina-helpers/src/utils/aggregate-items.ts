import TinaClient from '../services/tina-client';

import 'dotenv/config'

const aggregateContent = async (desiredLength : number)=> {

    const tinaClientId = process.env.TINA_CLIENT_ID;
    const tinaToken = process.env.TINA_TOKEN;

    if(!tinaClientId){
        console.error("Error: TINA_CLIENT_ID is not set in environment variables.");
        process.exit(1);
    }

    if(!tinaToken){
        console.error("Error: TINA_TOKEN is not set in environment variables.");
        process.exit(1);
    }

    const tinaClient = new TinaClient(tinaClientId, tinaToken);
    
    const allLinks: Array<string> = [];
    while(true) {
        const content = await tinaClient.getContent({first: desiredLength});
        for(const key of Object.keys(content.data)) {
            const data = content.data[key]!;
            const edges = data.edges;

            for(const edge of edges) {
                const node = edge.node;
                console.log("lastChecked", edge.node.lastChecked);
                const path = node._sys.path;
                allLinks.push(path);
                if(allLinks.length === desiredLength)
                {
                    return allLinks;
                }
            }
            if(!data.pageInfo.hasNextPage) {
                return allLinks;
            }
        }
    }
}

const main = async ()=> {
    const links = await aggregateContent(16);
    console.log("All Links:", links);
}

main();
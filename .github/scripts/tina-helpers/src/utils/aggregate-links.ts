import TinaClient from '../services/tina-client';
import Dayjs from 'dayjs';

import 'dotenv/config'

const aggregateContent = async (desiredLength : number)=> {

    const tinaClientId = process.env.TINA_CLIENT_ID;
    const tinaToken = process.env.TINA_TOKEN;
    const expiryInterval = process.env.TINA_AUDITOR_EXPIRY_DAYS;

    if(!tinaClientId){
        console.error("Error: TINA_CLIENT_ID is not set in environment secrets.");
        process.exit(1);
    }

    if(!tinaToken){
        console.error("Error: TINA_TOKEN is not set in environment secrets.");
        process.exit(1);
    }

    if(!expiryInterval) {
        console.error("Error: TINA_AUDITOR_EXPIRY_DAYS is not set in environment variables.");
    }

    const tinaClient = new TinaClient(tinaClientId, tinaToken);
    
    const allLinks: Array<string> = [];
    while(true) {
        const content = await tinaClient.getContent({first: desiredLength});
        for(const key of Object.keys(content.data)) {
            const data = content.data[key]!;
            const edges = data.edges;
            var day = Dayjs();

            var expiryDate = day.subtract(Number(expiryInterval), 'day');


            for(const edge of edges) {
                const node = edge.node;
                const path = node._sys.path;
                
                if(edge.node.lastChecked){
                    continue;
                }
                
                if((Dayjs(edge.node.lastChecked).isAfter(expiryDate))) {
                    allLinks.push(path);
                }

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

export {aggregateContent};
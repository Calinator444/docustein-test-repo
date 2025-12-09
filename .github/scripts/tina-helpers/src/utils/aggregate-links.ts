import TinaClient from '../services/tina-client';
import Dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import Time from '../services/time';
Dayjs.extend(utc);
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

    const expiryDate = Time.getNow().subtract(Number(expiryInterval), 'day');
    
    const allLinks: Array<string> = [];

    const content = await tinaClient.getContent({first: desiredLength, after: expiryDate.toISOString()});

    for(const key of Object.keys(content.data)) {
        const data = content.data[key]!;
        const edges = data.edges;

        return edges.map((edge)=> edge.node._sys.path);
    }
    
    return allLinks;
}

export {aggregateContent};
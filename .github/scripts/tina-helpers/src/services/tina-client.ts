import 'dotenv/config'

import type { GraphQLResponse, ITinaClient, AuditableContent } from '../types'

class TinaClient implements ITinaClient<AuditableContent> {
    private _tinaClientId: string;
    private _tinaToken: string;

    constructor(tinaClientId: string, tinaToken: string) {
        this._tinaClientId = tinaClientId;
        this._tinaToken = tinaToken;
    }


    async getContent(props? : {first?: number, after?: string}) {
    const query = process.env.TINA_AUDITOR_QUERY;

    if(!query) {
        console.error("Error: TINA_AUDITOR_QUERY is not set in environment variables.");
        process.exit(1);
    }

    console.log("Query", query);
    process.exit(0);
    let vars = {}
    const first = props?.first;
    const after = props?.after;
    if(first){
        vars = {...vars, first}
    }

    if (after){
        vars = {...vars, after}
    }
    const response = await fetch(`https://content.tinajs.io/1.6/content/${this._tinaClientId}/github/main`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this._tinaToken
        },
        body: JSON.stringify({
            query,
            variables: vars
        },
      
    ),
    })

    if(response.ok === false) {
        console.error("Error querying Tina Cloud:", response.statusText);
        process.exit(1);
    }

    const res = await response.json() as GraphQLResponse<{lastChecked: string}>;
    return res;
    }
}

export default TinaClient;
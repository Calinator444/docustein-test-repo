import 'dotenv/config'

import type { GraphQLResponse, ITinaClient, AuditableContent } from '../types'

class TinaClient implements ITinaClient<AuditableContent> {
    private _tinaClientId: string;
    private _tinaToken: string;

    constructor(tinaClientId: string, tinaToken: string) {
        this._tinaClientId = tinaClientId;
        this._tinaToken = tinaToken;
    }

    /** 
     * Fertches the outdated content from Tina Cloud.
     * @param {Object} props - Extra filters for the content query.
     * @param {number} props.first - The number of items to retrieve.
     * @param {string} props.after - ISO date string to filter content last checked after this date.
     */
    async getContent(props? : {first?: number, after?: string}) {
    const query = process.env.TINA_AUDITOR_QUERY;

    if(!query) {
        console.error("Error: TINA_AUDITOR_QUERY is not set in environment variables.");
        process.exit(1);
    }
    
    let vars = {}
    const first = props?.first;
    const after = props?.after;

    if(first){
        vars = {...vars, first}
    }

    if (after){
        vars = {...vars, filter: {
                lastChecked: {
                    after: after
            }
        }}
    }
    console.log('vars:', vars);
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
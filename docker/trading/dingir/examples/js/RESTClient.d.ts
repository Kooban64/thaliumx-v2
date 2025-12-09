import { AxiosInstance } from "axios";
declare class UserInfo {
    id: number;
    l1_address: string;
    l2_pubkey: string;
}
declare class RESTClient {
    client: AxiosInstance;
    constructor(server?: string);
    get_user_by_addr(addr: string): Promise<UserInfo>;
    internal_txs(user_id: number | string, params?: {
        limit?: number;
        offset?: number;
        start_time?: number;
        end_time?: number;
        order?: "asc" | "desc";
        side?: "from" | "to" | "both";
    }): Promise<any>;
}
declare let defaultRESTClient: RESTClient;
export { defaultRESTClient, RESTClient };
//# sourceMappingURL=RESTClient.d.ts.map
import { Connection, clusterApiUrl } from "@solana/web3.js";

class RpcConnection {
    private static connection: Connection;

    public static getRpcConnection() {
        if (!this.connection) {
            this.connection = new Connection(
                clusterApiUrl('devnet'),
                'confirmed'
            );
        }
        return this.connection;
    }
}

export default RpcConnection;
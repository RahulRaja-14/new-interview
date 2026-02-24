/**
 * Minimal Deno types to clear IDE errors when the Deno extension is not working.
 */
declare namespace Deno {
    export interface Env {
        get(key: string): string | undefined;
        set(key: string, value: string): void;
        delete(key: string): void;
        toObject(): { [key: string]: string };
    }

    export const env: Env;

    export interface ServeOptions {
        port?: number;
        hostname?: string;
        signal?: AbortSignal;
        onListen?: (params: { hostname: string; port: number }) => void;
        onError?: (error: unknown) => Response | Promise<Response>;
    }

    export type ServeHandler = (
        request: Request,
        info: { remoteAddr: { transport: "tcp" | "udp"; hostname: string; port: number } }
    ) => Response | Promise<Response>;

    export function serve(handler: ServeHandler): void;
    export function serve(options: ServeOptions, handler: ServeHandler): void;
}

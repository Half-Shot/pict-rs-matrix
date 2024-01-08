import { MatrixHostResolver } from 'matrix-appservice-bridge';
import { PictClient } from './pictClient';
import { defaultContentType, hashMedia } from './utils';
import { IncomingMessage, Server, ServerResponse, createServer } from "http";
import Router from "find-my-way";

/*
 TO IMPLEMENT
 * POST /_matrix/media/v1/create
GET /_matrix/media/v3/config
GET /_matrix/media/v3/download/{serverName}/{mediaId}
GET /_matrix/media/v3/download/{serverName}/{mediaId}/{fileName}
GET /_matrix/media/v3/preview_url
GET /_matrix/media/v3/thumbnail/{serverName}/{mediaId}
POST /_matrix/media/v3/upload
PUT /_matrix/media/v3/upload/{serverName}/{mediaId}
 */


export class Webserver {
    private readonly server: Server;
    private readonly hostResolver: MatrixHostResolver = new MatrixHostResolver();
    constructor(private readonly port: number, private readonly pict: PictClient) {
        const router = Router();
        router.on('GET', '/_matrix/media/v3/download/:serverName/:mediaId/:fileName?', this.getDownloadMedia.bind(this));
        this.server = createServer((request, response) => {
            router.lookup(request, response);
        });
    }

    async getDownloadMedia(request: IncomingMessage, reply: ServerResponse<IncomingMessage>, {serverName, mediaId, fileName}: Record<string, string|undefined>) {
        if (!serverName || !mediaId) {
            throw Error('Missing required serverName, mediaId');
        }
        const storedMediaId = hashMedia(serverName, mediaId);
        const cachedMedia = await this.pict.getMedia(storedMediaId);
        if (cachedMedia) {
            console.log('Using cached media');
            reply.setHeader('Content-Type', cachedMedia.type);
            if (cachedMedia.length) {
                reply.setHeader('Content-Type', cachedMedia.length);
            }
            reply.writeHead(200);
            for await (const chunk of cachedMedia.stream) {
                reply.write(chunk);
            }
            reply.end();
            return;
        }
        console.log('Media not cached');
        const homeserver = await this.hostResolver.resolveMatrixServer(serverName);
        // TODO: fileName

        const mediaUrl = new URL(`/_matrix/media/v3/download/${serverName}/${mediaId}?allow_remote=false`, homeserver.url);
        // TODO: stream
        const file = await fetch(mediaUrl, { headers: {
            host: homeserver.hostHeader,
        }});
        if (file.status !== 200) {
            reply.setHeader('content-type', 'application/json');
            reply.writeHead(404);
            reply.write(JSON.stringify({ errcode: 'M_NOT_FOUND', error: 'Media not found'}));
            return;
        }
        reply.statusCode = 200;
        const contentLength = file.headers.get('Content-Length');
        const contentType = file.headers.get('Content-Type');
        if (contentLength) {
            reply.setHeader('Content-Length', contentLength);
        }
        if (contentType) {
            reply.setHeader('Content-Type', contentType);
        }
        reply.writeHead(200);
        // TODO: Timeout.
        if (!file.body) {
            throw Error('No body on file');
        }
        const data = [];
        for await (const chunk of file.body) {
            reply.write(chunk);
            data.push(chunk);
        }
        reply.end();
        // Now write back to pict.
        try {
            const blob = new Blob(data,  { type: contentType || defaultContentType});
            await this.pict.uploadMedia(storedMediaId, blob);
        } catch (ex) {
            console.warn(`Failed to handle caching of remote media`, ex);
        }
    }

    async listen() {
        try {
            await this.server.listen({ port: this.port })
        } catch (err) {
            throw err;
        }
    }
}
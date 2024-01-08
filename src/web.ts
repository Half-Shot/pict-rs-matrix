import Fastify, { FastifyReply, FastifyRequest } from 'fastify'
import { MatrixHostResolver } from 'matrix-appservice-bridge';
import { ReadableStream } from 'node:stream/web';
import { PictClient } from './pictClient';
import { hashMedia } from './utils';

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
    private readonly fastify: ReturnType<typeof Fastify>;
    private readonly hostResolver: MatrixHostResolver = new MatrixHostResolver();
    constructor(private readonly port: number, private readonly pict: PictClient) {
        this.fastify = Fastify({
            logger: true
        })
        // Declare a route
        this.fastify.get('/_matrix/media/v3/download/:serverName/:mediaId/:fileName?', this.getDownloadMedia.bind(this));
    }

    async getDownloadMedia(request: FastifyRequest, reply: FastifyReply) {
        const { serverName, mediaId, fileName } = request.params as {serverName: string, mediaId: string, fileName?: string};
        const storedMediaId = hashMedia(serverName, mediaId);
        const cachedMedia = await this.pict.getMedia(storedMediaId);
        if (cachedMedia) {
            console.log('Using cached media');
            reply.hijack();
            reply.raw.setHeader('Content-Type', cachedMedia.type);
            if (cachedMedia.length) {
                reply.raw.setHeader('Content-Type', cachedMedia.length);
            }
            reply.raw.writeHead(200)
            for await (const chunk of cachedMedia.stream) {
                reply.raw.write(chunk);
            }
            reply.raw.end();
            return;
        }
        console.log('Media not cached');
        const homeserver = await this.hostResolver.resolveMatrixServer(serverName);
        // TODO: caching
        // TODO: fileName
        const mediaUrl = new URL(`/_matrix/media/v3/download/${serverName}/${mediaId}`, homeserver.url);
        // TODO: stream
        const file = await fetch(mediaUrl, { headers: {
            host: homeserver.hostHeader,
        }});
        if (file.status !== 200) {
            reply.statusCode = 404;
            reply.send({ errcode: 'M_NOT_FOUND', error: 'Media not found'});
            return;
        }
        reply.statusCode = 200;
        reply.hijack();
        const contentLength = file.headers.get('Content-Length');
        const contentType = file.headers.get('Content-Type');
        if (contentLength) {
            reply.raw.setHeader('Content-Length', contentLength);
        }
        if (contentType) {
            reply.raw.setHeader('Content-Type', contentType);
        }
        reply.raw.writeHead(200);
        // TODO: Timeout.
        const reader = file.body!.getReader();
        const data = [];
        do {
            const {done, value} = await reader.read();
            if (done) {
                break;
            }
            reply.raw.write(value);
            data.push(value);
        } while (true);
        reply.raw.end();
        const blob = new Blob(data,  { type: contentType || "application/octet-stream"});
        // Now write back to pict.
        await this.pict.uploadMedia(storedMediaId, blob);
    }

    async listen() {
        try {
            await this.fastify.listen({ port: this.port })
        } catch (err) {
            this.fastify.log.error(err)
            throw err;
        }
    }
}
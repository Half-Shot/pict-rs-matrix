import { ReadableStream } from "stream/web";

export class PictClient {
    constructor(private readonly baseUrl: string, private readonly apiKey: string) { }

    public async getMedia(mediaId: string): Promise<{stream: ReadableStream, type: string, length: string|null}|null> {
        const url = new URL(`/image/original/${encodeURIComponent(mediaId)}`, this.baseUrl);
        const req = await fetch(url, {
            method: 'GET',
        });
        if (req.status === 200) {
            if (req.body === null) {
                throw Error('Unexpected null body');
            }
            return {
                stream: req.body,
                length: req.headers.get('Content-Length'),
                type: req.headers.get('Content-Type') ?? 'application/octet-stream',
            };
        }
        if (req.status === 404) {
            return null;
        }
        const response = await req.json();
        console.log(response);
        throw Error('Unexpected response');
    }

    public async uploadMedia(mediaId: string, body: Blob) {
        const formData = new FormData();
        formData.append('images[]', body, mediaId);
        const url = new URL("/internal/import", this.baseUrl);
        const req = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Api-Token': this.apiKey,
            }
        });
        if (!req.ok) {
            throw Error(`Request failed with ${req.status} ${req.statusText}`);
        }
        console.log(await req.text());
    }
}
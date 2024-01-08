export function hashMedia(serverName: string, mediaId: string) {
    // TODO: Do better.
    return `${serverName}_${mediaId}`;
}
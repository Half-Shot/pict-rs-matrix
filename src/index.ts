import { PictClient } from "./pictClient";
import { Webserver } from "./web";

async function main() {
    const client = new PictClient("http://localhost:8080", "fibble");
    const web = new Webserver(3000, client);
    await web.listen();
}

main().catch((ex) => {
    console.error("Critical failure", ex);
})
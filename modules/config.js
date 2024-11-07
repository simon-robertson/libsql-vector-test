/// <reference types="node" />

import dotenv from "dotenv"

dotenv.config({ path: ".env" })

export default {
    openaiKey: process.env.APP_OPENAI_KEY ?? "",
    openaiOrganization: process.env.APP_OPENAI_ORGANIZATION ?? "",
    serverPort: process.env.APP_SERVER_PORT ?? "",
}

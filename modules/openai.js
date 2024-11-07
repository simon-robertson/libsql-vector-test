/// <reference types="node" />

import openai from "openai"

import config from "./config.js"

const instance = new openai({
    apiKey: config.openaiKey,
    organization: config.openaiOrganization,
})

export default instance

/// <reference types="node" />

import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import stream from "node:stream"
import zlib from "node:zlib"

import config from "./config.js"
import database from "./database.js"

/**
 * @returns {void}
 */
async function main() {
    await database.prepare()

    http.createServer(handleRequest).listen(config.serverPort | 0)
    // await database.search("swimming is something they like doing")
}

setImmediate(main)

/**
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 * @returns {void}
 */
function handleRequest(request, response) {
    let requestPath = new URL("http://localhost:" + config.serverPort + request.url).pathname

    if (requestPath === "/search") {
        handleSearchRequest(request, response)
        return
    }

    if (requestPath === "/") {
        requestPath = "/index.html"
    }

    requestPath = "." + requestPath

    if (fs.existsSync(requestPath) === false) {
        response.statusCode = 404
        response.end()
        return
    }

    handleStaticFileRequest(requestPath, response)
}

/**
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 * @returns {Promise<void>}
 */
async function handleSearchRequest(request, response) {
    if (request.method !== "POST") {
        response.statusCode = 405
        response.end()
        return
    }

    if (request.headers["content-type"] !== "text/plain") {
        response.statusCode = 400
        response.end()
        return
    }

    let requestContents = await readRequestContentsAsString(request)
    let responseContents = await database.search(requestContents)
    let responseStream = stream.Readable.from(JSON.stringify(responseContents))
    let compression = zlib.createBrotliCompress()

    response.statusCode = 200
    response.setHeader("cache-control", "no-cache, no-store")
    response.setHeader("content-encoding", "br")
    response.setHeader("content-type", "application/json")

    responseStream.pipe(compression).pipe(response)
}

/**
 * @param {http.IncomingMessage}
 * @returns {Promise<string>}
 */
function readRequestContentsAsString(request) {
    return new Promise((resolve) => {
        let chunks = []

        request.on("data", (chunk) => chunks.push(chunk.toString()))
        request.on("end", () => {
            resolve(chunks.join(""))
        })
    })
}

/**
 * @param {string} file
 * @param {http.ServerResponse} response
 * @returns {void}
 */
function handleStaticFileRequest(file, response) {
    let contentTypeMap = {
        ".css": "text/css",
        ".html": "text/html",
        ".js": "application/javascript",
        ".json": "application/json",
        ".md": "text/markdown",
    }

    let fileExtension = path.extname(file)
    let contentType = contentTypeMap[fileExtension] ?? "application/octet-stream"
    let contentStream = fs.createReadStream(file)
    let compression = zlib.createBrotliCompress()

    response.statusCode = 200
    response.setHeader("cache-control", "no-cache, no-store")
    response.setHeader("content-encoding", "br")
    response.setHeader("content-type", contentType)

    contentStream.pipe(compression).pipe(response)
}

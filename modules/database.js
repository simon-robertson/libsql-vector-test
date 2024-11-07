/// <reference types="node" />

import fs from "node:fs"
import openai from "./openai.js"
import { createClient } from "@libsql/client"

/**
 * @typedef {object} AnimalData
 * @property {string} name
 * @property {string} description
 */

/**
 * @typedef {object} AnimalRecord
 * @property {number} id
 * @property {string} name
 * @property {string} description
 */

/**
 * @typedef {object} SearchRecord
 * @property {string} query
 */

const database = "database.db"
const client = createClient({ url: "file:" + database })

/**
 * Creates the local database and populates it with records if the local
 * database does not exist. Database population will use the OpenAI `embeddings`
 * API to generate vectors for searchable data, e.g. animal descriptions.
 *
 * @returns {Promise<void>}
 */
async function prepare() {
    // If the database exists and has a non-zero size, it has been prepared.
    if (fs.existsSync(database)) {
        let stats = fs.statSync(database)

        if (stats.size > 0) {
            return
        }
    }

    await client.batch(
        [
            {
                sql: "DROP TABLE IF EXISTS animals",
            },
            {
                sql: "DROP TABLE IF EXISTS queries",
            },
            {
                sql: "CREATE TABLE animals ( id INTEGER PRIMARY KEY, name TEXT, description TEXT, embedding F32_BLOB(1024) )",
            },
            {
                sql: "CREATE INDEX animals_embedding_index ON animals ( libsql_vector_idx(embedding) )",
            },
            {
                sql: "CREATE TABLE searches ( id INTEGER PRIMARY KEY, query TEXT, vector TEXT )",
            },
            {
                sql: "CREATE INDEX searches_query_index ON searches ( query )",
            },
        ],
        "write",
    )

    let fileContent = fs.readFileSync("data/animals.json").toString()

    /** @type {AnimalData[]} */
    let animals = JSON.parse(fileContent)
    /** @type {import "@libsql/client".InStatement[]} */
    let statements = []

    for (let animal of animals.values()) {
        let response = await openai.embeddings.create({
            input: animal.description,
            model: "text-embedding-3-small",
            dimensions: 1024,
        })

        let embedding = JSON.stringify(response.data[0].embedding)

        statements.push({
            sql: "INSERT INTO animals ( name, description, embedding ) VALUES ( ?, ?, vector32(?) )",
            args: [animal.name, animal.description, embedding],
        })
    }

    await client.batch(statements, "write")
}

/**
 * Performs a vector search.
 *
 * If the query is unique, the OpenAI `embeddings` API will be used to convert
 * the search query to a vector. The vector will then be stored in the local
 * database for future use.
 *
 * @param {string} query
 * @returns {Promise<AnimalRecord[]>}
 */
async function search(query) {
    // Clean the input a bit.
    query = query
        .trim()
        .toLowerCase()
        .replace(/\s{2,}/g, " ")

    if (query.length < 1) {
        return []
    }

    let result = await client.execute({
        sql: "SELECT id, vector FROM searches WHERE query = ? LIMIT 1",
        args: [query],
    })

    /** @type {string} */
    let embedding

    if (result.rows.length > 0) {
        embedding = result.rows[0].vector
    } else {
        let response = await openai.embeddings.create({
            input: query,
            model: "text-embedding-3-small",
            dimensions: 1024,
        })

        embedding = JSON.stringify(response.data[0].embedding)

        await client.execute({
            sql: "INSERT INTO searches ( query, vector ) VALUES ( ?, ? )",
            args: [query, embedding],
        })
    }

    result = await client.execute({
        sql: "SELECT animals.id, animals.name, animals.description FROM vector_top_k('animals_embedding_index', ?, 1) as vectors JOIN animals ON animals.id = vectors.id",
        args: [embedding],
    })

    return result.rows
}

export default {
    prepare,
    search,
}

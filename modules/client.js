function main() {
    const formElements = document.querySelectorAll("form")

    formElements.forEach((formElement) => {
        formElement.addEventListener("submit", handleFormSubmission)
    })
}

setTimeout(main)

/**
 * @param {Event} event
 * @returns {Promise<void>}
 */
async function handleFormSubmission(event) {
    event.preventDefault()

    let form = event.target
    let action = form.getAttribute("action")

    if (action === "/search") {
        let contents = form.query.value
        let request = {
            method: "post",
            headers: {
                "content-type": "text/plain",
            },
            body: contents,
        }

        let response = await fetch(action, request)
        let responseContents = await response.json()

        form.query.value = ""

        renderSearchResults(responseContents)
    }
}

function renderSearchResults(results) {
    let elements = results.map((result) => {
        return `
            <div class="search-result">
                <h2>${result.name}</h2>
                <p>${result.description}</p>
            </div>
        `
    })

    document.getElementById("search-result-container").innerHTML = elements.join("")
}

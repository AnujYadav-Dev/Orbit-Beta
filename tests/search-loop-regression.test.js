const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const test = require('node:test')

const root = path.join(__dirname, '..')

function read(file) {
    return fs.readFileSync(path.join(root, file), 'utf8')
}

test('search task submits every daily search through a direct Bing URL', () => {
    const search = read('src/core/tasks/browser/Search.ts')

    assert.match(search, /submitSearchQuery/)
    assert.match(search, /Submitting query with direct search URL for daily search attribution/)
    assert.match(search, /Active page is not Bing, submitting query with direct search URL/)
    assert.match(search, /Bing search box not visible, submitting query with direct search URL/)
    assert.match(search, /navigateToSearchUrl\(searchPage, query, isMobile\)/)
    assert.match(search, /Submitted query via direct Bing URL/)
    assert.doesNotMatch(search, /keyboard\.type\(char/)
    assert.doesNotMatch(search, /Submitted query to Bing/)
})

test('search task uses shorter selector waits after direct navigation', () => {
    const search = read('src/core/tasks/browser/Search.ts')

    assert.match(search, /searchBox\.waitFor\(\{ state: 'visible', timeout: 8000 \}\)/)
    assert.doesNotMatch(search, /searchBox\.waitFor\(\{ state: 'visible', timeout: 15000 \}\)/)
})

test('search task stops stagnant loops at the configured threshold', () => {
    const search = read('src/core/tasks/browser/Search.ts')

    const stagnantAbortChecks = search.match(/stagnantLoop >= stagnantLoopMax/g) ?? []
    assert.equal(stagnantAbortChecks.length, 2)
    assert.doesNotMatch(search, /stagnantLoop > stagnantLoopMax/)
})

test('search retry logging distinguishes final failure from retry attempts', () => {
    const search = read('src/core/tasks/browser/Search.ts')

    assert.match(search, /if \(attempt >= maxAttempts\)/)
    assert.match(search, /Failed after \$\{maxAttempts\} attempts/)
    assert.match(search, /Retrying search \| nextAttempt=\$\{attempt \+ 1\}\/\$\{maxAttempts\}/)
    assert.doesNotMatch(search, /Retrying search \| attempt=\$\{i \+ 1\}\/\$\{maxAttempts\}/)
})

const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')
const test = require('node:test')

const root = path.join(__dirname, '..')

function read(file) {
    return fs.readFileSync(path.join(root, file), 'utf8')
}

test('error diagnostics capture warnings as well as errors', () => {
    const logService = read('src/notifications/LogService.ts')
    const helper = read('src/helpers/ErrorDiagnostic.ts')

    assert.match(logService, /\(level === 'error' \|\| level === 'warn'\) && config\.errorDiagnostics/)
    assert.match(logService, /errorDiagnostic\(page, error, level\)/)
    assert.match(helper, /level: 'error' \| 'warn' = 'error'/)
    assert.match(helper, /const folderName = `\$\{level\}-\$\{timestamp\}`/)
    assert.match(helper, /Level: \$\{level\.toUpperCase\(\)\}/)
})

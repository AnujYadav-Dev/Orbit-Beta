const assert = require('assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
require('ts-node/register')

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
    assert.match(helper, /Promise\.allSettled/)
    assert.match(helper, /dump-error\.txt/)
    assert.match(helper, /screenshot-error\.txt/)
})

test('error diagnostics still writes metadata when html capture fails', async () => {
    const { errorDiagnostic } = require('../src/helpers/ErrorDiagnostic')
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-diagnostics-'))
    const previousCwd = process.cwd()
    const previousConsoleLog = console.log
    const previousConsoleError = console.error
    const consoleErrors = []

    console.log = () => {}
    console.error = (...args) => consoleErrors.push(args)

    try {
        process.chdir(tempDir)

        const page = {
            isClosed: () => false,
            content: async () => {
                throw new Error('Unable to retrieve content because the page is navigating and changing the content.')
            },
            screenshot: async () => Buffer.from('png-bytes')
        }

        await errorDiagnostic(page, new Error('warning message'), 'warn')

        const diagnosticsRoot = path.join(tempDir, 'diagnostics')
        const [folderName] = fs.readdirSync(diagnosticsRoot)
        const outputDir = path.join(diagnosticsRoot, folderName)

        assert.match(folderName, /^warn-/)
        assert.match(fs.readFileSync(path.join(outputDir, 'error.txt'), 'utf8'), /warning message/)
        assert.match(fs.readFileSync(path.join(outputDir, 'dump-error.txt'), 'utf8'), /page is navigating/)
        assert.equal(fs.readFileSync(path.join(outputDir, 'screenshot.png'), 'utf8'), 'png-bytes')
        assert.equal(fs.existsSync(path.join(outputDir, 'dump.html')), false)
        assert.equal(consoleErrors.length, 0)
    } finally {
        process.chdir(previousCwd)
        console.log = previousConsoleLog
        console.error = previousConsoleError
        fs.rmSync(tempDir, { recursive: true, force: true })
    }
})

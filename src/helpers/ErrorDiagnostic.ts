import fs from 'fs/promises'
import path from 'path'
import type { Page } from 'patchright'

export async function errorDiagnostic(page: Page, error: Error, level: 'error' | 'warn' = 'error'): Promise<void> {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const folderName = `${level}-${timestamp}`
        const outputDir = path.join(process.cwd(), 'diagnostics', folderName)

        if (!page) {
            return
        }

        if (page.isClosed()) {
            return
        }

        const label = level === 'warn' ? 'Warning' : 'Error'
        const errorLog = `
Level: ${level.toUpperCase()}
Name: ${error.name}
Message: ${error.message}
Timestamp: ${new Date().toISOString()}
---------------------------------------------------
${label} Stack Trace:
${error.stack || 'No stack trace available'}
        `.trim()

        const [htmlContent, screenshotBuffer] = await Promise.all([
            page.content(),
            page.screenshot({ fullPage: true, type: 'png' })
        ])

        await fs.mkdir(outputDir, { recursive: true })

        await Promise.all([
            fs.writeFile(path.join(outputDir, 'dump.html'), htmlContent),
            fs.writeFile(path.join(outputDir, 'screenshot.png'), screenshotBuffer),
            fs.writeFile(path.join(outputDir, 'error.txt'), errorLog)
        ])

        console.log(`Diagnostics saved to: ${outputDir}`)
    } catch (error) {
        console.error('Unable to create error diagnostics:', error)
    }
}
